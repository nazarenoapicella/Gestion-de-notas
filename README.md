# Gestión de Notas — ET N°35

## Sistema escolar web de gestión académica

Sistema integral de gestión de calificaciones desarrollado para la **Escuela Técnica N°35 "Ingeniero Eduardo Latzina"** (Buenos Aires, Argentina). Permite registrar, calcular, auditar y emitir oficialmente las calificaciones de los alumnos de forma digital, centralizada y segura, con roles diferenciados para toda la comunidad educativa.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | HTML5 · CSS3 con tokens de diseño · JavaScript vanilla |
| Backend | Node.js 18+ · Express.js 5 |
| Base de datos | MariaDB 10.4+ / MySQL 8 |
| Autenticación | JSON Web Tokens (JWT) |
| Hash de contraseñas | bcrypt (salt 10) |
| Rate limiting | express-rate-limit |
| Generación de PDF | PDFKit |
| Empaquetado ZIP | archiver v7 |
| Envío de correo | Nodemailer (Gmail App Password) |
| Variables de entorno | dotenv |
| Tipografía | Inter (Google Fonts) |

---

## Roles del sistema

| Rol | Permiso | Descripción |
|---|---|---|
| **Profesor** | escritura / lectura / ambos | Sus cursos y materias asignadas. Carga global de notas, acumulativas y cierres |
| **Alumno** | lectura | Solo sus propias notas, sin carpetas intermedias |
| **Regente** | escritura / lectura / ambos | Todos los cursos y materias del colegio. Acceso a boletines |
| **Preceptor** | lectura | Cursos asignados específicamente. Solo lectura |
| **Secretario/a** | lectura | Todas las divisiones y alumnos. Emisión oficial de boletines en PDF |

---

## Funcionalidades

- Login seguro con JWT (8 horas) y rate limiting (10 intentos / 15 min por IP)
- Cambio obligatorio de contraseña en el primer ingreso
- Dashboard con navegación por carpetas de curso → materias (excepto alumno)
- Carga global de evaluaciones por curso completo
- Sistema de evaluaciones acumulativas (recuperatorios que saldan notas previas desaprobadas)
- Cálculo automático de promedios bimestrales, cuatrimestrales y nota final
- Cierres administrativos de Diciembre y Febrero con selectores dinámicos por alumno y tema
- Boletines oficiales en PDF con firma institucional, empaquetados en ZIP
- Envío automático de boletines por mail a alumno y familiar con detección automática del período cursado
- Diseño responsive con sistema de tokens CSS, Inter, degradés, sombras en capas y transiciones

---

## Estructura del proyecto

```
gestion-notas/
│
├── db/
│   └── connection.js          # Pool de conexiones MariaDB
│
├── middleware/
│   └── auth.js                # Verificación de JWT en rutas protegidas
│
├── lib/
│   ├── calculoNotas.js        # Lógica de promedios portada al backend (boletines)
│   ├── generarBoletinPDF.js   # Generador de PDFs con PDFKit
│   ├── detectarPeriodo.js     # Detección del bimestre/cierre más avanzado cursado
│   └── mailer.js              # Configuración y envío de mails via Gmail
│
├── routes/
│   ├── auth.js                # POST /api/login · POST /api/cambiar-password
│   ├── dash.js                # GET /dashboard/:id · GET /dashboard/curso/:cursoId
│   ├── planilla.js            # GET · POST · PATCH · DELETE /planilla/...
│   └── boletines.js           # GET /boletines/cursos · GET /boletines/generar/:cursoId
│
├── public/
│   ├── tokens.css             # Sistema de diseño compartido (variables CSS)
│   ├── index.html             # Login
│   ├── styleLogin.css
│   ├── scriptLogin.js
│   ├── dashboard.html         # Panel principal
│   ├── styleDashboard.css
│   ├── scriptDashboard.js
│   ├── planilla.html          # Tabla de notas
│   ├── stylePlanilla.css
│   ├── scriptPlanilla.js
│   ├── boletines.html         # Pantalla de secretario/a
│   ├── styleBoletines.css
│   ├── scriptBoletines.js
│   ├── cambiar.html           # Cambio de contraseña obligatorio
│   └── api.js                 # apiFetch() + escHTML() compartidos
│
├── .env                       # Variables de entorno — NO subir al repositorio
├── .gitignore
├── hash.js                    # Utilidad para generar hashes bcrypt
├── package.json
└── server.js                  # Punto de entrada del servidor
```

