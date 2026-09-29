// Multilingual strings: UI chrome + the full empathetic interview script
// in Hindi, English, Tamil, Telugu, Marathi, Bengali.
import type { LangInfo, LangCode, Stage } from "@/lib/types";

export const LANGS: LangInfo[] = [
  { code: "hi", native: "हिन्दी", english: "Hindi", bcp: "hi-IN" },
  { code: "en", native: "English", english: "English", bcp: "en-IN" },
  { code: "ta", native: "தமிழ்", english: "Tamil", bcp: "ta-IN" },
  { code: "te", native: "తెలుగు", english: "Telugu", bcp: "te-IN" },
  { code: "mr", native: "मराठी", english: "Marathi", bcp: "mr-IN" },
  { code: "bn", native: "বাংলা", english: "Bengali", bcp: "bn-IN" },
];

export const LANG_NAME: Record<LangCode, string> = {
  hi: "Hindi", en: "English", ta: "Tamil", te: "Telugu", mr: "Marathi", bn: "Bengali",
};

// ---------------------------------------------------------------- UI strings
type UIKey =
  | "tagline" | "subtag" | "start_voice" | "ivr_call" | "whatsapp" | "select_lang"
  | "listening" | "processing" | "speaking" | "tap_speak" | "type_instead"
  | "send" | "demo_mode" | "view_profile" | "generate_reco" | "print"
  | "large_text" | "high_contrast" | "banner" | "ministry" | "demo_banner"
  | "profile_title" | "reco_title" | "admin_title" | "press_connect";

type UIDict = Record<UIKey, Record<LangCode, string>>;

