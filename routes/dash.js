const express = require("express");
const router = express.Router();
const pool = require("../db/connection");

router.get("/:id", async (req, res) => {

    const { id } = req.params;

    try {

        const conn = await pool.getConnection();

        let rows = await conn.query(
            "SELECT * FROM usuarios WHERE id = ?",
            [id]
        );

        const user = rows[0];

        // PROFESOR

        if (user.rango === "profesor") {

            rows = await conn.query(`
                SELECT 
                    cm.id,

                    m.nombre AS materia,

                    c.anio,
                    c.division,

                    cm.dias,
                    cm.horario,

                    u.nombre AS nombre_profesor,
                    u.apellido,
                    u.rango

                FROM materias m

                JOIN curso_materia cm
                    ON m.id = cm.materia_id

                JOIN cursos c
                    ON cm.curso_id = c.id

                JOIN profesor_materia pm
                    ON pm.curso_materia_id = cm.id

                JOIN usuarios u
                    ON u.id = pm.profesor_id

                WHERE pm.profesor_id = ?
            `, [id]);

        }

        // ALUMNO

        else if (user.rango === "alumno") {

            rows = await conn.query(`
                SELECT 
                    cm.id,

                    m.nombre AS materia,

                    c.anio,
                    c.division,

                    cm.dias,
                    cm.horario,

                    u.nombre AS nombre_alumno,
                    u.apellido,
                    u.rango

                FROM alumno_curso ac

                JOIN usuarios u
                    ON ac.alumno_id = u.id

                JOIN cursos c
                    ON ac.curso_id = c.id

                JOIN curso_materia cm
                    ON cm.curso_id = c.id

                JOIN materias m
                    ON m.id = cm.materia_id

                WHERE ac.alumno_id = ?

                GROUP BY cm.id
            `, [id]);

        }

        // REGENTE

        else if (user.rango === "regente") {

            rows = await conn.query(`
                SELECT 
                    cm.id,

                    m.nombre AS materia,

                    c.anio,
                    c.division,

                    cm.dias,
                    cm.horario,

                    u.nombre AS nombre_profesor,
                    u.apellido

                FROM materias m

                JOIN curso_materia cm
                    ON m.id = cm.materia_id

                JOIN cursos c
                    ON cm.curso_id = c.id

                JOIN profesor_materia pm
                    ON pm.curso_materia_id = cm.id

                JOIN usuarios u
                    ON u.id = pm.profesor_id
            `);

        }

        else {

            rows = [];

        }

        conn.release();

        res.json(rows);

    } catch (err) {

        console.error(err);

        res.status(500).send("Error del servidor");

    }

});

module.exports = router;