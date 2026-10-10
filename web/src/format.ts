// Formatting and small pure helpers shared by every screen.
import type { City, Summary } from "./api";

const IN = new Intl.NumberFormat("en-IN");
export const kg = (n: number | null | undefined) => (n == null ? "?" : IN.format(Math.round(n)));
/** City totals in tonnes ("735.6"): "7,35,579 kg" reads wrong outside India. */
export const tonnes = (kgPerDay: number) => (kgPerDay / 1000).toFixed(1);
export const longDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
export const shortDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
export const cityName = (c: City) => (c === "PCMC" ? "Pimpri-Chinchwad (PCMC)" : "Pune (PMC)");
export const wardLabel = (p: Pick<Summary, "city" | "ward">) => (p.city === "PCMC" ? `ward ${p.ward}` : `ward ${p.ward}`);

/** Readable project name: the model's name, else village, else a plain fallback. */
export function placeName(p: Pick<Summary, "project_name" | "village">) {
  const name = (p.project_name || "").replace(/\s+/g, " ").trim();
  const generic = !name || name.length > 70 || /^(proposed|environment|amendment|expansion)/i.test(name);
  if (generic) return p.village ? `Housing project, ${title(p.village)}` : "Housing project";
  return p.village && !name.toLowerCase().includes(p.village.toLowerCase()) ? `${name}, ${title(p.village)}` : name;
}
export const title = (s: string) => s.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/** "In-situ composting" from "Operation Phase Wet waste: 922.61 In-situ Composting". */
export function method(quote: string | null | undefined) {
  if (!quote) return null;
  const tail = quote.replace(/^.*?wet\s+(waste|garbage)\s*[:\-–]?\s*[\d,.]+\s*(kg\s*\/?\s*day)?/i, "").trim();
  const m = tail.match(/(organic\s+waste\s+conver\w*|owc|in[- ]?situ\s+compost\w*|vermi\s*-?\s*compost\w*|compost\w*|biogas|bio[- ]?methan\w*)/i);
  if (!m) return null;
  const t = m[1].toLowerCase();
  if (t === "owc" || t.startsWith("organic")) return "Organic waste converter (OWC)";
  if (t.startsWith("in")) return "In-situ composting";
  if (t.startsWith("vermi")) return "Vermicomposting";
  if (t.startsWith("bio")) return "Biogas plant";
  return "Composting on site";
}

export const builderSlug = (b: string) => b.toLowerCase().replace(/m\/s\.?/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export function builderName(b: string | null) {
  return (b || "").replace(/^m\/s\.?\s*/i, "").replace(/\s+/g, " ").trim();
}

export function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** Lowercase, no punctuation, single spaces: for matching search text. */
export const norm = (s: string | null | undefined) => (s || "").toLowerCase().replace(/m\/s\.?/g, " ").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
