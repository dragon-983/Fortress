import { Router, Request, Response } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

export const guardiansRouter = Router();

// GET /api/guardians - List registered guardians
guardiansRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await query(`SELECT * FROM guardians ORDER BY added_at ASC`);
    res.json({
      success: true,
      guardians: result.rows,
    });
  } catch (err: any) {
    console.error('Error fetching guardians:', err);
    res.status(500).json({ error: 'Failed to fetch guardians' });
  }
});

// POST /api/guardians - Add a new guardian
guardiansRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { guardian_address, alias_label, new_threshold } = req.body;
    const caller = req.user!.wallet;

    if (!guardian_address) {
      return res.status(400).json({ error: 'guardian_address is required' });
    }

    const walletRes = await query(`SELECT * FROM wallets LIMIT 1`);
    if (walletRes.rowCount === 0) return res.status(404).json({ error: 'Wallet not found' });
    const wallet = walletRes.rows[0];

    if (caller !== wallet.owner_address) {
      return res.status(403).json({ error: 'Unauthorized: Only wallet owner can add guardians.' });
    }

    if (guardian_address === wallet.owner_address) {
      return res.status(400).json({ error: 'Owner cannot be a guardian.' });
    }

    const insertRes = await query(
      `
      INSERT INTO guardians (wallet_contract_id, guardian_address, alias_label, is_active)
      VALUES ($1, $2, $3, true)
      ON CONFLICT (wallet_contract_id, guardian_address) DO UPDATE
      SET is_active = true, alias_label = EXCLUDED.alias_label
      RETURNING *
    `,
      [wallet.contract_id, guardian_address, alias_label || 'Guardian Key']
    );

    // Update guardian count & threshold if provided
    let finalThreshold = wallet.threshold;
    if (new_threshold) {
      finalThreshold = Number(new_threshold);
    }

    await query(
      `
      UPDATE wallets
      SET guardian_count = (SELECT COUNT(*) FROM guardians WHERE wallet_contract_id = $1 AND is_active = true),
          threshold = $2,
          updated_at = NOW()
      WHERE contract_id = $1
    `,
      [wallet.contract_id, finalThreshold]
    );

    // Record security event
    await query(
      `
      INSERT INTO security_events (wallet_contract_id, event_type, actor, details)
      VALUES ($1, 'guardian_added', $2, $3)
    `,
      [
        wallet.contract_id,
        caller,
        JSON.stringify({ guardian: guardian_address, alias: alias_label, threshold: finalThreshold }),
      ]
    );

    res.status(201).json({
      success: true,
      guardian: insertRes.rows[0],
      threshold: finalThreshold,
    });
  } catch (err: any) {
    console.error('Error adding guardian:', err);
    res.status(500).json({ error: err.message || 'Failed to add guardian' });
  }
});

// DELETE /api/guardians/:address - Remove guardian
guardiansRouter.delete('/:address', requireAuth, async (req: Request, res: Response) => {
  try {
    const guardianAddress = req.params.address;
    const caller = req.user!.wallet;

    const walletRes = await query(`SELECT * FROM wallets LIMIT 1`);
    if (walletRes.rowCount === 0) return res.status(404).json({ error: 'Wallet not found' });
    const wallet = walletRes.rows[0];

    if (caller !== wallet.owner_address) {
      return res.status(403).json({ error: 'Unauthorized: Only wallet owner can remove guardians.' });
    }

    const activeCountRes = await query(
      `SELECT COUNT(*) FROM guardians WHERE wallet_contract_id = $1 AND is_active = true`,
      [wallet.contract_id]
    );

    if (Number(activeCountRes.rows[0].count) <= 1) {
      return res.status(400).json({ error: 'Cannot remove the last guardian.' });
    }

    const updateGuardian = await query(
      `
      UPDATE guardians
      SET is_active = false
      WHERE wallet_contract_id = $1 AND guardian_address = $2
      RETURNING *
    `,
      [wallet.contract_id, guardianAddress]
    );

    if (updateGuardian.rowCount === 0) {
      return res.status(404).json({ error: 'Guardian not found.' });
    }

    // Adjust threshold if needed
    const remainingCount = Number(activeCountRes.rows[0].count) - 1;
    const finalThreshold = Math.min(wallet.threshold, remainingCount);

    await query(
      `
      UPDATE wallets
      SET guardian_count = $1, threshold = $2, updated_at = NOW()
      WHERE contract_id = $3
    `,
      [remainingCount, finalThreshold, wallet.contract_id]
    );

    await query(
      `
      INSERT INTO security_events (wallet_contract_id, event_type, actor, details)
      VALUES ($1, 'guardian_removed', $2, $3)
    `,
      [
        wallet.contract_id,
        caller,
        JSON.stringify({ removed_guardian: guardianAddress, new_threshold: finalThreshold }),
      ]
    );

    res.json({
      success: true,
      removedGuardian: guardianAddress,
      remainingCount,
      threshold: finalThreshold,
    });
  } catch (err: any) {
    console.error('Error removing guardian:', err);
    res.status(500).json({ error: err.message || 'Failed to remove guardian' });
  }
});

// POST /api/guardians/threshold - Update threshold
guardiansRouter.post('/threshold', requireAuth, async (req: Request, res: Response) => {
  try {
    const { threshold } = req.body;
    const caller = req.user!.wallet;

    const walletRes = await query(`SELECT * FROM wallets LIMIT 1`);
    if (walletRes.rowCount === 0) return res.status(404).json({ error: 'Wallet not found' });
    const wallet = walletRes.rows[0];

    if (caller !== wallet.owner_address) {
      return res.status(403).json({ error: 'Unauthorized: Only wallet owner can configure threshold.' });
    }

    const thresh = Number(threshold);
    const activeCountRes = await query(
      `SELECT COUNT(*) FROM guardians WHERE wallet_contract_id = $1 AND is_active = true`,
      [wallet.contract_id]
    );
    const activeCount = Number(activeCountRes.rows[0].count);

    if (thresh <= 0 || thresh > activeCount) {
      return res.status(400).json({ error: `Threshold must be between 1 and ${activeCount}.` });
    }

    const oldThreshold = wallet.threshold;
    await query(
      `UPDATE wallets SET threshold = $1, updated_at = NOW() WHERE contract_id = $2`,
      [thresh, wallet.contract_id]
    );

    await query(
      `
      INSERT INTO security_events (wallet_contract_id, event_type, actor, details)
      VALUES ($1, 'threshold_changed', $2, $3)
    `,
      [
        wallet.contract_id,
        caller,
        JSON.stringify({ old_threshold: oldThreshold, new_threshold: thresh }),
      ]
    );

    res.json({
      success: true,
      threshold: thresh,
    });
  } catch (err: any) {
    console.error('Error updating threshold:', err);
    res.status(500).json({ error: 'Failed to update threshold' });
  }
});

