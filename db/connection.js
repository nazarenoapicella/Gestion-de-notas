const mariadb = require("mariadb");

const pool = mariadb.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "colegio",
  connectionLimit: 10,
  connectTimeout: 10000
});

module.exports = pool;