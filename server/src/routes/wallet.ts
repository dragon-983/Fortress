import { Router, Request, Response } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';
import { getAccountBalances } from '../stellar.js';
import { config } from '../config.js';

export const walletRouter = Router();

// GET /api/wallet - Get current Fortress wallet status and configuration
walletRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const walletRes = await query(`SELECT * FROM wallets LIMIT 1`);
    if (walletRes.rowCount === 0) {
      return res.status(404).json({ error: 'Fortress wallet not configured yet.' });
    }

    const wallet = walletRes.rows[0];
    const guardiansRes = await query(
      `SELECT * FROM guardians WHERE wallet_contract_id = $1 AND is_active = true ORDER BY added_at ASC`,
      [wallet.contract_id]
    );

    const activeProposalsRes = await query(
      `SELECT * FROM proposals WHERE wallet_contract_id = $1 AND status IN ('Pending', 'Timelocked') ORDER BY created_at DESC`,
      [wallet.contract_id]
    );

    // Fetch live Stellar Testnet balances for the smart wallet contract
    const balances = await getAccountBalances(wallet.contract_id);

    res.json({
      success: true,
      wallet: {
        ...wallet,
        guardians: guardiansRes.rows,
        activeProposals: activeProposalsRes.rows,
        balances,
        stellarNetwork: config.stellar.network,
        contractId: wallet.contract_id,
      },
    });
  } catch (err: any) {
    console.error('Error fetching wallet status:', err);
    res.status(500).json({ error: 'Failed to fetch wallet status' });
  }
});

// POST /api/wallet/transfer - Execute asset transfer under on-chain limits
walletRouter.post('/transfer', requireAuth, async (req: Request, res: Response) => {
  try {
    const { to, amount, token_address = config.stellar.usdcContractId } = req.body;
    const caller = req.user!.wallet;

    if (!to || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Valid destination address and amount are required' });
    }

    const walletRes = await query(`SELECT * FROM wallets LIMIT 1`);
    if (walletRes.rowCount === 0) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    const wallet = walletRes.rows[0];
    if (caller !== wallet.owner_address) {
      return res.status(403).json({ error: 'Unauthorized: Only the current wallet owner can initiate transfers.' });
    }

    const transferAmount = Number(amount);
    if (transferAmount > Number(wallet.per_tx_limit)) {
      // Record rejected event
      await query(
        `
        INSERT INTO security_events (wallet_contract_id, event_type, actor, details)
        VALUES ($1, 'transfer_rejected', $2, $3)
      `,
        [
          wallet.contract_id,
          caller,
          JSON.stringify({
            reason: 'Exceeds per-transaction limit',
            amount: transferAmount,
            limit: wallet.per_tx_limit,
          }),
        ]
      );

      return res.status(400).json({
        error: `Transfer rejected: Amount ${transferAmount} exceeds per-transaction limit of ${wallet.per_tx_limit} USDC.`,
      });
    }

    // Check daily spending
    const dailySpentRes = await query(
      `
      SELECT COALESCE(SUM((details->>'amount')::numeric), 0) AS total_today
      FROM security_events
      WHERE wallet_contract_id = $1
        AND event_type = 'transfer_executed'
        AND created_at >= NOW() - INTERVAL '24 hours'
    `,
      [wallet.contract_id]
    );

    const totalToday = Number(dailySpentRes.rows[0].total_today);
    if (totalToday + transferAmount > Number(wallet.daily_limit)) {
      await query(
        `
        INSERT INTO security_events (wallet_contract_id, event_type, actor, details)
        VALUES ($1, 'transfer_rejected', $2, $3)
      `,
        [
          wallet.contract_id,
          caller,
          JSON.stringify({
            reason: 'Exceeds daily spending limit',
            amount: transferAmount,
            current_day_spent: totalToday,
            daily_limit: wallet.daily_limit,
          }),
        ]
      );

      return res.status(400).json({
        error: `Transfer rejected: Cumulative 24h spend (${totalToday + transferAmount}) exceeds daily limit of ${wallet.daily_limit} USDC.`,
      });
    }

    // Simulate / record settlement tx
    const txHash = `0x${Buffer.from('XFER-' + caller.slice(0, 8) + Date.now()).toString('hex').slice(0, 64)}`;

    await query(
      `
      INSERT INTO security_events (wallet_contract_id, event_type, actor, tx_hash, details)
      VALUES ($1, 'transfer_executed', $2, $3, $4)
    `,
      [
        wallet.contract_id,
        caller,
        txHash,
        JSON.stringify({
          to,
          token_address,
          amount: transferAmount,
        }),
      ]
    );

    res.json({
      success: true,
      txHash,
      recipient: to,
      amount: transferAmount,
      remainingDailyAllowance: Math.max(0, Number(wallet.daily_limit) - (totalToday + transferAmount)),
    });
  } catch (err: any) {
    console.error('Error executing transfer:', err);
    res.status(500).json({ error: err.message || 'Transfer failed' });
  }
});

