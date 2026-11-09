#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, Env, Vec,
};

fn setup_test() -> (
    Env,
    Address,
    FortressContractClient<'static>,
    Address,
    Address,
    Address,
    Address,
) {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000_000);

    let contract_id = env.register(FortressContract, ());
    let client = FortressContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let g1 = Address::generate(&env);
    let g2 = Address::generate(&env);
    let g3 = Address::generate(&env);

    let mut guardians = Vec::new(&env);
    guardians.push_back(g1.clone());
    guardians.push_back(g2.clone());
    guardians.push_back(g3.clone());

    let threshold = 2u32;
    let per_tx_limit = 500_0000000i128; // 500 units
    let daily_limit = 1_500_0000000i128; // 1500 units
    let recovery_timelock = 3600u64; // 1 hour

    client.initialize(
        &owner,
        &guardians,
        &threshold,
        &per_tx_limit,
        &daily_limit,
        &recovery_timelock,
    );

    (env, contract_id, client, owner, g1, g2, g3)
}

#[test]
fn test_initialize_and_view_methods() {
    let (_env, _contract_id, client, owner, g1, g2, g3) = setup_test();

    assert_eq!(client.get_owner(), owner);
    assert_eq!(client.get_threshold(), 2);

    let guardians = client.get_guardians();
    assert_eq!(guardians.len(), 3);
    assert!(client.is_guardian(&g1));
    assert!(client.is_guardian(&g2));
    assert!(client.is_guardian(&g3));

    let config = client.get_security_config();
    assert_eq!(config.per_tx_limit, 500_0000000);
    assert_eq!(config.daily_limit, 1_500_0000000);
    assert_eq!(config.recovery_timelock, 3600);

    let spending = client.get_spending_state();
    assert_eq!(spending.spent_in_window, 0);
    assert_eq!(client.get_proposal_count(), 0);
}

#[test]
fn test_cannot_reinitialize() {
    let (env, _contract_id, client, owner, g1, _, _) = setup_test();

    let mut guardians = Vec::new(&env);
    guardians.push_back(g1);

    let res = client.try_initialize(&owner, &guardians, &1, &100, &200, &3600);
    assert_eq!(res, Err(Ok(FortressError::AlreadyInitialized)));
}

#[test]
fn test_invalid_initialization_parameters() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(FortressContract, ());
    let client = FortressContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let g1 = Address::generate(&env);

    // 1. Owner as guardian rejected
    let mut bad_guardians = Vec::new(&env);
    bad_guardians.push_back(owner.clone());
    let res = client.try_initialize(&owner, &bad_guardians, &1, &100, &200, &3600);
    assert_eq!(res, Err(Ok(FortressError::CannotBeCurrentOwner)));

    // 2. Duplicate guardians rejected
    let mut dup_guardians = Vec::new(&env);
    dup_guardians.push_back(g1.clone());
    dup_guardians.push_back(g1.clone());
    let res = client.try_initialize(&owner, &dup_guardians, &1, &100, &200, &3600);
    assert_eq!(res, Err(Ok(FortressError::DuplicateGuardian)));

    // 3. Threshold 0 rejected
    let mut good_guardians = Vec::new(&env);
    good_guardians.push_back(g1.clone());
    let res = client.try_initialize(&owner, &good_guardians, &0, &100, &200, &3600);
    assert_eq!(res, Err(Ok(FortressError::InvalidThreshold)));

    // 4. Threshold > count rejected
    let res = client.try_initialize(&owner, &good_guardians, &2, &100, &200, &3600);
    assert_eq!(res, Err(Ok(FortressError::InvalidThreshold)));

    // 5. Daily limit < per-tx limit rejected
    let res = client.try_initialize(&owner, &good_guardians, &1, &500, &100, &3600);
    assert_eq!(res, Err(Ok(FortressError::InvalidSpendingLimit)));
}

#[test]
fn test_add_and_remove_guardian() {
    let (env, _contract_id, client, owner, _g1, _g2, g3) = setup_test();
    let stranger = Address::generate(&env);
    let new_guardian = Address::generate(&env);

    // Non-owner cannot add guardian
    let res = client.try_add_guardian(&stranger, &new_guardian, &None);
    assert_eq!(res, Err(Ok(FortressError::Unauthorized)));

    // Owner adds guardian with threshold 3
    client.add_guardian(&owner, &new_guardian, &Some(3));
    assert_eq!(client.get_guardians().len(), 4);
    assert_eq!(client.get_threshold(), 3);
    assert!(client.is_guardian(&new_guardian));

    // Cannot add duplicate guardian
    let res = client.try_add_guardian(&owner, &new_guardian, &None);
    assert_eq!(res, Err(Ok(FortressError::DuplicateGuardian)));

    // Owner removes g3
    client.remove_guardian(&owner, &g3, &Some(2));
    assert_eq!(client.get_guardians().len(), 3);
    assert!(!client.is_guardian(&g3));
    assert_eq!(client.get_threshold(), 2);

    // Non-existent guardian removal fails
    let res = client.try_remove_guardian(&owner, &g3, &None);
    assert_eq!(res, Err(Ok(FortressError::GuardianNotFound)));
}

