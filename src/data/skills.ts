// Canonical skill lexicon — maps informal/Hinglish mentions to formal
// NSQF-style competency tags. Used for skill extraction and QP matching.

export interface SkillEntry {
  id: string;
  en: string;         // English label
  hi: string;         // Hindi label (used in gap display)
  sector: string;     // primary sector
  axis: "craft" | "technical" | "field" | "service" | "digital" | "business";
  kw: string[];       // detection keywords (lowercase, hi + en + hinglish)
}

export const SKILLS: SkillEntry[] = [
  { id: "leather_work", en: "Leather crafting", hi: "चमड़े का काम", sector: "Leather", axis: "craft",
    kw: ["chamda", "leather", "chamar", "mochi", "joota", "juta", "chappal", "shoemak", "hide", "belt ban", "चमड़", "चमार", "मोची", "जूता", "चप्पल"] },
  { id: "leather_stitching", en: "Leather stitching & finishing", hi: "चमड़ा सिलाई व फ़िनिशिंग", sector: "Leather", axis: "craft",
    kw: ["leather stitch", "silai", "shoe upper", "finishing", "stitching leather", "मोची सिलाई", "जूते", "जूता", "चप्पल", "footwear"] },
  { id: "tailoring", en: "Tailoring & garment stitching", hi: "सिलाई / दर्जी", sector: "Apparel", axis: "craft",
    kw: ["tailor", "silai", "darzi", "stitch", "blouse", "kapde sil", "sewing", "सिलाई", "दरज़ी", "दर्जी"] },
  { id: "embroidery", en: "Embroidery & hand work", hi: "कढ़ाई / कशीदाकारी", sector: "Handicrafts", axis: "craft",
    kw: ["embroid", "kadhai", "zari", "chikankari", "aari", "कढ़ाई", "कशीदा", "ज़री"] },
  { id: "weaving", en: "Handloom weaving", hi: "हथकरघा बुनाई", sector: "Handloom", axis: "craft",
    kw: ["weav", "bunai", "handloom", "kargha", "loom", "बुनाई", "करघा", "हथकरघा"] },
  { id: "pottery", en: "Pottery & terracotta", hi: "कुम्हारी / मिट्टी के बर्तन", sector: "Handicrafts", axis: "craft",
    kw: ["pot", "kumhar", "mitti", "clay", "terracotta", "मिट्टी", "कुम्हार"] },
  { id: "bamboo_craft", en: "Bamboo & cane craft", hi: "बाँस-बेंत शिल्प", sector: "Handicrafts", axis: "craft",
    kw: ["bamboo", "bans", "basket", "tokri", "cane", "बाँस", "टोकरी"] },
  { id: "masonry", en: "Masonry & brickwork", hi: "राजगीरी / ईंट-पत्थर का काम", sector: "Construction", axis: "field",
    kw: ["mason", "raj", "mistri", "rajmistri", "brick", "construction", "building", "dhobi ghat", "राज", "मिस्त्री", "ईंट", "निर्माण"] },
  { id: "bar_bending", en: "Bar bending & shuttering", hi: "सरिया बाइंडिंग / शटरिंग", sector: "Construction", axis: "field",
    kw: ["bar bend", "saria", "shuttering", "centerin", "सरिया", "शटरिंग"] },
  { id: "painting", en: "Painting & POP work", hi: "पेंटिंग / पेंतर का काम", sector: "Construction", axis: "field",
    kw: ["paint", "putti", "putty", "pop work", "whitewash", "रंग", "पेंट", "पुताई"] },
  { id: "plumbing", en: "Plumbing & pipe fitting", hi: "प्लंबिंग / नल-पाइप फिटिंग", sector: "Plumbing", axis: "technical",
    kw: ["plumb", "pipe", "nal", "tap", "sanitar", "प्लंबर", "पाइप", "नल"] },
  { id: "electrician", en: "Electrical wiring & repair", hi: "इलेक्ट्रीशियन / बिजली का काम", sector: "Electronics", axis: "technical",
    kw: ["electric", "bijli", "wiring", "motor rewind", "wireman", "बिजली", "वायरिंग", "इलेक्ट्रि"] },
  { id: "mobile_repair", en: "Mobile phone repair", hi: "मोबाइल रिपेयर", sector: "Electronics", axis: "technical",
    kw: ["mobile", "phone repair", "smartphone", "chip level", "मोबाइल रिपेयर", "फोन ठीक"] },
  { id: "computer", en: "Computer & data entry", hi: "कंप्यूटर / डेटा एंट्री", sector: "IT-ITeS", axis: "digital",
    kw: ["computer", "data entry", "typing", "laptop", "it ", "कंप्यूटर", "कम्प्यूटर", "टाइपिंग"] },
  { id: "driving", en: "Driving (LMV)", hi: "ड्राइविंग / गाड़ी चलाना", sector: "Automotive", axis: "field",
    kw: ["driv", "gaadi", "truck", "e-rickshaw", "auto chal", "chauffeur", "गाड़ी", "ड्राइविंग", "ऑटो"] },
  { id: "auto_repair", en: "Two-wheeler & auto repair", hi: "दोपहिया/मोटर मैकेनिक", sector: "Automotive", axis: "technical",
    kw: ["mechanic", "garage", "bike repair", "puncture", "scooter", "मैकेनिक", "मेकेनिक", "गैराज", "पंचर"] },
  { id: "welding", en: "Welding & fabrication", hi: "वेल्डिंग / फैब्रिकेशन", sector: "Capital Goods", axis: "technical",
    kw: ["weld", "fabricat", "gas welding", "welder", "वेल्डिंग"] },
  { id: "carpentry", en: "Carpentry & wood work", hi: "बढ़ईगिरी / लकड़ी का काम", sector: "Furniture", axis: "craft",
    kw: ["carpen", "badhai", "wood", "furniture", "lakdi", "बढ़ई", "लकड़ी", "फर्नीचर"] },
  { id: "farming", en: "Crop farming & field work", hi: "खेती-बाड़ी", sector: "Agriculture", axis: "field",
    kw: ["farm", "kheti", "kisan", "fasal", "harvest", "crop", "agri", "कृषि", "खेती", "किसान", "फसल", "खेत"] },
  { id: "dairy", en: "Dairy & animal husbandry", hi: "डेयरी / पशुपालन", sector: "Agriculture", axis: "field",
    kw: ["dairy", "doodh", "milk", "cow", "buffalo", "pashu", "gaay", "bhains", "गाय", "भैंस", "दूध", "पशु"] },
  { id: "poultry", en: "Poultry & goatery", hi: "मुर्गी-बकरी पालन", sector: "Agriculture", axis: "field",
    kw: ["poultry", "murgi", "bakri", "goat", "chicken farm", "मुर्गी", "बकरी"] },
  { id: "food_processing", en: "Food processing (papad, pickle)", hi: "खाद्य प्रसंस्करण (पापड़-अचार)", sector: "Food Processing", axis: "craft",
    kw: ["papad", "achar", "pickle", "badi", "food process", "masala ban", "पापड़", "अचार", "मसाला"] },
  { id: "cooking", en: "Cooking & catering", hi: "खाना पकाना / होटल काम", sector: "Tourism & Hospitality", axis: "service",
    kw: ["cook", "khana", "halwai", "kitchen", "cater", "dhaba", "रसोइया", "खाना", "हलवाई", "होटल"] },
  { id: "housekeeping", en: "Housekeeping & facility work", hi: "हाउसकीपिंग / सफाई काम", sector: "Domestic Workers", axis: "service",
    kw: ["housekeep", "safai", "cleaner", "sweeper", "house maid", "housekeeping", "सफाई", "घर का काम"] },
  { id: "beauty", en: "Beauty & wellness services", hi: "ब्यूटी पार्लर / नाई का काम", sector: "Beauty & Wellness", axis: "service",
    kw: ["beauty", "parlour", "parlor", "salon", "barber", "nai", "hair cut", "mehndi", "पार्लर", "नाई", "मेहंदी", "ब्यूटी"] },
  { id: "healthcare", en: "Healthcare assistance", hi: "स्वास्थ्य सहायक / नर्सिंग सहायता", sector: "Healthcare", axis: "service",
    kw: ["nurse", "health", "dawai", "hospital", "patient care", "मरीज़", "दवा", "अस्पताल", "नर्स"] },
  { id: "retail", en: "Retail & shopkeeping", hi: "दुकान / रिटेल बिक्री", sector: "Retail", axis: "business",
    kw: ["shop", "dukaan", "retail", "kirana", "sales", "selling", "दुकान", "बिक्री", "किराना"] },
  { id: "security", en: "Security services", hi: "सुरक्षा गार्ड / चौकीदारी", sector: "Domestic Workers", axis: "service",
    kw: ["security", "guard", "chowkidar", "watchman", "सिक्योरिटी", "चौकीदार"] },
];

