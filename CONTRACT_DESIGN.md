# FORTRESS — Soroban Smart Contract Design

This document details the contract data structures, entry points, storage strategy, and event emission schema of the **FORTRESS Smart Account** contract built with Soroban SDK `v22.0.11`.

---

## 1. Storage Layout & Data Structures

The contract utilizes Soroban's `Env::storage().instance()` for low-latency, contract-scoped state management.

### 1.1 Storage Keys (`DataKey`)
```rust
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Config,                    // SecurityConfig
    Guardians,                 // Vec<Address>
    ProposalCounter,           // u64
    Proposal(u64),             // RecoveryProposal
    Spending(Address),         // SpendingState
}
```

### 1.2 Core Structures

#### `SecurityConfig`
```rust
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SecurityConfig {
    pub owner: Address,
    pub threshold: u32,
    pub per_tx_limit: i128,
    pub daily_limit: i128,
    pub recovery_timelock: u64, // In seconds (e.g., 3600 = 1 hour)
}
```

#### `RecoveryProposal`
```rust
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecoveryProposal {
    pub id: u64,
    pub proposer: Address,
    pub proposed_owner: Address,
    pub approvals: Vec<Address>,
    pub status: ProposalStatus,
    pub timelock_until: u64,    // Ledger timestamp when timelock ends
    pub expires_at: u64,        // Ledger timestamp when proposal expires (7 days)
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum ProposalStatus {
    Pending = 0,
    Timelocked = 1,
    Executed = 2,
    Cancelled = 3,
    Expired = 4,
}
```

#### `SpendingState`
```rust
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SpendingState {
    pub spent_in_window: i128,
    pub last_window_start: u64, // Ledger timestamp of the start of the 24h window
}
```

---

## 2. Public Contract Entry Points

### 2.1 Initialization
```rust
pub fn initialize(
    env: Env,
    owner: Address,
    guardians: Vec<Address>,
    threshold: u32,
    per_tx_limit: i128,
    daily_limit: i128,
    recovery_timelock: u64,
) -> Result<(), FortressError>
```
- **Auth**: Requires `owner.require_auth()`.
- **Validation**: Enforces $1 \le \text{threshold} \le \text{guardians.len()}$, limits $\ge 0$, and timelock $\ge 60$ seconds. Reverts with `AlreadyInitialized` if called more than once.

---

### 2.2 Guardian & Governance Administration
```rust
pub fn add_guardian(env: Env, guardian: Address) -> Result<(), FortressError>
```
- **Auth**: Requires current owner authentication.
- **Validation**: Reverts if the guardian is already registered.

```rust
pub fn remove_guardian(env: Env, guardian: Address) -> Result<(), FortressError>
```
- **Auth**: Requires current owner authentication.
- **Validation**: Reverts if the remaining guardian count drops below `threshold`.

```rust
pub fn set_threshold(env: Env, new_threshold: u32) -> Result<(), FortressError>
```
- **Auth**: Requires current owner authentication.
- **Validation**: Enforces $1 \le \text{new_threshold} \le \text{guardians.len()}$.

---

### 2.3 Social Recovery Protocol
```rust
pub fn propose_recovery(
    env: Env,
    proposer: Address,
    proposed_owner: Address,
) -> Result<u64, FortressError>
```
- **Auth**: Requires `proposer.require_auth()`. Proposer must be an active registered guardian.
- **Behavior**: Allocates a new monotonically incrementing proposal ID. If threshold is 1, immediately transitions to `Timelocked`. Sets `expires_at = now + 604,800`.

```rust
pub fn approve_recovery(
    env: Env,
    approver: Address,
    proposal_id: u64,
) -> Result<(), FortressError>
```
- **Auth**: Requires `approver.require_auth()`. Approver must be an active registered guardian and not already have voted on this proposal.
- **Behavior**: Adds approver to `approvals`. When `approvals.len() >= threshold`, transitions status to `Timelocked` and sets `timelock_until = now + recovery_timelock`.

