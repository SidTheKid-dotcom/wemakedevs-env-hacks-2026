// Paper and kraft-desk textures, drawn once on a canvas at start-up (no image downloads).
import { rng } from "./rough";

function tile(base: [number, number, number], grain: number, fibres: number, flecks: number, seed: number) {
  const size = 384, c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!, r = rng(seed);
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const n = (r() - 0.5) * grain;
    img.data.set([base[0] + n, base[1] + n * 0.95, base[2] + n * 0.85, 255], i * 4);
  }
  g.putImageData(img, 0, 0);
  g.lineCap = "round";
  for (let i = 0; i < fibres; i++) { // long fibres
    const x = r() * size, y = r() * size, a = r() * Math.PI, l = 6 + r() * 26;
    g.strokeStyle = `rgba(${r() > 0.5 ? "255,250,235" : "90,60,30"},${0.05 + r() * 0.08})`;
    g.lineWidth = 0.6 + r();
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 6, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  for (let i = 0; i < flecks; i++) { // recycled-paper flecks
    g.fillStyle = `rgba(${r() > 0.6 ? "120,90,50" : "70,60,50"},${0.15 + r() * 0.3})`;
    g.beginPath();
    g.ellipse(r() * size, r() * size, 0.4 + r() * 1.4, 0.3 + r(), r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  return c.toDataURL("image/png");
}

export function installTextures() {
  const root = document.documentElement.style;
  root.setProperty("--desk-tex", `url(${tile([200, 169, 126], 26, 900, 120, 11)})`);
  root.setProperty("--paper-tex", `url(${tile([237, 230, 214], 14, 260, 90, 5)})`);
  root.setProperty("--clip-tex", `url(${tile([228, 226, 220], 10, 120, 30, 9)})`);
}
