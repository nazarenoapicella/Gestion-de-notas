# Gestión de Notas — ET N°35

## Sistema escolar web

Sistema de gestión académica desarrollado para la Escuela Técnica N°35 "Ingeniero Eduardo Latzina". Permite registrar, consultar y administrar calificaciones de forma digital, centralizada y segura.

| Capa | Tecnología |
|---|---|
| Frontend | HTML5 · CSS3 · JavaScript vanilla |
| Backend | Node.js · Express.js 5 |
| Base de datos | MariaDB / MySQL |
| Autenticación | JSON Web Tokens (JWT) |
| Hash de contraseñas | bcrypt |
| Rate limiting | express-rate-limit |
| Seguridad HTTP | Helmet |
| Variables de entorno | dotenv |

---

## Funcionalidades

- Login seguro con JWT y rate limiting (10 intentos / 15 min por IP)
- Cambio obligatorio de contraseña en el primer ingreso
- Roles diferenciados: profesor, alumno, regente y preceptor
- Dashboard dinámico estilo Google Classroom con tarjetas por materia
- Gestión de notas por bimestre (1° a 4°)
- Cálculo automático de promedios bimestrales, cuatrimestrales y nota final
- Carga global de evaluaciones por curso completo
- Tipos de evaluación: examen escrito, oral, TP, participación (+1 / +0.5 / -0.5)
- Sistema de evaluaciones acumulativas: una evaluación puede saldar una anterior desaprobada
- Cierres administrativos (Diciembre / Febrero) habilitados automáticamente cuando el alumno no llega a 6
- Nota final PREVIA si el alumno no aprueba ningún cierre administrativo
- Control de acceso por materia y por alumno (un profesor solo accede a lo suyo)
- Protección XSS en el frontend (escHTML) y consultas parametrizadas en el backend
- Headers de seguridad HTTP mediante Helmet

---

## Roles

### Profesor
- Visualiza sus materias asignadas
- Carga y elimina evaluaciones de sus cursos mediante carga global
- Marca evaluaciones como acumulativas de una anterior desaprobada
- Carga notas de cierres administrativos (Diciembre y Febrero) cuando el alumno lo requiere
- Accede a la planilla de cada curso

### Alumno
- Visualiza sus materias
- Consulta únicamente sus propias notas (no ve las de sus compañeros)
- Ve el promedio de cada bimestre, cuatrimestre y nota final

### Regente
- Visualiza todas las materias de todos los profesores
- Puede tener permiso de lectura o escritura según configuración

### Preceptor
- Visualiza todas las materias de los cursos que tiene asignados
- Acceso de solo lectura: no puede cargar ni modificar notas
- Se asigna a cursos específicos mediante la tabla `preceptor_curso`

---

## Lógica de calificaciones

### Promedios de bimestre
Cada bimestre muestra al pie de la celda su promedio calculado sobre las evaluaciones que lo componen, excluyendo participaciones del promedio base (estas se suman como ajuste).

### Evaluaciones acumulativas
Una evaluación puede marcarse como **acumulativa** de una evaluación anterior desaprobada, de cualquier bimestre. Si la acumulativa se aprueba (≥ 6):
- La evaluación saldada queda tachada visualmente como registro histórico.
- El bimestre donde vivía la saldada **sigue mostrándose como DESAPROBADO** (registro permanente).
- El cuatrimestre se recalcula **excluyendo la nota saldada** del promedio efectivo.

Si la acumulativa también se desaprueba, no salda nada y el bimestre permanece DESAPROBADO.

### Cálculo del cuatrimestre
El cuatrimestre usa los valores **efectivos** de cada bimestre (excluyendo saldadas). Si algún bimestre efectivo queda DESAPROBADO, el cuatrimestre es DESAPROBADO.

### Cierres administrativos
Se habilitan automáticamente cuando el promedio anual es menor a 6 o algún cuatrimestre quedó DESAPROBADO:
- **1er cierre** → Diciembre
- **2do cierre** → Febrero
- Si aprueba (≥ 6) en algún cierre → esa nota es la nota final
- Si no aprueba ninguno → nota final: **PREVIA**

---

