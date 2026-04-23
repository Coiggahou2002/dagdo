import { createServer, type IncomingMessage, type Server, type ServerResponse } from "http";
import { existsSync, readFileSync, statSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { globalDataFile, loadGraph, saveGraph } from "../storage";
import {
  addEdge,
  addTask,
  findTask,
  removeEdge,
  removeTask,
  updateTask,
  type TaskPatch,
} from "../graph/mutations";
import type { GraphData, Priority } from "../types";

// Bundled (node dist/cli.js): import.meta.url → dist/cli.js, sibling is dist/web/
// Source  (bun run src/cli.ts): import.meta.url → src/server/server.ts, two levels up
const selfDir = dirname(fileURLToPath(import.meta.url));
const UI_HTML_PATH = [
  resolve(selfDir, "web", "index.html"),
  resolve(selfDir, "..", "..", "dist", "web", "index.html"),
].find(existsSync) ?? resolve(selfDir, "web", "index.html");

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
  const broadcast = () => broadcastUpdate(clients);

  const server = createServer((req, res) =>
    handleRequest(req, res, clients, broadcast).catch((err) => {
      sendJson(res, 500, { error: "internal", message: err instanceof Error ? err.message : String(err) });
    }),
  );

  const port = await listenWithRetry(server, opts.preferredPort);

  const stopWatch = startWatcher(broadcast);

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

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  clients: Set<ServerResponse>,
  broadcast: () => void,
): Promise<void> {
  const url = req.url ?? "/";
  const method = req.method ?? "GET";

  if (method === "GET" && (url === "/" || url === "/index.html")) {
    serveIndex(res);
    return;
  }

  if (method === "GET" && url === "/api/graph") {
    serveGraph(res);
    return;
  }

  if (method === "GET" && url === "/api/events") {
    attachSseClient(res, clients);
    return;
  }

  if (method === "POST" && url === "/api/tasks") {
    await handleCreateTask(req, res, broadcast);
    return;
  }

  if (method === "POST" && url === "/api/edges") {
    await handleCreateEdge(req, res, broadcast);
    return;
  }

  if (method === "DELETE" && url === "/api/edges") {
    await handleDeleteEdge(req, res, broadcast);
    return;
  }

  const taskIdMatch = /^\/api\/tasks\/([0-9a-f]{1,12})$/.exec(url);
  if (taskIdMatch) {
    const id = taskIdMatch[1]!;
    if (method === "PATCH") {
      await handleUpdateTask(req, res, broadcast, id);
      return;
    }
    if (method === "DELETE") {
      await handleDeleteTask(req, res, broadcast, id);
      return;
    }
  }

  if (method === "GET" && url === "/favicon.ico") {
    res.statusCode = 204;
    res.end();
    return;
  }

  res.statusCode = 404;
  res.end("Not found");
}

// ─── writes ───────────────────────────────────────────────────────────

async function handleCreateTask(
  req: IncomingMessage,
  res: ServerResponse,
  broadcast: () => void,
): Promise<void> {
  const body = await readJsonBody(req);
  if (!body || typeof body !== "object") return sendJson(res, 400, { error: "invalid_body" });

  const title = (body as Record<string, unknown>).title;
  if (typeof title !== "string" || title.trim().length === 0) {
    return sendJson(res, 400, { error: "invalid_title" });
  }

  const priority = (body as Record<string, unknown>).priority;
  const tags = (body as Record<string, unknown>).tags;
  const args = {
    title: title.trim(),
    priority: isPriority(priority) ? priority : undefined,
    tags: Array.isArray(tags) ? tags.filter((t): t is string => typeof t === "string") : undefined,
  };

  const graph = await loadGraph();
  const { data, task } = addTask(graph, args);
  await saveGraph(data, `add: ${task.title}`);
  broadcast();
  sendJson(res, 201, { task });
}

