# Gestión de Notas — ET N°35

## Sistema escolar web de gestión académica

Sistema integral de gestión de calificaciones desarrollado para la Escuela Técnica N°35 "Ingeniero Eduardo Latzina". Permite registrar, calcular, auditar y emitir oficialmente las calificaciones de los alumnos de forma digital, centralizada y segura, con roles diferenciados para toda la comunidad educativa.

| Capa | Tecnología |
|---|---|
| Frontend | HTML5 · CSS3 (Inter, sistema de diseño con tokens) · JavaScript vanilla |
| Backend | Node.js · Express.js 5 |
| Base de datos | MariaDB / MySQL |
| Autenticación | JSON Web Tokens (JWT) |
| Hash de contraseñas | bcrypt |
| Rate limiting | express-rate-limit |
| Generación de PDF | PDFKit |
| Empaquetado ZIP | archiver |
| Envío de correo | Nodemailer (Gmail con contraseña de aplicación) |
| Variables de entorno | dotenv |

---

## Roles del sistema

| Rol | Acceso |
|---|---|
| **Profesor** | Sus cursos y materias asignadas. Carga global de notas, evaluaciones acumulativas, cierres administrativos |
| **Alumno** | Solo sus propias notas, sin carpetas intermedias |
| **Regente** | Todos los cursos y materias del colegio. Permiso configurable (lectura / escritura / ambos). Acceso a emisión de boletines |
| **Preceptor** | Cursos asignados específicamente. Solo lectura |
| **Secretario/a** | Todas las divisiones, materias y alumnos. Solo lectura. Función exclusiva: emisión oficial de boletines en PDF y envío por mail |

---

## Funcionalidades principales

- Login seguro con JWT (8 horas de validez) y rate limiting (10 intentos / 15 min por IP)
- Cambio obligatorio de contraseña en el primer ingreso
- Dashboard con navegación por carpetas de curso → materias (excepto alumno, que ve sus materias directo)
- Carga global de evaluaciones por curso completo (examen, oral, TP, participación con ajustes +1/+0.5/-0.5)
- Sistema de evaluaciones acumulativas: una evaluación puede saldar una anterior desaprobada, dejando registro histórico tachado
- Cálculo automático de promedios por bimestre, cuatrimestre y nota final
- Cierres administrativos de Diciembre y Febrero con selección dinámica de alumno + tema adeudado
- Nota final con lógica de PREVIA si no se aprueba ningún cierre
- Emisión de boletines oficiales en PDF (uno por alumno) con firma institucional, descarga en ZIP
- Envío automático de boletines por correo a alumno y familiar, con detección del período más avanzado cursado
- Diseño responsive con sistema visual propio (degradés, sombras en capas, transiciones)

---

## Lógica de negocio — Cálculo de calificaciones

### Tipos de evaluación y ajustes
- Examen escrito, Oral, Trabajo Práctico: se promedian de forma convencional
- Participación +1 / +0.5 / -0.5: se suman o restan directamente sobre el promedio base del bimestre (no son notas que se promedian, son ajustes)

### Evaluaciones acumulativas
Si un alumno desaprueba una evaluación (nota < 6), el profesor puede cargar una evaluación posterior marcada como "acumulativa" de la anterior. Reglas:
- Si la acumulativa se aprueba (≥6) y la evaluación original estaba desaprobada (<6): la original queda saldada (tachada, registro histórico)
- Si la acumulativa y la saldada pertenecen al **mismo bimestre**: se excluye la saldada del promedio y se calcula normalmente con el resto
- Si pertenecen a **bimestres distintos**: el bimestre de origen sigue mostrando DESAPROBADO como registro permanente, aunque esa nota puntual esté saldada
- Si la evaluación original ya tenía nota ≥6, una acumulativa que la referencie no salda nada (no hay nada que saldar)

### Bimestres y cuatrimestres
- Bimestre DESAPROBADO: si tiene cualquier evaluación normal con nota <6 sin saldar
- 1er Cuatrimestre = promedio efectivo de 1° y 2° Bimestre (excluyendo notas saldadas)
- 2do Cuatrimestre = promedio efectivo de 3° y 4° Bimestre
- Si algún bimestre efectivo es DESAPROBADO, el cuatrimestre completo es DESAPROBADO sin importar el promedio numérico

