/**
 * HTTP smoke — health + MCP initialize + tools/list.
 * Run: npm run smoke:http (starts ephemeral server on port 3921).
 */
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXPECTED_TOOL_NAMES } from "../src/refreshHelp.js";
import { getVersionInfo } from "../src/version.js";

const PKG_VERSION = getVersionInfo({ skip_fetch: true }).version;

const SMOKE_PORT = 3921;
const BASE = `http://127.0.0.1:${SMOKE_PORT}`;
const API_KEY = "smoke-test-key-do-not-commit";

const MCP_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
  Authorization: `Bearer ${API_KEY}`,
} as const;

async function readMcpJson(res: Response): Promise<unknown> {
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return res.json();
  }
  const text = await res.text();
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("data:")) {
      const payload = trimmed.slice(trimmed.indexOf(":") + 1).trim();
      if (payload) return JSON.parse(payload);
    }
  }
  throw new Error(`Cannot parse MCP response: ${text.slice(0, 120)}`);
}

let child: ChildProcess | undefined;

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(maxMs = 15000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await sleep(200);
  }
  throw new Error("HTTP server did not become healthy in time");
}

function startServer(): Promise<void> {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  return new Promise((resolve, reject) => {
    child = spawn(
      "npx",
      ["tsx", "src/httpServer.ts"],
      {
        cwd: root,
        env: {
          ...process.env,
          COMPASS_MCP_HOST: "127.0.0.1",
          COMPASS_MCP_PORT: String(SMOKE_PORT),
          COMPASS_MCP_API_KEY: API_KEY,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let booted = false;
    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      if (text.includes("HTTP MCP listening") && !booted) {
        booted = true;
        resolve();
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("error", reject);
    child.on("exit", (code) => {
      if (!booted) reject(new Error(`HTTP server exited early: ${code}`));
    });
  });
}

async function stopServer() {
  if (!child) return;
  child.kill("SIGTERM");
  await sleep(300);
  child = undefined;
}

async function main() {
  const failures: string[] = [];

  try {
    await startServer();
    await waitForHealth();

    const health = await fetch(`${BASE}/health`);
    const healthJson = (await health.json()) as {
      ok?: boolean;
      name?: string;
      version?: string;
      transport?: string;
    };
    if (!health.ok || !healthJson.ok || healthJson.name !== "compass-mcp") {
      failures.push("health check failed");
    }
    if (healthJson.version !== PKG_VERSION) {
      failures.push(`expected version ${PKG_VERSION}, got ${healthJson.version}`);
    }
    if (healthJson.transport !== "streamable-http") {
      failures.push("health transport mismatch");
    }

    const initRes = await fetch(`${BASE}/mcp`, {
      method: "POST",
      headers: MCP_HEADERS,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "compass-smoke", version: "1.0.0" },
        },
      }),
    });

    if (!initRes.ok) {
      failures.push(`initialize HTTP ${initRes.status}`);
    }

    const sessionId =
      initRes.headers.get("mcp-session-id") ??
      initRes.headers.get("Mcp-Session-Id");
    if (!sessionId) {
      failures.push("missing mcp-session-id header after initialize");
    }

    const toolsRes = await fetch(`${BASE}/mcp`, {
      method: "POST",
      headers: {
        ...MCP_HEADERS,
        "mcp-session-id": sessionId ?? "",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
    });

    if (!toolsRes.ok) {
      failures.push(`tools/list HTTP ${toolsRes.status}`);
    } else {
      const toolsBody = (await readMcpJson(toolsRes)) as {
        result?: { tools?: Array<{ name: string }> };
      };
      const names = new Set(
        (toolsBody.result?.tools ?? []).map((t) => t.name),
      );
      for (const expected of EXPECTED_TOOL_NAMES) {
        if (!names.has(expected)) {
          failures.push(`missing tool: ${expected}`);
        }
      }
    }

    const noKey = await fetch(`${BASE}/health`, {
      headers: { "X-Forwarded-For": "203.0.113.1" },
    });
    if (noKey.status !== 200) {
      /* health is public */
    }

    if (failures.length) {
      console.error("HTTP smoke FAILED:");
      for (const f of failures) console.error(" -", f);
      process.exit(1);
    }

    console.log(
      `HTTP smoke OK — health + initialize + tools/list (${EXPECTED_TOOL_NAMES.length} tools)`,
    );
  } finally {
    await stopServer();
  }
}

main().catch((err) => {
  console.error(err);
  void stopServer();
  process.exit(1);
});
