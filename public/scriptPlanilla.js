const params         = new URLSearchParams(location.search);
const cursoMateriaId = params.get("materia");
const permiso        = localStorage.getItem("permiso");
const rango          = localStorage.getItem("rango");
const tbody          = document.getElementById("tbody");

let alumnosGlobales    = [];
let evaluacionesGlobal = [];
let cierreActivo       = 1;

if (!localStorage.getItem("token")) {
  location.href = "index.html";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esParticipacion(tipo) {
  return (tipo || "").toLowerCase().includes("particip");
}

function esCierre(ev) {
  const c = Number(ev.cierre);
  return c === 1 || c === 2;
}

function puedeEscribir() {
  return permiso === "escritura" || permiso === "ambos";
}

// ─── Lógica de saldadas ───────────────────────────────────────────────────────

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

// ─── Temas adeudados (para cierres) ──────────────────────────────────────────

/**
 * Devuelve todas las evaluaciones de un alumno con nota < 6 que no estén saldadas.
 * Incluye bimestres y cierres anteriores.
 * Se usa para poblar el select de temas en el 1er cierre (Diciembre).
 */
function temasAdeudados(evaluacionesAlumno) {
  const saldadas = calcularSaldadas(evaluacionesAlumno);
  return evaluacionesAlumno.filter(ev => {
    if (saldadas.has(Number(ev.id))) return false;
    if (Number(ev.nota) >= 6) return false;
    if (esParticipacion(ev.tipo)) return false;
    return true;
  });
}

/**
 * Devuelve los temas que el alumno rindió en el 1er cierre (diciembre, cierre=1)
 * con nota < 6. Se usa para el 2do cierre (Febrero).
 */
function temasDesaprobadosDic(evaluacionesAlumno) {
  return evaluacionesAlumno.filter(
    ev => Number(ev.cierre) === 1 && Number(ev.nota) < 6
  );
}

// ─── Cálculo de bimestre visual ───────────────────────────────────────────────

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

// ─── Estado del cierre de diciembre ──────────────────────────────────────────

/**
 * Temas rendidos en diciembre (cierre=1).
 * Si alguno < 6 → desaprobado.
 * Retorna null si no rindió diciembre.
 */
function estadoCierre1(evaluacionesAlumno) {
  const temas = evaluacionesAlumno.filter(e => Number(e.cierre) === 1);
  if (temas.length === 0) return null;
  const desaprobados = temas.filter(e => Number(e.nota) < 6);
  const prom = temas.reduce((s, e) => s + Number(e.nota), 0) / temas.length;
  return {
    temas,
    aprobado:    desaprobados.length === 0,
    promedio:    parseFloat(prom.toFixed(2)),
    desaprobados
  };
}

/**
 * Estado del cierre de febrero (cierre=2).
 * Solo aplica si hubo diciembre con desaprobados.
 * Retorna null si no hay temas de febrero.
 */
function estadoCierre2(evaluacionesAlumno) {
  const temas = evaluacionesAlumno.filter(e => Number(e.cierre) === 2);
  if (temas.length === 0) return null;
  const desaprobados = temas.filter(e => Number(e.nota) < 6);
  const prom = temas.reduce((s, e) => s + Number(e.nota), 0) / temas.length;
  return {
    temas,
    aprobado:    desaprobados.length === 0,
    promedio:    parseFloat(prom.toFixed(2)),
    desaprobados
  };
}

// ─── Render resumen bimestre ──────────────────────────────────────────────────

function renderResumenBimestre(prom) {
  const esDesap = prom === "DESAPROBADO";
  const esVacio = prom === "-";
  const clase   = esDesap ? "desaprobado" : (!esVacio ? "aprobado" : "");
  return `
    <div class="bim-resumen">
      <div class="bim-resumen-label">Promedio bimestre</div>
      <div class="bim-resumen-valor ${clase}">${escHTML(prom)}</div>
    </div>`;
}

// ─── Render resumen cierre ────────────────────────────────────────────────────

function renderResumenCierreHTML(estado) {
  if (!estado) return "";
  const clase = estado.aprobado ? "aprobado" : "desaprobado";
  const texto = estado.aprobado
    ? `${estado.promedio.toFixed(2)} — Aprobado`
    : `${estado.promedio.toFixed(2)} — Desaprobado`;
  return `
    <div class="cierre-resumen">
      <div class="cierre-resumen-label">Resultado cierre</div>
      <div class="cierre-resumen-valor ${clase}">${escHTML(texto)}</div>
    </div>`;
}

// ─── Render bimestre en tabla ─────────────────────────────────────────────────

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
      </div>`;
  }
  html += renderResumenBimestre(promBim);
  return html;
}

// ─── Render celda cierre 1 (Diciembre) ───────────────────────────────────────

function renderCeldaCierre1(evaluacionesAlumno, alumno, habilitado) {
  if (!habilitado) return `<td class="prom" style="color:#aaa;">-</td>`;

  const estado = estadoCierre1(evaluacionesAlumno);
  if (!estado) return `<td class="prom" style="color:#aaa;">-</td>`;

  let html = "";
  for (const ev of estado.temas) {
    const nota      = Number(ev.nota);
    const claseNota = nota >= 6 ? "eval-nota" : "eval-nota eval-nota-roja";
    html += `
      <div class="eval">
        <div class="eval-top">
          <span class="eval-tipo">${escHTML(ev.descripcion || "Tema")}</span>
          <span class="${claseNota}">${escHTML(ev.nota)}</span>
        </div>
        <span class="eval-cierre-badge dic">Diciembre</span>
        ${puedeEscribir()
          ? `<button onclick="eliminarEvaluacion(${Number(ev.id)}, ${Number(alumno.id)})">Eliminar</button>`
          : ""}
      </div>`;
  }
  html += renderResumenCierreHTML(estado);
  return `<td class="prom">${html}</td>`;
}

// ─── Render celda cierre 2 (Febrero) ─────────────────────────────────────────

function renderCeldaCierre2(evaluacionesAlumno, alumno, habilitado) {
  if (!habilitado) return `<td class="prom" style="color:#aaa;">-</td>`;

  const estado = estadoCierre2(evaluacionesAlumno);
  if (!estado) return `<td class="prom" style="color:#aaa;">-</td>`;

  let html = "";
  for (const ev of estado.temas) {
    const nota      = Number(ev.nota);
    const claseNota = nota >= 6 ? "eval-nota" : "eval-nota eval-nota-roja";
    html += `
      <div class="eval">
        <div class="eval-top">
          <span class="eval-tipo">${escHTML(ev.descripcion || "Tema")}</span>
          <span class="${claseNota}">${escHTML(ev.nota)}</span>
        </div>
        <span class="eval-cierre-badge feb">Febrero</span>
        ${puedeEscribir()
          ? `<button onclick="eliminarEvaluacion(${Number(ev.id)}, ${Number(alumno.id)})">Eliminar</button>`
          : ""}
      </div>`;
  }
  html += renderResumenCierreHTML(estado);
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
    document.getElementById("materiaInfo").textContent =
      `${data.materia.anio}° ${data.materia.division} • ${data.materia.dias} • ${data.materia.horario}`;

    tbody.innerHTML    = "";
    alumnosGlobales    = data.alumnos;
    evaluacionesGlobal = data.notas;

    if (puedeEscribir()) {
      document.getElementById("globalForm").style.display = "block";
      renderGlobales();
    } else {
      document.getElementById("globalForm").style.display = "none";
    }

    // Alumnos para cada cierre
    const alumnosParaDic = []; // necesitan diciembre: tienen temas adeudados y no rindieron dic aún
    const alumnosParaFeb = []; // tienen dic con desaprobados y necesitan febrero

    for (const alumno of data.alumnos) {
      const evAlumno = data.notas.filter(n => n.alumno_id == alumno.id);

      const cuat1 = calcularCuatrimestre(evAlumno, 1, 2);
      const cuat2 = calcularCuatrimestre(evAlumno, 3, 4);
      const habCierres = necesitaCierres(cuat1, cuat2);

      const ec1 = estadoCierre1(evAlumno);
      const ec2 = estadoCierre2(evAlumno);

      // Para diciembre: necesita cierres Y tiene temas adeudados (nota <6 sin saldar)
      // en bimestres o cierres previos, Y no tiene todos los temas aprobados en dic
      const adeudados = temasAdeudados(evAlumno);
      if (habCierres && adeudados.length > 0 && (!ec1 || !ec1.aprobado)) {
        alumnosParaDic.push({ alumno, adeudados });
      }

      // Para febrero: tiene dic con temas desaprobados (cierre=1 con nota<6)
      const desapDic = temasDesaprobadosDic(evAlumno);
      if (desapDic.length > 0 && (!ec2 || !ec2.aprobado)) {
        alumnosParaFeb.push({ alumno, desapDic });
      }

      // ── Nota final ──
      let final;
      let claseNotaFinal = "prom";

      if (ec2) {
        final = ec2.aprobado ? ec2.promedio.toFixed(2) : "PREVIA";
      } else if (ec1) {
        final = ec1.aprobado ? ec1.promedio.toFixed(2) : "-"; // espera febrero
      } else if (!habCierres) {
        const nums = [cuat1, cuat2].filter(n => n !== "-" && n !== "DESAPROBADO").map(Number);
        final = nums.length > 0
          ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)
          : "-";
      } else {
        final = "-";
      }

      if (final === "PREVIA") claseNotaFinal += " nota-previa";

      const estiloCuat1 = cuat1 === "DESAPROBADO" ? ' style="color:#c00;font-weight:bold;"' : "";
      const estiloCuat2 = cuat2 === "DESAPROBADO" ? ' style="color:#c00;font-weight:bold;"' : "";

      const habFeb = ec1 && !ec1.aprobado;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escHTML(alumno.apellido)}, ${escHTML(alumno.nombre)}</td>
        <td>${renderBimestre(evAlumno, alumno, 1)}</td>
        <td>${renderBimestre(evAlumno, alumno, 2)}</td>
        <td class="prom"${estiloCuat1}>${escHTML(cuat1)}</td>
        <td>${renderBimestre(evAlumno, alumno, 3)}</td>
        <td>${renderBimestre(evAlumno, alumno, 4)}</td>
        <td class="prom"${estiloCuat2}>${escHTML(cuat2)}</td>
        ${renderCeldaCierre1(evAlumno, alumno, habCierres)}
        ${renderCeldaCierre2(evAlumno, alumno, habFeb)}
        <td class="${claseNotaFinal}">${escHTML(final)}</td>
      `;
      tbody.appendChild(row);
    }

    if (puedeEscribir()) {
      renderFormularioCierres(alumnosParaDic, alumnosParaFeb);
    }

  } catch (err) {
    console.error("Error al cargar planilla:", err);
    alert("Error de conexión al cargar la planilla.");
  }
}

