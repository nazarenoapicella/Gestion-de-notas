const express = require("express");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api",       require("./routes/auth"));
app.use("/dashboard", require("./routes/dash"));
app.use("/planilla",  require("./routes/planilla"));

app.listen(3000, () => {
  console.log("Servidor corriendo en http://localhost:3000");
});