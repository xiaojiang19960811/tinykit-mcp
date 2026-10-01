/**
 * TinyKit — fetch url -> markdown (zero dependencies).
 * Works in Node 18+ and Cloudflare Workers (global fetch / AbortSignal / TextDecoder).
 */
import { decodeEntities } from "./parsers.js";

const FM_FETCH_TIMEOUT_MS = 10000;
const FM_MAX_BYTES = 2 * 1024 * 1024; // 2 MB download cap
const FM_DEFAULT_MAX_CHARS = 20000;
const FM_MAX_CHARS_LIMIT = 100000;

function fmIsPrivateIPv4(h) {
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = +m[1], b = +m[2];
  return a === 0 || a === 10 || a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254);
}
function fmIsPrivateIPv6(h) {
  const lh = h.toLowerCase();
  return lh === "::1" || lh === "::" ||
    /^(fc|fd)/.test(lh) || /^fe[89ab]/i.test(lh);
}
/* SSRF guard: blocks literal private IPs + obvious local/metadata hostnames.
 * Note: does NOT resolve DNS, so DNS-rebinding hostnames are not caught. */
export function fmAssertPublicUrl(raw) {
  let u;
  try { u = new URL(String(raw).trim()); }
  catch { throw new Error("invalid URL"); }
  if (u.protocol !== "http:" && u.protocol !== "https:")
    throw new Error("only http:// and https:// URLs are allowed");
  const host = u.hostname.toLowerCase();
  const bare = host.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") ||
      host.endsWith(".local") || host.endsWith(".internal") ||
      host === "metadata.google.internal" || host === "instance-data" ||
      host === "instance-data-compute" ||
      fmIsPrivateIPv4(bare) || fmIsPrivateIPv6(bare))
    throw new Error("private/local/metadata addresses are not allowed");
  return u;
}

function fmResolveUrl(href, base) {
  try { return new URL(href, base).href; }
  catch { return href; }
}
const stripTags = (s) => String(s).replace(/<[^>]*>/g, "");
const cleanText = (s) => decodeEntities(stripTags(s)).replace(/\s+/g, " ").trim();

