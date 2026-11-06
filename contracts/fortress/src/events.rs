use soroban_sdk::{Address, Env, Symbol};

pub fn emit_initialized(env: &Env, owner: Address, threshold: u32) {
    let topics = (Symbol::new(env, "initialized"), owner);
    env.events().publish(topics, threshold);
}

pub fn emit_guardian_added(env: &Env, guardian: Address, threshold: u32) {
    let topics = (Symbol::new(env, "guardian_added"), guardian);
    env.events().publish(topics, threshold);
}

pub fn emit_guardian_removed(env: &Env, guardian: Address, threshold: u32) {
    let topics = (Symbol::new(env, "guardian_removed"), guardian);
    env.events().publish(topics, threshold);
}

pub fn emit_threshold_changed(env: &Env, old_threshold: u32, new_threshold: u32) {
    let topics = (Symbol::new(env, "threshold_changed"),);
    env.events().publish(topics, (old_threshold, new_threshold));
}

pub fn emit_recovery_proposed(
    env: &Env,
    proposal_id: u64,
    proposer: Address,
    proposed_owner: Address,
) {
    let topics = (Symbol::new(env, "recovery_proposed"), proposal_id);
    env.events().publish(topics, (proposer, proposed_owner));
}

pub fn emit_recovery_approved(
    env: &Env,
    proposal_id: u64,
    guardian: Address,
    total_approvals: u32,
) {
    let topics = (Symbol::new(env, "recovery_approved"), proposal_id);
    env.events().publish(topics, (guardian, total_approvals));
}

pub fn emit_recovery_timelocked(env: &Env, proposal_id: u64, timelock_until: u64) {
    let topics = (Symbol::new(env, "recovery_timelocked"), proposal_id);
    env.events().publish(topics, timelock_until);
}

pub fn emit_recovery_cancelled(env: &Env, proposal_id: u64, canceller: Address) {
    let topics = (Symbol::new(env, "recovery_cancelled"), proposal_id);
    env.events().publish(topics, canceller);
}

pub fn emit_recovery_executed(
    env: &Env,
    proposal_id: u64,
    old_owner: Address,
    new_owner: Address,
) {
    let topics = (Symbol::new(env, "recovery_executed"), proposal_id);
    env.events().publish(topics, (old_owner, new_owner));
}

pub fn emit_transfer_executed(env: &Env, to: Address, token: Address, amount: i128) {
    let topics = (Symbol::new(env, "transfer_executed"), to);
    env.events().publish(topics, (token, amount));
}

pub fn emit_limits_updated(env: &Env, per_tx_limit: i128, daily_limit: i128) {
    let topics = (Symbol::new(env, "limits_updated"),);
    env.events().publish(topics, (per_tx_limit, daily_limit));
}

pub fn emit_timelock_updated(env: &Env, new_timelock: u64) {
    let topics = (Symbol::new(env, "timelock_updated"),);
    env.events().publish(topics, new_timelock);
}