---

## Instalación completa

### 1. Clonar el repositorio

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
GMAIL_USER=secretaria.et35@gmail.com
GMAIL_APP_PASSWORD=clave_de_aplicacion_de_16_caracteres
```

Generar un JWT_SECRET seguro:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copiar el output de ese comando y pegarlo como valor de `JWT_SECRET`.

---

### 4. Crear la base de datos

Conectarse a MariaDB y ejecutar **todo el siguiente bloque SQL de una vez** (es seguro ejecutarlo completo, no requiere ajustes previos):

```sql
-- ══════════════════════════════════════════════════════════════════
--  BASE DE DATOS — GESTIÓN DE NOTAS · ET N°35
--  Ejecutar completo en la consola de MariaDB / MySQL
-- ══════════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS colegio
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE colegio;

-- ── Tablas base (sin dependencias externas) ─────────────────────────

CREATE TABLE IF NOT EXISTS usuarios (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  usuario                VARCHAR(50)                                    NOT NULL UNIQUE,
  password               VARCHAR(255)                                   NOT NULL,
  nombre                 VARCHAR(50)                                    DEFAULT NULL,
  apellido               VARCHAR(50)                                    DEFAULT NULL,
  dni                    VARCHAR(20)                                    DEFAULT NULL,
  rango                  ENUM('profesor','alumno','regente',
                              'preceptor','secretario')                 NOT NULL,
  permiso                ENUM('lectura','escritura','ambos')            NOT NULL,
  debe_cambiar_password  TINYINT(1)                                     NOT NULL DEFAULT 1,
  email_usuario          VARCHAR(150)                                   NOT NULL DEFAULT '',
  email_familiar         VARCHAR(150)                                   NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cursos (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  anio      INT                                NOT NULL,
  division  VARCHAR(5)                         NOT NULL,
  turno     ENUM('manana','tarde','noche')     NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS materias (
  id      INT AUTO_INCREMENT PRIMARY KEY,
  nombre  VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── Tablas de relación (dependen de las anteriores) ─────────────────

CREATE TABLE IF NOT EXISTS curso_materia (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  curso_id   INT          NOT NULL,
  materia_id INT          NOT NULL,
  dias       VARCHAR(50)  DEFAULT NULL,
  horario    VARCHAR(50)  DEFAULT NULL,
  UNIQUE KEY uq_curso_materia (curso_id, materia_id),
  CONSTRAINT fk_cm_curso   FOREIGN KEY (curso_id)   REFERENCES cursos(id)   ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cm_materia FOREIGN KEY (materia_id) REFERENCES materias(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS alumno_curso (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  alumno_id INT NOT NULL,
  curso_id  INT NOT NULL,
  UNIQUE KEY uq_alumno_curso (alumno_id, curso_id),
  CONSTRAINT fk_ac_alumno FOREIGN KEY (alumno_id) REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_ac_curso  FOREIGN KEY (curso_id)  REFERENCES cursos(id)   ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profesor_materia (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  profesor_id      INT NOT NULL,
  curso_materia_id INT NOT NULL,
  UNIQUE KEY uq_profesor_materia (profesor_id, curso_materia_id),
  CONSTRAINT fk_pm_profesor      FOREIGN KEY (profesor_id)      REFERENCES usuarios(id)      ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_pm_curso_materia FOREIGN KEY (curso_materia_id) REFERENCES curso_materia(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS preceptor_curso (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  preceptor_id INT NOT NULL,
  curso_id     INT NOT NULL,
  UNIQUE KEY uq_preceptor_curso (preceptor_id, curso_id),
  CONSTRAINT fk_pc_preceptor FOREIGN KEY (preceptor_id) REFERENCES usuarios(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_pc_curso     FOREIGN KEY (curso_id)     REFERENCES cursos(id)   ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS evaluaciones (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  curso_materia_id     INT          NOT NULL,
  tipo                 ENUM('Examen escrito','Oral','TP',
                            'Participacion +0.5','Participacion +1',
                            'Participacion -0.5',
                            'Cierre Diciembre','Cierre Febrero') DEFAULT NULL,
  descripcion          VARCHAR(500) DEFAULT NULL,
  fecha                DATE         DEFAULT NULL,
  bimestre             INT          DEFAULT NULL,
  cierre               INT          DEFAULT NULL,
  es_acumulativo       TINYINT(1)   NOT NULL DEFAULT 0,
  evaluacion_origen_id INT          DEFAULT NULL,
  CONSTRAINT fk_ev_curso_materia FOREIGN KEY (curso_materia_id)     REFERENCES curso_materia(id) ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT fk_ev_origen        FOREIGN KEY (evaluacion_origen_id) REFERENCES evaluaciones(id)  ON DELETE CASCADE  ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notas (
  id            INT          AUTO_INCREMENT PRIMARY KEY,
  evaluacion_id INT          NOT NULL,
  alumno_id     INT          NOT NULL,
  nota          DECIMAL(4,2) NOT NULL,
  UNIQUE KEY uq_nota (evaluacion_id, alumno_id),
  CONSTRAINT fk_nota_evaluacion FOREIGN KEY (evaluacion_id) REFERENCES evaluaciones(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_nota_alumno     FOREIGN KEY (alumno_id)     REFERENCES usuarios(id)     ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

### 5. Cargar datos de ejemplo (copy-paste listo)

Este bloque crea una instalación de prueba completa: 2 cursos, 4 materias, 1 profesor asignado a todas, 1 regente, 1 preceptor, 1 secretario y 6 alumnos (3 por curso).

**Contraseña de todos los usuarios de prueba: `1234`**

```sql
USE colegio;

-- ── Materias ────────────────────────────────────────────────────────

INSERT INTO materias (nombre) VALUES
  ('Base de Datos'),
  ('Programacion'),
  ('Matematica'),
  ('Ingles');

-- ── Cursos ──────────────────────────────────────────────────────────

INSERT INTO cursos (anio, division, turno) VALUES
  (5, 'A', 'manana'),   -- id 1
  (4, 'A', 'manana');   -- id 2

-- ── Usuarios ────────────────────────────────────────────────────────
-- Hash generado con bcrypt salt 10 para la contraseña "1234"
-- Para generar un hash propio: node hash.js

INSERT INTO usuarios
  (usuario, password, nombre, apellido, dni, rango, permiso, debe_cambiar_password, email_usuario, email_familiar)
VALUES
  -- Regente (ve todo, puede cargar notas)
  ('regente01',
   '$2b$10$uUPTbv7R2.YgbWl0O7OtYO1lla1RsCdpJsCm6pYRlMZ47xlRA2kf6',
   'María', 'Fernandez', '11111111',
   'regente', 'ambos', 0,
   'regente@et35.edu.ar', 'regente.familiar@gmail.com'),         -- id 1

  -- Profesor (dicta todas las materias en ambos cursos)
  ('profe1',
   '$2b$10$uUPTbv7R2.YgbWl0O7OtYO1lla1RsCdpJsCm6pYRlMZ47xlRA2kf6',
   'Carlos', 'García', '22222222',
   'profesor', 'escritura', 0,
   'profe@et35.edu.ar', 'profe.familiar@gmail.com'),             -- id 2

  -- Preceptor (supervisa ambos cursos)
  ('prece01',
   '$2b$10$uUPTbv7R2.YgbWl0O7OtYO1lla1RsCdpJsCm6pYRlMZ47xlRA2kf6',
   'Ana', 'Rodríguez', '33333333',
   'preceptor', 'lectura', 0,
   'prece@et35.edu.ar', 'prece.familiar@gmail.com'),             -- id 3

  -- Secretario/a (emite boletines)
  ('secretaria1',
   '$2b$10$uUPTbv7R2.YgbWl0O7OtYO1lla1RsCdpJsCm6pYRlMZ47xlRA2kf6',
   'Laura', 'Sosa', '44444444',
   'secretario', 'lectura', 0,
   'secretaria@et35.edu.ar', 'secretaria.familiar@gmail.com'),   -- id 4

  -- Alumnos de 5°A (curso id 1)
  ('alumno1',
   '$2b$10$uUPTbv7R2.YgbWl0O7OtYO1lla1RsCdpJsCm6pYRlMZ47xlRA2kf6',
   'Martina', 'López', '55555555',
   'alumno', 'lectura', 0,
   'martina@alumno.et35.edu.ar', 'familia.lopez@gmail.com'),     -- id 5

  ('alumno2',
   '$2b$10$uUPTbv7R2.YgbWl0O7OtYO1lla1RsCdpJsCm6pYRlMZ47xlRA2kf6',
   'Juan', 'Pérez', '66666666',
   'alumno', 'lectura', 0,
   'juan@alumno.et35.edu.ar', 'familia.perez@gmail.com'),        -- id 6

  ('alumno3',
   '$2b$10$uUPTbv7R2.YgbWl0O7OtYO1lla1RsCdpJsCm6pYRlMZ47xlRA2kf6',
   'Sofía', 'Ramírez', '77777777',
   'alumno', 'lectura', 0,
   'sofia@alumno.et35.edu.ar', 'familia.ramirez@gmail.com'),     -- id 7

  -- Alumnos de 4°A (curso id 2)
  ('alumno4',
   '$2b$10$uUPTbv7R2.YgbWl0O7OtYO1lla1RsCdpJsCm6pYRlMZ47xlRA2kf6',
   'Lucas', 'Gómez', '88888888',
   'alumno', 'lectura', 0,
   'lucas@alumno.et35.edu.ar', 'familia.gomez@gmail.com'),       -- id 8

  ('alumno5',
   '$2b$10$uUPTbv7R2.YgbWl0O7OtYO1lla1RsCdpJsCm6pYRlMZ47xlRA2kf6',
   'Valentina', 'Sosa', '99999999',
   'alumno', 'lectura', 0,
   'valentina@alumno.et35.edu.ar', 'familia.sosa@gmail.com'),    -- id 9

  ('alumno6',
   '$2b$10$uUPTbv7R2.YgbWl0O7OtYO1lla1RsCdpJsCm6pYRlMZ47xlRA2kf6',
   'Tomás', 'Rodríguez', '10101010',
   'alumno', 'lectura', 0,
   'tomas@alumno.et35.edu.ar', 'familia.rodriguez@gmail.com');   -- id 10

-- ── Curso_materia ────────────────────────────────────────────────────
-- 5°A tiene las 4 materias · 4°A tiene Base de Datos e Inglés

INSERT INTO curso_materia (curso_id, materia_id, dias, horario) VALUES
  (1, 1, 'Lunes y Miercoles', '08:00 - 10:00'),  -- id 1: 5°A · Base de Datos
  (1, 2, 'Martes y Jueves',   '08:00 - 10:00'),  -- id 2: 5°A · Programacion
  (1, 3, 'Miercoles',         '10:00 - 12:00'),  -- id 3: 5°A · Matematica
  (1, 4, 'Viernes',           '10:00 - 12:00'),  -- id 4: 5°A · Ingles
  (2, 1, 'Lunes',             '14:00 - 16:00'),  -- id 5: 4°A · Base de Datos
  (2, 4, 'Jueves',            '14:00 - 16:00');  -- id 6: 4°A · Ingles

-- ── Profesor_materia ─────────────────────────────────────────────────
-- profe1 (id 2) dicta las 6 instancias

INSERT INTO profesor_materia (profesor_id, curso_materia_id) VALUES
  (2, 1), (2, 2), (2, 3), (2, 4), (2, 5), (2, 6);

-- ── Preceptor_curso ──────────────────────────────────────────────────
-- prece01 (id 3) supervisa ambos cursos

INSERT INTO preceptor_curso (preceptor_id, curso_id) VALUES
  (3, 1), (3, 2);

-- ── Alumno_curso ─────────────────────────────────────────────────────
-- alumnos 1-3 (ids 5-7) → 5°A · alumnos 4-6 (ids 8-10) → 4°A

INSERT INTO alumno_curso (alumno_id, curso_id) VALUES
  (5, 1), (6, 1), (7, 1),
  (8, 2), (9, 2), (10, 2);
```

---

### 6. Generar hash de contraseña para nuevos usuarios

Cuando debas crear un usuario nuevo en producción, generá el hash primero:

```bash
node hash.js
# Escribí la contraseña que querés usar, copiá el hash generado
# y usalo en el INSERT de usuarios
```

---

### 7. Iniciar el servidor

```bash
npm start
```

Verificar en la consola que aparezca:
```
Servidor corriendo en http://localhost:3000
```

Acceder desde el navegador en el mismo equipo:
```
http://localhost:3000
```

Acceder desde otro equipo de la misma red (reemplazar por la IP real del servidor):
```
http://192.168.1.50:3000
```

Para saber la IP del servidor:
- Windows: `ipconfig` en cmd
- Linux: `ip addr` o `hostname -I`

---

### 8. Mantener el servidor siempre activo (producción)

```bash
npm install -g pm2
pm2 start server.js --name gestion-notas
pm2 startup      # genera el comando para que arranque al encender el equipo
pm2 save         # guarda la configuración
```

Comandos útiles de PM2:

```bash
pm2 status                       # ver si el proceso está corriendo
pm2 logs gestion-notas           # ver los logs en tiempo real
pm2 restart gestion-notas        # reiniciar tras actualizar código
pm2 stop gestion-notas           # detener el servidor
```

---

### 9. Configurar Gmail para envío de boletines

1. Ir a [myaccount.google.com](https://myaccount.google.com)
2. Seguridad → Verificación en dos pasos → activar
3. Seguridad → Contraseñas de aplicaciones → crear una para "Mail"
4. Copiar la clave de 16 caracteres generada
5. Pegarla en `.env` como valor de `GMAIL_APP_PASSWORD`

> La cuenta de Gmail gratuita tiene un límite de ~500 mails por día. Si el colegio tiene muchos cursos y emite boletines el mismo día para varios, considerar Google Workspace.

---

## Seguridad

| Mecanismo | Descripción |
|---|---|
| JWT (8 horas) | Autenticación stateless, una jornada escolar completa |
| bcrypt salt 10 | Contraseñas nunca almacenadas en texto plano |
| Dummy hash timing-safe | Previene enumeración de usuarios por diferencia de tiempo de respuesta |
| Rate limiting | 10 intentos de login por IP cada 15 minutos |
| authMiddleware | JWT verificado en cada ruta protegida |
| Validación de ownership | Profesores solo acceden a sus materias; preceptores a sus cursos asignados |
| Sanitización XSS | `escHTML()` en todo el frontend antes de inyectar en el DOM |
| Consultas parametrizadas | Sin concatenación de strings en SQL, sin riesgo de injection |
| Validación de entrada | Tipos, rangos y longitudes verificados en el backend |
| Body size limit | Máximo 10 kb por request JSON |
| Variables de entorno | Secretos fuera del código fuente |
| Transacciones BD | INSERT y DELETE críticos con rollback automático ante error |
| Foreign keys CASCADE | Integridad referencial automática en toda la base de datos |

---

## Lógica de negocio — Resumen

### Tipos de evaluación
- **Examen / Oral / TP:** nota de 1 a 10, se promedian de forma convencional
- **Participación (+1 / +0.5 / -0.5):** ajuste sobre el promedio base del bimestre, no se promedia

### Evaluaciones acumulativas
Un profesor puede marcar una evaluación nueva como "acumulativa" de una anterior desaprobada:
- Si la acumulativa aprueba (≥6) y la original estaba desaprobada (<6): la original queda **saldada** (tachada, excluida del promedio)
- Si la acumulativa y la saldada están en el **mismo bimestre**: el bimestre se recalcula sin la nota saldada
- Si están en **bimestres distintos**: el bimestre de origen queda DESAPROBADO de forma permanente como registro histórico, pero el cuatrimestre sí puede aprobar

### Cuatrimestres
- 1er Cuatrimestre = promedio efectivo del 1° y 2° Bimestre
- 2do Cuatrimestre = promedio efectivo del 3° y 4° Bimestre
- Si algún bimestre efectivo es DESAPROBADO → cuatrimestre DESAPROBADO completo

### Cierres administrativos
- Se habilitan automáticamente cuando el promedio anual < 6 o algún cuatrimestre quedó DESAPROBADO
- **Diciembre:** selectores dinámicos de alumno + tema adeudado; se actualiza al cargar notas
- **Febrero:** igual, pero solo muestra los temas desaprobados en Diciembre
- Nota final = nota del cierre donde aprueba · si no aprueba ninguno = **PREVIA**

---

## Endpoints de la API

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/login` | No | Iniciar sesión, recibir token JWT |
| POST | `/api/cambiar-password` | JWT | Cambiar contraseña del usuario autenticado |
| GET | `/dashboard/:id` | JWT | Cursos (prof/prece/reg) o materias directas (alumno) |
| GET | `/dashboard/curso/:cursoId` | JWT | Materias de un curso, con validación de ownership |
| GET | `/planilla/:cmId/:uId` | JWT | Planilla completa de notas de una materia |
| POST | `/planilla/evaluacion-global` | JWT | Carga global de evaluación para todo el curso |
| PATCH | `/planilla/cierre-tema` | JWT | Nota de un tema en cierre de Diciembre o Febrero |
| DELETE | `/planilla/evaluacion/:id` | JWT | Eliminar evaluación de un alumno |
| GET | `/boletines/cursos` | JWT | Listado de cursos para generación de boletines |
| GET | `/boletines/generar/:cursoId` | JWT | Genera ZIP de boletines PDF + envío de mails |

---

## Requisitos del servidor (instalación local)

### Hardware

| Componente | Mínimo | Recomendado |
|---|---|---|
| Procesador | Doble núcleo | Intel Core i3 o equivalente |
| RAM | 2 GB | 4 GB |
| Almacenamiento | 10 GB libres | 20 GB libres (SSD) |
| Red | WiFi / Ethernet interno | Ethernet (más estable) |

Una Raspberry Pi 4 (4 GB) o una PC de escritorio retirada de uso son suficientes.

### Software

| Requisito | Versión | Cómo verificar |
|---|---|---|
| Node.js | 18 o superior | `node --version` |
| MariaDB | 10.4+ (o MySQL 8) | `mysql --version` |
| npm | incluido con Node.js | `npm --version` |
| Git | cualquiera | `git --version` |

### Puertos

| Puerto | Uso | Acceso |
|---|---|---|
| `3000` | Servidor web | Toda la red interna |
| `3306` | MariaDB | Solo local (127.0.0.1) |

---

## .gitignore recomendado

```
node_modules/
.env
*.log
.DS_Store
Thumbs.db
```

---

## Credenciales de acceso para prueba (datos de ejemplo)

| Usuario | Contraseña | Rol | Ve |
|---|---|---|---|
| `regente01` | `1234` | Regente | Todas las materias de ambos cursos |
| `profe1` | `1234` | Profesor | Las 6 materias que dicta |
| `prece01` | `1234` | Preceptor | Todas las materias de 5°A y 4°A (solo lectura) |
| `secretaria1` | `1234` | Secretario/a | Pantalla de generación de boletines |
| `alumno1` | `1234` | Alumno | Sus notas en las 4 materias de 5°A |
| `alumno2` | `1234` | Alumno | Sus notas en las 4 materias de 5°A |
| `alumno3` | `1234` | Alumno | Sus notas en las 4 materias de 5°A |
| `alumno4` | `1234` | Alumno | Sus notas en las 2 materias de 4°A |
| `alumno5` | `1234` | Alumno | Sus notas en las 2 materias de 4°A |
| `alumno6` | `1234` | Alumno | Sus notas en las 2 materias de 4°A |

---

## Licencia

Proyecto educativo — Escuela Técnica N°35 "Ingeniero Eduardo Latzina". Uso libre para aprendizaje.