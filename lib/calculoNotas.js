// ─── lib/calculoNotas.js ───────────────────────────────────────────────────────
// Lógica de cálculo de promedios, replicada desde scriptPlanilla.js (frontend)
// para poder generar el boletín en el servidor con PDFKit.
// IMPORTANTE: esta lógica debe mantenerse en sincronía con scriptPlanilla.js
// si en el futuro se modifican las reglas de negocio de promedios.

function esParticipacion(tipo) {
  return (tipo || "").toLowerCase().includes("particip");
}

function esCierre(ev) {
  const c = Number(ev.cierre);
  return c === 1 || c === 2;
}

function esImportadoExcel(ev) {
  return String(ev.descripcion || "").trim() === "Importado desde Excel";
}

function esOverrideImport(ev, campo) {
  return String(ev.descripcion || "").trim() === `Import override:${campo}`;
}

function ultimaNota(lista) {
  if (!lista || lista.length === 0) return null;
  const last = lista.reduce((a, b) => Number(a.id) > Number(b.id) ? a : b);
  return Number(last.nota);
}

function notaImportadaBimestre(evaluacionesAlumno, num) {
  return ultimaNota(evaluacionesAlumno.filter(e =>
    esImportadoExcel(e) && Number(e.bimestre) === Number(num) && !esCierre(e)
  ));
}

function notaOverrideCampo(evaluacionesAlumno, campo) {
  return ultimaNota(evaluacionesAlumno.filter(e => esOverrideImport(e, campo)));
}

function formatearNotaNum(n) {
  return Number(n).toFixed(2);
}

// ─── Saldadas ──────────────────────────────────────────────────────────────────

function calcularSaldadas(evaluacionesAlumno) {
  const saldadas  = new Set();
  const notaPorId = new Map();

  for (const ev of evaluacionesAlumno) {
    notaPorId.set(Number(ev.id), Number(ev.nota));
  }
  for (const ev of evaluacionesAlumno) {
    if (Number(ev.es_acumulativo) === 1 && ev.evaluacion_origen_id != null) {
      if (Number(ev.nota) >= 6) {
        const origenId   = Number(ev.evaluacion_origen_id);
        const notaOrigen = notaPorId.get(origenId);
        if (notaOrigen !== undefined && notaOrigen < 6) {
          saldadas.add(origenId);
        }
      }
    }
  }

  // Un valor importado ≥ 6 en el bimestre salda las evaluaciones desaprobadas de ese período
  for (const num of [1, 2, 3, 4]) {
    const imp = notaImportadaBimestre(evaluacionesAlumno, num);
    if (imp === null || imp < 6) continue;
    for (const ev of evaluacionesAlumno) {
      if (esImportadoExcel(ev)) continue;
      if (esCierre(ev) || esParticipacion(ev.tipo)) continue;
      if (Number(ev.bimestre) !== num) continue;
      if (Number(ev.nota) < 6) saldadas.add(Number(ev.id));
    }
  }

  return saldadas;
}

// ─── Bimestre visual ───────────────────────────────────────────────────────────

function calcularBimestre(evaluacionesAlumno, num) {
  const importada = notaImportadaBimestre(evaluacionesAlumno, num);
  if (importada !== null) return formatearNotaNum(importada);

  const evaluaciones = evaluacionesAlumno.filter(
    e => Number(e.bimestre) === Number(num) && !esCierre(e)
  );
  if (evaluaciones.length === 0) return "-";

  const saldadas        = calcularSaldadas(evaluacionesAlumno);
  const participaciones = evaluaciones.filter(e =>  esParticipacion(e.tipo));
  const normales        = evaluaciones.filter(e => !esParticipacion(e.tipo));

  for (const saldada of normales.filter(e => saldadas.has(Number(e.id)))) {
    const acumulativa = evaluacionesAlumno.find(
      e =>
        Number(e.es_acumulativo) === 1 &&
        Number(e.evaluacion_origen_id) === Number(saldada.id) &&
        Number(e.nota) >= 6
    );
    if (acumulativa && Number(acumulativa.bimestre) !== Number(num)) {
      return "DESAPROBADO";
    }
  }

  const paraPromedio = normales.filter(e => !saldadas.has(Number(e.id)));
  if (paraPromedio.some(e => Number(e.nota) < 6)) return "DESAPROBADO";
  if (paraPromedio.length === 0 && participaciones.length === 0) return "-";

  const promedioBase = paraPromedio.length > 0
    ? paraPromedio.reduce((s, e) => s + Number(e.nota), 0) / paraPromedio.length
    : 0;
  const ajuste = participaciones.reduce((s, e) => s + Number(e.nota), 0);
  return (promedioBase + ajuste).toFixed(2);
}

// ─── Bimestre efectivo (para cuatrimestre) ────────────────────────────────────

function calcularBimestreEfectivo(evaluacionesAlumno, num) {
  const importada = notaImportadaBimestre(evaluacionesAlumno, num);
  if (importada !== null) return formatearNotaNum(importada);

  const evaluaciones = evaluacionesAlumno.filter(
    e => Number(e.bimestre) === Number(num) && !esCierre(e)
  );
  if (evaluaciones.length === 0) return "-";

  const saldadas        = calcularSaldadas(evaluacionesAlumno);
  const participaciones = evaluaciones.filter(e =>  esParticipacion(e.tipo));
  const normales        = evaluaciones.filter(e => !esParticipacion(e.tipo));
  const paraPromedio    = normales.filter(e => !saldadas.has(Number(e.id)));

  if (paraPromedio.some(e => Number(e.nota) < 6)) return "DESAPROBADO";
  if (paraPromedio.length === 0 && participaciones.length === 0) return "-";

  const promedioBase = paraPromedio.length > 0
    ? paraPromedio.reduce((s, e) => s + Number(e.nota), 0) / paraPromedio.length
    : 0;
  const ajuste = participaciones.reduce((s, e) => s + Number(e.nota), 0);
  return (promedioBase + ajuste).toFixed(2);
}

