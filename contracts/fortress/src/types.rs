use soroban_sdk::{contracterror, contracttype, Address, Vec};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum FortressError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    InvalidThreshold = 4,
    InvalidGuardian = 5,
    DuplicateGuardian = 6,
    GuardianNotFound = 7,
    CannotRemoveLastGuardian = 8,
    CannotBeCurrentOwner = 9,
    ExceedsTxLimit = 10,
    ExceedsDailyLimit = 11,
    InvalidAmount = 12,
    ProposalNotFound = 13,
    ProposalNotPending = 14,
    ProposalExpired = 15,
    DuplicateApproval = 16,
    TimelockNotElapsed = 17,
    InsufficientApprovals = 18,
    AlreadyExecuted = 19,
    ProposalCancelled = 20,
    ActiveProposalExists = 21,
    InvalidTimelock = 22,
    InvalidSpendingLimit = 23,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProposalStatus {
    Pending,
    Timelocked,
    Executed,
    Cancelled,
    Expired,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SecurityConfig {
    pub per_tx_limit: i128,
    pub daily_limit: i128,
    pub recovery_timelock: u64, // seconds
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SpendingState {
    pub window_start_day: u64, // timestamp / 86400
    pub spent_in_window: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecoveryProposal {
    pub id: u64,
    pub proposer: Address,
    pub proposed_owner: Address,
    pub approvals: Vec<Address>,
    pub created_at: u64,
    pub expires_at: u64,
    pub timelock_until: u64, // 0 if not timelocked yet
    pub status: ProposalStatus,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Owner,
    Guardians,
    Threshold,
    SecurityConfig,
    SpendingState,
    ProposalCounter,
    Proposal(u64),
}
