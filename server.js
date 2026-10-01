#!/usr/bin/env node
/**
 * TinyKit MCP Server — exposes all 24 TinyKit developer utilities as MCP tools.
 *
 * Transport: stdio (for Claude Code, Cursor, Windsurf, etc.)
 * Logic: reuses ../src/tools.js directly — no duplicated implementations.
 *
 * Auth hook: set TINYKIT_API_KEY to a Pro key (tk_live_...). Today the server
 * executes everything locally, so the key is optional and unused; it is read at
 * startup and threaded through withAuth() so a future metered/remote mode can
 * attach it as `x-api-key` without changing tool code. The key value is never
 * logged or echoed back.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  b64encode, b64decode, hashText, uuid4,
  generateUlid, decodeUlid,
  textToBinary, binaryToText,
  urlEncode, urlDecode,
  htmlEncode, htmlDecode,
  hexToRgb, rgbToHex,
  remToPx, pxToRem,
  timestampNow, timestampToDate, dateToTimestamp,
  octalToSymbolic, symbolicToOctal, chmodInfo,
  cssClamp, scoreSelector,
  parseCron, describeCron, cronNextRuns,
  curlToFetch,
  morseEncode, morseDecode,
  httpStatusLookup,
  jsonToCsv, jsonToSql, jsonToTs,
  svgToDataUri,
  xmlToJson, yamlToJson, jsonToYaml,
} from "./src/tools.js";
import { fetchMarkdown } from "./src/fetch-markdown.js";

/* ================= auth hook (reserved) ================= */
const API_KEY = process.env.TINYKIT_API_KEY || "";
const AUTH_MODE = API_KEY ? "key-present (reserved for future metered mode)" : "free (no key)";
// withAuth wraps every tool handler. Today it is a passthrough because execution
// is local; when remote metered mode ships, attach `x-api-key: API_KEY` here.
const withAuth = (fn) => async (args) => fn(args, { apiKey: API_KEY });

/* ================= helpers ================= */
const ok = (data) => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
const err = (message) => ({ content: [{ type: "text", text: `Error: ${message}` }], isError: true });
const need = (v, name) => {
  if (v === undefined || v === null || v === "") throw new Error(`missing required parameter "${name}"`);
  return v;
};
const num = (v, name) => {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`parameter "${name}" must be a number`);
  return n;
};
const run = (fn) => async (args) => {
  try { return ok(await withAuth(fn)(args)); }
  catch (e) { return err(e.message); }
};

/* ================= server ================= */
const server = new McpServer({ name: "tinykit", version: "1.0.0" });

/* ---------- 1. base64 ---------- */
server.tool("base64",
  "Encode text to Base64 or decode Base64 back to text (UTF-8). " +
  'Example in: {"action":"encode","text":"hello"} -> {"output":"aGVsbG8="}. ' +
  'Example in: {"action":"decode","text":"aGVsbG8="} -> {"output":"hello"}.',
  { action: z.enum(["encode", "decode"]), text: z.string() },
  run(({ action, text }) => ({ input: text, output: action === "encode" ? b64encode(text) : b64decode(text) })));

/* ---------- 2. binary ---------- */
server.tool("binary",
  "Convert text to binary (8-bit groups) or binary back to text. " +
  'Example in: {"action":"encode","text":"Hi"} -> {"binary":"01001000 01101001","bytes":2}.',
  { action: z.enum(["encode", "decode"]), text: z.string(), spaces: z.boolean().optional().default(true) },
  run(({ action, text, spaces }) => action === "encode" ? textToBinary(text, spaces) : binaryToText(text)));

/* ---------- 3. hash ---------- */
server.tool("hash",
  "Hash text with md5, sha1, sha256 (default) or sha512. " +
  'Example in: {"text":"hello","algo":"sha256"} -> {"output":"2cf24dba..."}.',
  { text: z.string(), algo: z.enum(["md5", "sha1", "sha256", "sha512"]).optional().default("sha256") },
  run(async ({ text, algo }) => ({ input: text, algo, output: await hashText(text, algo) })));

