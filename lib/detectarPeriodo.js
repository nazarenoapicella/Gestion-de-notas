// ─── lib/detectarPeriodo.js ─────────────────────────────────────────────────────
// Determina cuál es el período más avanzado del año en el que el alumno tiene
// notas cargadas, mirando TODAS sus materias juntas. Esto se usa para el
// asunto del mail: "Se envía informe: <período>".
//
// Orden de avance del año (de menor a mayor):
//   1er Bimestre < 2do Bimestre < 3er Bimestre < 4to Bimestre
//   < 1er Cierre (Diciembre) < 2do Cierre (Febrero)
//
// Los cuatrimestres no se usan como "período cargado" porque no son evaluaciones
// reales con nota propia — son promedios calculados. Lo que se detecta es la
// evaluación de bimestre/cierre más avanzada que tenga al menos una nota,
// mirando TODAS las materias del alumno juntas (no una por una).

const ORDEN_PERIODO = {
  1: { orden: 1, etiqueta: "1er Bimestre" },
  2: { orden: 2, etiqueta: "2do Bimestre" },
  3: { orden: 3, etiqueta: "3er Bimestre" },
  4: { orden: 4, etiqueta: "4to Bimestre" },
};

const ORDEN_CIERRE = {
  1: { orden: 5, etiqueta: "1er Cierre (Diciembre)" },
  2: { orden: 6, etiqueta: "2do Cierre (Febrero)" },
};

/**
 * Recibe TODAS las evaluaciones de TODAS las materias de un alumno
 * (cada evaluación con su campo `bimestre` y `cierre`) y determina
 * cuál es el período más avanzado con al menos una nota cargada.
 *
 * @param {Array} evaluacionesAlumno - evaluaciones de todas las materias del alumno
 * @returns {string} etiqueta del período más avanzado, o "Sin calificaciones cargadas"
 */
function detectarPeriodoMasAvanzado(evaluacionesAlumno) {
  let mejorOrden = 0;
  let mejorEtiqueta = null;

  for (const ev of evaluacionesAlumno) {
    const cierre = Number(ev.cierre);
    const bimestre = Number(ev.bimestre);

    if (cierre === 1 || cierre === 2) {
      const info = ORDEN_CIERRE[cierre];
      if (info.orden > mejorOrden) {
        mejorOrden = info.orden;
        mejorEtiqueta = info.etiqueta;
      }
    } else if (ORDEN_PERIODO[bimestre]) {
      const info = ORDEN_PERIODO[bimestre];
      if (info.orden > mejorOrden) {
        mejorOrden = info.orden;
        mejorEtiqueta = info.etiqueta;
      }
    }
  }

  return mejorEtiqueta || "Sin calificaciones cargadas";
}

module.exports = { detectarPeriodoMasAvanzado };