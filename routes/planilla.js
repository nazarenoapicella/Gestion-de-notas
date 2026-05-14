const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
router.get("/:cursoMateriaId/:usuarioId", async (req, res) => {
    const {
        cursoMateriaId,
        usuarioId
    } = req.params;
    try {
        const conn = await pool.getConnection();
        const users = await conn.query(`
            SELECT *
            FROM usuarios
            WHERE id = ?
        `, [usuarioId]);
        const user = users[0];
        const materia = await conn.query(`
            SELECT
                cm.id AS curso_materia_id,
                m.nombre AS materia,
                c.anio,
                c.division,
                cm.dias,
                cm.horario
            FROM curso_materia cm
            INNER JOIN materias m
                ON cm.materia_id = m.id
            INNER JOIN cursos c
                ON cm.curso_id = c.id
            WHERE cm.id = ?
        `, [cursoMateriaId]);
        const alumnos = await conn.query(`
            SELECT DISTINCT
                u.id,
                u.nombre,
                u.apellido,
                u.rango
            FROM curso_materia cm
            INNER JOIN cursos c
                ON cm.curso_id = c.id
            INNER JOIN alumno_curso ac
                ON c.id = ac.curso_id
            INNER JOIN usuarios u
                ON ac.alumno_id = u.id
            WHERE cm.id = ?
            AND u.rango = 'alumno'
            ORDER BY
                u.apellido,
                u.nombre
        `, [cursoMateriaId]);
        const evaluaciones = await conn.query(`
            SELECT
                e.id,
                e.tipo,
                e.descripcion,
                e.fecha,
                e.bimestre,
                e.cierre,
                n.alumno_id,
                n.nota
            FROM evaluaciones e
            INNER JOIN notas n
                ON e.id = n.evaluacion_id
            WHERE e.curso_materia_id = ?
            ORDER BY
                e.bimestre,
                e.id
        `, [cursoMateriaId]);
        conn.release();
        res.json({
            success:true,
            user,
            materia: materia[0],
            alumnos,
            notas: evaluaciones
        });
    } catch(err) {
        console.error(err);
        res.status(500).json({
            success:false,
            error:"Error al cargar planilla"
        });
    }
});

router.post("/evaluacion", async (req,res)=>{
    const {
        alumnoId,
        cursoMateriaId,
        tipo,
        descripcion,
        nota,
        bimestre,
        cierre
    } = req.body;

    try {
        const conn =
            await pool.getConnection();
        const result = await conn.query(`
            INSERT INTO evaluaciones
            (
                curso_materia_id,
                tipo,
                descripcion,
                fecha,
                bimestre,
                cierre
            )
            VALUES (?,?,?,?,?,?)
        `,[
            cursoMateriaId,
            tipo,
            descripcion,
            new Date(),
            bimestre || null,
            cierre || null
        ]);

        const evaluacionId =
            result.insertId;
        await conn.query(`
            INSERT INTO notas
            (
                evaluacion_id,
                alumno_id,
                nota
            )
            VALUES (?,?,?)
        `,[
            evaluacionId,
            alumnoId,
            nota
        ]);
        conn.release();
        res.json({
            success:true
        });
    } catch(err) {
        console.error(err);
        res.status(500).json({
            success:false,
            error:"Error al crear evaluacion"
        });
    }
});

router.delete("/evaluacion/:id", async (req,res)=>{
    const { id } = req.params;
    try {
        const conn =
            await pool.getConnection();
        await conn.query(`
            DELETE FROM notas
            WHERE evaluacion_id = ?
        `,[id]);
        await conn.query(`
            DELETE FROM evaluaciones
            WHERE id = ?
        `,[id]);
        conn.release();
        res.json({
            success:true
        });
    } catch(err) {
        console.error(err);
        res.status(500).json({
            success:false,
            error:"Error al eliminar evaluacion"
        });
    }
});
module.exports = router;