#[test]
fn test_set_threshold() {
    let (env, _contract_id, client, owner, _g1, _g2, _g3) = setup_test();
    let stranger = Address::generate(&env);

    // Non-owner fails
    let res = client.try_set_threshold(&stranger, &3);
    assert_eq!(res, Err(Ok(FortressError::Unauthorized)));

    // Threshold = 0 fails
    let res = client.try_set_threshold(&owner, &0);
    assert_eq!(res, Err(Ok(FortressError::InvalidThreshold)));

    // Threshold > count fails
    let res = client.try_set_threshold(&owner, &5);
    assert_eq!(res, Err(Ok(FortressError::InvalidThreshold)));

    // Valid update
    client.set_threshold(&owner, &3);
    assert_eq!(client.get_threshold(), 3);
}

#[test]
fn test_social_recovery_lifecycle_success() {
    let (env, _contract_id, client, _owner, g1, g2, _g3) = setup_test();
    let new_owner = Address::generate(&env);

    // 1. Guardian 1 proposes recovery
    let proposal_id = client.propose_recovery(&g1, &new_owner);
    assert_eq!(proposal_id, 1);

    let prop = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(prop.status, ProposalStatus::Pending);
    assert_eq!(prop.approvals.len(), 1);

    // 2. Guardian 2 approves recovery (Threshold 2 is reached!)
    client.approve_recovery(&g2, &proposal_id);

    let prop = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(prop.status, ProposalStatus::Timelocked);
    assert_eq!(prop.approvals.len(), 2);
    assert!(prop.timelock_until > env.ledger().timestamp());

    // 3. Early execution fails due to active timelock
    let res = client.try_execute_recovery(&g1, &proposal_id);
    assert_eq!(res, Err(Ok(FortressError::TimelockNotElapsed)));

    // 4. Advance time past timelock (3600 seconds)
    env.ledger().set_timestamp(prop.timelock_until + 1);

    // 5. Execution succeeds!
    client.execute_recovery(&g1, &proposal_id);

    // Ownership transferred!
    assert_eq!(client.get_owner(), new_owner);
    let prop = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(prop.status, ProposalStatus::Executed);

    // 6. Replay attack fails
    let res = client.try_execute_recovery(&g1, &proposal_id);
    assert_eq!(res, Err(Ok(FortressError::AlreadyExecuted)));
}

#[test]
fn test_social_recovery_cancelled_by_owner() {
    let (env, _contract_id, client, owner, g1, g2, _g3) = setup_test();
    let attacker = Address::generate(&env);

    let proposal_id = client.propose_recovery(&g1, &attacker);
    client.approve_recovery(&g2, &proposal_id);

    let prop = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(prop.status, ProposalStatus::Timelocked);

    // Owner spots suspicious recovery and cancels it!
    client.cancel_recovery(&owner, &proposal_id);

    let prop = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(prop.status, ProposalStatus::Cancelled);

    // Subsequent approval or execution fails
    env.ledger().set_timestamp(prop.timelock_until + 10);
    let res = client.try_execute_recovery(&g1, &proposal_id);
    assert_eq!(res, Err(Ok(FortressError::ProposalCancelled)));
}

#[test]
fn test_social_recovery_unauthorized_proposer() {
    let (env, _contract_id, client, owner, _g1, _g2, _g3) = setup_test();
    let stranger = Address::generate(&env);
    let target = Address::generate(&env);

    // Non-guardian cannot propose
    let res = client.try_propose_recovery(&stranger, &target);
    assert_eq!(res, Err(Ok(FortressError::Unauthorized)));

    // Cannot propose current owner
    let res = client.try_propose_recovery(&_g1, &owner);
    assert_eq!(res, Err(Ok(FortressError::CannotBeCurrentOwner)));
}

#[test]
fn test_duplicate_and_removed_guardian_approvals() {
    let (env, _contract_id, client, owner, g1, g2, _g3) = setup_test();
    let new_owner = Address::generate(&env);

    let proposal_id = client.propose_recovery(&g1, &new_owner);

    // Duplicate approval by g1 rejected
    let res = client.try_approve_recovery(&g1, &proposal_id);
    assert_eq!(res, Err(Ok(FortressError::DuplicateApproval)));

    // g2 approves -> timelocked
    client.approve_recovery(&g2, &proposal_id);
    let prop = client.get_proposal(&proposal_id).unwrap();
    assert_eq!(prop.status, ProposalStatus::Timelocked);

    // Owner removes g2 while in timelock!
    client.remove_guardian(&owner, &g2, &Some(2));

    // Advance past timelock
    env.ledger().set_timestamp(prop.timelock_until + 10);

    // Execution fails because active guardian approvals is now only 1 (< threshold 2)!
    let res = client.try_execute_recovery(&g1, &proposal_id);
    assert_eq!(res, Err(Ok(FortressError::InsufficientApprovals)));
}