/* ---------- 4. url_codec ---------- */
server.tool("url_codec",
  "URL-encode (percent-encode) or decode text. mode=component encodes everything except unreserved chars; mode=full leaves :/?#[]@!$&'()*+,;= untouched. " +
  'Example in: {"action":"encode","text":"a b&c"} -> {"output":"a%20b%26c"}.',
  { action: z.enum(["encode", "decode"]), text: z.string(), mode: z.enum(["component", "full"]).optional().default("component") },
  run(({ action, text, mode }) => ({ input: text, mode, output: action === "encode" ? urlEncode(text, mode) : urlDecode(text) })));

/* ---------- 5. html_entity ---------- */
server.tool("html_entity",
  "Encode text to HTML entities or decode entities back to text. mode=special escapes only &<>\"'; mode=all escapes every non-ASCII char too. " +
  'Example in: {"action":"encode","text":"<p>Hi</p>"} -> {"output":"&lt;p&gt;Hi&lt;/p&gt;"}.',
  { action: z.enum(["encode", "decode"]), text: z.string(), mode: z.enum(["special", "all"]).optional().default("special") },
  run(({ action, text, mode }) => ({ input: text, output: action === "encode" ? htmlEncode(text, mode) : htmlDecode(text) })));

/* ---------- 6. morse ---------- */
server.tool("morse",
  "Encode text to Morse code or decode Morse back to text. " +
  'Example in: {"action":"encode","text":"SOS"} -> {"morse":"... --- ...","skipped":0}.',
  { action: z.enum(["encode", "decode"]), text: z.string() },
  run(({ action, text }) => action === "encode" ? morseEncode(text) : morseDecode(text)));

/* ---------- 7. uuid ---------- */
server.tool("uuid",
  "Generate 1-100 cryptographically random UUID v4 identifiers. " +
  'Example in: {"count":3} -> {"count":3,"uuids":["...","...","..."]}.',
  { count: z.number().int().min(1).max(100).optional().default(1) },
  run(({ count }) => ({ count, uuids: Array.from({ length: count }, uuid4) })));

/* ---------- 8. ulid ---------- */
server.tool("ulid",
  "Generate sortable ULIDs, or decode a ULID to its embedded timestamp. " +
  'Example generate: {"action":"generate","count":2}. ' +
  'Example decode: {"action":"decode","ulid":"01HXYZ..."} -> {"timestampMs":...,"iso":"...","utc":"..."}.',
  { action: z.enum(["generate", "decode"]), count: z.number().int().min(1).max(100).optional().default(1), ulid: z.string().optional() },
  run(({ action, count, ulid }) => {
    if (action === "generate") return { count, ulids: Array.from({ length: count }, generateUlid) };
    return decodeUlid(need(ulid, "ulid"));
  }));

/* ---------- 9. color_convert ---------- */
server.tool("color_convert",
  "Convert between HEX and RGB colors. Returns r/g/b, hex, HSL and a CSS snippet. Provide EITHER hex OR r+g+b. " +
  'Example in: {"hex":"ff5733"} -> {"r":255,"g":87,"b":51,"hex":"#ff5733","hsl":{...}}. ' +
  'Example in: {"r":255,"g":87,"b":51} -> same shape.',
  { hex: z.string().optional(), r: z.number().optional(), g: z.number().optional(), b: z.number().optional() },
  run(({ hex, r, g, b }) => {
    if (hex) return hexToRgb(hex);
    if (r !== undefined && g !== undefined && b !== undefined) return rgbToHex(r, g, b);
    throw new Error('provide "hex" (e.g. "ff5733") or r+g+b (e.g. {"r":255,"g":87,"b":51})');
  }));

/* ---------- 10. rem_px_convert ---------- */
server.tool("rem_px_convert",
  "Convert between rem and px units. Provide EITHER rem OR px; base defaults to 16. " +
  'Example in: {"rem":1.5} -> {"rem":1.5,"base":16,"px":24}.',
  { rem: z.number().optional(), px: z.number().optional(), base: z.number().optional().default(16) },
  run(({ rem, px, base }) => {
    if (rem !== undefined) return remToPx(rem, base);
    if (px !== undefined) return pxToRem(px, base);
    throw new Error('provide "rem" or "px" (e.g. {"rem":1.5})');
  }));