```rust
pub fn cancel_recovery(
    env: Env,
    caller: Address,
    proposal_id: u64,
) -> Result<(), FortressError>
```
- **Auth**: Requires `caller.require_auth()`. Only the **active owner** may cancel a proposal.
- **Behavior**: Immediately marks the proposal as `Cancelled`. Irreversible veto.

```rust
pub fn execute_recovery(
    env: Env,
    proposal_id: u64,
) -> Result<(), FortressError>
```
- **Auth**: Open to any caller once preconditions are met.
- **Preconditions**: Status must be `Timelocked`, `now >= timelock_until`, and `now <= expires_at`.
- **Behavior**: Transfers account ownership to `proposed_owner`. Updates status to `Executed`.

---

### 2.4 Asset Spending & Limit Control
```rust
pub fn transfer(
    env: Env,
    token: Address,
    to: Address,
    amount: i128,
) -> Result<(), FortressError>
```
- **Auth**: Requires current `owner.require_auth()`.
- **Preconditions**:
  1. `amount <= config.per_tx_limit`
  2. If `now >= last_window_start + 86,400`: reset `spent_in_window = 0` and `last_window_start = now`.
  3. `spent_in_window + amount <= config.daily_limit`
- **Execution**: Updates `SpendingState` and invokes the SAC client:
  ```rust
  token::Client::new(&env, &token).transfer(&env.current_contract_address(), &to, &amount);
  ```

---

### 2.5 Policy Configuration Entry Points
```rust
pub fn update_spending_limits(
    env: Env,
    new_per_tx: i128,
    new_daily: i128,
) -> Result<(), FortressError>
```
- **Auth**: Requires current owner authentication. Updates limits in `SecurityConfig`.

```rust
pub fn update_recovery_timelock(
    env: Env,
    new_timelock: u64,
) -> Result<(), FortressError>
```
- **Auth**: Requires current owner authentication. Timelock must be $\ge 60$ seconds.

---

### 2.6 View & Inspection Methods
- `get_config(env: Env) -> SecurityConfig`
- `get_guardians(env: Env) -> Vec<Address>`
- `get_proposal(env: Env, proposal_id: u64) -> Option<RecoveryProposal>`
- `get_spending_state(env: Env, token: Address) -> SpendingState`
- `get_latest_proposal_id(env: Env) -> u64`

---

## 3. Event Emission Schema

All events are emitted via `env.events().publish(...)` under structured topics to enable zero-loss indexing by off-chain watchers:

| Event Topic | Event Data Payload | Purpose |
|---|---|---|
| `("FORTRESS", Symbol::new(&env, "init"))` | `(owner, threshold, guardians)` | Contract initialization |
| `("FORTRESS", Symbol::new(&env, "guardian_add"))` | `(guardian)` | Guardian registered |
| `("FORTRESS", Symbol::new(&env, "guardian_rem"))` | `(guardian)` | Guardian deregistered |
| `("FORTRESS", Symbol::new(&env, "threshold"))` | `(new_threshold)` | Quorum threshold updated |
| `("FORTRESS", Symbol::new(&env, "prop_rec"))` | `(proposal_id, proposer, candidate)`| Recovery proposal created |
| `("FORTRESS", Symbol::new(&env, "app_rec"))` | `(proposal_id, approver, status)` | Guardian approval registered |
| `("FORTRESS", Symbol::new(&env, "canc_rec"))` | `(proposal_id, owner)` | Recovery proposal vetoed |
| `("FORTRESS", Symbol::new(&env, "exec_rec"))` | `(proposal_id, new_owner)` | Recovery executed; ownership migrated |
| `("FORTRESS", Symbol::new(&env, "transfer"))` | `(token, to, amount)` | Spending executed under limits |
| `("FORTRESS", Symbol::new(&env, "limits"))` | `(per_tx, daily)` | Spending limits reconfigured |

