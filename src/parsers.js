/**
 * TinyKit API — parsers module (zero dependencies).
 * YAML: faithful port of the mini YAML subset parser used by
 *   yaml-to-json-converter.html on tinykit.pages.dev.
 * XML: small recursive-descent parser (DOMParser is unavailable in Workers).
 */

/* ================= YAML ================= */

function YAMLError(line, msg) {
  this.message = "Line " + line + ": " + msg;
  this.yamlLine = line;
}
YAMLError.prototype = Object.create(Error.prototype);

function stripComment(raw) {
  let sq = false, dq = false;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === "'" && !dq) sq = !sq;
    else if (c === '"' && !sq) dq = !dq;
    else if (c === "#" && !sq && !dq && (i === 0 || /\s/.test(raw[i - 1]))) return raw.slice(0, i);
  }
  return raw;
}

function findMapColon(text) {
  let sq = false, dq = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "'" && !dq) sq = !sq;
    else if (c === '"' && !sq) dq = !dq;
    else if (c === ":" && !sq && !dq && (i + 1 === text.length || /[\s]/.test(text[i + 1]))) return i;
  }
  return -1;
}

function parseScalar(tok) {
  if (tok === "") return "";
  const f = tok.charAt(0), l = tok.charAt(tok.length - 1);
  if (tok.length >= 2 && ((f === '"' && l === '"') || (f === "'" && l === "'"))) {
    const inner = tok.slice(1, -1);
    if (f === '"') return inner.replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    return inner.replace(/''/g, "'");
  }
  const low = tok.toLowerCase();
  if (low === "null" || low === "~" || low === "nil") return null;
  if (low === "true" || low === "yes" || low === "on") return true;
  if (low === "false" || low === "no" || low === "off") return false;
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(tok)) return Number(tok);
  if (/^0x[0-9a-fA-F]+$/.test(tok)) return parseInt(tok, 16);
  return tok;
}

export function parseYAML(text) {
  const items = [];
  const rawLines = String(text).split(/\r?\n/);
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    if (/\t/.test(raw)) throw new YAMLError(i + 1, "Tabs are not allowed for indentation — use spaces");
    const stripped = stripComment(raw);
    if (!stripped.trim()) continue;
    const indent = stripped.match(/^ */)[0].length;
    items.push({ indent, text: stripped.trim(), line: i + 1 });
  }
  if (!items.length) return null;
  let pos = 0;

  const isListItem = (t) => t === "-" || t.indexOf("- ") === 0;

  function nestedValue(after, it) {
    if (after) return parseScalar(after);
    if (pos < items.length && items[pos].indent > it.indent) return parseBlock(items[pos].indent);
    return null;
  }

  function parseMapEntry(obj, it) {
    const colon = findMapColon(it.text);
    if (colon < 0) throw new YAMLError(it.line, 'Expected "key: value"');
    const key = String(parseScalar(it.text.slice(0, colon).trim()));
    const after = it.text.slice(colon + 1).trim();
    pos++;
    obj[key] = nestedValue(after, it);
  }

  function parseListMapItem(firstRest, it) {
    const obj = {};
    const colon = findMapColon(firstRest);
    if (colon < 0) throw new YAMLError(it.line, 'Expected "key: value" after "-"');
    const key = String(parseScalar(firstRest.slice(0, colon).trim()));
    const after = firstRest.slice(colon + 1).trim();
    obj[key] = nestedValue(after, { indent: it.indent, line: it.line });
    while (pos < items.length && items[pos].indent > it.indent) {
      const nxt = items[pos];
      if (isListItem(nxt.text)) throw new YAMLError(nxt.line, "Unexpected nested list item");
      parseMapEntry(obj, nxt);
    }
    return obj;
  }

  function parseBlock(indent) {
    if (pos >= items.length) return null;
    const first = items[pos];
    if (first.indent !== indent) throw new YAMLError(first.line, "Unexpected indentation");
    if (isListItem(first.text)) {
      const arr = [];
      while (pos < items.length && items[pos].indent === indent && isListItem(items[pos].text)) {
        const it = items[pos];
        const rest = it.text === "-" ? "" : it.text.slice(2).trim();
        pos++;
        if (!rest) {
          arr.push(pos < items.length && items[pos].indent > indent ? parseBlock(items[pos].indent) : null);
        } else if (findMapColon(rest) >= 0) {
          arr.push(parseListMapItem(rest, it));
        } else {
          arr.push(parseScalar(rest));
        }
      }
      return arr;
    }
    const obj = {};
    while (pos < items.length && items[pos].indent === indent && !isListItem(items[pos].text)) {
      parseMapEntry(obj, items[pos]);
    }
    return obj;
  }

  const result = parseBlock(items[0].indent);
  if (pos < items.length) throw new YAMLError(items[pos].line, "Unexpected content after document end");
  return result;
}

