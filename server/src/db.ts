import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

const connectionString =
  process.env.NODE_ENV === 'test' ? config.databaseTestUrl : config.databaseUrl;

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

export async function query<T extends pg.QueryResultRow = any>(
  text: string,
  params: any[] = []
): Promise<pg.QueryResult<T>> {
  const client = await pool.connect();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}
