import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 8080;
const HOST = "0.0.0.0";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".xml": "application/xml"
};

const server = http.createServer((req, res) => {
  // Cloud Run Health Check
  if (req.url === "/health" || req.url === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
    return;
  }

  // Parse path without query string
  let reqPath = "/";
  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    reqPath = decodeURIComponent(parsedUrl.pathname);
  } catch (_e) {
    reqPath = req.url.split("?")[0];
  }

  // Security: prevent path traversal
  const safePath = path.normalize(reqPath).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(__dirname, safePath);

  // Default to index.html for root or directories
  if (reqPath === "/" || reqPath === "") {
    filePath = path.join(__dirname, "index.html");
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // If direct file not found, fall back to index.html (SPA routing support)
      filePath = path.join(__dirname, "index.html");
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    const headers = {
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*"
    };

    // Cache static assets (CSS, JS, images), but keep HTML fresh
    if (ext === ".html") {
      headers["Cache-Control"] = "no-cache, must-revalidate";
    } else {
      headers["Cache-Control"] = "public, max-age=3600";
    }

    const stream = fs.createReadStream(filePath);
    stream.on("open", () => {
      res.writeHead(200, headers);
      stream.pipe(res);
    });

    stream.on("error", (streamErr) => {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Server Error: " + streamErr.message);
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`SnowDay Class web server running on http://${HOST}:${PORT}`);
});
