# FORTRESS — Backend REST API Specification

The FORTRESS backend API (running on port `3005`) provides off-chain endpoints for wallet inspection, guardian coordination, social recovery proposal lifecycle, and cryptographic security audit indexing.

---

## 1. Global Specifications

- **Base URL**: `http://localhost:3005` (or `/api` when proxied by Vite on `http://localhost:5177`)
- **Headers**:
  - `Content-Type: application/json`
  - Authentication Headers (any of the following):
    - `x-demo-role`: `owner` | `guardian_1` | `guardian_2` | `guardian_3` | `recovery_candidate`
    - `x-wallet-address`: Stellar ed25519 public key (e.g. `GAOWNER...`)
    - `x-user-role`: `owner` | `guardian` | `user`

---

## 2. API Endpoints Reference

### 2.1 System & Authentication

#### `GET /api/health`
Returns system health, network mode, and Stellar contract addresses.
- **Response**: `200 OK`
```json
{
  "status": "healthy",
  "product": "FORTRESS - Programmable Security Wallet on Stellar",
  "stellar": {
    "network": "testnet",
    "rpcUrl": "https://soroban-testnet.stellar.org",
    "horizonUrl": "https://horizon-testnet.stellar.org",
    "contractId": "CC5J3P7BFORTRESS6R6R6R6R6R6R6R6R6R6R6R6R6R6R6R6R6R6R6SECURE",
    "usdcContractId": "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCUSDC"
  },
  "timestamp": "2026-11-06T03:52:12.479Z"
}
```

#### `GET /api/auth/demo-profiles`
Returns the 5 preconfigured sandbox personas for local testing.
- **Response**: `200 OK`
```json
{
  "success": true,
  "profiles": {
    "owner": {
      "wallet": "GAOWNER111111111111111111111111111111111111111111111111111",
      "role": "owner",
      "name": "Primary Wallet Owner"
    },
    "guardian_1": {
      "wallet": "GAGUARDIAN11111111111111111111111111111111111111111111111111",
      "role": "guardian_1",
      "name": "Cold Vault Hardware Key (Guardian 1)"
    }
  }
}
```

---

### 2.2 Wallet & Spending Controls

#### `GET /api/wallet`
Retrieves wallet configuration, spending status, and active guardian list.
- **Response**: `200 OK`
```json
{
  "success": true,
  "wallet": {
    "contract_id": "CC5J3P7BFORTRESS6R6R6R6R6R6R6R6R6R6R6R6R6R6R6R6R6R6R6SECURE",
    "owner_address": "GAOWNER111111111111111111111111111111111111111111111111111",
    "threshold": 2,
    "guardian_count": 3,
    "per_tx_limit": "500.0000000",
    "daily_limit": "1500.0000000",
    "spent_today": "120.0000000",
    "recovery_timelock": "3600",
    "guardians": [...]
  }
}
```

#### `POST /api/wallet/transfer`
Executes an asset transfer subject to smart contract spending limit validation.
- **Headers**: Requires Owner role.
- **Request Body**:
```json
{
  "asset": "XLM",
  "recipient": "GARECIPIENT2222222222222222222222222222222222222222222222",
  "amount": 100.5
}
```
- **Response (Success)**: `200 OK`
```json
{
  "success": true,
  "txHash": "0x4b7c...",
  "transfer": {
    "asset": "XLM",
    "amount": 100.5,
    "recipient": "GARECIPIENT...",
    "spentToday": 220.5
  }
}
```
- **Response (Limit Exceeded)**: `400 Bad Request`
```json
{
  "error": "Transfer rejected: Amount 600 XLM exceeds per-transaction limit of 500 XLM."
}
```

#### `PUT /api/wallet/limits`
Updates per-transaction and daily spending limits.
- **Headers**: Requires Owner role.
- **Request Body**:
```json
{
  "per_tx_limit": 1000,
  "daily_limit": 3000
}
```
- **Response**: `200 OK`

---

### 2.3 Guardian Management

#### `GET /api/guardians`
Returns the list of registered guardians.
- **Response**: `200 OK`

#### `POST /api/guardians`
Registers a new guardian.
- **Headers**: Requires Owner role.
- **Request Body**:
```json
{
  "guardian_address": "GAGUARDIAN44444444444444444444444444444444444444444444444444",
  "alias_label": "Institutional Backup Node"
}
```
- **Response**: `201 Created`

#### `DELETE /api/guardians/:address`
Removes an existing guardian (enforcing remaining count $\ge$ threshold).
- **Headers**: Requires Owner role.
- **Response**: `200 OK`

#### `PUT /api/guardians/threshold`
Updates the M-of-N threshold.
- **Headers**: Requires Owner role.
- **Request Body**: `{"threshold": 3}`
- **Response**: `200 OK`

---

### 2.4 Social Recovery Protocol

#### `GET /api/recovery/proposals`
Retrieves all recovery proposals.
- **Response**: `200 OK`

#### `POST /api/recovery/proposals`
Proposes a new account recovery candidate.
- **Headers**: Caller must be a registered guardian.
- **Request Body**:
```json
{
  "proposed_owner": "GARECOVERY99999999999999999999999999999999999999999999999999"
}
```
- **Response**: `201 Created`

#### `POST /api/recovery/proposals/:id/approve`
Approves an existing proposal. If threshold is reached, begins timelock.
- **Headers**: Caller must be a registered guardian.
- **Response**: `200 OK`

#### `POST /api/recovery/proposals/:id/cancel`
Emergency cancellation / veto.
- **Headers**: **Caller must be the active owner.**
- **Response**: `200 OK`

#### `POST /api/recovery/proposals/:id/execute`
Executes an approved, matured recovery proposal, transferring ownership.
- **Response**: `200 OK`

---

### 2.5 Security Audit Trail

#### `GET /api/events`
Returns cryptographic security event log with pagination.
- **Query Params**: `limit=50&offset=0`
- **Response**: `200 OK`
```json
{
  "success": true,
  "events": [
    {
      "id": "1",
      "wallet_contract_id": "CC5J3P7B...",
      "event_type": "transfer_rejected",
      "actor": "GAOWNER1111...",
      "tx_hash": "0x39a1...",
      "ledger_sequence": "104921",
      "details": {
        "amount": 600,
        "reason": "Exceeds per_tx_limit (500)"
      },
      "created_at": "2026-11-06T03:39:22.714Z"
    }
  ]
}
```

