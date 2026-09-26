// Placeholder driver for the eventual SQLite -> MySQL migration.
//
// It implements the SAME interface as sqliteDriver.js — all(sql, params),
// run(sql, params), get(sql, params) — so routineRepository.js and every
// route built on top of it need ZERO changes when you flip DB_ENGINE=mysql
// in your .env file. Only this file (and the DDL, which MySQL syntax
// differs slightly on - e.g. AUTOINCREMENT -> AUTO_INCREMENT) needs updating.
//
// To activate:
//   1. npm install mysql2
//   2. Uncomment the block below
//   3. Add MYSQL_HOST / MYSQL_USER / MYSQL_PASSWORD / MYSQL_DATABASE to .env
//   4. Run the MySQL equivalent of schema.sql against your database
//   5. Set DB_ENGINE=mysql

/*
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
});

async function all(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function run(sql, params = []) {
  const [result] = await pool.query(sql, params);
  return { lastID: result.insertId, changes: result.affectedRows };
}

async function get(sql, params = []) {
  const rows = await all(sql, params);
  return rows[0];
}

module.exports = { all, run, get };
*/

throw new Error(
  "mysqlDriver is not implemented yet — see the setup steps in the comments at the top of this file."
);
