const express = require("express");
const router = express.Router();
const pool = require("../db/connection");

router.get("/:id", async (req, res) => {
  const { id } = req.params;

  let conn;
  try {
    conn = await pool.getConnection();

    const rows = await conn.query(
      "SELECT id, rango FROM usuarios WHERE id = ?",
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json([]);
    }

    const user = rows[0];
    let resultado = [];

    if (user.rango === "profesor") {

      resultado = await conn.query(`
        SELECT
          cm.id,
          m.nombre     AS materia,
          c.anio,
          c.division,
          cm.dias,
          cm.horario,
          u.nombre     AS nombre_profesor,
          u.apellido
        FROM materias m
        JOIN curso_materia cm  ON m.id  = cm.materia_id
        JOIN cursos c          ON cm.curso_id = c.id
        JOIN profesor_materia pm ON pm.curso_materia_id = cm.id
        JOIN usuarios u        ON u.id  = pm.profesor_id
        WHERE pm.profesor_id = ?
      `, [id]);

    } else if (user.rango === "alumno") {

      resultado = await conn.query(`
        SELECT
          cm.id,
          m.nombre     AS materia,
          c.anio,
          c.division,
          cm.dias,
          cm.horario,
          u.nombre     AS nombre_alumno,
          u.apellido
        FROM alumno_curso ac
        JOIN usuarios u        ON ac.alumno_id = u.id
        JOIN cursos c          ON ac.curso_id  = c.id
        JOIN curso_materia cm  ON cm.curso_id  = c.id
        JOIN materias m        ON m.id = cm.materia_id
        WHERE ac.alumno_id = ?
        GROUP BY cm.id
      `, [id]);

    } else if (user.rango === "regente") {

      resultado = await conn.query(`
        SELECT
          cm.id,
          m.nombre     AS materia,
          c.anio,
          c.division,
          cm.dias,
          cm.horario,
          u.nombre     AS nombre_profesor,
          u.apellido
        FROM materias m
        JOIN curso_materia cm  ON m.id  = cm.materia_id
        JOIN cursos c          ON cm.curso_id = c.id
        JOIN profesor_materia pm ON pm.curso_materia_id = cm.id
        JOIN usuarios u        ON u.id  = pm.profesor_id
      `);

    }

    res.json(resultado);

  } catch (err) {
    console.error("Error en dashboard:", err);
    res.status(500).json({ error: "Error del servidor" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;