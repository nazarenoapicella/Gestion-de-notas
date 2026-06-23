const id      = localStorage.getItem("id");
const permiso = localStorage.getItem("permiso");
const usuario = localStorage.getItem("usuario");
const rango   = localStorage.getItem("rango");

const colores = [
  "#1a73e8",
  "#e91e63",
  "#34a853",
  "#fbbc05",
  "#673ab7"
];

// Rangos que navegan por carpetas de curso antes de ver materias
const USA_CARPETAS = ["profesor", "preceptor", "regente"];

if (!id || !localStorage.getItem("token")) {
  location.href = "index.html";
}

document.getElementById("userInfo").textContent = usuario;

// ─── Vista 1: lista de cursos (carpetas) ──────────────────────────────────────

async function cargarCursos() {
  document.getElementById("volverBtn").style.display = "none";
  document.getElementById("breadcrumb").textContent   = "";

  try {
    const res = await apiFetch("/dashboard/" + id);
    if (!res) return;

    if (!res.ok) {
      alert("Error al cargar el dashboard.");
      return;
    }

    const data = await res.json();
    const grid = document.getElementById("grid");

    if (!data || data.length === 0) {
      grid.innerHTML = "<p class='vacio-msg'>No hay cursos asignados.</p>";
      return;
    }

    grid.innerHTML = "";

    for (let i = 0; i < data.length; i++) {
      const curso = data[i];
      const color = colores[i % colores.length];

      const card = document.createElement("div");
      card.classList.add("card");

      card.innerHTML = `
        <div class="card-header curso-header" style="background:${color}">
          <span class="curso-icono">📁</span>
          <span class="curso-nombre">${escHTML(curso.anio)}° ${escHTML(curso.division)}</span>
        </div>
        <div class="card-body">
          <p><strong>Turno:</strong> ${escHTML(curso.turno)}</p>
        </div>
      `;

      card.addEventListener("click", function () {
        cargarMateriasDeCurso(curso.id, `${curso.anio}° ${curso.division}`);
      });

      grid.appendChild(card);
    }

  } catch (err) {
    console.error("Error al cargar cursos:", err);
    alert("Error de conexión al cargar el dashboard.");
  }
}

// ─── Vista 2: materias dentro de un curso ─────────────────────────────────────

async function cargarMateriasDeCurso(cursoId, etiquetaCurso) {
  try {
    const res = await apiFetch("/dashboard/curso/" + cursoId);
    if (!res) return;

    if (!res.ok) {
      const err = await res.json();
      alert(err.error || "Error al cargar las materias del curso.");
      return;
    }

    const data = await res.json();
    const grid = document.getElementById("grid");

    document.getElementById("volverBtn").style.display = "inline-block";
    document.getElementById("breadcrumb").textContent  = `Cursos > ${etiquetaCurso}`;

    if (!data.materias || data.materias.length === 0) {
      grid.innerHTML = "<p class='vacio-msg'>No hay materias en este curso.</p>";
      return;
    }

    grid.innerHTML = "";

    for (let i = 0; i < data.materias.length; i++) {
      const materia = data.materias[i];
      const color   = colores[i % colores.length];

      const card = document.createElement("div");
      card.classList.add("card");

      card.innerHTML = `
        <div class="card-header" style="background:${color}">
          ${escHTML(materia.materia)}
        </div>
        <div class="card-body">
          <p><strong>Curso:</strong> ${escHTML(materia.anio)}° ${escHTML(materia.division)}</p>
          <p><strong>Días:</strong> ${escHTML(materia.dias)}</p>
          <p><strong>Horario:</strong> ${escHTML(materia.horario)}</p>
          ${
            (rango === "regente" || rango === "preceptor") && materia.nombre_profesor
              ? `<p><strong>Profesor:</strong> ${escHTML(materia.nombre_profesor)} ${escHTML(materia.apellido)}</p>`
              : ""
          }
        </div>
        <div class="card-actions">
          ${
            permiso === "escritura" || permiso === "ambos"
              ? `<button class="admin-btn">Administrar notas</button>`
              : ""
          }
          ${
            permiso === "lectura"
              ? `<button class="view-btn">Visualizar notas</button>`
              : ""
          }
        </div>
      `;

      grid.appendChild(card);

      const adminBtn = card.querySelector(".admin-btn");
      if (adminBtn) {
        adminBtn.addEventListener("click", function () {
          location.href = "planilla.html?materia=" + materia.id;
        });
      }

      const viewBtn = card.querySelector(".view-btn");
      if (viewBtn) {
        viewBtn.addEventListener("click", function () {
          location.href = "planilla.html?materia=" + materia.id;
        });
      }
    }

  } catch (err) {
    console.error("Error al cargar materias del curso:", err);
    alert("Error de conexión al cargar las materias.");
  }
}

// ─── Vista directa: materias del alumno (sin carpetas) ────────────────────────

async function cargarMateriasAlumno() {
  document.getElementById("volverBtn").style.display = "none";
  document.getElementById("breadcrumb").textContent   = "";

  try {
    const res = await apiFetch("/dashboard/" + id);
    if (!res) return;

    if (!res.ok) {
      alert("Error al cargar el dashboard.");
      return;
    }

    const data = await res.json();
    const grid = document.getElementById("grid");

    if (!data || data.length === 0) {
      grid.innerHTML = "<p class='vacio-msg'>No hay materias asignadas.</p>";
      return;
    }

    grid.innerHTML = "";

    for (let i = 0; i < data.length; i++) {
      const materia = data[i];
      const color   = colores[i % colores.length];

      const card = document.createElement("div");
      card.classList.add("card");

      card.innerHTML = `
        <div class="card-header" style="background:${color}">
          ${escHTML(materia.materia)}
        </div>
        <div class="card-body">
          <p><strong>Curso:</strong> ${escHTML(materia.anio)}° ${escHTML(materia.division)}</p>
          <p><strong>Días:</strong> ${escHTML(materia.dias)}</p>
          <p><strong>Horario:</strong> ${escHTML(materia.horario)}</p>
        </div>
        <div class="card-actions">
          <button class="view-btn">Visualizar notas</button>
        </div>
      `;

      grid.appendChild(card);

      const viewBtn = card.querySelector(".view-btn");
      viewBtn.addEventListener("click", function () {
        location.href = "planilla.html?materia=" + materia.id;
      });
    }

  } catch (err) {
    console.error("Error al cargar materias del alumno:", err);
    alert("Error de conexión al cargar el dashboard.");
  }
}

// ─── Volver a la vista de cursos ──────────────────────────────────────────────

function volverACursos() {
  cargarCursos();
}

// ─── Punto de entrada ─────────────────────────────────────────────────────────

if (rango === "alumno") {
  cargarMateriasAlumno();
} else if (USA_CARPETAS.includes(rango)) {
  cargarCursos();
} else {
  // Rango no reconocido: por seguridad no se muestra nada
  document.getElementById("grid").innerHTML = "<p class='vacio-msg'>Rol no reconocido.</p>";
}