import { matchSectionHeader } from "@/lib/actor-rtf-section-aliases";
import { sanitizeRtfImportFieldText } from "@/lib/sanitize-rtf-import-field";

/** Decode common RTF transports to a string for stripping (UTF-8 first, else Latin-1). */
export function binaryToLossyString(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(u8);
  } catch {
    let s = "";
    for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
    return s;
  }
}

/**
 * Best-effort RTF → plain text (no deps; safe in browser).
 * If the payload is not RTF, returns it normalized (newlines only).
 */
export function stripRtfToPlainText(raw: string): string {
  let s = raw.replace(/\r\n?/g, "\n").replace(/^\uFEFF/, "");
  if (!/{\s*\\rtf/i.test(s)) {
    return s.trim();
  }

  s = s.replace(/\{\\\*\\shppict[\s\S]*?\}/gi, "");
  s = s.replace(/\{\\pict[\s\S]*?\n\}/gi, "");

  s = s.replace(/\\'([0-9a-f]{2})/gi, (_, h: string) => {
    const code = Number.parseInt(h, 16);
    return Number.isFinite(code) ? String.fromCharCode(code) : "";
  });

  s = s.replace(/\\u(-?\d+)\s*\?/g, "");
  s = s.replace(/\\u(-?\d+)/g, (_, d: string) => {
    let n = Number.parseInt(d, 10);
    if (!Number.isFinite(n)) return "";
    if (n < 0) n += 65536;
    return String.fromCharCode(n & 0xffff);
  });

  s = s.replace(/\\pard?\s*/gi, "\n");
  s = s.replace(/\\par\s*/gi, "\n");
  s = s.replace(/\\line\s*/gi, "\n");
  s = s.replace(/\\tab\s*/gi, "\t");

  s = s.replace(/\\\{/g, "\uE000").replace(/\\\}/g, "\uE001");
  let prev = "";
  for (let i = 0; i < 24 && prev !== s; i++) {
    prev = s;
    s = s.replace(/\\[a-zA-Z]+\d* ?/g, "");
    s = s.replace(/\\[^a-zA-Z\s{}]/g, "");
  }
  s = s.replace(/[{}]/g, "");
  s = s.replace(/\uE000/g, "{").replace(/\uE001/g, "}");

  s = s.replace(/[ \t]+\n/g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.trim();
  // Plain-text fragments Word sometimes leaves after control words are stripped
  for (let i = 0; i < 16; i++) {
    const next = s.replace(/(^|\n)\s*txt\b\s*/gi, "$1").trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

/**
 * Split stripped document into field numbers using section headers.
 * Headers: exact alias lines, or `N.` / `N)` optional label (see {@link matchSectionHeader}).
 */
export function numberedFieldMapFromSectionedPlainText(plain: string): Map<number, string> {
  const lines = plain.split(/\n/);
  const out = new Map<number, string>();
  let current: number | null = null;
  const buf: string[] = [];

  function flush() {
    if (current == null) return;
    const body = buf.join("\n").trim();
    if (body) out.set(current, body);
    buf.length = 0;
  }

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      if (current != null) buf.push("");
      continue;
    }
    const hdr = matchSectionHeader(trimmed);
    if (hdr != null) {
      flush();
      current = hdr.num;
      if (hdr.inlineBody?.trim()) buf.push(hdr.inlineBody.trim());
      continue;
    }
    if (current != null) buf.push(trimmed);
  }
  flush();
  return out;
}

export function numberedFieldMapFromRtfBuffer(buf: ArrayBuffer): Map<number, string> {
  const raw = binaryToLossyString(buf);
  const plain = stripRtfToPlainText(raw);
  const map = numberedFieldMapFromSectionedPlainText(plain);
  const out = new Map<number, string>();
  for (const [n, v] of map) {
    out.set(n, sanitizeRtfImportFieldText(v));
  }
  return out;
}