/* ---------- 11. timestamp ---------- */
server.tool("timestamp",
  "Unix timestamp utilities. action=now returns current time; to_date converts a timestamp to ISO/UTC (unit auto|s|ms); from_date converts a date string to timestamps. " +
  'Example: {"action":"to_date","ts":1693526400} -> {"iso":"2023-09-01T00:00:00.000Z",...}.',
  { action: z.enum(["now", "to_date", "from_date"]), ts: z.union([z.string(), z.number()]).optional(), unit: z.enum(["auto", "s", "ms"]).optional().default("auto"), date: z.string().optional() },
  run(({ action, ts, unit, date }) => {
    if (action === "now") return timestampNow();
    if (action === "to_date") return timestampToDate(String(need(ts, "ts")), unit);
    return dateToTimestamp(need(date, "date"));
  }));

/* ---------- 12. chmod ---------- */
server.tool("chmod",
  "Convert between octal (755) and symbolic (rwxr-xr-x) Unix file permissions; returns the chmod command too. " +
  'Example in: {"mode":"755"} -> {"octal":"755","symbolic":"rwxr-xr-x","command":"chmod 755 <file>"}.',
  { mode: z.string().optional(), symbolic: z.string().optional() },
  run(({ mode, symbolic }) => {
    if (mode) return chmodInfo(mode);
    if (symbolic) { const octal = symbolicToOctal(symbolic); return { octal, symbolic: symbolic.trim(), command: `chmod ${octal} <file>` }; }
    throw new Error('provide "mode" (e.g. "755") or "symbolic" (e.g. "rwxr-xr-x")');
  }));

/* ---------- 13. css_clamp ---------- */
server.tool("css_clamp",
  "Generate a fluid CSS clamp() expression for responsive typography/spacing from min/max size and viewport range. " +
  'Example in: {"min":16,"max":24,"minVw":320,"maxVw":1200} -> {"css":"font-size: clamp(16px, 13.09px + 0.91vw, 24px);",...}.',
  { min: z.number(), max: z.number(), minVw: z.number(), maxVw: z.number() },
  run(({ min, max, minVw, maxVw }) => cssClamp(min, max, minVw, maxVw)));

/* ---------- 14. css_specificity ---------- */
server.tool("css_specificity",
  "Calculate CSS selector specificity as (a,b,c) with a per-part breakdown explaining which column each part scores in. Accepts one selector or up to 50. " +
  'Example in: {"selector":"#app .nav > a"} -> {"a":1,"b":1,"c":1,"specificity":"(1, 1, 1)","breakdown":[...]}.',
  { selector: z.string().optional(), selectors: z.array(z.string()).max(50).optional() },
  run(({ selector, selectors }) => {
    const list = selector ? [selector] : (selectors || []);
    if (!list.length) throw new Error('provide "selector" or "selectors" (max 50)');
    const results = list.map((s) => ({ selector: s, ...scoreSelector(s) }));
    return list.length === 1 ? results[0] : { results };
  }));

/* ---------- 15. cron ---------- */
server.tool("cron",
  "Parse cron expressions: action=describe gives a plain-English description and validity; action=next_runs lists upcoming run times. " +
  'Example in: {"action":"describe","expr":"*/5 * * * *"} -> {"description":"Every 5 minutes","valid":true}.',
  { action: z.enum(["describe", "next_runs"]), expr: z.string(), count: z.number().int().min(1).max(50).optional().default(5) },
  run(({ action, expr, count }) => {
    need(expr, "expr");
    if (action === "describe") return { expr, description: describeCron(expr), valid: !!parseCron(expr) };
    return { expr, nextRuns: cronNextRuns(expr, count) };
  }));

/* ---------- 16. curl_to_fetch ---------- */
server.tool("curl_to_fetch",
  "Convert a curl command to JavaScript fetch() code (style=async for async/await, or promise for .then chains). " +
  'Example in: {"curl":"curl https://api.example.com -H \\"X-A: 1\\""} -> {"code":"const res = await fetch(...)","notes":"..."}.',
  { curl: z.string(), style: z.enum(["async", "promise"]).optional().default("async") },
  run(({ curl, style }) => ({ style, ...curlToFetch(need(curl, "curl"), style) })));

/* ---------- 17. http_status ---------- */
server.tool("http_status",
  "Look up an HTTP status code: name, meaning, typical scenario and category. Omit code to list all 52 known codes. " +
  'Example in: {"code":404} -> {"code":404,"name":"Not Found","meaning":"...","scenario":"...","category":"4xx"}.',
  { code: z.union([z.string(), z.number()]).optional() },
  run(({ code }) => ({ result: httpStatusLookup(code === undefined ? null : code) })));

