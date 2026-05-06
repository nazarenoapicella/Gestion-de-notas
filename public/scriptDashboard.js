const id = localStorage.getItem("id");
const permiso = localStorage.getItem("permiso");
const usuario = localStorage.getItem("usuario");

const colores = [
  "#1a73e8",
  "#e91e63",
  "#34a853",
  "#fbbc05",
  "#673ab7"
];

if (!id) {
  window.location.href = "index.html";
}


document.getElementById("userInfo").innerText = usuario;

async function cargar() {

  const res = await fetch("/dashboard/" + id);
  const data = await res.json();

  if (!data || data.length === 0) {
    alert("No hay materias");
    return;
  }
console.log(data);
  for (let i = 0; i < data.length; i++) {

    const materia = data[i];
    const color = colores[i % colores.length];

    const card = document.createElement("div");
    card.classList.add("card");

    card.innerHTML = `
  <div class="card-header" style="background:${color}">
    ${materia.nombre}
  </div>

  <div class="card-body">
    <p><strong>Curso:</strong> ${materia.anio} ${materia.division}</p>
    <p><strong>Dias:</strong> ${materia.dias}</p>
    <p><strong>Horario:</strong> ${materia.horario}</p>
  </div>

  <div class="card-actions">
    ${permiso === "escritura" || permiso === "ambos" 
      ? '<button>Administrar notas</button>' 
      : ''}
    ${permiso === "lectura" 
      ? '<button>Visualizar notas</button>' 
      : ''}
  </div>
`;

    document.getElementById("grid").appendChild(card);
  }
}

cargar();