/* Lightweight HTML -> markdown. Order of operations matters. */
export function fmHtmlToMarkdown(html, baseUrl) {
  let h = String(html);

  // 1. title
  let title = "";
  const tm = h.match(/<title[^>]*>([\s\S]*?)<\/title\s*>/i);
  if (tm) title = cleanText(tm[1]);

  // 2. prefer <article> / <main> subtrees when present (matched open+close tags);
  //    for div-based layouts, drop everything BEFORE the main container
  //    (header/nav boilerplate lives there) and keep the rest.
  const art = h.match(/<(article|main)[\s>][\s\S]*?<\/\1\s*>/i);
  if (art) {
    h = art[0];
  } else {
    const divMain = h.match(/<div[^>]*\b(?:role\s*=\s*["']main["']|id\s*=\s*["'](?:content|main-content|bodyContent|main|article|readme)["'])[^>]*>/i);
    if (divMain) h = h.slice(divMain.index);
  }

  // 3. drop boilerplate / non-content with their contents
  h = h
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s>][\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style[\s>][\s\S]*?<\/style\s*>/gi, "")
    .replace(/<noscript[\s>][\s\S]*?<\/noscript\s*>/gi, "")
    .replace(/<nav[\s>][\s\S]*?<\/nav\s*>/gi, "")
    .replace(/<footer[\s>][\s\S]*?<\/footer\s*>/gi, "")
    .replace(/<aside[\s>][\s\S]*?<\/aside\s*>/gi, "")
    .replace(/<svg[\s>][\s\S]*?<\/svg\s*>/gi, "")
    .replace(/<canvas[\s>][\s\S]*?<\/canvas\s*>/gi, "")
    .replace(/<iframe[\s>][\s\S]*?<\/iframe\s*>/gi, "")
    .replace(/<form[\s>][\s\S]*?<\/form\s*>/gi, "");

  // 4. code blocks first (protect contents from inline transforms)
  const codeBlocks = [];
  h = h.replace(/<pre[\s>][\s\S]*?<\/pre\s*>/gi, (m) => {
    const code = decodeEntities(stripTags(m)).replace(/^\n+|\s+$/g, "");
    codeBlocks.push(code);
    return `%%TINYKIT_CODEBLOCK_${codeBlocks.length - 1}%%`;
  });

  // 5. tables -> simplified pipe tables
  h = h.replace(/<table[\s>][\s\S]*?<\/table\s*>/gi, (tbl) => {
    const rows = [];
    tbl.replace(/<tr[\s>]([\s\S]*?)<\/tr\s*>/gi, (_, rowHtml) => {
      const cells = [];
      rowHtml.replace(/<(td|th)[\s>]([\s\S]*?)<\/\1\s*>/gi, (_, __, cell) => {
        cells.push(cleanText(cell));
      });
      if (cells.length) rows.push(cells);
    });
    if (!rows.length) return "\n\n";
    const ncols = Math.max(...rows.map((r) => r.length));
    const lines = rows.map((r) => {
      while (r.length < ncols) r.push("");
      return "| " + r.join(" | ") + " |";
    });
    lines.splice(1, 0, "| " + Array(ncols).fill("---").join(" | ") + " |");
    return "\n\n" + lines.join("\n") + "\n\n";
  });

  // 6. headings / blocks
  h = h
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1\s*>/gi,
      (_, lv, inner) => `\n\n${"#".repeat(+lv)} ${cleanText(inner)}\n\n`)
    .replace(/<blockquote[\s>][\s\S]*?<\/blockquote\s*>/gi, (m) => {
      const t = cleanText(m);
      return t ? "\n\n> " + t + "\n\n" : "\n\n";
    })
    .replace(/<hr[^>]*>/gi, "\n\n---\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(ul|ol)[^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/li\s*>/gi, "")
    .replace(/<\/?(p|div|section|header)[^>]*>/gi, "\n\n");

  // 7. inline: links, images, code, emphasis
  h = h.replace(/<a\b[^>]*href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a\s*>/gi,
    (_, __, d1, d2, d3, text) => {
      const href = d1 || d2 || d3 || "";
      const t = cleanText(text);
      if (!t) return "";
      return `[${t}](${fmResolveUrl(href, baseUrl)})`;
    });
  h = h.replace(/<img\b[^>]*>/gi, (m) => {
    const am = m.match(/\balt\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const sm = m.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const alt = am ? (am[2] || am[3] || am[4] || "") : "";
    const src = sm ? (sm[2] || sm[3] || sm[4] || "") : "";
    const a = decodeEntities(alt).replace(/\s+/g, " ").trim();
    if (!a && !src) return "";
    return src ? `![${a}](${fmResolveUrl(src, baseUrl)})` : `![${a}]`;
  });
  h = h.replace(/<(code|kbd)[^>]*>([\s\S]*?)<\/\1\s*>/gi,
    (_, __, inner) => "`" + decodeEntities(stripTags(inner)).trim() + "`");
  h = h.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1\s*>/gi,
    (_, __, inner) => "**" + cleanText(inner) + "**");
  h = h.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1\s*>/gi,
    (_, __, inner) => "*" + cleanText(inner) + "*");

  // 8. restore code blocks
  h = h.replace(/%%TINYKIT_CODEBLOCK_(\d+)%%/g,
    (_, i) => "\n\n```\n" + (codeBlocks[+i] || "") + "\n```\n\n");

  // 9. strip leftovers, decode, collapse whitespace
  h = decodeEntities(stripTags(h));
  h = h.replace(/[ \t ]+/g, " ");
  h = h.replace(/\n[ \t]+/g, "\n");
  h = h.replace(/^[ \t]*-[ \t]*$/gm, ""); // drop empty list items
  h = h.replace(/\n{3,}/g, "\n\n").trim();

  return { title, markdown: h };
}

export async function fetchMarkdown(rawUrl, opts = {}) {
  const u = fmAssertPublicUrl(rawUrl);
  const maxChars = Math.min(
    FM_MAX_CHARS_LIMIT,
    Math.max(1000, parseInt(opts.maxChars ?? FM_DEFAULT_MAX_CHARS, 10) || FM_DEFAULT_MAX_CHARS)
  );

  let res;
  try {
    res = await fetch(u.href, {
      signal: AbortSignal.timeout(FM_FETCH_TIMEOUT_MS),
      redirect: "follow",
      headers: {
        "user-agent": "TinyKitBot/1.0 (+https://tinykit.pages.dev) webpage-to-markdown",
        "accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
        "accept-language": "en-US,en;q=0.9",
      },
    });
  } catch (e) {
    throw new Error(`fetch failed: ${e.name === "TimeoutError" ? "timed out after 10s" : e.message}`);
  }
  if (!res.ok) throw new Error(`fetch failed: HTTP ${res.status}`);
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (ct && !ct.includes("html") && !ct.includes("text"))
    throw new Error(`unsupported content-type "${ct.split(";")[0]}" (HTML pages only)`);

  // stream with a 2 MB cap
  const reader = res.body.getReader();
  const chunks = [];
  let bytes = 0, capped = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > FM_MAX_BYTES) { capped = true; try { reader.cancel(); } catch (_) { /* noop */ } break; }
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.byteLength, 0);
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.byteLength; }
  const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);

  const { title, markdown } = fmHtmlToMarkdown(html, res.url);
  if (!markdown) throw new Error("no readable content extracted (page may be JS-rendered or bot-protected)");

  let md = markdown, truncated = capped;
  if (md.length > maxChars) { md = md.slice(0, maxChars); truncated = true; }

  return {
    url: res.url,
    title: title || null,
    markdown: md + (truncated ? `\n\n…[truncated at ${md.length} chars]` : ""),
    chars: md.length,
    truncated,
  };
}