/* ---------- 18. json_to_csv ---------- */
server.tool("json_to_csv",
  "Convert a JSON object or array of objects to CSV text. " +
  'Example in: {"json":[{"a":1,"b":2}]} -> {"csv":"a,b\\n1,2","rows":1,"columns":["a","b"]}.',
  { json: z.any() },
  run(({ json }) => jsonToCsv(need(json, "json"))));

/* ---------- 19. json_to_sql ---------- */
server.tool("json_to_sql",
  "Convert JSON to SQL INSERT statements (mysql, pg or sqlite dialect), optionally with CREATE TABLE. " +
  'Example in: {"json":[{"a":1}],"table":"users","dialect":"pg","create":true} -> {"sql":"...","rows":1,...}.',
  {
    json: z.any(), table: z.string().optional(),
    dialect: z.enum(["mysql", "pg", "sqlite"]).optional(),
    create: z.boolean().optional(), mode: z.enum(["single", "bulk"]).optional(),
  },
  run(({ json, table, dialect, create, mode }) =>
    jsonToSql(need(json, "json"), { table, dialect, create, mode })));

/* ---------- 20. json_to_typescript ---------- */
server.tool("json_to_typescript",
  "Generate TypeScript interfaces from a JSON sample. style=export (default), plain or type; root names the top interface. " +
  'Example in: {"json":{"a":1}} -> {"typescript":"export interface Root {\\n  a: number;\\n}"}.',
  { json: z.any(), root: z.string().optional().default("Root"), style: z.enum(["export", "plain", "type"]).optional().default("export") },
  run(({ json, root, style }) => jsonToTs(need(json, "json"), root, style)));

/* ---------- 21. svg_to_data_uri ---------- */
server.tool("svg_to_data_uri",
  "Convert SVG markup to a CSS-ready data URI (optimized encoding, smaller than naive encodeURIComponent). " +
  'Example in: {"svg":"<svg xmlns=...></svg>"} -> {"dataUri":"data:image/svg+xml,..."}.',
  { svg: z.string() },
  run(({ svg }) => svgToDataUri(need(svg, "svg"))));

/* ---------- 22. xml_to_json ---------- */
server.tool("xml_to_json",
  "Convert XML markup to JSON. attrs=true keeps attributes; coerce=true converts numeric/boolean strings to native types. " +
  'Example in: {"xml":"<a><b>1</b></a>"} -> {"json":{"a":{"b":"1"}}}.',
  { xml: z.string(), attrs: z.boolean().optional().default(true), coerce: z.boolean().optional().default(false) },
  run(({ xml, attrs, coerce }) => xmlToJson(need(xml, "xml"), { attrs, coerce })));

/* ---------- 23. yaml_convert ---------- */
server.tool("yaml_convert",
  "Convert between YAML and JSON. Provide EITHER yaml text (-> JSON) or json (object/array -> YAML text). " +
  'Example in: {"yaml":"a: 1"} -> {"json":{"a":1}}. Example in: {"json":{"a":1}} -> {"yaml":"a: 1\\n"}.',
  { yaml: z.string().optional(), json: z.any().optional() },
  run(({ yaml, json }) => {
    if (typeof yaml === "string") return yamlToJson(yaml);
    if (json !== undefined) return jsonToYaml(json);
    throw new Error('provide "yaml" text or "json" (e.g. {"yaml":"a: 1"})');
  }));

/* ---------- 24. fetch_markdown ---------- */
server.tool("fetch_markdown",
  "Fetch a webpage and convert it to clean markdown (title, headings, paragraphs, links, lists, code blocks, simplified tables). " +
  "Best for static pages, docs, blogs and news articles. Honest limits: sites with strong bot protection " +
  "(Cloudflare challenge, login walls), JS-rendered SPAs, or very slow servers may fail or time out after 10s; " +
  "private/localhost/metadata IPs are blocked (SSRF protection). " +
  'Example in: {"url":"https://example.com/article"} -> {"title":"...","markdown":"...","chars":1234,"truncated":false}.',
  { url: z.string(), max_chars: z.number().int().optional().default(20000) },
  run(({ url, max_chars }) => fetchMarkdown(need(url, "url"), { maxChars: max_chars })));

/* ================= start ================= */
const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[tinykit-mcp] ready — 24 tools, auth mode: ${AUTH_MODE}`);