## Estructura del proyecto

```txt
gestion-notas/
│
├── db/
│   └── connection.js              # Pool de conexiones MariaDB (usa variables de entorno)
│
├── middleware/
│   └── auth.js                    # Verificación de JWT en cada request protegido
│
├── public/
│   ├── api.js                     # Helper apiFetch + escHTML (compartido por todas las páginas)
│   ├── cambiar.html               # Cambio obligatorio de contraseña al primer ingreso
│   ├── dashboard.html             # Dashboard con tarjetas de materias
│   ├── index.html                 # Pantalla de login
│   ├── planilla.html              # Planilla de notas por materia
│   ├── scriptDashboard.js
│   ├── scriptLogin.js
│   ├── scriptPlanilla.js
│   └── styleLogin.css
│
├── routes/
│   ├── auth.js                    # POST /api/login · POST /api/cambiar-password
│   ├── dash.js                    # GET /dashboard/:id
│   └── planilla.js                # GET · POST · DELETE /planilla/...
│
├── .env                           # Variables de entorno — NO incluir en el repositorio
├── .gitignore
├── package.json
└── server.js
```

---

## Instalación

### 1. Clonar repositorio

```bash
git clone https://github.com/nazarenoapicella/Gestion-de-notas
cd gestion-notas
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Crear el archivo `.env` en la raíz del proyecto:

```env
JWT_SECRET=reemplazar_por_clave_generada_aleatoriamente
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=colegio
PORT=3000
```

Generar un JWT_SECRET seguro:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## Base de datos

### Crear base de datos

```sql
CREATE DATABASE colegio;
USE colegio;
```

### Tablas

```sql
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nombre VARCHAR(50),
    apellido VARCHAR(50),
    dni VARCHAR(20),
    rango ENUM('profesor','alumno','regente','preceptor') NOT NULL,
    permiso ENUM('lectura','escritura','ambos') NOT NULL,
    debe_cambiar_password TINYINT(1) DEFAULT 0
);

CREATE TABLE cursos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    anio INT NOT NULL,
    division VARCHAR(5) NOT NULL,
    turno ENUM('manana','tarde','noche') NOT NULL
);

CREATE TABLE materias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL
);

