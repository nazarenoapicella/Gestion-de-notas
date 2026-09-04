const rango = localStorage.getItem("rango");

if (!localStorage.getItem("token")) {
  location.href = "index.html";
}

if (rango !== "secretario" && rango !== "regente") {
  alert("No tenés permisos para acceder a esta sección.");
  location.href = "dashboard.html";
}

// ─── Cargar lista de cursos ────────────────────────────────────────────────────

async function cargarCursos() {
  const select = document.getElementById("selectCurso");

  try {
    const res = await apiFetch("/boletines/cursos");
    if (!res) return;

    if (!res.ok) {
      select.innerHTML = `<option value="">Error al cargar cursos</option>`;
      return;
    }

    const data = await res.json();

    if (!data.cursos || data.cursos.length === 0) {
      select.innerHTML = `<option value="">No hay cursos creados</option>`;
      return;
    }

    select.innerHTML = `<option value="">— Seleccioná un curso —</option>`;

    for (const curso of data.cursos) {
      const opt = document.createElement("option");
      opt.value = curso.id;
      opt.textContent = `${curso.anio}° ${curso.division} (${capitalizar(
        curso.turno
      )})`;
      select.appendChild(opt);
    }
  } catch (err) {
    console.error("Error al cargar cursos:", err);
    select.innerHTML = `<option value="">Error de conexión</option>`;
  }
}

function capitalizar(str) {
  if (!str) return "-";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── Generar y descargar el ZIP de boletines ──────────────────────────────────

async function generarBoletines() {
  const cursoId = document.getElementById("selectCurso").value;
  const btn = document.getElementById("generarBtn");
  const estado = document.getElementById("estado");

  if (!cursoId) {
    estado.textContent = "Seleccioná un curso primero.";
    estado.className = "estado error";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Generando boletines...";

  const enviarMailsTexto = document.getElementById("checkEnviarMails").checked
    ? " y enviando los mails correspondientes"
    : "";

  estado.textContent = `Generando los PDFs${enviarMailsTexto}. Esto puede tardar varios segundos según la cantidad de alumnos.`;
  estado.className = "estado";

  try {
    const token = localStorage.getItem("token");
    const enviarMails =
      document.getElementById("checkEnviarMails").checked;

    const endpoint = `/boletines/generar/${cursoId}?enviarMails=${enviarMails}`;

    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        Authorization: "Bearer " + token,
      },
    });

    if (res.status === 401) {
      localStorage.clear();
      location.href = "index.html";
      return;
    }

    if (!res.ok) {
      let mensaje = "Error al generar los boletines.";

      try {
        const err = await res.json();
        mensaje = err.error || mensaje;
      } catch (_) {}

      estado.textContent = mensaje;
      estado.className = "estado error";
      return;
    }

    // Descargar el ZIP que devuelve el servidor
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const a = document.createElement("a");

    // Extraer nombre del archivo desde Content-Disposition
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/);

    a.download = match ? match[1] : "boletines.zip";
    a.href = blobUrl;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    window.URL.revokeObjectURL(blobUrl);

    estado.textContent =
      "Boletines generados y descargados correctamente.";
    estado.className = "estado ok";
  } catch (err) {
    console.error("Error al generar boletines:", err);

    estado.textContent =
      "Error de conexión al generar los boletines.";
    estado.className = "estado error";
  } finally {
    btn.disabled = false;
    btn.textContent = "Generar boletines (ZIP)";
  }
}
async function descargarExcel() {
  const cursoId = document.getElementById("selectCurso").value;
  const btn     = document.getElementById("excelBtn");
  const estado  = document.getElementById("estado");

  if (!cursoId) {
    estado.textContent = "Seleccioná un curso primero.";
    estado.className   = "estado error";
    return;
  }

  const iconoOriginal = btn.innerHTML;
  btn.disabled    = true;
  btn.textContent = "Generando Excel...";
  estado.textContent = "Calculando notas y armando el archivo…";
  estado.className   = "estado";

  try {
    const token = localStorage.getItem("token");

    const res = await fetch(`/boletines/excel/${cursoId}`, {
      method:  "GET",
      headers: { "Authorization": "Bearer " + token }
    });

    if (res.status === 401) {
      localStorage.clear();
      location.href = "index.html";
      return;
    }

    if (!res.ok) {
      let mensaje = `Error del servidor (${res.status})`;
      try {
        const texto = await res.text();
        if (!texto.trim().startsWith("<")) {
          const json = JSON.parse(texto);
          mensaje = json.error || mensaje;
        }
      } catch (_) {}
      estado.textContent = mensaje;
      estado.className   = "estado error";
      return;
    }

    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");

    const cd    = res.headers.get("Content-Disposition") || "";
    const match = cd.match(/filename="(.+?)"/);
    a.download  = match ? match[1] : "Calificaciones.xlsx";

    a.href = url;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    estado.textContent = "Planilla Excel descargada correctamente.";
    estado.className   = "estado ok";

  } catch (err) {
    console.error("Error al descargar Excel:", err);
    estado.textContent = "Error de conexión al generar el Excel.";
    estado.className   = "estado error";
  } finally {
    btn.disabled  = false;
    btn.innerHTML = iconoOriginal;
  }
}
// ─── Inicio ────────────────────────────────────────────────────────────────────

cargarCursos();
initAyuda({
  porRol: {
    secretario: "Elegí un curso y tocá 'Generar boletines' para descargar un PDF por cada alumno. Si dejás tildada la opción de mail, cada alumno y su familia lo reciben automáticamente por correo. El botón de Excel arma una planilla completa del curso para guardar en tu computadora — ese no se envía por mail.",
    regente: "Desde acá generás los boletines oficiales de cualquier curso: en PDF (con envío por mail opcional) o en Excel para uso interno del colegio."
  }
});