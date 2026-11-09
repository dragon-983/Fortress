# FORTRESS — Architecture Specification

This document details the architectural design, system boundaries, component interactions, and execution lifecycles of **FORTRESS**, a programmable security smart account wallet on Stellar.

---

## 1. System Overview & Component Topology

FORTRESS follows a decentralized security architecture where the **Soroban smart contract** functions as the root of trust, and the **backend service** acts as a high-performance event indexer and transaction relay.

```mermaid
graph TD
    subgraph Client Layer ["Client Layer (React 19 / Vite / Tailwind v4)"]
        UI[FORTRESS Web Interface]
        Freighter[Freighter Wallet Extension]
        Sandbox[5-Role Persona Switcher]
        UI --> Freighter
        UI --> Sandbox
    end

    subgraph Service Layer ["Off-Chain Service Layer (Node.js / Express)"]
        API[REST API Gateway :3005]
        AuthMW[Authentication & Role Middleware]
        Indexer[Event Indexer & Horizon Poller]
        DB[(PostgreSQL Database)]

        API --> AuthMW
        AuthMW --> DB
        Indexer --> DB
    end

    subgraph Stellar Network ["Stellar Soroban Network (Testnet)"]
        RPC[Soroban RPC Endpoint]
        Horizon[Stellar Horizon API]
        Contract[FORTRESS Smart Contract]
        Token[Stellar Native & SAC Assets]

        Contract --> Token
    end

    UI -->|JSON REST Requests| API
    UI -->|Sign Soroban Tx| Freighter
    Freighter -->|Submit Tx| RPC
    API -->|Submit Relay / Verify| RPC
    Indexer -->|Ingest Events| RPC
    Indexer -->|Query Balances| Horizon
    Contract -.->|Emit Events| Indexer
```

---

## 2. On-Chain vs. Off-Chain Boundary

| Domain | Component | Responsibility | Failure Impact |
|---|---|---|---|
| **On-Chain** | Soroban Smart Contract | Custody of funds, cryptographic authentication (`require_auth()`), guardian registry, spending limit checks, social recovery state machine, timelock veto enforcement. | Fundamental root of trust. Non-bypassable by any off-chain actor. |
| **On-Chain** | Stellar Asset Contract (SAC) | Token balance tracking (XLM, USDC) and transfer executions (`client.transfer()`). | Governed by Stellar network consensus. |
| **Off-Chain** | Event Indexer | Subscribes to contract events, indexes historical audits, normalizes security logs into relational tables. | Degrades historical audit view in UI; does not compromise wallet funds or authorization. |
| **Off-Chain** | REST API & Database | Caches active proposals, guardian metadata (nicknames/labels), and provides fast querying for web clients. | Clients can fall back to direct Soroban RPC queries if API is offline. |
| **Client** | React UI + Freighter | Key management, user transaction construction, multi-persona simulation, and interactive visualization. | Purely client-side representation. |

---

## 3. Core Sequence Flows

### 3.1 Spending Execution & Limit Enforcement

Any asset transfer initiated from the FORTRESS smart account must satisfy both the **per-transaction limit** and the **24-hour rolling daily limit**.

```mermaid
sequenceDiagram
    autonumber
    actor Owner as Primary Owner (GAOWNER...)
    participant UI as FORTRESS UI
    participant Contract as Fortress Contract (Soroban)
    participant SAC as Stellar Asset Contract
    participant Indexer as Backend Indexer
    participant DB as PostgreSQL

    Owner->>UI: Submit Transfer (Asset, Recipient, Amount)
    UI->>Contract: transfer(owner, token, to, amount)
    Contract->>Contract: require_auth(owner)
    
    alt Amount > per_tx_limit
        Contract-->>UI: Revert: FortressError::SpendingLimitExceeded (Code 8)
        Contract--xSAC: No transfer executed
        Contract-->>Indexer: Emit Event (TransferRejected, reason="LimitExceeded")
        Indexer->>DB: Record security_event (transfer_rejected)
    else Amount <= per_tx_limit
        Contract->>Contract: Read SpendingState & Ledger Timestamp
        alt Current Ledger Time >= last_window_start + 86400s
            Contract->>Contract: Reset spent_in_window = 0
            Contract->>Contract: Set last_window_start = current_ledger_time
        end

        alt (spent_in_window + amount) > daily_limit
            Contract-->>UI: Revert: FortressError::SpendingLimitExceeded (Code 8)
            Contract-->>Indexer: Emit Event (TransferRejected, reason="DailyLimitExceeded")
            Indexer->>DB: Record security_event (transfer_rejected)
        else (spent_in_window + amount) <= daily_limit
            Contract->>Contract: spent_in_window += amount
            Contract->>SAC: transfer(fortress_contract, to, amount)
            SAC-->>Contract: Success
            Contract-->>UI: Return Result
            Contract-->>Indexer: Emit Event (TransferExecuted, to, amount)
            Indexer->>DB: Record security_event (transfer_executed)
        end
    end
```

