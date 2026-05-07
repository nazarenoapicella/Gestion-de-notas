# Gestion de notas

## Sistema Escolar Web

Sistema escolar desarrollado con:

- HTML
- CSS
- JavaScript
- Node.js
- Express
- MariaDB / MySQL

---

## El proyecto permite

- Login seguro
- Roles de usuario
- Dashboard dinamico tipo Classroom
- Visualizacion de materias
- Gestion de notas
- Relacion profesor - alumno - curso

---

# Caracteristicas

## Login seguro

- Verificacion con base de datos
- Contraseñas hasheadas con bcrypt
- Cambio obligatorio de contraseña en primer ingreso

---

## Roles

### Profesor

- Visualiza sus materias
- Administra notas

### Alumno

- Visualiza materias asignadas
- Consulta notas

### Regente

- Visualiza todas las materias
- Puede ver profesor asignado

---

# Dashboard dinamico

Tarjetas estilo Google Classroom mostrando:

- Materia
- Curso
- Division
- Dias
- Horario
- Profesor asociado

---

# Tecnologias utilizadas

## Frontend

- HTML5
- CSS3
- JavaScript

## Backend

- Node.js
- Express.js

## Base de datos

- MariaDB
- MySQL

## Seguridad

- bcrypt

---

# Estructura del proyecto

```txt
gestion-notas/
│
├── public/
│   ├── index.html
│   ├── dashboard.html
│   ├── scriptLogin.js
│   ├── scriptDashboard.js
│   └── styleLogin.css
│
├── routes/
│   ├── auth.js
│   └── dash.js
│
├── db/
│   └── connection.js
│
├── server.js
├── package.json
└── README.md
```

---

# Instalacion

## 1. Clonar repositorio

```bash
git clone https://github.com/nazarenoapicella/Gestion-de-notas
```

## 2. Entrar a carpeta

```bash
cd gestion-notas
```

## 3. Instalar dependencias

```bash
npm install
```

---

# Dependencias necesarias

```bash
npm install express mysql2 bcrypt
```

---

# Configuracion de MariaDB / XAMPP

1. Abrir XAMPP
2. Iniciar:
   - Apache
   - MySQL

---

# Crear base de datos

```sql
CREATE DATABASE colegio;
USE colegio;
```

---

# Ejecutar proyecto

```bash
node server.js
```

Servidor:

```txt
http://localhost:3000
```

---

# Seguridad implementada

- Hash de contraseñas con bcrypt
- Verificacion de roles
- Validacion backend
- Cambio obligatorio de contraseña

---

# Proximas mejoras

- CRUD de notas
- Promedios automaticos
- Boletines PDF
- Panel administrador
- JWT Authentication
- Deploy online
- Responsive avanzado
- Buscador de alumnos
- Estadisticas

---

# Capturas

## Login

Diseño moderno y responsive.

## Dashboard

Tarjetas dinamicas tipo Classroom.

---

# Licencia

Proyecto educativo. Uso libre para aprendizaje.