const express = require("express");
const router = express.Router();
const pool = require("../db/connection");

// GET planilla
router.get("/:cursoMateriaId/:usuarioId", async (req, res) => {
  const { cursoMateriaId, usuarioId } = req.params;

  let conn;
  try {
    conn = await pool.getConnection();

    const users = await conn.query(
      "SELECT id, permiso, rango FROM usuarios WHERE id = ?",
      [usuarioId]
    );

    if (!users || users.length === 0) {
      return res.status(403).json({ success: false, error: "Usuario no encontrado" });
    }

    const user = users[0];

    const materia = await conn.query(`
      SELECT
        cm.id   AS curso_materia_id,
        m.nombre AS materia,
        c.anio,
        c.division,
        cm.dias,
        cm.horario
      FROM curso_materia cm
      INNER JOIN materias m ON cm.materia_id = m.id
      INNER JOIN cursos c   ON cm.curso_id   = c.id
      WHERE cm.id = ?
    `, [cursoMateriaId]);

    const alumnos = await conn.query(`
      SELECT DISTINCT
        u.id,
        u.nombre,
        u.apellido
      FROM curso_materia cm
      INNER JOIN cursos c        ON cm.curso_id   = c.id
      INNER JOIN alumno_curso ac ON c.id          = ac.curso_id
      INNER JOIN usuarios u      ON ac.alumno_id  = u.id
      WHERE cm.id = ?
        AND u.rango = 'alumno'
      ORDER BY u.apellido, u.nombre
    `, [cursoMateriaId]);

    const evaluaciones = await conn.query(`
      SELECT
        e.id,
        e.tipo,
        e.descripcion,
        e.fecha,
        e.bimestre,
        e.cierre,
        n.alumno_id,
        n.nota
      FROM evaluaciones e
      INNER JOIN notas n ON e.id = n.evaluacion_id
      WHERE e.curso_materia_id = ?
      ORDER BY e.bimestre, e.id
    `, [cursoMateriaId]);

    res.json({
      success: true,
      user,
      materia: materia[0],
      alumnos,
      notas: evaluaciones
    });

  } catch (err) {
    console.error("Error al cargar planilla:", err);
    res.status(500).json({ success: false, error: "Error al cargar planilla" });
  } finally {
    if (conn) conn.release();
  }
});

// POST evaluacion individual
router.post("/evaluacion", async (req, res) => {
  const {
    usuarioId,
    alumnoId,
    cursoMateriaId,
    tipo,
    descripcion,
    nota,
    bimestre,
    cierre
  } = req.body;

  if (!usuarioId || !alumnoId || !cursoMateriaId || nota === undefined || nota === null) {
    return res.status(400).json({ success: false, error: "Datos incompletos" });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    const usuarios = await conn.query(
      "SELECT permiso FROM usuarios WHERE id = ?",
      [usuarioId]
    );

    if (!usuarios || usuarios.length === 0 || usuarios[0].permiso === "lectura") {
      return res.status(403).json({ success: false, error: "Sin permisos" });
    }

    await conn.beginTransaction();

    const result = await conn.query(`
      INSERT INTO evaluaciones
        (curso_materia_id, tipo, descripcion, fecha, bimestre, cierre)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      cursoMateriaId,
      tipo || null,
      descripcion || null,
      new Date(),
      bimestre || null,
      cierre || null
    ]);

    const evaluacionId = Number(result.insertId);

    await conn.query(`
      INSERT INTO notas (evaluacion_id, alumno_id, nota)
      VALUES (?, ?, ?)
    `, [evaluacionId, alumnoId, nota]);

    await conn.commit();

    res.json({ success: true });

  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    console.error("Error al guardar evaluación:", err);
    res.status(500).json({ success: false, error: "Error al guardar evaluación" });
  } finally {
    if (conn) conn.release();
  }
});

// POST evaluacion global
router.post("/evaluacion-global", async (req, res) => {
  const {
    cursoMateriaId,
    tipo,
    descripcion,
    bimestre,
    notas,
    usuarioId
  } = req.body;

  if (!cursoMateriaId || !descripcion || !bimestre || !Array.isArray(notas) || notas.length === 0) {
    return res.status(400).json({ success: false, error: "Datos incompletos" });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    const usuarios = await conn.query(
      "SELECT permiso FROM usuarios WHERE id = ?",
      [usuarioId]
    );

    if (!usuarios || usuarios.length === 0 || usuarios[0].permiso === "lectura") {
      return res.status(403).json({ success: false, error: "Sin permisos" });
    }
    await conn.beginTransaction();

    const result = await conn.query(`
      INSERT INTO evaluaciones
        (curso_materia_id, tipo, descripcion, fecha, bimestre)
      VALUES (?, ?, ?, ?, ?)
    `, [
      cursoMateriaId,
      tipo || null,
      descripcion,
      new Date(),
      bimestre
    ]);

    const evaluacionId = Number(result.insertId);

    for (const n of notas) {
      await conn.query(`
        INSERT INTO notas (evaluacion_id, alumno_id, nota)
        VALUES (?, ?, ?)
      `, [evaluacionId, n.alumnoId, n.nota]);
    }

    await conn.commit();

    res.json({ success: true });

  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    console.error("Error al crear evaluación global:", err);
    res.status(500).json({ success: false, error: "Error al crear evaluacion global" });
  } finally {
    if (conn) conn.release();
  }
});


router.delete("/evaluacion/:id", async (req, res) => {
  const { id } = req.params;
  const { usuarioId, alumnoId } = req.body;

  if (!usuarioId || !alumnoId) {
    return res.status(400).json({ success: false, error: "Datos incompletos" });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    const usuarios = await conn.query(
      "SELECT permiso FROM usuarios WHERE id = ?",
      [usuarioId]
    );

    if (!usuarios || usuarios.length === 0 || usuarios[0].permiso === "lectura") {
      return res.status(403).json({ success: false, error: "Sin permisos" });
    }

    await conn.beginTransaction();


    await conn.query(
      "DELETE FROM notas WHERE evaluacion_id = ? AND alumno_id = ?",
      [id, alumnoId]
    );

    const restantes = await conn.query(
      "SELECT id FROM notas WHERE evaluacion_id = ?",
      [id]
    );

    if (restantes.length === 0) {
      await conn.query("DELETE FROM evaluaciones WHERE id = ?", [id]);
    }

    await conn.commit();

    res.json({ success: true });

  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    console.error("Error al eliminar evaluación:", err);
    res.status(500).json({ success: false, error: "Error al eliminar evaluación" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;