# TinyKit MCP Server

<!-- badges: replace with real repo URL after publishing
[![npm version](https://img.shields.io/npm/v/@xiaojiang19960811/mcp-server)](https://www.npmjs.com/package/@xiaojiang19960811/mcp-server)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
-->

**24 deterministic developer utilities** for AI agents, exposed as [Model Context Protocol](https://modelcontextprotocol.io/) tools. Everything runs locally in the MCP server process — except `fetch_markdown`, which fetches the target URL (10s timeout, 2 MB cap, SSRF-guarded). Results are byte-exact every time: use these tools instead of approximating computations with the language model.

Same engine as the [TinyKit API](https://tinykit.pages.dev/api/) (free tier: 1000 requests/day/IP).

## Install

### Claude Code

```bash
claude mcp add tinykit -- node /path/to/tinykit-mcp/server.js
```

Or add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "tinykit": {
      "command": "node",
      "args": ["/path/to/tinykit-mcp/server.js"]
    }
  }
}
```

### Cursor

`~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "tinykit": {
      "command": "node",
      "args": ["/path/to/tinykit-mcp/server.js"]
    }
  }
}
```

### Windsurf

`~/.codeium/windsurf/mcp_config.json` — same JSON shape as Cursor.

Requires Node.js 18+. Zero runtime dependencies for the tools themselves; run `npm install` once for the MCP SDK.

## Tools (24)

| # | Tool | What it does |
|---|------|--------------|
| 1 | `base64` | Base64 encode/decode (UTF-8) |
| 2 | `binary` | Text ↔ binary (8-bit groups) |
| 3 | `hash` | md5 / sha1 / sha256 / sha512 |
| 4 | `url_codec` | URL percent-encode/decode |
| 5 | `html_entity` | HTML entity encode/decode |
| 6 | `morse` | Text ↔ Morse code |
| 7 | `uuid` | Generate 1–100 UUID v4 |
| 8 | `ulid` | Generate / decode ULIDs (sortable IDs) |
| 9 | `color_convert` | HEX ↔ RGB (+HSL, CSS snippet) |
| 10 | `rem_px_convert` | rem ↔ px (configurable base) |
| 11 | `timestamp` | now / ts→date / date→ts |
| 12 | `chmod` | octal ↔ symbolic permissions |
| 13 | `css_clamp` | Fluid `clamp()` generator |
| 14 | `css_specificity` | Selector specificity (a,b,c) + breakdown |
| 15 | `cron` | Describe cron / list next run times |
| 16 | `curl_to_fetch` | curl → `fetch()` (async or promise style) |
| 17 | `http_status` | Status code lookup (or list all 52) |
| 18 | `json_to_csv` | JSON → CSV |
| 19 | `json_to_sql` | JSON → INSERTs (mysql/pg/sqlite) |
| 20 | `json_to_typescript` | JSON → TypeScript interfaces |
| 21 | `svg_to_data_uri` | SVG → CSS data URI |
| 22 | `xml_to_json` | XML → JSON |
| 23 | `yaml_convert` | YAML ↔ JSON |
| 24 | `fetch_markdown` | Webpage → clean markdown (SSRF-guarded, 10s timeout) |

Every tool returns JSON text. Invalid input returns an MCP `isError` result with a message — the server never crashes on bad args.

### `fetch_markdown` notes

- Best for static pages, docs, blogs and news articles: extracts title, headings, paragraphs, links, lists, code blocks and simplified tables; drops nav/footer/ads/scripts.
- Honest limits: sites with strong bot protection (Cloudflare challenge, login walls), JS-rendered SPAs, or very slow servers may fail or time out. Private/localhost/metadata IPs are blocked.

## Auth (reserved)

Set `TINYKIT_API_KEY` to a Pro key (`tk_live_...`) to be ready for the future metered mode. Today the key is accepted but unused — all local tools run free.

## License

MIT
