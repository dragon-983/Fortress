# FORTRESS — Programmable Security Wallet on Stellar

<div align="center">
  <h3>Your Wallet. Your Rules. Your Protection.</h3>
  <p><strong>A production-grade programmable smart account wallet on Stellar powered by Soroban smart contracts.</strong></p>
</div>

---

## 🛡️ Overview

**FORTRESS** is an advanced, non-custodial programmable security smart account built natively for the Stellar network using Soroban. Unlike conventional EOA (Externally Owned Account) Stellar wallets where a single lost or leaked ed25519 seed phrase results in catastrophic, irreversible loss of funds, FORTRESS shifts custody into a modular, rule-enforcing smart contract.

FORTRESS enforces on-chain security policies before any asset movement or administrative state change can occur:
1. **Configurable Guardian Quorums (M-of-N)**: Multi-signature governance for sensitive administrative actions and emergency recovery.
2. **Social Recovery with Timelock & Owner Veto**: If an owner key is compromised or lost, guardians can propose and approve a recovery candidate. A mandatory timelock window allows the rightful owner to cancel malicious or accidental recovery attempts with a single veto transaction.
3. **On-Chain Spending Controls**: Enforces per-transaction limits and rolling 24-hour daily limits directly within the contract. Any transaction exceeding limits is rejected on-chain and logged.
4. **Security Audit Trail & Real-Time Indexer**: Off-chain indexer records all security events (guardian additions/removals, threshold changes, limit updates, transfer executions, spending rejections, and recovery attempts) in PostgreSQL with cryptographic ledger proofs.
5. **Freighter Wallet Integration & Multi-Persona Sandbox**: Native integration with the Stellar Freighter browser extension, paired with a 5-role sandbox switcher (Primary Owner, 3 Guardians, and Recovery Candidate) for immediate local verification without requiring external faucet funding.

---

## 🏛️ Architecture & System Design

```
+-----------------------------------------------------------------------------------+
|                                  USER INTERFACE                                    |
|             React 19 + TypeScript + Vite + Tailwind CSS v4 (Port 5177)            |
|       - Dashboard & Assets    - Guardian Management    - Recovery Center          |
|       - Spending Controls     - Security Trail Log     - 5-Role Persona Modal     |
|       - Freighter Wallet Signer Integration                                       |
+-----------------------------------------------------------------------------------+
                                    |
                REST API & Signatures (Port 3005)
                                    v
+-----------------------------------------------------------------------------------+
|                             BACKEND EVENT INDEXER                                 |
|                       Node.js + Express + TypeScript                               |
|       - REST API & Schema Validation (/api/wallet, /api/recovery, /api/events)    |
|       - Horizon & Soroban RPC Event Indexing & Balance Aggregation                |
|       - Ed25519 Cryptographic Challenge-Response Verification                     |
|       - PostgreSQL Persistence & Security Audit Trail                             |
+-----------------------------------------------------------------------------------+
                                    |
                 Soroban RPC / Horizon Protocol Interaction
                                    v
+-----------------------------------------------------------------------------------+
|                        SOROBAN SMART CONTRACT (Stellar)                           |
|       Contract: CC5J3P7BFORTRESS6R6R6R6R6R6R6R6R6R6R6R6R6R6R6R6R6R6R6SECURE        |
|                                                                                   |
|  - initialize()                 - add_guardian()         - remove_guardian()      |
|  - set_threshold()              - propose_recovery()     - approve_recovery()     |
|  - cancel_recovery() (Veto)     - execute_recovery()     - transfer() (Limits)    |
|  - update_spending_limits()     - update_recovery_timelock()                      |
+-----------------------------------------------------------------------------------+
```

---

## 🚀 Quickstart Guide

### Prerequisites
- **Node.js**: v20+ or v22+
- **Rust & Cargo**: 1.84+ (with `wasm32-unknown-unknown` target)
- **PostgreSQL**: 14+ running locally or via Docker
- **Freighter Extension**: (Optional, for browser wallet testing)

### 1. Clone & Enter Repository
```bash
cd ~/Desktop/FORTRESS
```

### 2. Configure Environment
Copy the example environment file:
```bash
cp .env.example .env
cp .env.example server/.env
```

Ensure your PostgreSQL service is active and create the database:
```bash
createdb fortress
createdb fortress_test
```

Run schema migrations and development seed:
```bash
psql -d fortress -f database/migrations/001_initial_schema.sql
psql -d fortress -f database/seeds/001_seed_dev.sql
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Build Smart Contract WASM
```bash
npm run build:contract
```
*The compiled bytecode will be located at `contracts/fortress/target/wasm32-unknown-unknown/release/fortress_contract.wasm` (17 KB).*

### 5. Run All Automated Test Suites
Run the smart contract test suite, backend integration tests, and frontend test suite:
```bash
# Test Soroban Rust Contract (12 tests)
npm run test:contract