// ─── Render formulario de cierres ────────────────────────────────────────────

function renderFormularioCierres(alumnosParaDic, alumnosParaFeb) {
  const contenedor = document.getElementById("cierreForm");

  if (alumnosParaDic.length === 0 && alumnosParaFeb.length === 0) {
    contenedor.style.display = "none";
    return;
  }

  contenedor.style.display = "block";

  // Si el tab activo quedó sin alumnos, cambiar al otro
  if (cierreActivo === 1 && alumnosParaDic.length === 0) cierreActivo = 2;
  if (cierreActivo === 2 && alumnosParaFeb.length === 0) cierreActivo = 1;

  contenedor.innerHTML = `
    <h2>Cierres administrativos</h2>
    <p class="cierre-subtitulo">
      1er Cierre (Diciembre): seleccioná el alumno y el tema que adeuda, ingresá la nota.<br>
      2do Cierre (Febrero): seleccioná el alumno y el tema que rindió mal en diciembre, ingresá la nueva nota.
    </p>

    <div class="cierre-tabs">
      <button
        class="cierre-tab ${cierreActivo === 1 ? "activo" : ""}"
        id="tabDic"
        onclick="cambiarTabCierre(1)"
        ${alumnosParaDic.length === 0 ? "disabled" : ""}
      >1er Cierre — Diciembre
        ${alumnosParaDic.length > 0 ? `<span class="cierre-badge-count">${alumnosParaDic.length}</span>` : ""}
      </button>
      <button
        class="cierre-tab ${cierreActivo === 2 ? "activo" : ""}"
        id="tabFeb"
        onclick="cambiarTabCierre(2)"
        ${alumnosParaFeb.length === 0 ? "disabled" : ""}
      >2do Cierre — Febrero
        ${alumnosParaFeb.length > 0 ? `<span class="cierre-badge-count">${alumnosParaFeb.length}</span>` : ""}
      </button>
    </div>

    <div id="cierreContenido"></div>
  `;

  contenedor._alumnosParaDic = alumnosParaDic;
  contenedor._alumnosParaFeb = alumnosParaFeb;

  renderContenidoCierre();
}

