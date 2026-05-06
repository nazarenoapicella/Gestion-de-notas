const express = require("express");
const router = express.Router();
const pool = require("../db/connection");


router.get("/:id", async (req, res) => {
    const { id } = req.params;
    const conn = await pool.getConnection();
    let rows = await conn.query(
      "SELECT * FROM usuarios WHERE id = ?",
      [id]
    );
    const user = rows[0];
    
    if (user.rango === "profesor") {
   rows = await conn.query(`
  SELECT 
    m.nombre, 
    c.anio, 
    c.division,
    cm.dias,
    cm.horario
  FROM materias m
  JOIN curso_materia cm ON m.id = cm.materia_id
  JOIN cursos c ON cm.curso_id = c.id
  JOIN profesor_materia pm ON pm.curso_materia_id = cm.id
  WHERE pm.profesor_id = ?
`, [id]);
  } else if (user.rango === "alumno") {
    rows = await conn.query(`
  SELECT 
    m.nombre,
    c.anio,
    c.division,
    cm.dias,
    cm.horario
  FROM alumno_curso ac
  JOIN cursos c ON ac.curso_id = c.id
  JOIN curso_materia cm ON cm.curso_id = c.id
  JOIN materias m ON m.id = cm.materia_id
  WHERE ac.alumno_id = ?
  GROUP BY m.id, c.id
`, [id]);
  }else {
    rows = []; // otros rangos  
  }
  conn.release();

  res.json(rows);
});

module.exports = router;