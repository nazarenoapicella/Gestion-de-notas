const params         = new URLSearchParams(location.search);
const cursoMateriaId = params.get("materia");
const permiso        = localStorage.getItem("permiso");
const rango          = localStorage.getItem("rango");
const tbody          = document.getElementById("tbody");

let alumnosGlobales    = [];
let evaluacionesGlobal = [];

if (!localStorage.getItem("token")) {
  location.href = "index.html";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function esParticipacion(tipo) {
  return (tipo || "").toLowerCase().includes("particip");
}

function puedeEscribir() {
  return permiso === "escritura" || permiso === "ambos";
}

// ─── Lógica de acumulativos ───────────────────────────────────────────────────

/**
 * Devuelve un Set con los IDs de evaluaciones SALDADAS.
 * Una evaluación Y está saldada si existe X tal que:
 *   - X.es_acumulativo === 1
 *   - X.evaluacion_origen_id === Y.id
 *   - Nota de X >= 6
 * La acumulativa puede ser de cualquier bimestre.
 */
function calcularSaldadas(evaluacionesAlumno) {
  const saldadas = new Set();
  for (const ev of evaluacionesAlumno) {
    if (Number(ev.es_acumulativo) === 1 && ev.evaluacion_origen_id != null) {
      if (Number(ev.nota) >= 6) {
        saldadas.add(Number(ev.evaluacion_origen_id));
      }
    }
  }
  return saldadas;
}

/**
 * Calcula el promedio de un bimestre.
 *
 * REGLA CLAVE: si el bimestre tiene evaluaciones saldadas (tachadas),
 * el bimestre donde VIVÍAN esas evaluaciones sigue mostrando DESAPROBADO
 * para dejar registro. Las saldadas se excluyen del promedio pero no
 * "salvan" al bimestre de origen.
 *
 * El bimestre de la evaluación ACUMULATIVA (aprobada) sí se calcula
 * normalmente excluyendo la saldada del promedio.
 *
 * Flujo:
 * 1. Filtrar evaluaciones del bimestre.
 * 2. Separar participaciones del resto.
 * 3. De las normales, detectar cuáles están saldadas.
 * 4. Si quedan desaprobadas sin saldar O hay saldadas en este bimestre
 *    (registro de que hubo una desaprobada) → DESAPROBADO.
 * 5. Si no → promedio de las que quedan + ajuste de participaciones.
 */
function calcularBimestre(evaluacionesAlumno, num) {
  const evaluaciones = evaluacionesAlumno.filter(e => Number(e.bimestre) === Number(num));
  if (evaluaciones.length === 0) return "-";

  const saldadas = calcularSaldadas(evaluacionesAlumno);

  const participaciones = evaluaciones.filter(e =>  esParticipacion(e.tipo));
  const normales        = evaluaciones.filter(e => !esParticipacion(e.tipo));

  // ¿Hay alguna evaluación saldada en ESTE bimestre?
  // Si la hay, es porque este bimestre tuvo una desaprobada → sigue DESAPROBADO
  const tieneSaldadasEnEsteBimestre = normales.some(e => saldadas.has(Number(e.id)));

  if (tieneSaldadasEnEsteBimestre) {
    return "DESAPROBADO";
  }

  // Sin saldadas en este bimestre: calcular normalmente
  const paraPromedio = normales; // ninguna está saldada acá

  const desaprobadasSinSaldar = paraPromedio.filter(e => Number(e.nota) < 6);
  if (desaprobadasSinSaldar.length > 0) {
    return "DESAPROBADO";
  }

  if (paraPromedio.length === 0 && participaciones.length === 0) return "-";

  const promedioBase = paraPromedio.length > 0
    ? paraPromedio.reduce((sum, e) => sum + Number(e.nota), 0) / paraPromedio.length
    : 0;

  const ajuste = participaciones.reduce((sum, e) => sum + Number(e.nota), 0);

  return (promedioBase + ajuste).toFixed(2);
}

/**
 * Calcula el promedio de cuatrimestre.
 * Si algún bimestre es DESAPROBADO → cuatrimestre DESAPROBADO.
 */
function calcularCuatrimestre(b1, b2) {
  if (b1 === "DESAPROBADO" || b2 === "DESAPROBADO") return "DESAPROBADO";
  const nums = [b1, b2].filter(n => n !== "-").map(Number);
  if (nums.length === 0) return "-";
  return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
}

/**
 * El alumno necesita cierres si algún cuatrimestre es DESAPROBADO
 * o el promedio anual < 6.
 */
function necesitaCierres(cuat1, cuat2) {
  if (cuat1 === "DESAPROBADO" || cuat2 === "DESAPROBADO") return true;
  const nums = [cuat1, cuat2].filter(n => n !== "-").map(Number);
  if (nums.length === 0) return false;
  return nums.reduce((a, b) => a + b, 0) / nums.length < 6;
}

// ─── Render resumen de bimestre (pie de celda) ────────────────────────────────

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

// ─── Render evaluaciones dentro de celda de bimestre ─────────────────────────

function renderBimestre(evaluacionesAlumno, alumno, num) {
  const evaluaciones = evaluacionesAlumno.filter(e => Number(e.bimestre) === Number(num));
  const saldadas     = calcularSaldadas(evaluacionesAlumno);
  const promBim      = calcularBimestre(evaluacionesAlumno, num);

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

    const badgeAcum = esAcum
      ? `<span class="eval-acum-badge">Acumulativa</span><br>`
      : "";

    html += `
      <div class="${claseEval}">
        <div class="eval-top">
          <span class="eval-tipo">${esPartic ? "Valoración" : escHTML(ev.tipo || "Evaluación")}</span>
          <span class="${claseNota}">${escHTML(ev.nota)}</span>
        </div>
        ${badgeAcum}
        <div class="eval-desc">${escHTML(ev.descripcion)}</div>
        ${
          puedeEscribir()
            ? `<button onclick="eliminarEvaluacion(${Number(ev.id)}, ${Number(alumno.id)})">Eliminar</button>`
            : ""
        }
      </div>
    `;
  }

  // SIN botón + : la carga individual fue eliminada, solo existe carga global

  html += renderResumenBimestre(promBim);
  return html;
}

