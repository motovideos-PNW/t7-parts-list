// Builds the public site from the private dashboard's wishlist.json.
// Usage: node scripts/build-public.mjs [path-to-wishlist.json]
// Default source: ../life-dashboard/data/wishlist.json (a sibling folder of this repo).
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = process.argv[2] || path.resolve(root, "..", "life-dashboard", "data", "wishlist.json");
const cfg = JSON.parse(readFileSync(path.join(root, "config.json"), "utf8"));
const raw = JSON.parse(readFileSync(src, "utf8"));
const read = (p) => readFileSync(path.join(root, p), "utf8");
const write = (p, s) => { mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); writeFileSync(path.join(root, p), s); };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---- 1. Clean the data for public use -------------------------------------
const isAmazon = (url, site) => {
  if (site === "Amazon") return true;
  try { const h = new URL(url).hostname; return /(^|\.)amazon\.[a-z.]+$/.test(h) || /(^|\.)amzn\.to$/.test(h); } catch { return false; }
};
const items = raw.items.map((it) => {
  const o = { ...it };
  delete o.keep; // internal flag
  if (isAmazon(o.url, o.site)) {
    // Amazon only allows prices/images via its own links or API, so none are shown.
    delete o.price; delete o.image; delete o.priceFrom;
    o.price = null; o.image = null;
    o.inStock = true;
    o.stockText = "Check price and availability on Amazon";
    o.priceNote = "Check price on Amazon";
  }
  if (Array.isArray(o.alsoAt)) {
    o.alsoAt = o.alsoAt.map((a) => {
      if (!isAmazon(a.url, a.site)) return a;
      const { price, ...rest } = a; return rest;
    });
  }
  if (o.id === "cu-sl-guide") { o.url = "starlink-guide/"; o.site = "Build guide"; o.stockText = "Free step-by-step guide"; o.priceNote = "Free"; }
  return o;
});
const pub = { updatedAt: raw.updatedAt, settings: { region: raw.settings?.region }, sites: raw.sites, items };
write("data/wishlist.public.json", JSON.stringify(pub, null, 1) + "\n");

// ---- 2. Shared bits --------------------------------------------------------
const aff = cfg.affiliates || {};
const disclosure =
  (aff.enabled
    ? "Some links on this site are affiliate links. If you buy through them I may earn a commission at no extra cost to you. " +
      (aff.amazon ? "As an Amazon Associate I earn from qualifying purchases. " : "")
    : "This site does not currently use affiliate links. ") +
  "Prices and availability are collected automatically, can be out of date, and are not guaranteed. Check the store before you buy.";
const base = (cfg.siteUrl || "").replace(/\/$/, "");
const desc = `${items.length} parts that fit a ${cfg.bikeName}, plus a Starlink Mini power build guide. Updated daily.`;
const og = (title, d, urlPath) =>
  `<meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(d)}">` +
  (base ? `<meta property="og:url" content="${esc(base + urlPath)}"><meta property="og:image" content="${esc(base)}/social-preview.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">` : "");
const footer = (depth) =>
  `<footer><a href="${depth}">Parts list</a><a href="${depth}starlink-guide/">Starlink build guide</a><a href="${depth}privacy.html">Privacy</a>` +
  (cfg.facebookUrl ? `<a href="${esc(cfg.facebookUrl)}" target="_blank" rel="noopener noreferrer">Facebook</a>` : "") + `</footer>`;

