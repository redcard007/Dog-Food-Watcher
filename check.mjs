// Dogfeed sweeper price checker. Run with: node check.mjs
// Reads watchlist.json, fetches each store page, pulls out the price,
// appends to prices.json and sends a push alert when a price hits the target.
import { readFile, writeFile } from "node:fs/promises";

const ROOT = new URL(".", import.meta.url);
const watch = JSON.parse(await readFile(new URL("watchlist.json", ROOT), "utf8"));
const dataFile = new URL("prices.json", ROOT);
let data;
try { data = JSON.parse(await readFile(dataFile, "utf8")); } catch { data = { history: [] }; }

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";

// Try structured data first (most big retailers publish it), then common fallbacks.
export function extractPrice(html) {
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const found = findOfferPrice(JSON.parse(m[1].trim()));
      if (found) return found;
    } catch {}
  }
  const meta = html.match(/(?:product:price:amount|itemprop=["']price["'])[^>]*content=["']([\d.,]+)/i)
    || html.match(/content=["']([\d.,]+)["'][^>]*(?:product:price:amount|itemprop=["']price["'])/i);
  if (meta) return num(meta[1]);
  const json = html.match(/"(?:price|salePrice|currentPrice)"\s*:\s*"?(\d+(?:\.\d{1,2})?)/i);
  if (json) return num(json[1]);
  return null;
}
function findOfferPrice(node) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) { for (const n of node) { const p = findOfferPrice(n); if (p) return p; } return null; }
  for (const k of ["price", "lowPrice"]) if (node[k] != null && num(node[k])) return num(node[k]);
  for (const k of ["offers", "@graph", "priceSpecification"]) { const p = findOfferPrice(node[k]); if (p) return p; }
  return null;
}
const num = (v) => { const n = parseFloat(String(v).replace(/[^\d.]/g, "")); return n > 0 ? n : null; };

async function check(store) {
  if (store.url.includes("REPLACE-ME")) return { ...store, price: null, error: "No link set yet" };
  try {
    const res = await fetch(store.url, { headers: { "User-Agent": UA, "Accept-Language": "en-AU" }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return { ...store, price: null, error: `HTTP ${res.status}` };
    const price = extractPrice(await res.text());
    return { ...store, price, error: price ? null : "Price not found on page" };
  } catch (e) { return { ...store, price: null, error: e.message }; }
}

async function notify(text) {
  const topic = watch.notify?.ntfyTopic || process.env.NTFY_TOPIC;
  if (!topic) return;
  await fetch(`https://ntfy.sh/${topic}`, { method: "POST", body: text, headers: { Title: "Dog food on sale!", Tags: "dog" } });
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const results = await Promise.all(watch.stores.map(check));
  const run = { at: new Date().toISOString(), results: results.map(({ name, url, price, error }) => ({ name, url, price, error })) };
  data.product = watch.product;
  data.targetPrice = watch.targetPrice;
  data.history = [...data.history, run].slice(-500);
  await writeFile(dataFile, JSON.stringify(data, null, 2));

  const prev = data.history.at(-2);
  const deals = run.results.filter((r) => r.price && r.price <= watch.targetPrice);
  // Only alert when a store newly drops to or below target, so you aren't pinged every run.
  const fresh = deals.filter((d) => !prev?.results.find((p) => p.name === d.name && p.price && p.price <= watch.targetPrice));
  for (const d of fresh) await notify(`${watch.product}: $${d.price.toFixed(2)} at ${d.name} (target $${watch.targetPrice})\n${d.url}`);
  for (const r of run.results) console.log(`${r.name.padEnd(12)} ${r.price ? "$" + r.price.toFixed(2) : "-"} ${r.error ?? ""}`);
}
