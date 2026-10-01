/**
 * TinyKit API — tool implementations (zero dependencies, pure functions).
 * Algorithms ported 1:1 from the inline JS of tinykit.pages.dev tool pages.
 */
import { md5 } from "./md5.js";
import { parseYAML, toYAML, parseXMLDoc, xmlNodeToJson, decodeEntities } from "./parsers.js";
import { HTTP_STATUS } from "./http-status.js";

/* ================= base64 (UTF-8 safe) ================= */
const te = new TextEncoder();
const td = new TextDecoder();
export function b64encode(text) {
  const bytes = te.encode(text);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
export function b64decode(text) {
  const bin = atob(String(text).trim());
  return td.decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/* ================= hash ================= */
const SHA_ALGOS = { sha1: "SHA-1", sha256: "SHA-256", sha512: "SHA-512" };
export async function hashText(text, algo) {
  if (algo === "md5") return md5(text);
  if (SHA_ALGOS[algo]) {
    const d = await crypto.subtle.digest(SHA_ALGOS[algo], te.encode(text));
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  throw new Error(`unsupported algo "${algo}". Use: md5, sha1, sha256, sha512`);
}

/* ================= uuid v4 ================= */
export function uuid4() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/* ================= ulid ================= */
const ULID_ALPHA = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function ulidB32(value, length) {
  let s = "", v = BigInt(value);
  for (let i = 0; i < length; i++) { s = ULID_ALPHA[Number(v & 31n)] + s; v >>= 5n; }
  return s;
}
let ulidLastMs = -1, ulidLastRand = 0n;
export function generateUlid() {
  const ms = Date.now();
  let rand;
  if (ms === ulidLastMs) {
    rand = ulidLastRand + 1n;
    if (rand >= (1n << 80n)) rand = 0n;
  } else {
    const b = new Uint8Array(10);
    crypto.getRandomValues(b);
    rand = 0n;
    for (let i = 0; i < 10; i++) rand = (rand << 8n) | BigInt(b[i]);
  }
  ulidLastMs = ms; ulidLastRand = rand;
  return ulidB32(ms, 10) + ulidB32(rand, 16);
}
export function decodeUlid(str) {
  const s = String(str).trim().toUpperCase();
  if (s.length !== 26) throw new Error("A ULID must be exactly 26 characters long.");
  for (let i = 0; i < 26; i++) {
    if (ULID_ALPHA.indexOf(s[i]) === -1) throw new Error(`Invalid character "${s[i]}" — ULIDs use Crockford Base32 (no I, L, O, U).`);
  }
  let ms = 0;
  for (let j = 0; j < 10; j++) ms = ms * 32 + ULID_ALPHA.indexOf(s[j]);
  const d = new Date(ms);
  if (isNaN(d.getTime())) throw new Error("Embedded timestamp is out of range.");
  return { ulid: s, timestampMs: ms, iso: d.toISOString(), utc: d.toUTCString() };
}

/* ================= binary <-> text ================= */
export function textToBinary(text, spaces = true) {
  const bytes = te.encode(text);
  const groups = [];
  for (let i = 0; i < bytes.length; i++) groups.push(bytes[i].toString(2).padStart(8, "0"));
  return { binary: groups.join(spaces ? " " : ""), bytes: bytes.length };
}
export function binaryToText(bin) {
  const cleaned = String(bin).replace(/0b/gi, "").replace(/[^01]/g, "");
  if (!cleaned) return { text: "" };
  if (/[^01\s,]/.test(String(bin).replace(/0b/gi, ""))) throw new Error("Input contains characters other than 0 and 1.");
  if (cleaned.length % 8 !== 0) throw new Error(`Bit count (${cleaned.length}) is not a multiple of 8.`);
  const bytes = new Uint8Array(cleaned.length / 8);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(cleaned.slice(i * 8, i * 8 + 8), 2);
  return { text: td.decode(bytes) };
}

/* ================= url encode/decode ================= */
export function urlEncode(text, mode = "component") {
  return mode === "full" ? encodeURI(text) : encodeURIComponent(text);
}
export function urlDecode(text) {
  try { return decodeURIComponent(text); }
  catch (e) { throw new Error("Invalid percent-encoding: " + e.message); }
}

/* ================= html entities ================= */
const ENT_SPECIAL = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export function htmlEncode(s, mode = "special") {
  s = String(s);
  if (mode !== "all") return s.replace(/[&<>"']/g, (ch) => ENT_SPECIAL[ch]);
  let out = "";
  for (const ch of s) {
    if (ENT_SPECIAL[ch]) { out += ENT_SPECIAL[ch]; continue; }
    const cp = ch.codePointAt(0);
    out += cp > 127 ? "&#" + cp + ";" : ch;
  }
  return out;
}
export function htmlDecode(s) { return decodeEntities(s); }

/* ================= hex <-> rgb ================= */
function parseHex(h) {
  h = String(h).trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), hex: "#" + h.toLowerCase() };
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}
const toHex2 = (n) => Math.min(255, Math.max(0, parseInt(n, 10) || 0)).toString(16).padStart(2, "0");
export function hexToRgb(hex) {
  const c = parseHex(hex);
  if (!c) throw new Error('Invalid hex color, e.g. "#ff5733" or "f53"');
  const hsl = rgbToHsl(c.r, c.g, c.b);
  return { r: c.r, g: c.g, b: c.b, hex: c.hex, hsl, css: `background: ${c.hex}; /* or rgb(${c.r}, ${c.g}, ${c.b}) */` };
}
export function rgbToHex(r, g, b) {
  const hex = "#" + toHex2(r) + toHex2(g) + toHex2(b);
  return hexToRgb(hex);
}

/* ================= rem <-> px ================= */
const fmt4 = (n) => String(Math.round(n * 10000) / 10000);
export function remToPx(rem, base = 16) {
  rem = parseFloat(rem); base = parseFloat(base);
  if (isNaN(rem) || !(base > 0)) throw new Error('Provide numeric "rem" and a positive "base" (default 16).');
  return { rem, base, px: parseFloat(fmt4(rem * base)) };
}
export function pxToRem(px, base = 16) {
  px = parseFloat(px); base = parseFloat(base);
  if (isNaN(px) || !(base > 0)) throw new Error('Provide numeric "px" and a positive "base" (default 16).');
  return { px, base, rem: parseFloat(fmt4(px / base)) };
}

/* ================= unix timestamp ================= */
export function timestampNow() {
  const ms = Date.now();
  return { seconds: Math.floor(ms / 1000), milliseconds: ms, iso: new Date(ms).toISOString(), utc: new Date(ms).toUTCString() };
}
export function timestampToDate(raw, unit = "auto") {
  if (!/^-?\d+$/.test(String(raw).trim())) throw new Error("Provide an integer timestamp.");
  const n = parseInt(String(raw).trim(), 10);
  if (unit === "auto") unit = Math.abs(n) >= 1e11 ? "ms" : "s";
  if (unit !== "ms" && unit !== "s") throw new Error('unit must be "s", "ms" or "auto".');
  const d = new Date(unit === "ms" ? n : n * 1000);
  if (isNaN(d.getTime())) throw new Error("That timestamp is out of range.");
  return { input: n, unit, iso: d.toISOString(), utc: d.toUTCString() };
}
export function dateToTimestamp(dateStr) {
  if (!dateStr) throw new Error('Provide "date", e.g. "2024-06-01T12:00:00Z".');
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) throw new Error("Invalid date.");
  const ms = d.getTime();
  return { input: dateStr, seconds: Math.floor(ms / 1000), milliseconds: ms, iso: d.toISOString() };
}

/* ================= chmod ================= */
const OCT_MAP = { 7: "rwx", 6: "rw-", 5: "r-x", 4: "r--", 3: "-wx", 2: "-w-", 1: "--x", 0: "---" };
export function octalToSymbolic(oct) {
  if (!/^[0-7]{3,4}$/.test(oct)) throw new Error('Provide 3 octal digits, e.g. "755".');
  return oct.split("").map((d) => OCT_MAP[d]).join("");
}
export function symbolicToOctal(sym) {
  const t = String(sym).trim();
  if (!/^[rwx-]{9}$/.test(t)) throw new Error('Provide 9 chars like "rwxr-xr-x".');
  const val = { r: 4, w: 2, x: 1, "-": 0 };
  let out = "";
  for (let i = 0; i < 3; i++) {
    const tri = t.slice(i * 3, i * 3 + 3);
    out += (val[tri[0]] + val[tri[1]] + val[tri[2]]);
  }
  return out;
}
export function chmodInfo(oct) {
  const symbolic = octalToSymbolic(oct);
  return { octal: oct, symbolic, command: `chmod ${oct} <file>` };
}

/* ================= css clamp ================= */
const r4 = (n) => { const r = Math.round(n * 10000) / 10000; return (r === 0 ? 0 : r).toString(); };
export function cssClamp(min, max, minVw, maxVw) {
  const a = parseFloat(min), b = parseFloat(max), va = parseFloat(minVw), vb = parseFloat(maxVw);
  if (!(a > 0) || !(b > 0) || !(va > 0) || !(vb > 0) || vb <= va || b < a)
    throw new Error("Sizes and viewports must be positive, max >= min, and max viewport > min viewport.");
  const slope = (b - a) / (vb - va);
  const intercept = a - slope * va;
  const formula = `clamp(${r4(a)}px, ${r4(intercept)}px + ${r4(slope * 100)}vw, ${r4(b)}px)`;
  return {
    css: `font-size: ${formula};`,
    formula,
    math: `slope = ${r4(slope)} px/vw · intercept = ${r4(intercept)}px — linear interpolation between the two breakpoints.`,
  };
}

/* ================= css specificity ================= */
function splitTopLevel(s, sep) {
  const parts = []; let cur = "", depth = 0, quote = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      cur += ch;
      if (ch === "\\" && i + 1 < s.length) { cur += s[i + 1]; i++; }
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") { quote = ch; cur += ch; }
    else if (ch === "(" || ch === "[") { depth++; cur += ch; }
    else if (ch === ")" || ch === "]") { depth--; cur += ch; }
    else if (ch === sep && depth === 0) { parts.push(cur); cur = ""; }
    else cur += ch;
  }
  parts.push(cur);
  return parts;
}
function readBalanced(s, i) {
  let depth = 0, quote = null, j = i;
  while (j < s.length) {
    const ch = s[j];
    if (quote) { if (ch === quote) quote = null; else if (ch === "\\") j++; }
    else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") { depth--; if (depth === 0) { j++; break; } }
    else if (ch === "\\") j++;
    j++;
  }
  return { text: s.slice(i, j), end: j };
}
function readBalancedAttr(s, i) {
  let quote = null, j = i + 1;
  while (j < s.length) {
    const ch = s[j];
    if (quote) { if (ch === quote) quote = null; else if (ch === "\\") j++; }
    else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "]") { j++; break; }
    else if (ch === "\\") j++;
    j++;
  }
  return { text: s.slice(i, j), end: j };
}
const isIdentChar = (ch) => /[a-zA-Z0-9_-]/.test(ch) || (ch && ch.charCodeAt(0) > 127);
function readIdent(s, i) {
  const start = i;
  while (i < s.length) {
    if (s[i] === "\\" && i + 1 < s.length) { i += 2; continue; }
    if (!isIdentChar(s[i])) break;
    i++;
  }
  return { text: s.slice(start, i), end: i };
}
function findTopLevelOf(inner) {
  let depth = 0, quote = null;
  for (let j = 0; j < inner.length - 2; j++) {
    const ch = inner[j];
    if (quote) { if (ch === quote) quote = null; else if (ch === "\\") j++; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (depth === 0 && (j === 0 || /\s/.test(inner[j - 1])) &&
             inner.slice(j, j + 2).toLowerCase() === "of" &&
             (j + 2 >= inner.length || /\s/.test(inner[j + 2]))) return j;
  }
  return -1;
}
const LEGACY_PSEUDO = { before: 1, after: 1, "first-line": 1, "first-letter": 1, selection: 1, marker: 1, placeholder: 1, backdrop: 1, "file-selector-button": 1 };
function cmpSpec(x, y) {
  if (x.a !== y.a) return x.a - y.a;
  if (x.b !== y.b) return x.b - y.b;
  return x.c - y.c;
}
export function scoreSelector(sel) {
  let a = 0, b = 0, c = 0;
  const parts = [];
  let i = 0; const n = sel.length;
  const add = (da, db, dc, text, why) => {
    a += da; b += db; c += dc;
    parts.push({ text, column: da ? "a" : (db ? "b" : (dc ? "c" : "0")), why });
  };
  while (i < n) {
    while (i < n && /\s/.test(sel[i])) i++;
    if (i >= n) break;
    const ch = sel[i];
    if (ch === ">" || ch === "+" || ch === "~") { i++; continue; }
    if (ch === "|") { i++; if (sel[i] === "|") i++; continue; }
    if (ch === "#") {
      i++; const id = readIdent(sel, i); i = id.end;
      add(1, 0, 0, "#" + id.text, "ID selector");
    } else if (ch === ".") {
      i++; const cl = readIdent(sel, i); i = cl.end;
      add(0, 1, 0, "." + cl.text, "class selector");
    } else if (ch === "[") {
      const blk = readBalancedAttr(sel, i);
      add(0, 1, 0, blk.text, "attribute selector");
      i = blk.end;
    } else if (ch === ":") {
      if (sel[i + 1] === ":") {
        i += 2;
        const pe = readIdent(sel, i); i = pe.end;
        let petext = "::" + pe.text;
        if (sel[i] === "(") { const pb = readBalanced(sel, i); petext += pb.text; i = pb.end; }
        add(0, 0, 1, petext, "pseudo-element");
      } else {
        i++;
        const pc = readIdent(sel, i); i = pc.end;
        const name = pc.text.toLowerCase();
        let pctext = ":" + pc.text;
        if (sel[i] === "(") {
          const fb = readBalanced(sel, i);
          const inner = fb.text.slice(1, -1);
          pctext += fb.text; i = fb.end;
          if (name === "where") {
            add(0, 0, 0, pctext, ":where() is always zero");
          } else if (name === "is" || name === "not" || name === "has") {
            let best = { a: 0, b: 0, c: 0 };
            splitTopLevel(inner, ",").forEach((arg) => {
              const s = scoreSelector(arg.trim());
              if (cmpSpec(s, best) > 0) best = s;
            });
            add(best.a, best.b, best.c, pctext, ":" + name + "() takes its most specific argument");
          } else if (/^nth-/.test(name)) {
            const ofIdx = findTopLevelOf(inner);
            add(0, 1, 0, ":" + pc.text + "(…)", "structural pseudo-class");
            if (ofIdx >= 0) {
              const ofSel = inner.slice(ofIdx + 2).trim();
              const s2 = scoreSelector(ofSel);
              add(s2.a, s2.b, s2.c, ofSel, 'the "of" selector list');
            }
          } else {
            add(0, 1, 0, pctext, "functional pseudo-class");
          }
        } else if (LEGACY_PSEUDO[name]) {
          add(0, 0, 1, pctext, "legacy single-colon pseudo-element");
        } else {
          add(0, 1, 0, pctext, "pseudo-class");
        }
      }
    } else if (ch === "*") {
      i++;
      add(0, 0, 0, "*", "universal selector — contributes nothing");
    } else if (ch === ",") {
      i++;
    } else {
      const el = readIdent(sel, i);
      if (el.text) { i = el.end; add(0, 0, 1, el.text, "type selector"); }
      else i++;
    }
  }
  return { a, b, c, specificity: `(${a}, ${b}, ${c})`, breakdown: parts };
}

/* ================= cron ================= */
const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const CRON_FIELDS = ["minute", "hour", "dom", "month", "dow"];
const CRON_RANGES = { minute: [0, 59], hour: [0, 23], dom: [1, 31], month: [1, 12], dow: [0, 6] };
function cronParseField(str, min, max) {
  const values = {};
  const add = (lo, hi, step) => { for (let v = lo; v <= hi; v += step) values[v] = true; };
  str = str.trim();
  if (str === "*") { add(min, max, 1); return { star: true, values }; }
  for (const p of str.split(",")) {
    let step = 1, range = p;
    const slash = p.indexOf("/");
    if (slash !== -1) {
      range = p.slice(0, slash);
      step = parseInt(p.slice(slash + 1), 10);
      if (isNaN(step) || step < 1) return null;
    }
    let lo, hi;
    if (range === "" || range === "*") { lo = min; hi = max; }
    else {
      const dash = range.indexOf("-");
      if (dash !== -1) { lo = parseInt(range.slice(0, dash), 10); hi = parseInt(range.slice(dash + 1), 10); }
      else lo = hi = parseInt(range, 10);
      if (isNaN(lo) || isNaN(hi) || lo < min || hi > max || lo > hi) return null;
    }
    add(lo, hi, step);
  }
  return { star: false, values };
}
export function parseCron(expr) {
  const parts = String(expr).trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const out = {};
  for (let i = 0; i < 5; i++) {
    const field = CRON_FIELDS[i];
    const fmax = field === "dow" ? 7 : CRON_RANGES[field][1];
    const p = cronParseField(parts[i], CRON_RANGES[field][0], fmax);
    if (!p) return null;
    if (field === "dow" && p.values[7]) { p.values[0] = true; delete p.values[7]; }
    out[field] = p;
  }
  out.parts = parts;
  return out;
}
function cronMatches(d, P) {
  if (!P.minute.values[d.getMinutes()]) return false;
  if (!P.hour.values[d.getHours()]) return false;
  if (!P.month.values[d.getMonth() + 1]) return false;
  let dayOk;
  if (P.dom.star && P.dow.star) dayOk = true;
  else if (P.dom.star) dayOk = !!P.dow.values[d.getDay()];
  else if (P.dow.star) dayOk = !!P.dom.values[d.getDate()];
  else dayOk = !!P.dom.values[d.getDate()] || !!P.dow.values[d.getDay()];
  return dayOk;
}
export function cronNextRuns(expr, count = 5) {
  const P = parseCron(expr);
  if (!P) throw new Error('Invalid cron expression — expected 5 fields, e.g. "*/5 * * * *".');
  count = Math.min(50, Math.max(1, parseInt(count, 10) || 5));
  const runs = [];
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  let guard = 0;
  const maxIter = 525600 * 4;
  while (runs.length < count && guard < maxIter) {
    if (cronMatches(d, P)) runs.push(new Date(d.getTime()).toISOString());
    d.setMinutes(d.getMinutes() + 1);
    guard++;
  }
  return runs;
}
export function describeCron(expr) {
  const parts = String(expr).trim().split(/\s+/);
  if (parts.length !== 5 || !parseCron(expr)) throw new Error('Invalid cron expression — expected 5 fields, e.g. "*/5 * * * *".');
  const [mi, h, dom, mon, dow] = parts;
  const t = (n) => { n = +n; return (n < 10 ? "0" : "") + n; };
  const isNum = (s) => /^\d+$/.test(s);
  const step = (s) => { const m = /^\*\/(\d+)$/.exec(s); return m ? m[1] : null; };
  let s;
  if (mi === "*" && h === "*" && dom === "*" && mon === "*" && dow === "*") return "Every minute";
  if ((s = step(mi)) && h === "*" && dom === "*" && mon === "*" && dow === "*") return "Every " + s + " minutes";
  if (isNum(mi) && h === "*" && dom === "*" && mon === "*" && dow === "*") return "At minute " + mi + " past every hour";
  if (isNum(mi) && (s = step(h)) && dom === "*" && mon === "*" && dow === "*") return "At minute " + mi + " past every " + s + " hours";
  if (isNum(mi) && isNum(h) && dom === "*" && mon === "*" && dow === "*") return "At " + t(h) + ":" + t(mi) + " every day";
  if (isNum(mi) && isNum(h) && dom === "*" && mon === "*" && isNum(dow)) return "At " + t(h) + ":" + t(mi) + " every " + DOW_NAMES[+dow % 7];
  if (isNum(mi) && isNum(h) && isNum(dom) && mon === "*" && dow === "*") return "At " + t(h) + ":" + t(mi) + " on day " + dom + " of every month";
  if (isNum(mi) && isNum(h) && dom === "*" && isNum(mon) && dow === "*") return "At " + t(h) + ":" + t(mi) + " in " + MONTH_NAMES[(+mon - 1) % 12];
  return "Custom schedule: " + parts.join(" ");
}

/* ================= curl -> fetch ================= */
function tokenizeCurl(cmd) {
  const s = String(cmd).replace(/\\\r?\n/g, " ").replace(/\^\r?\n/g, " ").replace(/`\r?\n/g, " ");
  const args = [];
  let cur = "", quote = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === "\\" && quote === '"' && i + 1 < s.length) { cur += s[i + 1]; i++; }
      else cur += ch;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "\\" && i + 1 < s.length) { cur += s[i + 1]; i++; }
    else if (/\s/.test(ch)) { if (cur !== "") { args.push(cur); cur = ""; } }
    else cur += ch;
  }
  if (cur !== "") args.push(cur);
  return args;
}
function b64ascii(s) {
  const bytes = te.encode(s);
  let bin = "";
  for (const b of bytes) {
    if (b > 127) throw new Error("non-ascii");
    bin += String.fromCharCode(b);
  }
  return btoa(bin);
}
export function curlToFetch(cmd, style = "async") {
  if (!String(cmd).trim()) throw new Error('Provide "curl" command text.');
  const args = tokenizeCurl(cmd);
  const r = { url: null, method: null, headers: [], data: [], dataKind: null, user: null, userAgent: null, referer: null, cookie: null, get: false, head: false, insecure: false, notes: [] };
  let i = args[0] === "curl" ? 1 : 0;
  const next = () => { i++; return args[i]; };
  for (; i < args.length; i++) {
    const a = args[i];
    if (a === "-X" || a === "--request") r.method = String(next() || "").toUpperCase();
    else if (a === "-H" || a === "--header") {
      const h = next() || "", idx = h.indexOf(":");
      if (idx > 0) r.headers.push([h.slice(0, idx).trim(), h.slice(idx + 1).trim()]);
      else r.notes.push("Skipped malformed header: " + h);
    }
    else if (a === "-d" || a === "--data" || a === "--data-raw" || a === "--data-ascii") { r.data.push(next()); r.dataKind = "data"; }
    else if (a === "--data-binary") { r.data.push(next()); r.dataKind = "binary"; }
    else if (a === "--data-urlencode") { r.data.push(next()); r.dataKind = "urlencode"; }
    else if (a === "--json") { r.data.push(next()); r.dataKind = "json"; }
    else if (a === "-F" || a === "--form") { r.data.push(next()); r.dataKind = "form"; }
    else if (a === "-u" || a === "--user") r.user = next();
    else if (a === "-A" || a === "--user-agent") r.userAgent = next();
    else if (a === "-e" || a === "--referer") r.referer = next();
    else if (a === "-b" || a === "--cookie") r.cookie = next();
    else if (a === "-G" || a === "--get") r.get = true;
    else if (a === "-I" || a === "--head") r.head = true;
    else if (a === "-k" || a === "--insecure") r.insecure = true;
    else if (a === "-L" || a === "--location") r.notes.push("fetch() follows redirects by default (like curl -L).");
    else if (a === "--url") r.url = next();
    else if (a === "--compressed") { /* fetch handles encoding transparently */ }
    else if (a.charAt(0) === "-" && a !== "-") r.notes.push("Ignored option: " + a);
    else if (!r.url) r.url = a;
  }
  if (!r.url) throw new Error("Could not find a URL in the curl command.");
  if (style !== "async" && style !== "promise") throw new Error('style must be "async" or "promise".');

  const notes = r.notes.slice();
  let url = r.url;
  const method = r.method || (r.data.length && !r.get ? "POST" : (r.head ? "HEAD" : "GET"));
  let headers = r.headers.slice();
  const prelude = [];
  let bodyLine = null;
  const setHeader = (name, value) => {
    let found = false;
    headers = headers.map((h) => {
      if (h[0].toLowerCase() === name.toLowerCase()) { found = true; return [h[0], value]; }
      return h;
    });
    if (!found) headers.push([name, value]);
  };
  if (r.user) {
    try { setHeader("Authorization", "Basic " + b64ascii(r.user)); }
    catch {
      setHeader("Authorization", "Basic <base64-of-credentials>");
      notes.push("Credentials contain non-ASCII characters — base64-encode them yourself and paste the result.");
    }
  }
  if (r.userAgent) setHeader("User-Agent", r.userAgent);
  if (r.referer) setHeader("Referer", r.referer);
  if (r.cookie) {
    setHeader("Cookie", r.cookie);
    notes.push('Cookie is a forbidden header in browsers — fetch() will strip it. Works in Node.js 18+; in browsers use credentials: "include" instead.');
  }
  if (r.get && r.data.length) {
    const sep = url.indexOf("?") >= 0 ? "&" : "?";
    url = url + sep + r.data.join("&");
    notes.push("With -G, curl appends the data to the URL as a query string.");
  } else if (r.data.length && !r.head) {
    const dataStr = r.data.join("&");
    if (r.dataKind === "json") {
      setHeader("Content-Type", "application/json");
      try { bodyLine = "body: JSON.stringify(" + JSON.stringify(JSON.parse(dataStr), null, 2) + "),"; }
      catch { bodyLine = "body: " + JSON.stringify(dataStr) + ","; notes.push("Body was not valid JSON — emitted verbatim."); }
    } else if (r.dataKind === "form") {
      prelude.push("const formData = new FormData();");
      r.data.forEach((f) => {
        const eq = f.indexOf("=");
        const k = eq >= 0 ? f.slice(0, eq) : f;
        const v = eq >= 0 ? f.slice(eq + 1) : "";
        if (v.charAt(0) === "@") {
          prelude.push("formData.append(" + JSON.stringify(k) + ", /* file: " + v.slice(1) + " — attach manually */ null);");
          notes.push("Multipart file upload (" + v + ") cannot be embedded — attach the file yourself.");
        } else {
          prelude.push("formData.append(" + JSON.stringify(k) + ", " + JSON.stringify(v) + ");");
        }
      });
      bodyLine = "body: formData,";
    } else if (r.dataKind === "urlencode") {
      bodyLine = "body: " + JSON.stringify(dataStr) + ",";
      notes.push("curl URL-encodes --data-urlencode content — percent-encode special characters yourself if needed.");
    } else if (dataStr.charAt(0) === "@") {
      bodyLine = "body: /* file: " + dataStr.slice(1) + " — read and embed manually */,";
      notes.push("Body reads from a local file (" + dataStr + ") — embed its contents yourself.");
    } else {
      try { bodyLine = "body: JSON.stringify(" + JSON.stringify(JSON.parse(dataStr), null, 2) + "),"; }
      catch { bodyLine = "body: " + JSON.stringify(dataStr) + ","; }
    }
  }
  if (r.insecure) notes.push("curl -k skips TLS verification — fetch() has no equivalent; only use the original command against trusted test servers.");

  const opts = [];
  if (method !== "GET") opts.push("method: '" + method + "',");
  if (headers.length) {
    opts.push("headers: {");
    headers.forEach((h, idx) => {
      opts.push("  " + JSON.stringify(h[0]) + ": " + JSON.stringify(h[1]) + (idx < headers.length - 1 ? "," : ""));
    });
    opts.push("},");
  }
  if (bodyLine) opts.push(bodyLine);

  const L = [];
  prelude.forEach((x) => L.push(x));
  const urlLit = JSON.stringify(url);
  if (style === "async") {
    if (opts.length) {
      L.push("const response = await fetch(" + urlLit + ", {");
      opts.forEach((o) => L.push("  " + o));
      L.push("});");
    } else {
      L.push("const response = await fetch(" + urlLit + ");");
    }
    L.push("const data = await response.json();");
    L.push("console.log(data);");
  } else {
    if (opts.length) {
      L.push("fetch(" + urlLit + ", {");
      opts.forEach((o) => L.push("  " + o));
      L.push("})");
    } else {
      L.push("fetch(" + urlLit + ")");
    }
    L.push("  .then(response => response.json())");
    L.push("  .then(data => console.log(data))");
    L.push("  .catch(error => console.error(error));");
  }
  return { code: L.join("\n"), notes };
}

/* ================= morse ================= */
const MORSE = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-", G: "--.", H: "....",
  I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.", O: "---", P: ".--.",
  Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-", V: "...-", W: ".--",
  X: "-..-", Y: "-.--", Z: "--..",
  0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-", 5: ".....",
  6: "-....", 7: "--...", 8: "---..", 9: "----.",
  ".": ".-.-.-", ",": "--..--", "?": "..--..", "'": ".----.", "!": "-.-.--",
  "/": "-..-.", "(": "-.--.", ")": "-.--.-", "&": ".-...", ":": "---...",
  ";": "-.-.-.", "=": "-...-", "+": ".-.-.", "-": "-....-", _: "..--.-",
  '"': ".-..-.", $: "...-..-", "@": ".--.-.",
};
const MORSE_REV = {};
Object.keys(MORSE).forEach((k) => { MORSE_REV[MORSE[k]] = k; });
export function morseEncode(text) {
  let skipped = 0;
  const words = String(text).toUpperCase().split(/\s+/).filter(Boolean);
  const out = words.map((w) => {
    const letters = [];
    for (const ch of w) {
      if (MORSE[ch]) letters.push(MORSE[ch]);
      else skipped++;
    }
    return letters.join(" ");
  });
  return { morse: out.join(" / "), skipped };
}
export function morseDecode(morse) {
  let unknown = 0;
  const words = String(morse).trim().split(/\s*\/\s*/);
  const out = words.map((w) =>
    w.trim().split(/\s+/).filter(Boolean).map((l) => {
      if (MORSE_REV[l]) return MORSE_REV[l];
      unknown++; return "?";
    }).join("")
  );
  return { text: out.join(" "), unknown };
}

/* ================= http status ================= */
export function httpStatusLookup(code) {
  if (code === undefined || code === null || code === "") return HTTP_STATUS;
  const n = parseInt(code, 10);
  const e = HTTP_STATUS.find((x) => x.code === n);
  if (!e) throw new Error(`Unknown status code "${code}".`);
  return e;
}

/* ================= json -> csv ================= */
function flattenObj(obj, prefix, out) {
  out = out || {};
  Object.keys(obj).forEach((k) => {
    const key = prefix ? prefix + "." + k : k;
    const v = obj[k];
    if (v !== null && typeof v === "object" && !Array.isArray(v)) flattenObj(v, key, out);
    else if (Array.isArray(v)) out[key] = v.every((x) => x === null || typeof x !== "object") ? v.join("; ") : JSON.stringify(v);
    else out[key] = v;
  });
  return out;
}
function csvCell(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export function jsonToCsv(data) {
  const rows = Array.isArray(data) ? data : [data];
  if (!rows.length) throw new Error("Empty array — nothing to convert.");
  const flat = [], cols = [], seen = {};
  rows.forEach((item, idx) => {
    if (item === null || typeof item !== "object" || Array.isArray(item))
      throw new Error(`Row ${idx + 1} is not an object — wrap values in objects, e.g. [{"value": 1}]`);
    const f = flattenObj(item, "", {});
    flat.push(f);
    Object.keys(f).forEach((k) => { if (!seen[k]) { seen[k] = 1; cols.push(k); } });
  });
  const lines = [cols.map(csvCell).join(",")];
  flat.forEach((r) => lines.push(cols.map((c) => csvCell(r[c])).join(",")));
  return { csv: lines.join("\r\n"), rows: flat.length, columns: cols.length };
}

/* ================= json -> sql ================= */
const SQL_TYPES = {
  mysql: { int: "INT", float: "DECIMAL(12,4)", bool: "BOOLEAN", str: "VARCHAR(255)", text: "TEXT" },
  pg: { int: "INTEGER", float: "NUMERIC", bool: "BOOLEAN", str: "VARCHAR(255)", text: "TEXT" },
  sqlite: { int: "INTEGER", float: "REAL", bool: "INTEGER", str: "TEXT", text: "TEXT" },
};
function sqlIdent(name, d) {
  const clean = String(name).replace(/[^A-Za-z0-9_]/g, "_") || "col";
  return d === "mysql" ? "`" + clean + "`" : '"' + clean.replace(/"/g, '""') + '"';
}
const sqlEsc = (s) => "'" + String(s).replace(/'/g, "''") + "'";
function inferType(values) {
  const seen = {};
  values.forEach((v) => {
    if (v === null || v === undefined) return;
    const t = typeof v;
    if (t === "boolean") seen.bool = 1;
    else if (t === "number") { if (Number.isInteger(v)) seen.int = 1; else seen.float = 1; }
    else if (t === "string") { if (v.length > 255) seen.text = 1; else seen.str = 1; }
    else seen.text = 1;
  });
  if (seen.text) return "text";
  if (seen.float) return "float";
  if (seen.int && seen.str) return "str";
  if (seen.int) return "int";
  if (seen.bool && (seen.int || seen.str)) return "str";
  if (seen.bool) return "bool";
  if (seen.str) return "str";
  return "text";
}
function sqlVal(v) {
  if (v === null || v === undefined) return "NULL";
  const t = typeof v;
  if (t === "boolean") return v ? "TRUE" : "FALSE";
  if (t === "number") return String(v);
  if (t === "object") return sqlEsc(JSON.stringify(v));
  return sqlEsc(v);
}
export function jsonToSql(data, opts = {}) {
  const dialect = (opts.dialect || "pg").toLowerCase();
  if (!SQL_TYPES[dialect]) throw new Error('dialect must be "mysql", "pg" or "sqlite".');
  const T = SQL_TYPES[dialect];
  const rows0 = Array.isArray(data) ? data : [data];
  const rows = rows0.filter((r) => r !== null && typeof r === "object" && !Array.isArray(r));
  if (!rows.length) throw new Error("JSON must be an object or an array of objects.");
  const cols = [];
  rows.forEach((r) => Object.keys(r).forEach((k) => { if (cols.indexOf(k) === -1) cols.push(k); }));
  const colTypes = cols.map((c) => inferType(rows.map((r) => r[c])));
  const tname = (opts.table || "my_table").replace(/[^A-Za-z0-9_]/g, "_") || "my_table";
  const qi = sqlIdent(tname, dialect);
  const parts = [];
  if (opts.create) {
    const defs = cols.map((c, i) => "  " + sqlIdent(c, dialect) + " " + T[colTypes[i]]);
    parts.push("CREATE TABLE IF NOT EXISTS " + qi + " (\n" + defs.join(",\n") + "\n);");
  }
  const collist = cols.map((c) => sqlIdent(c, dialect)).join(", ");
  const mode = opts.mode === "bulk" ? "bulk" : "single";
  if (mode === "bulk") {
    const vals = rows.map((r) => "(" + cols.map((c) => sqlVal(r[c])).join(", ") + ")");
    parts.push("INSERT INTO " + qi + " (" + collist + ") VALUES\n" + vals.join(",\n") + ";");
  } else {
    rows.forEach((r) => {
      parts.push("INSERT INTO " + qi + " (" + collist + ") VALUES (" + cols.map((c) => sqlVal(r[c])).join(", ") + ");");
    });
  }
  return { sql: parts.join("\n\n"), rows: rows.length, columns: cols.length, dialect, table: tname };
}

/* ================= json -> typescript ================= */
function toPascal(s) {
  const p = String(s).split(/[^a-zA-Z0-9]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
  return p || "Item";
}
const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const safeKey = (k) => /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
export function jsonToTs(value, rootName = "Root", style = "export") {
  if (!["export", "plain", "type"].includes(style)) throw new Error('style must be "export", "plain" or "type".');
  const defs = [];
  const used = {};
  const uniqueName = (base) => { let name = base, n = 2; while (used[name]) name = base + (n++); used[name] = true; return name; };
  function typeOf(v, hint) {
    if (v === null) return "null";
    if (Array.isArray(v)) {
      if (!v.length) return "unknown[]";
      const prim = {}, objs = [];
      v.forEach((e) => { if (isPlainObject(e)) objs.push(e); else prim[typeOf(e, hint + "Item")] = true; });
      const parts = Object.keys(prim);
      if (objs.length) parts.push(mergeObjects(objs, hint + "Item"));
      return (parts.length > 1 ? "(" + parts.join(" | ") + ")" : parts[0]) + "[]";
    }
    if (isPlainObject(v)) return defineInterface(v, hint);
    if (typeof v === "string") return "string";
    if (typeof v === "number") return "number";
    if (typeof v === "boolean") return "boolean";
    return "unknown";
  }
  function mergeObjects(samples, hint) {
    const counts = {};
    samples.forEach((s) => Object.keys(s).forEach((k) => { counts[k] = (counts[k] || 0) + 1; }));
    const fields = {};
    Object.keys(counts).forEach((k) => {
      const types = {};
      samples.forEach((s) => { if (k in s) types[typeOf(s[k], hint + toPascal(k))] = true; });
      const t = Object.keys(types);
      fields[k] = { type: t.length > 1 ? "(" + t.join(" | ") + ")" : (t[0] || "unknown"), optional: counts[k] < samples.length };
    });
    const name = uniqueName(toPascal(hint));
    defs.push({ name, fields });
    return name;
  }
  function defineInterface(obj, hint) {
    const fields = {};
    Object.keys(obj).forEach((k) => { fields[k] = { type: typeOf(obj[k], hint + toPascal(k)), optional: false }; });
    const name = uniqueName(toPascal(hint));
    defs.push({ name, fields });
    return name;
  }
  function renderDef(def) {
    let open, close;
    if (style === "type") { open = "export type " + def.name + " = {"; close = "};"; }
    else if (style === "plain") { open = "interface " + def.name + " {"; close = "}"; }
    else { open = "export interface " + def.name + " {"; close = "}"; }
    const lines = [open];
    Object.keys(def.fields).forEach((k) => {
      const f = def.fields[k];
      lines.push("  " + safeKey(k) + (f.optional ? "?" : "") + ": " + f.type + ";");
    });
    lines.push(close);
    return lines.join("\n");
  }
  rootName = toPascal(rootName);
  const out = [];
  if (isPlainObject(value)) {
    defineInterface(value, rootName);
    const rootDef = defs.pop();
    out.push(renderDef(rootDef));
    defs.forEach((d) => out.push(renderDef(d)));
  } else if (Array.isArray(value) && value.length && value.every(isPlainObject)) {
    const itemName = mergeObjects(value, rootName + "Item");
    out.push(renderDef(defs.pop()));
    defs.forEach((d) => out.push(renderDef(d)));
    out.unshift(style === "plain" ? "type " + rootName + " = " + itemName + "[];" : "export type " + rootName + " = " + itemName + "[];");
  } else {
    const t = typeOf(value, rootName + "Item");
    out.push((style === "plain" ? "type " : "export type ") + rootName + " = " + t + ";");
  }
  return { typescript: out.join("\n\n") };
}

/* ================= svg -> data uri ================= */
export function svgToDataUri(svg) {
  const raw = String(svg).trim();
  if (!raw) throw new Error('Provide "svg" markup.');
  if (!/<svg[\s>]/i.test(raw)) throw new Error("Input does not look like SVG markup.");
  const clean = raw
    .replace(/<\?xml[^?]*\?>/g, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .trim();
  const uri = "data:image/svg+xml," + encodeURIComponent(clean).replace(/'/g, "%27").replace(/\(/g, "%28").replace(/\)/g, "%29");
  const before = te.encode(raw).length, after = te.encode(uri).length;
  return {
    dataUri: uri,
    originalBytes: before,
    dataUriBytes: after,
    overheadPct: before ? Math.round((after - before) / before * 100) : 0,
  };
}

/* ================= xml -> json / yaml -> json ================= */
export function xmlToJson(xml, opts = {}) {
  if (!String(xml).trim()) throw new Error('Provide "xml" markup.');
  const root = parseXMLDoc(xml);
  return { json: xmlNodeToJson(root, { attrs: opts.attrs !== false, coerce: !!opts.coerce }) };
}
export function yamlToJson(yaml) {
  if (!String(yaml).trim()) throw new Error('Provide "yaml" text.');
  return { json: parseYAML(yaml) };
}
export function jsonToYaml(data) {
  return { yaml: toYAML(data, 0) + "\n" };
}
