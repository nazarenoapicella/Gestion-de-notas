const params         = new URLSearchParams(location.search);
const cursoMateriaId = params.get("materia");
const permiso        = localStorage.getItem("permiso");
const rango          = localStorage.getItem("rango");
const tbody          = document.getElementById("tbody");

let alumnosGlobales    = [];
let evaluacionesGlobal = [];
let cierreActivo       = 1; // 1 = Diciembre, 2 = Febrero

if (!localStorage.getItem("token")) {
  location.href = "index.html";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esParticipacion(tipo) {
  return (tipo || "").toLowerCase().includes("particip");
}

function esCierre(ev) {
  return ev.cierre === 1 || ev.cierre === 2 ||
         ev.cierre === "1" || ev.cierre === "2";
}

function puedeEscribir() {
  return permiso === "escritura" || permiso === "ambos";
}

// ─── Lógica de acumulativos ───────────────────────────────────────────────────

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

// ─── Cálculo de bimestre visual ───────────────────────────────────────────────

function calcularBimestre(evaluacionesAlumno, num) {
  // Solo evaluaciones regulares (no cierres) del bimestre indicado
  const evaluaciones = evaluacionesAlumno.filter(
    e => Number(e.bimestre) === Number(num) && !esCierre(e)
  );
  if (evaluaciones.length === 0) return "-";

  const saldadas        = calcularSaldadas(evaluacionesAlumno);
  const participaciones = evaluaciones.filter(e =>  esParticipacion(e.tipo));
  const normales        = evaluaciones.filter(e => !esParticipacion(e.tipo));

  // Saldadas en este bimestre por acumulativa de OTRO bimestre → DESAPROBADO
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

// ─── Cálculo de bimestre efectivo (para cuatrimestre) ────────────────────────

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

// ─── Cálculo de nota de cierre ────────────────────────────────────────────────

/**
 * Calcula la nota de un cierre (1 = Diciembre, 2 = Febrero) para un alumno.
 * Regla:
 *   - Promedio de todos los temas del cierre.
 *   - Si promedio >= 6 → aprueba (retorna el promedio).
 *   - Si promedio < 6  → desaprueba (retorna el promedio igual, para mostrarlo).
 *   - Si no tiene temas → retorna null.
 */
function calcularNotaCierre(evaluacionesAlumno, numeroCierre) {
  const temas = evaluacionesAlumno.filter(
    e => Number(e.cierre) === Number(numeroCierre)
  );
  if (temas.length === 0) return null;
  const prom = temas.reduce((s, e) => s + Number(e.nota), 0) / temas.length;
  return parseFloat(prom.toFixed(2));
}

function necesitaCierres(cuat1, cuat2) {
  if (cuat1 === "DESAPROBADO" || cuat2 === "DESAPROBADO") return true;
  const nums = [cuat1, cuat2].filter(n => n !== "-").map(Number);
  if (nums.length === 0) return false;
  return nums.reduce((a, b) => a + b, 0) / nums.length < 6;
}

// ─── Render resumen bimestre ──────────────────────────────────────────────────

function renderResumenBimestre(promBimestre) {
  const esDesap = promBimestre === "DESAPROBADO";
  const esVacio = promBimestre === "-";
  const clase   = esDesap ? "desaprobado" : (!esVacio ? "aprobado" : "");
  return `
    <div class="bim-resumen">
      <div class="bim-resumen-label">Promedio bimestre</div>
      <div class="bim-resumen-valor ${clase}">${escHTML(promBimestre)}</div>
    </div>
  `;
}

// ─── Render resumen cierre ────────────────────────────────────────────────────

function renderResumenCierre(notaCierre) {
  if (notaCierre === null) return "";
  const aprueba = notaCierre >= 6;
  const clase   = aprueba ? "aprobado" : "desaprobado";
  return `
    <div class="cierre-resumen">
      <div class="cierre-resumen-label">Promedio cierre</div>
      <div class="cierre-resumen-valor ${clase}">${notaCierre.toFixed(2)}</div>
    </div>
  `;
}

// ─── Render de bimestre en tabla ──────────────────────────────────────────────

function renderBimestre(evaluacionesAlumno, alumno, num) {
  const evaluaciones = evaluacionesAlumno.filter(
    e => Number(e.bimestre) === Number(num) && !esCierre(e)
  );
  const saldadas = calcularSaldadas(evaluacionesAlumno);
  const promBim  = calcularBimestre(evaluacionesAlumno, num);

  let html = "";

  for (const ev of evaluaciones) {
    const esPartic    = esParticipacion(ev.tipo);
    const estaSaldada = saldadas.has(Number(ev.id));
    const esAcum      = Number(ev.es_acumulativo) === 1;
    const nota        = Number(ev.nota);

    let claseEval = "eval";
    let claseNota = "eval-nota";

    if (estaSaldada) {
      claseEval += " eval-saldada";
      claseNota += " eval-nota-gris";
    } else if (!esPartic && nota < 6) {
      claseNota += " eval-nota-roja";
    }

    const badgeAcum = esAcum ? `<span class="eval-acum-badge">Acumulativa</span><br>` : "";

    html += `
      <div class="${claseEval}">
        <div class="eval-top">
          <span class="eval-tipo">${esPartic ? "Valoración" : escHTML(ev.tipo || "Evaluación")}</span>
          <span class="${claseNota}">${escHTML(ev.nota)}</span>
        </div>
        ${badgeAcum}
        <div class="eval-desc">${escHTML(ev.descripcion)}</div>
        ${puedeEscribir()
          ? `<button onclick="eliminarEvaluacion(${Number(ev.id)}, ${Number(alumno.id)})">Eliminar</button>`
          : ""}
      </div>
    `;
  }

  html += renderResumenBimestre(promBim);
  return html;
}

// ─── Render de celda de cierre ────────────────────────────────────────────────

function renderCeldaCierre(evaluacionesAlumno, alumno, numeroCierre, habilitado) {
  if (!habilitado) return `<td class="prom" style="color:#aaa;">-</td>`;

  const temas      = evaluacionesAlumno.filter(e => Number(e.cierre) === numeroCierre);
  const notaCierre = calcularNotaCierre(evaluacionesAlumno, numeroCierre);

  let html = "";

  for (const ev of temas) {
    const nota      = Number(ev.nota);
    const claseNota = nota >= 6 ? "eval-nota" : "eval-nota eval-nota-roja";
    html += `
      <div class="eval">
        <div class="eval-top">
          <span class="eval-tipo">${escHTML(ev.descripcion || ev.tipo || "Tema")}</span>
          <span class="${claseNota}">${escHTML(ev.nota)}</span>
        </div>
        <span class="eval-cierre-badge">${numeroCierre === 1 ? "Diciembre" : "Febrero"}</span>
        ${puedeEscribir()
          ? `<button onclick="eliminarEvaluacion(${Number(ev.id)}, ${Number(alumno.id)})">Eliminar</button>`
          : ""}
      </div>
    `;
  }

  html += renderResumenCierre(notaCierre);

  return `<td class="prom">${html}</td>`;
}

// ─── Carga principal ──────────────────────────────────────────────────────────

async function cargar() {
  try {
    const res = await apiFetch(`/planilla/${cursoMateriaId}/${localStorage.getItem("id")}`);
    if (!res) return;
    if (!res.ok) { alert("Error al cargar la planilla."); return; }

    const data = await res.json();

    document.getElementById("materiaTitulo").textContent = data.materia.materia;
    document.getElementById("materiaInfo").textContent   =
      `${data.materia.anio}° ${data.materia.division} • ${data.materia.dias} • ${data.materia.horario}`;

    tbody.innerHTML    = "";
    alumnosGlobales    = data.alumnos;
    evaluacionesGlobal = data.notas;

    if (puedeEscribir()) {
      document.getElementById("globalForm").style.display  = "block";
      document.getElementById("cierreForm").style.display  = "block";
      renderGlobales();
      renderCierreAlumnos();
    } else {
      document.getElementById("globalForm").style.display  = "none";
      document.getElementById("cierreForm").style.display  = "none";
    }

    for (const alumno of data.alumnos) {
      const evAlumno = data.notas.filter(n => n.alumno_id == alumno.id);

      const prom1 = calcularBimestre(evAlumno, 1);
      const prom2 = calcularBimestre(evAlumno, 2);
      const prom3 = calcularBimestre(evAlumno, 3);
      const prom4 = calcularBimestre(evAlumno, 4);

      const cuat1 = calcularCuatrimestre(evAlumno, 1, 2);
      const cuat2 = calcularCuatrimestre(evAlumno, 3, 4);

      const habilitarCierres = necesitaCierres(cuat1, cuat2);

      const notaDic = calcularNotaCierre(evAlumno, 1);
      const notaFeb = calcularNotaCierre(evAlumno, 2);

      // ── Nota final ──
      let final;
      let claseNotaFinal = "prom";

      if (notaFeb !== null) {
        final = notaFeb >= 6 ? notaFeb.toFixed(2) : "PREVIA";
      } else if (notaDic !== null) {
        // Tiene temas de diciembre pero no de febrero
        if (notaDic >= 6) {
          final = notaDic.toFixed(2); // aprobó diciembre
        } else {
          final = "-"; // desaprobó diciembre, espera febrero
        }
      } else if (!habilitarCierres) {
        const nums = [cuat1, cuat2].filter(n => n !== "-" && n !== "DESAPROBADO").map(Number);
        final = nums.length > 0
          ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)
          : "-";
      } else {
        final = "-"; // necesita cierres pero no los tiene aún
      }

      if (final === "PREVIA") claseNotaFinal += " nota-previa";

      const estiloCuat1 = cuat1 === "DESAPROBADO" ? ' style="color:#c00;font-weight:bold;"' : "";
      const estiloCuat2 = cuat2 === "DESAPROBADO" ? ' style="color:#c00;font-weight:bold;"' : "";

      // Cierre habilitado solo si lo necesita
      // Febrero habilitado solo si ya tiene temas en diciembre y desaprobó
      const habFeb = habilitarCierres && notaDic !== null && notaDic < 6;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escHTML(alumno.apellido)}, ${escHTML(alumno.nombre)}</td>
        <td>${renderBimestre(evAlumno, alumno, 1)}</td>
        <td>${renderBimestre(evAlumno, alumno, 2)}</td>
        <td class="prom"${estiloCuat1}>${escHTML(cuat1)}</td>
        <td>${renderBimestre(evAlumno, alumno, 3)}</td>
        <td>${renderBimestre(evAlumno, alumno, 4)}</td>
        <td class="prom"${estiloCuat2}>${escHTML(cuat2)}</td>
        ${renderCeldaCierre(evAlumno, alumno, 1, habilitarCierres)}
        ${renderCeldaCierre(evAlumno, alumno, 2, habFeb)}
        <td class="${claseNotaFinal}">${escHTML(final)}</td>
      `;

      tbody.appendChild(row);
    }

  } catch (err) {
    console.error("Error al cargar planilla:", err);
    alert("Error de conexión al cargar la planilla.");
  }
}

// ─── Eliminar evaluación ──────────────────────────────────────────────────────

async function eliminarEvaluacion(evaluacionId, alumnoId) {
  if (!puedeEscribir()) return;
  try {
    const res = await apiFetch("/planilla/evaluacion/" + evaluacionId, {
      method: "DELETE",
      body: JSON.stringify({ alumnoId, cursoMateriaId })
    });
    if (!res) return;
    if (!res.ok) { const err = await res.json(); alert(err.error || "Error al eliminar."); return; }
    cargar();
  } catch (err) {
    console.error("Error al eliminar evaluación:", err);
    alert("Error de conexión al eliminar.");
  }
}

// ─── Render formulario evaluaciones regulares ─────────────────────────────────

function renderGlobales() {
  const contenedor = document.getElementById("globalAlumnos");
  contenedor.innerHTML = "";
  for (const alumno of alumnosGlobales) {
    const div   = document.createElement("div");
    div.classList.add("alumno-global");
    const span  = document.createElement("span");
    span.textContent = `${alumno.apellido}, ${alumno.nombre}`;
    const input = document.createElement("input");
    input.type = "number"; input.min = "1"; input.max = "10";
    input.step = "0.01"; input.placeholder = "Nota";
    input.id = `nota-${alumno.id}`;
    div.appendChild(span);
    div.appendChild(input);
    contenedor.appendChild(div);
  }
  actualizarInputsNota();
}

function actualizarInputsNota() {
  const tipo     = document.getElementById("globalTipo").value;
  const esPartic = esParticipacion(tipo);
  for (const alumno of alumnosGlobales) {
    const input = document.getElementById(`nota-${alumno.id}`);
    if (!input) continue;
    if (esPartic) {
      input.min = "0"; input.max = "1"; input.step = "1"; input.placeholder = "0 o 1";
      if (input.value !== "" && input.value !== "0" && input.value !== "1") input.value = "";
    } else {
      input.min = "1"; input.max = "10"; input.step = "0.01"; input.placeholder = "Nota";
      if (input.value === "0" || input.value === "1") input.value = "";
    }
  }
}

async function guardarGlobal() {
  if (!puedeEscribir()) return;

  const descripcion = document.getElementById("globalDescripcion").value.trim();
  const tipo        = document.getElementById("globalTipo").value;
  const bimestre    = document.getElementById("globalBimestre").value;

  if (!descripcion) { alert("Completá la descripción."); return; }

  const esAcumulativo    = document.getElementById("globalEsAcumulativo").checked;
  let evaluacionOrigenId = null;

  if (esAcumulativo) {
    const sel = document.getElementById("globalEvaluacionOrigen");
    evaluacionOrigenId = sel ? parseInt(sel.value, 10) : null;
    if (!evaluacionOrigenId || isNaN(evaluacionOrigenId)) {
      alert("Seleccioná la evaluación de origen para marcarla como acumulativa."); return;
    }
  }

  const notas = [];
  for (const alumno of alumnosGlobales) {
    const notaInput = document.getElementById(`nota-${alumno.id}`);
    if (notaInput.value === "") continue;
    let valor = Number(notaInput.value);
    if (esParticipacion(tipo)) {
      if (valor !== 0 && valor !== 1) { alert("En valoración solo se permite 0 o 1."); return; }
      if (valor === 0) continue;
      if      (tipo.includes("+1"))   valor =  1;
      else if (tipo.includes("+0.5")) valor =  0.5;
      else if (tipo.includes("-0.5")) valor = -0.5;
    }
    notas.push({ alumnoId: alumno.id, nota: valor });
  }

  if (notas.length === 0) { alert("Debes cargar al menos una nota."); return; }

  try {
    const res = await apiFetch("/planilla/evaluacion-global", {
      method: "POST",
      body: JSON.stringify({ cursoMateriaId, descripcion, tipo, bimestre, notas, esAcumulativo, evaluacionOrigenId })
    });
    if (!res) return;
    if (!res.ok) { const err = await res.json(); alert(err.error || "Error al guardar."); return; }
    document.getElementById("globalDescripcion").value = "";
    cargar();
  } catch (err) {
    console.error("Error al guardar evaluación global:", err);
    alert("Error de conexión al guardar.");
  }
}

function actualizarSelectOrigen() {
  const contenedor = document.getElementById("origenContenedor");
  const checkbox   = document.getElementById("globalEsAcumulativo");
  if (!checkbox.checked) { contenedor.style.display = "none"; return; }

  const vistas = new Set();
  const evalsPrevias = [];
  for (const ev of evaluacionesGlobal) {
    if (!vistas.has(Number(ev.id)) && !esCierre(ev)) {
      vistas.add(Number(ev.id));
      evalsPrevias.push(ev);
    }
  }

  if (evalsPrevias.length === 0) {
    contenedor.style.display = "none";
    checkbox.checked = false;
    alert("No hay evaluaciones previas en este curso para usar como origen.");
    return;
  }

  const sel = document.getElementById("globalEvaluacionOrigen");
  sel.innerHTML = "";
  for (const ev of evalsPrevias) {
    const opt = document.createElement("option");
    opt.value = ev.id;
    opt.textContent = `[B${ev.bimestre ?? "-"}] ${ev.descripcion || ev.tipo || "sin descripción"}`;
    sel.appendChild(opt);
  }
  contenedor.style.display = "block";
}

// ─── Formulario de cierres ────────────────────────────────────────────────────

function seleccionarCierre(numero) {
  cierreActivo = numero;

  document.getElementById("tabDic")
    .classList.toggle("activo", numero === 1);

  document.getElementById("tabFeb")
    .classList.toggle("activo", numero === 2);

  renderCierreAlumnos();
}

function renderCierreAlumnos() {
  const contenedor = document.getElementById("cierreAlumnos");
  contenedor.innerHTML = "";

  for (const alumno of alumnosGlobales) {

    const evAlumno = evaluacionesGlobal.filter(
      n => Number(n.alumno_id) === Number(alumno.id)
    );

    const cuat1 = calcularCuatrimestre(evAlumno, 1, 2);
    const cuat2 = calcularCuatrimestre(evAlumno, 3, 4);

    const necesita = necesitaCierres(cuat1, cuat2);

    const notaDic = calcularNotaCierre(evAlumno, 1);

    // Diciembre: solamente alumnos que necesitan cierre
    let mostrar =
      cierreActivo === 1
        ? necesita
        : necesita && notaDic !== null && notaDic < 6;

    if (!mostrar) continue;

    const div = document.createElement("div");
    div.classList.add("alumno-global");

    const span = document.createElement("span");
    span.textContent = `${alumno.apellido}, ${alumno.nombre}`;

    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.max = "10";
    input.step = "0.01";
    input.placeholder = "Nota";
    input.id = `cierre-nota-${alumno.id}`;

    div.appendChild(span);
    div.appendChild(input);

    contenedor.appendChild(div);
  }
}

async function guardarCierre() {
  if (!puedeEscribir()) return;

  const descripcion = document.getElementById("cierreDescripcion").value.trim();
  if (!descripcion) { alert("Completá el tema del cierre."); return; }

  const notas = [];
  for (const alumno of alumnosGlobales) {
    const input = document.getElementById(`cierre-nota-${alumno.id}`);
    if (!input || input.value === "") continue;
    const valor = Number(input.value);
    if (isNaN(valor) || valor < 1 || valor > 10) {
      alert(`Nota inválida para ${alumno.apellido}, ${alumno.nombre}. Debe ser entre 1 y 10.`);
      return;
    }
    notas.push({ alumnoId: alumno.id, nota: valor });
  }

  if (notas.length === 0) { alert("Ingresá al menos una nota."); return; }

  try {
    const res = await apiFetch("/planilla/cierre-global", {
      method: "POST",
      body: JSON.stringify({
        cursoMateriaId,
        numeroCierre: cierreActivo,
        descripcion,
        notas
      })
    });
    if (!res) return;
    if (!res.ok) { const err = await res.json(); alert(err.error || "Error al guardar."); return; }

    // Limpiar campos del formulario de cierre
    document.getElementById("cierreDescripcion").value = "";
    for (const alumno of alumnosGlobales) {
      const input = document.getElementById(`cierre-nota-${alumno.id}`);
      if (input) input.value = "";
    }
    cargar();
  } catch (err) {
    console.error("Error al guardar cierre:", err);
    alert("Error de conexión al guardar.");
  }
}

// ─── Event listeners ──────────────────────────────────────────────────────────

document.getElementById("globalTipo").addEventListener("change", actualizarInputsNota);

cargar();