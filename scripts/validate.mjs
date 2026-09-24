import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(await fs.readFile(path.join(root, "config.json"), "utf8"));
const people = JSON.parse(await fs.readFile(path.join(root, "data", "employees.json"), "utf8")).filter((p) => p.active !== false);
if (!people.length) throw new Error("No active employee cards");
for (const person of people) {
  const page = path.join(root, "dist", person.slug, "index.html");
  const vcf = path.join(root, "dist", person.slug, "contact.vcf");
  const qr = path.join(root, "dist", person.slug, "share-qr.png");
  const pass = path.join(root, "build", "pass-source", person.slug, "pass.json");
  await Promise.all([page, vcf, qr, pass].map((p) => fs.access(p)));
  const passJson = JSON.parse(await fs.readFile(pass, "utf8"));
  if (passJson.serialNumber !== `remcert-${person.slug}`) throw new Error(`Bad serial for ${person.slug}`);
  if (passJson.passTypeIdentifier !== (process.env.PASS_TYPE_IDENTIFIER || config.passTypeIdentifier)) throw new Error(`Bad pass ID for ${person.slug}`);
}
console.log(`Validated ${people.length} employee card(s)`);