function calcularCuatrimestre(evaluacionesAlumno, b1, b2) {
  const campo = Number(b1) === 1 ? "cq1" : "cq2";
  const override = notaOverrideCampo(evaluacionesAlumno, campo);
  if (override !== null) return formatearNotaNum(override);

  const ef1 = calcularBimestreEfectivo(evaluacionesAlumno, b1);
  const ef2 = calcularBimestreEfectivo(evaluacionesAlumno, b2);
  if (ef1 === "DESAPROBADO" || ef2 === "DESAPROBADO") return "DESAPROBADO";
  const nums = [ef1, ef2].filter(n => n !== "-").map(Number);
  if (nums.length === 0) return "-";
  return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
}

function necesitaCierres(cuat1, cuat2) {
  if (cuat1 === "DESAPROBADO" || cuat2 === "DESAPROBADO") return true;
  const nums = [cuat1, cuat2].filter(n => n !== "-").map(Number);
  if (nums.length === 0) return false;
  return nums.reduce((a, b) => a + b, 0) / nums.length < 6;
}

// ─── Estado de cierres ─────────────────────────────────────────────────────────

function estadoCierre1(evaluacionesAlumno) {
  const temas = evaluacionesAlumno.filter(e => Number(e.cierre) === 1);
  if (temas.length === 0) return null;
  const desaprobados = temas.filter(e => Number(e.nota) < 6);
  const prom = temas.reduce((s, e) => s + Number(e.nota), 0) / temas.length;
  return {
    temas,
    aprobado: desaprobados.length === 0,
    promedio: parseFloat(prom.toFixed(2)),
    desaprobados
  };
}

function estadoCierre2(evaluacionesAlumno) {
  const temas = evaluacionesAlumno.filter(e => Number(e.cierre) === 2);
  if (temas.length === 0) return null;
  const desaprobados = temas.filter(e => Number(e.nota) < 6);
  const prom = temas.reduce((s, e) => s + Number(e.nota), 0) / temas.length;
  return {
    temas,
    aprobado: desaprobados.length === 0,
    promedio: parseFloat(prom.toFixed(2)),
    desaprobados
  };
}

/**
 * Calcula el resumen completo de una materia para un alumno:
 * bimestres, cuatrimestres, cierres y nota final.
 * Esta es la función principal que usa el generador de boletines.
 */
function calcularResumenMateria(evaluacionesAlumno) {
  const prom1 = calcularBimestre(evaluacionesAlumno, 1);
  const prom2 = calcularBimestre(evaluacionesAlumno, 2);
  const prom3 = calcularBimestre(evaluacionesAlumno, 3);
  const prom4 = calcularBimestre(evaluacionesAlumno, 4);

  const cuat1 = calcularCuatrimestre(evaluacionesAlumno, 1, 2);
  const cuat2 = calcularCuatrimestre(evaluacionesAlumno, 3, 4);

  const habCierres = necesitaCierres(cuat1, cuat2);

  const ec1 = estadoCierre1(evaluacionesAlumno);
  const ec2 = estadoCierre2(evaluacionesAlumno);

  const nfOverride = notaOverrideCampo(evaluacionesAlumno, "nf");
  let final;
  if (nfOverride !== null) {
    final = formatearNotaNum(nfOverride);
  } else if (ec2) {
    final = ec2.aprobado ? ec1.promedio.toFixed(2) : "PREVIA";
  } else if (ec1) {
    // Solo dar nota final si no quedan adeudados sin evaluar en diciembre
    const evaluadosEnDic = new Set(
      evaluacionesAlumno
        .filter(e => Number(e.cierre) === 1 && e.evaluacion_origen_id != null)
        .map(e => Number(e.evaluacion_origen_id))
    );
    const saldadas = calcularSaldadas(evaluacionesAlumno);
    const adeudadosTotales = evaluacionesAlumno.filter(ev => {
      if (String(ev.descripcion || "").startsWith("Import override:")) return false;
      if (saldadas.has(Number(ev.id))) return false;
      if (Number(ev.nota) >= 6) return false;
      if ((ev.tipo || "").toLowerCase().includes("particip")) return false;
      const c = Number(ev.cierre);
      if (c === 1 || c === 2) return false; // excluir cierres
      return true;
    });
    const quedanPendientes = adeudadosTotales.some(e => !evaluadosEnDic.has(Number(e.id)));
    if (!quedanPendientes && ec1.aprobado) {
      final = ec1.promedio.toFixed(2);
    } else {
      final = "-";
    }
  } else if (!habCierres) {
    const nums = [cuat1, cuat2].filter(n => n !== "-" && n !== "DESAPROBADO").map(Number);
    final = nums.length > 0
      ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)
      : "-";
  } else {
    final = "-";
  }

  return {
    bimestre1: prom1,
    bimestre2: prom2,
    bimestre3: prom3,
    bimestre4: prom4,
    cuatrimestre1: cuat1,
    cuatrimestre2: cuat2,
    cierre1: ec1 ? ec1.promedio.toFixed(2) : "-",
    cierre1Aprobado: ec1 ? ec1.aprobado : null,
    cierre2: ec2 ? ec2.promedio.toFixed(2) : "-",
    cierre2Aprobado: ec2 ? ec2.aprobado : null,
    notaFinal: final
  };
}

module.exports = {
  calcularResumenMateria,
  calcularBimestre,
  calcularCuatrimestre,
  necesitaCierres,
  estadoCierre1,
  estadoCierre2
};