function yamlQuote(s) {
  if (s === "") return "''";
  if (/^[A-Za-z0-9_\-\.\/]+$/.test(s) &&
      !/^(true|false|yes|no|on|off|null|~|nil)$/i.test(s) &&
      !/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s) &&
      !/^0x[0-9a-fA-F]+$/.test(s)) return s;
  if (s.indexOf("'") < 0 && s.indexOf("\n") < 0) return "'" + s + "'";
  return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n") + '"';
}

export function toYAML(val, indent) {
  indent = indent || 0;
  const pad = new Array(indent + 1).join("  ");
  if (val === null || val === undefined) return "null";
  if (typeof val === "boolean" || typeof val === "number") return String(val);
  if (typeof val === "string") return yamlQuote(val);
  if (Array.isArray(val)) {
    if (!val.length) return "[]";
    return val.map((v) => {
      if (v !== null && typeof v === "object") {
        const inner = toYAML(v, indent + 1).split("\n");
        return pad + "- " + inner[0].replace(/^  /, "") + (inner.length > 1 ? "\n" + inner.slice(1).join("\n") : "");
      }
      return pad + "- " + toYAML(v, 0);
    }).join("\n");
  }
  const keys = Object.keys(val);
  if (!keys.length) return "{}";
  return keys.map((k) => {
    const v = val[k], ks = yamlQuote(k);
    if (v !== null && typeof v === "object") {
      if (Array.isArray(v) && !v.length) return pad + ks + ": []";
      if (!Array.isArray(v) && !Object.keys(v).length) return pad + ks + ": {}";
      return pad + ks + ":\n" + toYAML(v, indent + 1);
    }
    return pad + ks + ": " + toYAML(v, 0);
  }).join("\n");
}

/* ================= XML ================= */

// Minimal XML parser -> tree of { tag, attrs, children: (string|node)[] }.
// Throws Error("Invalid XML: ...") on malformed input.
export function parseXMLDoc(src) {
  const s = String(src);
  const n = s.length;
  let i = 0;
  const stack = [];
  let root = null;
  const err = (msg) => { throw new Error("Invalid XML: " + msg); };

  while (i < n) {
    if (s[i] === "<") {
      if (s.startsWith("<!--", i)) {
        const j = s.indexOf("-->", i + 4);
        if (j < 0) err("unclosed comment");
        i = j + 3; continue;
      }
      if (s.startsWith("<![CDATA[", i)) {
        const j = s.indexOf("]]>", i + 9);
        if (j < 0) err("unclosed CDATA section");
        if (stack.length) stack[stack.length - 1].children.push(s.slice(i + 9, j));
        i = j + 3; continue;
      }
      if (s.startsWith("<?", i)) {
        const j = s.indexOf("?>", i + 2);
        if (j < 0) err("unclosed processing instruction");
        i = j + 2; continue;
      }
      if (s.startsWith("<!", i)) { // DOCTYPE and other declarations — skip
        const j = s.indexOf(">", i + 2);
        if (j < 0) err("unclosed declaration");
        i = j + 1; continue;
      }
      if (s[i + 1] === "/") {
        const j = s.indexOf(">", i + 2);
        if (j < 0) err("unclosed closing tag");
        const tag = s.slice(i + 2, j).trim();
        const node = stack.pop();
        if (!node || node.tag !== tag) err("mismatched closing tag </" + tag + ">");
        if (stack.length) stack[stack.length - 1].children.push(node);
        else { if (root) err("multiple root elements"); root = node; }
        i = j + 1; continue;
      }
      const j = s.indexOf(">", i + 1);
      if (j < 0) err("unclosed opening tag");
      let inner = s.slice(i + 1, j);
      const selfClose = /\/\s*$/.test(inner);
      if (selfClose) inner = inner.replace(/\/\s*$/, "");
      const m = inner.match(/^\s*([^\s\/>]+)/);
      if (!m) err("malformed tag");
      const tag = m[1];
      const attrs = {};
      const rest = inner.slice(m[0].length);
      const attrRe = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let am;
      while ((am = attrRe.exec(rest))) attrs[am[1]] = am[2] ?? am[3] ?? am[4] ?? "";
      const node = { tag, attrs, children: [] };
      if (selfClose) {
        if (stack.length) stack[stack.length - 1].children.push(node);
        else { if (root) err("multiple root elements"); root = node; }
      } else {
        stack.push(node);
      }
      i = j + 1; continue;
    }
    const j = s.indexOf("<", i);
    const text = s.slice(i, j < 0 ? n : j);
    if (stack.length) {
      if (text) stack[stack.length - 1].children.push(text);
    } else if (text.trim()) {
      err("text outside the root element");
    }
    i = j < 0 ? n : j;
  }
  if (stack.length) err("unclosed tag <" + stack[stack.length - 1].tag + ">");
  if (!root) err("empty document");
  return root;
}

