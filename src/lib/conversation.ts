// Conversation engine — deterministic, empathetic interview state machine
// (works fully offline). GPT-4o, when available, upgrades phrasing; slots and
// stages are always tracked here so the flow never breaks.
//
//   name → location → education → family_occupation → current_livelihood
//        → interests → employment → mobility → physical → confirm → done
import type { LangCode, SlotState, Stage, BeneficiaryProfile } from "@/lib/types";
import { QUESTIONS, ACKS, DONE_TEXT, LANG_NAME } from "@/data/i18n";
import {
  scanSkills, SKILL_MAP, parseEducation, matchPlace, extractVillage,
  cleanName, parsePreference, parseMobility, parseConstraints, parseAge,
} from "@/data/skills";

export const STAGES: Stage[] = [
  "name", "location", "education", "family_occupation", "current_livelihood",
  "interests", "employment", "mobility", "physical", "confirm", "done",
];

export const STAGE_LABELS: Record<Stage, { en: string; hi: string }> = {
  name: { en: "Name", hi: "नाम" },
  location: { en: "Location", hi: "स्थान" },
  education: { en: "Education", hi: "शिक्षा" },
  family_occupation: { en: "Family work", hi: "पारिवारिक काम" },
  current_livelihood: { en: "Current work", hi: "वर्तमान काम" },
  interests: { en: "Interests", hi: "रुचि" },
  employment: { en: "Job or own work", hi: "नौकरी / स्वरोज़गार" },
  mobility: { en: "Travel range", hi: "यात्रा सीमा" },
  physical: { en: "Constraints", hi: "बाधाएँ" },
  confirm: { en: "Confirmation", hi: "पुष्टि" },
  done: { en: "Done", hi: "पूर्ण" },
};

export function greeting(lang: LangCode): string {
  return QUESTIONS.name[lang] ?? QUESTIONS.name.en;
}

function ack(idx: number, lang: LangCode): string {
  return (ACKS[idx % ACKS.length][lang] ?? ACKS[idx % ACKS.length].en);
}

/** Extract slot value(s) from the user's answer for the given stage. */
export function applyAnswer(slots: SlotState, stage: Stage, text: string, lang: LangCode): SlotState {
  const s: SlotState = { ...slots };
  switch (stage) {
    case "name": {
      s.name = cleanName(text);
      const age = parseAge(text);
      if (age) s.age = age;
      break;
    }
    case "location": {
      s.place = text.trim();
      const p = matchPlace(text);
      if (p) { s.district = p.district; s.state = p.state; s.lat = p.lat; s.lng = p.lng; }
      const v = extractVillage(text);
      if (v) s.village = v;
      break;
    }
    case "education": {
      const e = parseEducation(text);
      s.education = e.label;
      s.educationRank = e.rank;
      break;
    }
    case "family_occupation": {
      s.familyOccupation = text.trim();
      s.familySkills = scanSkills(text);
      break;
    }
    case "current_livelihood": {
      s.currentLivelihood = text.trim();
      s.currentSkills = scanSkills(text);
      const age = parseAge(text);
      if (age) s.age = age;
      break;
    }
    case "interests": {
      const hits = scanSkills(text);
      s.interests = hits;
      s.interestLabels = hits.map((id) => SKILL_MAP.get(id)?.en ?? id);
      break;
    }
    case "employment":
      s.preference = parsePreference(text);
      break;
    case "mobility":
      s.mobilityKm = parseMobility(text);
      break;
    case "physical":
      s.constraints = parseConstraints(text);
      break;
    default:
      break;
  }
  if (!s.languages) s.languages = [LANG_NAME[lang] ?? "Hindi"];
  return s;
}

const YES_RE = /(haan|haanji|han|yes|sahi|theek|bilkul|ठीक|हाँ|हां|हो|ஆம்|சரி|అవును|সঠিক|হ্যাঁ)/i;
const NO_RE = /(nahi|galat|wrong|no\b|नहीं|गलत|இல்லை|తప్పు|नाही|चुकीचे|না|ভুল)/i;

export interface StepResult {
  reply: string;
  slots: SlotState;
  stage: Stage;
  done: boolean;
}

/** One deterministic step of the interview (used when LLM is unavailable). */
export function fallbackStep(slots: SlotState, stage: Stage, userText: string, lang: LangCode): StepResult {
  // ---------- confirmation stage: yes → done, no → restart gently
  if (stage === "confirm") {
    if (NO_RE.test(userText)) {
      const restart: Record<LangCode, string> = {
        hi: "कोई बात नहीं! चलिए आराम से फिर से शुरू करते हैं। आपका नाम क्या है?",
        en: "No problem at all! Let's gently start again. What is your name?",
        ta: "பரவாயில்லை! மீண்டும் தொடங்குவோம். உங்கள் பெயர் என்ன?",
        te: "పరవాలేదు! మళ్ళీ ప్రారంభిద్దాం. మీ పేరు ఏమిటి?",
        mr: "काही हरकत नाही! पुन्हा सुरू करूया. तुमचे नाव काय?",
        bn: "কোনো সমস্যা নেই! আবার শুরু করি। আপনার নাম কি?",
      };
      return { reply: restart[lang] ?? restart.en, slots: { languages: slots.languages }, stage: "name", done: false };
    }
    void YES_RE;
    return { reply: DONE_TEXT[lang] ?? DONE_TEXT.en, slots, stage: "done", done: true };
  }

  const idx = STAGES.indexOf(stage);
  const next = STAGES[Math.min(idx + 1, STAGES.length - 1)];

  const updated = applyAnswer(slots, stage, userText, lang);

  if (next === "confirm") {
    const summary = buildSummary(updated, lang);
    const pre = ack(idx, lang);
    return { reply: `${pre} ${summary} ${QUESTIONS.confirm[lang] ?? QUESTIONS.confirm.en}`, slots: updated, stage: "confirm", done: false };
  }

  const q = QUESTIONS[next as Exclude<Stage, "done">];
  const echo = shortEcho(stage, updated, lang);
  const reply = `${ack(idx, lang)}${echo ? " " + echo : ""} ${q[lang] ?? q.en}`;
  return { reply, slots: updated, stage: next, done: false };
}

