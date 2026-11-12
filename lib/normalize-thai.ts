// Repairs Thai text as extracted from the curriculum PDF (and typed by users):
// private-use glyph codes, decomposed sara am, and stray spaces.

// Windows Thai extension glyphs: positional variants of ordinary characters.
const PUA_MAP: Record<number, string> = {
  0xf700: "ฐ",
  0xf701: "ิ", 0xf702: "ี", 0xf703: "ึ", 0xf704: "ื",
  0xf705: "่", 0xf706: "้", 0xf707: "๊", 0xf708: "๋", 0xf709: "์",
  0xf70a: "่", 0xf70b: "้", 0xf70c: "๊", 0xf70d: "๋", 0xf70e: "์",
  0xf70f: "ญ",
  0xf710: "ั", 0xf711: "ํ", 0xf712: "็",
  0xf713: "่", 0xf714: "้", 0xf715: "๊", 0xf716: "๋", 0xf717: "์",
};

const THAI = "ก-๎";
// Sara am plus the combining vowels and marks that sit above or below a consonant.
const ATTACHING = "ำัิ-ฺ็-๎";
const SPACE_BEFORE_ATTACHING = new RegExp(`(?<=[${THAI}]) +(?=[${ATTACHING}])`, "g");

export function normalizeThai(s: string): string {
  return s
    .replace(/[-]/g, (ch) => PUA_MAP[ch.charCodeAt(0)] ?? "")
    .replace(/ํา/g, "ำ")
    .replace(SPACE_BEFORE_ATTACHING, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** For matching bold headings whose "า" was extracted as "ำ": ignores that difference and all spaces. */
export function foldThai(s: string): string {
  return normalizeThai(s).replace(/ำ/g, "า").replace(/\s+/g, "");
}
