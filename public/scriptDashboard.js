const id = localStorage.getItem("id");
const permiso = localStorage.getItem("permiso");
const usuario = localStorage.getItem("usuario");
const rango = localStorage.getItem("rango");

const colores = [
  "#1a73e8",
  "#e91e63",
  "#34a853",
  "#fbbc05",
  "#673ab7"
];

// si no hay login
if (!id) {
  window.location.href = "index.html";
}

// mostrar usuario arriba
document.getElementById("userInfo").innerText = usuario;

async function cargar() {
  const res = await fetch("/dashboard/" + id);
  const data = await res.json();

  // si no hay materias
  if (!data || data.length === 0) {
    alert("No hay materias");
    return;
  }

  // GRID DE TARJETAS
  for (let i = 0; i < data.length; i++) {
    const materia = data[i];
    const color = colores[i % colores.length];
    const card = document.createElement("div");
    card.classList.add("card");
    card.innerHTML = `<div class="card-header" style="background:${color}">${materia.materia}</div>
      <div class="card-body">
        <p><strong>Curso: </strong>${materia.anio} ${materia.division}</p>
        <p><strong>Dias: </strong>${materia.dias}</p>
        <p><strong>Horario: </strong>${materia.horario}</p>
        ${rango === "regente"? `<p><strong>Profesor: </strong>${materia.nombre_profesor} ${materia.apellido}</p>`: ''}
      </div>

      <div class="card-actions">
        ${permiso === "escritura" ||permiso === "ambos"  ? `<button class="admin-btn">  Administrar notas</button>  `  : ''}
        ${permiso === "lectura"  ? `<button class="view-btn">Visualizar notas</button>`: ''}
      </div>`;

    document.getElementById("grid").appendChild(card);
  }
}
console.log(rango);
cargar();