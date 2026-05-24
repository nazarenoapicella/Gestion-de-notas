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

if (!id || !localStorage.getItem("token")) {
  location.href = "index.html";
}


document.getElementById("userInfo").innerText = usuario;

async function cargar() {
  try {
    const res = await apiFetch("/dashboard/" + id);
    if (!res) return;  

    if (!res.ok) {
      alert("Error al cargar el dashboard.");
      return;
    }

    const data = await res.json();

    if (!data || data.length === 0) {
      document.getElementById("grid").innerHTML =
        "<p style='color:#666;padding:20px;'>No hay materias asignadas.</p>";
      return;
    }

    const grid = document.getElementById("grid");
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
          <p><strong>Curso:</strong> ${escHTML(materia.anio)} ${escHTML(materia.division)}</p>
          <p><strong>Días:</strong> ${escHTML(materia.dias)}</p>
          <p><strong>Horario:</strong> ${escHTML(materia.horario)}</p>
          ${
            rango === "regente"
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
    console.error("Error al cargar dashboard:", err);
    alert("Error de conexión al cargar el dashboard.");
  }
}

cargar();