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

/** Aliases fold into a real HostId (forge/openclaw → generic) */
const HOST_ALIASES: Record<string, HostId> = {
  cursor: "cursor",
  claude: "claude",
  "claude-desktop": "claude",
  anthropic: "claude",
  openai: "openai",
  chatgpt: "openai",
  gpt: "openai",
  generic: "generic",
  forge: "generic",
  openclaw: "generic",
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
      "Only recommend CURSOR_AGENT_CATALOG slugs. Claude: Sonnet<Opus<Fable · GPT: Sol<Terra. Task model=primary_slug or cheaper_fallback_slug; unavailable → fallback_chain.",
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
    display_name: "Generic MCP host (Forge / OpenClaw / other)",
    note: "Role placeholders only — fill real ids in HOST_PROFILES.generic.ids for your host.",
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

export function listHostProfiles(): Array<{
  id: HostId;
  display_name: string;
  note: string;
  aliases: string[];
  ids: Record<ModelId, string>;
  ladders?: string;
}> {
  const aliasByHost = new Map<HostId, string[]>();
  for (const [alias, id] of Object.entries(HOST_ALIASES)) {
    const list = aliasByHost.get(id) ?? [];
    if (alias !== id) list.push(alias);
    aliasByHost.set(id, list);
  }
  return (Object.keys(HOST_PROFILES) as HostId[]).map((id) => ({
    id,
    display_name: HOST_PROFILES[id].display_name,
    note: HOST_PROFILES[id].note,
    aliases: aliasByHost.get(id) ?? [],
    ids: HOST_PROFILES[id].ids,
    ...(id === "cursor"
      ? {
          ladders:
            "Claude: Composer < Sonnet < Opus < Fable · GPT: Sol < Terra/Codex (catalog-only)",
        }
      : {}),
  }));
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
