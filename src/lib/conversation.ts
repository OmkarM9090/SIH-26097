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
      // This stage intentionally asks about the nature of work first. The
      // answer controls the next wording; we never assume family work.
      const family = /(family|traditional|father|parents|परिवार|पारंपरिक|पिता|घर का|परम्परा|குடும்ப|కుటుంబ|कुटुंब|পরিবার)/i.test(text);
      s.work_independence = family ? "family_business" : "independent";
      break;
    }
    case "current_livelihood": {
      const skills = scanSkills(text);
      if (s.work_independence === "family_business") {
        s.familyOccupation = text.trim();
        s.familySkills = skills;
      } else {
        s.currentLivelihood = text.trim();
        s.currentSkills = skills;
      }
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

  // Branch immediately after the work-nature answer. The next answer is
  // stored as family occupation or independent livelihood by applyAnswer.
  if (stage === "family_occupation") {
    const family = updated.work_independence === "family_business";
    const branch: Record<LangCode, string> = {
      hi: family ? "बहुत अच्छा! आपके परिवार का पारंपरिक काम क्या है? आप उसमें क्या काम करते हैं?" : "बहुत अच्छा! आप क्या काम करते हैं? रोज़ क्या करते हैं?",
      en: family ? "Very good! What is your family's traditional work, and what do you do in it?" : "Very good! What work do you do? What do you do each day?",
      ta: family ? "மிகவும் நல்லது! உங்கள் குடும்பத்தின் பாரம்பரிய வேலை என்ன?" : "மிகவும் நல்லது! நீங்கள் என்ன வேலை செய்கிறீர்கள்?",
      te: family ? "చాలా బాగుంది! మీ కుటుంబ సంప్రదాయ పని ఏమిటి?" : "చాలా బాగుంది! మీరు ఏ పని చేస్తున్నారు?",
      mr: family ? "खूप छान! तुमच्या कुटुंबाचे पारंपरिक काम काय आहे?" : "खूप छान! तुम्ही कोणते काम करता?",
      bn: family ? "খুব ভালো! আপনার পরিবারের ঐতিহ্যবাহী কাজ কী?" : "খুব ভালো! আপনি কী কাজ করেন?",
    };
    return { reply: branch[lang] ?? branch.en, slots: updated, stage: "current_livelihood", done: false };
  }

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

const OWN_WORK: Record<LangCode, string> = {
  hi: "खुद का काम", en: "own work", ta: "சொந்தத் தொழில்", te: "స్వంత పని", mr: "स्वतःचे काम", bn: "নিজের কাজ",
};
const A_JOB: Record<LangCode, string> = {
  hi: "नौकरी", en: "a job", ta: "வேலை", te: "ఉద్యోగం", mr: "नोकरी", bn: "চাকরি",
};
const EITHER: Record<LangCode, string> = {
  hi: "दोनों", en: "either", ta: "இரண்டும்", te: "రెండూ", mr: "दोन्ही", bn: "উভয়",
};
const YOU_SAID: Record<LangCode, (v: string) => string> = {
  hi: (v) => `आपने बताया: ${v}.`,
  en: (v) => `You said: ${v}.`,
  ta: (v) => `நீங்கள் சொன்னது: ${v}.`,
  te: (v) => `మీరు చెప్పింది: ${v}.`,
  mr: (v) => `तुम्ही सांगितले: ${v}.`,
  bn: (v) => `আপনি বললেন: ${v}.`,
};

function shortEcho(stage: Stage, s: SlotState, lang: LangCode): string {
  const v =
    stage === "name" ? s.name :
    stage === "location" ? (s.district ? `${s.village ? s.village + ", " : ""}${s.district}, ${s.state}` : s.place) :
    stage === "education" ? s.education :
    stage === "employment" ? (s.preference === "self" ? OWN_WORK[lang] : s.preference === "wage" ? A_JOB[lang] : EITHER[lang]) :
    stage === "mobility" ? (s.mobilityKm ? `${s.mobilityKm} km` : undefined) :
    undefined;
  if (!v) return "";
  return (YOU_SAID[lang] ?? YOU_SAID.en)(v);
}

/** Natural-language recap of everything the agent understood. */
export function buildSummary(s: SlotState, lang: LangCode): string {
  const loc = s.district ? `${s.village ? s.village + ", " : ""}${s.district}, ${s.state ?? ""}`.replace(/,\s*$/, "") : (s.place ?? "—");
  const skills = [...new Set([...(s.familySkills ?? []), ...(s.currentSkills ?? [])])]
    .map((id) => SKILL_MAP.get(id)?.[lang === "hi" ? "hi" : "en"] ?? id)
    .join(", ") || "—";
  const interests = (s.interestLabels ?? []).join(", ") || "—";
  const pref = s.preference === "self" ? OWN_WORK[lang] : s.preference === "wage" ? A_JOB[lang] : EITHER[lang];
  const name = s.name ?? "—";
  const edu = s.education ?? "—";
  const fam = s.familyOccupation ?? "—";
  const cur = s.currentLivelihood ?? "—";
  const km = s.mobilityKm ?? 25;

  const templates: Record<LangCode, string> = {
    hi: `मैंने यह समझा — आपका नाम ${name} है, आप ${loc} से हैं, शिक्षा ${edu}। परिवार का काम: ${fam}; अभी का काम: ${cur}। आपके हुनर: ${skills}। आपकी रुचि: ${interests}। आप ${pref} चाहते हैं और ट्रेनिंग के लिए करीब ${km} किलोमीटर तक जा सकते हैं। शारीरिक दिक्कत: ${s.constraints ?? "कोई नहीं"}।`,
    en: `Here is what I understood — your name is ${name}, you live in ${loc}, education: ${edu}. Family occupation: ${fam}; current work: ${cur}. Your skills: ${skills}. Interests: ${interests}. You prefer ${pref}, and can travel about ${km} km for training. Physical constraints: ${s.constraints ?? "none"}.`,
    ta: `நான் புரிந்துகொண்டது — உங்கள் பெயர் ${name}, நீங்கள் ${loc} இல் வசிக்கிறீர்கள், கல்வி: ${edu}. குடும்பத் தொழில்: ${fam}; தற்போதைய வேலை: ${cur}. உங்கள் திறன்கள்: ${skills}. ஆர்வம்: ${interests}. நீங்கள் ${pref} விரும்புகிறீர்கள், பயிற்சிக்கு சுமார் ${km} கி.மீ. பயணிக்க முடியும். உடல் சார்ந்த சிரமம்: ${s.constraints ?? "இல்லை"}.`,
    te: `నేను అర్థం చేసుకున్నది — మీ పేరు ${name}, మీరు ${loc} లో ఉంటారు, విద్య: ${edu}. కుటుంబ వృత్తి: ${fam}; ప్రస్తుత పని: ${cur}. మీ నైపుణ్యాలు: ${skills}. ఆసక్తులు: ${interests}. మీరు ${pref} ఇష్టపడుతున్నారు, శిక్షణ కోసం సుమారు ${km} కి.మీ. ప్రయాణించగలరు. శారీరక ఇబ్బందులు: ${s.constraints ?? "లేవు"}.`,
    mr: `मला हे समजले — तुमचे नाव ${name}, तुम्ही ${loc} येथे राहता, शिक्षण: ${edu}. कौटुंबिक काम: ${fam}; सध्याचे काम: ${cur}. तुमची कौशल्ये: ${skills}. आवड: ${interests}. तुम्हाला ${pref} हवे आहे आणि प्रशिक्षणासाठी सुमारे ${km} किलोमीटर प्रवास करू शकता. शारीरिक अडचण: ${s.constraints ?? "नाही"}.`,
    bn: `আমি যা বুঝলাম — আপনার নাম ${name}, আপনি ${loc}-এ থাকেন, শিক্ষা: ${edu}। পারিবারিক কাজ: ${fam}; বর্তমান কাজ: ${cur}। আপনার দক্ষতা: ${skills}। আগ্রহ: ${interests}। আপনি ${pref} চান এবং প্রশিক্ষণের জন্য প্রায় ${km} কিলোমিটার যেতে পারেন। শারীরিক সমস্যা: ${s.constraints ?? "নেই"}।`,
  };
  return templates[lang] ?? templates.en;
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