function renderContenidoCierre() {
  const el       = document.getElementById("cierreContenido");
  const cf       = document.getElementById("cierreForm");
  const paraDic  = cf._alumnosParaDic || [];
  const paraFeb  = cf._alumnosParaFeb || [];
  if (!el) return;

  if (cierreActivo === 1) {
    renderContenidoDic(el, paraDic);
  } else {
    renderContenidoFeb(el, paraFeb);
  }
}

// ── Diciembre ──────────────────────────────────────────────────────────────────
// Un select de alumno + un select de tema (dinámico según alumno) + input nota + botón

function renderContenidoDic(el, alumnosParaDic) {
  if (alumnosParaDic.length === 0) {
    el.innerHTML = `<p class="sin-pendientes">No hay alumnos con temas pendientes para diciembre.</p>`;
    return;
  }

  el.innerHTML = `
    <div class="cierre-fila">
      <select id="dicSelAlumno" onchange="actualizarTemasDic()">
        <option value="">— Seleccioná un alumno —</option>
        ${alumnosParaDic.map(({ alumno }) =>
          `<option value="${alumno.id}">${escHTML(alumno.apellido)}, ${escHTML(alumno.nombre)}</option>`
        ).join("")}
      </select>
      <select id="dicSelTema">
        <option value="">— Seleccioná un tema —</option>
      </select>
      <input type="number" id="dicNota" min="1" max="10" step="0.01" placeholder="Nota (1-10)">
      <button onclick="guardarCierreDic()">Guardar</button>
    </div>
  `;

  // Guardar referencia para el cambio de alumno
  el._alumnosParaDic = alumnosParaDic;
}

