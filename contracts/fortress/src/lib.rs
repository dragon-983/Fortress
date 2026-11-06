#![no_std]

mod events;
pub mod types;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, token, Address, Env, Vec};
use types::*;

#[contract]
pub struct FortressContract;

#[contractimpl]
impl FortressContract {
    /// Initialize a new Fortress smart wallet with an owner, guardians, threshold, and limits.
    pub fn initialize(
        env: Env,
        owner: Address,
        guardians: Vec<Address>,
        threshold: u32,
        per_tx_limit: i128,
        daily_limit: i128,
        recovery_timelock: u64,
    ) -> Result<(), FortressError> {
        owner.require_auth();

        if env.storage().instance().has(&DataKey::Owner) {
            return Err(FortressError::AlreadyInitialized);
        }

        if guardians.is_empty() {
            return Err(FortressError::InvalidGuardian);
        }

        if threshold == 0 || threshold > guardians.len() {
            return Err(FortressError::InvalidThreshold);
        }

        if per_tx_limit <= 0 || daily_limit < per_tx_limit {
            return Err(FortressError::InvalidSpendingLimit);
        }

        // Verify guardians do not contain owner and do not have duplicates
        for i in 0..guardians.len() {
            let g = guardians.get(i).unwrap();
            if g == owner {
                return Err(FortressError::CannotBeCurrentOwner);
            }
            for j in (i + 1)..guardians.len() {
                if g == guardians.get(j).unwrap() {
                    return Err(FortressError::DuplicateGuardian);
                }
            }
        }

        let config = SecurityConfig {
            per_tx_limit,
            daily_limit,
            recovery_timelock,
        };

        let current_day = env.ledger().timestamp() / 86400;
        let spending_state = SpendingState {
            window_start_day: current_day,
            spent_in_window: 0,
        };

        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::Guardians, &guardians);
        env.storage().instance().set(&DataKey::Threshold, &threshold);
        env.storage().instance().set(&DataKey::SecurityConfig, &config);
        env.storage().instance().set(&DataKey::SpendingState, &spending_state);
        env.storage().instance().set(&DataKey::ProposalCounter, &0u64);

        events::emit_initialized(&env, owner, threshold);

