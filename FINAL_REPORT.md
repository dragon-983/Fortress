# FORTRESS — Autonomous Build Final Report

This final report provides an exhaustive, factual record of the engineering implementation, architectural decisions, smart contract mechanics, security guarantees, test outcomes, and operational guides for **FORTRESS: Programmable Security Wallet on Stellar**.

---

## 1. What Was Implemented

FORTRESS was designed and built end-to-end as a production-grade programmable security smart account wallet on the Stellar network using Soroban. The implementation includes:

1. **Soroban Smart Account Contract (`contracts/fortress/`)**:
   - Written in Rust using official `soroban-sdk = "22.0.11"`.
   - Core entry points for account initialization, M-of-N guardian administration, social recovery proposals, multi-guardian approvals, owner emergency veto, recovery execution, and on-chain spending limit enforcement.
   - 12 comprehensive unit and security tests in `test.rs`.
   - Release WASM compilation producing an optimized 17 KB binary.

2. **Relational PostgreSQL Database (`database/`)**:
   - `database/migrations/001_initial_schema.sql`: Four relational tables (`wallets`, `guardians`, `proposals`, `security_events`) with strict constraints, cascading foreign keys, check invariants, and B-tree/GIN indexes.
   - `database/seeds/001_seed_dev.sql`: Realistic seed data with a pre-configured smart wallet, 3 guardian personas, an active recovery proposal, and cryptographic security events.

3. **Backend Event Indexer & REST API Service (`server/`)**:
   - Node.js 22 + Express + TypeScript running on port 3005.
   - Horizon and Soroban RPC client integrations.
   - Ed25519 signature verification and cryptographic authentication middleware.
   - 5-role sandbox persona provider (`owner`, `guardian_1`, `guardian_2`, `guardian_3`, `recovery_candidate`).
   - Modular REST route controllers (`/api/wallet`, `/api/guardians`, `/api/recovery`, `/api/events`, `/api/health`).
   - 8 automated Vitest integration tests in `server/test/api.test.ts`.

4. **Modern Frontend Web Application (`client/`)**:
   - React 19 + TypeScript + Vite + Tailwind CSS v4 running on port 5177.
   - Stellar Freighter browser wallet adapter with automatic fallbacks and balance loading.
   - Six interactive dedicated views:
     - **Landing Page**: Value proposition and architecture breakdown.
     - **Dashboard**: Real-time asset portfolio, daily spending meter, guardian quorum overview.
     - **Guardian Management**: List, add, remove, and adjust M-of-N quorum thresholds.
     - **Recovery Center**: Active recovery tracking, timelock countdown progress bar, guardian approval voting, and owner emergency veto button.
     - **Spending Controls**: Form to adjust per-transaction and 24h limits, plus a live transfer testing form to verify on-chain rejections.
     - **Security Activity Trail**: Filterable, color-coded cryptographic ledger event audit log with transaction hashes.
     - **Sandbox Multi-Role Modal**: Instant role-switching to simulate multi-party coordination without needing external wallets or test tokens.
   - 4 automated Vitest tests in `client/test/app.test.ts`.

5. **Root Orchestration & Developer Tooling**:
   - Monorepo `package.json` with npm workspaces (`server`, `client`).
   - `scripts/dev.js` running concurrent API and UI processes.
   - Isolated `.cargo/config.toml` preventing interference with system Rust flags.

---

## 2. Architecture and Technology Choices

- **Soroban SDK `22.0.11`**: Leverages Stellar's latest stable smart contract framework. Uses instance storage with TTL extension for low latency and state persistence.
- **On-Chain Policy Enforcement**: Security rules (spending limits, quorum checks, timelock vetoes) are enforced strictly on-chain in Rust. The contract rejects invalid state changes regardless of off-chain client requests.
- **React 19 & Tailwind CSS v4**: Ultra-fast UI development with modern CSS theme variables, accessible components, and Lucide React icons.
- **Express + TypeScript + node-postgres (`pg`)**: Robust backend with connection pooling, parameterized SQL queries preventing injection, and structured JSON responses.
- **Vitest & Supertest**: Fast, modern testing harness for TypeScript backend and client modules.
- **Dual-Mode Authentication**: Supports native Stellar ed25519 cryptographic signatures and a seamless sandbox persona header system for rapid manual and automated testing.

---

## 3. Contract Functionality

The FORTRESS Soroban contract exposes 16 public entry points:

### Administration & Guardians
- `initialize(owner, guardians, threshold, per_tx_limit, daily_limit, recovery_timelock)`: Configures initial wallet state; non-reentrant and callable only once.
- `add_guardian(guardian)`: Owner registers a new trusted guardian address.
- `remove_guardian(guardian)`: Owner deregisters a guardian (ensures remaining guardians $\ge$ threshold).
- `set_threshold(new_threshold)`: Owner updates M-of-N quorum threshold ($1 \le M \le N$).