function actualizarTemasDic() {
  const alumnoId = Number(document.getElementById("dicSelAlumno").value);
  const selTema  = document.getElementById("dicSelTema");
  const el       = document.getElementById("cierreContenido");
  const paraDic  = el._alumnosParaDic || [];

  selTema.innerHTML = `<option value="">— Seleccioná un tema —</option>`;

  if (!alumnoId) return;

  const entrada = paraDic.find(({ alumno }) => Number(alumno.id) === alumnoId);
  if (!entrada) return;

  for (const tema of entrada.adeudados) {
    const opt = document.createElement("option");
    opt.value = Number(tema.id);
    const bim   = tema.bimestre ? `B${tema.bimestre}` : (tema.cierre ? `Cierre ${tema.cierre}` : "");
    opt.textContent = `[${bim}] ${tema.descripcion || tema.tipo || "sin descripción"} — nota: ${tema.nota}`;
    selTema.appendChild(opt);
  }
}

async function guardarCierreDic() {
  if (!puedeEscribir()) return;

  const alumnoId     = Number(document.getElementById("dicSelAlumno").value);
  const evaluacionId = Number(document.getElementById("dicSelTema").value);
  const nota         = Number(document.getElementById("dicNota").value);

  if (!alumnoId)     { alert("Seleccioná un alumno."); return; }
  if (!evaluacionId) { alert("Seleccioná un tema."); return; }
  if (isNaN(nota) || nota < 1 || nota > 10) { alert("Nota inválida (1 a 10)."); return; }

  try {
    const res = await apiFetch("/planilla/cierre-tema", {
      method: "PATCH",
      body: JSON.stringify({ evaluacionId, alumnoId, cursoMateriaId, nota, numeroCierre: 1 })
    });
    if (!res) return;
    if (!res.ok) { const err = await res.json(); alert(err.error || "Error al guardar."); return; }
    cargar();
  } catch (err) {
    console.error("Error al guardar cierre diciembre:", err);
    alert("Error de conexión al guardar.");
  }
}