CREATE TABLE curso_materia (
    id INT AUTO_INCREMENT PRIMARY KEY,
    curso_id INT NOT NULL,
    materia_id INT NOT NULL,
    dias VARCHAR(50),
    horario VARCHAR(50),
    FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE alumno_curso (
    id INT AUTO_INCREMENT PRIMARY KEY,
    alumno_id INT NOT NULL,
    curso_id INT NOT NULL,
    UNIQUE KEY uq_alumno_curso (alumno_id, curso_id),
    FOREIGN KEY (alumno_id) REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE profesor_materia (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profesor_id INT NOT NULL,
    curso_materia_id INT NOT NULL,
    UNIQUE KEY uq_profesor_materia (profesor_id, curso_materia_id),
    FOREIGN KEY (profesor_id) REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (curso_materia_id) REFERENCES curso_materia(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE preceptor_curso (
    id INT AUTO_INCREMENT PRIMARY KEY,
    preceptor_id INT NOT NULL,
    curso_id INT NOT NULL,
    UNIQUE KEY uq_preceptor_curso (preceptor_id, curso_id),
    FOREIGN KEY (preceptor_id) REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE evaluaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    curso_materia_id INT NOT NULL,
    tipo ENUM('Examen escrito','Oral','TP','Participacion +0.5','Participacion +1','Participacion -0.5'),
    descripcion VARCHAR(500),
    fecha DATE,
    bimestre INT,
    cierre INT,
    es_acumulativo TINYINT(1) NOT NULL DEFAULT 0,
    evaluacion_origen_id INT UNSIGNED DEFAULT NULL,
    FOREIGN KEY (curso_materia_id) REFERENCES curso_materia(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (evaluacion_origen_id) REFERENCES evaluaciones(id) ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE notas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    evaluacion_id INT NOT NULL,
    alumno_id INT NOT NULL,
    nota DECIMAL(4,2) NOT NULL,
    UNIQUE KEY uq_nota (evaluacion_id, alumno_id),
    FOREIGN KEY (evaluacion_id) REFERENCES evaluaciones(id) ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY (alumno_id) REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE
);
```

### Crear un usuario administrador inicial

Generar hash de contraseña:

```bash
node hash.js
```

Insertar usuarios de ejemplo:

```sql
-- Profesor
INSERT INTO usuarios (usuario, password, nombre, apellido, dni, rango, permiso, debe_cambiar_password)
VALUES ('profe1', '<hash>', 'Nombre', 'Apellido', '00000000', 'profesor', 'escritura', 1);

-- Alumno
INSERT INTO usuarios (usuario, password, nombre, apellido, dni, rango, permiso, debe_cambiar_password)
VALUES ('alumno1', '<hash>', 'Nombre', 'Apellido', '00000001', 'alumno', 'lectura', 1);

-- Regente
INSERT INTO usuarios (usuario, password, nombre, apellido, dni, rango, permiso, debe_cambiar_password)
VALUES ('regente1', '<hash>', 'Nombre', 'Apellido', '00000002', 'regente', 'ambos', 1);

-- Preceptor
INSERT INTO usuarios (usuario, password, nombre, apellido, dni, rango, permiso, debe_cambiar_password)
VALUES ('prece1', '<hash>', 'Nombre', 'Apellido', '00000003', 'preceptor', 'lectura', 1);
```

Asignar preceptor a un curso:

```sql
INSERT INTO preceptor_curso (preceptor_id, curso_id) VALUES (ID_PRECEPTOR, ID_CURSO);
```

---

## Ejecutar el proyecto

```bash
# Producción
npm start

# Desarrollo (con auto-reload, Node.js 18+)
npm run dev
```

Servidor disponible en:

```txt
http://localhost:3000
```

---

## Seguridad implementada

| Mecanismo | Descripción |
|---|---|
| JWT (JSON Web Tokens) | Autenticación stateless, token válido 8 horas por jornada escolar |
| bcrypt (salt 10) | Hash seguro de contraseñas, nunca se almacena texto plano |
| Dummy hash timing-safe | Prevención de enumeración de usuarios por diferencia de tiempo de respuesta |
| Rate limiting | Máximo 10 intentos de login por IP cada 15 minutos |
| Helmet | Headers de seguridad HTTP: X-Frame-Options, X-Content-Type-Options, HSTS y otros |
| authMiddleware | Verifica JWT en todas las rutas protegidas |
| Validación de ownership | Profesores solo acceden a sus propias materias; preceptores solo a sus cursos asignados |
| Validación de rango | Lista blanca de roles válidos en login |
| Sanitización XSS | escHTML() previene inyección de HTML en el frontend |
| Consultas parametrizadas | Sin riesgo de SQL injection |
| Validación de entrada | Tipos, rangos y longitudes verificados en el backend antes de tocar la BD |
| Body size limit | Máximo 10 kb por request JSON |
| Variables de entorno | Credenciales fuera del código fuente |
| Manejo de errores global | Handler de errores y listeners de unhandledRejection/uncaughtException en server.js |
| Transacciones BD | INSERT y DELETE críticos dentro de transacciones con rollback ante error |

---

## Endpoints de la API

| Método | Ruta | Auth requerida | Descripción |
|---|---|---|---|
| POST | `/api/login` | No | Iniciar sesión, recibir token JWT |
| POST | `/api/cambiar-password` | JWT | Cambiar contraseña del usuario autenticado |
| GET | `/dashboard/:id` | JWT | Obtener materias según rol del usuario |
| GET | `/planilla/:cmId/:uId` | JWT | Obtener planilla de notas de una materia |
| POST | `/planilla/evaluacion` | JWT | Agregar evaluación a un alumno (incluye cierres administrativos) |
| POST | `/planilla/evaluacion-global` | JWT | Agregar evaluación a todos los alumnos del curso |
| DELETE | `/planilla/evaluacion/:id` | JWT | Eliminar evaluación de un alumno |

---

## Licencia

Proyecto educativo — Escuela Técnica N°35 "Ingeniero Eduardo Latzina". Uso libre para aprendizaje.