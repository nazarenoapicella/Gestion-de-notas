const express        = require("express");
const router         = express.Router();
const pool           = require("../db/connection");
const authMiddleware = require("../middleware/auth");

// ─── Helpers de acceso ────────────────────────────────────────────────────────

async function verificarAcceso(conn, cursoMateriaId, user, requiereEscritura = false) {
  const { id, rango, permiso } = user;

  if (rango === "regente") {
    if (requiereEscritura && permiso === "lectura") {
      return { ok: false, status: 403, error: "Sin permisos de escritura" };
    }
    return { ok: true };
  }

  if (rango === "profesor") {
    if (requiereEscritura && permiso === "lectura") {
      return { ok: false, status: 403, error: "Sin permisos de escritura" };
    }
    const pm = await conn.query(
      "SELECT id FROM profesor_materia WHERE profesor_id = ? AND curso_materia_id = ?",
      [id, cursoMateriaId]
    );
    if (!pm || pm.length === 0) {
      return { ok: false, status: 403, error: "No tenés asignada esta materia" };
    }
    return { ok: true };
  }

  if (rango === "preceptor") {
    if (requiereEscritura) {
      return { ok: false, status: 403, error: "Sin permisos de escritura" };
    }
    const pc = await conn.query(`
      SELECT pc.id
      FROM preceptor_curso pc
      JOIN curso_materia cm ON cm.curso_id = pc.curso_id
      WHERE pc.preceptor_id = ? AND cm.id = ?
    `, [id, cursoMateriaId]);
    if (!pc || pc.length === 0) {
      return { ok: false, status: 403, error: "No tenés asignado este curso" };
    }
    return { ok: true };
  }

  if (rango === "alumno") {
    if (requiereEscritura) {
      return { ok: false, status: 403, error: "Sin permisos" };
    }
    const ac = await conn.query(`
      SELECT ac.id
      FROM alumno_curso ac
      JOIN curso_materia cm ON ac.curso_id = cm.curso_id
      WHERE ac.alumno_id = ? AND cm.id = ?
    `, [id, cursoMateriaId]);
    if (!ac || ac.length === 0) {
      return { ok: false, status: 403, error: "No estás inscripto en este curso" };
    }
    return { ok: true };
  }

  return { ok: false, status: 403, error: "Rango no reconocido" };
}

async function alumnosEnCurso(conn, alumnoIds, cursoMateriaId) {
  if (!alumnoIds || alumnoIds.length === 0) return { ok: true, faltante: null };
  const rows = await conn.query(`
    SELECT DISTINCT ac.alumno_id
    FROM alumno_curso ac
    JOIN curso_materia cm ON ac.curso_id = cm.curso_id
    WHERE ac.alumno_id IN (?) AND cm.id = ?
  `, [alumnoIds, cursoMateriaId]);
  const inscritosSet = new Set(rows.map(r => Number(r.alumno_id)));
  for (const aid of alumnoIds) {
    if (!inscritosSet.has(Number(aid))) {
      return { ok: false, faltante: aid };
    }
  }
  return { ok: true, faltante: null };
}

async function alumnoEnCurso(conn, alumnoId, cursoMateriaId) {
  const rows = await conn.query(`
    SELECT ac.id
    FROM alumno_curso ac
    JOIN curso_materia cm ON ac.curso_id = cm.curso_id
    WHERE ac.alumno_id = ? AND cm.id = ?
  `, [alumnoId, cursoMateriaId]);
  return rows && rows.length > 0;
}

function notaValida(nota) {
  const n = Number(nota);
  return !isNaN(n) && isFinite(n) && n >= -1 && n <= 10;
}

function bimestreValido(b) {
  return [1, 2, 3, 4].includes(Number(b));
}

function cierreValido(c) {
  return [1, 2].includes(Number(c));
}

function idEnteroValido(val) {
  const n = parseInt(val, 10);
  return !isNaN(n) && n > 0;
}

async function validarEvaluacionOrigen(conn, evaluacionOrigenId, cursoMateriaId) {
  if (!evaluacionOrigenId) return { ok: true };
  const rows = await conn.query(
    "SELECT id FROM evaluaciones WHERE id = ? AND curso_materia_id = ?",
    [evaluacionOrigenId, cursoMateriaId]
  );
  if (!rows || rows.length === 0) {
    return { ok: false, error: "La evaluación de origen no pertenece a este curso" };
  }
  return { ok: true };
}

// ─── GET planilla ─────────────────────────────────────────────────────────────

