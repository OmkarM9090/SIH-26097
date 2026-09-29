// Shared types across JeevikaSetu prototype.

export type LangCode = "hi" | "en" | "ta" | "te" | "mr" | "bn";
export type Channel = "web" | "ivr" | "whatsapp";

export interface LangInfo {
  code: LangCode;
  native: string;
  english: string;
  bcp: string; // BCP-47 tag for SpeechRecognition / speechSynthesis
}

/** Conversation interview stages, in order. */
export type Stage =
  | "name"
  | "location"
  | "education"
  | "family_occupation"
  | "current_livelihood"
  | "interests"
  | "employment"
  | "mobility"
  | "physical"
  | "confirm"
  | "done";

/** Slots collected during the voice interview. */
export interface SlotState {
  name?: string;
  age?: number;
  gender?: "male" | "female" | "other";
  place?: string;
  village?: string;
  district?: string;
  state?: string;
  lat?: number;
  lng?: number;
  education?: string;
  educationRank?: number; // 0 none .. 6 graduate
  familyOccupation?: string;
  familySkills?: string[];
  currentLivelihood?: string;
  currentSkills?: string[];
  interests?: string[];       // canonical skill ids / sector tags
  interestLabels?: string[];  // readable labels
  preference?: "self" | "wage" | "either";
  mobilityKm?: number;
  constraints?: string;
  languages?: string[];
  work_independence?: string;
  insights?: string;
}

/** Final structured beneficiary profile (Module 3 output). */
export interface BeneficiaryProfile {
  name: string;
  age?: number;
  gender?: string;
  location: { village?: string; district?: string; state?: string; lat?: number; lng?: number };
  education: string;
  educationRank: number;
  category: string; // "SC"
  family_occupation: string;
  current_livelihood: string;
  identified_skills: string[];       // canonical skill ids
  skill_labels: { id: string; en: string; hi: string }[];
  interests: string[];
  interest_labels: string[];
  employment_preference: string;
  mobility: string;
  mobility_km: number;
  physical_constraints: string;
  language_spoken: string[];
  additional_notes?: string;
  work_independence?: string;
  insights?: string;
}

/** NSQF Qualification Pack entry (Module 4 database). */
export interface QP {
  code: string;          // e.g. ELE/Q3101
  name: string;
  nameHi: string;
  sector: string;
  level: number;         // NSQF level 1-8
  skills: string[];      // canonical skill ids required
  edu: number;           // minimum education rank
  hours: number;
  body: string;          // certification body (SSC)
  rpl: boolean;
  selfEmp: "high" | "medium" | "low";
  income: [number, number]; // monthly INR range after completion
  tags: string[];        // interest matching tags
}

export interface TrainingCenter {
  id: string;
  name: string;
  district: string;
  state: string;
  lat: number;
  lng: number;
  qps: string[];         // QP codes offered
  phone: string;
}

export interface Opportunity {
  id: string;
  type: "job" | "self";
  title: string;
  sector: string;
  district: string;
  state: string;
  income: string;
  employer?: string;
  investment?: string;   // for self-employment
  qp?: string;           // related QP code
  gia?: string;          // related GIA benefit id
}

export interface GIABenefit {
  id: string;
  title: string;
  titleHi: string;
  amount: string;
  appliesTo: string[];   // "training" | "rpl" | "self" | "toolkit" | "wage-comp"
  description: string;
}

export interface GapItem {
  skill: string;
  label: string;
  labelHi: string;
}

export interface RecommendationResult {
  rank: number;
  qp: QP;
  score: number;
  skillOverlapPct: number;      // 0..100
  overlapSkills: string[];      // labels
  gaps: GapItem[];
  interestMatch: "high" | "medium" | "low";
  rplEligible: boolean;
  durationWeeks: number;
  center?: { name: string; district: string; distanceKm: number; phone: string };
  income: [number, number];
  pathway: string;              // "RPL → Bridge → Certificate" or "Train → Certify → Employ"
  roadmap: { step: string; stepHi: string; kind: string }[];
  gia: { title: string; amount: string }[];
  preferenceFit: string;
}

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
  lang?: string;
  at: number;
}

export interface ConversationReply {
  id: string;
  reply: string;
  language: LangCode;
  stage: Stage;
  progress: number; // 0..100
  done: boolean;
  slots: SlotState;
  aiPowered: boolean;
}
