-- FORTRESS: Programmable Security Wallet on Stellar
-- Migration 001: Initial Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Wallets
CREATE TABLE IF NOT EXISTS wallets (
    contract_id TEXT PRIMARY KEY,
    owner_address TEXT NOT NULL,
    threshold INT NOT NULL DEFAULT 2,
    guardian_count INT NOT NULL DEFAULT 3,
    per_tx_limit NUMERIC(20, 7) NOT NULL DEFAULT 500.00,
    daily_limit NUMERIC(20, 7) NOT NULL DEFAULT 1500.00,
    recovery_timelock BIGINT NOT NULL DEFAULT 3600,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Guardians
CREATE TABLE IF NOT EXISTS guardians (
    id BIGSERIAL PRIMARY KEY,
    wallet_contract_id TEXT NOT NULL REFERENCES wallets(contract_id) ON DELETE CASCADE,
    guardian_address TEXT NOT NULL,
    alias_label TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (wallet_contract_id, guardian_address)
);

-- Recovery Proposals
CREATE TABLE IF NOT EXISTS proposals (
    id BIGSERIAL PRIMARY KEY,
    on_chain_proposal_id BIGINT NOT NULL,
    wallet_contract_id TEXT NOT NULL REFERENCES wallets(contract_id) ON DELETE CASCADE,
    proposer TEXT NOT NULL,
    proposed_owner TEXT NOT NULL,
    approvals TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Timelocked', 'Executed', 'Cancelled', 'Expired')),
    timelock_until BIGINT NOT NULL DEFAULT 0,
    expires_at BIGINT NOT NULL,
    tx_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (wallet_contract_id, on_chain_proposal_id)
);

-- Security Events (Audit Log)
CREATE TABLE IF NOT EXISTS security_events (
    id BIGSERIAL PRIMARY KEY,
    wallet_contract_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'initialized',
        'guardian_added',
        'guardian_removed',
        'threshold_changed',
        'recovery_proposed',
        'recovery_approved',
        'recovery_timelocked',
        'recovery_cancelled',
        'recovery_executed',
        'transfer_executed',
        'limits_updated',
        'timelock_updated',
        'transfer_rejected'
    )),
    actor TEXT NOT NULL,
    tx_hash TEXT,
    ledger_sequence BIGINT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_guardians_wallet ON guardians(wallet_contract_id);
CREATE INDEX IF NOT EXISTS idx_proposals_wallet ON proposals(wallet_contract_id);
CREATE INDEX IF NOT EXISTS idx_events_wallet ON security_events(wallet_contract_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON security_events(created_at DESC);