export const UI: UIDict = {
  tagline: {
    hi: "आपकी भाषा में, आपके हुनर की पहचान", en: "Your skills, your language, your future",
    ta: "உங்கள் மொழியில், உங்கள் திறனின் அடையாளம்", te: "మీ భాషలో, మీ నైపుణ్యాల గుర్తింపు",
    mr: "तुमच्या भाषेत, तुमच्या कौशल्याची ओळख", bn: "আপনার ভাষায়, আপনার দক্ষতার স্বীকৃতি",
  },
  subtag: {
    hi: "PM-AJAY (GIA) के तहत SC समुदाय के लिए AI आवाज़ सहायक — NSQF-संरेखित स्किलिंग सिफारिशें",
    en: "AI voice assistant for SC communities under PM-AJAY (GIA) — NSQF-aligned skilling recommendations",
    ta: "PM-AJAY (GIA) மூலம் SC சமூகத்திற்கான AI குரல் உதவியாளர்", te: "PM-AJAY (GIA) కింద SC సంఘాల కోసం AI వాయిస్ అసిస్టెంట్",
    mr: "PM-AJAY (GIA) अंतर्गत SC समाजासाठी AI व्हॉइस सहाय्यक", bn: "PM-AJAY (GIA)-এর অধীনে SC সম্প্রদায়ের জন্য AI ভয়েস সহকারী",
  },
  start_voice: {
    hi: "बात करें", en: "Start Talking", ta: "பேசுங்கள்", te: "మాట్లాడండి", mr: "बोला", bn: "কথা বলুন",
  },
  ivr_call: {
    hi: "Call करें (IVR)", en: "Call (IVR)", ta: "அழைக்கவும்", te: "కాల్ చేయండి", mr: "कॉल करा", bn: "কল করুন",
  },
  whatsapp: {
    hi: "WhatsApp", en: "WhatsApp", ta: "WhatsApp", te: "WhatsApp", mr: "WhatsApp", bn: "WhatsApp",
  },
  select_lang: {
    hi: "अपनी भाषा चुनें", en: "Choose your language", ta: "மொழியைத் தேர்ந்தெடுக்கவும்",
    te: "మీ భాషను ఎంచుకోండి", mr: "तुमची भाषा निवडा", bn: "আপনার ভাষা বেছে নিন",
  },
  listening: {
    hi: "सुन रहे हैं…", en: "Listening…", ta: "கேட்கிறது…", te: "వింటోంది…", mr: "ऐकत आहे…", bn: "শুনছি…",
  },
  processing: {
    hi: "समझ रहे हैं…", en: "Processing…", ta: "செயலாக்குகிறது…", te: "ప్రాసెస్ చేస్తోంది…", mr: "प्रक्रिया करत आहे…", bn: "প্রসেস হচ্ছে…",
  },
  speaking: {
    hi: "बोल रहे हैं…", en: "Speaking…", ta: "பேசுகிறது…", te: "మాట్లాడుతోంది…", mr: "बोलत आहे…", bn: "বলছি…",
  },
  tap_speak: {
    hi: "बोलने के लिए माइक दबाएँ", en: "Tap the mic to speak", ta: "பேச மைக்கை அழுத்தவும்",
    te: "మాట్లాడటానికి మైక్ నొక్కండి", mr: "बोलण्यासाठी माईक दाबा", bn: "বলতে মাইক চাপুন",
  },
  type_instead: {
    hi: "या यहाँ टाइप करें…", en: "or type here…", ta: "அல்லது இங்கே தட்டச்சு செய்க…",
    te: "లేదా ఇక్కడ టైప్ చేయండి…", mr: "किंवा येथे टाइप करा…", bn: "বা এখানে টাইপ করুন…",
  },
  send: {
    hi: "भेजें", en: "Send", ta: "அனுப்பு", te: "పంపండి", mr: "पाठवा", bn: "পাঠান",
  },
  demo_mode: {
    hi: "डेमो मोड (रमेश का उदाहरण)", en: "Demo mode (Ramesh example)", ta: "டெமோ பயன்முறை",
    te: "డెమో మోడ్", mr: "डेमो मोड", bn: "ডেমো মোড",
  },
  view_profile: {
    hi: "मेरी प्रोफ़ाइल देखें", en: "View my profile", ta: "சுயவிவரம் பார்க்க", te: "నా ప్రొఫైల్ చూడండి",
    mr: "माझी प्रोफाइल पहा", bn: "আমার প্রোফাইল দেখুন",
  },
  generate_reco: {
    hi: "सिफारिशें बनाएँ", en: "Generate recommendations", ta: "பரிந்துரைகள் உருவாக்கு",
    te: "సిఫార్సులు రూపొందించండి", mr: "शिफारसी तयार करा", bn: "সুপারিশ তৈরি করুন",
  },
  print: {
    hi: "रिपोर्ट डाउनलोड / प्रिंट", en: "Download / Print report", ta: "அறிக்கை அச்சிடு",
    te: "నివేదిక ప్రింట్", mr: "अहवाल प्रिंट", bn: "প্রতিবেদন প্রিন্ট",
  },
  large_text: {
    hi: "बड़ा अक्षर", en: "Large text", ta: "பெரிய எழுத்து", te: "పెద్ద అక్షరం", mr: "मोठे अक्षर", bn: "বড় অক্ষর",
  },
  high_contrast: {
    hi: "हाई कंट्रास्ट", en: "High contrast", ta: "உயர் மாறுபாடு", te: "హై కాంట్రాస్ట్", mr: "हाय कॉन्ट्रास्ट", bn: "উচ্চ কনট্রাস্ট",
  },
  banner: {
    hi: "सत्यमेव जयते | भारत सरकार | सामाजिक न्याय और अधिकारिता मंत्रालय",
    en: "Satyameva Jayate | Government of India | Ministry of Social Justice & Empowerment",
    ta: "சத்யமேவ ஜயதே | இந்திய அரசு", te: "సత్యమేవ జయతే | భారత ప్రభుత్వం",
    mr: "सत्यमेव जयते | भारत सरकार", bn: "সত্যমেব জয়তে | ভারত সরকার",
  },
  ministry: {
    hi: "PM-AJAY • प्रधानमंत्री अनुसूचित जाति अभ्युदय योजना • GIA घटक",
    en: "PM-AJAY • Pradhan Mantri Anusuchit Jaati Abhyuday Yojana • GIA Component",
    ta: "PM-AJAY • GIA கூறு", te: "PM-AJAY • GIA భాగం", mr: "PM-AJAY • GIA घटक", bn: "PM-AJAY • GIA উপাদান",
  },
  demo_banner: {
    hi: "डेमो मोड चालू — रमेश कुमार की उदाहरण बातचीत चल रही है",
    en: "Demo mode ON — playing the sample conversation of Ramesh Kumar",
    ta: "டெமோ பயன்முறை இயக்கத்தில்", te: "డెమో మోడ్ ఆన్‌లో ఉంది",
    mr: "डेमो मोड सुरू आहे", bn: "ডেমো মোড চালু আছে",
  },
  profile_title: {
    hi: "लाभार्थी प्रोफ़ाइल", en: "Beneficiary Profile", ta: "பயனாளி சுயவிவரம்",
    te: "లబ్ధిదారు ప్రొఫైల్", mr: "लाभार्थी प्रोफाइल", bn: "সুবিধাভোগী প্রোফাইল",
  },
  reco_title: {
    hi: "NSQF-संरेखित करियर सिफारिशें", en: "NSQF-Aligned Pathway Recommendations",
    ta: "NSQF பரிந்துரைகள்", te: "NSQF సిఫార్సులు", mr: "NSQF शिफारसी", bn: "NSQF সুপারিশ",
  },
  admin_title: {
    hi: "अधिकारी डैशबोर्ड", en: "Officials Dashboard", ta: "அதிகாரி டாஷ்போர்டு",
    te: "అధికారి డాష్‌బోర్డ్", mr: "अधिकारी डॅशबोर्ड", bn: "কর্মকর্তা ড্যাশবোর্ড",
  },
  press_connect: {
    hi: "कॉल कनेक्ट करें", en: "Connect call", ta: "அழைப்பை இணைக்கவும்",
    te: "కాల్ కనెక్ట్ చేయండి", mr: "कॉल कनेक्ट करा", bn: "কল সংযোগ করুন",
  },
};