// Named HTML/XML entities for decoding text/attribute content
// (DOMParser/textContent is unavailable in Workers).
const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  nbsp: " ", copy: "©", reg: "®", trade: "™",
  hellip: "…", mdash: "—", ndash: "–",
  ldquo: "\u201C", rdquo: "\u201D", lsquo: "\u2018", rsquo: "\u2019",
  laquo: "«", raquo: "»", euro: "€", pound: "£", yen: "¥", cent: "¢",
  sect: "§", para: "¶", middot: "·", bull: "•", deg: "°",
  plusmn: "±", times: "×", divide: "÷", ne: "≠", le: "≤", ge: "≥",
  frasl: "⁄", oelig: "œ", OElig: "Œ", dagger: "†", Dagger: "‡",
  permil: "‰", lsaquo: "‹", rsaquo: "›", sbquo: "‚", bdquo: "„",
  Alpha: "Α", Beta: "Β", Gamma: "Γ", Delta: "Δ", Omega: "Ω",
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", omega: "ω", pi: "π",
};

export function decodeEntities(s) {
  return String(s).replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, e) => {
    if (e[0] === "#") {
      const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      if (!isNaN(cp) && cp >= 0 && cp <= 0x10ffff) {
        try { return String.fromCodePoint(cp); } catch { return m; }
      }
      return m;
    }
    return NAMED_ENTITIES[e] !== undefined ? NAMED_ENTITIES[e] : m;
  });
}

function coerceVal(str, coerce) {
  if (!coerce) return str;
  if (str === "true") return true;
  if (str === "false") return false;
  if (str !== "" && !isNaN(str)) return Number(str);
  return str;
}

// Convert an XML tree node to JSON, mirroring xml-to-json-converter.html:
// attributes -> "@name", mixed text -> "#text", repeated tags -> arrays.
export function xmlNodeToJson(node, opts) {
  const withAttrs = !!opts.attrs;
  const coerce = !!opts.coerce;
  function elToVal(el) {
    const obj = {};
    let hasKeys = false;
    if (withAttrs) {
      for (const k of Object.keys(el.attrs)) {
        obj["@" + k] = decodeEntities(el.attrs[k]);
        hasKeys = true;
      }
    }
    const kids = el.children.filter((c) => typeof c !== "string");
    if (kids.length === 0) {
      const t = decodeEntities(el.children.filter((c) => typeof c === "string").join("")).trim();
      if (!hasKeys) return t === "" ? null : coerceVal(t, coerce);
      if (t !== "") { obj["#text"] = coerceVal(t, coerce); hasKeys = true; }
      return hasKeys ? obj : null;
    }
    for (const ch of kids) {
      const v = elToVal(ch);
      if (Object.prototype.hasOwnProperty.call(obj, ch.tag)) {
        if (!Array.isArray(obj[ch.tag])) obj[ch.tag] = [obj[ch.tag]];
        obj[ch.tag].push(v);
      } else {
        obj[ch.tag] = v;
      }
      hasKeys = true;
    }
    return obj;
  }
  const out = {};
  out[node.tag] = elToVal(node);
  return out;
}