function shortEcho(stage: Stage, s: SlotState, lang: LangCode): string {
  const v =
    stage === "name" ? s.name :
    stage === "location" ? (s.district ? `${s.village ? s.village + ", " : ""}${s.district}, ${s.state}` : s.place) :
    stage === "education" ? s.education :
    stage === "employment" ? (s.preference === "self" ? (lang === "hi" ? "खुद का काम" : "own work") : s.preference === "wage" ? (lang === "hi" ? "नौकरी" : "a job") : (lang === "hi" ? "दोनों" : "either")) :
    stage === "mobility" ? (s.mobilityKm ? `${s.mobilityKm} km` : undefined) :
    undefined;
  if (!v) return "";
  if (lang === "hi") return `आपने बताया: ${v}.`;
  return `You said: ${v}.`;
}

/** Natural-language recap of everything the agent understood. */
export function buildSummary(s: SlotState, lang: LangCode): string {
  const loc = s.district ? `${s.village ? s.village + ", " : ""}${s.district}, ${s.state ?? ""}`.replace(/,\s*$/, "") : (s.place ?? "—");
  const skills = [...new Set([...(s.familySkills ?? []), ...(s.currentSkills ?? [])])]
    .map((id) => SKILL_MAP.get(id)?.[lang === "hi" ? "hi" : "en"] ?? id)
    .join(", ") || "—";
  const interests = (s.interestLabels ?? []).join(", ") || "—";
  const pref =
    s.preference === "self" ? { hi: "खुद का काम", en: "own work / business" } :
    s.preference === "wage" ? { hi: "नौकरी", en: "a job" } : { hi: "दोनों ठीक हैं", en: "either" };

  if (lang === "hi") {
    return `मैंने यह समझा — आपका नाम ${s.name ?? "—"} है, आप ${loc} से हैं, शिक्षा ${s.education ?? "—"}। ` +
      `परिवार का काम: ${s.familyOccupation ?? "—"}; अभी का काम: ${s.currentLivelihood ?? "—"}। ` +
      `आपके हुनर: ${skills}। आपकी रुचि: ${interests}। आप ${pref.hi} चाहते हैं और ट्रेनिंग के लिए करीब ${s.mobilityKm ?? 25} किलोमीटर तक जा सकते हैं। शारीरिक दिक्कत: ${s.constraints ?? "कोई नहीं"}।`;
  }
  return `Here is what I understood — your name is ${s.name ?? "—"}, you live in ${loc}, education: ${s.education ?? "—"}. ` +
    `Family occupation: ${s.familyOccupation ?? "—"}; current work: ${s.currentLivelihood ?? "—"}. ` +
    `Your skills: ${skills}. Interests: ${interests}. You prefer ${pref.en}, and can travel about ${s.mobilityKm ?? 25} km for training. Physical constraints: ${s.constraints ?? "none"}.`;
}

/** Convert conversation slots into the formal BeneficiaryProfile (Module 3). */
export function buildProfile(s: SlotState, lang: LangCode): BeneficiaryProfile {
  const skillIds = [...new Set([...(s.familySkills ?? []), ...(s.currentSkills ?? [])])];
  return {
    name: s.name ?? "Beneficiary",
    age: s.age,
    gender: s.gender,
    location: {
      village: s.village, district: s.district, state: s.state,
      lat: s.lat, lng: s.lng,
    },
    education: s.education ?? "8th pass",
    educationRank: s.educationRank ?? 2,
    category: "SC",
    family_occupation: s.familyOccupation ?? "Not specified",
    current_livelihood: s.currentLivelihood ?? "Not specified",
    identified_skills: skillIds,
    skill_labels: skillIds.map((id) => {
      const e = SKILL_MAP.get(id);
      return { id, en: e?.en ?? id, hi: e?.hi ?? id };
    }),
    interests: s.interests ?? [],
    interest_labels: s.interestLabels ?? [],
    employment_preference:
      s.preference === "self" ? "self-employment" : s.preference === "wage" ? "wage-employment" : "either",
    mobility: s.mobilityKm && s.mobilityKm >= 60 ? "can travel to other districts" : `can travel up to ${s.mobilityKm ?? 25}km`,
    mobility_km: s.mobilityKm ?? 25,
    physical_constraints: s.constraints ?? "None",
    language_spoken: s.languages ?? [LANG_NAME[lang] ?? "Hindi"],
    additional_notes: "Captured via JeevikaSetu voice interview",
    work_independence: s.work_independence,
    insights: s.insights,
  };
}

export function stageProgress(stage: Stage): number {
  const idx = STAGES.indexOf(stage);
  return Math.round((idx / (STAGES.length - 1)) * 100);
}