// ---- 3. Parts list page ----------------------------------------------------
const dataJson = JSON.stringify({ ...pub, meta: { affiliates: !!aff.enabled } }).replace(/</g, "\\u003c");
const index = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(cfg.siteName)}</title><meta name="description" content="${esc(desc)}">
${og(cfg.siteName, desc, "/")}
<style>${read("scripts/hud.css")}</style></head>
<body><div class="scan"></div><div class="content">
<h1>${esc(cfg.siteName)}</h1>
<p class="sub">${esc(cfg.bikeName)} · rackless gear only</p>
<p class="disc" data-disclosure>${esc(disclosure)}</p>
<div class="layout"><aside>
<div class="row2"><button class="btn span2" id="f-am" aria-pressed="true">AfterMarket</button><button class="btn" id="f-oem" aria-pressed="false">OEM</button><button class="btn" id="f-all" aria-pressed="false">All</button></div>
<button class="btn" id="cmp" aria-pressed="false" title="Show the cheapest item per category">Cheapest per category</button>
<input class="f" id="q" type="search" placeholder="Search parts…" aria-label="Search parts">
<label class="tax">Your sales tax %<input class="f" id="tax" inputmode="decimal" aria-label="Your sales tax percent"></label>
<nav class="nav" id="nav" aria-label="Categories"></nav></aside>
<div style="min-width:0"><p class="note"><span id="count"></span>Totals = price + shipping (+ tax if you enter your rate). Each part is listed as fitting a 2025 Ténéré 700 by the retailer, or is universal strap-on gear (noted). Prices change; confirm at checkout.</p>
<div id="list"><noscript>This page needs JavaScript to show the parts list.</noscript></div></div></div>
${footer("")}
</div>
<script id="data" type="application/json">${dataJson}</script>
<script>${read("scripts/client.js")}</script>
</body></html>
`;
write("site/index.html", index);

// ---- 4. Starlink guide (standalone page) -----------------------------------
let guide = read("content/starlink-guide.html")
  .replace(/<meta name="claude:viewport-fit-sides"[^>]*>\n?/, "");
const gTitle = (guide.match(/<title>([^<]*)<\/title>/) || [, "T7 Starlink Power Build"])[1];
const gDesc = "Wire the Ténéré 700 factory aux plug to a 12V socket to run a Starlink Mini for emergency connection. Parts, wiring diagram, mounting spots, safety.";
guide = guide.replace("<main>", `<main><p style="margin:0"><a href="../">← ${esc(cfg.siteName)}</a></p>`)
  .replace("</main>", `<p data-disclosure style="font-size:13px;color:var(--muted)">${esc(disclosure)} This guide is not professional electrical advice. Verify the pin roles with a multimeter before connecting anything.</p></main>`);
const gPage = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n<meta name="description" content="${esc(gDesc)}">\n${og(gTitle, gDesc, "/starlink-guide/")}\n${guide}\n${footer("../").replace("<footer>", '<footer style="max-width:860px;margin:0 auto;padding:16px max(16px,env(safe-area-inset-left,0px)) 40px;display:flex;flex-wrap:wrap;gap:6px 18px;font-size:13px">')}\n</html>\n`;
write("site/starlink-guide/index.html", gPage);

// ---- 5. Privacy page -------------------------------------------------------
const privacy = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Privacy · ${esc(cfg.siteName)}</title><meta name="robots" content="index,follow">
<style>${read("scripts/hud.css")}.content{max-width:760px}h2{font-size:13px;color:var(--hud-amber);text-transform:uppercase;letter-spacing:.14em;margin:24px 0 6px;font-weight:400}p{margin:0 0 10px;color:var(--hud-text)}</style></head>
<body><div class="scan"></div><div class="content">
<h1>Privacy and affiliate notice</h1>
<p class="sub">${esc(cfg.siteName)}</p>
<h2>What this site stores</h2>
<p>This site has no accounts, no ads and no analytics. If you type a sales tax rate, your browser remembers it on your own device (local storage). Nothing is sent to me.</p>
<h2>Third parties</h2>
<p>Product photos load directly from the stores that sell the parts, and links take you to those stores. Those sites have their own privacy practices, and they can see that your browser requested their image or page. The site is hosted on Cloudflare Pages, which keeps standard server logs.</p>
<h2>Affiliate links</h2>
<p data-disclosure>${esc(disclosure)}</p>
<h2>Accuracy</h2>
<p>Prices, stock and fitment are gathered automatically from retailer pages and can be wrong or out of date. Always confirm fitment and price with the seller before you buy. Wiring and mounting advice in the Starlink guide is general information, not professional electrical advice.</p>
${footer("")}
</div></body></html>
`;
write("site/privacy.html", privacy);

// ---- 6. Static extras ------------------------------------------------------
if (existsSync(path.join(root, "assets/social-preview.jpg"))) copyFileSync(path.join(root, "assets/social-preview.jpg"), path.join(root, "site/social-preview.jpg"));
write("site/robots.txt", "User-agent: *\nAllow: /\n" + (base ? `Sitemap: ${base}/sitemap.xml\n` : ""));
if (base) write("site/sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}/</loc></url><url><loc>${base}/starlink-guide/</loc></url><url><loc>${base}/privacy.html</loc></url></urlset>\n`);

console.log(`Built ${items.length} items from ${src}`);
if (!base) console.warn("config.json siteUrl is empty: Facebook link previews need an absolute URL. Set it once the site address is known.");
