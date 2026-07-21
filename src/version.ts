/**
 * Local package version + optional git remote behind hint.
 * Never throws — safe for MCP tool responses.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

export interface VersionInfo {
  name: string;
  version: string;
  package_path: string;
  git?: {
    commit?: string;
    branch?: string;
    /** true when local is behind origin/main (best-effort) */
    behind_remote?: boolean;
    remote_hint?: string;
  };
}

function repoRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..");
}

function readPackageVersion(root: string): { name: string; version: string } {
  const pkgPath = path.join(root, "package.json");
  const raw = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
    name?: string;
    version?: string;
  };
  return {
    name: raw.name ?? "compass-mcp",
    version: raw.version ?? "0.0.0",
  };
}

function gitBehindHint(root: string): VersionInfo["git"] | undefined {
  const gitDir = path.join(root, ".git");
  if (!fs.existsSync(gitDir)) return undefined;
  try {
    execSync("git rev-parse --is-inside-work-tree", {
      cwd: root,
      stdio: "ignore",
    });
  } catch {
    return undefined;
  }

  const git: NonNullable<VersionInfo["git"]> = {};
  try {
    git.commit = execSync("git rev-parse --short HEAD", {
      cwd: root,
      encoding: "utf8",
    }).trim();
  } catch {
    /* ignore */
  }
  try {
    git.branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: root,
      encoding: "utf8",
    }).trim();
  } catch {
    /* ignore */
  }

  try {
    execSync("git fetch origin --quiet", {
      cwd: root,
      stdio: "ignore",
      timeout: 8000,
    });
    const behind = execSync(
      "git rev-list HEAD..origin/main --count 2>/dev/null || git rev-list HEAD..origin/master --count 2>/dev/null || echo 0",
      { cwd: root, encoding: "utf8" },
    ).trim();
    const n = parseInt(behind, 10);
    if (Number.isFinite(n) && n > 0) {
      git.behind_remote = true;
      git.remote_hint = `origin is ~${n} commit(s) ahead — run: npm run sync`;
    } else {
      git.behind_remote = false;
    }
  } catch {
    git.remote_hint = "git fetch skipped — run npm run sync manually after pull";
  }

  return git;
}

export function getVersionInfo(opts?: { skip_fetch?: boolean }): VersionInfo {
  const root = repoRoot();
  const { name, version } = readPackageVersion(root);
  return {
    name,
    version,
    package_path: root,
    git: opts?.skip_fetch ? undefined : gitBehindHint(root),
  };
}

export function buildUpdateHint(info: VersionInfo, locale: "ko" | "en" = "ko") {
  const behind = info.git?.behind_remote;
  if (locale === "en") {
    return {
      version: info.version,
      up_to_date: !behind,
      message: behind
        ? `${info.version} installed — remote has newer commits. npm run sync then how_to_refresh_mcp.`
        : `${info.version} — if tools look stale, how_to_refresh_mcp.`,
      refresh: "how_to_refresh_mcp",
    };
  }
  return {
    version: info.version,
    up_to_date: !behind,
    message: behind
      ? `${info.version} 설치됨 — 원격에 더 새 커밋 있음. npm run sync 후 how_to_refresh_mcp.`
      : `${info.version} — 도구가 옛 목록이면 how_to_refresh_mcp.`,
    refresh: "how_to_refresh_mcp",
  };
}
