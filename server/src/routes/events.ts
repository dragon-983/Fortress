import { Router, Request, Response } from 'express';
import { query } from '../db.js';

export const eventsRouter = Router();

// GET /api/events - Full immutable audit trail
eventsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { event_type, search, limit = '50', offset = '0' } = req.query;

    let sql = `SELECT * FROM security_events WHERE 1=1`;
    const params: any[] = [];

    if (event_type) {
      params.push(event_type);
      sql += ` AND event_type = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (actor ILIKE $${params.length} OR tx_hash ILIKE $${params.length} OR details::text ILIKE $${params.length})`;
    }

    params.push(Math.min(Number(limit) || 50, 100));
    const limitParam = `$${params.length}`;
    params.push(Number(offset) || 0);
    const offsetParam = `$${params.length}`;

    sql += ` ORDER BY created_at DESC LIMIT ${limitParam} OFFSET ${offsetParam}`;

    const result = await query(sql, params);
    res.json({
      success: true,
      events: result.rows,
    });
  } catch (err: any) {
    console.error('Error fetching security events:', err);
    res.status(500).json({ error: 'Failed to fetch security events' });
  }
});

// GET /api/events/stats - Security health and overview stats
eventsRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const statsRes = await query(`
      SELECT 
        (SELECT COUNT(*) FROM security_events) AS total_events,
        (SELECT COUNT(*) FROM security_events WHERE event_type = 'transfer_rejected') AS rejected_transfers,
        (SELECT COUNT(*) FROM proposals WHERE status IN ('Pending', 'Timelocked')) AS active_proposals,
        (SELECT COUNT(*) FROM proposals WHERE status = 'Executed') AS completed_recoveries,
        (SELECT COUNT(*) FROM guardians WHERE is_active = true) AS active_guardians
    `);

    const stats = statsRes.rows[0];

    res.json({
      success: true,
      stats: {
        totalEvents: Number(stats.total_events),
        rejectedTransfersCount: Number(stats.rejected_transfers),
        activeProposalsCount: Number(stats.active_proposals),
        completedRecoveriesCount: Number(stats.completed_recoveries),
        activeGuardiansCount: Number(stats.active_guardians),
        securityHealth: 'Optimal',
        timelockEnforcement: 'Strict On-Chain',
      },
    });
  } catch (err: any) {
    console.error('Error fetching event stats:', err);
    res.status(500).json({ error: 'Failed to fetch event stats' });
  }
});

