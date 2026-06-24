const express        = require("express");
const router          = express.Router();
const pool            = require("../db/connection");
const authMiddleware  = require("../middleware/auth");
const archiver         = require("archiver");
const { PassThrough }  = require("stream");
const { generarBoletinPDF } = require("../lib/generarBoletinPDF");
const { calcularResumenMateria } = require("../lib/calculoNotas");
const { detectarPeriodoMasAvanzado } = require("../lib/detectarPeriodo");
const { enviarBoletinPorMail } = require("../lib/mailer");

function idEnteroValido(val) {
  const n = parseInt(val, 10);
  return !isNaN(n) && n > 0;
}

function normalizarNombreArchivo(str) {
  return str
    .replace(/\s+/g, "_")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // quita tildes
}

// ─── GET /boletines/cursos ─────────────────────────────────────────────────────

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
// Genera un ZIP con un PDF de boletín por cada alumno del curso, Y ADEMÁS
// envía por mail ese mismo PDF a email_usuario y email_familiar de cada alumno.
//
// El envío de mails ocurre en paralelo a la construcción del ZIP: por cada
// alumno se genera el PDF una sola vez (en memoria) y ese mismo buffer se usa
// tanto para el ZIP como para los 2 adjuntos de mail.
//
// Query param opcional: ?enviarMails=false para generar solo el ZIP sin mandar
// mails (por defecto enviarMails=true).

router.get("/generar/:cursoId", authMiddleware, async (req, res) => {
  const { cursoId } = req.params;
  const { rango } = req.user;
  const enviarMails = req.query.enviarMails !== "false";

  if (rango !== "secretario" && rango !== "regente") {
    return res.status(403).json({ success: false, error: "Sin permisos para esta acción" });
  }
  if (!idEnteroValido(cursoId)) {
    return res.status(400).json({ success: false, error: "ID de curso inválido" });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    const cursoRows = await conn.query(
      "SELECT id, anio, division, turno FROM cursos WHERE id = ?",
      [cursoId]
    );
    if (!cursoRows || cursoRows.length === 0) {
      return res.status(404).json({ success: false, error: "Curso no encontrado" });
    }
    const curso = cursoRows[0];

    // Alumnos del curso, incluyendo sus 2 emails
    const alumnos = await conn.query(`
      SELECT u.id, u.nombre, u.apellido, u.dni, u.email_usuario, u.email_familiar
      FROM alumno_curso ac
      JOIN usuarios u ON ac.alumno_id = u.id
      WHERE ac.curso_id = ? AND u.rango = 'alumno'
      ORDER BY u.apellido, u.nombre
    `, [cursoId]);

    if (!alumnos || alumnos.length === 0) {
      return res.status(404).json({ success: false, error: "El curso no tiene alumnos inscriptos" });
    }

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
    const nombreZip = normalizarNombreArchivo(`Boletines_${curso.anio}${curso.division}.zip`);
    res.setHeader("Content-Disposition", `attachment; filename="${nombreZip}"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      console.error("Error en archiver:", err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: "Error al generar el ZIP" });
      }
    });
    archive.pipe(res);

    // Registro de resultados de envío de mail, para loguear al final
    const resultadosMail = [];

    // ── Generar un PDF por alumno (y enviar mails si corresponde) ──
    for (const alumno of alumnos) {
      // Evaluaciones de ESTE alumno en TODAS las materias (para detectar período)
      const evalsDeEsteAlumno = evaluacionesTodas.filter(
        e => Number(e.alumno_id) === Number(alumno.id)
      );

      const materiasConResumen = materiasCurso.map(mc => {
        const evalsAlumnoMateria = evalsDeEsteAlumno.filter(
          e => Number(e.curso_materia_id) === Number(mc.curso_materia_id)
        );
        return {
          nombre: mc.materia,
          resumen: calcularResumenMateria(evalsAlumnoMateria)
        };
      });

      // Período más avanzado mirando TODAS las materias del alumno juntas
      const periodo = detectarPeriodoMasAvanzado(evalsDeEsteAlumno);

      const passthrough = new PassThrough();
      const chunks = [];
      passthrough.on("data", (chunk) => chunks.push(chunk));

      await generarBoletinPDF(alumno, curso, materiasConResumen, passthrough);
      const pdfBuffer = Buffer.concat(chunks);

      const nombreArchivo = normalizarNombreArchivo(
        `Boletin_${alumno.apellido}_${alumno.nombre}.pdf`
      );

      // Agregar al ZIP (siempre, independientemente del resultado de los mails)
      archive.append(pdfBuffer, { name: nombreArchivo });

      // ── Enviar los 2 mails (usuario + familiar) ──
      if (enviarMails) {
        const asunto = `Se envia informe: ${periodo}`;
        const nombreCompleto = `${alumno.nombre} ${alumno.apellido}`;

        const [resUsuario, resFamiliar] = await Promise.all([
          enviarBoletinPorMail(alumno.email_usuario, asunto, nombreCompleto, pdfBuffer, nombreArchivo),
          enviarBoletinPorMail(alumno.email_familiar, asunto, nombreCompleto, pdfBuffer, nombreArchivo),
        ]);

        resultadosMail.push({
          alumno: nombreCompleto,
          email_usuario: { destinatario: alumno.email_usuario, ...resUsuario },
          email_familiar: { destinatario: alumno.email_familiar, ...resFamiliar },
        });
      }
    }

    await archive.finalize();

    // Log de resultados de mail en el servidor (no se puede mandar en la respuesta
    // porque el response ya se usó para el stream del ZIP)
    if (enviarMails) {
      const fallidos = resultadosMail.filter(
        r => !r.email_usuario.ok || !r.email_familiar.ok
      );
      if (fallidos.length > 0) {
        console.warn("Boletines con error de envío de mail:", JSON.stringify(fallidos, null, 2));
      } else {
        console.log(`Boletines del curso ${curso.anio}${curso.division}: ${resultadosMail.length} alumnos, mails enviados correctamente.`);
      }
    }

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