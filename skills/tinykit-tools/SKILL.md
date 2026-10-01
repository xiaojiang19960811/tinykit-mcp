---
name: tinykit-tools
description: "24 deterministic developer utilities as MCP tools: base64/binary/URL/HTML/Morse codecs, md5/sha1/sha256/sha512 hashing, UUID v4 and ULID generation, hex/RGB color conversion, rem/px conversion, Unix timestamp conversion, chmod calculator, CSS clamp() generator, CSS specificity scorer, cron parser/describer, cURL-to-fetch converter, HTTP status lookup, JSON to CSV/SQL/TypeScript converters, SVG to data URI, XML to JSON, YAML to JSON and back, webpage-to-markdown fetching. Use this skill whenever you need an exact, reproducible computation or conversion instead of approximating it with the language model."
---

# TinyKit Tools

TinyKit exposes **24 deterministic developer utilities** as MCP tools. Everything runs **locally in the MCP server process** — no API keys required, results are byte-exact every time. (Only `fetch_markdown` makes a network call, to the page you ask it to read.)

## When to use

Reach for these tools instead of doing the computation yourself when:

- the result must be **exact** (hashes, base64, timestamps, encodings — LLMs are unreliable at these);
- you need a **conversion** between formats (JSON↔YAML, XML→JSON, cURL→fetch, SVG→data URI);
- you need **generated identifiers** (UUID v4, ULID) or **random-free deterministic lookups** (HTTP status codes, chmod modes);
- you need to **explain or validate** developer artifacts (cron expressions, CSS specificity, CSS clamp()).

If a task is fuzzy, creative, or requires judgment, don't use these tools — they are calculators, not thinkers.

## Tool reference

| Tool | Purpose | Example input |
|---|---|---|
| `base64` | Encode/decode Base64 (UTF-8 safe) | `{"action":"encode","text":"hello"}` → `aGVsbG8=` |
| `binary` | Text ↔ binary (8-bit groups) | `{"action":"encode","text":"Hi"}` |
| `hash` | md5 / sha1 / sha256 / sha512 | `{"text":"hello","algo":"sha256"}` |
| `url_codec` | URL percent-encode/decode | `{"action":"encode","text":"a b&c"}` |
| `html_entity` | HTML entity encode/decode | `{"action":"encode","text":"<p>Hi</p>"}` |
| `morse` | Morse code encode/decode | `{"action":"encode","text":"SOS"}` |
| `uuid` | Generate 1–100 UUID v4 | `{"count":3}` |
| `ulid` | Generate ULIDs / decode a ULID's timestamp | `{"action":"generate","count":2}` |
| `color_convert` | HEX ↔ RGB | `{"action":"hex_to_rgb","value":"#ff8800"}` |
| `rem_px_convert` | rem ↔ px (default 16px base) | `{"action":"rem_to_px","value":2}` |
| `timestamp` | Unix timestamp ↔ human date; now | `{"action":"now"}` |
| `chmod` | Octal ↔ symbolic permissions, explained | `{"action":"describe","value":"755"}` |
| `css_clamp` | Generate responsive `clamp()` | `{"min":16,"max":24,"minVw":320,"maxVw":1200}` |
| `css_specificity` | Score a CSS selector `(a,b,c)` | `{"selector":"#nav .item a:hover"}` |
| `cron` | Parse/describe cron, next run times | `{"action":"describe","expr":"*/15 * * * *"}` |
| `curl_to_fetch` | Convert cURL command to `fetch()` | `{"curl":"curl -X POST https://api.example.com -H 'Content-Type: application/json'"}` |
| `http_status` | Look up an HTTP status code (or list all) | `{"code":404}` |
| `json_to_csv` | JSON array → CSV text | `{"json":[{"a":1},{"a":2}]}` |
| `json_to_sql` | JSON array → SQL INSERT statements | `{"json":[...],"table":"users"}` |
| `json_to_typescript` | JSON → TypeScript interfaces | `{"json":{"id":1,"name":"x"}}` |
| `svg_to_data_uri` | SVG markup → CSS-ready data URI | `{"svg":"<svg xmlns=...></svg>"}` |
| `xml_to_json` | XML → JSON (attributes optional) | `{"xml":"<a><b>1</b></a>"}` |
| `yaml_convert` | YAML ↔ JSON (provide one side) | `{"yaml":"a: 1"}` or `{"json":{"a":1}}` |
| `fetch_markdown` | Webpage → clean markdown (SSRF-guarded, 10s timeout) | `{"url":"https://example.com/article"}` |

## Usage examples

**1. Exact hashing (don't hand-compute):**
Call `hash` with `{"text":"deploy-2026-10-01","algo":"sha256"}` → use the returned digest verbatim as a cache key or checksum.

**2. Decoding an opaque value:**
Call `base64` with `{"action":"decode","text":"<token>"}` to inspect a JWT payload segment or encoded config before acting on it.

**3. Scheduling:**
Call `cron` with `{"action":"describe","expr":"0 9 * * 1"}` to confirm "every Monday at 09:00" before writing it into a workflow, and `{"action":"next_runs",...}` to show the user concrete upcoming dates.

**4. Code generation helpers:**
Call `json_to_typescript` on a sample API response to scaffold interfaces; call `curl_to_fetch` to turn a docs-page cURL example into code you can run.

**5. CSS work:**
Call `css_specificity` to explain *why* a rule isn't winning, or `css_clamp` to generate fluid type scale values.

## Notes

- All tools execute locally; **no data leaves the machine**. Safe for secrets and proprietary code snippets.
- Invalid input returns an `isError` result with a message — read it and retry with corrected parameters.
- An optional `TINYKIT_API_KEY` environment variable is reserved for a future metered mode; it is not required today.
- Same logic also powers the free REST API at `https://tinykit.pages.dev/api/` and the web tools at `https://tinykit.pages.dev`.
