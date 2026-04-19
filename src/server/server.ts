import { createServer, type IncomingMessage, type Server, type ServerResponse } from "http";
import { existsSync, readFileSync, statSync } from "fs";
import { fileURLToPath } from "url";
import { globalDataFile } from "../storage";
import type { GraphData } from "../types";

// Resolves to <repo-root>/dist/web/index.html in both dev (bun run src/cli.ts)
// and installed (node_modules/@coiggahou2002/dagdo/...) layouts — src/server/
// is always two levels above the dist/web sibling.
const UI_HTML_PATH = fileURLToPath(new URL("../../dist/web/index.html", import.meta.url));

export interface StartedServer {
  url: string;
  port: number;
  stop: () => Promise<void>;
}

export interface StartOptions {
  preferredPort: number;
}

export async function startServer(opts: StartOptions): Promise<StartedServer> {
  const clients = new Set<ServerResponse>();
  const server = createServer((req, res) => handleRequest(req, res, clients));

  const port = await listenWithRetry(server, opts.preferredPort);

  const stopWatch = startWatcher(() => {
    broadcastUpdate(clients);
  });

  return {
    port,
    url: `http://localhost:${port}`,
    stop: async () => {
      stopWatch();
      for (const c of clients) {
        try {
          c.end();
        } catch {
          // already closed
        }
      }
      clients.clear();
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}

function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  clients: Set<ServerResponse>,
): void {
  const url = req.url ?? "/";

  if (req.method === "GET" && (url === "/" || url === "/index.html")) {
    serveIndex(res);
    return;
  }

  if (req.method === "GET" && url === "/api/graph") {
    serveGraph(res);
    return;
  }

  if (req.method === "GET" && url === "/api/events") {
    attachSseClient(res, clients);
    return;
  }

  // Browsers request /favicon.ico automatically; respond empty so the
  // DevTools console doesn't light up on every page load.
  if (req.method === "GET" && url === "/favicon.ico") {
    res.statusCode = 204;
    res.end();
    return;
  }

  res.statusCode = 404;
  res.end("Not found");
}

function serveIndex(res: ServerResponse): void {
  if (!existsSync(UI_HTML_PATH)) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(
      "dagdo UI bundle not found.\n\n" +
        "If you installed from source, run:\n" +
        "  (cd web && bun install && bun run build)\n\n" +
        `Expected: ${UI_HTML_PATH}`,
    );
    return;
  }
  const html = readFileSync(UI_HTML_PATH);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(html);
}

function serveGraph(res: ServerResponse): void {
  const graph = readGraphSafely();
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(graph));
}

function attachSseClient(res: ServerResponse, clients: Set<ServerResponse>): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Connection", "keep-alive");
  // Flush headers so EventSource's onopen fires promptly.
  res.flushHeaders?.();

  clients.add(res);
  sendEvent(res, "update", readGraphSafely());

  // Heartbeat every 25s so idle proxies don't kill the connection. SSE
  // comments (`:` prefix) are ignored by the browser.
  const heartbeat = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 25_000);

  res.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
}

function broadcastUpdate(clients: Set<ServerResponse>): void {
  const graph = readGraphSafely();
  for (const c of clients) {
    sendEvent(c, "update", graph);
  }
}

function sendEvent(res: ServerResponse, event: string, data: unknown): void {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    // client gone; next poll will remove it via 'close'
  }
}

function readGraphSafely(): GraphData {
  const file = globalDataFile();
  if (!existsSync(file)) {
    return { version: 1, tasks: [], edges: [] };
  }
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as GraphData;
  } catch {
    return { version: 1, tasks: [], edges: [] };
  }
}

/**
 * Poll the data file's mtime every 500ms. Polling rather than fs.watch because
 * editors often save as delete+create which breaks persistent watches, and the
 * added latency is imperceptible for a todo list.
 */
function startWatcher(onChange: () => void): () => void {
  let last = currentMtime();
  const iv = setInterval(() => {
    const now = currentMtime();
    if (now !== last) {
      last = now;
      onChange();
    }
  }, 500);
  return () => clearInterval(iv);
}

function currentMtime(): number {
  const file = globalDataFile();
  if (!existsSync(file)) return 0;
  try {
    return statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

async function listenWithRetry(server: Server, startPort: number): Promise<number> {
  // Port 0 means "let the OS pick any free port" — no retry needed.
  if (startPort === 0) {
    await listenOn(server, 0);
    const addr = server.address();
    if (addr && typeof addr === "object") return addr.port;
    throw new Error("Failed to resolve bound port");
  }

  const MAX_ATTEMPTS = 20;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const port = startPort + i;
    try {
      await listenOn(server, port);
      return port;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EADDRINUSE") throw err;
      // try next port
    }
  }
  throw new Error(
    `Could not bind a port in range ${startPort}..${startPort + MAX_ATTEMPTS - 1}`,
  );
}

function listenOn(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (err: NodeJS.ErrnoException) => {
      server.off("listening", onListen);
      reject(err);
    };
    const onListen = () => {
      server.off("error", onError);
      resolve();
    };
    server.once("error", onError);
    server.once("listening", onListen);
    server.listen(port, "127.0.0.1");
  });
}