### Cierres administrativos (Diciembre y Febrero)
- Se habilitan automáticamente cuando el promedio anual es menor a 6 o algún cuatrimestre quedó DESAPROBADO
- **1er Cierre (Diciembre):** el profesor selecciona, por alumno, el tema adeudado (cualquier nota <6 sin saldar, de cualquier bimestre o cierre anterior) y carga la nueva nota
- **2do Cierre (Febrero):** el profesor selecciona, por alumno, alguno de los temas que seguían desaprobados tras diciembre, y carga la nueva nota
- Ambos cierres son dinámicos: a medida que se cargan notas, los alumnos/temas que ya aprobaron desaparecen de los selectores
- Nota final = la nota del cierre donde aprobó (≥6); si no aprueba en ningún cierre, la nota final es **PREVIA**

---

## Generación y envío de boletines

### Boletín en PDF (PDFKit)
Generado en el servidor, un archivo por alumno, con:
- Encabezado institucional con degradé
- Datos del alumno (nombre, apellido, DNI, curso, turno)
- Una tabla por materia con: 1er y 2do Bimestre, 1er Cuatrimestre, 3er y 4to Bimestre, 2do Cuatrimestre, 1er y 2do Cierre, Nota Final
- **Cualquier valor numérico menor a 6 se muestra en rojo** (no solo el texto "DESAPROBADO"), para que cualquier nota reprobatoria sea visualmente inequívoca
- Todos los períodos se muestran siempre, incluso vacíos (con "-"), para que el boletín sea consistente a lo largo del año sin importar cuántas veces se lo genere
- Salto de página automático cuando hay muchas materias
- Pie con espacios de firma para Preceptor/a, Regente y Dirección, dándole validez institucional al documento impreso

### Descarga en ZIP
El secretario o regente selecciona un curso desde una pantalla dedicada y genera todos los boletines de una vez. Se descarga un único archivo ZIP que contiene un PDF independiente por alumno (ej: `Boletin_Lopez_Martina.pdf`), pensado para que cada PDF sea una unidad atómica reutilizable en el envío de mails.

### Envío automático por correo (Nodemailer + Gmail)
Al generar los boletines, opcionalmente se envían dos correos por alumno:
- Uno a `email_usuario` (el alumno)
- Uno a `email_familiar` (la familia)

El asunto del mail es `"Se envía informe: <período>"`, donde el período se determina automáticamente como **el bimestre o cierre más avanzado del año en el que el alumno tiene al menos una nota cargada**, mirando todas sus materias en conjunto (por ejemplo, si una materia ya tiene 3er bimestre cargado y otra solo 1er bimestre, el período informado es "3er Bimestre"). El envío usa autenticación de Gmail con contraseña de aplicación.

---

## Roles y navegación del dashboard

- **Alumno:** ve directamente sus materias (sin carpetas intermedias)
- **Profesor / Preceptor / Regente:** navegan primero por carpetas de curso (5°A, 4°A, etc.) y al entrar ven las materias de ese curso específico, con botón de "Volver a cursos"
- **Secretario:** accede directamente a una pantalla dedicada de generación de boletines (no usa el dashboard de materias)
- El Regente tiene además acceso directo a la emisión de boletines desde su dashboard

---

## Seguridad implementada

| Mecanismo | Descripción |
|---|---|
| JWT (JSON Web Tokens) | Autenticación stateless, token válido 8 horas por jornada escolar |
| bcrypt (salt 10) | Hash seguro de contraseñas, nunca se almacena texto plano |
| Dummy hash timing-safe | Prevención de enumeración de usuarios por diferencia de tiempo de respuesta |
| Rate limiting | Máximo 10 intentos de login por IP cada 15 minutos |
| authMiddleware | Verifica JWT en todas las rutas protegidas |
| Validación de ownership | Profesores solo acceden a sus propias materias; preceptores solo a sus cursos asignados; secretario y regente con acceso total controlado por rol |
| Validación de rango | Lista blanca de roles válidos en login |
| Sanitización XSS | escHTML() previene inyección de HTML en el frontend |
| Consultas parametrizadas | Sin riesgo de SQL injection |
| Validación de entrada | Tipos, rangos y longitudes verificados en el backend antes de tocar la BD |
| Body size limit | Máximo 10 kb por request JSON |
| Variables de entorno | Credenciales y secretos (JWT, Gmail) fuera del código fuente |
| Manejo de errores global | Handler de errores y listeners de unhandledRejection/uncaughtException en server.js |
| Transacciones BD | INSERT y DELETE críticos dentro de transacciones con rollback ante error |
| Foreign keys con ON DELETE CASCADE | Integridad referencial automática entre evaluaciones, notas y sus orígenes acumulativos |

