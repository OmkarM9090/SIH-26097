// Five demo personas (Module: curated data) used in seed data and Demo Mode.
import type { LangCode, SlotState, Stage } from "@/lib/types";

export interface Persona {
  key: string;
  lang: LangCode;
  channel: string;
  slots: SlotState;
  /** Scripted user answers per stage — powers the hands-free demo. */
  script: Partial<Record<Stage, string>>;
}

export const PERSONAS: Persona[] = [
  {
    key: "ramesh",
    lang: "hi",
    channel: "ivr",
    slots: {
      name: "Ramesh Kumar", age: 28, gender: "male",
      place: "Chandpur, Varanasi, Uttar Pradesh", village: "Chandpur",
      district: "Varanasi", state: "Uttar Pradesh", lat: 25.32, lng: 82.99,
      education: "8th pass", educationRank: 2,
      familyOccupation: "Leather work (traditional) — shoes & chappal making",
      familySkills: ["leather_work", "leather_stitching"],
      currentLivelihood: "Daily wage labour in construction",
      currentSkills: ["masonry"],
      interests: ["mobile_repair", "driving"],
      interestLabels: ["Mobile phone repair", "Driving"],
      preference: "self", mobilityKm: 30, constraints: "None",
      languages: ["Hindi", "Bhojpuri"],
    },
    script: {
      name: "मेरा नाम रमेश कुमार है।",
      location: "मैं वाराणसी जिले के चांदपुर गाँव से हूँ, उत्तर प्रदेश।",
      education: "मैंने 8वीं तक पढ़ाई की है।",
      family_occupation: "हमारा परिवार परंपरागत चमड़े का काम करता है — पिताजी जूते-चप्पल बनाते थे।",
      current_livelihood: "अभी मैं कंस्ट्रक्शन साइट पर रोज़ मजदूरी करता हूँ, ईंट-गारे का काम।",
      interests: "मुझे मोबाइल रिपेयर सीखना बहुत अच्छा लगेगा। ड्राइविंग भी पसंद है।",
      employment: "मैं खुद का काम करना चाहता हूँ, अपनी दुकान खोलनी है।",
      mobility: "हाँ, ट्रेनिंग के लिए 30 किलोमीटर तक जा सकता हूँ।",
      physical: "नहीं, कोई शारीरिक दिक्कत नहीं है।",
      confirm: "हाँ, बिल्कुल सही है।",
    },
  },
  {
    key: "lakshmi",
    lang: "ta",
    channel: "whatsapp",
    slots: {
      name: "Lakshmi Devi", age: 34, gender: "female",
      place: "Madurai, Tamil Nadu", village: "Thenur",
      district: "Madurai", state: "Tamil Nadu", lat: 9.93, lng: 78.12,
      education: "10th pass", educationRank: 3,
      familyOccupation: "Handloom weaving (traditional)",
      familySkills: ["weaving"],
      currentLivelihood: "Garment stitching from home",
      currentSkills: ["tailoring", "embroidery"],
      interests: ["tailoring", "beauty"],
      interestLabels: ["Advanced tailoring", "Beauty services"],
      preference: "self", mobilityKm: 15, constraints: "Cannot leave children for long hours",
      languages: ["Tamil"],
    },
    script: { name: "என் பெயர் லஷ்மி தேவி.", location: "மதுரை, தமிழ்நாடு.", education: "10ம் வகுப்பு படித்துள்ளேன்.", family_occupation: "எங்கள் குடும்பம் நெசவு வேலை செய்கிறது.", current_livelihood: "வீட்டில் தையல் வேலை செய்கிறேன்.", interests: "தையல் மற்றும் அழகு சாதனம் கற்க விரும்புகிறேன்.", employment: "சொந்த தொழில் செய்ய விருப்பம்.", mobility: "15 கிமீ வரை செல்ல முடியும்.", physical: "இல்லை.", confirm: "ஆம், சரி." },
  },
  {
    key: "sunita",
    lang: "mr",
    channel: "web",
    slots: {
      name: "Sunita Jadhav", age: 22, gender: "female",
      place: "Nagpur, Maharashtra", district: "Nagpur", state: "Maharashtra", lat: 21.15, lng: 79.09,
      education: "12th pass", educationRank: 4,
      familyOccupation: "Daily wage labour", familySkills: [],
      currentLivelihood: "Part-time helper at a beauty parlour",
      currentSkills: ["beauty"],
      interests: ["beauty", "computer"],
      interestLabels: ["Beauty & wellness", "Computer basics"],
      preference: "either", mobilityKm: 40, constraints: "None",
      languages: ["Marathi", "Hindi"],
    },
    script: { name: "माझे नाव सुनीता जाधव.", location: "नागपूर, महाराष्ट्र.", education: "मी 12वी पास आहे.", family_occupation: "आमचे कुटुंब रोजंदारी मजूरी करते.", current_livelihood: "मी ब्युटी पार्लरमध्ये मदत करते.", interests: "ब्युटीचे काम आणि संगणक शिकायला आवडेल.", employment: "दोन्ही चालतील.", mobility: "40 किलोमीटर पर्यंत जाऊ शकते.", physical: "नाही, काही अडचण नाही.", confirm: "हो, बरोबर आहे." },
  },
  {
    key: "arjun",
    lang: "hi",
    channel: "ivr",
    slots: {
      name: "Arjun Paswan", age: 35, gender: "male",
      place: "Gaya, Bihar", district: "Gaya", state: "Bihar", lat: 24.79, lng: 85.0,
      education: "5th pass", educationRank: 1,
      familyOccupation: "Agricultural labour", familySkills: ["farming"],
      currentLivelihood: "Masonry work (12 years experience)",
      currentSkills: ["masonry", "bar_bending", "painting"],
      interests: ["masonry"],
      interestLabels: ["Grow in construction line"],
      preference: "wage", mobilityKm: 60, constraints: "None",
      languages: ["Hindi", "Magahi"],
    },
    script: { name: "मेरा नाम अर्जुन पासवान है।", location: "गया, बिहार से हूँ।", education: "5वीं तक पढ़ा हूँ।", family_occupation: "हमलोग खेतिहर मजदूरी करते थे।", current_livelihood: "12 साल से राजमिस्त्री का काम करता हूँ, सरिया बांधना भी आता है।", interests: "इसी लाइन में आगे बढ़ना है।", employment: "नौकरी ठीक रहेगी।", mobility: "60 किलोमीटर तक जा सकता हूँ।", physical: "नहीं है।", confirm: "हाँ सही है।" },
  },
  {
    key: "meena",
    lang: "hi",
    channel: "whatsapp",
    slots: {
      name: "Meena Regar", age: 41, gender: "female",
      place: "Jodhpur, Rajasthan", district: "Jodhpur", state: "Rajasthan", lat: 26.24, lng: 73.02,
      education: "No formal schooling", educationRank: 0,
      familyOccupation: "Traditional cobbler family", familySkills: ["leather_work"],
      currentLivelihood: "Bamboo basket making for local market",
      currentSkills: ["bamboo_craft", "leather_work", "pottery"],
      interests: ["pottery", "bamboo_craft"],
      interestLabels: ["Terracotta craft", "Bamboo products"],
      preference: "self", mobilityKm: 10, constraints: "Eyesight weak for fine stitching",
      languages: ["Hindi", "Marwari"],
    },
    script: { name: "मेरा नाम मीना रेगर है।", location: "जोधपुर, राजस्थान।", education: "पढ़ी-लिखी नहीं हूँ।", family_occupation: "परिवार में मोची काम और मिट्टी के बर्तन बनाते थे।", current_livelihood: "बाँस की टोकरी बनाकर बेचती हूँ।", interests: "टेराकोटा और बाँस के बर्तन-सामान बनाना पसंद है।", employment: "खुद का काम ही करना है।", mobility: "10 किलोमीटर से आगे नहीं जा सकती।", physical: "आँखों से थोड़ा कम दिखता है।", confirm: "हाँ ठीक है।" },
  },
];

export const RAMESH_PERSONA = PERSONAS[0];
