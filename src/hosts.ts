/**
 * Multi-host profiles: logical ChronoCode roles → host-specific model ids.
 *
 * Claude / OpenAI maps are **approximate** — edit HOST_PROFILES in this file
 * (or fork) to match your account’s available model ids.
 *
 * Cursor catalog SSOT: recommend.CURSOR_AGENT_CATALOG / CURSOR_TASK_SLUG
 * (UI chat dropdown still does not auto-switch).
 *
 * Avoids runtime import of recommend.js (type-only) to prevent circular deps.
 */
import type { ModelId } from "./recommend.js";

export type HostId = "cursor" | "claude" | "openai" | "generic";

/** Aliases fold into a real HostId (vscode/forge/openclaw → generic) */
const HOST_ALIASES: Record<string, HostId> = {
  cursor: "cursor",
  claude: "claude",
  "claude-desktop": "claude",
  anthropic: "claude",
  openai: "openai",
  chatgpt: "openai",
  gpt: "openai",
  codex: "openai",
  generic: "generic",
  forge: "generic",
  openclaw: "generic",
  vscode: "generic",
  "vs-code": "generic",
  "visual-studio-code": "generic",
  other: "generic",
};

export interface HostProfile {
  id: HostId;
  display_name: string;
  /** Honest note for agents / README */
  note: string;
  /** ChronoCode logical model → host-specific id/slug */
  ids: Record<ModelId, string>;
}

/** Cursor Task slugs — keep in sync with recommend.CURSOR_TASK_SLUG */
const CURSOR_IDS: Record<ModelId, string> = {
  "Composer 2.5": "composer-2.5-fast",
  "Claude Sonnet": "claude-sonnet-5-thinking-high",
  "Claude Opus": "claude-opus-4-8-thinking-high",
  "Fable 5": "claude-fable-5-thinking-high",
  "Grok 5.x": "cursor-grok-4.5-high-fast",
  "GPT-5 Sol": "gpt-5.6-sol-medium",
  "GPT-5 Codex": "gpt-5.6-terra-medium",
};

export const HOST_PROFILES: Record<HostId, HostProfile> = {
  cursor: {
    id: "cursor",
    display_name: "Cursor",
    note:
      "Catalog slugs only. Task-fit primary + candidates fallback_chain — if primary_id unavailable, try candidates[1].id (same on all hosts).",
    ids: { ...CURSOR_IDS },
  },
  claude: {
    id: "claude",
    display_name: "Claude Desktop / Anthropic",
    note: "Approximate Anthropic API / Claude Desktop ids — edit HOST_PROFILES.claude.ids to match your account.",
    ids: {
      "Composer 2.5": "claude-haiku-4-5-20251001",
      "Claude Sonnet": "claude-sonnet-4-5-20250929",
      "Claude Opus": "claude-opus-4-20250514",
      "Fable 5": "claude-sonnet-4-5-20250929",
      "Grok 5.x": "claude-sonnet-4-5-20250929",
      "GPT-5 Sol": "claude-sonnet-4-5-20250929",
      "GPT-5 Codex": "claude-opus-4-20250514",
    },
  },
  openai: {
    id: "openai",
    display_name: "OpenAI / ChatGPT",
    note: "Approximate OpenAI model ids — edit HOST_PROFILES.openai.ids to match your account.",
    ids: {
      "Composer 2.5": "gpt-4.1-mini",
      "Claude Sonnet": "gpt-4.1",
      "Claude Opus": "o4-mini",
      "Fable 5": "gpt-4.1",
      "Grok 5.x": "o4-mini",
      "GPT-5 Sol": "gpt-4.1",
      "GPT-5 Codex": "o3",
    },
  },
  generic: {
    id: "generic",
    display_name: "Generic MCP host (VS Code / Forge / OpenClaw / other)",
    note:
      "Role placeholders — edit ids for your host. VS Code MCP: use host=vscode or generic. Empty/unavailable ids are skipped in candidates.",
    ids: {
      "Composer 2.5": "role:light",
      "Claude Sonnet": "role:sonnet",
      "Claude Opus": "role:opus",
      "Fable 5": "role:mid",
      "Grok 5.x": "role:design",
      "GPT-5 Sol": "role:sol",
      "GPT-5 Codex": "role:heavy",
    },
  },
};

/** Host-specific id is usable (non-empty, not marked unavailable) */
export function isHostIdAvailable(id: string | null | undefined): boolean {
  if (!id?.trim()) return false;
  const lower = id.trim().toLowerCase();
  return (
    !lower.startsWith("unavailable") && lower !== "none" && lower !== "n/a"
  );
}

export function listHostProfiles(): Array<{
  id: HostId;
  display_name: string;
  note: string;
  aliases: string[];
  ids: Record<ModelId, string>;
  ladders?: string;
  /** Roles with empty or unavailable ids — agents should fallback */
  unavailable_roles?: ModelId[];
  fallback_note?: string;
}> {
  const aliasByHost = new Map<HostId, string[]>();
  for (const [alias, id] of Object.entries(HOST_ALIASES)) {
    const list = aliasByHost.get(id) ?? [];
    if (alias !== id) list.push(alias);
    aliasByHost.set(id, list);
  }
  return (Object.keys(HOST_PROFILES) as HostId[]).map((id) => {
    const profile = HOST_PROFILES[id];
    const unavailable_roles = (Object.entries(profile.ids) as [ModelId, string][])
      .filter(([, roleId]) => !isHostIdAvailable(roleId))
      .map(([model]) => model);
    return {
      id,
      display_name: profile.display_name,
      note: profile.note,
      aliases: aliasByHost.get(id) ?? [],
      ids: profile.ids,
      unavailable_roles:
        unavailable_roles.length > 0 ? unavailable_roles : undefined,
      fallback_note:
        "Same recommend_model scoring on every host. If primary_id missing/unavailable → use candidates[1].id, then next.",
      ...(id === "cursor"
        ? {
            ladders:
              "Claude: Composer < Sonnet < Opus < Fable · GPT: Sol < Terra/Codex (catalog-only)",
          }
        : {}),
    };
  });
}

/** Resolve host from arg or COMPASS_MCP_HOST env (legacy MODEL_ROUTER_HOST); default cursor */
export function resolveHostId(raw?: string | null): HostId {
  const fromEnv =
    process.env.COMPASS_MCP_HOST?.trim() ||
    process.env.MODEL_ROUTER_HOST?.trim();
  const s = (raw?.trim() || fromEnv || "cursor").toLowerCase();
  return HOST_ALIASES[s] ?? "cursor";
}

export function getHostProfile(host?: string | null): HostProfile {
  return HOST_PROFILES[resolveHostId(host)];
}

export function hostModelId(
  host: HostId | string | null | undefined,
  model: ModelId,
): string {
  return getHostProfile(host).ids[model];
}

/** Try to map a host-specific id back to a logical ModelId */
export function resolveModelIdFromHostId(
  raw?: string | null,
  host?: string | null,
): ModelId | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  const profile = getHostProfile(host);
  for (const [model, id] of Object.entries(profile.ids) as [ModelId, string][]) {
    if (id === s) return model;
  }
  for (const p of Object.values(HOST_PROFILES)) {
    for (const [model, id] of Object.entries(p.ids) as [ModelId, string][]) {
      if (id === s) return model;
    }
  }
  return null;
}
