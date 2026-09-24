import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const dist = path.join(root, "dist");
const build = path.join(root, "build");
const passBuild = path.join(build, "pass-source");

const config = JSON.parse(await fs.readFile(path.join(root, "config.json"), "utf8"));
const people = JSON.parse(await fs.readFile(path.join(root, "data", "employees.json"), "utf8"))
  .filter((person) => person.active !== false);

const publicBaseUrl = (process.env.PUBLIC_BASE_URL || config.publicBaseUrl).replace(/\/$/, "");
const passTypeIdentifier = process.env.PASS_TYPE_IDENTIFIER || config.passTypeIdentifier;
const teamIdentifier = process.env.APPLE_TEAM_IDENTIFIER || config.teamIdentifier;
const walletPassesEnabled = process.env.WALLET_PASSES_ENABLED
  ? process.env.WALLET_PASSES_ENABLED === "true"
  : config.walletPassesEnabled;
const runtimeConfig = { ...config, walletPassesEnabled };

await validateRoster(people);
await fs.rm(dist, { recursive: true, force: true });
await fs.rm(build, { recursive: true, force: true });
await fs.mkdir(path.join(dist, "assets", "photos"), { recursive: true });
await fs.mkdir(passBuild, { recursive: true });
await fs.copyFile(path.join(root, "assets", "remcert-logo.png"), path.join(dist, "assets", "remcert-logo.png"));
await fs.writeFile(path.join(dist, ".nojekyll"), "");
if (config.customDomain) await fs.writeFile(path.join(dist, "CNAME"), `${config.customDomain}\n`);

for (const person of people) {
  const pageUrl = `${publicBaseUrl}/${encodeURIComponent(person.slug)}/`;
  const cardDir = path.join(dist, person.slug);
  const sourceDir = path.join(passBuild, person.slug);
  const photoSource = path.join(root, person.photo);
  await fs.access(photoSource);
  await fs.mkdir(cardDir, { recursive: true });
  await fs.mkdir(sourceDir, { recursive: true });

  const photoName = `${person.slug}.png`;
  await sharp(photoSource).rotate().resize(720, 720, { fit: "cover", position: "attention" })
    .png({ quality: 92 }).toFile(path.join(dist, "assets", "photos", photoName));

  const vcard = makeVCard(person, runtimeConfig);
  await fs.writeFile(path.join(cardDir, "contact.vcf"), vcard);
  await QRCode.toFile(path.join(cardDir, "share-qr.png"), pageUrl, {
    errorCorrectionLevel: "M",
    margin: 4,
    width: 900,
    color: { dark: runtimeConfig.colors.darkGreen, light: "#FFFFFF" }
  });

  await fs.writeFile(path.join(cardDir, "index.html"), makeCardPage(person, runtimeConfig, pageUrl, photoName));
  await writePassSource(person, runtimeConfig, sourceDir, pageUrl, passTypeIdentifier, teamIdentifier, photoSource);
}

await fs.writeFile(path.join(dist, "index.html"), makeHomePage(people, runtimeConfig));
await fs.writeFile(path.join(dist, "404.html"), makeNotFoundPage(runtimeConfig));
console.log(`Built ${people.length} employee card(s) in ${dist}`);

async function validateRoster(roster) {
  const required = ["slug", "name", "title", "email", "cellPhone", "photo"];
  const slugs = new Set();
  for (const person of roster) {
    for (const field of required) {
      if (!person[field]) throw new Error(`Employee record is missing ${field}`);
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(person.slug)) {
      throw new Error(`Invalid slug: ${person.slug}`);
    }
    if (slugs.has(person.slug)) throw new Error(`Duplicate slug: ${person.slug}`);
    slugs.add(person.slug);
  }
}