export function t(key: UIKey, lang: LangCode): string {
  return UI[key]?.[lang] ?? UI[key]?.en ?? key;
}

// ------------------------------------------------- conversation script (6 languages)
type StageText = Record<LangCode, string>;

/** The question Jeevika asks at each interview stage. */
export const QUESTIONS: Record<Exclude<Stage, "done">, StageText> = {
  name: {
    hi: "नमस्ते! मैं जीविकासेतु हूँ, PM-AJAY योजना की आपकी साथी। आपका शुभ नाम क्या है?",
    en: "Namaste! I am JeevikaSetu, your companion from the PM-AJAY scheme. May I know your good name?",
    ta: "வணக்கம்! நான் ஜீவிகாசேது, PM-AJAY திட்டத்தின் உங்கள் துணை. உங்கள் பெயர் என்ன?",
    te: "నమస్తే! నేను జీవికాసేతు, PM-AJAY పథకం నుండి మీ సహాయకుడిని. మీ పేరు ఏమిటి?",
    mr: "नमस्ते! मी जीविकासेतू, PM-AJAY योजनेची तुमची साथी. तुमचे नाव काय?",
    bn: "নমস্কার! আমি জীবিকাসেতু, PM-AJAY প্রকল্পের আপনার সঙ্গী। আপনার নাম কি?",
  },
  location: {
    hi: "आप कहाँ रहते हैं? अपने गाँव या शहर, जिला और राज्य बताइए।",
    en: "Where do you live? Please tell me your village or town, district and state.",
    ta: "மிக நன்று! நீங்கள் எங்கு வசிக்கிறீர்கள்? கிராமம் அல்லது ஊர், மாவட்டம், மாநிலம் சொல்லுங்கள்.",
    te: "చాలా బాగుంది! మీరు ఎక్కడ ఉంటారు? మీ గ్రామం లేదా పట్టణం, జిల్లా, రాష్ట్రం చెప్పండి.",
    mr: "खूप छान! तुम्ही कुठे राहता? गाव किंवा शहर, जिल्हा आणि राज्य सांगा.",
    bn: "খুব ভালো! আপনি কোথায় থাকেন? গ্রাম বা শহর, জেলা ও রাজ্য বলুন।",
  },
  education: {
    hi: "आपने कितनी पढ़ाई की है? जैसे 5वीं, 8वीं, 10वीं या उससे ज़्यादा?",
    en: "How much have you studied? For example, 5th, 8th, 10th, or more?",
    ta: "புரிந்தது. நீங்கள் எவ்வளவு படித்திருக்கிறீர்கள்? 5ம், 8ம், 10ம் வகுப்பு அல்லது அதிகம்?",
    te: "అర్థమైంది. మీరు ఎంత వరకు చదివారు? 5వ, 8వ, 10వ తరగతి లేదా అంతకంటే ఎక్కువ?",
    mr: "समजले. तुम्ही कितवीपर्यंत शिकला? उदा. 5वी, 8वी, 10वी किंवा अधिक?",
    bn: "বুঝলাম। আপনি কতটা পড়াশোনা করেছেন? যেমন ৫ম, ৮ম, ১০ম বা বেশি?",
  },
  family_occupation: {
    hi: "क्या आपका काम आपके परिवार के पारंपरिक काम से जुड़ा है, या आप अपना अलग काम करते हैं?",
    en: "Is your work related to your family's traditional occupation, or do you do independent work?",
    ta: "உங்கள் குடும்பத்தின் பாரம்பரிய தொழில் என்ன? உங்கள் தந்தை என்ன வேலை செய்தார்?",
    te: "మీ కుటుంబం యొక్క సాంప్రదాయ వృత్తి ఏమిటి? మీ తండ్రి లేదా తాత ఏ పని చేసేవారు?",
    mr: "तुमच्या कुटुंबाचे पारंपरिक काम काय? वडील-आजोबा काय काम करत?",
    bn: "আপনার পরিবারের ঐতিহ্যবাহী কাজ কি? আপনার বাবা-দাদা কী কাজ করতেন?",
  },
  current_livelihood: {
    hi: "और अभी आप क्या काम करते हैं? जो भी कमाई का काम हो, बताइए।",
    en: "And what work do you do these days? Whatever earns you income, please tell me.",
    ta: "தற்போது நீங்கள் என்ன வேலை செய்கிறீர்கள்? வருமானம் தரும் வேலையைச் சொல்லுங்கள்.",
    te: "ప్రస్తుతం మీరు ఏ పని చేస్తున్నారు? ఆదాయం వచ్చే పని చెప్పండి.",
    mr: "आणि सध्या तुम्ही काय काम करता? जे काही कमाईचे काम असेल ते सांगा.",
    bn: "আর এখন আপনি কী কাজ করেন? যে কাজে আয় হয়, বলুন।",
  },
  interests: {
    hi: "आपको क्या काम करना अच्छा लगता है? आगे क्या सीखना चाहते हैं?",
    en: "What kind of work do you enjoy? What would you like to learn next?",
    ta: "உங்களுக்கு எந்த வேலை பிடிக்கும்? மேலும் என்ன கற்க விரும்புகிறீர்கள்?",
    te: "మీకు ఏ పని చేయడం ఇష్టం? ముందు ఏమి నేర్చుకోవాలని అనుకుంటున్నారు?",
    mr: "तुम्हाला कोणते काम करायला आवडते? पुढे काय शिकायला आवडेल?",
    bn: "আপনার কোন কাজ করতে ভালো লাগে? ভবিষ্যতে কী শিখতে চান?",
  },
  employment: {
    hi: "क्या आप अपना खुद का काम-धंधा करना चाहते हैं, या नौकरी करना पसंद करेंगे?",
    en: "Would you like to start your own work or business, or would you prefer a job?",
    ta: "சொந்த தொழில் தொடங்க விரும்புகிறீர்களா, அல்லது வேலை விரும்புகிறீர்களா?",
    te: "మీరు స్వంత వ్యాపారం చేయాలనుకుంటున్నారా, లేదా ఉద్యోగం చేయాలనుకుంటున్నారా?",
    mr: "तुम्हाला स्वतःचा धंदा करायला आवडेल की नोकरी?",
    bn: "আপনি নিজের ব্যবসা শুরু করতে চান, নাকি চাকরি পছন্দ করবেন?",
  },
  mobility: {
    hi: "ट्रेनिंग के लिए आप घर से कितनी दूर जा सकते हैं? कुछ किलोमीटर या दूसरे जिले तक?",
    en: "For training, how far from home can you travel — a few kilometres, or another district?",
    ta: "பயிற்சிக்காக வீட்டிலிருந்து எவ்வளவு தூரம் செல்ல முடியும்?",
    te: "శిక్షణ కోసం ఇంటి నుండి ఎంత దూరం వెళ్లగలరు?",
    mr: "प्रशिक्षणासाठी तुम्ही घरापासून किती दूर जाऊ शकता?",
    bn: "প্রশিক্ষণের জন্য বাড়ি থেকে কতদূর যেতে পারবেন?",
  },
  physical: {
    hi: "क्या आपको कोई शारीरिक दिक्कत है जो काम में आड़े आती हो? नहीं तो बस 'नहीं' बोलिए।",
    en: "Do you have any physical difficulty that affects work? If not, just say 'no'.",
    ta: "வேலையைப் பாதிக்கும் உடல் சிரமம் ஏதும் உள்ளதா? இல்லை எனில் 'இல்லை' என்று சொல்லுங்கள்.",
    te: "పనికి అడ్డంకి అయ్యే శారీరక ఇబ్బంది ఏమైనా ఉందా? లేకపోతే 'లేదు' అనండి.",
    mr: "कामात अडथळा आणणारी शारीरिक अडचण आहे का? नसल्यास 'नाही' म्हणा.",
    bn: "কাজে বাধা দেয় এমন কোনো শারীরিক সমস্যা আছে? না থাকলে শুধু 'না' বলুন।",
  },
  confirm: {
    hi: "क्या मैंने सब सही समझा? 'हाँ' बोलिए तो आगे बढ़ते हैं, 'नहीं' बोलिए तो फिर से सुनूँगी।",
    en: "Is everything correct? Say 'yes' to continue, or 'no' and I'll listen again.",
    ta: "நன்றி! நான் புரிந்ததை மீண்டும் சொல்கிறேன் — சரியா? தொடர 'ஆம்' சொல்லுங்கள்.",
    te: "ధన్యవాదాలు! నేను అర్థం చేసుకున్నది మళ్ళీ చెప్తాను — సరైనదేనా? కొనసాగడానికి 'అవును' అనండి.",
    mr: "धन्यवाद! मी समजलेले पुन्हा सांगते — बरोबर आहे का? पुढे जाण्यासाठी 'हो' म्हणा.",
    bn: "ধন্যবাদ! আমি যা বুঝেছি তা বলছি — সব ঠিক আছে তো? এগোতে 'হ্যাঁ' বলুন।",
  },
};

