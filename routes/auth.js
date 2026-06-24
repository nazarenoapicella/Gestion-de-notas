const express        = require("express");
const router         = express.Router();
const pool           = require("../db/connection");
const bcrypt         = require("bcrypt");
const jwt            = require("jsonwebtoken");
const rateLimit      = require("express-rate-limit");
const authMiddleware = require("../middleware/auth");

const DUMMY_HASH     = "$2b$10$yJ9hxJ1bJ3hZ8kL5mN2pOuWqRsT4vX6yA7bC8dE9fG0hI1jK2lM3n";
const RANGOS_VALIDOS = ["profesor", "alumno", "regente", "preceptor", "secretario"];

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: "Demasiados intentos fallidos. Esperá 15 minutos e intentá de nuevo."
  }
});

router.post("/login", loginLimiter, async (req, res) => {
  const { usuario, password, rango } = req.body;

  if (!usuario || !password || !rango) {
    return res.status(400).json({ success: false, message: "Datos incompletos" });
  }
  if (typeof usuario !== "string" || usuario.length > 50) {
    return res.status(400).json({ success: false, message: "Datos incompletos" });
  }
  if (typeof password !== "string" || password.length > 200) {
    return res.status(400).json({ success: false, message: "Datos incompletos" });
  }
  if (!RANGOS_VALIDOS.includes(rango)) {
    return res.status(400).json({ success: false, message: "Rol inválido" });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    const rows = await conn.query(
      "SELECT id, usuario, password, permiso, rango, debe_cambiar_password FROM usuarios WHERE usuario = ? AND rango = ?",
      [usuario, rango]
    );

    if (!rows || rows.length === 0) {
      await bcrypt.compare(password, DUMMY_HASH);
      return res.json({ success: false, message: "Credenciales incorrectas" });
    }

    const user    = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }

    const payload = {
      id:      Number(user.id),
      usuario: user.usuario,
      permiso: user.permiso,
      rango:   user.rango
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "8h" });

    res.json({
      success: true,
      token,
      id:      Number(user.id),
      usuario: user.usuario,
      permiso: user.permiso,
      rango:   user.rango,
      cambiar: user.debe_cambiar_password
    });

  } catch (error) {
    console.error("Error en login:", error);
    res.status(500).json({ success: false, message: "Error en el servidor" });
  } finally {
    if (conn) conn.release();
  }
});

router.post("/cambiar-password", authMiddleware, async (req, res) => {
  const { nuevaPassword } = req.body;
  const { id }            = req.user;

  if (
    !nuevaPassword ||
    typeof nuevaPassword !== "string" ||
    nuevaPassword.trim().length < 6 ||
    nuevaPassword.length > 200
  ) {
    return res.status(400).json({ success: false, message: "La contraseña debe tener al menos 6 caracteres" });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    const hash = await bcrypt.hash(nuevaPassword.trim(), 10);
    await conn.query(
      "UPDATE usuarios SET password = ?, debe_cambiar_password = 0 WHERE id = ?",
      [hash, id]
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