### Social Recovery Protocol
- `propose_recovery(proposer, proposed_owner)`: Registered guardian initiates a recovery proposal. Sets a 7-day expiration.
- `approve_recovery(approver, proposal_id)`: Registered guardian votes for a proposal. Reaching threshold triggers the `Timelocked` state and starts the countdown.
- `cancel_recovery(caller, proposal_id)`: Active owner exercises immediate emergency veto, marking the proposal `Cancelled`.
- `execute_recovery(proposal_id)`: Any caller can execute once timelock matures, transferring contract ownership to the proposed candidate.

### Spending & Limit Enforcement
- `transfer(token, to, amount)`: Owner transfers assets. Automatically tracks 24-hour rolling windows and reverts if `amount > per_tx_limit` or cumulative spending exceeds `daily_limit`.
- `update_spending_limits(new_per_tx, new_daily)`: Owner reconfigures spending caps.
- `update_recovery_timelock(new_timelock)`: Owner updates the minimum timelock delay ($\ge 60$ seconds).

### View Methods
- `get_config()`: Returns `SecurityConfig`.
- `get_guardians()`: Returns active `Vec<Address>`.
- `get_proposal(proposal_id)`: Returns `Option<RecoveryProposal>`.
- `get_spending_state(token)`: Returns current 24-hour spending counters.
- `get_latest_proposal_id()`: Returns autoincrementing counter.

---

## 4. Security Protections

1. **Owner Timelock Veto**: A compromised guardian set cannot instantly steal funds. The mandatory timelock window guarantees the legitimate owner an opportunity to veto via `cancel_recovery()`.
2. **Cumulative 24-Hour Spending Caps**: Ledger timestamps govern rolling 24-hour spending windows. Micro-transaction splitting cannot circumvent the daily limit.
3. **Threshold Invariant Enforcement**: The contract strictly prohibits settings where threshold $M > N$ or $M < 1$, preventing deadlocks.
4. **Replay & Sybil Defense**: Unique on-chain `u64` proposal IDs and Soroban native `require_auth()` domain binding prevent cross-contract or cross-network replays. Duplicate votes by the same guardian are rejected.
5. **Stale Proposal Expiration**: Proposals older than 7 days (`604,800` seconds) unconditionally expire and cannot be resuscitated.
6. **Non-Reentrant Initialization**: Initialization can only be invoked once; subsequent calls revert with `FortressError::AlreadyInitialized`.

---

## 5. Tests Actually Executed and Their Results

A total of **24 automated tests** were executed across the codebase, achieving a **100% pass rate**:

### 5.1 Smart Contract Rust Tests (`contracts/fortress/src/test.rs`)
- `test_initialize_and_view_methods`: **PASSED** (Verifies config, guardians, limits, and getters)
- `test_cannot_reinitialize`: **PASSED** (Verifies duplicate initialization rejection)
- `test_invalid_initialization_parameters`: **PASSED** (Verifies rejection of zero threshold or zero timelock)
- `test_add_and_remove_guardian`: **PASSED** (Verifies guardian lifecycle and duplicate checks)
- `test_set_threshold`: **PASSED** (Verifies quorum updates and boundary limits)
- `test_spending_controls_and_daily_limit_reset`: **PASSED** (Verifies per-tx limit rejection, daily limit rejection, and 24-hour timestamp window resets)
- `test_social_recovery_lifecycle_success`: **PASSED** (Verifies propose -> 2-of-3 approve -> timelock delay -> execution -> owner migration)
- `test_social_recovery_cancelled_by_owner`: **PASSED** (Verifies owner emergency timelock veto)
- `test_social_recovery_unauthorized_proposer`: **PASSED** (Verifies non-guardian rejection)
- `test_duplicate_and_removed_guardian_approvals`: **PASSED** (Verifies double-vote prevention and removed guardian rejection)
- `test_expired_recovery_proposal`: **PASSED** (Verifies 7-day TTL expiration)
- `test_update_spending_limits_and_timelock`: **PASSED** (Verifies owner policy parameter updates)
*Summary: 12 passed; 0 failed; execution time: 0.13s.*

### 5.2 Backend API Integration Tests (`server/test/api.test.ts`)
- `GET /api/health`: **PASSED** (Validates system health, network mode, and contract configuration)
- `GET /api/auth/demo-profiles`: **PASSED** (Validates all 5 sandbox personas)
- `GET /api/wallet`: **PASSED** (Validates configuration, limits, and guardian relationships)
- `POST /api/wallet/transfer`: **PASSED** (Enforces on-chain per-transaction limit rejection)
- `POST /api/guardians`: **PASSED** (Verifies owner adding a guardian)
- `GET /api/recovery/proposals`: **PASSED** (Validates recovery proposal indexing)
- `POST /api/recovery/proposals/:id/approve`: **PASSED** (Verifies multi-party approval and timelock activation)
- `GET /api/events`: **PASSED** (Validates security audit log ingestion)
*Summary: 8 passed; 0 failed; execution time: 1.67s.*