---

## Modelo de datos

### Tablas principales
- `usuarios` — todos los actores del sistema (rango: profesor, alumno, regente, preceptor, secretario), con `email_usuario` y `email_familiar` para el envío de boletines
- `cursos` — año, división, turno
- `materias` — catálogo de materias
- `curso_materia` — relación curso↔materia con días y horario
- `profesor_materia` — asignación de profesores a curso_materia
- `preceptor_curso` — asignación de preceptores a cursos completos
- `alumno_curso` — inscripción de alumnos a cursos
- `evaluaciones` — exámenes, TPs, participaciones, cierres; incluye `es_acumulativo` y `evaluacion_origen_id` (autorreferencia) para el sistema de saldado
- `notas` — calificación de cada alumno por evaluación

### Relaciones clave
- Un alumno inscripto en un curso accede automáticamente a todas las materias de ese curso
- Un preceptor asignado a un curso ve todas sus materias en modo lectura
- Las evaluaciones de cierre (Diciembre/Febrero) referencian a la evaluación original que adeudan vía `evaluacion_origen_id`, con `ON DELETE CASCADE` para mantener integridad si se elimina la evaluación de origen

---

## Endpoints de la API

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/login` | No | Iniciar sesión, recibir token JWT |
| POST | `/api/cambiar-password` | JWT | Cambiar contraseña del usuario autenticado |
| GET | `/dashboard/:id` | JWT | Cursos (profesor/preceptor/regente) o materias directas (alumno) |
| GET | `/dashboard/curso/:cursoId` | JWT | Materias de un curso específico, validando ownership por rol |
| GET | `/planilla/:cmId/:uId` | JWT | Planilla de notas de una materia |
| POST | `/planilla/evaluacion-global` | JWT | Carga global de evaluación a todos los alumnos del curso |
| PATCH | `/planilla/cierre-tema` | JWT | Registrar nota de un tema en un cierre administrativo (Dic./Feb.) |
| DELETE | `/planilla/evaluacion/:id` | JWT | Eliminar evaluación de un alumno |
| GET | `/boletines/cursos` | JWT | Listado de cursos para generación de boletines (secretario/regente) |
| GET | `/boletines/generar/:cursoId` | JWT | Genera y descarga ZIP de boletines; opcionalmente envía mails |

---

## Diseño visual

El sistema utiliza un sistema de diseño propio (`tokens.css`) con:
- Tipografía **Inter** en toda la interfaz
- Paleta institucional negro/blanco con acentos funcionales por estado: verde (aprobado), rojo (desaprobado/alerta), violeta (cierres administrativos), azul (evaluaciones acumulativas)
- Sombras en capas para dar profundidad real sin perder sobriedad
- Degradés sutiles en headers y como barra de acento superior en cards y tablas
- Transiciones de 150-220ms en interacciones (hover, click, aparición de filas/cards)
- Diseño totalmente responsive: navegación adaptada en mobile, tablas con scroll horizontal contenido, formularios que pasan a una columna
- Accesibilidad: `prefers-reduced-motion` respetado, focus visible en todos los controles interactivos

---

## Estructura del proyecto

```txt
gestion-notas/
│
├── db/
│   └── connection.js              # Pool de conexiones MariaDB
│
├── middleware/
│   └── auth.js                    # Verificación de JWT
│
├── lib/
│   ├── calculoNotas.js            # Lógica de promedios (portada al backend para boletines)
│   ├── generarBoletinPDF.js       # Generador de boletines con PDFKit
│   ├── detectarPeriodo.js         # Detección del período más avanzado cursado
│   └── mailer.js                  # Configuración y envío de mails vía Gmail
│
├── routes/
│   ├── auth.js                    # Login y cambio de contraseña
│   ├── dash.js                    # Dashboard de cursos/materias por rol
│   ├── planilla.js                # CRUD de evaluaciones, notas y cierres
│   └── boletines.js               # Generación de PDF + ZIP + envío de mails
│
├── public/
│   ├── index.html / styleLogin.css / scriptLogin.js
│   ├── dashboard.html / styleDashboard.css / scriptDashboard.js
│   ├── planilla.html / stylePlanilla.css / scriptPlanilla.js
│   ├── boletines.html / styleBoletines.css / scriptBoletines.js
│   ├── cambiar.html
│   ├── tokens.css                 # Sistema de diseño compartido
│   └── api.js                     # apiFetch() + escHTML()
│
├── hash.js                        # Utilidad para generar hashes bcrypt
├── .env                           # Variables de entorno (no versionado)
├── package.json
└── server.js
```

---

## Stack tecnológico completo

| Categoría | Tecnología | Uso en el proyecto |
|---|---|---|
| Runtime | Node.js 18+ | Ejecuta todo el backend |
| Framework backend | Express.js 5 | Enrutamiento HTTP y middlewares |
| Base de datos | MariaDB 10.4+ / MySQL 8 | Persistencia de usuarios, cursos, notas |
| Driver de BD | mariadb (npm) | Pool de conexiones asíncrono |
| Autenticación | jsonwebtoken | Generación y verificación de JWT |
| Hashing | bcrypt | Hash de contraseñas con salt 10 |
| Rate limiting | express-rate-limit | Protección del endpoint de login |
| Generación de PDF | pdfkit | Boletines oficiales en PDF |
| Compresión | archiver (v7, API CommonJS) | Empaquetado de boletines en ZIP |
| Envío de mail | nodemailer | Envío de boletines vía Gmail (App Password) |
| Variables de entorno | dotenv | Configuración fuera del código fuente |
| Frontend | HTML5, CSS3, JavaScript vanilla | Sin frameworks ni bundlers |
| Tipografía | Inter (Google Fonts) | Sistema de diseño visual |

---

## Requisitos del servidor (instalación local)

### Hardware

| Componente | Mínimo | Recomendado |
|---|---|---|
| Procesador | Doble núcleo | Intel Core i3 o equivalente |
| Memoria RAM | 2 GB | 4 GB |
| Almacenamiento | 10 GB libres | 20 GB libres (SSD) |
| Red | Ethernet o WiFi a la red interna | Ethernet |

Una Raspberry Pi 4 (4GB) o una PC de escritorio retirada de uso administrativo son suficientes.

### Software

| Requisito | Versión | Verificación |
|---|---|---|
| Sistema operativo | Windows 10/11, Ubuntu Server 22.04 LTS, o Debian 12 | — |
| Node.js | 18 o superior | `node --version` |
| MariaDB | 10.4 o superior (o MySQL 8) | `mysql --version` |
| npm | incluido con Node.js | `npm --version` |
| Git (opcional) | cualquiera | `git --version` |

### Puertos de red

| Puerto | Uso | Exposición |
|---|---|---|
| 3000 | Acceso web al sistema | Accesible desde toda la red interna de la escuela |
| 3306 | MariaDB | Solo acceso local (127.0.0.1) |

### Pasos de instalación

```bash
git clone https://github.com/nazarenoapicella/Gestion-de-notas
cd gestion-notas
npm install
```

Crear `.env` en la raíz:
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

Generar el JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Crear la base de datos ejecutando el script SQL de tablas (ver Manual Técnico), luego:
```bash
npm start
```

Para mantener el servidor siempre activo (reinicio automático ante cortes de luz):
```bash
npm install -g pm2
pm2 start server.js --name gestion-notas
pm2 startup
pm2 save
```

### Configuración de Gmail para envío de boletines
1. Activar verificación en 2 pasos en la cuenta de Gmail institucional
2. Generar una "Contraseña de aplicación" en `myaccount.google.com/apppasswords`
3. Completar `GMAIL_USER` y `GMAIL_APP_PASSWORD` en el `.env`

> Nota: una cuenta gratuita de Gmail tiene un límite de ~500 mails/día. Para escuelas grandes con múltiples cursos emitiendo boletines el mismo día, considerar Google Workspace o un servicio SMTP dedicado a futuro.

---

## Licencia

Proyecto educativo — Escuela Técnica N°35 "Ingeniero Eduardo Latzina". Uso libre para aprendizaje.