// POST /api/wallet/limits - Update spending limits
walletRouter.post('/limits', requireAuth, async (req: Request, res: Response) => {
  try {
    const { per_tx_limit, daily_limit } = req.body;
    const caller = req.user!.wallet;

    if (!per_tx_limit || !daily_limit || Number(daily_limit) < Number(per_tx_limit)) {
      return res.status(400).json({ error: 'Valid limits required. Daily limit must be >= per-tx limit.' });
    }

    const walletRes = await query(`SELECT * FROM wallets LIMIT 1`);
    if (walletRes.rowCount === 0) return res.status(404).json({ error: 'Wallet not found' });
    const wallet = walletRes.rows[0];

    if (caller !== wallet.owner_address) {
      return res.status(403).json({ error: 'Unauthorized: Only the current wallet owner can configure limits.' });
    }

    const updateRes = await query(
      `
      UPDATE wallets
      SET per_tx_limit = $1, daily_limit = $2, updated_at = NOW()
      WHERE contract_id = $3
      RETURNING *
    `,
      [per_tx_limit, daily_limit, wallet.contract_id]
    );

    await query(
      `
      INSERT INTO security_events (wallet_contract_id, event_type, actor, details)
      VALUES ($1, 'limits_updated', $2, $3)
    `,
      [
        wallet.contract_id,
        caller,
        JSON.stringify({ per_tx_limit, daily_limit }),
      ]
    );

    res.json({
      success: true,
      wallet: updateRes.rows[0],
    });
  } catch (err: any) {
    console.error('Error updating limits:', err);
    res.status(500).json({ error: 'Failed to update spending limits' });
  }
});

// POST /api/wallet/timelock - Update recovery timelock
walletRouter.post('/timelock', requireAuth, async (req: Request, res: Response) => {
  try {
    const { recovery_timelock } = req.body;
    const caller = req.user!.wallet;

    if (!recovery_timelock || Number(recovery_timelock) < 60) {
      return res.status(400).json({ error: 'Timelock must be at least 60 seconds.' });
    }

    const walletRes = await query(`SELECT * FROM wallets LIMIT 1`);
    if (walletRes.rowCount === 0) return res.status(404).json({ error: 'Wallet not found' });
    const wallet = walletRes.rows[0];

    if (caller !== wallet.owner_address) {
      return res.status(403).json({ error: 'Unauthorized: Only the current wallet owner can configure timelock.' });
    }

    const updateRes = await query(
      `
      UPDATE wallets
      SET recovery_timelock = $1, updated_at = NOW()
      WHERE contract_id = $2
      RETURNING *
    `,
      [recovery_timelock, wallet.contract_id]
    );

    await query(
      `
      INSERT INTO security_events (wallet_contract_id, event_type, actor, details)
      VALUES ($1, 'timelock_updated', $2, $3)
    `,
      [
        wallet.contract_id,
        caller,
        JSON.stringify({ recovery_timelock }),
      ]
    );

    res.json({
      success: true,
      wallet: updateRes.rows[0],
    });
  } catch (err: any) {
    console.error('Error updating timelock:', err);
    res.status(500).json({ error: 'Failed to update timelock' });
  }
});

