const params = new URLSearchParams(location.search);
const cursoMateriaId = params.get("materia");
const permiso = localStorage.getItem("permiso");
const usuarioId = localStorage.getItem("id");
const tbody = document.getElementById("tbody");

async function cargar() {

    const res = await fetch(
        `/planilla/${cursoMateriaId}/${usuarioId}`
    );

    const data = await res.json();
    document.getElementById("materiaTitulo").textContent =data.materia.materia;tbody.innerHTML = "";

    for (const alumno of data.alumnos) {
        const row = document.createElement("tr");
        const evaluacionesAlumno =
            data.notas.filter(n =>
                n.alumno_id == alumno.id
            );

        function renderBimestre(num) {
            let html = "";

            const evaluaciones =
                evaluacionesAlumno.filter(e =>
                    e.bimestre == num
                );

            for (const ev of evaluaciones) {
                html += `
                    <div class="eval">
                        <strong>
                            ${ev.tipo}
                        </strong>
                        <br>
                        ${ev.descripcion}
                        <br>
                        Nota:
                        ${ev.nota}
                        ${
                            permiso !== "lectura"
                            ? `
                                <button
                                    onclick="
                                        eliminarEvaluacion(
                                            ${ev.id}
                                        )
                                    "
                                >
                                    -
                                </button>
                            `
                            : ""
                        }
                    </div>
                `;
            }

            if (permiso !== "lectura") {
                html += `
                    <button
                        class="add-btn"
                        onclick="
                            agregarEvaluacion(
                                ${alumno.id},
                                ${num}
                            )
                        "
                    >
                        +
                    </button>
                `;
            }
            return html;
        }

const prom1 = promedio(
    evaluacionesAlumno
        .filter(e => e.bimestre == 1)
        .map(e => Number(e.nota))
);

const prom2 = promedio(
    evaluacionesAlumno
        .filter(e => e.bimestre == 2)
        .map(e => Number(e.nota))
);

const prom3 = promedio(
    evaluacionesAlumno
        .filter(e => e.bimestre == 3)
        .map(e => Number(e.nota))
);

const prom4 = promedio(
    evaluacionesAlumno
        .filter(e => e.bimestre == 4)
        .map(e => Number(e.nota))
);

const cuat1 = promedio(
    [prom1, prom2]
        .filter(n => n !== "-")
);

const cuat2 = promedio(
    [prom3, prom4]
        .filter(n => n !== "-")
);

const cierre1 =
    evaluacionesAlumno.find(e =>
        e.cierre == "1"
    );

const cierre2 =
    evaluacionesAlumno.find(e =>
        e.cierre == "2"
    );

let final;

if (cierre2) {

    final = cierre2.nota;

} else if (cierre1) {

    final = cierre1.nota;
} else {
    final = promedio(
        [cuat1, cuat2]
            .filter(n => n !== "-")
    );
}

        row.innerHTML = `
            <td>

                ${alumno.nombre}
                ${alumno.apellido}
            </td>
            <td>${renderBimestre(1)}</td>
            <td>${renderBimestre(2)}</td>
            <td class="prom">${cuat1}</td>
            <td>${renderBimestre(3)}</td>
            <td>${renderBimestre(4)}</td>
            <td class="prom">${cuat2}</td>
            <td class="prom">
                ${cierre1 ? cierre1.nota : "-"}
            </td>
            <td class="prom">
                ${cierre2 ? cierre2.nota : "-"}
            </td>
            <td class="prom">
                ${final}
            </td>
        `;
        tbody.appendChild(row);
    }
}

function promedio(arr) {
    const nums = arr
        .map(Number)
        .filter(n =>
            !isNaN(n) &&
            n > 0
        );
    if (nums.length === 0) {
        return "-";
    }
    const suma =
        nums.reduce((a,b)=>a+b,0);
    return (
        suma / nums.length
    ).toFixed(2);

}
async function agregarEvaluacion(
    alumnoId,
    bimestre
) {
    const tipo = prompt(
        "Tipo"
    );
    const descripcion = prompt(
        "Tema"
    );
    const nota = prompt(
        "Nota"
    );
    if (
        !tipo ||
        !descripcion ||
        !nota
    ) return;
    await fetch("/planilla/evaluacion", {
        method:"POST",
        headers:{
            "Content-Type":"application/json"
        },
        body:JSON.stringify({
            alumnoId,
            cursoMateriaId,
            tipo,
            descripcion,
            nota,
            bimestre
        })
    });
    cargar();

}
async function eliminarEvaluacion(id) {
    await fetch(
        "/planilla/evaluacion/" + id,
        {
            method:"DELETE"
        }
    );
    cargar();
}
cargar();