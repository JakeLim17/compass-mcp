/**
 * Multi-host profiles: logical ChronoCode roles → host-specific model ids.
 *
 * Claude / OpenAI maps are **approximate** — edit HOST_PROFILES in this file
 * (or fork) to match your account’s available model ids.
 *
 * Cursor catalog SSOT: recommend.CURSOR_AGENT_CATALOG / CURSOR_TASK_SLUG
 * (UI chat dropdown still does not auto-switch).
 *
 * Lightest tier is **per host**, not a single Haiku slug:
 * - cursor → Composer (composer-2.5-fast)
 * - claude → Haiku (claude-haiku-*)
 * - openai → Mini/Nano (gpt-4.1-mini)
 * Logical role for lightest scoring: ModelId "Composer 2.5".
 */
import type { ModelId } from "./recommend.js";

export type HostId = "cursor" | "claude" | "openai" | "generic";

/** Logical ModelId used in scoring for the lightest daily / copy tier */
export const LIGHTEST_LOGICAL: ModelId = "Composer 2.5";

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
  /** Human label for the lightest id on this host (docs only) */
  lightest_label: string;
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

/** Enabled in Cursor Task/agent UI (screenshot green) — SSOT for recommend on host=cursor */
export const CURSOR_TASK_ENABLED_SLUGS = [
  "composer-2.5-fast",
  "claude-sonnet-5-thinking-high",
  "claude-opus-4-8-thinking-high",
  "claude-fable-5-thinking-high",
  "cursor-grok-4.5-high-fast",
  "gpt-5.6-sol-medium",
  "gpt-5.6-terra-medium",
  "kimi-k2.7-code",
] as const;

/** Gray/disabled in UI — use in .compass-mcp.json blocked_models (display names OK) */
export const CURSOR_BLOCKED_LABELS = [
  "GPT-5.5",
  "Sonnet 4.6",
  "Codex 5.3",
  "Opus 4.7",
  "GPT-5.4",
  "Opus 4.6",
  "Opus 4.5",
] as const;

/** Chat dropdown only — not default-scored; host=generic if you must map */
export const CURSOR_CHAT_ONLY = [
  {
    name: "Haiku 4.5",
    note: "Claude light example (chat UI). Task slug unverified — use claude host light mapping.",
  },
  {
    name: "GPT-5.4 Mini/Nano",
    note: "OpenAI light (chat UI). openai host maps light → gpt-4.1-mini.",
  },
  { name: "Gemini Flash/Pro", note: "chat only — not in Cursor Task catalog" },
  { name: "Luna", note: "chat only" },
  { name: "Sonnet 4.5", note: "legacy chat; prefer Sonnet 5 Task slug" },
] as const;

export const FULL_LADDER_DOC =
  "lightest(host): Cursor=Composer · Claude=Haiku · GPT=Mini/Nano · mid: Sonnet/Opus/Fable/Grok/Sol · high: Terra/Codex";

export const LIGHTEST_BY_HOST_DOC = {
  ko: "Haiku는 Claude light 예시, Cursor light=Composer, GPT light=Mini/Nano — 호스트마다 lightest id가 다름.",
  en: "Haiku = Claude light example; Cursor light = Composer; GPT light = Mini/Nano — lightest id varies by host.",
};

export const HOST_PROFILES: Record<HostId, HostProfile> = {
  cursor: {
    id: "cursor",
    display_name: "Cursor",
    lightest_label: "Composer 2.5 (composer-2.5-fast)",
    note:
      "Catalog slugs only. Task-fit primary + candidates fallback_chain — if primary_id unavailable, try candidates[1].id.",
    ids: { ...CURSOR_IDS },
  },
  claude: {
    id: "claude",
    display_name: "Claude Desktop / Anthropic",
    lightest_label: "Haiku (claude-haiku-4-5-20251001)",
    note: "Approximate Anthropic ids — light role maps to Haiku, not Composer slug.",
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
    lightest_label: "GPT-4.1 Mini (gpt-4.1-mini)",
    note: "Approximate OpenAI ids — light role maps to mini/nano tier.",
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
    lightest_label: "role:lightest",
    note:
      "Role placeholders — edit ids for your host. VS Code MCP: use host=vscode or generic.",
    ids: {
      "Composer 2.5": "role:lightest",
      "Claude Sonnet": "role:sonnet",
      "Claude Opus": "role:opus",
      "Fable 5": "role:mid",
      "Grok 5.x": "role:design",
      "GPT-5 Sol": "role:sol",
      "GPT-5 Codex": "role:heavy",
    },
  },
};

/** Host-specific lightest tier id (copy/i18n / tiny patch primary_id) */
export function hostLightestId(host?: string | null): string {
  return hostModelId(host, LIGHTEST_LOGICAL);
}

/** Host-specific lightest label for docs / clarity */
export function hostLightestLabel(host?: string | null): string {
  return getHostProfile(host).lightest_label;
}

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
  lightest: { logical: ModelId; id: string; label: string };
  lightest_note?: { ko: string; en: string };
  ladders?: string;
  full_ladder?: string;
  cursor_catalog?: {
    task_enabled_slugs: readonly string[];
    blocked_labels: readonly string[];
    chat_only: readonly { name: string; note: string }[];
    optional_slugs: string[];
  };
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
      lightest: {
        logical: LIGHTEST_LOGICAL,
        id: profile.ids[LIGHTEST_LOGICAL],
        label: profile.lightest_label,
      },
      full_ladder: FULL_LADDER_DOC,
      lightest_note: LIGHTEST_BY_HOST_DOC,
      unavailable_roles:
        unavailable_roles.length > 0 ? unavailable_roles : undefined,
      fallback_note:
        "Same recommend_model scoring on every host. If primary_id missing/unavailable → use candidates[1].id, then next.",
      ...(id === "cursor"
        ? {
            ladders:
              "light: Composer · Claude: Sonnet < Opus < Fable · GPT: Sol < Terra · design: Grok/Fable/Opus/Sonnet",
            cursor_catalog: {
              task_enabled_slugs: CURSOR_TASK_ENABLED_SLUGS,
              blocked_labels: CURSOR_BLOCKED_LABELS,
              chat_only: CURSOR_CHAT_ONLY,
              optional_slugs: ["kimi-k2.7-code"],
            },
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
