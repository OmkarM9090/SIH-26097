// Conversation engine — deterministic, empathetic interview state machine
// (works fully offline). GPT-4o, when available, upgrades phrasing; slots and
// stages are always tracked here so the flow never breaks.
//
//   name → location → education → family_occupation → current_livelihood
//        → interests → employment → mobility → physical → confirm → done
//
// TWO-WAY BY DESIGN: the beneficiary can talk back — ask questions ("kitna
// paisa milega?", "ye free hai?"), ask the agent to repeat, say they did not
// understand, vent a problem, or volunteer several details at once. This engine
// recognises those turns, answers them warmly, and then slides straight back to
// the pending question, exactly like a patient government field worker.
import type { LangCode, SlotState, Stage, BeneficiaryProfile } from "@/lib/types";
import { QUESTIONS, ACKS, DONE_TEXT, LANG_NAME } from "@/data/i18n";
import {
  scanSkills, SKILL_MAP, parseEducation, hasEducationSignal, matchPlace, extractVillage,
  cleanName, parsePreference, parseMobility, parseConstraints, parseAge, isBareAffirm,
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

/** Compact per-language lookup helper (falls back to English, then Hindi). */
type L6 = Partial<Record<LangCode, string>> & { en: string; hi?: string };
const L = (lang: LangCode, s: L6): string => s[lang] ?? s.en ?? s.hi ?? "";

export function greeting(lang: LangCode): string {
  return L(lang, GREETING);
}

function ack(idx: number, lang: LangCode): string {
  return L(lang, ACKS[idx % ACKS.length]);
}

/** Deterministic ack rotation — never the same word twice in a row. */
function ackFor(seed: number, lang: LangCode): string {
  return ack(Math.abs(Math.floor(seed)) % ACKS.length, lang);
}

// ─────────────────────────────────────────────────────── intent recognition
export type Intent =
  | "answer" | "repeat" | "unclear" | "question" | "affirm" | "deny"
  | "gratitude" | "greeting" | "distress" | "stop" | "empty";

const RX = {
  newline: /\s+/g,
  repeat: /(phir\s*se|phirse|dobaara|dobara|repeat|once\s*more|फिर\s*से|दोबारा|पुनः|पुन्हा|மீண்டும்|మళ్ళీ|మళ్లీ|আবার)/i,
  unclear: /(samajh\s*nahi|samjha\s*nahi|nahi\s*samjha|samaj\s*nahi|kya\s*bola|kya\s*kaha|clear\s*nahi|sunai\s*nahi|समझ\s*नहीं|नहीं\s*समझ|क्या\s*बोल|क्या\s*कहा|सुनाई\s*नहीं|स्पष्ट\s*नहीं|समजले\s*नाही|कळले\s*नाही|புரியவில்லை|தெரியவில்லை|పురియలేదు|అర్థం\s*కాలేదు|బోధపడలేదు|বুঝতে\s*পারিনি|বুঝলাম\s*না)/i,
  affirm: /(^|\s)(haan+|han+|haa+|ji\s*haan|yes|yeah|ok|okay|theek|thik|sahi|bilkul|zaroor|sure|हाँ+|हां+|जी\s*हाँ|जी\s*हां|ठीक|सही|बिल्कुल|ज़रूर|जरूर|हो|होय|आम|ஆம்|சரி|அవును|అవును|సరే|होय|হ্যাঁ|ঠিক|আচ্ছা)(\s|$|\.|,)/i,
  deny: /(^|\s)(nahi+n?|nahin|na\b|no\b|not|galat|mat\s*karo|नहीं|नही|ना\b|गलत|मत\s*करो|नको|नाही|चुकीचे|இல்லை|వేண்டாம்|కాదు|లేదు|না|ভুল|নয়)(\s|$|\.|,)/i,
  gratitude: /(dhanyavad|dhanyawad|shukriya|thank|thanks|थैंक|धन्यवाद|शुक्रिया|आभार|धन्यवाद्|நன்றி|ధన్యవాద|ধন্যবাদ)/i,
  greeting: /(namaste|namaskar|namaskaram|hello|hii+|नमस्ते|नमस्कार|प्रणाम|வணக்கம்|నమస్తే|নমস্কার)/i,
  distress: /(pareshani|pareshan|problem|takleef|dukhi|dikkat|bimaar|bimar|kaam\s*nahi|paisa\s*nahi|naukri\s*nahi|परेशान|तकलीफ|दिक्कत|मुश्किल|बीमार|दुखी|काम\s*नहीं|पैसा\s*नहीं|पैसे\s*नहीं|नौकरी\s*नहीं|கஷ்ட|சிரம|ఇబ్బంది|కష్టం|সমস্যা|কষ্ট)/i,
  stop: /(band\s*karo|rehne\s*do|chhod\s*do|chodo|abhi\s*nahi|baad\s*me|stop|बंद\s*करो|रहने\s*दो|छोड़\s*दो|अभी\s*नहीं|बाद\s*में|नको|वेண்டாம்|పర్వాలేదు|পরে)/i,
  question: /(\?|؟|kya\b|kaise\b|kaisey|kyun\b|kyon\b|kab\b|kahan\b|kitna\b|kitne\b|kaun\b|kaunsa\b|batao\b|bataiye\b|bata\s*do|मुझे\s*बताओ|बताइए|बताओ|क्या|कैसे|क्यों|क्यूँ|कब|कहाँ|कहां|कितना|कितने|कौन|कौनसा|என்ன|எப்படி|ஏன்|எப்போது|எங்கே|எத்தனை|యారు|ఏమి|ఎలా|ఎందుకు|ఎప్పుడు|ఎక్కడ|ఎంత|काय|कसे|कधी|कुठे|किती|कोण|কি|কীভাবে|কেন|কখন|কোথায়|কত)/i,
};

const Q_LEAD = /^\s*(kya|kaise|kyun|kyon|kab|kahan|kitna|kitne|kaun|kaunsa|batao|bataiye|can you|could you|would you|will you|what|how|why|when|where|which|who|क्या|कैसे|क्यों|कब|कहाँ|कहां|कितना|कौन|बताइए|बताओ|என்ன|எப்படி|ఏమి|ఎలా|काय|कसे|কি|কীভাবে)\b/i;

/** Classify what kind of turn this is (deterministic, language-agnostic-ish). */
export function detectIntent(text: string, stage: Stage): Intent {
  const t = (text ?? "").replace(RX.newline, " ").trim();
  if (!t) return "empty";
  if (/[a-zA-Z\u0900-\u0DFF\u0C00-\u0C7F\u0980-\u09FF0-9]/.test(t) === false) return "unclear";
  // A question is the strongest signal — but only when the turn really asks.
  const asksQuestion =
    /[?？]\s*$/.test(t) ||
    Q_LEAD.test(t) ||
    /(batao|bataiye|bata\s*do|bataye|बताओ|बताइए|बताइये|मुझे\s*बताओ|சொல்லுங்க|చెప్పండి|বলুন)/i.test(t);
  if (RX.unclear.test(t) && t.split(" ").length <= 8) return "unclear";
  if (RX.repeat.test(t) && t.split(" ").length <= 8) return "repeat";
  if (RX.stop.test(t) && t.split(" ").length <= 6) return "stop";
  if (asksQuestion) return "question";
  if (RX.gratitude.test(t) && t.split(" ").length <= 6) return "gratitude";
  if (RX.greeting.test(t) && t.split(" ").length <= 4) return "greeting";
  const problemDenied = /(koi\s*(dikkat|problem|pareshani|takleef)\s*nah|dikkat\s*nah|problem\s*nah|pareshani\s*nah|no\s*problem|koi\s*problem\s*nah|कोई\s*(दिक्कत|परेशानी|समस्या|तकलीफ)\s*नहीं|दिक्कत\s*नहीं|परेशानी\s*नहीं|समस्या\s*नहीं|कुछ\s*नहीं|पிரச்சனை\s*இல்லை|சிரமம்\s*இல்லை|ఇబ్బంది\s*లేదు|సమస్య\s*లేదు|সমস্যা\s*নেই)/i.test(t);
  if (RX.distress.test(t) && !problemDenied && stage !== "confirm" && t.split(" ").length >= 3) return "distress";
  if (stage === "confirm") {
    if (RX.affirm.test(t)) return "affirm";
    if (RX.deny.test(t)) return "deny";
  }
  // A bare "haan"/"nahi" outside the confirmation stage is not an answer —
  // it usually means "I did not catch that". Ask again instead of storing it.
  // (The physical-constraints question is the exception: it literally asks for
  // a "yes/no"-style answer, so those are handled as real answers above.)
  if (stage !== "physical" && t.split(/\s+/).length <= 2 && (RX.affirm.test(t) || RX.deny.test(t))) return "unclear";
  // answers with no useful content at all
  if (t.length < 2 || /^(hmm+|haan?|ok|okay|hmm|हम्म|अच्छा|ठीक|जी|mm+)$/i.test(t)) return "empty";
  return "answer";
}

// ────────────────────────────────────────────── question answering (topics)
type Topic =
  | "about_scheme" | "money" | "fees" | "what_next" | "privacy" | "identity"
  | "job" | "training" | "duration" | "documents" | "caste"
  | "age_limit" | "can_help" | "other";

const TOPIC_RX: [Topic, RegExp][] = [
  ["money", /(kitna\s*(paisa|paise|paisaa|rupee|rupaya)|paisa\s*(milega|milta|kitna)|kitna\s*mil|salary|tankha|wage|kamai|stipend|मुझे\s*कितना\s*पैसा|कितना\s*पैसा|कितने\s*पैसे|कितनी\s*रकम|पैसा\s*मिलेगा|वेतन|तनख्वाह|பணம்|సంపద|টাকা|কত\s*টাকা)/i],
  ["fees", /(free|fees?|paisa\s*lagega|kharcha|kharch|paisa\s*dena|paisa\s*dena\s*padega|muft|नि:शुल्क|फ्री|फीस|खर्च|पैसा\s*लगेगा|पैसे\s*लगेंगे|பணம்\s*கட்டணும்|ఖర్చు|ফি|ফ্রি)/i],
  ["training", /(training|sikhayenge|sikhaoge|sikhna|sikhaye|course|प्रशिक्षण|ट्रेनिंग|सिखाएंगे|सिखाओगे|சிகிச்சை|பயிற்சி|శిక్షణ|প্রশিক্ষণ)/i],
  ["job", /(naukri|job|kaam\s*(dila|milega|dega|milegi)|nokri|रोजगार|नौकरी|काम\s*दिला|काम\s*मिलेगा|வேலை|ఉద్యోగ|চাকরি|কাজ)/i],
  ["duration", /(kitna\s*(time|samay|din|mahine|der)|kitne\s*(din|mahine|saal)|how\s*long|कितना\s*समय|कितने\s*दिन|कितने\s*महीने|कितनी\s*देर|நேரம்|సమయం|সময়)/i],
  ["privacy", /(mera\s*(data|naam|jaankari|information)|kya\s*karoge|kis\s*kaam|kisko\s*denge|safe|गोपनीय|मेरा\s*डेटा|मेरी\s*जानकारी|क्या\s*करोगे|किस\s*काम|किसको\s*देंगे|मेरा\s*नाम\s*क्यों|தகவல்|సమాచారం|তথ্য)/i],
  ["identity", /(tum\s*kaun|aap\s*kaun|kaun\s*ho|kya\s*(ho\s*)?aap|robot|insaan|machine|aadmi\s*ho|तुम\s*कौन|आप\s*कौन|कौन\s*हो|रोबोट|इंसान|மனித|మనిషి|মানুষ|রোবট)/i],
  ["about_scheme", /(pm[\s-]?ajay|yojana|yojna|scheme|sarkar|government|sarkari|योजना|सरकार|स्कीम|திட்டம்|పథకం|প্রকল্প|স্কিম)/i],
  ["documents", /(kagaz|kaagaz|document|aadhaar|aadhar|proof|certificate|कागज़|कागज|दस्तावेज|आधार|प्रमाण|சான்று|పత్ర|কাগজ)/i],
  ["caste", /(jaati|jati|sc\b|st\b|anusuchit|dalit|जाति|अनुसूचित|दलित|ஜாதி|కులం|জাতি)/i],
  ["age_limit", /(umar|age|saal\s*ki|kitni\s*umar|उम्र|आयु|साल\s*की|वயது|వయస్సు|বয়স)/i],
  ["can_help", /(madad|help|sahayata|madat|मदद|सहायता|सहयोग|உதவி|సహాయం|সাহায্য)/i],
  ["what_next", /(ab\s*kya|aage\s*kya|next|phir\s*kya|uske\s*baad|आगे\s*क्या|अब\s*क्या|फिर\s*क्या|இனி|తరువాత|এরপর)/i],
];

const TOPIC_ANSWERS: Record<Topic, L6> = {
  about_scheme: {
    hi: "जी, यह PM-AJAY योजना का जीविकासेतु सहायक है — सरकार अनुसूचित जाति के परिवारों को हुनर प्रशिक्षण और रोज़गार से जोड़ती है।",
    en: "This is JeevikaSetu under the PM-AJAY scheme — the government connects Scheduled Caste families to skill training and jobs.",
    ta: "இது PM-AJAY திட்டத்தின் ஜீவிகாசேது — SC குடும்பங்களுக்கு திறன் பயிற்சியும் வேலையும் இணைக்கிறது.",
    te: "ఇది PM-AJAY పథకం కింద జీవికాసేతు — SC కుటుంబాలకు నైపుణ్య శిక్షణ, ఉద్యోగం కలిపేది.",
    mr: "हे PM-AJAY योजनेचे जीविकासेतू आहे — SC कुटुंबांना कौशल्य प्रशिक्षण आणि रोजगार जोडते.",
    bn: "এটি PM-AJAY প্রকল্পের জীবিকাসেতু — SC পরিবারকে দক্ষতা প্রশিক্ষণ ও কাজের সাথে জোড়ে।",
  },
  money: {
    hi: "ट्रेनिंग के बाद 8 हज़ार से 25 हज़ार रुपये महीना तक कमाई हो सकती है, और ट्रेनिंग के दिनों में योजना की आर्थिक मदद भी मिलती है।",
    en: "After training, income can be ₹8,000–₹25,000 a month, and the scheme also gives financial support during training.",
    ta: "பயிற்சிக்குப் பிறகு மாதம் ₹8,000–₹25,000 வரை வருமானம், பயிற்சி காலத்திலும் உதவித்தொகை உண்டு.",
    te: "శిక్షణ తర్వాత నెలకు ₹8,000–₹25,000 వరకు ఆదాయం, శిక్షణ సమయంలో ఆర్థిక సహాయం కూడా ఉంటుంది.",
    mr: "प्रशिक्षणानंतर महिन्याला ₹8,000–₹25,000 पर्यंत उत्पन्न, आणि प्रशिक्षण काळात आर्थिक मदतही मिळते.",
    bn: "প্রশিক্ষণের পর মাসে ₹8,000–₹25,000 পর্যন্ত আয়, প্রশিক্ষণের সময়েও আর্থিক সহায়তা মেলে।",
  },
  fees: {
    hi: "जी नहीं, आपको एक रुपया भी नहीं देना है। ट्रेनिंग, परीक्षा और सर्टिफिकेट — सब सरकार की तरफ़ से मुफ़्त है।",
    en: "No, you do not pay anything. Training, assessment and certificate are all free of cost.",
    ta: "இல்லை, நீங்கள் எதுவும் செலுத்த வேண்டாம். பயிற்சி, தேர்வு, சான்றிதழ் அனைத்தும் இலவசம்.",
    te: "లేదు, మీరు ఏమీ చెల్లించాల్సిన అవసరం లేదు. శిక్షణ, పరీక్ష, ధృవపత్రం అన్నీ ఉచితం.",
    mr: "नाही, तुम्हाला एक रुपयाही द्यावा लागत नाही. प्रशिक्षण, परीक्षा, प्रमाणपत्र सर्व मोफत आहे.",
    bn: "না, আপনাকে কোনো টাকা দিতে হবে না। প্রশিক্ষণ, পরীক্ষা, সার্টিফিকেট সব বিনামূল্যে।",
  },
  training: {
    hi: "जी, आपके हुनर के हिसाब से ट्रेनिंग दिलवाऊँगी — जैसे सिलाई, चमड़े का काम, बिजली, ड्राइविंग, कंप्यूटर या खेती। पास के केंद्र में ही।",
    en: "Yes, I will arrange training that matches your skills — tailoring, leather work, electrical, driving, computer or farming — at a centre near you.",
    ta: "உங்கள் திறனுக்கேற்ற பயிற்சி — தையல், தோல் வேலை, மின்சாரம், ஓட்டுநர், கணினி, விவசாயம் — அருகிலுள்ள மையத்தில்.",
    te: "మీ నైపుణ్యానికి తగిన శిక్షణ — టైలరింగ్, లెదర్ వర్క్, ఎలక్ట్రికల్, డ్రైవింగ్, కంప్యూటర్, వ్యవసాయం — దగ్గరి కేంద్రంలో.",
    mr: "तुमच्या कौशल्यानुसार प्रशिक्षण — शिवणकाम, चामडे, विज, ड्रायव्हिंग, संगणक किंवा शेती — जवळच्या केंद्रात.",
    bn: "আপনার দক্ষতা অনুযায়ী প্রশিক্ষণ — সেলাই, চামড়ার কাজ, বিদ্যুৎ, ড্রাইভিং, কম্পিউটার বা কৃষি — কাছের কেন্দ্রে।",
  },
  job: {
    hi: "जी हाँ, ट्रेनिंग और सर्टिफिकेट के बाद नौकरी या अपना धंधा — दोनों के रास्ते हैं, और योजना में टूलकिट व आर्थिक सहायता भी मिलती है।",
    en: "Yes — after training and certification you can take a job or start your own work, with toolkit and capital support from the scheme.",
    ta: "ஆம், பயிற்சிக்குப் பிறகு வேலை அல்லது சொந்தத் தொழில் — இரண்டுக்கும் வழி உள்ளது, கருவி உதவியும் கிடைக்கும்.",
    te: "అవును, శిక్షణ తర్వాత ఉద్యోగం లేదా సొంత వ్యాపారం — రెండు మార్గాలూ ఉన్నాయి.",
    mr: "हो, प्रशिक्षणानंतर नोकरी किंवा स्वतःचा धंदा — दोन्ही मार्ग आहेत.",
    bn: "হ্যাঁ, প্রশিক্ষণের পর চাকরি বা নিজের ব্যবসা — দুই পথই আছে।",
  },
  duration: {
    hi: "पूरी बातचीत बस पाँच मिनट की है। बाद में ट्रेनिंग कुछ हफ़्ते से कुछ महीने की हो सकती है।",
    en: "This conversation takes about five minutes. Training later may run from a few weeks to a few months.",
    ta: "இந்த உரையாடல் ஐந்து நிமிடம். பயிற்சி சில வாரங்கள் முதல் சில மாதங்கள் வரை.",
    te: "ఈ సంభాషణ సుమారు ఐదు నిమిషాలు. శిక్షణ కొన్ని వారాల నుండి కొన్ని నెలలు.",
    mr: "हा संवाद सुमारे पाच मिनिटांचा आहे. प्रशिक्षण काही आठवडे ते काही महिने.",
    bn: "এই কথাবার্তা পাঁচ মিনিটের। প্রশিক্ষণ কয়েক সপ্তাহ থেকে কয়েক মাস।",
  },
  privacy: {
    hi: "आपकी जानकारी सिर्फ़ आपके लिए योजना और ट्रेनिंग जोड़ने के लिए है — किसी और को नहीं दी जाती। जो ग़लत हो वो हम बाद में ठीक कर सकते हैं।",
    en: "Your details are used only to link you to the scheme and training — never shared with anyone else. Anything wrong can be corrected later.",
    ta: "உங்கள் தகவல் உங்களை திட்டம் மற்றும் பயிற்சியுடன் இணைக்க மட்டுமே — வேறு யாருக்கும் தரப்படாது.",
    te: "మీ వివరాలు మిమ్మల్ని పథకం, శిక్షణతో కలపడానికే — ఇతరులకు ఇవ్వబడవు.",
    mr: "तुमची माहिती फक्त योजना व प्रशिक्षणाशी जोडण्यासाठी वापरली जाते — इतरांना दिली जात नाही.",
    bn: "আপনার তথ্য শুধু প্রকল্প ও প্রশিক্ষণের সাথে যুক্ত করতে ব্যবহৃত হয় — অন্য কাউকে দেওয়া হয় না।",
  },
  identity: {
    hi: "मैं जीविकासेतु हूँ — PM-AJAY योजना की सहायक। मैं आपकी बात समझकर आपके लिए सही रास्ता ढूँढती हूँ।",
    en: "I am JeevikaSetu, the PM-AJAY scheme assistant. I listen to you and find the right pathway for you.",
    ta: "நான் ஜீவிகாசேது — PM-AJAY திட்ட உதவியாளர். உங்களுக்கு சரியான வழியைத் தேடுகிறேன்.",
    te: "నేను జీవికాసేతు — PM-AJAY పథకం సహాయకుడిని. మీకు సరైన మార్గం చూపిస్తాను.",
    mr: "मी जीविकासेतू — PM-AJAY योजनेची सहाय्यक. तुमच्यासाठी योग्य मार्ग शोधते.",
    bn: "আমি জীবিকাসেতু — PM-AJAY প্রকল্পের সহায়ক। আপনার জন্য সঠিক পথ খুঁজে দিই।",
  },
  documents: {
    hi: "बस आधार या जाति प्रमाणपत्र जैसा कोई एक सरकारी काग़ज़ चाहिए होता है — आगे के काम में हम पूरी मदद करेंगे।",
    en: "You only need one government paper such as Aadhaar or a caste certificate — we will help with the rest.",
    ta: "ஆதார் அல்லது சாதி சான்றிதழ் போன்ற ஒரு அரசு ஆவணம் போதும் — மீதியை நாங்கள் உதவுவோம்.",
    te: "ఆధార్ లేదా కుల ధృవపత్రం లాంటి ఒక ప్రభుత్వ పత్రం చాలు — మిగతా సహాయం చేస్తాం.",
    mr: "आधार किंवा जात प्रमाणपत्र अशा एका सरकारी कागदाची गरज असते — पुढील मदत आम्ही करू.",
    bn: "আধার বা জাতিগত শংসাপত্রের মতো একটি সরকারি কাগজই যথেষ্ট — বাকি সাহায্য আমরা করব।",
  },
  caste: {
    hi: "जी, PM-AJAY योजना अनुसूचित जाति समुदाय के लिए है — इसलिए आपकी बात हम ख़ास ध्यान से सुन रहे हैं।",
    en: "Yes, PM-AJAY is for Scheduled Caste families — that is why your answers matter to us.",
    ta: "ஆம், PM-AJAY திட்டம் SC சமூகத்திற்கானது — அதனால்தான் உங்கள் பதில் எங்களுக்கு முக்கியம்.",
    te: "అవును, PM-AJAY SC సమాజం కోసం — అందుకే మీ సమాధానాలు మాకు ముఖ్యం.",
    mr: "हो, PM-AJAY अनुसूचित जाती समाजासाठी आहे — म्हणूनच तुमचे उत्तर महत्त्वाचे आहे.",
    bn: "হ্যাঁ, PM-AJAY তফসিলি জাতি সমাজের জন্য — তাই আপনার উত্তর গুরুত্বপূর্ণ।",
  },
  age_limit: {
    hi: "आम तौर पर 18 से 45 साल तक की उम्र में योजना मिलती है — अपनी उम्र बताइए, मैं देख लूँगी।",
    en: "Generally the scheme covers ages 18 to 45 — tell me your age and I will check for you.",
    ta: "பொதுவாக 18 முதல் 45 வயது வரை — உங்கள் வயதைச் சொல்லுங்கள், நான் பார்க்கிறேன்.",
    te: "సాధారణంగా 18 నుండి 45 సంవత్సరాల వరకు — మీ వయసు చెప్పండి, చూస్తాను.",
    mr: "सामान्यतः 18 ते 45 वयापर्यंत — तुमचे वय सांगा, मी पाहते.",
    bn: "সাধারণত 18 থেকে 45 বছর পর্যন্ত — আপনার বয়স বলুন, আমি দেখি।",
  },
  can_help: {
    hi: "जी बिलकुल! मैं आपके हुनर के हिसाब से ट्रेनिंग, सर्टिफिकेट और काम का रास्ता निकालने में पूरी मदद करूँगी।",
    en: "Of course! I will help you find training, certification and work that fits your skills.",
    ta: "நிச்சயமாக! உங்கள் திறனுக்கேற்ற பயிற்சியும் வேலையும் கண்டறிய உதவுகிறேன்.",
    te: "తప్పకుండా! మీ నైపుణ్యానికి తగిన శిక్షణ, పని కనుగొనడంలో సహాయం చేస్తాను.",
    mr: "अगदी! तुमच्या कौशल्यानुसार प्रशिक्षण व काम शोधण्यात मदत करेन.",
    bn: "অবশ্যই! আপনার দক্ষতা অনুযায়ী প্রশিক্ষণ ও কাজ খুঁজতে সাহায্য করব।",
  },
  what_next: {
    hi: "अभी हम आपकी बात पूरी सुन लेते हैं, फिर मैं आपके लिए ट्रेनिंग और काम के रास्ते दिखाऊँगी।",
    en: "Let me finish listening to you first, then I will show you the training and work pathways.",
    ta: "முதலில் உங்கள் பதில்களைக் கேட்கிறேன், பிறகு பயிற்சி வழிகளைக் காட்டுகிறேன்.",
    te: "ముందు మీ మాటలు విని, తర్వాత శిక్షణ మార్గాలు చూపిస్తాను.",
    mr: "आधी तुमचे ऐकून घेतो, मग प्रशिक्षणाचे मार्ग दाखवते.",
    bn: "আগে আপনার কথা শুনি, তারপর প্রশিক্ষণের পথ দেখাই।",
  },
  other: {
    hi: "जी, मैं समझ गई।",
    en: "Yes, I understand.",
    ta: "ஆம், புரிந்தது.",
    te: "అవును, అర్థమైంది.",
    mr: "हो, समजले.",
    bn: "হ্যাঁ, বুঝেছি।",
  },
};

/** Answer a beneficiary question on-topic. Returns null when it is not a question. */
export function answerQuestion(text: string, lang: LangCode): string | null {
  const t = (text ?? "").replace(RX.newline, " ").trim();
  if (!t) return null;
  for (const [topic, rx] of TOPIC_RX) if (rx.test(t)) return L(lang, TOPIC_ANSWERS[topic]);
  if (/\?|؟/.test(t) || Q_LEAD.test(t)) return L(lang, TOPIC_ANSWERS.other);
  return null;
}

// ─────────────────────────────────────────────────────────── warm fillers
const GREETING: L6 = {
  hi: "नमस्ते! मैं जीविका सेतु हूँ, PM-AJAY योजना की सहायक। आपसे बस पाँच मिनट बात करनी है, कोई फॉर्म नहीं भरना — बस बोलते जाइए।",
  en: "Namaste! I am JeevikaSetu from the PM-AJAY scheme. This will take about five minutes and there is no form to fill — just speak to me.",
  ta: "வணக்கம்! நான் ஜீவிகாசேது, PM-AJAY திட்ட உதவியாளர். ஐந்து நிமிடம் மட்டும் — எந்த படிவமும் இல்லை, பேசினால் போதும்.",
  te: "నమస్తే! నేను జీవికాసేతు, PM-AJAY పథకం సహాయకుడిని. ఐదు నిమిషాలే — ఫారం లేదు, మాట్లాడితే చాలు.",
  mr: "नमस्ते! मी जीविकासेतू, PM-AJAY योजनेची सहाय्यक. फक्त पाच मिनिटे — कोणताही फॉर्म नाही, बोलत राहा.",
  bn: "নমস্কার! আমি জীবিকাসেতু, PM-AJAY প্রকল্পের সহায়ক। মাত্র পাঁচ মিনিট — কোনো ফর্ম নেই, শুধু বলুন।",
};

const REPEAT_LINE: L6 = {
  hi: "जी, फिर से सुनाइए — नहीं, मैं फिर से बोलती हूँ। ध्यान से सुनिए।",
  en: "Of course, let me say it again — listen carefully.",
  ta: "சரி, மீண்டும் சொல்கிறேன் — கவனமாக கேளுங்கள்.",
  te: "సరే, మళ్లీ చెప్తాను — జాగ్రత్తగా వినండి.",
  mr: "हो, पुन्हा सांगते — लक्ष देऊन ऐका.",
  bn: "ঠিক আছে, আবার বলছি — মন দিয়ে শুনুন।",
};

const UNCLEAR_LINE: L6 = {
  hi: "कोई बात नहीं, मैं आसान शब्दों में पूछती हूँ।",
  en: "No problem, let me ask in simpler words.",
  ta: "பரவாயில்லை, எளிய வார்த்தையில் கேட்கிறேன்.",
  te: "పర్వాలేదు, సులభంగా అడుగుతాను.",
  mr: "काही हरकत नाही, सोप्या शब्दात विचारते.",
  bn: "কোনো সমস্যা নেই, সহজ ভাষায় জিজ্ঞাসা করি।",
};

const DISTRESS_LINE: L6 = {
  hi: "मैं समझ सकती हूँ, यह समय कठिन होता है। घबराइए मत — मैं आपके लिए रास्ता निकालने के लिए ही हूँ।",
  en: "I understand — this is a hard time. Don't worry, I am here exactly to find you a way forward.",
  ta: "எனக்கு புரிகிறது, இது கடினமான நேரம். கவலை வேண்டாம் — வழி தேடவே நான் இருக்கிறேன்.",
  te: "నాకు అర్థమవుతోంది, ఇది కష్టమైన సమయం. ఆందోళన పడకండి — మార్గం చూపడానికే నేను ఉన్నాను.",
  mr: "मला समजते, ही कठीण वेळ आहे. काळजी करू नका — मार्ग शोधण्यासाठीच मी आहे.",
  bn: "আমি বুঝি, এটা কঠিন সময়। চিন্তা করবেন না — পথ খুঁজতেই আমি আছি।",
};

const THANKS_LINE: L6 = {
  hi: "आपका बहुत-बहुत धन्यवाद!",
  en: "Thank you very much!",
  ta: "மிக்க நன்றி!",
  te: "చాలా ధన్యవాదాలు!",
  mr: "खूप धन्यवाद!",
  bn: "অনেক ধন্যবাদ!",
};

const STOP_LINE: L6 = {
  hi: "कोई बात नहीं, मैं यहीं रुकती हूँ। जब आप चाहें फिर बात कर सकते हैं — आपका समय दिया, धन्यवाद।",
  en: "No problem, I will stop here. You can talk to me again whenever you wish — thank you for your time.",
  ta: "பரவாயில்லை, இங்கே நிறுத்துகிறேன். எப்போது வேண்டுமானாலும் மீண்டும் பேசலாம் — நன்றி.",
  te: "పర్వాలేదు, ఇక్కడ ఆపుతాను. ఎప్పుడైనా మళ్లీ మాట్లాడవచ్చు — ధన్యవాదాలు.",
  mr: "काही हरकत नाही, मी इथे थांबते. केव्हाही पुन्हा बोलू शकता — धन्यवाद.",
  bn: "কোনো সমস্যা নেই, এখানেই থামছি। যখন চান আবার কথা বলতে পারেন — ধন্যবাদ।",
};

/** Addressed form: "रमेश जी" / "Ramesh ji" / "ரமேஷ் அவர்களே". */
export function addressed(lang: LangCode, name?: string): string {
  if (!name) return "";
  const first = name.trim().split(/\s+/)[0];
  if (!first || first.length > 20) return "";
  switch (lang) {
    case "hi":
    case "mr": return `${first} जी`;
    case "bn": return `${first} মহাশয়`;
    case "ta": return `${first} அவர்களே`;
    case "te": return `${first} గారు`;
    default: return `${first} ji`;
  }
}

// ─────────────────────────────────────── opportunistic multi-slot extraction
/**
 * Pull whatever is confidently recognisable out of ANY utterance, whatever the
 * current stage. This is what makes the agent feel like it is really listening:
 * a beneficiary who mentions their village while answering a different question
 * still gets that village recorded.
 */
export function harvestSlots(slots: SlotState, text: string, lang: LangCode): SlotState {
  const s: SlotState = { ...slots };
  const t = text.trim();
  if (!t) return s;

  const place = matchPlace(t);
  if (place) {
    s.place = s.place ?? t;
    s.district = place.district; s.state = place.state; s.lat = place.lat; s.lng = place.lng;
  }
  const village = extractVillage(t);
  if (village && !s.village) s.village = village;

  const age = parseAge(t);
  if (age && !s.age) s.age = age;

  const skills = scanSkills(t);
  if (skills.length) {
    // skills mentioned while describing work belong to work, not interests
    if (!s.currentSkills?.length) s.currentSkills = skills;
    else s.currentSkills = [...new Set([...s.currentSkills, ...skills])];
  }
  if (!s.languages) s.languages = [LANG_NAME[lang] ?? "Hindi"];
  return s;
}

/** Extract slot value(s) from the user's answer for the given stage. */
export function applyAnswer(slots: SlotState, stage: Stage, text: string, lang: LangCode): SlotState {
  const s: SlotState = { ...slots };
  switch (stage) {
    case "name": {
      s.name = looksLikeName(text) ? cleanName(text) : text.trim().split(/\s+/).slice(0, 3).join(" ");
      const age = parseAge(text);
      if (age) s.age = age;
      break;
    }
    case "location": {
      const p = matchPlace(text);
      const v = extractVillage(text);
      if (v) s.village = v;
      if (p) {
        s.district = p.district; s.state = p.state; s.lat = p.lat; s.lng = p.lng;
        // a clean "village, district, state" string for display / summary
        s.place = [s.village, p.district, p.state].filter(Boolean).join(", ");
      } else {
        s.place = text.trim();
      }
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
      const family = /(family|traditional|father|parents|परिवार|पारंपरिक|पिता|घर का|परम्परा|पुरखों|बाप-दादा|कुटुंब|சம்பிரதாய|குடும்ப|కుటుంబ|সনাতন|পরিবার|পारंपारिक)/i.test(text);
      s.work_independence = family ? "family_business" : "independent";
      // People usually name the family craft in this very sentence — keep it.
      const famSkills = scanSkills(text);
      if (famSkills.length) {
        s.familySkills = [...new Set([...(s.familySkills ?? []), ...famSkills])];
        if (!s.familyOccupation) s.familyOccupation = text.trim();
      }
      break;
    }
    case "current_livelihood": {
      const skills = scanSkills(text);
      const marker = /(abhi|ab\b|aajkal|in\s*din|currently|right\s*now|अभी|अब\s|आजकल|इन\s*दिनों|सध्या|இப்போது|ప్రస్తుతం|এখন|কিন্তু|ஆனால்)/i;
      const mt = text.match(marker);
      if (s.work_independence === "family_business" && mt?.index !== undefined) {
        // "our family does leather work, but right now I do daily labour" —
        // keep BOTH facts instead of overwriting the family craft.
        const before = text.slice(0, mt.index).trim().replace(/[,;—–-]\s*$/, "");
        const after = text.slice(mt.index).trim();
        if (before) s.familyOccupation = before;
        s.currentLivelihood = after.replace(/^(abhi|ab|aajkal|in\s*din|currently|अभी|अब|आजकल|इन\s*दिनों)[,\s]+/i, "").trim() || after;
        s.currentSkills = [...new Set([...(s.currentSkills ?? []), ...skills])];
        s.familySkills = [...new Set([...(s.familySkills ?? []), ...skills])];
      } else if (s.work_independence === "family_business") {
        s.familyOccupation = text.trim();
        s.familySkills = [...new Set([...(s.familySkills ?? []), ...skills])];
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
      s.interestNote = text.trim().slice(0, 48);
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
  return harvestSlots(s, text, lang);
}

const YES_RE = /(haan|haanji|han|yes|sahi|theek|thik|bilkul|zaroor|ठीक|हाँ|हां|हो|होय|ஆம்|சரி|అవును|సరే|সঠিক|হ্যাঁ|ঠিক)/i;
const NO_RE = /(nahi|nahin|galat|wrong|no\b|नहीं|नही|गलत|बदल|இல்லை|వేண்டாம்|తప్పు|नाही|चुकीचे|না|ভুল|নয়)/i;


/** How each schooling level is SPOKEN (the stored label stays canonical). */
const EDU_SPEECH: Record<LangCode, string[]> = {
  hi: ["पढ़े-लिखे नहीं", "पाँचवीं पास", "आठवीं पास", "दसवीं पास", "बारहवीं पास", "आईटीआई या डिप्लोमा", "ग्रेजुएट"],
  en: ["no formal schooling", "5th pass", "8th pass", "10th pass", "12th pass", "ITI / diploma", "graduate"],
  ta: ["படிக்கவில்லை", "ஐந்தாம் வகுப்பு", "எட்டாம் வகுப்பு", "பத்தாம் வகுப்பு", "பன்னிரண்டாம் வகுப்பு", "ஐடிஐ அல்லது டிப்ளமோ", "பட்டதாரி"],
  te: ["చదవలేదు", "ఐదవ తరగతి", "ఎనిమిదవ తరగతి", "పదవ తరగతి", "పన్నెండవ తరగతి", "ఐటీఐ లేదా డిప్లొమా", "పట్టభద్రుడు"],
  mr: ["शिकले नाही", "पाचवी पास", "आठवी पास", "दहावी पास", "बारावी पास", "आयटीआय किंवा डिप्लोमा", "पदवीधर"],
  bn: ["পড়াশোনা করেননি", "পঞ্চম শ্রেণি পাস", "অষ্টম শ্রেণি পাস", "দশম শ্রেণি পাস", "দ্বাদশ শ্রেণি পাস", "আইটিআই বা ডিপ্লোমা", "স্নাতক"],
};
const eduSpeech = (s: SlotState, lang: LangCode): string => {
  const rank = s.educationRank;
  if (rank === undefined || !s.education) return s.education ?? "";
  return EDU_SPEECH[lang]?.[rank] ?? EDU_SPEECH.en[rank] ?? s.education;
};

export interface StepResult {
  reply: string;
  slots: SlotState;
  stage: Stage;
  done: boolean;
  /** what kind of turn we just handled (useful for the UI) */
  intent?: Intent;
  /** true when the agent is re-asking the same question (no progress yet) */
  retry?: boolean;
}

/** Human, echo-y acknowledgement of the value we just captured. */
function echoAck(stage: Stage, s: SlotState, lang: LangCode, name: string): string {
  switch (stage) {
    case "name":
      return name ? L(lang, {
        hi: `${name} — बहुत अच्छा नाम है।`,
        en: `${name} — that's a lovely name.`,
        ta: `${name} — அருமையான பெயர்.`,
        te: `${name} — మంచి పేరు.`,
        mr: `${name} — छान नाव.`,
        bn: `${name} — সুন্দর নাম।`,
      }) : "";
    case "location":
      return s.district ? L(lang, {
        hi: `${s.district}${s.state ? `, ${s.state}` : ""} — समझ गई।`,
        en: `${s.district}${s.state ? `, ${s.state}` : ""} — got it.`,
        ta: `${s.district} — புரிந்தது.`,
        te: `${s.district} — అర్థమైంది.`,
        mr: `${s.district} — समजले.`,
        bn: `${s.district} — বুঝেছি।`,
      }) : "";
    case "education":
      return s.education ? L(lang, {
        hi: `${eduSpeech(s, lang)} तक पढ़ाई — ठीक है।`,
        en: `${eduSpeech(s, lang)} — alright.`,
        ta: `${eduSpeech(s, lang)} வரை படித்திருக்கிறீர்கள் — சரி.`,
        te: `${eduSpeech(s, lang)} వరకు చదివారు — సరే.`,
        mr: `${eduSpeech(s, lang)} पर्यंत शिक्षण — ठीक.`,
        bn: `${eduSpeech(s, lang)} পর্যন্ত পড়াশোনা — ঠিক আছে।`,
      }) : "";
    case "current_livelihood": {
      const work = s.familyOccupation ?? s.currentLivelihood;
      const skill = (s.familySkills?.length ? s.familySkills : s.currentSkills ?? [])[0];
      // Hindi/Marathi have curated labels; for ta/te/bn we mirror the
      // beneficiary's own words so no English is mixed into the sentence.
      const label = skill
        ? (lang === "hi" || lang === "mr"
          ? SKILL_MAP.get(skill)?.hi ?? ""
          : (work && work.length <= 40 ? work : ""))
        : "";
      if (label) {
        return L(lang, {
          hi: `${label} — यह तो बहुत अच्छा हुनर है।`,
          en: `${label} — that is a real skill.`,
          ta: `${label} — இது நல்ல திறமை.`,
          te: `${label} — ఇది మంచి నైపుణ్యం.`,
          mr: `${label} — हे उत्तम कौशल्य आहे.`,
          bn: `${label} — এটি ভালো দক্ষতা।`,
        });
      }
      return work ? L(lang, {
        hi: "समझ गई, आपका काम नोट कर लिया।",
        en: "Got it, I've noted your work.",
        ta: "புரிந்தது, பதிவு செய்தேன்.",
        te: "అర్థమైంది, నమోదు చేశాను.",
        mr: "समजले, नोंद करून घेतले.",
        bn: "বুঝেছি, লিখে নিলাম।",
      }) : "";
    }
    case "interests": {
      const any = (lang === "hi" || lang === "mr")
        ? s.interestLabels?.[0]
        : (s.interestNote && s.interestNote.length <= 44 ? s.interestNote : undefined);
      return any ? L(lang, {
        hi: `${any} में रुचि — बहुत बढ़िया।`,
        en: `Interest in ${any} — wonderful.`,
        ta: `${any} ஆர்வம் — அருமை.`,
        te: `${any} ఆసక్తి — బాగుంది.`,
        mr: `${any} मध्ये रुची — छान.`,
        bn: `${any}-তে আগ্রহ — দারুণ।`,
      }) : "";
    }
    case "employment":
      return s.preference === "self"
        ? L(lang, { hi: "अपना काम — हिम्मत की बात है।", en: "Your own work — that's brave.", ta: "சொந்தத் தொழில் — நல்லது.", te: "సొంత పని — మంచిది.", mr: "स्वतःचा धंदा — छान.", bn: "নিজের কাজ — ভালো।" })
        : s.preference === "wage"
          ? L(lang, { hi: "नौकरी — ठीक है।", en: "A job — alright.", ta: "வேலை — சரி.", te: "ఉద్యోగం — సరే.", mr: "नोकरी — ठीक.", bn: "চাকরি — ঠিক।" })
          : "";
    case "mobility":
      return s.mobilityKm
        ? L(lang, {
          hi: `करीब ${s.mobilityKm} किलोमीटर तक — ठीक है।`,
          en: `About ${s.mobilityKm} km — okay.`,
          ta: `சுமார் ${s.mobilityKm} கி.மீ — சரி.`,
          te: `సుమారు ${s.mobilityKm} కి.మీ — సరే.`,
          mr: `सुमारे ${s.mobilityKm} किमी — ठीक.`,
          bn: `প্রায় ${s.mobilityKm} কিমি — ঠিক।`,
        })
        : "";
    case "physical":
      return s.constraints && s.constraints !== "None"
        ? L(lang, {
          hi: "जी, मैं ध्यान रखूँगी और ऐसा काम सुझाऊँगी जो आपके लिए ठीक रहे।",
          en: "I'll keep that in mind and suggest work that suits you.",
          ta: "நான் கவனத்தில் வைத்து பொருத்தமான வேலை பரிந்துரைக்கிறேன்.",
          te: "గుర్తుంచుకొని మీకు తగిన పని సూచిస్తాను.",
          mr: "मी लक्षात ठेवेल आणि योग्य काम सुचवेन.",
          bn: "মনে রাখব এবং উপযুক্ত কাজ Suggest করব।",
        })
        : L(lang, { hi: "ठीक है, कोई दिक्कत नहीं।", en: "Alright, no problem.", ta: "சரி, பிரச்சினை இல்லை.", te: "సరే, ఇబ్బంది లేదు.", mr: "ठीक आहे, अडचण नाही.", bn: "ঠিক আছে, কোনো সমস্যা নেই।" });
    default:
      return "";
  }
}

/** A short spoken recap of only the details actually collected. */
export function buildSummary(s: SlotState, lang: LangCode): string {
  const name = s.name ?? "";
  const loc = s.district ? `${s.village ? s.village + ", " : ""}${s.district}` : (s.place ?? "");
  const work = s.familyOccupation ?? s.currentLivelihood ?? "";
  const skillIds = [...new Set([...(s.familySkills ?? []), ...(s.currentSkills ?? [])])];
  const useLabels = lang === "hi" || lang === "en" || lang === "mr";
  const skills = useLabels
    ? skillIds.slice(0, 3).map((id) => SKILL_MAP.get(id)?.[lang === "hi" || lang === "mr" ? "hi" : "en"] ?? id).join(", ")
    : (work.length > 0 && work.length <= 60 ? work : "");
  // do not repeat the same words twice in one sentence
  const skillsLine = skills.trim() && skills.trim() !== work.trim() ? skills : "";
  const interests = useLabels
    ? (s.interestLabels ?? []).slice(0, 3).join(", ")
    : (s.interestNote ?? "");
  const pref = s.preference === "self"
    ? L(lang, { hi: "अपना काम", en: "own work", ta: "சொந்தத் தொழில்", te: "సొంత పని", mr: "स्वतःचा धंदा", bn: "নিজের কাজ" })
    : s.preference === "wage"
      ? L(lang, { hi: "नौकरी", en: "a job", ta: "வேலை", te: "ఉద్యోగం", mr: "नोकरी", bn: "চাকরি" })
      : "";
  const km = s.mobilityKm ?? 0;
  const who = addressed(lang, name) || L(lang, { hi: "जी", en: "", ta: "", te: "", mr: "", bn: "" });

  switch (lang) {
    case "hi":
      return `तो ${who}${who ? " " : ""}मैंने यह समझा — ${[
        name ? `आपका नाम ${name}` : "",
        loc ? `आप ${loc} से हैं` : "",
        s.education ? `पढ़ाई ${eduSpeech(s, lang)}` : "",
        work ? `आपका काम: ${work}` : "",
        skillsLine ? `आपके हुनर: ${skillsLine}` : "",
        interests ? `आपकी रुचि: ${interests}` : "",
        pref ? `आप ${pref} चाहते हैं` : "",
        km ? `ट्रेनिंग के लिए ${km} किलोमीटर तक जा सकते हैं` : "",
      ].filter(Boolean).join(", ")}।`;
    case "mr":
      return `तर ${who}${who ? " " : ""}मला हे समजले — ${[
        name ? `तुमचे नाव ${name}` : "",
        loc ? `तुम्ही ${loc} येथे राहता` : "",
        s.education ? `शिक्षण ${eduSpeech(s, lang)}` : "",
        work ? `तुमचे काम: ${work}` : "",
        skillsLine ? `तुमची कौशल्ये: ${skillsLine}` : "",
        interests ? `आवड: ${interests}` : "",
        pref ? `तुम्हाला ${pref} हवे` : "",
        km ? `प्रशिक्षणासाठी ${km} किमी पर्यंत जाऊ शकता` : "",
      ].filter(Boolean).join(", ")}.`;
    case "bn":
      return `তাহলে ${who}${who ? " " : ""}আমি যা বুঝলাম — ${[
        name ? `আপনার নাম ${name}` : "",
        loc ? `আপনি ${loc}-এ থাকেন` : "",
        s.education ? `শিক্ষা ${eduSpeech(s, lang)}` : "",
        work ? `আপনার কাজ: ${work}` : "",
        skillsLine ? `আপনার দক্ষতা: ${skillsLine}` : "",
        interests ? `আগ্রহ: ${interests}` : "",
        pref ? `আপনি ${pref} চান` : "",
        km ? `প্রশিক্ষণের জন্য ${km} কিমি যেতে পারেন` : "",
      ].filter(Boolean).join(", ")}।`;
    case "ta":
      return `எனவே ${who}${who ? " " : ""}நான் புரிந்துகொண்டது — ${[
        name ? `உங்கள் பெயர் ${name}` : "",
        loc ? `நீங்கள் ${loc} இல் வசிக்கிறீர்கள்` : "",
        s.education ? `கல்வி ${eduSpeech(s, lang)}` : "",
        work ? `உங்கள் வேலை: ${work}` : "",
        skillsLine ? `உங்கள் திறன்கள்: ${skillsLine}` : "",
        interests ? `ஆர்வம்: ${interests}` : "",
        pref ? `நீங்கள் ${pref} விரும்புகிறீர்கள்` : "",
        km ? `பயிற்சிக்கு ${km} கி.மீ. வரை செல்லலாம்` : "",
      ].filter(Boolean).join(", ")}.`;
    case "te":
      return `కాబట్టి ${who}${who ? " " : ""}నేను అర్థం చేసుకున్నది — ${[
        name ? `మీ పేరు ${name}` : "",
        loc ? `మీరు ${loc} లో ఉంటారు` : "",
        s.education ? `విద్య ${eduSpeech(s, lang)}` : "",
        work ? `మీ పని: ${work}` : "",
        skillsLine ? `మీ నైపుణ్యాలు: ${skillsLine}` : "",
        interests ? `ఆసక్తులు: ${interests}` : "",
        pref ? `మీరు ${pref} కోరుకుంటున్నారు` : "",
        km ? `శిక్షణ కోసం ${km} కి.మీ. వరకు వెళ్లగలరు` : "",
      ].filter(Boolean).join(", ")}.`;
    default:
      return `So ${who}${who ? " " : ""}here is what I understood — ${[
        name ? `your name is ${name}` : "",
        loc ? `you live in ${loc}` : "",
        s.education ? `education: ${eduSpeech(s, lang)}` : "",
        work ? `your work: ${work}` : "",
        skillsLine ? `your skills: ${skillsLine}` : "",
        interests ? `your interests: ${interests}` : "",
        pref ? `you prefer ${pref}` : "",
        km ? `you can travel about ${km} km for training` : "",
      ].filter(Boolean).join(", ")}.`;
  }
}

/** One question, in the requested language, for the given stage. */
export function questionFor(stage: Stage, lang: LangCode): string {
  if (stage === "done") return L(lang, DONE_TEXT);
  const q = QUESTIONS[stage as Exclude<Stage, "done">];
  return q?.[lang] ?? q?.en ?? "";
}

/** One deterministic step of the interview (used when LLM is unavailable). */
export function fallbackStep(slots: SlotState, stage: Stage, userText: string, lang: LangCode): StepResult {
  const text = (userText ?? "").trim();
  const intent = detectIntent(text, stage);
  const seed = (slots.name?.length ?? 0) + stage.length + text.length;

  // ── 1. the beneficiary asked us something → answer, then re-ask ours
  if (intent === "question") {
    const answer = answerQuestion(text, lang);
    const current = currentQuestion(slots, stage, lang);
    const prefix = answer ?? L(lang, TOPIC_ANSWERS.other);
    // If the same sentence also carries a real answer, don't lose it.
    const carriesAnswer = stage !== "confirm" && stage !== "done" && hasConfidentStageValue(stage, text);
    if (carriesAnswer) {
      const stepped = advance(slots, stage, text, lang, seed);
      return { ...stepped, intent, reply: `${prefix} ${stepped.reply}` };
    }
    return { reply: `${prefix} ${current}`, slots, stage, done: false, intent, retry: true };
  }

  if (intent === "repeat" || intent === "unclear") {
    const line = intent === "repeat" ? L(lang, REPEAT_LINE) : L(lang, UNCLEAR_LINE);
    return {
      reply: `${line} ${currentQuestion(slots, stage, lang)}`,
      slots, stage, done: false, intent, retry: true,
    };
  }

  if (intent === "distress") {
    return {
      reply: `${L(lang, DISTRESS_LINE)} ${currentQuestion(slots, stage, lang)}`,
      slots, stage, done: false, intent, retry: true,
    };
  }

  if (intent === "gratitude") {
    return {
      reply: `${L(lang, THANKS_LINE)} ${currentQuestion(slots, stage, lang)}`,
      slots, stage, done: false, intent, retry: true,
    };
  }

  if (intent === "stop") {
    return { reply: L(lang, STOP_LINE), slots, stage: "done", done: true, intent };
  }

  if (intent === "greeting") {
    return {
      reply: `${L(lang, GREETING)} ${currentQuestion(slots, stage, lang)}`,
      slots, stage, done: false, intent, retry: true,
    };
  }

  // ── 2. nothing usable → gently re-ask (max twice, then move on kindly)
  if (intent === "empty") {
    const tries = (slots.asked_stage === stage ? slots.asked_count ?? 0 : 0) + 1;
    const withTry: SlotState = { ...slots, asked_stage: stage, asked_count: tries };
    if (tries >= 3) {
      // gracefully move past a stage the beneficiary cannot answer
      const stepped = advance({ ...withTry, asked_count: 0 }, stage, "", lang, seed);
      return { ...stepped, intent, reply: `${L(lang, MOVING_ON)} ${stepped.reply}` };
    }
    return {
      reply: `${L(lang, NOTHING_HEARD)} ${currentQuestion(withTry, stage, lang)}`,
      slots: withTry, stage, done: false, intent, retry: true,
    };
  }

  // ── 3. physical constraints: "haan" means "yes, I do have a difficulty"
  if (stage === "physical" && isBareAffirm(text)) {
    return {
      reply: L(lang, PHYSICAL_DETAIL),
      slots: { ...slots, asked_stage: stage, asked_count: 0 },
      stage, done: false, intent, retry: true,
    };
  }

  // ── 4. real answer → acknowledge, store, advance
  return { ...advance(slots, stage, text, lang, seed), intent };
}

const PHYSICAL_DETAIL: L6 = {
  hi: "जी बताइए, कैसी दिक्कत है? ज़रा बता दीजिए ताकि मैं वैसा ही काम सुझाऊँ।",
  en: "Alright, tell me what the difficulty is — I will suggest work that suits you.",
  ta: "சரி, என்ன சிரமம் என்று சொல்லுங்கள் — அதற்கேற்ற வேலை பரிந்துரைக்கிறேன்.",
  te: "సరే, ఏ ఇబ్బంది ఉందో చెప్పండి — దానికి తగిన పని సూచిస్తాను.",
  mr: "सांगा, अडचण काय आहे? त्यानुसार योग्य काम सुचवेन.",
  bn: "বলুন, কী সমস্যা? সেই অনুযায়ী কাজ Suggest করব।",
};

const NOTHING_HEARD: L6 = {
  hi: "जी, मैं सुन नहीं पाई। ज़रा फिर से बोलिए।",
  en: "Sorry, I could not hear that. Please say it once more.",
  ta: "மன்னிக்கவும், கேட்கவில்லை. மீண்டும் சொல்லுங்கள்.",
  te: "క్షమించండి, వినిపించలేదు. మళ్లీ చెప్పండి.",
  mr: "माफ करा, ऐकू आले नाही. पुन्हा सांगा.",
  bn: "দুঃখিত, শুনতে পাইনি। আবার বলুন।",
};

const MOVING_ON: L6 = {
  hi: "कोई बात नहीं, इसे छोड़कर आगे बढ़ते हैं।",
  en: "That's alright, let's move on.",
  ta: "பரவாயில்லை, அடுத்ததற்கு செல்வோம்.",
  te: "పర్వాలేదు, ముందుకు వెళ్దాం.",
  mr: "काही हरकत नाही, पुढे जाऊ.",
  bn: "ঠিক আছে, এগিয়ে যাই।",
};

/** The question the agent is currently waiting on. */
export function currentQuestion(slots: SlotState, stage: Stage, lang: LangCode): string {
  if (stage === "confirm") {
    const s = buildSummary(slots, lang);
    const q = QUESTIONS.confirm[lang] ?? QUESTIONS.confirm.en;
    return `${s} ${q}`;
  }
  if (stage === "done") return L(lang, DONE_TEXT);
  return QUESTIONS[stage as Exclude<Stage, "done">]?.[lang] ?? QUESTIONS[stage as Exclude<Stage, "done">]?.en ?? "";
}

const QUESTION_WORDS = /(kya\b|kaise|kyun|kyon|kab\b|kahan|kitna|kitne|kitni|kaun|kaunsa|batao|bataiye|क्या|कैसे|क्यों|कब|कहाँ|कहां|कितना|कितने|कितनी|कौन|कौनसा|बताओ|बताइए|என்ன|எப்படி|ஏன்|ఏమి|ఎలా|ఎందుకు|काय|कसे|किती|कोण|কি|কীভাবে|কত)/i;

/** A believable personal name (rejects "kitna paisa milega" style sentences). */
function looksLikeName(t: string): boolean {
  const clean = t.replace(/[?.,!|।]/g, " ").trim();
  if (!clean || /\d/.test(clean)) return false;
  if (QUESTION_WORDS.test(clean)) return false;
  const toks = clean
    .split(/\s+/)
    .filter((x) => x && !/^(mera|meri|my|name|naam|is|hai|hoon|hun|main|mai|ji|मेरा|मेरी|नाम|है|हूँ|हूं|मैं|मै|जी|నేను|பெயர்)$/i.test(x));
  return toks.length >= 1 && toks.length <= 3;
}

/**
 * Conservative version used when one sentence both asks us a question AND may
 * contain a real answer. We only keep the answer when the signal is unmistakable,
 * so a question can never be stored as somebody's name or village.
 */
export function hasConfidentStageValue(stage: Stage, text: string): boolean {
  const t = text.trim();
  if (!t || QUESTION_WORDS.test(t)) return false;
  switch (stage) {
    case "name": return looksLikeName(t);
    case "location": return Boolean(matchPlace(t) || extractVillage(t));
    case "education": return hasEducationSignal(t);
    case "family_occupation": return /(family|traditional|parivar|परिवार|पारंपरिक|पुरान|पुरख|अलग|अपना|खुद|स्वयं|independent|कुटुंब|குடும்ப|సొంత|পরিবার)/i.test(t);
    case "current_livelihood": return scanSkills(t).length > 0 || t.split(/\s+/).length >= 4;
    case "interests": return scanSkills(t).length > 0 || /(sikh|cahiye|चाहिए|सीखना|रुचि|इच्छा|ஆர்வம்|నేర్చుకో|শিখতে)/i.test(t);
    case "employment": return /(naukri|job|kaam|khud|apna|business|dhandha|नौकरी|काम|खुद|अपना|व्यापार|धंधा|dono|दोनों|சொந்த|ఉద్యోగ)/i.test(t);
    case "mobility": return /\d|door|paas|km|किलोमीटर|दूर|पास|தூரம்|దూరం|দূর/.test(t);
    case "physical": return t.split(/\s+/).length >= 2;
    default: return false;
  }
}

/** Does this utterance actually contain something for the current stage? */
export function hasStageValue(stage: Stage, text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  switch (stage) {
    case "name": return cleanName(t).length >= 2;
    case "location": return Boolean(matchPlace(t) || extractVillage(t) || t.length >= 3);
    case "education": return /(\d|पढ़|padh|school|स्कूल|college|iti|diploma|graduat|पास|pass)/i.test(t);
    case "family_occupation": return t.length >= 3;
    case "current_livelihood": return t.length >= 3;
    case "interests": return t.length >= 3;
    case "employment": return /(naukri|job|kaam|khud|apna|business|dhandha|नौकरी|काम|खुद|अपना|व्यापार|धंधा|dono|दोनों)/i.test(t);
    case "mobility": return /\d|door|paas|km|दूर|पास|किलोमीटर|नहीं जा/i.test(t);
    case "physical": return t.length >= 2;
    default: return t.length >= 2;
  }
}

/** Store the answer for `stage`, then produce the next question naturally. */
function advance(slots: SlotState, stage: Stage, text: string, lang: LangCode, seed: number): StepResult {
  if (stage === "confirm") {
    if (NO_RE.test(text) && !YES_RE.test(text)) {
      return {
        reply: L(lang, {
          hi: "कोई बात नहीं! चलिए आराम से फिर से शुरू करते हैं। सबसे पहले — आपका शुभ नाम क्या है?",
          en: "No problem at all! Let's gently start again. First — what is your good name?",
          ta: "பரவாயில்லை! மீண்டும் தொடங்குவோம். முதலில் — உங்கள் பெயர் என்ன?",
          te: "పర్వాలేదు! మళ్ళీ ప్రారంభిద్దాం. మొదట — మీ పేరు ఏమిటి?",
          mr: "काही हरकत नाही! पुन्हा सुरू करूया. आधी — तुमचे नाव काय?",
          bn: "কোনো সমস্যা নেই! আবার শুরু করি। প্রথমে — আপনার নাম কি?",
        }),
        slots: { languages: slots.languages },
        stage: "name", done: false,
      };
    }
    return { reply: L(lang, DONE_TEXT), slots, stage: "done", done: true };
  }

  const idx = STAGES.indexOf(stage);
  const next = STAGES[Math.min(idx + 1, STAGES.length - 1)];
  const updated = { ...applyAnswer(slots, stage, text, lang), asked_count: 0, asked_stage: next };
  const name = addressed(lang, updated.name);

  // Branch immediately after the work-nature answer. The next answer is
  // stored as family occupation or independent livelihood by applyAnswer.
  if (stage === "family_occupation") {
    const family = updated.work_independence === "family_business";
    const bridge = family
      ? L(lang, {
        hi: `${name ? name + ", " : ""}तो आपका काम परिवार के पुराने काम से जुड़ा है।`,
        en: "So your work follows your family's traditional craft.",
        ta: "உங்கள் வேலை குடும்பப் பாரம்பரியத்துடன் இணைந்தது.",
        te: "మీ పని కుటుంబ సంప్రదాయంతో కలిసి ఉంది.",
        mr: "तुमचे काम कुटुंबाच्या पारंपरिक कामाशी जोडलेले आहे.",
        bn: "আপনার কাজ পরিবারের ঐতিহ্যবাহী কাজের সাথে জড়িত।",
      })
      : L(lang, {
        hi: `${name ? name + ", " : ""}तो आप अपना अलग काम करते हैं।`,
        en: "So you do your own independent work.",
        ta: "நீங்கள் சொந்தமாக வேலை செய்கிறீர்கள்.",
        te: "మీరు స్వతంత్రంగా పని చేస్తున్నారు.",
        mr: "तुम्ही स्वतःचे वेगळे काम करता.",
        bn: "আপনি নিজের আলাদা কাজ করেন।",
      });
    const follow = family
      ? L(lang, {
        hi: "आपके परिवार का पारंपरिक काम क्या है, और उसमें आप क्या करते हैं?",
        en: "What is your family's traditional work, and what do you do in it?",
        ta: "உங்கள் குடும்பத்தின் பாரம்பரிய வேலை என்ன, அதில் நீங்கள் என்ன செய்கிறீர்கள்?",
        te: "మీ కుటుంబ సాంప్రదాయ పని ఏమిటి, అందులో మీరు ఏమి చేస్తారు?",
        mr: "तुमच्या कुटुंबाचे पारंपरिक काम काय आहे, आणि त्यात तुम्ही काय करता?",
        bn: "আপনার পরিবারের ঐতিহ্যবাহী কাজ কী, এবং সেখানে আপনি কী করেন?",
      })
      : L(lang, {
        hi: "आप रोज़ क्या काम करते हैं? ज़रा विस्तार से बताइए।",
        en: "What work do you do every day? Tell me a little more.",
        ta: "நீங்கள் தினமும் என்ன வேலை செய்கிறீர்கள்? சற்று விரிவாகச் சொல்லுங்கள்.",
        te: "మీరు రోజూ ఏమి పని చేస్తారు? కొంచెం వివరంగా చెప్పండి.",
        mr: "तुम्ही रोज काय काम करता? थोडे विस्ताराने सांगा.",
        bn: "আপনি প্রতিদিন কী কাজ করেন? একটু বিস্তারিত বলুন।",
      });
    return { reply: `${bridge} ${follow}`, slots: updated, stage: "current_livelihood", done: false };
  }

  const echo = echoAck(stage, updated, lang, name);
  const pre = echo || ackFor(seed, lang);

  if (next === "confirm") {
    const summary = buildSummary(updated, lang);
    const q = QUESTIONS.confirm[lang] ?? QUESTIONS.confirm.en;
    return { reply: `${pre} ${summary} ${q}`, slots: updated, stage: "confirm", done: false };
  }

  if (next === "done") {
    return { reply: `${pre} ${L(lang, DONE_TEXT)}`, slots: updated, stage: "done", done: true };
  }

  const q = QUESTIONS[next as Exclude<Stage, "done">];
  const question = q[lang] ?? q.en;
  return { reply: `${pre} ${question}`, slots: updated, stage: next, done: false };
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
