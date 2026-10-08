// Turn the PMC and PCMC ward GeoJSON into small SVG paths for the printed map (src/map/pune.json).
// Projection: equirectangular, x scaled by cos(latitude): accurate enough across one city.
import { readFileSync, writeFileSync } from "node:fs";

const WARDS = new URL("../../pipeline/vachan/wards/", import.meta.url);
const read = (f) => JSON.parse(readFileSync(new URL(f, WARDS))).features;
const pcmc = read("pcmc_wards_datameet.geojson");
const pmc = read("pmc_wards_2022_datameet.geojson");

const rings = (f) => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates).map((p) => p[0]);
const all = [...pcmc, ...pmc].flatMap(rings).flat();
const [minLon, maxLon] = [Math.min(...all.map((p) => p[0])), Math.max(...all.map((p) => p[0]))];
const [minLat, maxLat] = [Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[1]))];
const kx = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
const WIDTH = 1000;
const scale = WIDTH / ((maxLon - minLon) * kx);
const height = Math.round((maxLat - minLat) * scale);
const project = ([lon, lat]) => [(lon - minLon) * kx * scale, (maxLat - lat) * scale];

function path(ring) {
  let d = "", last = null;
  for (const pt of ring.map(project)) {
    if (last && Math.hypot(pt[0] - last[0], pt[1] - last[1]) < 1.5) continue; // drop points closer than 1.5 units
    d += (d ? "L" : "M") + pt[0].toFixed(1) + " " + pt[1].toFixed(1);
    last = pt;
  }
  return d + "Z";
}
const wards = (features, label) => features.map((f) => ({
  ward: String(label(f.properties)), d: rings(f).map(path).join(""),
}));

const centre = (features) => {
  const pts = features.flatMap(rings).flat().map(project);
  return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length].map(Math.round);
};
const out = {
  labels: { PCMC: centre(pcmc), PMC: centre(pmc) },
  width: WIDTH, height, projection: { minLon, maxLat, kx, scale },
  pcmc: wards(pcmc, (p) => p.wardnum),
  pmc: wards(pmc, (p) => p.Name1),
};
writeFileSync(new URL("../src/map/pune.json", import.meta.url), JSON.stringify(out));
console.log(`pune.json: ${WIDTH}x${height}, ${out.pcmc.length} PCMC + ${out.pmc.length} PMC wards`);