### 5.3 Frontend Unit Tests (`client/test/app.test.ts`)
- `formatAddress correctly truncates ed25519 public keys`: **PASSED**
- `formatAddress handles null or short strings safely`: **PASSED**
- `formatAmount formats currency numbers with 2 decimals by default`: **PASSED**
- `formatAmount handles null, undefined, or invalid inputs safely`: **PASSED**
*Summary: 4 passed; 0 failed; execution time: 0.52s.*

---

## 6. Build Results

1. **Smart Contract WASM Build**:
   - Command: `cargo build --target wasm32-unknown-unknown --release`
   - Output Path: `contracts/fortress/target/wasm32-unknown-unknown/release/fortress_contract.wasm`
   - Output Size: `17 KB`
   - SHA256: `5212338b737b98cd1606fb2559db7d3eea1b318de9f1e8d3b9875567fa0032df`
   - Result: **Clean compile, 0 warnings, 0 errors**.

2. **Backend Server TypeScript Compilation**:
   - Command: `tsc` in `server/`
   - Output: `server/dist/`
   - Result: **Code 0, 0 errors**.

3. **Frontend Client Production Build**:
   - Command: `tsc && vite build` in `client/`
   - Output: `client/dist/` (`index.html` 1.18 kB, `index.css` 49.58 kB, `index.js` 320.29 kB)
   - Result: **Code 0, 2,080 modules transformed in 10.40s**.

---

## 7. Known Limitations

1. **Native Stellar Asset Contract Transfers**: The smart contract invokes `token::Client::new(&env, &token).transfer(...)`. On a live network, the contract must hold SAC token balances or SAC trustlines; direct native lumens without SAC wrapping follow Soroban asset semantics.
2. **Horizon Mock Fallback**: If Stellar Horizon Testnet is temporarily unreachable or rate-limited, the backend gracefully falls back to cached ledger balances to maintain continuous uptime.
3. **Browser Extension Support**: Freighter is supported natively; other Stellar wallets (e.g. Albedo, xBull) can interact via standard RPC/XDR serialization but do not have dedicated UI buttons.

---

## 8. Remaining Blockers

- **Zero Technical Blockers**: The smart contract, database, backend server, and frontend client are fully operational, tested, built, and actively running in the local workspace.

---

## 9. Exact Instructions to Run Locally

### 1. Database Setup
```bash
createdb fortress
psql -d fortress -f database/migrations/001_initial_schema.sql
psql -d fortress -f database/seeds/001_seed_dev.sql
```

### 2. Run All Automated Test Suites
```bash
cd ~/Desktop/FORTRESS

# Run Contract Rust Tests
npm run test:contract

# Run Server & Client Vitest Suites
npm test
```

### 3. Launch the Application
```bash
npm run dev
```

### 4. Access the Live Application
- **Frontend UI**: [http://localhost:5177](http://localhost:5177)
- **Backend API**: [http://localhost:3005](http://localhost:3005)
- **API Health**: [http://localhost:3005/api/health](http://localhost:3005/api/health)

---

## 10. Exact Steps Requiring Human Authorization Before Testnet Deployment

Before deploying FORTRESS to the public Stellar Testnet or mainnet, the following steps require explicit human authorization:

1. **Deployer Keypair Generation & Security**:
   - Human must authorize the generation of the deployment keypair and safe storage of the secret seed phrase.
   - Command: `stellar keys generate --network testnet fortress-admin`
2. **Testnet Friendbot Funding Authorization**:
   - Authorization to request testnet XLM funding for the deployer account.
   - Command: `stellar keys fund fortress-admin --network testnet`
3. **Bytecode Upload & Fee Approval**:
   - Installing the WASM bytecode onto the public ledger consumes network resources and requires transaction fee authorization.
   - Command: `stellar contract install --wasm contracts/fortress/target/wasm32-unknown-unknown/release/fortress_contract.wasm --source fortress-admin --network testnet`
4. **Contract Instantiation & Designated Guardian Selection**:
   - Human must verify and sign off on the designated guardian public keys (`G...`) and initial spending limits before invoking `stellar contract deploy` and `initialize`.
5. **Production Environment Variable Configuration**:
   - Confirmation of production `.env` parameters (`FORTRESS_CONTRACT_ID`, RPC endpoints, database credentials) prior to hosting deployment.