function makeVCard(person, defaults) {
  const names = person.name.trim().split(/\s+/);
  const family = names.pop() || "";
  const given = names.join(" ");
  const address = person.addressParts || defaults.addressParts;
  const adr = address
    ? ["", "", address.street, address.city, address.state, address.postalCode, address.country].map(vc).join(";")
    : `;;${vc(person.address || defaults.address)}`;
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${vc(family)};${vc(given)};;;`,
    `FN:${vc(person.name)}`,
    `ORG:${vc(person.company || defaults.organizationName)};${vc(person.brand || defaults.brandName)}`,
    `TITLE:${vc(person.title)}`,
    `TEL;TYPE=WORK,VOICE:${vc(person.mainPhone || defaults.mainPhone)}`,
    `TEL;TYPE=CELL,VOICE:${vc(person.cellPhone)}`,
    `EMAIL;TYPE=INTERNET,WORK:${vc(person.email)}`,
    `URL;TYPE=WORK:${vc(person.website || defaults.website)}`,
    `ADR;TYPE=WORK:${adr}`,
    `NOTE:${vc(defaults.motto)}`,
    "END:VCARD"
  ];
  return `${lines.join("\r\n")}\r\n`;
}

function vc(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/;/g, "\\;");
}

function makeCardPage(person, defaults, pageUrl, photoName) {
  const name = html(person.name);
  const title = html(person.title);
  const company = html(person.company || defaults.organizationName);
  const brand = html(person.brand || defaults.brandName);
  const mainPhone = html(person.mainPhone || defaults.mainPhone);
  const cellPhone = html(person.cellPhone);
  const email = html(person.email);
  const website = html(person.website || defaults.website);
  const address = html(person.address || defaults.address);
  const walletButton = defaults.walletPassesEnabled
    ? `<a class="button apple" href="../passes/${encodeURIComponent(person.slug)}.pkpass">Add to Apple Wallet</a>`
    : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="${defaults.colors.darkGreen}"><meta name="robots" content="noindex,nofollow">
<title>${name} | ${brand}</title>
<style>
:root{--green:${defaults.colors.darkGreen};--blue:${defaults.colors.blue};--mint:${defaults.colors.mint};--olive:${defaults.colors.olive}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:linear-gradient(145deg,var(--green),var(--blue));color:#fff;padding:22px}.wrap{width:min(100%,480px);margin:auto}.card{position:relative;overflow:hidden;border:1px solid #ffffff2e;border-radius:28px;padding:24px;background:#002f2bd9;box-shadow:0 18px 60px #00130e80}.top{display:flex;align-items:center;justify-content:space-between;gap:18px}.logo{width:145px;height:128px;object-fit:contain;background:#fff;border-radius:20px;padding:8px}.photo{width:118px;height:118px;border-radius:50%;object-fit:cover;border:5px solid #d6e8df;box-shadow:0 0 0 8px #52c69744}.name{font-size:2.15rem;line-height:1.05;margin:28px 0 6px}.title{font-weight:800;color:var(--mint);letter-spacing:.06em}.brand{margin:6px 0 22px;color:#d6e8df}.details{display:grid;gap:10px}.detail{display:flex;justify-content:space-between;gap:16px;padding:10px 0;border-bottom:1px solid #ffffff20}.detail small{color:#9bd5c0;font-weight:700;letter-spacing:.08em}.detail a{color:white;text-align:right;text-decoration:none}.motto{text-align:center;color:#b7d7ca;font-size:.78rem;font-weight:800;letter-spacing:.05em;margin:20px 0 0}.actions{display:grid;gap:11px;margin-top:18px}.button{display:block;text-align:center;text-decoration:none;font-weight:800;border-radius:14px;padding:15px 18px;background:white;color:var(--green)}.button.apple{background:#000;color:#fff}.button.secondary{background:#52c697;color:#033421}.qr{display:block;width:170px;height:170px;margin:24px auto 10px;border-radius:15px;background:white;padding:10px}.share{border:0;width:100%;cursor:pointer;font:inherit}.foot{text-align:center;color:#ffffffaa;font-size:.75rem;margin:16px}.sr{position:absolute;left:-10000px}
</style></head><body><main class="wrap"><section class="card"><div class="top"><img class="logo" src="../assets/remcert-logo.png" alt="REMCERT"><img class="photo" src="../assets/photos/${encodeURIComponent(photoName)}" alt="${name}"></div>
<h1 class="name">${name}</h1><div class="title">${title} · ${company}</div><div class="brand">${brand}®</div>
<div class="details"><div class="detail"><small>MAIN</small><a href="tel:${tel(person.mainPhone || defaults.mainPhone)}">${mainPhone}</a></div><div class="detail"><small>CELL</small><a href="tel:${tel(person.cellPhone)}">${cellPhone}</a></div><div class="detail"><small>EMAIL</small><a href="mailto:${encodeURIComponent(person.email)}">${email}</a></div><div class="detail"><small>WEB</small><a href="${attr(person.website || defaults.website)}">${website.replace(/^https?:\/\//i, "")}</a></div><div class="detail"><small>OFFICE</small><span style="text-align:right">${address}</span></div></div>
<div class="motto">${html(defaults.motto)}</div></section>
<div class="actions">${walletButton}<a class="button secondary" href="contact.vcf" download>Save Contact</a><button class="button share" id="share" type="button">Share This Card</button></div>
<img class="qr" src="share-qr.png" alt="QR code for ${name}"><p class="foot">Scan to open and save this card</p></main>
<script>document.getElementById('share').addEventListener('click',async()=>{const data={title:${JSON.stringify(person.name)},text:${JSON.stringify(`${person.name} — ${person.title}, ${person.company || defaults.organizationName}`)},url:${JSON.stringify(pageUrl)}};if(navigator.share){try{await navigator.share(data)}catch(e){}}else{await navigator.clipboard.writeText(data.url);alert('Card link copied');}});</script></body></html>`;
}