        Ok(())
    }

    /// Add a new guardian to the wallet. Only callable by current owner.
    pub fn add_guardian(
        env: Env,
        caller: Address,
        new_guardian: Address,
        new_threshold: Option<u32>,
    ) -> Result<(), FortressError> {
        caller.require_auth();
        Self::assert_owner(&env, &caller)?;

        let owner = Self::get_owner(env.clone());
        if new_guardian == owner {
            return Err(FortressError::CannotBeCurrentOwner);
        }

        let mut guardians: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Guardians)
            .ok_or(FortressError::NotInitialized)?;

        for g in guardians.iter() {
            if g == new_guardian {
                return Err(FortressError::DuplicateGuardian);
            }
        }

        guardians.push_back(new_guardian.clone());

        let threshold = if let Some(thresh) = new_threshold {
            if thresh == 0 || thresh > guardians.len() {
                return Err(FortressError::InvalidThreshold);
            }
            thresh
        } else {
            Self::get_threshold(env.clone())
        };

        env.storage().instance().set(&DataKey::Guardians, &guardians);
        env.storage().instance().set(&DataKey::Threshold, &threshold);

        events::emit_guardian_added(&env, new_guardian, threshold);

        Ok(())
    }

    /// Remove an existing guardian. Only callable by current owner.
    pub fn remove_guardian(
        env: Env,
        caller: Address,
        guardian_to_remove: Address,
        new_threshold: Option<u32>,
    ) -> Result<(), FortressError> {
        caller.require_auth();
        Self::assert_owner(&env, &caller)?;

        let guardians: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Guardians)
            .ok_or(FortressError::NotInitialized)?;

        if guardians.len() <= 1 {
            return Err(FortressError::CannotRemoveLastGuardian);
        }

        let mut found = false;
        let mut new_guardians = Vec::new(&env);

        for g in guardians.iter() {
            if g == guardian_to_remove {
                found = true;
            } else {
                new_guardians.push_back(g);
            }
        }

        if !found {
            return Err(FortressError::GuardianNotFound);
        }

        let current_thresh = Self::get_threshold(env.clone());
        let threshold = if let Some(thresh) = new_threshold {
            if thresh == 0 || thresh > new_guardians.len() {
                return Err(FortressError::InvalidThreshold);
            }
            thresh
        } else if current_thresh > new_guardians.len() {
            new_guardians.len()
        } else {
            current_thresh
        };

        env.storage().instance().set(&DataKey::Guardians, &new_guardians);
        env.storage().instance().set(&DataKey::Threshold, &threshold);

        events::emit_guardian_removed(&env, guardian_to_remove, threshold);

        Ok(())
    }

    /// Update guardian approval threshold. Only callable by current owner.
    pub fn set_threshold(
        env: Env,
        caller: Address,
        new_threshold: u32,
    ) -> Result<(), FortressError> {
        caller.require_auth();
        Self::assert_owner(&env, &caller)?;

        let guardians = Self::get_guardians(env.clone());
        if new_threshold == 0 || new_threshold > guardians.len() {
            return Err(FortressError::InvalidThreshold);
        }

        let old_threshold = Self::get_threshold(env.clone());
        env.storage().instance().set(&DataKey::Threshold, &new_threshold);

        events::emit_threshold_changed(&env, old_threshold, new_threshold);

        Ok(())
    }

    /// Submit a recovery proposal to transfer ownership to a new address.
    /// Only registered guardians can propose recovery.
    pub fn propose_recovery(
        env: Env,
        guardian: Address,
        proposed_new_owner: Address,
    ) -> Result<u64, FortressError> {
        guardian.require_auth();

        if !Self::is_guardian(env.clone(), guardian.clone()) {
            return Err(FortressError::Unauthorized);
        }

        let current_owner = Self::get_owner(env.clone());
        if proposed_new_owner == current_owner {
            return Err(FortressError::CannotBeCurrentOwner);
        }

        let counter: u64 = env
            .storage()
            .instance()
            .get(&DataKey::ProposalCounter)
            .unwrap_or(0);

        let proposal_id = counter + 1;
        let created_at = env.ledger().timestamp();
        // 7 days validity window
        let expires_at = created_at + 604_800;

        let mut approvals = Vec::new(&env);
        approvals.push_back(guardian.clone());

        let threshold = Self::get_threshold(env.clone());
        let config = Self::get_security_config(env.clone());

        let (status, timelock_until) = if approvals.len() >= threshold {
            let unlock_time = created_at + config.recovery_timelock;
            events::emit_recovery_timelocked(&env, proposal_id, unlock_time);
            (ProposalStatus::Timelocked, unlock_time)
        } else {
            (ProposalStatus::Pending, 0u64)
        };

        let proposal = RecoveryProposal {
            id: proposal_id,
            proposer: guardian.clone(),
            proposed_owner: proposed_new_owner.clone(),
            approvals,
            created_at,
            expires_at,
            timelock_until,
            status,
        };

        env.storage().instance().set(&DataKey::ProposalCounter, &proposal_id);
        env.storage().instance().set(&DataKey::Proposal(proposal_id), &proposal);

        events::emit_recovery_proposed(&env, proposal_id, guardian, proposed_new_owner);

        Ok(proposal_id)
    }

    /// Approve an active recovery proposal. Only registered guardians can approve.
    pub fn approve_recovery(
        env: Env,
        guardian: Address,
        proposal_id: u64,
    ) -> Result<(), FortressError> {
        guardian.require_auth();

        if !Self::is_guardian(env.clone(), guardian.clone()) {
            return Err(FortressError::Unauthorized);
        }

        let mut proposal: RecoveryProposal = env
            .storage()
            .instance()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(FortressError::ProposalNotFound)?;

        if env.ledger().timestamp() > proposal.expires_at {
            proposal.status = ProposalStatus::Expired;
            env.storage().instance().set(&DataKey::Proposal(proposal_id), &proposal);
            return Err(FortressError::ProposalExpired);
        }

        if proposal.status != ProposalStatus::Pending && proposal.status != ProposalStatus::Timelocked {
            return match proposal.status {
                ProposalStatus::Executed => Err(FortressError::AlreadyExecuted),
                ProposalStatus::Cancelled => Err(FortressError::ProposalCancelled),
                ProposalStatus::Expired => Err(FortressError::ProposalExpired),
                _ => Err(FortressError::ProposalNotPending),
            };
        }

        for approver in proposal.approvals.iter() {
            if approver == guardian {
                return Err(FortressError::DuplicateApproval);
            }
        }

        proposal.approvals.push_back(guardian.clone());

        let threshold = Self::get_threshold(env.clone());
        let config = Self::get_security_config(env.clone());

        if proposal.approvals.len() >= threshold && proposal.status == ProposalStatus::Pending {
            let unlock_time = env.ledger().timestamp() + config.recovery_timelock;
            proposal.status = ProposalStatus::Timelocked;
            proposal.timelock_until = unlock_time;
            events::emit_recovery_timelocked(&env, proposal_id, unlock_time);
        }

        let total_approvals = proposal.approvals.len();
        env.storage().instance().set(&DataKey::Proposal(proposal_id), &proposal);

        events::emit_recovery_approved(&env, proposal_id, guardian, total_approvals);

        Ok(())
    }

    /// Cancel a recovery proposal. Callable by current owner or the proposer.
    pub fn cancel_recovery(
        env: Env,
        caller: Address,
        proposal_id: u64,
    ) -> Result<(), FortressError> {
        caller.require_auth();

        let mut proposal: RecoveryProposal = env
            .storage()
            .instance()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(FortressError::ProposalNotFound)?;

        let owner = Self::get_owner(env.clone());
        if caller != owner && caller != proposal.proposer {
            return Err(FortressError::Unauthorized);
        }

        if proposal.status != ProposalStatus::Pending && proposal.status != ProposalStatus::Timelocked {
            return match proposal.status {
                ProposalStatus::Executed => Err(FortressError::AlreadyExecuted),
                ProposalStatus::Cancelled => Err(FortressError::ProposalCancelled),
                ProposalStatus::Expired => Err(FortressError::ProposalExpired),
                _ => Err(FortressError::ProposalNotPending),
            };
        }

        proposal.status = ProposalStatus::Cancelled;
        env.storage().instance().set(&DataKey::Proposal(proposal_id), &proposal);

        events::emit_recovery_cancelled(&env, proposal_id, caller);

        Ok(())
    }

    /// Execute a recovery proposal whose threshold and timelock requirements have both passed.
    pub fn execute_recovery(env: Env, caller: Address, proposal_id: u64) -> Result<(), FortressError> {
        caller.require_auth();

        let mut proposal: RecoveryProposal = env
            .storage()
            .instance()
            .get(&DataKey::Proposal(proposal_id))
            .ok_or(FortressError::ProposalNotFound)?;

        if proposal.status == ProposalStatus::Executed {
            return Err(FortressError::AlreadyExecuted);
        }
        if proposal.status == ProposalStatus::Cancelled {
            return Err(FortressError::ProposalCancelled);
        }
        if proposal.status != ProposalStatus::Timelocked {
            return Err(FortressError::InsufficientApprovals);
        }

        let now = env.ledger().timestamp();
        if now > proposal.expires_at {
            proposal.status = ProposalStatus::Expired;
            env.storage().instance().set(&DataKey::Proposal(proposal_id), &proposal);
            return Err(FortressError::ProposalExpired);
        }

        if now < proposal.timelock_until {
            return Err(FortressError::TimelockNotElapsed);
        }

        // Security check: Verify that approvals from currently active guardians still meet the threshold!
        let guardians = Self::get_guardians(env.clone());
        let threshold = Self::get_threshold(env.clone());

        let mut active_approvals = 0u32;
        for approver in proposal.approvals.iter() {
            let mut is_active = false;
            for g in guardians.iter() {
                if g == approver {
                    is_active = true;
                    break;
                }
            }
            if is_active {
                active_approvals += 1;
            }
        }

        if active_approvals < threshold {
            return Err(FortressError::InsufficientApprovals);
        }

        let old_owner = Self::get_owner(env.clone());
        let new_owner = proposal.proposed_owner.clone();

        env.storage().instance().set(&DataKey::Owner, &new_owner);
        proposal.status = ProposalStatus::Executed;
        env.storage().instance().set(&DataKey::Proposal(proposal_id), &proposal);

        events::emit_recovery_executed(&env, proposal_id, old_owner, new_owner);

        Ok(())
    }

    /// Execute an asset transfer adhering strictly to per-transaction and daily spending limits.
    pub fn transfer(
        env: Env,
        caller: Address,
        to: Address,
        token: Address,
        amount: i128,
    ) -> Result<(), FortressError> {
        caller.require_auth();
        Self::assert_owner(&env, &caller)?;

        if amount <= 0 {
            return Err(FortressError::InvalidAmount);
        }

        let config = Self::get_security_config(env.clone());
        if amount > config.per_tx_limit {
            return Err(FortressError::ExceedsTxLimit);
        }

        let current_day = env.ledger().timestamp() / 86400;
        let mut spending_state = Self::get_spending_state(env.clone());

        if current_day > spending_state.window_start_day {
            spending_state.window_start_day = current_day;
            spending_state.spent_in_window = 0;
        }

        let new_spent = spending_state
            .spent_in_window
            .checked_add(amount)
            .ok_or(FortressError::InvalidAmount)?;

        if new_spent > config.daily_limit {
            return Err(FortressError::ExceedsDailyLimit);
        }

        spending_state.spent_in_window = new_spent;
        env.storage().instance().set(&DataKey::SpendingState, &spending_state);

        // Disburse token transfer from smart account contract to destination
        let client = token::Client::new(&env, &token);
        client.transfer(&env.current_contract_address(), &to, &amount);

        events::emit_transfer_executed(&env, to, token, amount);

        Ok(())
    }

    /// Update spending limits. Only callable by current owner.
    pub fn update_spending_limits(
        env: Env,
        caller: Address,
        new_per_tx: i128,
        new_daily: i128,
    ) -> Result<(), FortressError> {
        caller.require_auth();
        Self::assert_owner(&env, &caller)?;

        if new_per_tx <= 0 || new_daily < new_per_tx {
            return Err(FortressError::InvalidSpendingLimit);
        }

        let mut config = Self::get_security_config(env.clone());
        config.per_tx_limit = new_per_tx;
        config.daily_limit = new_daily;

        env.storage().instance().set(&DataKey::SecurityConfig, &config);

        events::emit_limits_updated(&env, new_per_tx, new_daily);

        Ok(())
    }

    /// Update recovery timelock duration. Only callable by current owner.
    pub fn update_recovery_timelock(
        env: Env,
        caller: Address,
        new_timelock: u64,
    ) -> Result<(), FortressError> {
        caller.require_auth();
        Self::assert_owner(&env, &caller)?;

        let mut config = Self::get_security_config(env.clone());
        config.recovery_timelock = new_timelock;

        env.storage().instance().set(&DataKey::SecurityConfig, &config);

        events::emit_timelock_updated(&env, new_timelock);

        Ok(())
    }

    // --- Query / View Helpers ---

    pub fn get_owner(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Owner).unwrap()
    }

    pub fn get_guardians(env: Env) -> Vec<Address> {
        env.storage().instance().get(&DataKey::Guardians).unwrap()
    }

    pub fn is_guardian(env: Env, addr: Address) -> bool {
        let guardians = Self::get_guardians(env);
        for g in guardians.iter() {
            if g == addr {
                return true;
            }
        }
        false
    }

    pub fn get_threshold(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Threshold).unwrap()
    }

    pub fn get_security_config(env: Env) -> SecurityConfig {
        env.storage().instance().get(&DataKey::SecurityConfig).unwrap()
    }

    pub fn get_spending_state(env: Env) -> SpendingState {
        env.storage().instance().get(&DataKey::SpendingState).unwrap()
    }

    pub fn get_proposal(env: Env, proposal_id: u64) -> Option<RecoveryProposal> {
        env.storage().instance().get(&DataKey::Proposal(proposal_id))
    }

    pub fn get_proposal_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::ProposalCounter)
            .unwrap_or(0)
    }

    fn assert_owner(env: &Env, caller: &Address) -> Result<(), FortressError> {
        let owner: Address = env
            .storage()
            .instance()
            .get(&DataKey::Owner)
            .ok_or(FortressError::NotInitialized)?;
        if caller != &owner {
            return Err(FortressError::Unauthorized);
        }
        Ok(())
    }
}
