// utils/searchUtils.ts

export function normalizeForSearch(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-zа-яёөү0-9]+/gi, "");
}

export function cyrillicToLatin(input: string): string {
  const text = (input ?? "").toLowerCase();
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo",
    ж: "j", з: "z", и: "i", й: "i", к: "k", л: "l", м: "m",
    н: "n", о: "o", ө: "o", п: "p", р: "r", с: "s", т: "t",
    у: "u", ү: "u", ф: "f", х: "kh", ц: "ts", ч: "ch",
    ш: "sh", щ: "sh", ъ: "", ы: "ii", ь: "", э: "e",
    ю: "yu", я: "ya",
  };
  let out = "";
  for (const ch of text) out += map[ch] ?? ch;
  return out;
}

export function latinToCyrillic(input: string): string {
  let s = (input ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const rules: Array<[RegExp, string]> = [
    [/sch/g, "щ"], [/sh/g, "ш"], [/ch/g, "ч"], [/ts/g, "ц"],
    [/ya/g, "я"], [/yo/g, "ё"], [/yu/g, "ю"], [/ye/g, "е"], [/kh/g, "х"],
  ];
  for (const [re, rep] of rules) s = s.replace(re, rep);
  const map: Record<string, string> = {
    a: "а", b: "б", v: "в", g: "г", d: "д", e: "е", z: "з",
    i: "и", j: "ж", k: "к", l: "л", m: "м", n: "н", o: "о",
    p: "п", r: "р", s: "с", t: "т", u: "у", f: "ф", h: "х",
    y: "й", q: "к", w: "в", x: "кс", c: "к",
  };
  let out = "";
  for (const ch of s) out += map[ch] ?? ch;
  return out;
}

export function buildSearchVariants(input: string): string[] {
  const raw = (input ?? "").trim();
  if (!raw) return [];
  const variants = new Set<string>();

  const add = (v: string) => {
    const n = normalizeForSearch(v);
    if (n) variants.add(n);
  };

  add(raw);
  add(latinToCyrillic(raw));
  add(cyrillicToLatin(raw));

  const lowered = raw.toLowerCase();

  add(lowered.replace(/oo/g, "o"));
  add(lowered.replace(/uu/g, "u"));
  add(lowered.replace(/ii/g, "i"));
  add(lowered.replace(/ee/g, "e"));
  add(lowered.replace(/aa/g, "a"));

  add(lowered.replace(/kh/g, "h"));
  add(lowered.replace(/sh/g, "s"));
  add(lowered.replace(/ch/g, "c"));

  add(latinToCyrillic(lowered.replace(/oo/g, "o")));
  add(latinToCyrillic(lowered.replace(/uu/g, "u")));
  add(latinToCyrillic(lowered.replace(/ii/g, "i")));
  add(latinToCyrillic(lowered.replace(/kh/g, "h")));
  add(latinToCyrillic(lowered.replace(/sh/g, "s")));
  add(latinToCyrillic(lowered.replace(/ch/g, "c")));
  return Array.from(variants);
}

// 🎯 Хамгийн гол функц: Энийг л бусад файлуудаас дуудаж ашиглана
export function searchMatch(text: string, query: string): boolean {
  const variants = buildSearchVariants(query);
  if (variants.length === 0) return true;
  const original = normalizeForSearch(text);
  const translit = normalizeForSearch(cyrillicToLatin(text));

  return variants.some((q) => original.includes(q) || translit.includes(q));
}