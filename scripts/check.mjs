// Safety checks run on every push. Exit code 1 means something must be fixed before publishing.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fails = [];
const fail = (m) => fails.push(m);
const cfg = JSON.parse(readFileSync(path.join(root, "config.json"), "utf8"));
const dataPath = path.join(root, "data/wishlist.public.json");
const pages = ["site/index.html", "site/starlink-guide/index.html", "site/privacy.html"];

const amazon = (u) => { try { const h = new URL(u).hostname; return /(^|\.)amazon\.[a-z.]+$/.test(h) || /(^|\.)amzn\.to$/.test(h); } catch { return false; } };

if (!existsSync(dataPath)) fail("data/wishlist.public.json is missing");
else {
  const d = JSON.parse(readFileSync(dataPath, "utf8"));
  if (!Array.isArray(d.items) || d.items.length < 1) fail("no items in public data");
  for (const i of d.items || []) {
    if (!i.id || !i.name || !i.category || !i.url) fail(`item missing a required field: ${i.id || i.name}`);
    if (!/^https:\/\//.test(i.url) && !/^starlink-guide\//.test(i.url)) fail(`item ${i.id} has a non-https url`);
    if (amazon(i.url) || i.site === "Amazon") {
      if (i.price != null) fail(`Amazon item ${i.id} has a price`);
      if (i.image) fail(`Amazon item ${i.id} has an image`);
    }
    for (const a of i.alsoAt || []) if (amazon(a.url) && a.price != null) fail(`Amazon alsoAt on ${i.id} has a price`);
  }
}

for (const p of pages) {
  const f = path.join(root, p);
  if (!existsSync(f)) { fail(`${p} is missing (run npm run build)`); continue; }
  const html = readFileSync(f, "utf8");
  if (!html.includes("data-disclosure")) fail(`${p} has no disclosure block`);
  if (cfg.affiliates?.enabled && !/affiliate/i.test(html)) fail(`${p} lacks the affiliate disclosure`);
  if (cfg.affiliates?.amazon && !html.includes("As an Amazon Associate I earn from qualifying purchases")) fail(`${p} lacks the Amazon Associates sentence`);
  if (/localhost|life-dashboard|C:\\\\Projects|127\.0\.0\.1/i.test(html)) fail(`${p} mentions a private path or localhost`);
}

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  if (n === ".git" || n === "node_modules") return [];
  const f = path.join(dir, n);
  return statSync(f).isDirectory() ? walk(f) : [f];
});
for (const f of walk(root)) {
  const n = path.basename(f).toLowerCase();
  if (n.startsWith(".env") || /\.(pem|key)$/.test(n) || n.includes("token")) fail(`secret-looking file: ${path.relative(root, f)}`);
}

if (fails.length) { console.error("CHECK FAILED:\n- " + fails.join("\n- ")); process.exit(1); }
console.log("All checks passed.");
