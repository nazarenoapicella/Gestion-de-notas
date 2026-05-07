const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const bcrypt = require("bcrypt");

router.post("/login", async (req, res) => {
  const { usuario, password, rango } = req.body;
  try {
    const conn = await pool.getConnection();
    const rows = await conn.query(
      "SELECT * FROM usuarios WHERE usuario = ? AND rango = ?",
      [usuario, rango]
    );
    conn.release();

    if (!rows || rows.length === 0) {
     return res.json({ success: false });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: "Credenciales incorrectas" });

    res.json({
      success: true,
      id: user.id,
      usuario: user.usuario,
      permiso: user.permiso,
      rango: user.rango,
      cambiar: user.debe_cambiar_password
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error en el servidor" });
  }
});

router.post("/cambiar-password", async (req, res) => {
  const { usuario, nuevaPassword } = req.body;

  try {
    const conn = await pool.getConnection();
    const hashedPassword = await bcrypt.hash(nuevaPassword, 10);
    await conn.query(
  "UPDATE usuarios SET password = ?, debe_cambiar_password = false WHERE usuario = ?",
  [hashedPassword, usuario]
);
    conn.release();
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error en el servidor" });
  }
});
module.exports = router;