
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL não foi definida no arquivo .env'
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export async function testDatabaseConnection() {
  const result = await pool.query(`
    SELECT
      NOW() AS server_time,
      current_database() AS database_name,
      version() AS postgres_version
  `);

  return result.rows[0];
}
