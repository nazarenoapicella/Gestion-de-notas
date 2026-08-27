const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "routes", "planilla.js");
const src = fs.readFileSync(filePath, "utf8");
const lines = src.split("\n");

const slice = (start, end) => lines.slice(start - 1, end).join("\n");

const header = slice(1, 124);
const getPlanilla = slice(126, 216);
const middleRoutes = slice(218, 626);
const exportHelpers = slice(932, 951);
const getPlantilla = slice(953, 1170);
const importHelpers = slice(1172, 1258);
const postImportar = slice(1260, 1406);

const result = [
  header,
  "",
  importHelpers,
  "",
  exportHelpers,
  "",
  getPlantilla,
  "",
  postImportar,
  "",
  middleRoutes,
  "});",
  "",
  getPlanilla,
  "",
  "module.exports = router;",
  "",
].join("\n");

fs.writeFileSync(filePath, result);
console.log("Written", result.split("\n").length, "lines");