/** Warm acknowledgements rotated between questions. */
export const ACKS: StageText[] = [
  { hi: "बहुत अच्छा!", en: "Wonderful!", ta: "மிக நன்று!", te: "చాలా బాగుంది!", mr: "खूप छान!", bn: "খুব ভালো!" },
  { hi: "समझ गई।", en: "Got it.", ta: "புரிந்தது.", te: "అర్థమైంది.", mr: "समजले.", bn: "বুঝলাম।" },
  { hi: "धन्यवाद!", en: "Thank you!", ta: "நன்றி!", te: "ధన్యవాదాలు!", mr: "धन्यवाद!", bn: "ধন্যবাদ!" },
  { hi: "वाह, अच्छी बात है।", en: "That's great to hear.", ta: "அருமை!", te: "మంచి విషయం.", mr: "छान बात आहे.", bn: "ভালো কথা।" },
];

export const DONE_TEXT: StageText = {
  hi: "बहुत बढ़िया! आपकी प्रोफ़ाइल तैयार हो रही है। अब आपके लिए सबसे अच्छे काम और ट्रेनिंग के रास्ते दिखाती हूँ।",
  en: "Excellent! Your profile is ready. Now let me show you the best work and training pathways for you.",
  ta: "அருமை! உங்கள் சுயவிவரம் தயார். இப்போது உங்களுக்கான சிறந்த பாதைகளைக் காட்டுகிறேன்.",
  te: "అద్భుతం! మీ ప్రొఫైల్ సిద్ధమైంది. ఇప్పుడు మీకు సరైన మార్గాలు చూపిస్తాను.",
  mr: "उत्तम! तुमची प्रोफाइल तयार आहे. आता तुमच्यासाठी सर्वोत्तम मार्ग दाखवते.",
  bn: "চমৎকার! আপনার প্রোফাইল প্রস্তুত। এখন আপনার জন্য সেরা পথগুলো দেখাচ্ছি।",
};

