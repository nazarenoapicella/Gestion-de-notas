const mariadb = require("mariadb");

const pool = mariadb.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "colegio",
  connectionLimit: 100
});

module.exports = pool;