router.get("/:cursoMateriaId/:usuarioId", authMiddleware, async (req, res) => {
  const { cursoMateriaId } = req.params;
  const user = req.user;

  if (!idEnteroValido(cursoMateriaId)) {
    return res.status(400).json({ success: false, error: "ID de materia inválido" });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    const acceso = await verificarAcceso(conn, cursoMateriaId, user, false);
    if (!acceso.ok) {
      return res.status(acceso.status).json({ success: false, error: acceso.error });
    }

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

    if (!materia || materia.length === 0) {
      return res.status(404).json({ success: false, error: "Materia no encontrada" });
    }

    let alumnos, evaluaciones;

    if (user.rango === "alumno") {
      alumnos = await conn.query(
        "SELECT id, nombre, apellido FROM usuarios WHERE id = ?",
        [user.id]
      );
      evaluaciones = await conn.query(`
        SELECT
          e.id, e.tipo, e.descripcion, e.fecha, e.bimestre, e.cierre,
          e.es_acumulativo, e.evaluacion_origen_id,
          n.alumno_id, n.nota
        FROM evaluaciones e
        INNER JOIN notas n ON e.id = n.evaluacion_id
        WHERE e.curso_materia_id = ? AND n.alumno_id = ?
        ORDER BY e.bimestre, e.cierre, e.id
      `, [cursoMateriaId, user.id]);
    } else {
      alumnos = await conn.query(`
        SELECT DISTINCT u.id, u.nombre, u.apellido
        FROM curso_materia cm
        INNER JOIN cursos c        ON cm.curso_id  = c.id
        INNER JOIN alumno_curso ac ON c.id         = ac.curso_id
        INNER JOIN usuarios u      ON ac.alumno_id = u.id
        WHERE cm.id = ? AND u.rango = 'alumno'
        ORDER BY u.apellido, u.nombre
      `, [cursoMateriaId]);
      evaluaciones = await conn.query(`
        SELECT
          e.id, e.tipo, e.descripcion, e.fecha, e.bimestre, e.cierre,
          e.es_acumulativo, e.evaluacion_origen_id,
          n.alumno_id, n.nota
        FROM evaluaciones e
        INNER JOIN notas n ON e.id = n.evaluacion_id
        WHERE e.curso_materia_id = ?
        ORDER BY e.bimestre, e.cierre, e.id
      `, [cursoMateriaId]);
    }

    res.json({
      success: true,
      user:    { id: user.id, permiso: user.permiso, rango: user.rango },
      materia: materia[0],
      alumnos,
      notas:   evaluaciones
    });

  } catch (err) {
    console.error("Error al cargar planilla:", err);
    res.status(500).json({ success: false, error: "Error al cargar planilla" });
  } finally {
    if (conn) conn.release();
  }
});

// ─── POST evaluacion-global ───────────────────────────────────────────────────