export const IVR_MENU: Record<LangCode, string> = {
  hi: "PM-AJAY जीविकासेतु में आपका स्वागत है। हिन्दी के लिए 1 दबाएँ। English के लिए 2 दबाएँ। தமிழ் के लिए 3 दबाएँ। తెలుగు के लिए 4 दबाएँ। मराठी के लिए 5 दबाएँ। বাংলা के लिए 6 दबाएँ।",
  en: "Welcome to PM-AJAY JeevikaSetu. Press 1 for Hindi, 2 for English, 3 for Tamil, 4 for Telugu, 5 for Marathi, 6 for Bengali.",
  ta: "PM-AJAY ஜீவிகாசேதுவிற்கு வரவேற்கிறோம். தமிழுக்கு 3 ஐ அழுத்தவும்.",
  te: "PM-AJAY జీవికాసేతుకు స్వాగతం. తెలుగు కోసం 4 నొక్కండి.",
  mr: "PM-AJAY जीविकासेतूमध्ये स्वागत. मराठीसाठी 5 दाबा.",
  bn: "PM-AJAY জীবিকাসেতুতে স্বাগতম। বাংলার জন্য 6 চাপুন।",
};

// ---------------------------------------------- interview stage labels (6 languages)
export const STAGE_LABELS_ML: Record<Exclude<Stage, never>, Record<LangCode, string>> = {
  name: { hi: "नाम", en: "Name", ta: "பெயர்", te: "పేరు", mr: "नाव", bn: "নাম" },
  location: { hi: "स्थान", en: "Location", ta: "இடம்", te: "ప్రాంతం", mr: "ठिकाण", bn: "অবস্থান" },
  education: { hi: "शिक्षा", en: "Education", ta: "கல்வி", te: "విద్య", mr: "शिक्षण", bn: "শিক্ষা" },
  family_occupation: { hi: "पारिवारिक काम", en: "Family work", ta: "குடும்பத் தொழில்", te: "కుటుంబ వృత్తి", mr: "कौटुंबिक काम", bn: "পারিবারিক কাজ" },
  current_livelihood: { hi: "वर्तमान काम", en: "Current work", ta: "தற்போதைய வேலை", te: "ప్రస్తుత పని", mr: "सध्याचे काम", bn: "বর্তমান কাজ" },
  interests: { hi: "रुचि", en: "Interests", ta: "ஆர்வம்", te: "ఆసక్తులు", mr: "आवड", bn: "আগ্রহ" },
  employment: { hi: "नौकरी / स्वरोज़गार", en: "Job or own work", ta: "வேலை / சொந்தத் தொழில்", te: "ఉద్యోగం / స్వయం ఉపాధి", mr: "नोकरी / स्वयंरोजगार", bn: "চাকরি / স্বনির্ভর" },
  mobility: { hi: "यात्रा सीमा", en: "Travel range", ta: "பயண தூரம்", te: "ప్రయాణ పరిధి", mr: "प्रवास मर्यादा", bn: "যাত্রার পরিসীমা" },
  physical: { hi: "बाधाएँ", en: "Constraints", ta: "தடைகள்", te: "పరిమితులు", mr: "मर्यादा", bn: "সীমাবদ্ধতা" },
  confirm: { hi: "पुष्टि", en: "Confirmation", ta: "உறுதிப்படுத்தல்", te: "నిర్ధారణ", mr: "पुष्टी", bn: "নিশ্চিতকরণ" },
  done: { hi: "पूर्ण", en: "Done", ta: "முடிந்தது", te: "పూర్తి", mr: "पूर्ण", bn: "সম্পন্ন" },
};

