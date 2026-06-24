const express        = require("express");
const router         = express.Router();
const pool           = require("../db/connection");
const authMiddleware = require("../middleware/auth");
const archiver        = require("archiver");
const { PassThrough }  = require("stream");
const { generarBoletinPDF } = require("../lib/generarBoletinPDF");
const { calcularResumenMateria } = require("../lib/calculoNotas");

function idEnteroValido(val) {
  const n = parseInt(val, 10);
  return !isNaN(n) && n > 0;
}

// ─── GET /boletines/cursos ─────────────────────────────────────────────────────
// Devuelve todos los cursos del colegio (el secretario ve todo, sin restricción).

router.get("/cursos", authMiddleware, async (req, res) => {
  const { rango } = req.user;

  if (rango !== "secretario" && rango !== "regente") {
    return res.status(403).json({ success: false, error: "Sin permisos para esta acción" });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    const cursos = await conn.query(
      "SELECT id, anio, division, turno FROM cursos ORDER BY anio, division"
    );
    res.json({ success: true, cursos });
  } catch (err) {
    console.error("Error al listar cursos:", err);
    res.status(500).json({ success: false, error: "Error del servidor" });
  } finally {
    if (conn) conn.release();
  }
});

// ─── GET /boletines/generar/:cursoId ───────────────────────────────────────────
// Genera un ZIP con un PDF de boletín por cada alumno del curso indicado.
// Cada PDF queda como archivo independiente dentro del ZIP — esto es intencional:
// permite que en una futura iteración cada PDF se adjunte individualmente
// a un mail dirigido a ese alumno específico, sin tener que desempaquetar nada.

router.get("/generar/:cursoId", authMiddleware, async (req, res) => {
  const { cursoId } = req.params;
  const { rango } = req.user;

  if (rango !== "secretario" && rango !== "regente") {
    return res.status(403).json({ success: false, error: "Sin permisos para esta acción" });
  }
  if (!idEnteroValido(cursoId)) {
    return res.status(400).json({ success: false, error: "ID de curso inválido" });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    // Datos del curso
    const cursoRows = await conn.query(
      "SELECT id, anio, division, turno FROM cursos WHERE id = ?",
      [cursoId]
    );
    if (!cursoRows || cursoRows.length === 0) {
      return res.status(404).json({ success: false, error: "Curso no encontrado" });
    }
    const curso = cursoRows[0];

    // Alumnos inscriptos en el curso
    const alumnos = await conn.query(`
      SELECT u.id, u.nombre, u.apellido, u.dni
      FROM alumno_curso ac
      JOIN usuarios u ON ac.alumno_id = u.id
      WHERE ac.curso_id = ? AND u.rango = 'alumno'
      ORDER BY u.apellido, u.nombre
    `, [cursoId]);

    if (!alumnos || alumnos.length === 0) {
      return res.status(404).json({ success: false, error: "El curso no tiene alumnos inscriptos" });
    }

    // Materias del curso
    const materiasCurso = await conn.query(`
      SELECT cm.id AS curso_materia_id, m.nombre AS materia
      FROM curso_materia cm
      JOIN materias m ON m.id = cm.materia_id
      WHERE cm.curso_id = ?
      ORDER BY m.nombre
    `, [cursoId]);

    if (!materiasCurso || materiasCurso.length === 0) {
      return res.status(404).json({ success: false, error: "El curso no tiene materias asignadas" });
    }

    // Todas las evaluaciones + notas de todas las materias del curso, de una sola vez
    const curMatIds = materiasCurso.map(m => m.curso_materia_id);
    const evaluacionesTodas = await conn.query(`
      SELECT
        e.id, e.curso_materia_id, e.tipo, e.descripcion, e.bimestre, e.cierre,
        e.es_acumulativo, e.evaluacion_origen_id,
        n.alumno_id, n.nota
      FROM evaluaciones e
      INNER JOIN notas n ON e.id = n.evaluacion_id
      WHERE e.curso_materia_id IN (?)
    `, [curMatIds]);

    // ── Preparar el ZIP de salida ──
    res.setHeader("Content-Type", "application/zip");
    const nombreZip = `Boletines_${curso.anio}${curso.division}.zip`.replace(/\s+/g, "_");
    res.setHeader("Content-Disposition", `attachment; filename="${nombreZip}"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      console.error("Error en archiver:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: "Error al generar el ZIP" });
      }
    });
    archive.pipe(res);

    // ── Generar un PDF por alumno ──
    for (const alumno of alumnos) {
      const materiasConResumen = materiasCurso.map(mc => {
        const evalsAlumno = evaluacionesTodas.filter(
          e => Number(e.curso_materia_id) === Number(mc.curso_materia_id) &&
               Number(e.alumno_id) === Number(alumno.id)
        );
        return {
          nombre: mc.materia,
          resumen: calcularResumenMateria(evalsAlumno)
        };
      });

      const passthrough = new PassThrough();
      const chunks = [];
      passthrough.on("data", (chunk) => chunks.push(chunk));

      await generarBoletinPDF(alumno, curso, materiasConResumen, passthrough);
      const buffer = Buffer.concat(chunks);

      const nombreArchivo = `Boletin_${alumno.apellido}_${alumno.nombre}.pdf`
        .replace(/\s+/g, "_")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // quita tildes del nombre de archivo

      archive.append(buffer, { name: nombreArchivo });
    }

    await archive.finalize();

  } catch (err) {
    console.error("Error al generar boletines:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: "Error al generar los boletines" });
    }
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;