router.post("/evaluacion-global", authMiddleware, async (req, res) => {
  const {
    cursoMateriaId, tipo, descripcion, bimestre, notas,
    esAcumulativo, evaluacionOrigenId
  } = req.body;
  const user = req.user;

  if (!idEnteroValido(cursoMateriaId) || !descripcion || !bimestre || !Array.isArray(notas) || notas.length === 0) {
    return res.status(400).json({ success: false, error: "Datos incompletos" });
  }
  if (!bimestreValido(bimestre)) {
    return res.status(400).json({ success: false, error: "Bimestre inválido (valores: 1, 2, 3 o 4)" });
  }
  if (String(descripcion).trim().length === 0) {
    return res.status(400).json({ success: false, error: "La descripción no puede estar vacía" });
  }
  if (String(descripcion).length > 500) {
    return res.status(400).json({ success: false, error: "La descripción supera los 500 caracteres" });
  }
  if (tipo && String(tipo).length > 100) {
    return res.status(400).json({ success: false, error: "El tipo supera los 100 caracteres" });
  }
  if (esAcumulativo && !idEnteroValido(evaluacionOrigenId)) {
    return res.status(400).json({ success: false, error: "Debe indicar la evaluación de origen para una acumulativa" });
  }
  for (const n of notas) {
    if (!idEnteroValido(n.alumnoId)) {
      return res.status(400).json({ success: false, error: `alumnoId inválido: ${n.alumnoId}` });
    }
    if (!notaValida(n.nota)) {
      return res.status(400).json({ success: false, error: `Nota inválida para el alumno ${n.alumnoId} (rango: -1 a 10)` });
    }
  }

  let conn;
  try {
    conn = await pool.getConnection();

    const acceso = await verificarAcceso(conn, cursoMateriaId, user, true);
    if (!acceso.ok) {
      return res.status(acceso.status).json({ success: false, error: acceso.error });
    }

    await conn.beginTransaction();

    const alumnoIds = notas.map(n => n.alumnoId);
    const check = await alumnosEnCurso(conn, alumnoIds, cursoMateriaId);
    if (!check.ok) {
      await conn.rollback();
      return res.status(400).json({ success: false, error: `El alumno ${check.faltante} no está inscripto en este curso` });
    }

    if (esAcumulativo) {
      const origenCheck = await validarEvaluacionOrigen(conn, evaluacionOrigenId, cursoMateriaId);
      if (!origenCheck.ok) {
        await conn.rollback();
        return res.status(400).json({ success: false, error: origenCheck.error });
      }
    }

    const result = await conn.query(`
      INSERT INTO evaluaciones
        (curso_materia_id, tipo, descripcion, fecha, bimestre, es_acumulativo, evaluacion_origen_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      cursoMateriaId,
      tipo ? String(tipo).substring(0, 100) : null,
      String(descripcion).substring(0, 500),
      new Date(),
      bimestre,
      esAcumulativo ? 1 : 0,
      esAcumulativo ? Number(evaluacionOrigenId) : null
    ]);

    const evaluacionId = Number(result.insertId);

    await conn.batch(
      "INSERT INTO notas (evaluacion_id, alumno_id, nota) VALUES (?, ?, ?)",
      notas.map(n => [evaluacionId, n.alumnoId, Number(n.nota)])
    );

    await conn.commit();
    res.json({ success: true });

  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    console.error("Error al crear evaluación global:", err);
    res.status(500).json({ success: false, error: "Error al crear evaluacion global" });
  } finally {
    if (conn) conn.release();
  }
});

// ─── POST cierre-global ───────────────────────────────────────────────────────
// Carga un tema del cierre (diciembre o febrero) para todos los alumnos a la vez.
// Un cierre puede tener múltiples temas. Cada llamada agrega un tema nuevo.
// La nota del cierre se calcula en el frontend promediando todos los temas.

router.post("/cierre-global", authMiddleware, async (req, res) => {
  const { cursoMateriaId, numeroCierre, descripcion, notas } = req.body;
  const user = req.user;

  // Validaciones
  if (!idEnteroValido(cursoMateriaId)) {
    return res.status(400).json({ success: false, error: "cursoMateriaId inválido" });
  }
  if (!cierreValido(numeroCierre)) {
    return res.status(400).json({ success: false, error: "numeroCierre inválido (1 = Diciembre, 2 = Febrero)" });
  }
  if (!descripcion || String(descripcion).trim().length === 0) {
    return res.status(400).json({ success: false, error: "La descripción no puede estar vacía" });
  }
  if (String(descripcion).length > 500) {
    return res.status(400).json({ success: false, error: "La descripción supera los 500 caracteres" });
  }
  if (!Array.isArray(notas) || notas.length === 0) {
    return res.status(400).json({ success: false, error: "Debe haber al menos una nota" });
  }
  for (const n of notas) {
    if (!idEnteroValido(n.alumnoId)) {
      return res.status(400).json({ success: false, error: `alumnoId inválido: ${n.alumnoId}` });
    }
    // En cierre las notas van de 1 a 10 (sin negativos)
    const nota = Number(n.nota);
    if (isNaN(nota) || nota < 1 || nota > 10) {
      return res.status(400).json({ success: false, error: `Nota inválida para el alumno ${n.alumnoId} (rango: 1 a 10)` });
    }
  }

  let conn;
  try {
    conn = await pool.getConnection();

    const acceso = await verificarAcceso(conn, cursoMateriaId, user, true);
    if (!acceso.ok) {
      return res.status(acceso.status).json({ success: false, error: acceso.error });
    }

    await conn.beginTransaction();

    const alumnoIds = notas.map(n => n.alumnoId);
    const check = await alumnosEnCurso(conn, alumnoIds, cursoMateriaId);
    if (!check.ok) {
      await conn.rollback();
      return res.status(400).json({ success: false, error: `El alumno ${check.faltante} no está inscripto en este curso` });
    }

    // Insertar la evaluación de cierre (sin bimestre, con cierre=numeroCierre)
    const result = await conn.query(`
      INSERT INTO evaluaciones
        (curso_materia_id, tipo, descripcion, fecha, bimestre, cierre, es_acumulativo, evaluacion_origen_id)
      VALUES (?, ?, ?, ?, NULL, ?, 0, NULL)
    `, [
      cursoMateriaId,
      numeroCierre === 1 ? "Cierre Diciembre" : "Cierre Febrero",
      String(descripcion).trim().substring(0, 500),
      new Date(),
      Number(numeroCierre)
    ]);

    const evaluacionId = Number(result.insertId);

    await conn.batch(
      "INSERT INTO notas (evaluacion_id, alumno_id, nota) VALUES (?, ?, ?)",
      notas.map(n => [evaluacionId, n.alumnoId, Number(n.nota)])
    );

    await conn.commit();
    res.json({ success: true });

  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    console.error("Error al cargar cierre global:", err);
    res.status(500).json({ success: false, error: "Error al cargar cierre global" });
  } finally {
    if (conn) conn.release();
  }
});

// ─── POST evaluacion (individual — solo para compatibilidad) ──────────────────

router.post("/evaluacion", authMiddleware, async (req, res) => {
  const {
    alumnoId, cursoMateriaId, tipo, descripcion,
    nota, bimestre, cierre,
    esAcumulativo, evaluacionOrigenId
  } = req.body;
  const user = req.user;

  if (!idEnteroValido(alumnoId) || !idEnteroValido(cursoMateriaId)) {
    return res.status(400).json({ success: false, error: "Datos incompletos o inválidos" });
  }
  if (!notaValida(nota)) {
    return res.status(400).json({ success: false, error: "Nota inválida (rango: -1 a 10)" });
  }
  if (bimestre && !bimestreValido(bimestre)) {
    return res.status(400).json({ success: false, error: "Bimestre inválido (valores: 1, 2, 3 o 4)" });
  }
  if (cierre && !cierreValido(cierre)) {
    return res.status(400).json({ success: false, error: "Cierre inválido (valores: 1 o 2)" });
  }
  if (tipo        && String(tipo).length        > 100) {
    return res.status(400).json({ success: false, error: "El tipo supera los 100 caracteres" });
  }
  if (descripcion && String(descripcion).length > 500) {
    return res.status(400).json({ success: false, error: "La descripción supera los 500 caracteres" });
  }
  if (esAcumulativo && !idEnteroValido(evaluacionOrigenId)) {
    return res.status(400).json({ success: false, error: "Debe indicar la evaluación de origen para una acumulativa" });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    const acceso = await verificarAcceso(conn, cursoMateriaId, user, true);
    if (!acceso.ok) {
      return res.status(acceso.status).json({ success: false, error: acceso.error });
    }

    await conn.beginTransaction();

    if (!(await alumnoEnCurso(conn, alumnoId, cursoMateriaId))) {
      await conn.rollback();
      return res.status(400).json({ success: false, error: "El alumno no está inscripto en este curso" });
    }

    if (esAcumulativo) {
      const origenCheck = await validarEvaluacionOrigen(conn, evaluacionOrigenId, cursoMateriaId);
      if (!origenCheck.ok) {
        await conn.rollback();
        return res.status(400).json({ success: false, error: origenCheck.error });
      }
    }

    const result = await conn.query(`
      INSERT INTO evaluaciones
        (curso_materia_id, tipo, descripcion, fecha, bimestre, cierre, es_acumulativo, evaluacion_origen_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      cursoMateriaId,
      tipo        ? String(tipo).substring(0, 100)        : null,
      descripcion ? String(descripcion).substring(0, 500) : null,
      new Date(),
      bimestre            || null,
      cierre              || null,
      esAcumulativo ? 1   : 0,
      esAcumulativo ? Number(evaluacionOrigenId) : null
    ]);

    const evaluacionId = Number(result.insertId);

    await conn.query(
      "INSERT INTO notas (evaluacion_id, alumno_id, nota) VALUES (?, ?, ?)",
      [evaluacionId, alumnoId, Number(nota)]
    );

    await conn.commit();
    res.json({ success: true });

  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    console.error("Error al guardar evaluación:", err);
    res.status(500).json({ success: false, error: "Error al guardar evaluación" });
  } finally {
    if (conn) conn.release();
  }
});

// ─── DELETE evaluacion/:id ────────────────────────────────────────────────────

router.delete("/evaluacion/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { alumnoId, cursoMateriaId } = req.body;
  const user = req.user;

  if (!idEnteroValido(id) || !idEnteroValido(alumnoId) || !idEnteroValido(cursoMateriaId)) {
    return res.status(400).json({ success: false, error: "Datos incompletos o inválidos" });
  }

  let conn;
  try {
    conn = await pool.getConnection();

    const acceso = await verificarAcceso(conn, cursoMateriaId, user, true);
    if (!acceso.ok) {
      return res.status(acceso.status).json({ success: false, error: acceso.error });
    }

    const evalCheck = await conn.query(
      "SELECT id FROM evaluaciones WHERE id = ? AND curso_materia_id = ?",
      [id, cursoMateriaId]
    );
    if (!evalCheck || evalCheck.length === 0) {
      return res.status(404).json({ success: false, error: "Evaluación no encontrada en este curso" });
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
    if (conn) { try { await conn.rollback(); } catch (_) {} }
    console.error("Error al eliminar evaluación:", err);
    res.status(500).json({ success: false, error: "Error al eliminar evaluación" });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;