export function stageLabel(stage: Stage, lang: LangCode): string {
  return STAGE_LABELS_ML[stage]?.[lang] ?? STAGE_LABELS_ML[stage]?.en ?? stage;
}

// ------------------------------------------------- extra talk-screen strings
type ExtraKey =
  | "hold_speak" | "tap_speak_btn" | "listening_now" | "replay" | "interview"
  | "voice_on" | "voice_off" | "mic_mode" | "ptt" | "continuous" | "profile_ready"
  | "mic_denied" | "stt_unsupported" | "no_speech" | "stt_failed" | "retry"
  | "lang_switched" | "ai_live" | "ai_offline" | "connecting"
  | "typing" | "offline_engine" | "release_to_send" | "you_said"
  | "calling" | "call_connected" | "call_ended" | "end_call" | "speaker"
  | "start_call" | "in_call" | "speak_now" | "ivr_hint" | "restart";

export const EXTRA: Record<ExtraKey, Record<LangCode, string>> = {
  interview: { hi: "साक्षात्कार", en: "Interview", ta: "நேர்காணல்", te: "ఇంటర్వ్యూ", mr: "मुलाखत", bn: "সাক্ষাৎকার" },
  hold_speak: { hi: "बोलने के लिए दबाए रखें", en: "Hold to Speak", ta: "பேச அழுத்திப் பிடிக்கவும்", te: "మాట్లాడటానికి నొక్కి పట్టుకోండి", mr: "बोलण्यासाठी दाबून धरा", bn: "বলতে চেপে ধরুন" },
  tap_speak_btn: { hi: "बोलने के लिए दबाएँ", en: "Tap to Speak", ta: "பேச தட்டவும்", te: "మాట్లాడటానికి నొక్కండి", mr: "बोलण्यासाठी दाबा", bn: "বলতে চাপুন" },
  listening_now: { hi: "सुन रहे हैं…", en: "Listening…", ta: "கேட்கிறது…", te: "వింటోంది…", mr: "ऐकत आहे…", bn: "শুনছি…" },
  replay: { hi: "दोबारा सुनें", en: "Replay", ta: "மீண்டும் கேட்க", te: "మళ్లీ వినండి", mr: "पुन्हा ऐका", bn: "আবার শুনুন" },
  voice_on: { hi: "आवाज़: चालू", en: "Voice: on", ta: "குரல்: இயக்கம்", te: "వాయిస్: ఆన్", mr: "आवाज: चालू", bn: "ভয়েস: চালু" },
  voice_off: { hi: "आवाज़: बंद", en: "Voice: off", ta: "குரல்: நிறுத்தம்", te: "వాయిస్: ఆఫ్", mr: "आवाज: बंद", bn: "ভয়েস: বন্ধ" },
  mic_mode: { hi: "माइक मोड", en: "Mic mode", ta: "மைக் முறை", te: "మైక్ మోడ్", mr: "माईक मोड", bn: "মাইক মোড" },
  ptt: { hi: "दबाकर बोलें", en: "Push to talk", ta: "அழுத்திப் பேசு", te: "నొక్కి మాట్లాడు", mr: "दाबून बोला", bn: "চেপে বলুন" },
  continuous: { hi: "लगातार", en: "Continuous", ta: "தொடர்ச்சியாக", te: "నిరంతరం", mr: "सतत", bn: "একটানা" },
  profile_ready: { hi: "आपकी प्रोफ़ाइल तैयार है!", en: "Your profile is ready!", ta: "உங்கள் சுயவிவரம் தயார்!", te: "మీ ప్రొఫైల్ సిద్ధం!", mr: "तुमची प्रोफाइल तयार आहे!", bn: "আপনার প্রোফাইল প্রস্তুত!" },
  mic_denied: { hi: "माइक की अनुमति नहीं मिली। कृपया ब्राउज़र में माइक चालू करें।", en: "Microphone permission denied. Please allow mic access and try again.", ta: "மைக் அனுமதி மறுக்கப்பட்டது. மைக்கை அனுமதிக்கவும்.", te: "మైక్ అనుమతి నిరాకరించబడింది. మైక్‌ను అనుమతించండి.", mr: "माईक परवानगी नाकारली. कृपया माईक सुरू करा.", bn: "মাইক অনুমতি দেওয়া হয়নি। মাইক চালু করুন।" },
  stt_unsupported: { hi: "इस ब्राउज़र में आवाज़ पहचान नहीं है — कृपया टाइप करें", en: "Speech recognition is not supported here — please type instead", ta: "இந்த உலாவியில் பேச்சு அறிதல் இல்லை — தட்டச்சு செய்யவும்", te: "ఈ బ్రౌజర్‌లో స్పీచ్ గుర్తింపు లేదు — టైప్ చేయండి", mr: "या ब्राउझरमध्ये आवाज ओळख नाही — कृपया टाइप करा", bn: "এই ব্রাউজারে স্পিচ শনাক্তকরণ নেই — টাইপ করুন" },
  no_speech: { hi: "कुछ सुनाई नहीं दिया — फिर से बोलिए", en: "I didn't catch that — please speak again", ta: "எதுவும் கேட்கவில்லை — மீண்டும் பேசுங்கள்", te: "ఏమీ వినిపించలేదు — మళ్లీ మాట్లాడండి", mr: "काही ऐकू आले नाही — पुन्हा बोला", bn: "কিছু শুনতে পাইনি — আবার বলুন" },
  stt_failed: { hi: "आवाज़ समझ नहीं पाए — फिर कोशिश करें या टाइप करें", en: "Could not transcribe — try again or type", ta: "புரியவில்லை — மீண்டும் முயற்சிக்கவும்", te: "అర్థం కాలేదు — మళ్లీ ప్రయత్నించండి", mr: "समजले नाही — पुन्हा प्रयत्न करा", bn: "বুঝতে পারিনি — আবার চেষ্টা করুন" },
  retry: { hi: "फिर कोशिश करें", en: "Retry", ta: "மீண்டும்", te: "మళ్లీ", mr: "पुन्हा", bn: "আবার" },
  lang_switched: { hi: "भाषा बदली गई", en: "Language switched", ta: "மொழி மாற்றப்பட்டது", te: "భాష మార్చబడింది", mr: "भाषा बदलली", bn: "ভাষা পরিবর্তিত" },
  ai_live: { hi: "AI: GPT-4o लाइव", en: "AI: GPT-4o live", ta: "AI: GPT-4o நேரலை", te: "AI: GPT-4o లైవ్", mr: "AI: GPT-4o लाइव्ह", bn: "AI: GPT-4o লাইভ" },
  ai_offline: { hi: "AI: ऑन-डिवाइस इंजन", en: "AI: on-device engine", ta: "AI: சாதன இயந்திரம்", te: "AI: ఆన్-డివైస్ ఇంజిన్", mr: "AI: ऑन-डिव्हाइस इंजिन", bn: "AI: অন-ডিভাইস ইঞ্জিন" },
  connecting: { hi: "जुड़ रहे हैं…", en: "Connecting…", ta: "இணைக்கிறது…", te: "కనెక్ట్ అవుతోంది…", mr: "जोडत आहे…", bn: "সংযোগ হচ্ছে…" },
  typing: { hi: "जीविकासेतु लिख रही है…", en: "JeevikaSetu is typing…", ta: "ஜீவிகாசேது தட்டச்சு செய்கிறது…", te: "జీవికాసేతు టైప్ చేస్తోంది…", mr: "जीविकासेतू टाइप करत आहे…", bn: "জীবিকাসেতু টাইপ করছে…" },
  offline_engine: { hi: "ऑफ़लाइन इंजन चालू — बातचीत जारी है", en: "Offline engine active — interview continues", ta: "ஆஃப்லைன் இயந்திரம் செயலில்", te: "ఆఫ్‌లైన్ ఇంజిన్ యాక్టివ్", mr: "ऑफलाइन इंजिन सुरू", bn: "অফলাইন ইঞ্জিন চালু" },
  release_to_send: { hi: "छोड़ें और भेजें", en: "Release to send", ta: "விடுவித்து அனுப்பு", te: "వదిలి పంపండి", mr: "सोडा आणि पाठवा", bn: "ছেড়ে দিন" },
  you_said: { hi: "आपने कहा", en: "You said", ta: "நீங்கள் சொன்னது", te: "మీరు చెప్పింది", mr: "तुम्ही म्हणालात", bn: "আপনি বললেন" },
  calling: { hi: "कॉल मिलाया जा रहा है…", en: "Calling…", ta: "அழைக்கிறது…", te: "కాల్ చేస్తోంది…", mr: "कॉल करत आहे…", bn: "কল হচ্ছে…" },
  call_connected: { hi: "कॉल जुड़ गया", en: "Call connected", ta: "அழைப்பு இணைக்கப்பட்டது", te: "కాల్ కనెక్ట్ అయ్యింది", mr: "कॉल जोडला", bn: "কল সংযুক্ত" },
  call_ended: { hi: "कॉल समाप्त", en: "Call ended", ta: "அழைப்பு முடிந்தது", te: "కాల్ ముగిసింది", mr: "कॉल संपला", bn: "কল শেষ" },
  end_call: { hi: "कॉल काटें", en: "End call", ta: "அழைப்பை முடி", te: "కాల్ ముగించు", mr: "कॉल बंद करा", bn: "কল শেষ করুন" },
  speaker: { hi: "स्पीकर", en: "Speaker", ta: "ஸ்பீக்கர்", te: "స్పీకర్", mr: "स्पीकर", bn: "স্পিকার" },
  start_call: { hi: "कॉल करें", en: "Call", ta: "அழை", te: "కాల్", mr: "कॉल करा", bn: "কল করুন" },
  in_call: { hi: "कॉल चालू", en: "In call", ta: "அழைப்பில்", te: "కాల్‌లో", mr: "कॉलमध्ये", bn: "কলে" },
  speak_now: { hi: "अब बोलिए", en: "Speak now", ta: "இப்போது பேசுங்கள்", te: "ఇప్పుడు మాట్లాడండి", mr: "आता बोला", bn: "এখন বলুন" },
  ivr_hint: { hi: "फ़ोन पर बोलिए — जवाब आवाज़ में मिलेगा", en: "Just speak — you will hear the reply", ta: "பேசுங்கள் — பதில் குரலில் வரும்", te: "మాట్లాడండి — సమాధానం వినిపిస్తుంది", mr: "बोला — उत्तर आवाजात मिळेल", bn: "বলুন — উত্তর শুনতে পাবেন" },
  restart: { hi: "फिर से शुरू करें", en: "Start again", ta: "மீண்டும் தொடங்கு", te: "మళ్లీ ప్రారంభించు", mr: "पुन्हा सुरू करा", bn: "আবার শুরু করুন" },
};

export function tx(key: ExtraKey, lang: LangCode): string {
  return EXTRA[key]?.[lang] ?? EXTRA[key]?.en ?? key;
}
