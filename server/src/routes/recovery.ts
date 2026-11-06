import { Router, Request, Response } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

export const recoveryRouter = Router();

// GET /api/recovery/proposals - List all proposals
recoveryRouter.get('/proposals', async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT * FROM proposals ORDER BY created_at DESC`
    );
    res.json({
      success: true,
      proposals: result.rows,
    });
  } catch (err: any) {
    console.error('Error fetching proposals:', err);
    res.status(500).json({ error: 'Failed to fetch recovery proposals' });
  }
});

// GET /api/recovery/proposals/:id - Get proposal details
recoveryRouter.get('/proposals/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await query(`SELECT * FROM proposals WHERE id = $1`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Proposal not found' });
    res.json({ success: true, proposal: result.rows[0] });
  } catch (err: any) {
    console.error('Error fetching proposal:', err);
    res.status(500).json({ error: 'Failed to fetch proposal' });
  }
});

// POST /api/recovery/propose - Propose recovery
recoveryRouter.post('/propose', requireAuth, async (req: Request, res: Response) => {
  try {
    const { proposed_owner } = req.body;
    const caller = req.user!.wallet;

    if (!proposed_owner) {
      return res.status(400).json({ error: 'proposed_owner address is required' });
    }

    const walletRes = await query(`SELECT * FROM wallets LIMIT 1`);
    if (walletRes.rowCount === 0) return res.status(404).json({ error: 'Wallet not found' });
    const wallet = walletRes.rows[0];

    // Must be a registered guardian!
    const guardianRes = await query(
      `SELECT * FROM guardians WHERE wallet_contract_id = $1 AND guardian_address = $2 AND is_active = true`,
      [wallet.contract_id, caller]
    );

    if (guardianRes.rowCount === 0) {
      return res.status(403).json({ error: 'Unauthorized: Only registered guardians can propose account recovery.' });
    }

    if (proposed_owner === wallet.owner_address) {
      return res.status(400).json({ error: 'Proposed owner is already the current owner.' });
    }

    const counterRes = await query(`SELECT COALESCE(MAX(on_chain_proposal_id), 0) + 1 AS next_id FROM proposals`);
    const nextId = Number(counterRes.rows[0].next_id);

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + 604800; // 7 days
    const approvals = [caller];

    // Check threshold
    let status = 'Pending';
    let timelockUntil = 0;
    if (approvals.length >= wallet.threshold) {
      status = 'Timelocked';
      timelockUntil = now + Number(wallet.recovery_timelock);
    }

    const txHash = `0x${Buffer.from('PROP-' + caller.slice(0, 8) + Date.now()).toString('hex').slice(0, 64)}`;

    const insertRes = await query(
      `
      INSERT INTO proposals (
        on_chain_proposal_id, wallet_contract_id, proposer, proposed_owner,
        approvals, status, timelock_until, expires_at, tx_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
      [nextId, wallet.contract_id, caller, proposed_owner, approvals, status, timelockUntil, expiresAt, txHash]
    );

    // Record security event
    await query(
      `
      INSERT INTO security_events (wallet_contract_id, event_type, actor, tx_hash, details)
      VALUES ($1, 'recovery_proposed', $2, $3, $4)
    `,
      [
        wallet.contract_id,
        caller,
        txHash,
        JSON.stringify({ proposal_id: nextId, proposed_owner, status, timelock_until: timelockUntil }),
      ]
    );

    res.status(201).json({
      success: true,
      proposal: insertRes.rows[0],
    });
  } catch (err: any) {
    console.error('Error proposing recovery:', err);
    res.status(500).json({ error: err.message || 'Failed to submit recovery proposal' });
  }
});

// POST /api/recovery/proposals/:id/approve - Approve proposal
recoveryRouter.post('/proposals/:id/approve', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const caller = req.user!.wallet;

    const propRes = await query(`SELECT * FROM proposals WHERE id = $1`, [id]);
    if (propRes.rowCount === 0) return res.status(404).json({ error: 'Proposal not found' });
    const proposal = propRes.rows[0];

    const walletRes = await query(`SELECT * FROM wallets WHERE contract_id = $1`, [proposal.wallet_contract_id]);
    const wallet = walletRes.rows[0];

    // Must be a registered guardian
    const guardianRes = await query(
      `SELECT * FROM guardians WHERE wallet_contract_id = $1 AND guardian_address = $2 AND is_active = true`,
      [wallet.contract_id, caller]
    );

    if (guardianRes.rowCount === 0) {
      return res.status(403).json({ error: 'Unauthorized: Only registered guardians can approve recovery.' });
    }

    if (proposal.approvals.includes(caller)) {
      return res.status(400).json({ error: 'Duplicate approval: Guardian has already approved this proposal.' });
    }

    if (proposal.status !== 'Pending' && proposal.status !== 'Timelocked') {
      return res.status(400).json({ error: `Cannot approve proposal with status ${proposal.status}.` });
    }

    const updatedApprovals = [...proposal.approvals, caller];
    const now = Math.floor(Date.now() / 1000);
    let status = proposal.status;
    let timelockUntil = Number(proposal.timelock_until);

    if (updatedApprovals.length >= wallet.threshold && status === 'Pending') {
      status = 'Timelocked';
      timelockUntil = now + Number(wallet.recovery_timelock);
    }

    const updateRes = await query(
      `
      UPDATE proposals
      SET approvals = $1, status = $2, timelock_until = $3, updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `,
      [updatedApprovals, status, timelockUntil, id]
    );

    // Record security event
    await query(
      `
      INSERT INTO security_events (wallet_contract_id, event_type, actor, details)
      VALUES ($1, 'recovery_approved', $2, $3)
    `,
      [
        wallet.contract_id,
        caller,
        JSON.stringify({ proposal_id: proposal.on_chain_proposal_id, approvals_count: updatedApprovals.length, status }),
      ]
    );

    res.json({
      success: true,
      proposal: updateRes.rows[0],
    });
  } catch (err: any) {
    console.error('Error approving recovery:', err);
    res.status(500).json({ error: err.message || 'Failed to approve recovery' });
  }
});

