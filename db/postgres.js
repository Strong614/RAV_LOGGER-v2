import pg from "pg";
const { Pool } = pg;

let pool = null;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }  // ✅ ALWAYS use SSL for Render
    });

    pool.on("error", (err) => {
      console.error("Unexpected database error:", err);
    });
  }
  return pool;
}

// Initialize database schema
export async function initDatabase() {
  const pool = getPool();
  
  try {
    // Members table
    await pool.query(`
  CREATE TABLE IF NOT EXISTS members (
    username VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    joined_at TIMESTAMP NOT NULL,
    rank VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    warnings INTEGER DEFAULT 0,
    notified_one_month BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

    // Logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        username VARCHAR(255),
        name VARCHAR(255),
        rank VARCHAR(100),
        by VARCHAR(255),
        timestamp TIMESTAMP NOT NULL,
        joined_at TIMESTAMP,
        warnings INTEGER,
        extra TEXT,
        from_rank VARCHAR(100),
        to_rank VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexes for better performance
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_members_name ON members(name)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_members_status ON members(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_logs_type ON logs(type)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_logs_username ON logs(username)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC)`);

    console.log("✅ Database initialized successfully");
  } catch (err) {
    console.error("❌ Database initialization failed:", err);
    throw err;
  }
}

// ========== MEMBER OPERATIONS ==========

export async function saveMember(member) {
  const pool = getPool();
  const query = `
    INSERT INTO members (username, name, joined_at, rank, status, warnings, notified_one_month)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (username) 
    DO UPDATE SET 
      name = EXCLUDED.name,
      rank = EXCLUDED.rank,
      status = EXCLUDED.status,
      warnings = EXCLUDED.warnings,
      notified_one_month = EXCLUDED.notified_one_month,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `;
  
  const result = await pool.query(query, [
    member.username,
    member.name,
    member.joinedAt || new Date().toISOString(),
    member.rank || 'Member',
    member.status || 'active',
    member.warnings || 0,
    member.notifiedOneMonth || false  // 👈 ADD THIS
  ]);
  
  return result.rows[0];
}

export async function getMember(username) {
  const pool = getPool();
  const result = await pool.query(
    "SELECT * FROM members WHERE username = $1",
    [username]
  );
  return result.rows[0] || null;
}

export async function getAllMembers(filters = {}) {
  const pool = getPool();
  let query = "SELECT * FROM members WHERE 1=1";
  const params = [];
  let paramCount = 1;

  if (filters.name) {
    query += ` AND LOWER(name) LIKE $${paramCount}`;
    params.push(`%${filters.name.toLowerCase()}%`);
    paramCount++;
  }

  if (filters.rank) {
    query += ` AND LOWER(rank) = $${paramCount}`;
    params.push(filters.rank.toLowerCase());
    paramCount++;
  }

  if (filters.status) {
    query += ` AND status = $${paramCount}`;
    params.push(filters.status);
    paramCount++;
  }

  // Sorting
  const sortField = filters.sortField || 'joined_at';
  const sortOrder = filters.sortOrder || 'asc';
  
  // Map friendly names to DB columns
  const fieldMap = {
    'name': 'name',
    'rank': 'rank',
    'joined': 'joined_at'
  };
  const dbField = fieldMap[sortField] || sortField;
  
  query += ` ORDER BY ${dbField} ${sortOrder}`;

  const result = await pool.query(query, params);
  
  // Transform to match old JSON format
return result.rows.map(row => ({
  username: row.username,
  name: row.name,
  joinedAt: row.joined_at,
  rank: row.rank,
  status: row.status,
  warnings: row.warnings,
  notifiedOneMonth: row.notified_one_month  // 👈 ADD THIS
}));
}

export async function getMemberNames(activeOnly = true) {
  const pool = getPool();
  const query = activeOnly
    ? "SELECT name FROM members WHERE status = 'active'"
    : "SELECT name FROM members";
  
  const result = await pool.query(query);
  return result.rows.map(row => row.name);
}

export async function deleteMember(username) {
  const pool = getPool();
  await pool.query("DELETE FROM members WHERE username = $1", [username]);
}

export async function updateMemberRank(username, newRank) {
  const pool = getPool();
  const result = await pool.query(
    "UPDATE members SET rank = $1, updated_at = CURRENT_TIMESTAMP WHERE username = $2 RETURNING *",
    [newRank, username]
  );
  return result.rows[0];
}

// ========== LOG OPERATIONS ==========

export async function addLog(logData) {
  const pool = getPool();
  
  // 👇 ADD THIS: Handle invalid timestamps
  let timestamp = logData.timestamp;
  if (!timestamp || timestamp === "Unkown date" || timestamp === "Unknown date") {
    timestamp = new Date().toISOString(); // Use current time as fallback
  }
  
  const query = `
    INSERT INTO logs (
      type, username, name, rank, by, timestamp, 
      joined_at, warnings, extra, from_rank, to_rank
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `;
  
  const result = await pool.query(query, [
    logData.type,
    logData.username || null,
    logData.name || null,
    logData.rank || null,
    logData.by || null,
    timestamp,  // 👈 Use cleaned timestamp
    logData.joinedAt || null,
    logData.warnings || null,
    logData.extra || null,
    logData.from || null,
    logData.to || null
  ]);
  
  return result.rows[0];
}

export async function getAllLogs(filters = {}) {
  const pool = getPool();
  let query = "SELECT * FROM logs WHERE 1=1";
  const params = [];
  let paramCount = 1;

  if (filters.type && filters.type !== 'ALL') {
    query += ` AND type = $${paramCount}`;
    params.push(filters.type);
    paramCount++;
  }

  if (filters.username) {
    query += ` AND username = $${paramCount}`;
    params.push(filters.username);
    paramCount++;
  }

  query += " ORDER BY timestamp DESC";

  const result = await pool.query(query, params);
  
  // Transform to match old JSON format
  return result.rows.map(row => ({
    type: row.type,
    username: row.username,
    name: row.name,
    rank: row.rank,
    by: row.by,
    timestamp: row.timestamp,
    joinedAt: row.joined_at,
    warnings: row.warnings,
    extra: row.extra,
    from: row.from_rank,
    to: row.to_rank
  }));
}