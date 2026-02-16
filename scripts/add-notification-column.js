import "dotenv/config";
import { getPool } from "../db/postgres.js";

async function addColumn() {
  try {
    const pool = getPool();
    
    console.log("Adding notified_one_month column...");
    
    await pool.query(`
      ALTER TABLE members 
      ADD COLUMN IF NOT EXISTS notified_one_month BOOLEAN DEFAULT FALSE
    `);
    
    console.log("✅ Column added successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed:", err);
    process.exit(1);
  }
}

addColumn();