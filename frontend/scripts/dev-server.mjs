import { createServer } from "node:http";
import { extname, join, relative, resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { build } from "vite";

const port = Number(process.env.PORT || 5174);
const host = "127.0.0.1";
const root = resolve("dist");
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

await build();

const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url || "/", `http://${host}:${port}`).pathname);
    const requested = pathname === "/" ? "index.html" : pathname.slice(1);
    const filePath = join(root, requested);
    const safeRelative = relative(root, filePath);
    if (safeRelative.startsWith("..")) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    const data = await readFile(filePath);
    res.writeHead(200, { "content-type": mimeTypes[extname(filePath)] || "application/octet-stream" });
    res.end(data);
  } catch {
    const data = await readFile(join(root, "index.html"));
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(data);
  }
});

server.listen(port, host, () => {
  console.log(`Frontend running at http://${host}:${port}`);
});