---

### 3.2 Social Recovery Lifecycle & Owner Veto

The social recovery protocol enables guardians to restore access if the owner loses their key, while providing absolute veto authority to the active owner during the timelock window.

```mermaid
sequenceDiagram
    autonumber
    actor G1 as Guardian 1
    actor G2 as Guardian 2
    actor Owner as Owner (or Attacker)
    participant Contract as Fortress Contract
    participant Indexer as Backend Indexer

    Note over G1,Contract: Phase 1: Recovery Initiation
    G1->>Contract: propose_recovery(guardian_1, candidate_address)
    Contract->>Contract: Verify G1 is active guardian
    Contract->>Contract: Create Proposal #1 (approvals=[G1], status=Pending)
    Contract-->>Indexer: Emit Event (RecoveryProposed)

    Note over G2,Contract: Phase 2: Quorum Attainment
    G2->>Contract: approve_recovery(guardian_2, proposal_id=1)
    Contract->>Contract: Verify G2 is active guardian & not duplicate
    Contract->>Contract: approvals.len() == 2 >= threshold (2-of-3)
    Contract->>Contract: status = Timelocked
    Contract->>Contract: timelock_until = ledger_time + recovery_timelock (e.g. 3600s)
    Contract-->>Indexer: Emit Event (RecoveryApproved, TimelockActive)

    alt Scenario A: Legitimate Owner Vetoes Accidental/Malicious Recovery
        Note over Owner,Contract: Phase 3A: Emergency Veto
        Owner->>Contract: cancel_recovery(owner, proposal_id=1)
        Contract->>Contract: require_auth(owner)
        Contract->>Contract: status = Cancelled
        Contract-->>Indexer: Emit Event (RecoveryCancelled)
    else Scenario B: Timelock Expires & Ownership Transfers
        Note over G1,Contract: Phase 3B: Recovery Execution
        G1->>Contract: execute_recovery(proposal_id=1)
        Contract->>Contract: Verify status == Timelocked
        Contract->>Contract: Verify ledger_time >= timelock_until
        Contract->>Contract: Update SecurityConfig: owner = candidate_address
        Contract->>Contract: status = Executed
        Contract-->>Indexer: Emit Event (RecoveryExecuted, new_owner)
    end
```

---

## 4. State Storage Layout (Soroban Instance Storage)

The smart contract uses Soroban's native `Env::storage().instance()` persistent storage model. Keys are strictly typed via the `DataKey` enum:

```rust
pub enum DataKey {
    Config,                    // Stores SecurityConfig (owner, threshold, limits, timelock)
    Guardians,                 // Stores Vec<Address> of active guardian addresses
    ProposalCounter,           // Stores u64 autoincrementing recovery ID
    Proposal(u64),             // Stores RecoveryProposal keyed by proposal ID
    Spending(Address),         // Stores SpendingState keyed by asset Address (or Contract ID)
}
```

### Storage Persistence Guarantees
- **Instance Lifetime**: Storage entries are bound to the contract instance lifetime and extended on every state update using `env.storage().instance().extend_ttl(100_000, 200_000)`.
- **Atomic State Transitions**: All updates to proposals and spending counters occur inside atomic contract invocations. If any invariant fails (e.g. invalid threshold, expired proposal), the entire invocation reverts with zero side-effects.

---

## 5. Security Indexer Pipeline

The backend indexer continuously reconciles PostgreSQL with the Soroban RPC ledger:
1. **Ledger Ingestion**: Polls `getEvents` for topic prefix `FORTRESS`.
2. **Event Parsing**: Decodes Soroban SCVal types into structured JSON payloads (`transfer`, `recovery_proposed`, `recovery_approved`, `recovery_cancelled`, `recovery_executed`).
3. **Database Normalization**:
   - Updates `wallets` table with current owner and threshold.
   - Synchronizes `guardians` table active states.
   - Updates `proposals` approval arrays and execution statuses.
   - Appends append-only records to `security_events` with transaction hashes and ledger numbers.

