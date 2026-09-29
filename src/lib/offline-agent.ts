// ─────────────────────────────────────────────────────────────────────────────
// JeevikaSetu — OFFLINE / MOCK CONVERSATION ENGINE  (demo-safe, zero network)
//
// Why this exists: when OpenAI quota is exhausted (429) or MongoDB / the
// /api/conversation/* routes return 4xx-5xx, the interview MUST keep running in
// front of the judges. This module is a *client-side* mirror of the server's
// deterministic interview state machine (src/lib/conversation.ts), so the exact
// same questions, acknowledgements, slot extraction and summary are produced
// with no backend at all.
//
// It is pure TypeScript with no `fs` / mongodb imports, therefore safe to
// import from a "use client" component.
// ─────────────────────────────────────────────────────────────────────────────
import type { ConversationReply, LangCode, SlotState, Stage } from "@/lib/types";
import { fallbackStep, greeting, stageProgress, buildProfile } from "@/lib/conversation";
import { QUESTIONS } from "@/data/i18n";

export interface OfflineSession {
  id: string;
  slots: SlotState;
  stage: Stage;
  lang: LangCode;
  done: boolean;
}

/** Local session id — prefixed so downstream code can recognise mock records. */
export function newOfflineId(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createOfflineSession(lang: LangCode): { session: OfflineSession; reply: ConversationReply } {
  const session: OfflineSession = {
    id: newOfflineId(),
    slots: {},
    stage: "name",
    lang,
    done: false,
  };
  return {
    session,
    reply: {
      id: session.id,
      reply: greeting(lang),
      language: lang,
      stage: "name",
      progress: stageProgress("name"),
      done: false,
      slots: {},
      aiPowered: false,
    },
  };
}

/**
 * Advance the mock state machine by one user turn.
 * Mutates nothing — returns the next session snapshot + the reply payload,
 * shaped exactly like the real `/api/conversation/message` response so the UI
 * code path is identical online and offline.
 */
export function offlineStep(
  session: OfflineSession,
  userText: string,
  lang: LangCode,
): { session: OfflineSession; reply: ConversationReply } {
  const step = fallbackStep(session.slots, session.stage, userText, lang);
  const next: OfflineSession = {
    ...session,
    slots: step.slots,
    stage: step.stage,
    lang,
    done: step.done,
  };
  return {
    session: next,
    reply: {
      id: session.id,
      reply: step.reply,
      language: lang,
      stage: step.stage,
      progress: stageProgress(step.stage),
      done: step.done,
      slots: step.slots,
      aiPowered: false,
    },
  };
}

/** Re-ask the current question in a newly selected language (instant switch). */
export function offlineQuestionFor(stage: Stage, lang: LangCode): string | undefined {
  if (stage === "done") return undefined;
  const q = QUESTIONS[stage as Exclude<Stage, "done">];
  return q?.[lang] ?? q?.en;
}

// ───────────────────────────────────────────────────── local profile storage
const PROFILE_KEY = (id: string) => `js_profile_${id}`;

/**
 * Persist a fully built BeneficiaryProfile in localStorage so the
 * /profile/[id] and /recommendations/[id] screens keep working even when the
 * database write failed. Returns the local id to route to.
 */
export function saveLocalProfile(slots: SlotState, lang: LangCode, channel: string): string {
  const id = newOfflineId();
  const profile = buildProfile(slots, lang);
  const record = {
    beneficiary: {
      id,
      name: profile.name,
      profile,
      language: lang,
      channel,
      createdAt: new Date().toISOString(),
    },
  };
  try {
    window.localStorage.setItem(PROFILE_KEY(id), JSON.stringify(record));
    window.localStorage.setItem("js_beneficiary", id);
  } catch {
    /* storage full / private mode — the caller still gets an id */
  }
  return id;
}

/** Read back a locally-stored profile (used by profile-client as a fallback). */
export function readLocalProfile(id: string): unknown | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY(id));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const isLocalId = (id: string): boolean => id.startsWith("local-");