async function writePassSource(person, defaults, sourceDir, pageUrl, passId, teamId, photoSource) {
  const pass = {
    formatVersion: 1,
    passTypeIdentifier: passId,
    serialNumber: `remcert-${person.slug}`,
    teamIdentifier: teamId,
    organizationName: person.company || defaults.organizationName,
    description: `${person.name} — ${defaults.brandName} Digital Business Card`,
    logoText: defaults.brandName,
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: "rgb(3, 52, 33)",
    labelColor: "rgb(82, 198, 151)",
    generic: {
      primaryFields: [{ key: "name", label: person.title.toUpperCase(), value: person.name }],
      secondaryFields: [{ key: "company", label: "COMPANY", value: `${person.company || defaults.organizationName} | ${person.brand || defaults.brandName}` }],
      auxiliaryFields: [
        { key: "main", label: "MAIN", value: person.mainPhone || defaults.mainPhone, dataDetectorTypes: ["PKDataDetectorTypePhoneNumber"] },
        { key: "cell", label: "CELL", value: person.cellPhone, dataDetectorTypes: ["PKDataDetectorTypePhoneNumber"] },
        { key: "email", label: "EMAIL", value: person.email, dataDetectorTypes: ["PKDataDetectorTypeLink"] }
      ],
      backFields: [
        { key: "card", label: "DIGITAL CARD", value: pageUrl, dataDetectorTypes: ["PKDataDetectorTypeLink"] },
        { key: "website", label: "WEBSITE", value: person.website || defaults.website, dataDetectorTypes: ["PKDataDetectorTypeLink"] },
        { key: "address", label: "OFFICE", value: person.address || defaults.address, dataDetectorTypes: ["PKDataDetectorTypeAddress"] },
        { key: "motto", label: "OUR PRIORITIES", value: defaults.motto }
      ]
    },
    barcodes: [{ format: "PKBarcodeFormatQR", message: pageUrl, messageEncoding: "iso-8859-1", altText: "Scan to share contact" }],
    sharingProhibited: false
  };
  await fs.writeFile(path.join(sourceDir, "pass.json"), JSON.stringify(pass, null, 2));
  await makeContainedPng(path.join(root, "assets", "remcert-logo.png"), path.join(sourceDir, "icon.png"), 29, 29);
  await makeContainedPng(path.join(root, "assets", "remcert-logo.png"), path.join(sourceDir, "icon@2x.png"), 58, 58);
  await makeContainedPng(path.join(root, "assets", "remcert-logo.png"), path.join(sourceDir, "icon@3x.png"), 87, 87);
  await makeContainedPng(path.join(root, "assets", "remcert-logo.png"), path.join(sourceDir, "logo.png"), 160, 50);
  await makeContainedPng(path.join(root, "assets", "remcert-logo.png"), path.join(sourceDir, "logo@2x.png"), 320, 100);
  await makeRoundPhoto(photoSource, path.join(sourceDir, "thumbnail.png"), 90);
  await makeRoundPhoto(photoSource, path.join(sourceDir, "thumbnail@2x.png"), 180);
  await makeRoundPhoto(photoSource, path.join(sourceDir, "thumbnail@3x.png"), 270);
}

async function makeContainedPng(source, target, width, height) {
  await sharp(source).resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(target);
}

async function makeRoundPhoto(source, target, size) {
  const circle = Buffer.from(`<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="white"/></svg>`);
  await sharp(source).rotate().resize(size, size, { fit: "cover", position: "attention" }).composite([{ input: circle, blend: "dest-in" }]).png().toFile(target);
}

function makeHomePage(roster, defaults) {
  const directory = defaults.directoryEnabled
    ? `<ul>${roster.map((p) => `<li><a href="${encodeURIComponent(p.slug)}/">${html(p.name)}</a> — ${html(p.title)}</li>`).join("")}</ul>`
    : `<p>Use the direct link or QR code provided by your REMCERT contact.</p>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>REMCERT Digital Business Cards</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#033421;color:white;font:18px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.box{max-width:540px;text-align:center;padding:40px}.logo{width:230px;background:white;border-radius:24px;padding:16px}a{color:#52c697}</style></head><body><main class="box"><img class="logo" src="assets/remcert-logo.png" alt="REMCERT"><h1>REMCERT Digital Business Cards</h1>${directory}</main></body></html>`;
}

function makeNotFoundPage(defaults) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Card not found</title></head><body style="font-family:sans-serif;text-align:center;padding:50px;background:${defaults.colors.darkGreen};color:white"><h1>Card not found</h1><p>Please request the current REMCERT card link.</p><a style="color:${defaults.colors.mint}" href="${attr(defaults.website)}">Visit REMCERT</a></body></html>`;
}

function html(value) {
  return String(value || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function attr(value) { return html(value); }
function tel(value) { return String(value || "").replace(/[^+\d]/g, ""); }