// Extra keywords for Tamil / Telugu / Bengali / Marathi speakers, plus common
// Hinglish variants. Merged into the lexicon so a beneficiary who says
// "தையல் வேலை" or "కుట్టు పని" is recognised exactly like one who says "सिलाई".
const EXTRA_KW: Record<string, string[]> = {
  tailoring: ["தையல்", "తையൽ", "కుట్టు", "সেলাই", "শিলাই", "शिवणकाम", "शिलाई"],
  leather_work: ["தோல்", "చర్మం", "চামড়া", "चामड़ा", "चर्मकार"],
  leather_stitching: ["தோல் வேலை", "చర్మపు పని", "চামড়ার কাজ", "चर्मकाम"],
  embroidery: ["கைவேலை", "எம்பிராய்டரி", "ఎంబ్రాయిడరీ", "সূচিকর্ম", "भरतकाम", "কাঁথা"],
  weaving: ["நெசவு", "నేత", "বুনন", "তাঁত", "विणकाम", "माग"],
  pottery: ["மண்பாண்டம்", "కుండలు", "మట్టి", "মৃৎশিল্প", "মাটি", "कुंभार", "माती"],
  bamboo_craft: ["மூங்கில்", "వెదురు", "বাঁশ", "बांबू", "वेत"],
  masonry: ["கட்டுமான", "செங்கல்", "కట్టడం", "ఇటుక", "রাজমিস্ত্রি", "ইট", "गवंडी", "बांधकाम"],
  bar_bending: ["இரும்பு", "ఇనుప", "রড", "सरिया"],
  painting: ["வண்ணம்", "பெயிண்ட்", "రంగు", "పెయింట్", "রং", "পেইন্ট", "रंगकाम"],
  plumbing: ["குழாய்", "ప్లంబింగ్", "పైపు", "প্লাম্বিং", "নল", "नळ"],
  electrician: ["மின்சாரம்", "విద్యుత్", "বিদ্যুৎ", "ইলেকট্রিক", "विज", "इलेक्ट्रिक"],
  mobile_repair: ["மொபைல்", "మొబైల్", "মোবাইল", "मोबाइल"],
  computer: ["கணினி", "కంప్యూటర్", "কম্পিউটার", "संगणक"],
  driving: ["ஓட்டுநர்", "ஓட்டு", "డ్రైవింగ్", "నడపడం", "ড্রাইভিং", "চালানো", "ड्रायव्हिंग", "चालवणे"],
  auto_repair: ["மெக்கானிக்", "మెకానిక్", "মেকানিক", "मेकॅनिक", "गाडी दुरुस्ती"],
  welding: ["வெல்டிங்", "వెల్డింగ్", "ওয়েল্ডিং", "वेल्डिंग"],
  carpentry: ["தச்சு", "వడ్రంగి", "কাঠ", "সূত্রধর", "सुतार", "लाकूड"],
  farming: ["விவசாயம்", "வேளாண்மை", "நெல்", "వ్యవసాయం", "పొలం", "কৃষি", "চাষ", "ধান", "शेती", "पीक", "शेत"],
  dairy: ["பால்", "மாடு", "పాలు", "ఆవు", "দুধ", "গরু", "दूध", "गाय", "म्हैस"],
  poultry: ["கோழி", "కోళ్ల", "మురుగు", "মুরগি", "মুরগী", "হাঁস", "कोंबडी", "मुर्गी"],
  food_processing: ["ஊறுகாய்", "அப்பளம்", "పచ్చడి", "అప్పడం", "আচার", "পাপড়", "लोणचे", "पापड", "अचार", "मसाला"],
  cooking: ["சமையல்", "వంట", "রান্না", "स्वयंपाक", "खाना बनाना"],
  housekeeping: ["சுத்தம்", "வீட்டு வேலை", "శుభ్రత", "ఇంటి పని", "পরিষ্কার", "ঝি", "घरकाम", "स्वच्छता"],
  beauty: ["அழகு", "முடி", "క్షవరం", "అందం", "সৌন্দর্য", "চুল", "সেলুন", "केशकर्तन", "सौंदर्य"],
  healthcare: ["மருத்துவம்", "சிகிச்சை", "వైద్యం", "ఆసుపత్రి", "চিকিৎসা", "হাসপাতাল", "औषध", "रुग्णालय"],
  retail: ["கடை", "விற்பனை", "దుకాణం", "అమ్మకం", "দোকান", "বিক্রি", "दुकान", "विक्री"],
  security: ["பாதுகாப்பு", "காவல்", "భద్రత", "కాపలా", "নিরাপত্তা", "পাহারা", "पहारा", "सुरक्षा"],
};
for (const sk of SKILLS) {
  const extra = EXTRA_KW[sk.id];
  if (extra) sk.kw = [...sk.kw, ...extra];
}

