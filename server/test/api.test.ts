import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { app } from '../src/app.js';
import { query } from '../src/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('FORTRESS Backend API & Security Indexer Test Suite', () => {
  beforeAll(async () => {
    const res = await query('SELECT 1 as connected');
    expect(res.rows[0].connected).toBe(1);

    const seedSql = fs.readFileSync(path.resolve(__dirname, '../../database/seeds/001_seed_dev.sql'), 'utf-8');
    await query(seedSql);
  });

  it('GET /api/health returns healthy status and Stellar Testnet configuration', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.stellar.network).toBe('testnet');
    expect(res.body.stellar.contractId).toBeDefined();
  });

  it('GET /api/auth/demo-profiles returns all 5 distinct sandbox personas', async () => {
    const res = await request(app).get('/api/auth/demo-profiles');
    expect(res.status).toBe(200);
    expect(res.body.profiles.owner).toBeDefined();
    expect(res.body.profiles.guardian_1).toBeDefined();
    expect(res.body.profiles.guardian_2).toBeDefined();
    expect(res.body.profiles.guardian_3).toBeDefined();
    expect(res.body.profiles.recovery_candidate).toBeDefined();
  });

  it('GET /api/wallet returns current smart wallet configuration and guardians', async () => {
    const res = await request(app).get('/api/wallet');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.wallet.owner_address).toBeDefined();
    expect(res.body.wallet.threshold).toBe(2);
    expect(Array.isArray(res.body.wallet.guardians)).toBe(true);
    expect(res.body.wallet.guardians.length).toBeGreaterThan(0);
  });

  it('POST /api/wallet/transfer enforces per-tx spending limit on-chain', async () => {
    // Current per_tx_limit is 500. Transfer 600 must be rejected!
    const resExceeds = await request(app)
      .post('/api/wallet/transfer')
      .set('x-wallet-address', 'GAOWNER111111111111111111111111111111111111111111111111111')
      .set('x-user-role', 'owner')
      .send({
        to: 'GARECIPIENT99999999999999999999999999999999999999999999999',
        amount: 600,
      });

    expect(resExceeds.status).toBe(400);
    expect(resExceeds.body.error).toContain('exceeds per-transaction limit');

    // Transfer 150 must succeed!
    const resOk = await request(app)
      .post('/api/wallet/transfer')
      .set('x-wallet-address', 'GAOWNER111111111111111111111111111111111111111111111111111')
      .set('x-user-role', 'owner')
      .send({
        to: 'GARECIPIENT99999999999999999999999999999999999999999999999',
        amount: 150,
      });

    expect(resOk.status).toBe(200);
    expect(resOk.body.success).toBe(true);
    expect(resOk.body.amount).toBe(150);
  });

  it('POST /api/guardians allows owner to add a guardian', async () => {
    const res = await request(app)
      .post('/api/guardians')
      .set('x-wallet-address', 'GAOWNER111111111111111111111111111111111111111111111111111')
      .set('x-user-role', 'owner')
      .send({
        guardian_address: 'GAGUARDIAN44444444444444444444444444444444444444444444444444',
        alias_label: 'Backup Cold Storage Key',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.guardian.guardian_address).toBe('GAGUARDIAN44444444444444444444444444444444444444444444444444');
  });

  it('GET /api/recovery/proposals returns recovery proposal list', async () => {
    const res = await request(app).get('/api/recovery/proposals');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.proposals)).toBe(true);
    expect(res.body.proposals.length).toBeGreaterThan(0);
  });

  it('POST /api/recovery/proposals/:id/approve allows second guardian to approve', async () => {
    const res = await request(app)
      .post('/api/recovery/proposals/1/approve')
      .set('x-wallet-address', 'GAGUARDIAN22222222222222222222222222222222222222222222222222')
      .set('x-user-role', 'guardian_2');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.proposal.status).toBe('Timelocked');
    expect(Number(res.body.proposal.timelock_until)).toBeGreaterThan(0);
  });

  it('GET /api/events returns security event log including rejected transfers', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.events.length).toBeGreaterThan(0);

    const types = res.body.events.map((e: any) => e.event_type);
    expect(types).toContain('transfer_rejected');
    expect(types).toContain('transfer_executed');
  });
});
