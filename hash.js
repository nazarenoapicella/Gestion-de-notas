const bcrypt = require("bcrypt");

async function generar() {
  const hash = await bcrypt.hash("1234", 10);
  console.log(hash);
}

generar();