// ─── Carga principal ──────────────────────────────────────────────────────────

async function cargar() {
  try {
    const res = await apiFetch(`/planilla/${cursoMateriaId}/${localStorage.getItem("id")}`);
    if (!res) return;

    if (!res.ok) {
      alert("Error al cargar la planilla.");
      return;
    }

    const data = await res.json();

    document.getElementById("materiaTitulo").textContent = data.materia.materia;
    document.getElementById("materiaInfo").textContent   =
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

    for (const alumno of data.alumnos) {
      const evAlumno = data.notas.filter(n => n.alumno_id == alumno.id);

      const prom1 = calcularBimestre(evAlumno, 1);
      const prom2 = calcularBimestre(evAlumno, 2);
      const prom3 = calcularBimestre(evAlumno, 3);
      const prom4 = calcularBimestre(evAlumno, 4);

      const cuat1 = calcularCuatrimestre(prom1, prom2);
      const cuat2 = calcularCuatrimestre(prom3, prom4);

      const habilitarCierres = necesitaCierres(cuat1, cuat2);

      const cierre1 = evAlumno.find(e => Number(e.cierre) === 1);
      const cierre2 = evAlumno.find(e => Number(e.cierre) === 2);

      // ── Nota final ──
      let final;
      let claseNotaFinal = "prom";

      if (cierre2) {
        final = Number(cierre2.nota) >= 6 ? String(cierre2.nota) : "PREVIA";
      } else if (cierre1) {
        final = Number(cierre1.nota) >= 6 ? String(cierre1.nota) : "PREVIA";
      } else if (!habilitarCierres) {
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

      // ── Celdas de cierre ──
      let celdaCierre1, celdaCierre2;
      if (habilitarCierres) {
        const notaC1 = cierre1 ? escHTML(cierre1.nota) : "-";
        const notaC2 = cierre2 ? escHTML(cierre2.nota) : "-";
        celdaCierre1 = `
          <td class="prom">
            ${notaC1}
            ${puedeEscribir() && !cierre1
              ? `<br><button class="add-btn" onclick="agregarCierre(${Number(alumno.id)}, 1)">Cargar dic.</button>`
              : ""}
          </td>`;
        celdaCierre2 = `
          <td class="prom">
            ${notaC2}
            ${puedeEscribir() && !cierre2
              ? `<br><button class="add-btn" onclick="agregarCierre(${Number(alumno.id)}, 2)">Cargar feb.</button>`
              : ""}
          </td>`;
      } else {
        celdaCierre1 = `<td class="prom" style="color:#aaa;">-</td>`;
        celdaCierre2 = `<td class="prom" style="color:#aaa;">-</td>`;
      }

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escHTML(alumno.apellido)}, ${escHTML(alumno.nombre)}</td>
        <td>${renderBimestre(evAlumno, alumno, 1)}</td>
        <td>${renderBimestre(evAlumno, alumno, 2)}</td>
        <td class="prom"${estiloCuat1}>${escHTML(cuat1)}</td>
        <td>${renderBimestre(evAlumno, alumno, 3)}</td>
        <td>${renderBimestre(evAlumno, alumno, 4)}</td>
        <td class="prom"${estiloCuat2}>${escHTML(cuat2)}</td>
        ${celdaCierre1}
        ${celdaCierre2}
        <td class="${claseNotaFinal}">${escHTML(final)}</td>
      `;

      tbody.appendChild(row);
    }

  } catch (err) {
    console.error("Error al cargar planilla:", err);
    alert("Error de conexión al cargar la planilla.");
  }
}

// ─── Agregar cierre administrativo ───────────────────────────────────────────

async function agregarCierre(alumnoId, numeroCierre) {
  if (!puedeEscribir()) return;

  const label   = numeroCierre === 1 ? "1er cierre (Diciembre)" : "2do cierre (Febrero)";
  const notaStr = prompt(`Nota para ${label} (1 a 10):`);
  if (notaStr === null || notaStr.trim() === "") return;

  const nota = Number(notaStr);
  if (isNaN(nota) || nota < 1 || nota > 10) {
    alert("Nota inválida. Debe ser un número entre 1 y 10.");
    return;
  }

  try {
    const res = await apiFetch("/planilla/evaluacion", {
      method: "POST",
      body: JSON.stringify({
        alumnoId,
        cursoMateriaId,
        tipo:               numeroCierre === 1 ? "Cierre Diciembre" : "Cierre Febrero",
        descripcion:        numeroCierre === 1 ? "1er cierre administrativo" : "2do cierre administrativo",
        nota,
        bimestre:           null,
        cierre:             numeroCierre,
        esAcumulativo:      false,
        evaluacionOrigenId: null
      })
    });
    if (!res) return;
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Error al guardar.");
      return;
    }
    cargar();
  } catch (err) {
    console.error("Error al guardar cierre:", err);
    alert("Error de conexión al guardar.");
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
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Error al eliminar.");
      return;
    }
    cargar();
  } catch (err) {
    console.error("Error al eliminar evaluación:", err);
    alert("Error de conexión al eliminar.");
  }
}

// ─── Render form carga global ─────────────────────────────────────────────────

function renderGlobales() {
  const contenedor = document.getElementById("globalAlumnos");
  contenedor.innerHTML = "";

  for (const alumno of alumnosGlobales) {
    const div         = document.createElement("div");
    div.classList.add("alumno-global");

    const span        = document.createElement("span");
    span.textContent  = `${alumno.apellido}, ${alumno.nombre}`;

    const input       = document.createElement("input");
    input.type        = "number";
    input.min         = "1";
    input.max         = "10";
    input.step        = "0.01";
    input.placeholder = "Nota";
    input.id          = `nota-${alumno.id}`;

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
      input.min         = "0";
      input.max         = "1";
      input.step        = "1";
      input.placeholder = "0 o 1";
      if (input.value !== "" && input.value !== "0" && input.value !== "1") {
        input.value = "";
      }
    } else {
      input.min         = "1";
      input.max         = "10";
      input.step        = "0.01";
      input.placeholder = "Nota";
      if (input.value === "0" || input.value === "1") {
        input.value = "";
      }
    }
  }
}

// ─── Guardar evaluación global ────────────────────────────────────────────────

async function guardarGlobal() {
  if (!puedeEscribir()) return;

  const descripcion = document.getElementById("globalDescripcion").value.trim();
  const tipo        = document.getElementById("globalTipo").value;
  const bimestre    = document.getElementById("globalBimestre").value;

  if (!descripcion) {
    alert("Completá la descripción.");
    return;
  }

  const esAcumulativo    = document.getElementById("globalEsAcumulativo").checked;
  let evaluacionOrigenId = null;

  if (esAcumulativo) {
    const sel          = document.getElementById("globalEvaluacionOrigen");
    evaluacionOrigenId = sel ? parseInt(sel.value, 10) : null;
    if (!evaluacionOrigenId || isNaN(evaluacionOrigenId)) {
      alert("Seleccioná la evaluación de origen para marcarla como acumulativa.");
      return;
    }
  }

  const notas = [];
  for (const alumno of alumnosGlobales) {
    const notaInput = document.getElementById(`nota-${alumno.id}`);
    if (notaInput.value === "") continue;

    let valor = Number(notaInput.value);

    if (esParticipacion(tipo)) {
      if (valor !== 0 && valor !== 1) {
        alert("En valoración solo se permite 0 (no aplica) o 1 (aplica).");
        return;
      }
      if (valor === 0) continue;
      if      (tipo.includes("+1"))   valor =  1;
      else if (tipo.includes("+0.5")) valor =  0.5;
      else if (tipo.includes("-0.5")) valor = -0.5;
    }

    notas.push({ alumnoId: alumno.id, nota: valor });
  }

  if (notas.length === 0) {
    alert("Debes cargar al menos una nota.");
    return;
  }

  try {
    const res = await apiFetch("/planilla/evaluacion-global", {
      method: "POST",
      body: JSON.stringify({
        cursoMateriaId, descripcion, tipo, bimestre, notas,
        esAcumulativo, evaluacionOrigenId
      })
    });
    if (!res) return;
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Error al guardar.");
      return;
    }
    cargar();
  } catch (err) {
    console.error("Error al guardar evaluación global:", err);
    alert("Error de conexión al guardar.");
  }
}

// ─── Actualizar select de evaluación origen (carga global) ───────────────────

function actualizarSelectOrigen() {
  const contenedor = document.getElementById("origenContenedor");
  const checkbox   = document.getElementById("globalEsAcumulativo");

  if (!checkbox.checked) {
    contenedor.style.display = "none";
    return;
  }

  // Todas las evaluaciones del curso, deduplicadas por id
  const vistas      = new Set();
  const evalsPrevias = [];
  for (const ev of evaluacionesGlobal) {
    if (!vistas.has(Number(ev.id))) {
      vistas.add(Number(ev.id));
      evalsPrevias.push(ev);
    }
  }

  if (evalsPrevias.length === 0) {
    contenedor.style.display = "none";
    checkbox.checked          = false;
    alert("No hay evaluaciones previas en este curso para usar como origen.");
    return;
  }

  const sel     = document.getElementById("globalEvaluacionOrigen");
  sel.innerHTML = "";

  for (const ev of evalsPrevias) {
    const opt       = document.createElement("option");
    opt.value       = ev.id;
    opt.textContent = `[B${ev.bimestre ?? "-"}] ${ev.descripcion || ev.tipo || "sin descripción"}`;
    sel.appendChild(opt);
  }

  contenedor.style.display = "block";
}

// ─── Event listeners ──────────────────────────────────────────────────────────

document.getElementById("globalTipo").addEventListener("change", actualizarInputsNota);

cargar();