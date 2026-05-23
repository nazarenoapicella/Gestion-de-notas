const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const bcrypt = require("bcrypt");

router.post("/login", async (req, res) => {
  const { usuario, password, rango } = req.body;

  if (!usuario || !password || !rango) {
    return res.status(400).json({ success: false, message: "Datos incompletos" });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    const rows = await conn.query(
      "SELECT id, usuario, password, permiso, rango, debe_cambiar_password FROM usuarios WHERE usuario = ? AND rango = ?",
      [usuario, rango]
    );

    if (!rows || rows.length === 0) {
      return res.json({ success: false, message: "Credenciales incorrectas" });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }

    res.json({
      success: true,
      id: Number(user.id),
      usuario: user.usuario,
      permiso: user.permiso,
      rango: user.rango,
      cambiar: user.debe_cambiar_password
    });

  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({ success: false, message: "Error en el servidor" });
  } finally {
    if (conn) conn.release();
  }
});

router.post("/cambiar-password", async (req, res) => {
  const { usuario, nuevaPassword, usuarioId } = req.body;
  if (!nuevaPassword || typeof nuevaPassword !== "string" || nuevaPassword.trim().length < 6) {
    return res.status(400).json({ success: false, message: "La contraseña debe tener al menos 6 caracteres" });
  }

  if (!usuario) {
    return res.status(400).json({ success: false, message: "Datos incompletos" });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    if (usuarioId) {
      const verificacion = await conn.query(
        "SELECT id FROM usuarios WHERE id = ? AND usuario = ?",
        [usuarioId, usuario]
      );
      if (!verificacion || verificacion.length === 0) {
        return res.status(403).json({ success: false, message: "No autorizado" });
      }
    }

    const hashedPassword = await bcrypt.hash(nuevaPassword.trim(), 10);

    await conn.query(
      "UPDATE usuarios SET password = ?, debe_cambiar_password = 0 WHERE usuario = ?",
      [hashedPassword, usuario]
    );

    res.json({ success: true });

  } catch (error) {
    console.error("Error al cambiar contraseña:", error);
    res.status(500).json({ success: false, message: "Error en el servidor" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;