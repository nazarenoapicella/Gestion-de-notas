require("dotenv").config();
const mariadb = require("mariadb");

const pool = mariadb.createPool({
  host:            process.env.DB_HOST     || "localhost",
  user:            process.env.DB_USER     || "root",
  password:        process.env.DB_PASSWORD || "",
  database:        process.env.DB_NAME     || "colegio",
  connectionLimit: 10,
  connectTimeout:  10000
});

module.exports = pool;