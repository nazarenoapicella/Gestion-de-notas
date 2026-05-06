const mariadb = require("mariadb");

const pool = mariadb.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "colegio",
  connectionLimit: 500
});

module.exports = pool;