// POST /api/recovery/proposals/:id/cancel - Cancel proposal
recoveryRouter.post('/proposals/:id/cancel', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const caller = req.user!.wallet;

    const propRes = await query(`SELECT * FROM proposals WHERE id = $1`, [id]);
    if (propRes.rowCount === 0) return res.status(404).json({ error: 'Proposal not found' });
    const proposal = propRes.rows[0];

    const walletRes = await query(`SELECT * FROM wallets WHERE contract_id = $1`, [proposal.wallet_contract_id]);
    const wallet = walletRes.rows[0];

    // Callable by current owner or original proposer
    if (caller !== wallet.owner_address && caller !== proposal.proposer) {
      return res.status(403).json({ error: 'Unauthorized: Only the current wallet owner or proposer can cancel recovery.' });
    }

    if (proposal.status !== 'Pending' && proposal.status !== 'Timelocked') {
      return res.status(400).json({ error: `Cannot cancel proposal in ${proposal.status} state.` });
    }

    const updateRes = await query(
      `UPDATE proposals SET status = 'Cancelled', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    await query(
      `
      INSERT INTO security_events (wallet_contract_id, event_type, actor, details)
      VALUES ($1, 'recovery_cancelled', $2, $3)
    `,
      [
        wallet.contract_id,
        caller,
        JSON.stringify({ proposal_id: proposal.on_chain_proposal_id, canceller: caller }),
      ]
    );

    res.json({
      success: true,
      proposal: updateRes.rows[0],
    });
  } catch (err: any) {
    console.error('Error cancelling recovery:', err);
    res.status(500).json({ error: err.message || 'Failed to cancel recovery' });
  }
});

// POST /api/recovery/proposals/:id/execute - Execute proposal
recoveryRouter.post('/proposals/:id/execute', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const caller = req.user!.wallet;

    const propRes = await query(`SELECT * FROM proposals WHERE id = $1`, [id]);
    if (propRes.rowCount === 0) return res.status(404).json({ error: 'Proposal not found' });
    const proposal = propRes.rows[0];

    const walletRes = await query(`SELECT * FROM wallets WHERE contract_id = $1`, [proposal.wallet_contract_id]);
    const wallet = walletRes.rows[0];

    if (proposal.status !== 'Timelocked') {
      return res.status(400).json({ error: `Proposal is not in Timelocked state (Current: ${proposal.status}). Threshold must be met first.` });
    }

    const now = Math.floor(Date.now() / 1000);
    if (now < Number(proposal.timelock_until)) {
      const remainingSeconds = Number(proposal.timelock_until) - now;
      return res.status(400).json({
        error: `Timelock delay in effect. ${remainingSeconds} seconds remaining before execution can be triggered.`,
      });
    }

    // Check active guardian threshold
    const activeGuardiansRes = await query(
      `SELECT guardian_address FROM guardians WHERE wallet_contract_id = $1 AND is_active = true`,
      [wallet.contract_id]
    );
    const activeGuardianAddresses = activeGuardiansRes.rows.map((r) => r.guardian_address);

    const validApprovals = proposal.approvals.filter((addr: string) =>
      activeGuardianAddresses.includes(addr)
    );

    if (validApprovals.length < wallet.threshold) {
      return res.status(400).json({
        error: `Insufficient active approvals. Threshold is ${wallet.threshold}, but only ${validApprovals.length} approvals remain valid from current guardians.`,
      });
    }

    const txHash = `0x${Buffer.from('EXEC-' + proposal.proposed_owner.slice(0, 8) + Date.now()).toString('hex').slice(0, 64)}`;

    // Update wallet owner
    await query(
      `UPDATE wallets SET owner_address = $1, updated_at = NOW() WHERE contract_id = $2`,
      [proposal.proposed_owner, wallet.contract_id]
    );

    // Update proposal status
    const updateRes = await query(
      `UPDATE proposals SET status = 'Executed', tx_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [txHash, id]
    );

    // Record security event
    await query(
      `
      INSERT INTO security_events (wallet_contract_id, event_type, actor, tx_hash, details)
      VALUES ($1, 'recovery_executed', $2, $3, $4)
    `,
      [
        wallet.contract_id,
        caller,
        txHash,
        JSON.stringify({
          proposal_id: proposal.on_chain_proposal_id,
          previous_owner: wallet.owner_address,
          new_owner: proposal.proposed_owner,
        }),
      ]
    );

    res.json({
      success: true,
      proposal: updateRes.rows[0],
      newOwner: proposal.proposed_owner,
      txHash,
    });
  } catch (err: any) {
    console.error('Error executing recovery:', err);
    res.status(500).json({ error: err.message || 'Failed to execute recovery' });
  }
});
