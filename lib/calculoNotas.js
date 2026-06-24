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
  return saldadas;
}

// ─── Bimestre visual ───────────────────────────────────────────────────────────

function calcularBimestre(evaluacionesAlumno, num) {
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

  let final;
  if (ec2) {
    final = ec2.aprobado ? ec1.promedio.toFixed(2) : "PREVIA";
  } else if (ec1) {
    final = ec1.aprobado ? ec1.promedio.toFixed(2) : "-";
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