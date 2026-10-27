// The same bounded HTTP/1.1 server serves source tests and the Pages artifact.
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const publicFiles = new Set([
  ...require("./public-files.cjs"),
  "build-manifest.json",
]);
const mime = {
  ".svg": "image/svg+xml",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
};
function createStaticServer({ root, prefix }) {
  return http.createServer(async (req, res) => {
    try {
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405, { Allow: "GET, HEAD" });
        res.end("Method not allowed");
        return;
      }
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (!pathname.startsWith(prefix)) throw new Error("Invalid prefix");
      const relative = pathname.slice(prefix.length) || "index.html";
      if (!publicFiles.has(relative)) throw new Error("Not a public file");
      const file = path.resolve(root, relative);
      if (!file.startsWith(root + path.sep)) throw new Error("Invalid path");
      const bytes = await fs.readFile(file);
      res.writeHead(200, {
        "Content-Type": mime[path.extname(file)] || "application/octet-stream",
        "Content-Length": bytes.length,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : bytes);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
}
module.exports = { createStaticServer };
if (require.main === module) {
  const source = process.argv.includes("--source");
  const port = source ? 8000 : 8001;
  const prefix = source ? "/" : "/launchpad-career/";
  const root = path.resolve(__dirname, source ? ".." : "../_site");
  createStaticServer({ root, prefix }).listen(port, "127.0.0.1", () =>
    console.log(
      `Serving ${source ? "source" : "production artifact"} at ${prefix} on port ${port}.`,
    ),
  );
}
