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
| Variables de entorno | dotenv |

---

## Funcionalidades

- Login seguro con JWT y rate limiting (10 intentos / 15 min por IP)
- Cambio obligatorio de contraseña en el primer ingreso
- Roles diferenciados: profesor, alumno, regente
- Dashboard dinámico estilo Google Classroom con tarjetas por materia
- Gestión de notas por bimestre (1° a 4°)
- Cálculo automático de promedios bimestrales, cuatrimestrales y nota final
- Carga individual y global de evaluaciones por curso
- Tipos de evaluación: examen escrito, oral, TP, participación (+1 / +0.5 / -0.5)
- Control de acceso por materia y por alumno (un profesor solo accede a lo suyo)
- Protección XSS en el frontend (escHTML) y consultas parametrizadas en el backend

---

## Roles

### Profesor

- Visualiza sus materias asignadas
- Carga y elimina evaluaciones de sus cursos
- Accede a la planilla de cada curso

### Alumno

- Visualiza sus materias
- Consulta únicamente sus propias notas (no ve las de sus compañeros)

### Regente

- Visualiza todas las materias de todos los profesores
- Puede tener permiso de lectura o escritura según configuración

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

### Tablas necesarias

```sql
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nombre VARCHAR(100),
    apellido VARCHAR(100),
    dni VARCHAR(20),
    rango ENUM('profesor','alumno','regente') NOT NULL,
    permiso ENUM('lectura','escritura','ambos') NOT NULL,
    debe_cambiar_password TINYINT DEFAULT 0
);

CREATE TABLE cursos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    anio INT NOT NULL,
    division VARCHAR(10) NOT NULL,
    turno VARCHAR(20)
);

CREATE TABLE materias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL
);

CREATE TABLE curso_materia (
    id INT AUTO_INCREMENT PRIMARY KEY,
    curso_id INT NOT NULL,
    materia_id INT NOT NULL,
    dias VARCHAR(100),
    horario VARCHAR(50),
    FOREIGN KEY (curso_id) REFERENCES cursos(id),
    FOREIGN KEY (materia_id) REFERENCES materias(id)
);

CREATE TABLE alumno_curso (
    id INT AUTO_INCREMENT PRIMARY KEY,
    alumno_id INT NOT NULL,
    curso_id INT NOT NULL,
    FOREIGN KEY (alumno_id) REFERENCES usuarios(id),
    FOREIGN KEY (curso_id) REFERENCES cursos(id)
);

CREATE TABLE profesor_materia (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profesor_id INT NOT NULL,
    curso_materia_id INT NOT NULL,
    FOREIGN KEY (profesor_id) REFERENCES usuarios(id),
    FOREIGN KEY (curso_materia_id) REFERENCES curso_materia(id)
);

CREATE TABLE evaluaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    curso_materia_id INT NOT NULL,
    tipo VARCHAR(100),
    descripcion VARCHAR(500),
    fecha DATE,
    bimestre INT,
    cierre INT,
    FOREIGN KEY (curso_materia_id) REFERENCES curso_materia(id)
);

CREATE TABLE notas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    evaluacion_id INT NOT NULL,
    alumno_id INT NOT NULL,
    nota DECIMAL(4,2),
    FOREIGN KEY (evaluacion_id) REFERENCES evaluaciones(id),
    FOREIGN KEY (alumno_id) REFERENCES usuarios(id)
);
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
| Rate limiting | Máximo 10 intentos de login por IP cada 15 minutos |
| Timing-safe compare | Prevención de enumeración de usuarios por diferencia de tiempo |
| authMiddleware | Verifica JWT en todas las rutas protegidas |
| Validación de ownership | Profesores solo acceden a sus propias materias |
| Validación de rango | Lista blanca de roles válidos en login |
| Sanitización XSS | escHTML() previene inyección de HTML en el frontend |
| Consultas parametrizadas | Sin riesgo de SQL injection |
| Validación de entrada | Tipos, rangos y longitudes verificados en el backend |
| Body size limit | Máximo 10 kb por request JSON |
| Variables de entorno | Credenciales fuera del código fuente |

---

# Capturas

## Endpoints de la API

| Método | Ruta | Auth requerida | Descripción |
|---|---|---|---|
| POST | `/api/login` | No | Iniciar sesión, recibir token JWT |
| POST | `/api/cambiar-password` | JWT | Cambiar contraseña del usuario autenticado |
| GET | `/dashboard/:id` | JWT | Obtener materias según rol del usuario |
| GET | `/planilla/:cmId/:uId` | JWT | Obtener planilla de notas de una materia |
| POST | `/planilla/evaluacion` | JWT | Agregar evaluación individual a un alumno |
| POST | `/planilla/evaluacion-global` | JWT | Agregar evaluación a todos los alumnos del curso |
| DELETE | `/planilla/evaluacion/:id` | JWT | Eliminar evaluación de un alumno |

---

## Licencia

Proyecto educativo — Escuela Técnica N°35 "Ingeniero Eduardo Latzina". Uso libre para aprendizaje.