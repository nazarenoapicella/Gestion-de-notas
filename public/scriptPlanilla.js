const params         = new URLSearchParams(location.search);
const cursoMateriaId = params.get("materia");
const permiso        = localStorage.getItem("permiso");
const tbody          = document.getElementById("tbody");

let alumnosGlobales = [];

if (!localStorage.getItem("token")) {
  location.href = "index.html";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function promedio(arr) {
  const nums = arr.map(Number).filter(n => !isNaN(n));
  if (nums.length === 0) return "-";
  return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
}

function esParticipacion(tipo) {
  return (tipo || "").toLowerCase().includes("particip");
}

// escHTML viene de api.js y previene XSS en innerHTML
function renderBimestre(evaluacionesAlumno, alumno, num) {
  const evaluaciones = evaluacionesAlumno.filter(e => e.bimestre == num);
  let html = "";

  for (const ev of evaluaciones) {
    const esPartic = esParticipacion(ev.tipo);

    html += `
      <div class="eval">
        <div class="eval-top">
          <span class="eval-tipo">${esPartic ? "Valoración" : escHTML(ev.tipo || "Evaluación")}</span>
          <span class="eval-nota">${escHTML(ev.nota)}</span>
        </div>
        <div class="eval-desc">${escHTML(ev.descripcion)}</div>
        ${
          permiso !== "lectura"
            ? `<button onclick="eliminarEvaluacion(${Number(ev.id)}, ${Number(alumno.id)})">Eliminar</button>`
            : ""
        }
      </div>
    `;
  }

  if (permiso !== "lectura") {
    html += `<button class="add-btn" onclick="agregarEvaluacion(${Number(alumno.id)}, ${Number(num)})">+</button>`;
  }

  return html;
}

function calcularBimestre(evaluacionesAlumno, num) {
  const evaluaciones = evaluacionesAlumno.filter(e => e.bimestre == num);

  const notasNormales = evaluaciones
    .filter(e => !esParticipacion(e.tipo))
    .map(e => Number(e.nota));

  const ajustes = evaluaciones
    .filter(e => esParticipacion(e.tipo))
    .map(e => Number(e.nota));

  if (notasNormales.length === 0 && ajustes.length === 0) return "-";

  const promedioBase = notasNormales.length > 0
    ? notasNormales.reduce((a, b) => a + b, 0) / notasNormales.length
    : 0;

  const ajusteTotal = ajustes.reduce((a, b) => a + b, 0);

  return (promedioBase + ajusteTotal).toFixed(2);
}

// ─── Control de inputs según tipo de participación ────────────────────────────

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

    // escHTML en datos que se insertan en el DOM
    document.getElementById("materiaTitulo").textContent = data.materia.materia;
    document.getElementById("materiaInfo").textContent   =
      `${data.materia.anio}° ${data.materia.division} • ${data.materia.dias} • ${data.materia.horario}`;

    tbody.innerHTML    = "";
    alumnosGlobales    = data.alumnos;

    if (permiso === "escritura" || permiso === "ambos") {
      document.getElementById("globalForm").style.display = "block";
      renderGlobales();
    } else {
      document.getElementById("globalForm").style.display = "none";
    }

    for (const alumno of data.alumnos) {
      const evaluacionesAlumno = data.notas.filter(n => n.alumno_id == alumno.id);

      const prom1 = calcularBimestre(evaluacionesAlumno, 1);
      const prom2 = calcularBimestre(evaluacionesAlumno, 2);
      const prom3 = calcularBimestre(evaluacionesAlumno, 3);
      const prom4 = calcularBimestre(evaluacionesAlumno, 4);

      const cuat1 = promedio([prom1, prom2].filter(n => n !== "-"));
      const cuat2 = promedio([prom3, prom4].filter(n => n !== "-"));

      const cierre1 = evaluacionesAlumno.find(e => e.cierre == "1");
      const cierre2 = evaluacionesAlumno.find(e => e.cierre == "2");

      let final;
      if (cierre2)      final = cierre2.nota;
      else if (cierre1) final = cierre1.nota;
      else              final = promedio([cuat1, cuat2].filter(n => n !== "-"));

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escHTML(alumno.nombre)} ${escHTML(alumno.apellido)}</td>
        <td>${renderBimestre(evaluacionesAlumno, alumno, 1)}</td>
        <td>${renderBimestre(evaluacionesAlumno, alumno, 2)}</td>
        <td class="prom">${escHTML(cuat1)}</td>
        <td>${renderBimestre(evaluacionesAlumno, alumno, 3)}</td>
        <td>${renderBimestre(evaluacionesAlumno, alumno, 4)}</td>
        <td class="prom">${escHTML(cuat2)}</td>
        <td class="prom">${cierre1 ? escHTML(cierre1.nota) : "-"}</td>
        <td class="prom">${cierre2 ? escHTML(cierre2.nota) : "-"}</td>
        <td class="prom">${escHTML(final)}</td>
      `;

      tbody.appendChild(row);
    }

  } catch (err) {
    console.error("Error al cargar planilla:", err);
    alert("Error de conexión al cargar la planilla.");
  }
}

// ─── Agregar evaluación individual ───────────────────────────────────────────

async function agregarEvaluacion(alumnoId, bimestre) {
  if (permiso === "lectura") return;

  const tipo        = prompt("Tipo de evaluación");
  const descripcion = prompt("Tema / descripción");
  let nota          = Number(prompt("Nota"));

  if (!tipo || !descripcion || isNaN(nota)) return;

  if (esParticipacion(tipo)) {
    if (nota !== 0 && nota !== 1) {
      alert("En participación solo se permite 0 (no aplica) o 1 (aplica).");
      return;
    }
    if (nota === 0) return;

    if (tipo.includes("+1"))        nota =  1;
    else if (tipo.includes("+0.5")) nota =  0.5;
    else if (tipo.includes("-0.5")) nota = -0.5;
    else {
      alert("Tipo de participación no reconocido. Usá: 'Participacion +1', '+0.5' o '-0.5'.");
      return;
    }
  }

  try {
    const res = await apiFetch("/planilla/evaluacion", {
      method: "POST",
      body: JSON.stringify({ alumnoId, cursoMateriaId, tipo, descripcion, nota, bimestre })
    });

    if (!res) return;

    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Error al guardar.");
      return;
    }

    cargar();

  } catch (err) {
    console.error("Error al agregar evaluación:", err);
    alert("Error de conexión al guardar.");
  }
}

// ─── Eliminar evaluación ──────────────────────────────────────────────────────

async function eliminarEvaluacion(evaluacionId, alumnoId) {
  if (permiso === "lectura") return;

  try {
    // cursoMateriaId se envía para que el servidor verifique ownership
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
    const div = document.createElement("div");
    div.classList.add("alumno-global");

    // textContent para nombre/apellido: seguro contra XSS
    const span = document.createElement("span");
    span.textContent = `${alumno.apellido} ${alumno.nombre}`;

    const input = document.createElement("input");
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

  // Ajustar inputs según el tipo actualmente seleccionado
  actualizarInputsNota();
}

// ─── Guardar evaluación global ────────────────────────────────────────────────

async function guardarGlobal() {
  if (permiso === "lectura") return;

  const descripcion = document.getElementById("globalDescripcion").value.trim();
  const tipo        = document.getElementById("globalTipo").value;
  const bimestre    = document.getElementById("globalBimestre").value;

  if (!descripcion) {
    alert("Completá la descripción.");
    return;
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

      if (tipo.includes("+1"))        valor =  1;
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
      body: JSON.stringify({ cursoMateriaId, descripcion, tipo, bimestre, notas })
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

// ─── Event listeners ──────────────────────────────────────────────────────────

document.getElementById("globalTipo").addEventListener("change", actualizarInputsNota);
cargar();