async function handleUpdateTask(
  req: IncomingMessage,
  res: ServerResponse,
  broadcast: () => void,
  id: string,
): Promise<void> {
  const body = await readJsonBody(req);
  if (!body || typeof body !== "object") return sendJson(res, 400, { error: "invalid_body" });

  const patch: TaskPatch = {};
  const b = body as Record<string, unknown>;
  if (typeof b.title === "string") patch.title = b.title;
  if (isPriority(b.priority)) patch.priority = b.priority;
  if (Array.isArray(b.tags)) patch.tags = b.tags.filter((t): t is string => typeof t === "string");
  if (b.doneAt === null || typeof b.doneAt === "string") patch.doneAt = b.doneAt;
  if (b.notes === null || typeof b.notes === "string") patch.notes = b.notes;

  if (Object.keys(patch).length === 0) return sendJson(res, 400, { error: "empty_patch" });

  const graph = await loadGraph();
  const result = updateTask(graph, id, patch);
  if (!result.ok) {
    if (result.error === "note_too_long") {
      return sendJson(res, 400, { error: result.error, limit: result.limit });
    }
    return sendJson(res, 404, { error: result.error });
  }

  await saveGraph(result.data, `edit: ${result.task.title}`);
  broadcast();
  sendJson(res, 200, { task: result.task });
}

async function handleDeleteTask(
  _req: IncomingMessage,
  res: ServerResponse,
  broadcast: () => void,
  id: string,
): Promise<void> {
  const graph = await loadGraph();
  const result = removeTask(graph, id);
  if (!result.ok) return sendJson(res, 404, { error: result.error });

  await saveGraph(result.data, `rm: ${result.removedTask.title}`);
  broadcast();
  res.statusCode = 204;
  res.end();
}

async function handleCreateEdge(
  req: IncomingMessage,
  res: ServerResponse,
  broadcast: () => void,
): Promise<void> {
  const body = await readJsonBody(req);
  if (!body || typeof body !== "object") return sendJson(res, 400, { error: "invalid_body" });
  const b = body as Record<string, unknown>;
  if (typeof b.from !== "string" || typeof b.to !== "string") {
    return sendJson(res, 400, { error: "invalid_edge" });
  }

  const graph = await loadGraph();
  const result = addEdge(graph, { from: b.from, to: b.to });
  if (!result.ok) {
    if (result.error === "task_not_found") {
      return sendJson(res, 404, { error: "task_not_found", id: result.id });
    }
    if (result.error === "cycle") {
      return sendJson(res, 409, { error: "cycle", path: result.path });
    }
    return sendJson(res, 409, { error: result.error });
  }

  const fromTitle = findTask(result.data, b.from)?.title ?? b.from;
  const toTitle = findTask(result.data, b.to)?.title ?? b.to;
  await saveGraph(result.data, `link: ${fromTitle} -> ${toTitle}`);
  broadcast();
  sendJson(res, 201, { ok: true });
}

async function handleDeleteEdge(
  req: IncomingMessage,
  res: ServerResponse,
  broadcast: () => void,
): Promise<void> {
  const body = await readJsonBody(req);
  if (!body || typeof body !== "object") return sendJson(res, 400, { error: "invalid_body" });
  const b = body as Record<string, unknown>;
  if (typeof b.from !== "string" || typeof b.to !== "string") {
    return sendJson(res, 400, { error: "invalid_edge" });
  }

  const graph = await loadGraph();
  const fromTitle = findTask(graph, b.from)?.title ?? b.from;
  const toTitle = findTask(graph, b.to)?.title ?? b.to;
  const result = removeEdge(graph, { from: b.from, to: b.to });
  if (!result.ok) return sendJson(res, 404, { error: result.error });

  await saveGraph(result.data, `unlink: ${fromTitle} x ${toTitle}`);
  broadcast();
  res.statusCode = 204;
  res.end();
}

function isPriority(value: unknown): value is Priority {
  return value === "low" || value === "med" || value === "high";
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf-8");
  if (raw.length === 0) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

// ─── reads & streaming ───────────────────────────────────────────────

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
  sendJson(res, 200, graph);
}

function attachSseClient(res: ServerResponse, clients: Set<ServerResponse>): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  clients.add(res);
  sendEvent(res, "update", readGraphSafely());

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
