// mysql_driver.js - Native Zero-Dependency MySQL / MariaDB Connector for e-PENUMPANG
// Works seamlessly with XAMPP, phpMyAdmin, standalone MySQL, MariaDB, and Cloud MySQL.
const { spawn, execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

// Default MySQL Configuration
const CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'e_penumpang',
  mysqlBin: process.env.MYSQL_BIN || (fs.existsSync('C:\\xampp\\mysql\\bin\\mysql.exe') ? 'C:\\xampp\\mysql\\bin\\mysql.exe' : 'mysql')
};

/**
 * Escapes a parameter safely for SQL
 */
function escapeValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val.toString();
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
  // Escape backslashes and single quotes
  return `'${val.toString().replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
}

/**
 * Replaces ? placeholders with escaped values
 */
function formatSql(sql, params = []) {
  if (!params || params.length === 0) return sql;
  let idx = 0;
  return sql.replace(/\?/g, () => {
    if (idx < params.length) {
      return escapeValue(params[idx++]);
    }
    return 'NULL';
  });
}

/**
 * Executes an arbitrary SQL query via MySQL CLI bridge
 * Returns Promise<Array<Object> | { affectedRows: number, insertId: number }>
 */
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    const formatted = formatSql(sql, params);
    
    // Command arguments
    const args = [
      '-h', CONFIG.host,
      '-P', CONFIG.port.toString(),
      '-u', CONFIG.user,
      CONFIG.database,
      '--batch',
      '--raw',
      '--default-character-set=utf8mb4',
      '-e', formatted
    ];

    if (CONFIG.password) {
      args.push(`-p${CONFIG.password}`);
    }

    execFile(CONFIG.mysqlBin, args, { maxBuffer: 10 * 1024 * 1024, timeout: 1500 }, (err, stdout, stderr) => {
      if (err) {
        return reject(new Error(`MySQL Error: ${stderr || err.message}\nSQL: ${formatted}`));
      }

      const trimmed = stdout.trim();
      if (!trimmed) {
        return resolve([]);
      }

      // Parse TSV output from MySQL CLI, removing \r
      const lines = trimmed.replace(/\r/g, '').split('\n');
      if (lines.length < 1) return resolve([]);

      const headers = lines[0].split('\t').map(h => h.trim());
      const rows = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        const values = line.split('\t');
        const row = {};
        for (let j = 0; j < headers.length; j++) {
          let v = values[j];
          if (v === 'NULL') v = null;
          row[headers[j]] = v;
        }
        rows.push(row);
      }

      resolve(rows);
    });
  });
}

let lastConnectionCheck = 0;
let cachedConnectionStatus = null;

/**
 * Tests connection to MySQL server with 10s caching to avoid latency when offline
 */
async function testConnection(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedConnectionStatus && (now - lastConnectionCheck < 10000)) {
    return cachedConnectionStatus;
  }
  lastConnectionCheck = now;
  try {
    const rows = await query('SELECT VERSION() as version, DATABASE() as db, NOW() as server_time');
    cachedConnectionStatus = {
      connected: true,
      version: rows[0] ? rows[0].version : 'Unknown',
      database: rows[0] ? rows[0].db : CONFIG.database,
      serverTime: rows[0] ? rows[0].server_time : new Date().toISOString(),
      config: {
        host: CONFIG.host,
        port: CONFIG.port,
        user: CONFIG.user,
        database: CONFIG.database
      }
    };
    return cachedConnectionStatus;
  } catch (err) {
    cachedConnectionStatus = {
      connected: false,
      error: err.message,
      config: CONFIG
    };
    return cachedConnectionStatus;
  }
}

module.exports = {
  CONFIG,
  query,
  formatSql,
  testConnection
};
