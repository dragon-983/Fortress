# FORTRESS — Security Specification & Threat Model

This document outlines the security architecture, threat model, invariant guarantees, and protective defenses implemented across the **FORTRESS** smart account system on Stellar.

---

## 1. Threat Modeling & Attack Vectors

### 1.1 Compromised Owner Key (Private Key Theft)
- **Threat Vector**: An attacker extracts the owner's private key via malware, phishing, or accidental disclosure. In a standard Stellar EOA, the attacker immediately drains the entire balance.
- **FORTRESS Defense**:
  1. **Spending Limits**: The attacker can only transfer up to the `per_tx_limit` and `daily_limit` within any 24-hour rolling window. Large vault balances cannot be instantly liquidated.
  2. **Guardian Quorum for Parameter Changes**: The owner key alone cannot arbitrarily increase the spending limit beyond existing thresholds or delete guardians without guardian quorum or enforced timelocks.
  3. **Social Recovery**: The rightful user can coordinate with their trusted guardians to initiate social recovery. When quorum is reached, the compromised key is stripped of ownership, transferring control to a pristine candidate key.

### 1.2 Rogue / Colluding Guardians (Sybil & Takeover Attacks)
- **Threat Vector**: A malicious subset of guardians attempts to steal the wallet by proposing a recovery to their own controlled address.
- **FORTRESS Defense**:
  1. **Configurable M-of-N Quorum**: Threshold is strictly enforced on-chain ($M \ge 2$ recommended, $1 \le M \le N$). A single rogue guardian cannot force a transfer of ownership.
  2. **Enforced Timelock Period**: Even if $M$ guardians collude, the recovery proposal enters a mandatory `Timelocked` state (default 3600s, configurable up to 7 days).
  3. **Owner Emergency Veto**: During the timelock window, the active owner can invoke `cancel_recovery()`. Because `cancel_recovery()` requires only owner authentication, a single transaction instantly cancels the malicious attempt.
  4. **Active Proposal Lock**: Only one active recovery proposal is evaluated at a time; duplicate or competing malicious proposals are tracked and subject to owner cancellation.

### 1.3 Spending Limit Circumvention & Window Exploitation
- **Threat Vector**: An attacker attempts to bypass daily spending limits by splitting funds into micro-transactions or manipulating block timestamps.
- **FORTRESS Defense**:
  1. **Ledger-Enforced Cumulative Tracking**: `SpendingState` maintains `spent_in_window` and `last_window_start`. Every transfer, regardless of size, increments `spent_in_window`.
  2. **Strict Time Reset Invariant**: The 24-hour reset ($86,400\text{ seconds}$) only triggers if `current_ledger_timestamp \ge last_window_start + 86,400`. Ledger timestamps on Stellar are verified by network-wide Stellar Consensus Protocol (SCP) validators and cannot be spoofed by a transactor.
  3. **Atomic Rollback**: If `spent_in_window + amount > daily_limit`, the transaction reverts with `FortressError::SpendingLimitExceeded`. No partial transfers or state corruption can occur.

### 1.4 Replay Attacks Across Contracts or Networks
- **Threat Vector**: An attacker intercepts a signed recovery approval or transfer transaction on Testnet and attempts to replay it on Futurenet, Mainnet, or another user's FORTRESS instance.
- **FORTRESS Defense**:
  1. **Native Soroban Invocation Binding**: Soroban's `Address::require_auth()` cryptographically binds authorizations to the specific `ContractId`, `NetworkPassphrase`, and method signature.
  2. **Unique On-Chain Proposal IDs**: Recovery proposals are indexed by a monotonically increasing `u64` counter stored in contract storage. Approvals reference this specific proposal ID; signatures cannot be reused for subsequent proposals.
  3. **Duplicate Approval Prevention**: The contract scans the proposal's `approvals` vector. Any redundant approval call by the same guardian reverts with `FortressError::DuplicateApproval`.

### 1.5 Stale Proposal Resuscitation
- **Threat Vector**: A proposal that failed to gather sufficient quorum months ago is suddenly approved after circumstances have changed.
- **FORTRESS Defense**:
  1. **Hardcoded Expiration (7-Day TTL)**: Every proposal has `expires_at = current_ledger_time + 604,800`.
  2. If `current_ledger_time > expires_at`, `approve_recovery()` and `execute_recovery()` unconditionally revert with `FortressError::ProposalExpired`.

---

## 2. On-Chain Security Invariants

The following invariants are formally enforced in Rust within `contracts/fortress/src/lib.rs`:

```rust
// INVARIANT 1: Quorum must be mathematically valid
1 <= threshold <= guardians.len()

// INVARIANT 2: No duplicate guardians
forall i, j in guardians: i != j ==> guardians[i] != guardians[j]

// INVARIANT 3: Timelock must be non-zero
recovery_timelock >= 60 seconds

// INVARIANT 4: Execution requires timelock maturity
current_ledger_timestamp >= timelock_until

// INVARIANT 5: Owner veto is unconstrained during timelock
caller == current_owner ==> cancel_recovery() succeeds
```

---

## 3. Error Codes & Failure Modes

| Error Name | Code | Description & Security Impact |
|---|---|---|
| `AlreadyInitialized` | 1 | Prevents front-running initialization of deployed contract instances. |
| `NotInitialized` | 2 | Ensures methods cannot be invoked before state is seeded. |
| `Unauthorized` | 3 | Invoked when `require_auth` fails or an unregistered entity attempts guardian actions. |
| `InvalidThreshold` | 4 | Prevents setting a threshold greater than guardian count or less than 1. |
| `InvalidGuardianCount` | 5 | Prevents removing guardians if count drops below active threshold. |
| `ProposalNotFound` | 6 | Protects against invalid proposal ID lookups. |
| `ProposalExpired` | 7 | Prevents stale recovery proposals from being approved or executed. |
| `SpendingLimitExceeded`| 8 | Enforces on-chain per-transaction and 24h cumulative caps. |
| `TimelockNotExpired` | 9 | Reverts premature `execute_recovery` invocations before the veto window closes. |
| `DuplicateApproval` | 10 | Rejects double-voting by guardians. |
| `InvalidProposalStatus`| 11 | Prevents approving or executing already cancelled/executed proposals. |

---

## 4. Audit Verification & Test Matrix

All threat mitigations are backed by automated tests in `contracts/fortress/src/test.rs`:

| Test Name | Threat Tested | Result |
|---|---|---|
| `test_invalid_initialization_parameters` | Zero threshold, zero timelock | Verified Revert |
| `test_cannot_reinitialize` | Contract takeover re-initialization | Verified Revert |
| `test_social_recovery_unauthorized_proposer` | Non-guardian initiating recovery | Verified Revert |
| `test_duplicate_and_removed_guardian_approvals` | Double voting, removed guardian voting | Verified Revert |
| `test_expired_recovery_proposal` | Approval/Execution after 7 days | Verified Revert |
| `test_social_recovery_cancelled_by_owner` | Owner veto during timelock | Verified Cancelled |
| `test_spending_controls_and_daily_limit_reset` | Per-tx overflow, daily overflow, 24h reset | Verified Limits & Reset |
| `test_set_threshold` | Threshold > guardian count | Verified Revert |
