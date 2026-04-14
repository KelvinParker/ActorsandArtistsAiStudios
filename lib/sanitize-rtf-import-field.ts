/**
 * Strip RTF / Word paste noise from a single import field (numbered .txt, RTF sections, form paste).
 * - Removes Word’s plain `txt` prefix (with or without a space, as a word boundary) at the start of
 *   the value and after each newline — Word often repeats it per paragraph / field.
 * - Removes `txt` when it is **glued** to the real text (e.g. `txtMarcus King`): there is no `\b`
 *   between `txt` and `Marcus`, so a plain `txt\b` pass misses it. We strip `txt` when the next
 *   character starts the real payload (letter, digit, or opening quote), including Unicode capitals.
 * - Strips accidental `1.txt`-style filename tokens at the start of a line (paste from file trees).
 * - Strips ZWSP/BOM-ish chars, wrapping quotes, and trailing backslashes (per line).
 * - Normalizes spaces; keeps newlines for multi-line bodies (e.g. backstory).
 */
export function sanitizeRtfImportFieldText(raw: string | null | undefined): string {
  let s = String(raw ?? "").replace(/\r\n?/g, "\n");
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\u00A0/g, " ");
  s = s.trim();
  s = s.replace(/^["'`]+|["'`]+$/g, "").trim();

  /** Plain-text chunk Word leaves when stripping RTF control words; repeat at line starts. */
  function stripTxtNoiseBlock(t: string): string {
    let u = t;
    // Glued `txt` before real text (no word boundary). Avoid `txtile…` by requiring non-lowercase
    // start of payload, digit, or quote — RTF junk is almost always lowercase `txt`.
    const gluedTxt = /(^|\n)\s*(txt)+(?=[0-9A-Z\p{Lu}"'`])/giu;
    const gluedTxtStart = /^\s*(txt)+(?=[0-9A-Z\p{Lu}"'`])/giu;
    const numberedFieldFile = /(^|\n)\s*\d{1,2}\.txt\s*/gi;
    const numberedFieldFileStart = /^\s*\d{1,2}\.txt\s*/gi;
    for (let i = 0; i < 24; i++) {
      const next = u
        .replace(/(^|\n)\s*txt\b\s*/gi, "$1")
        .replace(/^\s*txt\b\s*/gi, "")
        .replace(gluedTxt, "$1")
        .replace(gluedTxtStart, "")
        .replace(numberedFieldFile, "$1")
        .replace(numberedFieldFileStart, "")
        .trim();
      if (next === u) break;
      u = next;
    }
    return u;
  }

  s = stripTxtNoiseBlock(s);

  const lines = s.split("\n").map((line) => {
    let t = stripTxtNoiseBlock(line.trim());
    t = t.replace(/\\+$/g, "").trim();
    return t;
  });

  s = lines
    .map((ln) => ln.replace(/[ \t]{2,}/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return stripTxtNoiseBlock(s);
}
