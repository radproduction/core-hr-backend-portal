import mysql from 'mysql2/promise';
import fs from 'fs';

const sql = fs.readFileSync('drizzle/0007_abandoned_freak.sql', 'utf8');
const stmts = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);

const conn = await mysql.createConnection(process.env.DATABASE_URL);
for (const stmt of stmts) {
  try {
    await conn.execute(stmt);
    console.log('OK:', stmt.slice(0, 70));
  } catch (e) {
    const msg = e.message || '';
    if (!msg.includes('already exists') && !msg.includes('Duplicate')) {
      console.error('ERR:', msg.slice(0, 120));
    } else {
      console.log('SKIP (exists):', stmt.slice(0, 60));
    }
  }
}
await conn.end();
console.log('Migration complete');