#[test]
fn test_expired_recovery_proposal() {
    let (env, _contract_id, client, _owner, g1, g2, _g3) = setup_test();
    let new_owner = Address::generate(&env);

    let proposal_id = client.propose_recovery(&g1, &new_owner);

    // Advance time past 7-day expiration (604,800s + 10s)
    env.ledger().set_timestamp(1_000_000 + 604_810);

    // Approving expired proposal fails
    let res = client.try_approve_recovery(&g2, &proposal_id);
    assert_eq!(res, Err(Ok(FortressError::ProposalExpired)));
}

#[test]
fn test_spending_controls_and_daily_limit_reset() {
    let (env, contract_id, client, owner, _g1, _g2, _g3) = setup_test();

    // Deploy mock token and mint to contract
    let token_admin = Address::generate(&env);
    let (token_contract, token_client) = {
        let contract = env.register_stellar_asset_contract_v2(token_admin.clone());
        (
            contract.address(),
            TokenClient::new(&env, &contract.address()),
        )
    };
    let stellar_client = StellarAssetClient::new(&env, &token_contract);
    stellar_client.mint(&contract_id, &10_000_0000000); // 10,000 units

    let recipient = Address::generate(&env);

    // Per-tx limit is 500 units; daily is 1500 units
    // 1. Transfer 300 units -> succeeds!
    client.transfer(&owner, &recipient, &token_contract, &300_0000000);
    assert_eq!(token_client.balance(&recipient), 300_0000000);
    assert_eq!(
        client.get_spending_state().spent_in_window,
        300_0000000
    );

    // 2. Transfer 600 units -> exceeds per_tx_limit (500) -> fails!
    let res = client.try_transfer(&owner, &recipient, &token_contract, &600_0000000);
    assert_eq!(res, Err(Ok(FortressError::ExceedsTxLimit)));

    // 3. Transfer 500 units -> succeeds (cumulative 800)
    client.transfer(&owner, &recipient, &token_contract, &500_0000000);
    assert_eq!(
        client.get_spending_state().spent_in_window,
        800_0000000
    );

    // 4. Transfer 500 units -> succeeds (cumulative 1300)
    client.transfer(&owner, &recipient, &token_contract, &500_0000000);
    assert_eq!(
        client.get_spending_state().spent_in_window,
        1300_0000000
    );

    // 5. Transfer 300 units -> 1300 + 300 = 1600 > daily_limit (1500) -> fails!
    let res = client.try_transfer(&owner, &recipient, &token_contract, &300_0000000);
    assert_eq!(res, Err(Ok(FortressError::ExceedsDailyLimit)));

    // 6. Non-owner transfer fails
    let stranger = Address::generate(&env);
    let res = client.try_transfer(&stranger, &recipient, &token_contract, &100_0000000);
    assert_eq!(res, Err(Ok(FortressError::Unauthorized)));

    // 7. Advance time by 1 day (86,400s) -> daily window resets!
    let next_day = env.ledger().timestamp() + 86_500;
    env.ledger().set_timestamp(next_day);

    // Now transfer of 500 units succeeds!
    client.transfer(&owner, &recipient, &token_contract, &500_0000000);
    assert_eq!(
        client.get_spending_state().spent_in_window,
        500_0000000
    );
}

#[test]
fn test_update_spending_limits_and_timelock() {
    let (env, _contract_id, client, owner, _g1, _g2, _g3) = setup_test();
    let stranger = Address::generate(&env);

    // Non-owner fails
    let res = client.try_update_spending_limits(&stranger, &1000, &2000);
    assert_eq!(res, Err(Ok(FortressError::Unauthorized)));

    // Invalid limits (daily < per-tx) fails
    let res = client.try_update_spending_limits(&owner, &2000, &1000);
    assert_eq!(res, Err(Ok(FortressError::InvalidSpendingLimit)));

    // Owner updates limits
    client.update_spending_limits(&owner, &1000_0000000, &3000_0000000);
    let config = client.get_security_config();
    assert_eq!(config.per_tx_limit, 1000_0000000);
    assert_eq!(config.daily_limit, 3000_0000000);

    // Owner updates recovery timelock
    client.update_recovery_timelock(&owner, &7200);
    assert_eq!(client.get_security_config().recovery_timelock, 7200);
}