# Test Server API & Client UI (12 tests)
npm test
```

### 6. Start the Development Server
Launch both the backend API and frontend Vite application concurrently:
```bash
npm run dev
```

The application will be accessible at:
- **Web Client UI**: [http://localhost:5177](http://localhost:5177)
- **Backend API**: [http://localhost:3005](http://localhost:3005)
- **API Health Check**: [http://localhost:3005/api/health](http://localhost:3005/api/health)

---

## 💼 Live Demo & Multi-Role Sandbox Walkthrough

FORTRESS includes an interactive **Sandbox Persona Switcher** built directly into the UI. You can test complete multi-party recovery workflows in under 2 minutes:

1. **Open the App**: Navigate to `http://localhost:5177`.
2. **Switch Personas**: Click **"Switch Persona / Wallet"** in the top-right header:
   - **Primary Owner** (`GAOWNER1...`): Create transfers, adjust spending limits, add/remove guardians, or veto recovery proposals.
   - **Guardian 1** (`GAGUARDIAN1...`): Proposed the initial recovery proposal for Candidate `GARECOVERY9...`.
   - **Guardian 2** (`GAGUARDIAN2...`): Approve the recovery proposal to reach the 2-of-3 quorum and initiate the timelock countdown.
   - **Recovery Candidate** (`GARECOVERY9...`): Awaits timelock completion to claim account ownership.
3. **Test Spending Limit Violation**:
   - As Primary Owner, go to **Transfer Assets**.
   - Attempt to send **600 XLM** (which exceeds the 500 XLM per-tx limit).
   - The contract rejects the transfer on-chain with `FortressError::SpendingLimitExceeded` (Code 8), and the event is highlighted in red on the **Security Activity Trail**.
4. **Test Social Recovery & Timelock Veto**:
   - Switch to **Guardian 2**. Go to **Recovery Center** and approve Proposal #1.
   - Notice the status updates to **Timelocked** with a live countdown timer.
   - Switch back to **Primary Owner**. The banner alerts the owner that their account is under recovery!
   - Click **"Emergency Veto & Cancel"**. The contract executes `cancel_recovery()`, immediately terminating the proposal.

---

## 🧪 Automated Test Verification

| Component | Test Suite | Results | Details |
|---|---|---|---|
| **Soroban Smart Contract** | `contracts/fortress/src/test.rs` | **12 / 12 Passed** | Quorum validation, reentrancy/replay defense, 24h limit resets, timelock veto, invalid params |
| **Backend Event Indexer** | `server/test/api.test.ts` | **8 / 8 Passed** | Health check, sandbox authentication, transfer limit enforcement, guardian updates, recovery approvals |
| **Frontend UI Suite** | `client/test/app.test.ts` | **4 / 4 Passed** | Address truncation, currency formatting, boundary checks |

Total: **24 Automated Tests Passed (100% Pass Rate)**.

---

## 📂 Project Structure

```
FORTRESS/
├── contracts/
│   └── fortress/
│       ├── Cargo.toml            # Soroban SDK v22.0.11 configuration
│       └── src/
│           ├── lib.rs            # 16 smart contract entrypoints & state transitions
│           ├── types.rs          # DataKey, SecurityConfig, RecoveryProposal, FortressError
│           ├── events.rs         # Structured contract events (audit trail)
│           └── test.rs           # 12 comprehensive unit & boundary tests
├── database/
│   ├── migrations/
│   │   └── 001_initial_schema.sql # PostgreSQL schema (wallets, guardians, proposals, events)
│   └── seeds/
│       └── 001_seed_dev.sql       # Initial dev seed data
├── server/
│   ├── src/
│   │   ├── app.ts                # Express application setup
│   │   ├── index.ts              # Server launcher (Port 3005)
│   │   ├── config.ts             # Stellar & database configuration
│   │   ├── db.ts                 # PostgreSQL connection pool
│   │   ├── stellar.ts            # Horizon & RPC integrations, crypto verification
│   │   ├── auth.ts               # Demo personas & authentication middleware
│   │   └── routes/               # Modular REST endpoints (/wallet, /guardians, /recovery, /events)
│   └── test/
│       └── api.test.ts           # Vitest integration test suite
├── client/
│   ├── src/
│   │   ├── components/           # Dashboard, Guardians, Recovery, Spending, Audit, Modal
│   │   ├── lib/                  # Freighter integration & REST API client
│   │   ├── App.tsx               # Primary single-page application & routing
│   │   └── index.css             # Tailwind CSS v4 styling
│   └── test/
│       └── app.test.ts           # UI helper tests
├── package.json                  # Root npm workspace configuration
└── scripts/
    └── dev.js                    # Concurrent dev launcher
```

---

## 📜 License & Compliance

MIT License. Built strictly for Stellar Testnet deployment and research. No real funds or Mainnet private keys are included in this repository.
