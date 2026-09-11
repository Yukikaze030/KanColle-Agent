const fs = require("fs");
const buf = fs.readFileSync("C:/Program Files/Poi/resources/app.asar");
const text = buf.toString("utf8");
const start = text.indexOf("name: 'resources'");
if (start < 0) {
  console.error("resources slice not found");
  process.exit(1);
}
const chunk = text.slice(start, start + 5000);
console.log(chunk.replace(/[\x00-\x1F]/g, " "));