export const SKILL_MAP = new Map(SKILLS.map((s) => [s.id, s]));

/** Scan free text (any language mix) and return matched canonical skill ids. */
export function scanSkills(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `;
  const hits = new Set<string>();
  for (const s of SKILLS) {
    if (s.kw.some((k) => lower.includes(k.toLowerCase()))) hits.add(s.id);
  }
  return [...hits];
}

// --------------------------------------------------------------- education
export const EDU_LEVELS: { rank: number; label: string; labelHi: string }[] = [
  { rank: 0, label: "No formal schooling", labelHi: "पढ़े-लिखे नहीं / घर की पढ़ाई" },
  { rank: 1, label: "5th pass", labelHi: "5वीं पास" },
  { rank: 2, label: "8th pass", labelHi: "8वीं पास" },
  { rank: 3, label: "10th pass", labelHi: "10वीं पास" },
  { rank: 4, label: "12th pass", labelHi: "12वीं पास" },
  { rank: 5, label: "ITI / Diploma", labelHi: "आईटीआई / डिप्लोमा" },
  { rank: 6, label: "Graduate", labelHi: "स्नातक (ग्रेजुएट)" },
];

export function parseEducation(text: string): { rank: number; label: string } {
  const lower = text.toLowerCase();
  const has = (...ks: string[]) => ks.some((k) => lower.includes(k));
  if (has("graduat", "b.a", "ba ", "bsc", "b.com", "degree", "स्नातक", "ग्रेजुएट", "डिग्री", "पदवी", "பட்டதாரி", "பட்டம்", "డిగ్రీ", "పట్టభద్ర", "স্নাতক", "ডিগ্রি")) return { rank: 6, label: EDU_LEVELS[6].label };
  if (has("iti", "आईटीआई", "diploma", "polytechnic", "डिप्लोमा", "आयटीआय", "டிப்ளமோ", "டிப்லோமா", "డిప్లొమా", "ఐటీఐ", "ডিপ্লোমা", "আইটিআই")) return { rank: 5, label: EDU_LEVELS[5].label };
  if (has("12", "twelv", "inter", "बारह", "12वीं", "१२", "बारावी", "பன்னிரண்டாம்", "పన్నెండవ", "দ্বাদশ")) return { rank: 4, label: EDU_LEVELS[4].label };
  if (has("10", "tenth", "dasvi", "मैट्रिक", "दसवीं", "10वीं", "१०", "sslc", "दहावी", "பத்தாம்", "పదవ", "দশম")) return { rank: 3, label: EDU_LEVELS[3].label };
  if (has("8", "eighth", "aathvi", "8वीं", "आठवीं", "८", "आठवी", "எட்டாம்", "ఎనిమిదవ", "অষ্টম")) return { rank: 2, label: EDU_LEVELS[2].label };
  if (has("5", "fifth", "pachvi", "5वीं", "पाँचवी", "५", "primary", "प्राइमरी", "पाचवी", "ஐந்தாம்", "ఐదవ", "পঞ্চম")) return { rank: 1, label: EDU_LEVELS[1].label };
  if (has("nahi padh", "unpadh", "illiterate", "no school", "नहीं पढ़", "अनपढ़", "पढ़ाई नहीं", "படிக்கவில்லை", "చదవలేదు", "পড়িনি")) return { rank: 0, label: EDU_LEVELS[0].label };
  return { rank: 2, label: EDU_LEVELS[2].label };
}

/** True when the sentence actually names a schooling level (avoids defaulting). */
export function hasEducationSignal(text: string): boolean {
  const e = parseEducation(text);
  return /(\d|पढ़|padh|school|स्कूल|college|iti|diploma|graduat|pass|पास|मैट्रिक|class|वर्ग|வகுப்பு|படித்|తరగతి|చది|শ্রেণি|পড়াশোনা)/i.test(text) || e.rank !== 2;
}

// --------------------------------------------------------------- locations
export interface PlaceInfo { district: string; state: string; lat: number; lng: number; kw: string[]; }

export const PLACES: PlaceInfo[] = [
  { district: "Varanasi", state: "Uttar Pradesh", lat: 25.32, lng: 82.99, kw: ["varanasi", "banaras", "kashi", "वाराणसी", "बनारस", "काशी", "चांदपुर", "chandpur"] },
  { district: "Lucknow", state: "Uttar Pradesh", lat: 26.85, lng: 80.95, kw: ["lucknow", "लखनऊ"] },
  { district: "Kanpur", state: "Uttar Pradesh", lat: 26.45, lng: 80.33, kw: ["kanpur", "कानपुर"] },
  { district: "Agra", state: "Uttar Pradesh", lat: 27.18, lng: 78.01, kw: ["agra", "आगरा"] },
  { district: "Jaipur", state: "Rajasthan", lat: 26.91, lng: 75.79, kw: ["jaipur", "जयपुर"] },
  { district: "Jodhpur", state: "Rajasthan", lat: 26.24, lng: 73.02, kw: ["jodhpur", "जोधपुर"] },
  { district: "Patna", state: "Bihar", lat: 25.59, lng: 85.14, kw: ["patna", "पटना"] },
  { district: "Gaya", state: "Bihar", lat: 24.79, lng: 85.0, kw: ["gaya", "गया"] },
  { district: "Muzaffarpur", state: "Bihar", lat: 26.12, lng: 85.36, kw: ["muzaffarpur", "मुजफ्फरपुर"] },
  { district: "Chennai", state: "Tamil Nadu", lat: 13.08, lng: 80.27, kw: ["chennai", "madras", "சென்னை", "चेन्नई"] },
  { district: "Madurai", state: "Tamil Nadu", lat: 9.93, lng: 78.12, kw: ["madurai", "மதுரை", "मदुरै"] },
  { district: "Coimbatore", state: "Tamil Nadu", lat: 11.02, lng: 76.96, kw: ["coimbatore", "கோயம்புத்தூர்", "कोयंबतूर"] },
  { district: "Hyderabad", state: "Telangana", lat: 17.38, lng: 78.49, kw: ["hyderabad", "హైదరాబాద్", "हैदराबाद"] },
  { district: "Warangal", state: "Telangana", lat: 17.97, lng: 79.59, kw: ["warangal", "వరంగల్", "वारंगल"] },
  { district: "Pune", state: "Maharashtra", lat: 18.52, lng: 73.86, kw: ["pune", "पुणे", "पुण्य"] },
  { district: "Nagpur", state: "Maharashtra", lat: 21.15, lng: 79.09, kw: ["nagpur", "नागपुर"] },
  { district: "Mumbai", state: "Maharashtra", lat: 19.08, lng: 72.88, kw: ["mumbai", "मुंबई", "bombay"] },
  { district: "Bhopal", state: "Madhya Pradesh", lat: 23.26, lng: 77.41, kw: ["bhopal", "भोपाल"] },
  { district: "Indore", state: "Madhya Pradesh", lat: 22.72, lng: 75.86, kw: ["indore", "इंदौर"] },
  { district: "Kolkata", state: "West Bengal", lat: 22.57, lng: 88.36, kw: ["kolkata", "কলকাতা", "कोलकाता"] },
  { district: "Howrah", state: "West Bengal", lat: 22.59, lng: 88.31, kw: ["howrah", "हावड़ा", "হাওড়া"] },
];

export function matchPlace(text: string): PlaceInfo | null {
  const lower = text.toLowerCase();
  for (const p of PLACES) if (p.kw.some((k) => lower.includes(k.toLowerCase()))) return p;
  return null;
}

/** Rough village extraction: "X gaon/village" patterns (marks included for Indic scripts). */
export function extractVillage(text: string): string | undefined {
  const m = text.match(/([\p{L}\p{M}]{2,})\s*(gaon|गाओं|गाँव|गांव|ग्राम|village|గ్రామం|கிராமம்|गावে)/iu);
  if (m) return m[1];
  return undefined;
}

// ----------------------------------------------------------- name cleanup
const NAME_STOP = new Set([
  "mera", "meri", "mere", "naam", "name", "is", "hai", "hun", "hu", "main", "mei", "may", "ji",
  "ahiyaan", "myself", "i", "am", "bol", "rah", "rhi", "rha", "bolta", "bolti", "kehta", "kehti",
  "नाम", "मेरा", "मेरी", "मेरे", "है", "हूं", "हूँ", "मैं", "मै", "जी", "बोलता", "बोलती", "कहता", "कहती",
  "नाव", "माझे", "माझा", "मी", "आहे", "बोलतो", "म्हणतो",
  "పేరు", "నేను", "నా", "అని", "ఉంది",
  "பெயர்", "என்", "எனது", "நான்", "என்று",
  "নাম", "আমার", "আমি", "বলছি", "নামের",
]);

export function cleanName(text: string): string {
  const tokens = text
    .replace(/[.,!?।]/g, " ")
    .split(/\s+/)
    .filter((tok) => tok && !NAME_STOP.has(tok.toLowerCase()))
    .slice(0, 3);
  if (!tokens.length) return text.trim().split(/\s+/).slice(0, 2).join(" ");
  return tokens
    .map((tok) => (/^[a-z]/.test(tok) ? tok[0].toUpperCase() + tok.slice(1) : tok))
    .join(" ");
}

// ----------------------------------------------------------- other parsers
export function parsePreference(text: string): "self" | "wage" | "either" {
  const lower = text.toLowerCase();
  if (/(khud ka|apna|business|dhandha|self|own work|khud|स्वयं|स्वरोज़गार|स्वरोजगार|व्यापार|धंधा|खुद का|வியாபாரம்|స్వంతం|स्वतःचा|নিজের)/.test(lower)) {
    if (/(naukri|job|नौकरी|வேலை|ఉద్యోగం|नोकरी|চাকরি|dono|both|दोनों)/.test(lower)) return "either";
    return "self";
  }
  if (/(dono|both|koi bhi|दोनों|either|any)/.test(lower)) return "either";
  if (/(naukri|job|service|नौकरी|வேலை|ఉద్యోగం|नोकरी|চাকরি)/.test(lower)) return "wage";
  return "either";
}

export function parseMobility(text: string): number {
  const lower = text.toLowerCase();
  const num = lower.match(/(\d+)\s*(km|kilomet|किलोमीटर|कि\.मी)/);
  if (num) return parseInt(num[1], 10);
  if (/(door|dusre jile|other district|दूर|दूसरे जिले|कहीं भी|anywhere|kahi bhi)/.test(lower)) return 100;
  if (/(nahi ja|can't|cannot|nahi|bahar nahi|पास में|नहीं जा|இல்லை|లేదు|नाही|না)/.test(lower) && !/(haan|हाँ|हां|yes)/.test(lower)) return 8;
  const plain = lower.match(/\b(\d{1,3})\b/);
  if (plain) return parseInt(plain[1], 10);
  return 25;
}

export function parseConstraints(text: string): string {
  const lower = text.toLowerCase();
  if (/(nahi|no |^no|koi nahi|कोई नहीं|कुछ नहीं|नहीं|இல்லை|లేదు|नाही|না|none)/.test(lower)) return "None";
  if (/(theek|thik|sahi|bilkul|haan|हाँ|हां|ठीक|सही|बिल्कुल|சரி|ஆம்|అవును|సరే|ঠিক|হ্যাঁ|हो)/.test(lower)) return "None";
  const m = lower.match(/(dikkat|problem|pareshani|takleef|दिक्कत|समस्या|परेशानी|तकलीफ|பிரச்சனை|சிரமம்|ఇబ్బంది|సమస్య|সমস্যা|কষ্ট)/);
  if (!m) return "None";     // nothing recognisable → treat as no constraint
  return text.trim();
}

/** True when the sentence is only an affirmation ("haan", "theek hai", "sari"). */
export function isBareAffirm(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  if (t.split(/\s+/).length > 3) return false;
  return /(haan|han|ha|yes|ok|okay|theek|thik|sahi|bilkul|zaroor|हाँ|हां|ठीक|सही|बिल्कुल|ज़रूर|हो|ஆம்|சரி|అవును|సరే|হ্যাঁ|ঠিক)/.test(t);
}

export function parseAge(text: string): number | undefined {
  const m = text.match(/(\d{2})\s*(saal|sal|years|वर्ष|साल|வயது|సంవత్సరాలు|वर्षे|বছর)/i);
  return m ? parseInt(m[1], 10) : undefined;
}

/** Script-based language detection (Unicode ranges) with Latin→hi default. */
export function detectLanguage(text: string): "hi" | "ta" | "te" | "bn" | "en" {
  const counts: Record<string, number> = { hi: 0, ta: 0, te: 0, bn: 0, en: 0 };
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (c >= 0x0900 && c <= 0x097f) { counts.hi++; } // Devanagari (also Marathi)
    else if (c >= 0x0b80 && c <= 0x0bff) counts.ta++;
    else if (c >= 0x0c00 && c <= 0x0c7f) counts.te++;
    else if (c >= 0x0980 && c <= 0x09ff) counts.bn++;
    else if ((c >= 0x61 && c <= 0x7a) || (c >= 0x41 && c <= 0x5a)) counts.en++;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return (best && best[1] > 0 ? best[0] : "hi") as "hi" | "ta" | "te" | "bn" | "en";
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371, rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(bLat - aLat), dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export function formatINR(n: number): string {
  return "₹" + n.toLocaleString("en-IN");
}
