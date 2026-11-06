# FORTRESS — Stellar Testnet Deployment Guide

This guide provides step-by-step instructions for deploying the **FORTRESS** Soroban smart account contract to the Stellar Testnet using the official `stellar-cli`.

---

## 1. Prerequisites & Toolchain Setup

### 1.1 Install Stellar CLI
Ensure `stellar-cli` is installed and updated:
```bash
cargo install --locked stellar-cli --features opt
```
*Or verify existing version:*
```bash
stellar --version
```

### 1.2 Generate Testnet Identity & Fund via Friendbot
Create a designated deployment account (e.g. `fortress-deployer`) and fund it via Friendbot:
```bash
stellar keys generate --network testnet fortress-deployer
stellar keys fund fortress-deployer --network testnet
```

Check the deployer address:
```bash
stellar keys address fortress-deployer
```

---

## 2. Compile & Optimize Contract Bytecode

### 2.1 Build Release WASM
Inside the repository root or contract folder:
```bash
cd contracts/fortress
cargo build --target wasm32-unknown-unknown --release
```
The compiled binary will be placed at:
`contracts/fortress/target/wasm32-unknown-unknown/release/fortress_contract.wasm`

### 2.2 Optimize WASM Binary (Optional)
```bash
stellar contract optimize \
  --wasm target/wasm32-unknown-unknown/release/fortress_contract.wasm
```

---

## 3. Deploy to Stellar Testnet

### 3.1 Install WASM Bytecode On-Chain
Upload the bytecode to the Stellar Testnet ledger:
```bash
WASM_HASH=$(stellar contract install \
  --wasm target/wasm32-unknown-unknown/release/fortress_contract.wasm \
  --source fortress-deployer \
  --network testnet)

echo "WASM Hash: $WASM_HASH"
```

### 3.2 Instantiate the Contract
Deploy a live instance of the contract:
```bash
CONTRACT_ID=$(stellar contract deploy \
  --wasm-hash $WASM_HASH \
  --source fortress-deployer \
  --network testnet)

echo "Deployed Contract ID: $CONTRACT_ID"
```

---

## 4. Contract Initialization

Initialize the contract parameters with the owner, initial guardians, threshold, spending limits, and recovery timelock:

```bash
# Example parameters:
# Owner: Deployer address
# Guardians: 3 separate Testnet addresses
# Threshold: 2-of-3
# Per-tx limit: 500 XLM (in stroops: 5000000000)
# Daily limit: 1500 XLM (in stroops: 15000000000)
# Timelock: 3600 seconds (1 hour)

OWNER_ADDR=$(stellar keys address fortress-deployer)
G1="GBXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
G2="GCYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY"
G3="GDZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ"

stellar contract invoke \
  --id $CONTRACT_ID \
  --source fortress-deployer \
  --network testnet \
  -- \
  initialize \
  --owner $OWNER_ADDR \
  --guardians "[\"$G1\", \"$G2\", \"$G3\"]" \
  --threshold 2 \
  --per_tx_limit 5000000000 \
  --daily_limit 15000000000 \
  --recovery_timelock 3600
```

---

## 5. Verification on Stellar Expert Explorer

You can inspect and verify the deployed contract instance on the public Stellar Testnet block explorer:
```
https://stellar.expert/explorer/testnet/contract/<CONTRACT_ID>
```
Verify that:
1. The contract code matches the installed WASM hash.
2. The `initialize` invocation transaction is confirmed in a recent ledger sequence.
3. Contract storage entries (`Config`, `Guardians`, `ProposalCounter`) are properly initialized.

---

## 6. Synchronizing the Backend Indexer

Once deployed, update the off-chain environment configuration to point to your live contract:

1. Update `.env` and `server/.env`:
   ```bash
   STELLAR_NETWORK=testnet
   FORTRESS_CONTRACT_ID=<DEPLOYED_CONTRACT_ID>
   ```

2. Seed or update the PostgreSQL database with the new contract ID:
   ```sql
   UPDATE wallets
   SET contract_id = '<DEPLOYED_CONTRACT_ID>',
       owner_address = '<OWNER_ADDR>'
   WHERE id = 1;
   ```

3. Restart the server:
   ```bash
   npm run dev
   ```