// ── Febrero ────────────────────────────────────────────────────────────────────
// Un select de alumno + un select de temas desaprobados en dic + input nota + botón

function renderContenidoFeb(el, alumnosParaFeb) {
  if (alumnosParaFeb.length === 0) {
    el.innerHTML = `<p class="sin-pendientes">No hay alumnos con temas pendientes para febrero.</p>`;
    return;
  }

  el.innerHTML = `
    <div class="cierre-fila">
      <select id="febSelAlumno" onchange="actualizarTemasFeb()">
        <option value="">— Seleccioná un alumno —</option>
        ${alumnosParaFeb.map(({ alumno }) =>
          `<option value="${alumno.id}">${escHTML(alumno.apellido)}, ${escHTML(alumno.nombre)}</option>`
        ).join("")}
      </select>
      <select id="febSelTema">
        <option value="">— Seleccioná un tema —</option>
      </select>
      <input type="number" id="febNota" min="1" max="10" step="0.01" placeholder="Nota (1-10)">
      <button onclick="guardarCierreFeb()">Guardar</button>
    </div>
  `;

  el._alumnosParaFeb = alumnosParaFeb;
}

function actualizarTemasFeb() {
  const alumnoId = Number(document.getElementById("febSelAlumno").value);
  const selTema  = document.getElementById("febSelTema");
  const el       = document.getElementById("cierreContenido");
  const paraFeb  = el._alumnosParaFeb || [];

  selTema.innerHTML = `<option value="">— Seleccioná un tema —</option>`;

  if (!alumnoId) return;

  const entrada = paraFeb.find(({ alumno }) => Number(alumno.id) === alumnoId);
  if (!entrada) return;

  for (const tema of entrada.desapDic) {
    const opt = document.createElement("option");
    opt.value = Number(tema.id);
    opt.textContent = `${tema.descripcion || "Tema"} — nota dic: ${tema.nota}`;
    selTema.appendChild(opt);
  }
}

async function guardarCierreFeb() {
  if (!puedeEscribir()) return;

  const alumnoId     = Number(document.getElementById("febSelAlumno").value);
  const evaluacionId = Number(document.getElementById("febSelTema").value);
  const nota         = Number(document.getElementById("febNota").value);

  if (!alumnoId)     { alert("Seleccioná un alumno."); return; }
  if (!evaluacionId) { alert("Seleccioná un tema."); return; }
  if (isNaN(nota) || nota < 1 || nota > 10) { alert("Nota inválida (1 a 10)."); return; }

  try {
    const res = await apiFetch("/planilla/cierre-tema", {
      method: "PATCH",
      body: JSON.stringify({ evaluacionId, alumnoId, cursoMateriaId, nota, numeroCierre: 2 })
    });
    if (!res) return;
    if (!res.ok) { const err = await res.json(); alert(err.error || "Error al guardar."); return; }
    cargar();
  } catch (err) {
    console.error("Error al guardar cierre febrero:", err);
    alert("Error de conexión al guardar.");
  }
}

function cambiarTabCierre(numero) {
  cierreActivo = numero;
  const tabDic = document.getElementById("tabDic");
  const tabFeb = document.getElementById("tabFeb");
  if (tabDic) tabDic.classList.toggle("activo", numero === 1);
  if (tabFeb) tabFeb.classList.toggle("activo", numero === 2);
  renderContenidoCierre();
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

// ─── Formulario de evaluaciones regulares ────────────────────────────────────

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
    input.id   = `nota-${alumno.id}`;
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
      alert("Seleccioná la evaluación de origen."); return;
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

  const vistas       = new Set();
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

// ─── Event listeners ──────────────────────────────────────────────────────────

document.getElementById("globalTipo").addEventListener("change", actualizarInputsNota);

cargar();