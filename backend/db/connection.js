// Central place to obtain a DB handle. Change DB_ENGINE in your .env to swap
// databases without touching any repository or route code.

const ENGINE = process.env.DB_ENGINE || "sqlite";

let driver;
if (ENGINE === "sqlite") {
  driver = require("./drivers/sqliteDriver");
} else if (ENGINE === "mysql") {
  driver = require("./drivers/mysqlDriver");
} else {
  throw new Error(`Unknown DB_ENGINE: "${ENGINE}". Use "sqlite" or "mysql".`);
}

// Contract every driver must satisfy:
//   all(sql, params) -> Promise<rows[]>
//   run(sql, params) -> Promise<{ lastID, changes }>
//   get(sql, params) -> Promise<row|undefined>
module.exports = driver;
