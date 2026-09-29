// POST /api/conversation/message — one conversational turn (Module 1/3 core).
//
// Pipeline per turn:
//   user text → language confirm/detect → slot extraction (deterministic NLU)
//   → GPT-4o phrasing when keyed (fallback: scripted empathetic replies)
//   → persist transcript/slots/stage in MongoDB → JSON reply for TTS.
import { getDb } from "@/db";
import { ObjectId } from "mongodb";
import type { Channel, ChatTurn, ConversationReply, LangCode, SlotState, Stage } from "@/lib/types";
import { fallbackStep, greeting, stageProgress, applyAnswer } from "@/lib/conversation";
import { llmStep, hasOpenAI } from "@/lib/llm";
import { detectLanguage, scanSkills } from "@/data/skills";

export const dynamic = "force-dynamic";

const ALLOWED: LangCode[] = ["hi", "en", "ta", "te", "mr", "bn"];

function asLang(x: unknown, fallback: LangCode): LangCode {
  return ALLOWED.includes(x as LangCode) ? (x as LangCode) : fallback;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      sessionId?: string;
      channel?: Channel;
      lang?: LangCode;
      userText?: string;
      keepStage?: boolean;
    };
    const channel: Channel = body.channel === "ivr" || body.channel === "whatsapp" ? body.channel : "web";
    const lang = asLang(body.lang, "hi");

    const db = await getDb();

    // ---------- new session (greeting only, no user turn yet)
    if (!body.sessionId) {
      const doc = {
        channel, language: lang, transcript: [], slots: {}, stage: "name", done: false,
        createdAt: new Date(), updatedAt: new Date()
      };
      const result = await db.collection("conversations").insertOne(doc);
      const replyTxt = greeting(lang);
      const transcript: ChatTurn[] = [{ role: "assistant", text: replyTxt, lang, at: Date.now() }];
      
      await db.collection("conversations").updateOne(
        { _id: result.insertedId },
        { $set: { transcript: transcript, updatedAt: new Date() } }
      );
      
      const out: ConversationReply = {
        id: result.insertedId.toString(), reply: replyTxt, language: lang, stage: "name",
        progress: stageProgress("name"), done: false, slots: {}, aiPowered: hasOpenAI(),
      };
      return Response.json(out);
    }

    // ---------- existing session turn
    let qId;
    try { qId = new ObjectId(body.sessionId); } catch(e) { qId = body.sessionId; }
    
    const row = await db.collection("conversations").findOne({ _id: qId as any });
    if (!row) return Response.json({ error: "session not found" }, { status: 404 });

    const transcript = ((row.transcript as ChatTurn[]) ?? []).slice();
    let slots = (row.slots as SlotState) ?? {};
    let stage = (row.stage as Stage) ?? "name";
    const userText = (body.userText ?? "").trim();
    if (!userText) return Response.json({ error: "userText required" }, { status: 400 });

    // Language: the client is the source of truth (the beneficiary can switch
    // languages mid-interview); script detection only fills in when the client
    // did not state one.
    const detected = detectLanguage(userText);
    const effLang: LangCode = body.lang ? lang : asLang(detected, (row.language as LangCode) ?? lang);

    transcript.push({ role: "user", text: userText, lang: effLang, at: Date.now() });

    let replyTxt = "";
    let done = false;
    let aiPowered = false;

    // Deterministic NLU always runs (skills scan, education parse, etc.)
    const detSlots = applyAnswer(slots, stage, userText, effLang);

    if (hasOpenAI() && !body.keepStage) {
      const llm = await llmStep(slots, stage, userText, transcript);
      if (llm) {
        aiPowered = true;
        replyTxt = llm.reply;
        if (llm.slotUpdates) {
          slots = { ...detSlots, ...llm.slotUpdates };
          // keep scanned skills from interest/occupation answers
          if (stage === "interests") {
            const hits = scanSkills(userText);
            if (hits.length) slots.interests = hits;
          }
        } else {
          slots = detSlots;
        }
        if (llm.finished) {
          stage = "done";
          done = true;
        } else if (llm.reply) {
          // advance unless model clearly re-asks the same stage
          stage = stage === "confirm" ? "done" : stage;
          if (stage === "done") done = true;
          else {
            const order: Stage[] = ["name", "location", "education", "family_occupation", "current_livelihood", "interests", "employment", "mobility", "physical", "confirm"];
            const idx = order.indexOf(stage);
            stage = order[Math.min(idx + 1, order.length - 1)];
          }
        }
      }
    }

    if (!replyTxt) {
      const step = fallbackStep(detSlots, stage, userText, effLang);
      replyTxt = step.reply;
      slots = step.slots;
      stage = step.stage;
      done = step.done;
    }

    // interest labels refresh (readable labels for display)
    if (slots.interests && !slots.interestLabels?.length) {
      const { SKILL_MAP } = await import("@/data/skills");
      slots.interestLabels = slots.interests.map((id) => SKILL_MAP.get(id)?.en ?? id);
    }

    transcript.push({ role: "assistant", text: replyTxt, lang: effLang, at: Date.now() });

    await db.collection("conversations").updateOne(
      { _id: qId as any },
      { $set: { transcript: transcript, slots: slots, stage, done, language: effLang, updatedAt: new Date() } }
    );

    const out: ConversationReply = {
      id: row._id.toString(), reply: replyTxt, language: effLang, stage,
      progress: stageProgress(stage), done, slots, aiPowered,
    };
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: "conversation error", detail: String(e) }, { status: 500 });
  }
}
