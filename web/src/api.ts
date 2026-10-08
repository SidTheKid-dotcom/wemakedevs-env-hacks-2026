// All data access. Read data is static JSON on CloudFront; the letter is a Lambda URL;
// address search is Amazon Location Places (API key, browser-safe actions only).
const DATA = import.meta.env.VITE_DATA_URL as string;
const API = import.meta.env.VITE_API_URL as string;
const PLACES_KEY = import.meta.env.VITE_LOCATION_API_KEY as string | undefined;
const PLACES = "https://places.geo.ap-south-1.amazonaws.com/v2";

export type City = "PMC" | "PCMC";
export type Check = { name: string; pass: boolean };
export type Summary = {
  id: string; project_name: string | null; builder: string | null; village: string | null; city: City;
  ward: string; lat: number; lon: number; wet_kg_day: number | null; owc_promised: boolean | null;
  decision: string | null; meeting_date: string; status: "auto" | "review" | "verified";
  tenements?: number | null; page?: number; pdf?: string; quote?: string | null;
  zone?: string | null; review_reason?: string | null;
};
export type Project = Summary & {
  proposal_id: string; title: string; owc_quote: string | null; tenements: number | null;
  solar_promised: boolean | null; energy_saving_pct: number | null; stp_kld: number | null;
  source: { parivesh_url: string; mirror_url: string; page: number; sha256: string };
  checks: Check[]; review_reason: string | null; related_proposal_ids: string[];
};
export type Stats = {
  wet_kg_day_total: number; wet_kg_day_pmc: number; wet_kg_day_pcmc: number; projects: number;
  counted_projects: number; owc_projects: number; review_count: number; quotes_verified: number | null;
  quotes_checked?: number; newest_meeting_date: string; published_at: string;
};
export type Place = { id: string; title: string };

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) throw Object.assign(new Error(`${r.status} ${url}`), { status: r.status });
  return r.json() as Promise<T>;
}

let projects: Promise<Summary[]> | null = null;
export const getStats = () => json<Stats>(`${DATA}/data/stats.json`);
export const getProjects = () => (projects ??= json<Summary[]>(`${DATA}/data/projects.json`).catch((e) => {
  projects = null; // let "Try again" refetch
  throw e;
}));
export const getProject = (id: string) => json<Project>(`${DATA}/data/p/${encodeURIComponent(id)}.json`);
export const pdfUrl = (p: Project) => `${p.source.mirror_url}#page=${p.source.page}`;

export async function draftLetter(id: string, to: "builder" | "pcmc" | "pmc", lang: "en" | "mr") {
  const r = await json<{ text?: string; error?: string }>(API, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, to, lang }),
  });
  if (!r.text) throw new Error(r.error || "no letter");
  return r.text;
}

export const placesEnabled = Boolean(PLACES_KEY);

export async function suggestPlaces(q: string, signal?: AbortSignal): Promise<Place[]> {
  if (!PLACES_KEY) return [];
  const r = await json<{ ResultItems: { Title: string; Place?: { PlaceId: string } }[] }>(
    `${PLACES}/suggest?key=${PLACES_KEY}`, {
      method: "POST", signal, headers: { "content-type": "application/json" },
      body: JSON.stringify({ QueryText: q, MaxResults: 5, BiasPosition: [73.85, 18.55], Filter: { IncludeCountries: ["IND"] } }),
    });
  return r.ResultItems.filter((i) => i.Place).map((i) => ({ id: i.Place!.PlaceId, title: i.Title }));
}

export async function placePosition(id: string): Promise<{ lat: number; lon: number }> {
  const r = await json<{ Position: [number, number] }>(`${PLACES}/place/${encodeURIComponent(id)}?key=${PLACES_KEY}`);
  return { lon: r.Position[0], lat: r.Position[1] };
}
