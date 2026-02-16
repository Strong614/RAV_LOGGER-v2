import "dotenv/config";  // 👈 ADD THIS LINE
import { initDatabase, saveMember, addLog } from "../db/postgres.js";
import { readJSON } from "../utils/db.js";
import path from "path";

const MEMBERS_PATH = path.resolve("./data/members.json");
const LOGS_PATH = path.resolve("./data/logs.json");

async function migrate() {
  try {
    console.log("🚀 Starting migration...");
    
    // Step 1: Initialize database schema
    await initDatabase();
    console.log("✅ Database schema created");
    
    // Step 2: Migrate members
    const membersData = readJSON(MEMBERS_PATH, {});
    const members = Object.values(membersData);
    console.log(`📊 Migrating ${members.length} members...`);
    
    for (const member of members) {
      await saveMember(member);
      console.log(`  ✅ ${member.name}`);
    }
    
    // Step 3: Migrate logs
    const logs = readJSON(LOGS_PATH, []);
    console.log(`📊 Migrating ${logs.length} logs...`);
    
    for (const log of logs) {
      await addLog(log);
    }
    console.log(`  ✅ All logs migrated`);
    
    console.log("🎉 Migration completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  }
}

migrate();