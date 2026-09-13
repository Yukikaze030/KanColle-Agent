import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeFileSync } from "node:fs";

const db = new DatabaseSync(join(tmpdir(), "nga-cookies.db"), { readOnly: true });
const rows = db
  .prepare(
    `SELECT host_key, name, encrypted_value FROM cookies
     WHERE host_key LIKE '%nga%' OR host_key LIKE '%178%' LIMIT 50`,
  )
  .all();
const items = rows.map((r) => ({
  host: r.host_key,
  name: r.name,
  b64: Buffer.from(r.encrypted_value).toString("base64"),
}));
writeFileSync(
  join(process.cwd(), "scripts", "nga-cookie-values.json"),
  JSON.stringify(items, null, 2),
);
console.log("dumped", items.length);
db.close();
