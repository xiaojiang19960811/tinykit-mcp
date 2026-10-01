/** HTTP status codes — ported from http-status-code-lookup.html (52 entries). */
export const HTTP_STATUS = [
 {
  "code": 100,
  "name": "Continue",
  "meaning": "The server received the request headers and the client should send the body.",
  "scenario": "Large uploads: client sends \"Expect: 100-continue\", waits for 100 before streaming the body.",
  "category": "1xx"
 },
 {
  "code": 101,
  "name": "Switching Protocols",
  "meaning": "The server agrees to switch to the protocol the client asked for.",
  "scenario": "WebSocket handshake: HTTP upgrades to the ws protocol.",
  "category": "1xx"
 },
 {
  "code": 103,
  "name": "Early Hints",
  "meaning": "Preliminary headers sent before the final response, so the client can preload assets.",
  "scenario": "Server pushes Link headers early so the browser starts fetching CSS/JS sooner.",
  "category": "1xx"
 },
 {
  "code": 200,
  "name": "OK",
  "meaning": "The standard success response. The request worked and the response body has the result.",
  "scenario": "Every successful GET/POST in normal browsing and APIs.",
  "category": "2xx"
 },
 {
  "code": 201,
  "name": "Created",
  "meaning": "The request succeeded and a new resource was created.",
  "scenario": "POST /users returns 201 with a Location header pointing at the new user.",
  "category": "2xx"
 },
 {
  "code": 202,
  "name": "Accepted",
  "meaning": "The request was accepted for processing, but it is not done yet.",
  "scenario": "Async jobs: \"we took your video, transcoding started\" — poll or webhook for the result.",
  "category": "2xx"
 },
 {
  "code": 203,
  "name": "Non-Authoritative Information",
  "meaning": "Success, but the response was transformed by a proxy.",
  "scenario": "Caching proxies that modify headers before returning a stored response.",
  "category": "2xx"
 },
 {
  "code": 204,
  "name": "No Content",
  "meaning": "Success, but there is intentionally no response body.",
  "scenario": "DELETE endpoints and \"save\" actions that return nothing to render.",
  "category": "2xx"
 },
 {
  "code": 205,
  "name": "Reset Content",
  "meaning": "Success — the client should reset the document view (e.g. clear a form).",
  "scenario": "Form submissions where the UI should be cleared after saving.",
  "category": "2xx"
 },
 {
  "code": 206,
  "name": "Partial Content",
  "meaning": "The server is returning only part of the resource, as requested by a Range header.",
  "scenario": "Video/audio streaming and resumable downloads.",
  "category": "2xx"
 },
 {
  "code": 207,
  "name": "Multi-Status",
  "meaning": "Multiple independent operations each have their own status, listed in the body.",
  "scenario": "WebDAV batch operations (PROPFIND) reporting per-file results.",
  "category": "2xx"
 },
 {
  "code": 226,
  "name": "IM Used",
  "meaning": "The server applied an instance manipulation (delta encoding) to the response.",
  "scenario": "Delta updates where only the diff is sent instead of the full resource.",
  "category": "2xx"
 },
 {
  "code": 300,
  "name": "Multiple Choices",
  "meaning": "The request has more than one possible response; the client should choose.",
  "scenario": "Rarely used; content negotiation usually resolves this server-side.",
  "category": "3xx"
 },
 {
  "code": 301,
  "name": "Moved Permanently",
  "meaning": "The resource has a new permanent URL. Update bookmarks and links.",
  "scenario": "Site migrations, http→https, www→non-www. Search engines transfer ranking to the new URL.",
  "category": "3xx"
 },
 {
  "code": 302,
  "name": "Found",
  "meaning": "Temporary redirect — the resource lives at another URL for now.",
  "scenario": "Login flows (\"go to /login, then come back\"). Browsers historically change POST to GET here.",
  "category": "3xx"
 },
 {
  "code": 303,
  "name": "See Other",
  "meaning": "Redirect to another URL, always fetched with GET.",
  "scenario": "Post/Redirect/Get pattern: after a form POST, redirect to a results page to avoid resubmission.",
  "category": "3xx"
 },
 {
  "code": 304,
  "name": "Not Modified",
  "meaning": "The cached version is still fresh — no need to download it again.",
  "scenario": "Conditional requests with If-Modified-Since / If-None-Match. Saves bandwidth, not an error.",
  "category": "3xx"
 },
 {
  "code": 307,
  "name": "Temporary Redirect",
  "meaning": "Like 302, but the client must reuse the same method and body.",
  "scenario": "Temporary maintenance redirects where a POST must stay a POST.",
  "category": "3xx"
 },
 {
  "code": 308,
  "name": "Permanent Redirect",
  "meaning": "Like 301, but the client must reuse the same method and body.",
  "scenario": "Permanent API endpoint moves where POSTs must not silently become GETs.",
  "category": "3xx"
 },
 {
  "code": 400,
  "name": "Bad Request",
  "meaning": "The server cannot understand the request — malformed syntax or invalid parameters.",
  "scenario": "Broken JSON bodies, missing required fields, invalid query strings.",
  "category": "4xx"
 },
 {
  "code": 401,
  "name": "Unauthorized",
  "meaning": "Authentication is required or has failed. Despite the name, it is about authentication, not authorization.",
  "scenario": "Missing/expired tokens, wrong passwords. Logging in (again) may fix it.",
  "category": "4xx"
 },
 {
  "code": 402,
  "name": "Payment Required",
  "meaning": "Reserved for future use — originally meant for digital payments.",
  "scenario": "Essentially unused; some APIs repurpose it for \"quota exceeded, upgrade plan\".",
  "category": "4xx"
 },
 {
  "code": 403,
  "name": "Forbidden",
  "meaning": "The server knows who you are and refuses. Authentication will not help.",
  "scenario": "Normal user hitting an admin endpoint; IP blocks; directory listing denied.",
  "category": "4xx"
 },
 {
  "code": 404,
  "name": "Not Found",
  "meaning": "The server cannot find the requested resource.",
  "scenario": "Typos in URLs, deleted pages, wrong API paths. Check the URL first.",
  "category": "4xx"
 },
 {
  "code": 405,
  "name": "Method Not Allowed",
  "meaning": "The resource exists but does not support this HTTP method.",
  "scenario": "Sending POST to a read-only endpoint; the Allow header lists valid methods.",
  "category": "4xx"
 },
 {
  "code": 406,
  "name": "Not Acceptable",
  "meaning": "The server cannot produce a response matching the client's Accept headers.",
  "scenario": "Client asks for XML but the API only serves JSON.",
  "category": "4xx"
 },
 {
  "code": 408,
  "name": "Request Timeout",
  "meaning": "The server timed out waiting for the client to send the request.",
  "scenario": "Very slow connections or stalled uploads; retrying usually works.",
  "category": "4xx"
 },
 {
  "code": 409,
  "name": "Conflict",
  "meaning": "The request conflicts with the current state of the resource.",
  "scenario": "Creating a user that already exists; edit collisions with stale version numbers.",
  "category": "4xx"
 },
 {
  "code": 410,
  "name": "Gone",
  "meaning": "The resource is permanently gone, with no forwarding address.",
  "scenario": "Deliberately removed content. Stronger than 404 — tells search engines to deindex.",
  "category": "4xx"
 },
 {
  "code": 411,
  "name": "Length Required",
  "meaning": "The server requires a Content-Length header and the request lacked one.",
  "scenario": "Chunked uploads to strict servers.",
  "category": "4xx"
 },
 {
  "code": 412,
  "name": "Precondition Failed",
  "meaning": "A precondition in the request headers (If-Match, If-Unmodified-Since) evaluated to false.",
  "scenario": "Optimistic locking: \"only update if the version is still 7\".",
  "category": "4xx"
 },
 {
  "code": 413,
  "name": "Content Too Large",
  "meaning": "The request body is larger than the server accepts.",
  "scenario": "Uploads exceeding the server's limit — compress the file or raise the limit.",
  "category": "4xx"
 },
 {
  "code": 414,
  "name": "URI Too Long",
  "meaning": "The URL is longer than the server is willing to process.",
  "scenario": "GET requests stuffing huge filter lists into query params — switch to POST.",
  "category": "4xx"
 },
 {
  "code": 415,
  "name": "Unsupported Media Type",
  "meaning": "The request's media type (Content-Type) is not supported.",
  "scenario": "Posting XML to a JSON-only API; uploading an unaccepted file type.",
  "category": "4xx"
 },
 {
  "code": 416,
  "name": "Range Not Satisfiable",
  "meaning": "The requested byte range cannot be served — it is outside the resource size.",
  "scenario": "Resuming a download that already finished.",
  "category": "4xx"
 },
 {
  "code": 418,
  "name": "I'm a teapot",
  "meaning": "An April Fools' joke (RFC 2324) that stuck around: the server refuses to brew coffee.",
  "scenario": "Easter egg in some frameworks; occasionally used to block bots with humor.",
  "category": "4xx"
 },
 {
  "code": 421,
  "name": "Misdirected Request",
  "meaning": "The request was sent to a server that cannot produce a response for it.",
  "scenario": "HTTP/2 connection reuse across origins; misconfigured SNI routing.",
  "category": "4xx"
 },
 {
  "code": 422,
  "name": "Unprocessable Content",
  "meaning": "The request was well-formed but semantically invalid.",
  "scenario": "Validation errors: \"email is required\", \"date must be in the future\". (WebDAV origin, now widely used.)",
  "category": "4xx"
 },
 {
  "code": 423,
  "name": "Locked",
  "meaning": "The resource is locked and cannot be modified.",
  "scenario": "WebDAV file locks during collaborative editing.",
  "category": "4xx"
 },
 {
  "code": 425,
  "name": "Too Early",
  "meaning": "The server refuses to process a request that might be replayed (early data).",
  "scenario": "TLS 1.3 early-data (0-RTT) requests on non-idempotent endpoints.",
  "category": "4xx"
 },
 {
  "code": 428,
  "name": "Precondition Required",
  "meaning": "The server requires conditional requests to avoid lost updates.",
  "scenario": "APIs enforcing If-Match on all writes.",
  "category": "4xx"
 },
 {
  "code": 429,
  "name": "Too Many Requests",
  "meaning": "Rate limit exceeded — you are sending requests too fast.",
  "scenario": "Scrapers and polling loops. Back off and honor the Retry-After header.",
  "category": "4xx"
 },
 {
  "code": 431,
  "name": "Request Header Fields Too Large",
  "meaning": "The headers (often cookies) are too big.",
  "scenario": "Cookie bloat — clear cookies or shrink what you store in them.",
  "category": "4xx"
 },
 {
  "code": 451,
  "name": "Unavailable For Legal Reasons",
  "meaning": "The resource is blocked for legal reasons (censorship, takedown, GDPR).",
  "scenario": "Geo-blocked content; named after Fahrenheit 451.",
  "category": "4xx"
 },
 {
  "code": 500,
  "name": "Internal Server Error",
  "meaning": "A generic server failure — something broke and the server won't say what.",
  "scenario": "Unhandled exceptions, bad deploys. Check server logs; retrying rarely helps.",
  "category": "5xx"
 },
 {
  "code": 501,
  "name": "Not Implemented",
  "meaning": "The server does not support the functionality needed for the request.",
  "scenario": "Unknown HTTP methods or unimplemented API routes.",
  "category": "5xx"
 },
 {
  "code": 502,
  "name": "Bad Gateway",
  "meaning": "A proxy/gateway got an invalid response from the upstream server.",
  "scenario": "Nginx in front of a crashed app server; upstream timeouts.",
  "category": "5xx"
 },
 {
  "code": 503,
  "name": "Service Unavailable",
  "meaning": "The server is temporarily unable to handle the request — overloaded or down for maintenance.",
  "scenario": "Traffic spikes, deploys in progress. Retry-After may say when to come back.",
  "category": "5xx"
 },
 {
  "code": 504,
  "name": "Gateway Timeout",
  "meaning": "A proxy/gateway timed out waiting for the upstream server.",
  "scenario": "Slow database queries behind a reverse proxy; upstream hanging.",
  "category": "5xx"
 },
 {
  "code": 505,
  "name": "HTTP Version Not Supported",
  "meaning": "The server does not support the HTTP version used in the request.",
  "scenario": "Ancient clients speaking HTTP/1.0 to modern servers, or vice versa.",
  "category": "5xx"
 },
 {
  "code": 507,
  "name": "Insufficient Storage",
  "meaning": "The server cannot store what the request needs stored.",
  "scenario": "WebDAV quota exceeded; disk full on the server.",
  "category": "5xx"
 },
 {
  "code": 511,
  "name": "Network Authentication Required",
  "meaning": "You must authenticate to the network (captive portal) before proceeding.",
  "scenario": "Coffee-shop Wi-Fi login pages intercepting your first request.",
  "category": "5xx"
 }
];
