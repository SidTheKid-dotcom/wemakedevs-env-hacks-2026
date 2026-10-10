// The data shows promises, not violations (CLAUDE.md). A translation must not quietly
// turn a promise into an accusation, so every Marathi and Hindi string is checked here.
import { describe, expect, it } from "vitest";
import { dictionaries } from "./i18n";

/** Words that would accuse someone, in each language we ship. */
const ACCUSING: Record<string, RegExp> = {
  english: /\b(violat\w*|illegal|fraud\w*|guilty|failed to|failure to|prosecut\w*|lawsuit|criminal)\b/i,
  // उल्लंघन violation · बेकायदा/अवैध illegal · फसवणूक fraud · दोषी guilty · गुन्हा offence
  // अपयश failure · खटला lawsuit · कारवाई action-against · दंड ठोठाव penalty-imposed
  marathi: /(उल्लंघन|बेकायदा|बेकायदेशीर|अवैध|फसवणूक|फसवाफसवी|दोषी|गुन्हा|गुन्हेगार|अपयश|अपयशी|खटला|कारवाई|ठोठाव)/,
  // उल्लंघन violation · अवैध/गैरकानूनी illegal · धोखाधड़ी fraud · दोषी guilty · अपराध offence
  // विफल failure · मुकदमा lawsuit · कार्रवाई action-against
  hindi: /(उल्लंघन|अवैध|गैरकानूनी|गैर-कानूनी|धोखाधड़ी|धोखा|दोषी|अपराध|अपराधी|विफल|असफल|मुकदमा|कार्रवाई)/,
};

const entries = (lang: "mr" | "hi") => Object.entries(dictionaries[lang]);

describe.each(["mr", "hi"] as const)("%s translations", (lang) => {
  const script = lang === "mr" ? ACCUSING.marathi : ACCUSING.hindi;

  it("never accuses anyone", () => {
    const bad = entries(lang).filter(([, v]) => script.test(v) || ACCUSING.english.test(v));
    expect(bad).toEqual([]);
  });

  it("keeps every placeholder the English sentence had", () => {
    const broken = entries(lang).filter(([en, v]) => {
      const want = [...en.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      const got = [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      return want.join() !== got.join();
    });
    expect(broken).toEqual([]);
  });

  it("is actually in Devanagari, not copied English", () => {
    const untranslated = entries(lang).filter(([en, v]) => v === en || !/[ऀ-ॿ]/.test(v));
    expect(untranslated).toEqual([]);
  });

  it("says 'promised in writing' wherever English does", () => {
    // लेखी वचन / लिखित में वादा: the phrase the whole project rests on.
    const written = lang === "mr" ? /लेखी/ : /लिखित/;
    const shouldSay = entries(lang).filter(([en]) => /promised in writing|in writing/i.test(en));
    expect(shouldSay.length).toBeGreaterThan(2);
    for (const [en, v] of shouldSay) expect(written.test(v), `${en} -> ${v}`).toBe(true);
  });

  it("has no stray leading or trailing space", () => {
    expect(entries(lang).filter(([, v]) => v !== v.trim())).toEqual([]);
  });
});

// ---- coverage: these three would have caught every gap found by hand on 10 Oct ----
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname);
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !/\.test\./.test(f) ? [p] : [];
});
/** Every English key the code asks for as a literal: t("…"), t2("…", …), tl("…", …), and split stamp lines. */
const usedKeys = () => {
  const keys = new Set<string>();
  for (const f of files(SRC).filter((p) => !p.endsWith("i18n.ts"))) { // its doc comment holds example calls
    const code = readFileSync(f, "utf8");
    for (const m of code.matchAll(/\bt[2l]?\(\s*"((?:[^"\\]|\\.)*)"/g)) keys.add(m[1].replace(/\\"/g, '"'));
    for (const m of code.matchAll(/\bt[2l]?\(\s*[^"()]+\?\s*"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) { keys.add(m[1]); keys.add(m[2]); }
  }
  keys.delete(""); return keys;
};

describe("coverage", () => {
  it("Marathi and Hindi translate exactly the same sentences", () => {
    const mr = new Set(Object.keys(dictionaries.mr)), hi = new Set(Object.keys(dictionaries.hi));
    expect([...mr].filter((k) => !hi.has(k))).toEqual([]);
    expect([...hi].filter((k) => !mr.has(k))).toEqual([]);
  });

  it("every sentence the code shows has both translations", () => {
    const missing = [...usedKeys()].filter((k) => !(k in dictionaries.mr) || !(k in dictionaries.hi));
    expect(missing).toEqual([]);
  });

  it.each(["mr", "hi"] as const)("%s never repeats a phrase back to back", (lang) => {
    const doubled = Object.values(dictionaries[lang]).filter((v) => {
      const w = v.split(/\s+/);
      for (let n = 1; n <= 3; n++) for (let i = 0; i + 2 * n <= w.length; i++)
        if (w.slice(i, i + n).join(" ") === w.slice(i + n, i + 2 * n).join(" ") && w.slice(i, i + n).join("").length > 2) return true;
      return false;
    });
    expect(doubled).toEqual([]);
  });
});
