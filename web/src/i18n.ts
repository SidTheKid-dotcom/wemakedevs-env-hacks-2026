// Marathi and Hindi for the screens. The English sentence is the key, so anything not yet
// translated falls back to English instead of showing a blank or a raw key.
//
// Wording rule (CLAUDE.md): the minutes record a promise, not a verdict. No translation may
// say violated, failed, illegal or missing. tests/i18n.test.ts holds the list that enforces it.
import { useSyncExternalStore } from "react";

export type Lang = "en" | "mr" | "hi";
export const LANGS: { code: Lang; label: string; full: string }[] = [
  { code: "en", label: "EN", full: "English" },
  { code: "mr", label: "मराठी", full: "Marathi" },
  { code: "hi", label: "हिंदी", full: "Hindi" },
];

const KEY = "vachan:lang";
const isLang = (v: unknown): v is Lang => v === "en" || v === "mr" || v === "hi";
let current: Lang = (() => {
  if (typeof window === "undefined") return "en"; // the dictionary is also read by the tests
  const fromUrl = new URLSearchParams(location.search).get("lang"); // ?lang=mr for a shared link
  if (isLang(fromUrl)) return fromUrl;
  try {
    const saved = localStorage.getItem(KEY);
    if (isLang(saved)) return saved;
  } catch { /* private mode */ }
  return "en";
})();

const listeners = new Set<() => void>();
export function setLang(l: Lang) {
  current = l;
  try { localStorage.setItem(KEY, l); } catch { /* private mode */ }
  if (typeof document !== "undefined") document.documentElement.lang = l;
  listeners.forEach((fn) => fn());
}
export const getLang = () => current;
if (typeof document !== "undefined") document.documentElement.lang = current;

/** Re-renders the component when the language changes. */
export function useLang(): Lang {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    () => current,
    () => "en" as Lang,
  );
}

/** Translate one English sentence. Unknown sentences come back unchanged. */
export function t(en: string): string {
  if (current === "en") return en;
  return DICT[current][en] ?? en;
}

/** For a sentence with a value in it: t2("{n} kg a day", { n: "923" }). */
export function t2(en: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, String(v)), t(en));
}

type Dict = Record<string, string>;

const mr: Dict = {
  // --- masthead and navigation ---
  "Residents": "रहिवासी",
  "Ward officers": "वॉर्ड अधिकारी",
  "How it works": "हे कसे चालते",
  "VACHAN, home": "वचन, होम",
  "Search projects and addresses": "प्रोजेक्ट आणि पत्ते शोधा",
  "Close": "बंद करा",
  "Language": "भाषा",

  // --- home ---
  "Read the fine print before you pay the fine.": "दंड भरण्याआधी बारीक अक्षरातला मजकूर वाचा.",
  "Did your builder promise to process your society's wet waste?": "तुमच्या बिल्डरने तुमच्या सोसायटीचा ओला कचरा जागेवरच प्रोसेस करायचं वचन दिलं होतं का?",
  "Find the promise and its page. Then ask for the plant to run.": "ते वचन आणि त्याचे पेज शोधा. मग प्लांट चालू करायला सांगा.",
  "{owc} of the {total} Pune projects recommended for clearance did, in writing.": "मंजुरीला गेलेल्या {total} पुणे प्रोजेक्टपैकी {owc} प्रोजेक्टनी ते लेखी दिलंय.",
  "Pune's large housing projects did, in writing.": "पुण्यातल्या मोठ्या गृहप्रकल्पांनी ते लेखी दिलंय.",
  "Find the promise": "वचन शोधा",
  "Area, project or builder": "भाग, प्रोजेक्ट किंवा बिल्डर",
  "Search by area, address, project, builder or village": "भाग, पत्ता, प्रोजेक्ट, बिल्डर किंवा गाव यानुसार शोधा",
  "or": "किंवा",
  "try": "उदाहरणार्थ",
  "Not from Pune?": "पुण्याचे नाही?",
  "See a real promise": "खरे वचन पाहा",
  "{v} of {c} quotes re-checked against the government PDF.": "{c} पैकी {v} कोट सरकारी पीडीएफशी पुन्हा ताडून पाहिली.",

  // --- the chain: problem to impact ---
  "The problem": "समस्या",
  "The solution": "उपाय",
  "How": "कसे",
  "The outcome": "परिणाम",
  "The impact": "एकूण परिणाम",
  "Who is keeping the promise?": "वचन कोण पाळतंय?",
  "of wet waste a day goes from Pune's housing societies and malls to city plants, says": "इतका ओला कचरा दररोज पुण्यातील सोसायट्या आणि मॉलमधून शहराच्या प्रकल्पांकडे जातो, असे सांगते",
  "In Pimpri-Chinchwad, notices set fines for large societies that don't process their own.": "पिंपरी-चिंचवडमध्ये, स्वतःचा कचरा जागेवर प्रक्रिया न करणाऱ्या मोठ्या सोसायट्यांसाठी नोटिसांद्वारे दंड ठरवले आहेत.",
  "Search your area": "तुमचा भाग शोधा",
  "See the promise and its page": "वचन आणि त्याचे पेज पाहा",
  "Ask for the plant to run": "प्लांट चालू करायला सांगा",
  "A letter that quotes the builder's own promise.": "बिल्डरचंच वचन वापरून लिहिलेलं पत्र.",

  // --- the two audiences ---
  "For residents and flat buyers": "रहिवासी आणि फ्लॅट घेणाऱ्यांसाठी",
  "For ward officers": "वॉर्ड अधिकाऱ्यांसाठी",
  "Your society got a wet-waste notice, or you are about to buy a flat.": "तुमच्या सोसायटीला ओल्या कचऱ्याची नोटीस आली आहे, किंवा तुम्ही फ्लॅट घेणार आहात.",
  "See what your builder promised in writing, and the page": "तुमच्या बिल्डरने लेखी काय वचन दिलं, आणि ते पेज पाहा",
  "Send a letter asking for the plant to run": "प्लांट चालू करायला सांगणारं पत्र पाठवा",
  "Share it with your society group": "तुमच्या सोसायटी गटात ते शेअर करा",
  "Find your building's promise": "तुमच्या इमारतीचे वचन शोधा",
  "A list for your ward, biggest written promises first": "तुमच्या वॉर्डची यादी, सर्वांत मोठी लेखी वचने आधी",
  "Each row links to its page in the minutes": "प्रत्येक ओळ मिनिट्समधल्या तिच्या पेजशी जोडलेली आहे",
  "Print it for field visits.": "फील्ड व्हिजिटसाठी ती छापा.",
  "Open the ward list": "वॉर्डची यादी उघडा",

  // --- map ---
  "Every dot is a written promise": "प्रत्येक ठिपका एक लेखी वचन आहे",
  "bigger dot = more wet waste promised": "मोठा ठिपका = जास्त ओल्या कचऱ्याचे वचन",
  "hollow = a person must check": "पोकळ = हे माणसाने तपासावे",
  "Zoom in": "जवळ आणा",
  "Zoom out": "दूर न्या",
  "Whole city": "संपूर्ण शहर",
  "A person must check this": "हे माणसाने तपासावे",
  "wet waste a day promised": "ओला कचरा दररोज, वचन दिलेले",

  // --- the card ---
  "What the builder promised in writing": "बिल्डरने लेखी काय वचन दिलं",
  "of wet waste a day": "ओला कचरा दररोज",
  "promised in writing to be processed on site:": "जागेवरच प्रोसेस करायचं लेखी वचन:",
  "The builder promised in writing to process this waste on site. Ask whether the plant is built and running.": "बिल्डरने हा कचरा जागेवरच प्रोसेस करायचं लेखी वचन दिलंय. प्लांट उभा राहिलाय का आणि चालू आहे का, हे विचारा.",
  "If this plant runs, {t} tonnes a year stays where it is made, instead of on trucks to the city's dumping grounds.": "हा प्लांट चालू राहिला तर वर्षाला {t} टन कचरा शहराच्या डंपिंग ग्राउंडला ट्रकने न जाता, जिथे तयार होतो तिथेच राहील.",
  "Send to my society group": "माझ्या सोसायटी गटात पाठवा",
  "A free letter to the builder or ward office, in English, मराठी or हिंदी. No sign-in.": "बिल्डर किंवा वॉर्ड ऑफिससाठी मोफत पत्र — इंग्रजी, मराठी किंवा हिंदीत. साइन-इन नाही.",
  "From the minutes": "मिनिट्समधून",
  "Operation Phase": "ऑपरेशन फेज",
  "Operation phase, not construction": "ऑपरेशन फेज, बांधकाम नाही",
  "See it on page {p}": "पेज {p} वर पाहा",
  "Open the page and check it yourself": "पेज उघडा आणि स्वतः तपासा",
  "Original on PARIVESH": "परिवेश वरील मूळ दस्तऐवज",
  "Builder:": "बिल्डर:",
  "Flats:": "फ्लॅट:",
  "Proposal:": "प्रस्ताव:",
  "Recommended for clearance:": "मंजुरीसाठी पाठवलं:",
  "Committee meeting:": "समितीची बैठक:",
  "Spotted a mistake on this card?": "या कार्डात चूक दिसली का?",
  "Tell us": "आम्हाला सांगा",
  ", with the page it is on.": ", ते ज्या पेजवर आहे त्यासह.",
  "Search another building": "दुसरी इमारत शोधा",
  "Checks": "तपासण्या",
  "Found word for word in the minutes": "मिनिट्समध्ये जसंच्या तसं सापडलं",
  "Operation phase, not construction ": "ऑपरेशन फेज, बांधकाम नाही",
  "Recommended for clearance": "मंजुरीसाठी पाठवलं",
  "Plant capacity covers the promised waste": "प्लांटची क्षमता वचन दिलेल्या कचऱ्याला पुरेशी आहे",
  "On page {p}": "पेज {p} वर",
  "Read by machine, checks passed": "मशीनने वाचलं, तपासण्या पास",
  "as read by machine": "मशीनने वाचल्याप्रमाणे",

  // --- the pdf viewer ---
  "Page {p} of the minutes": "मिनिट्सचं पेज {p}",
  "The promise is highlighted where it is printed.": "वचन जिथे छापले आहे तिथे ठळक केले आहे.",
  "The quoted line is on this page.": "उद्धृत केलेली ओळ या पेजवर आहे.",
  "Opening the page…": "पेज उघडत आहे…",
  "The page would not open here. Use the link below.": "हे पेज इथे उघडले नाही. खालील लिंक वापरा.",
  "Open the full PDF": "संपूर्ण पीडीएफ उघडा",

  // --- the letter ---
  "Who should we ask?": "आपण कोणाला विचारायचे?",
  "the builder": "बिल्डर",
  "ward office": "वॉर्ड ऑफिस",
  "Write my letter": "माझे पत्र लिहा",
  "Drafting from the minutes…": "मिनिट्सवरून मसुदा तयार होत आहे…",
  "Your letter": "तुमचे पत्र",
  "Drafted by Amazon Bedrock from the minutes.": "मिनिट्सवरून Amazon Bedrock ने मसुदा तयार केला.",
  "Read it before you send.": "पाठवण्याआधी ते वाचा.",
  "Copy letter": "पत्र कॉपी करा",
  "Copied": "कॉपी झाले",
  "Send on WhatsApp": "व्हॉट्सअ‍ॅपवर पाठवा",
  "Send by email": "ईमेलने पाठवा",
  "Show all": "सर्व दाखवा",
  "Letter text, you can edit it": "पत्राचा मजकूर, तुम्ही तो एडिट करू शकता",
  "The letter could not be drafted.": "पत्राचा मसुदा तयार करता आला नाही.",
  "The promise and the page are still here.": "वचन आणि त्याचे पेज इथेच आहेत.",
  "Try again": "पुन्हा प्रयत्न करा",

  // --- sharing ---
  "Copy link": "लिंक कॉपी करा",
  "Link copied": "लिंक कॉपी झाला",
  "The link opens this page with the PDF page.": "हा लिंक हे पेज पीडीएफच्या पेजसह उघडतो.",

  // --- officer ---
  "Ward {w}: which projects to check first": "वॉर्ड {w}: आधी कोणते प्रोजेक्ट तपासायचे",
  "For PCMC ward officers planning visits to large societies": "मोठ्या सोसायट्यांना भेटी आखणाऱ्या पिंपरी-चिंचवड वॉर्ड अधिकाऱ्यांसाठी",
  "Print this list": "ही यादी छापा",

  // --- states ---
  "Reading the minutes…": "मिनिट्स वाचत आहे…",
  "No projects match this search.": "या शोधाशी जुळणारे प्रोजेक्ट नाहीत.",
  "Search still works.": "शोध अजूनही चालतो.",

  // --- map section and closing ---
  "PCMC is surveying about 1,155 large waste generators. Where do you start?": "पिंपरी-चिंचवड जवळपास १,१५५ मोठ्या कचरा निर्माण करणाऱ्यांचं सर्वेक्षण करतंय. सुरुवात कुठून करायची?",
  "{n} housing project sites in Pune (PMC) and Pimpri-Chinchwad (PCMC). A bigger dot means more wet waste promised. A hollow dot means a person must check it.": "पुणे (PMC) आणि पिंपरी-चिंचवड (PCMC) मधल्या {n} गृहप्रकल्पांच्या जागा. मोठा ठिपका म्हणजे जास्त ओल्या कचऱ्याचं वचन. पोकळ ठिपका म्हणजे ते माणसाने तपासायचं आहे.",
  "Housing project sites in Pune (PMC) and Pimpri-Chinchwad (PCMC). A bigger dot means more wet waste promised. A hollow dot means a person must check it.": "पुणे (PMC) आणि पिंपरी-चिंचवड (PCMC) मधल्या गृहप्रकल्पांच्या जागा. मोठा ठिपका म्हणजे जास्त ओल्या कचऱ्याचं वचन. पोकळ ठिपका म्हणजे ते माणसाने तपासायचं आहे.",
  "How we find and check each promise": "प्रत्येक वचन आम्ही कसं शोधतो आणि तपासतो",
  "Is your society's plant running?": "तुमच्या सोसायटीचा प्लांट चालू आहे का?",
  "Find what your builder promised in writing, and the page it is on.": "तुमच्या बिल्डरने लेखी काय वचन दिलं, आणि ते कुठल्या पेजवर आहे ते शोधा.",
  "Open one to see the page and ask for the plant to run.": "पेज बघायला आणि प्लांट चालू करायला सांगायला एक उघडा.",
  "A promise is not proof that a plant was built or runs.": "वचन म्हणजे प्लांट उभा राहिला किंवा चालू आहे याचा पुरावा नव्हे.",

  // --- chain and card details ---
  "From the problem to the impact": "समस्येपासून परिणामापर्यंत",
  "To get environmental clearance, {owc} of the {total} Pune projects promised in writing to process their wet waste on site. VACHAN finds that promise in over a thousand public PDFs nobody reads.": "पर्यावरण मंजुरी मिळवण्यासाठी {total} पैकी {owc} पुणे प्रोजेक्टनी त्यांचा ओला कचरा जागेवरच प्रोसेस करायचं लेखी वचन दिलं. कोणी न वाचणाऱ्या हजारभर सरकारी PDF मधून वचन शोधून काढतं.",
  "To get environmental clearance, each large project promised in writing to process its wet waste on site. VACHAN finds that promise in over a thousand public PDFs nobody reads.": "पर्यावरण मंजुरी मिळवण्यासाठी प्रत्येक मोठ्या प्रोजेक्टनं त्याचा ओला कचरा जागेवरच प्रोसेस करायचं लेखी वचन दिलं. कोणी न वाचणाऱ्या हजारभर सरकारी PDF मधून वचन शोधून काढतं.",
  "It goes to the builder or the ward office, with the page. Ward officers get a list of whom to check first.": "ते पेजसह बिल्डरकडे किंवा वॉर्ड ऑफिसकडे जातं. वॉर्ड अधिकाऱ्यांना आधी कोणाकडे जायचं याची यादी मिळते.",
  "of wet waste a day, promised in writing to be processed on site across Pune. Every plant that runs keeps that waste where it is made, instead of on trucks to the city's dumping grounds and waste plants.": "इतका ओला कचरा रोज, पुण्यात जागेवरच प्रोसेस करायचं लेखी वचन दिलेला. चालू असलेला प्रत्येक प्लांट तो कचरा जिथे तयार होतो तिथेच ठेवतो, शहराच्या डंपिंग ग्राउंड आणि प्लांटकडे ट्रकने जाण्याऐवजी.",
  "PCMC notices set fines for large societies that don't process wet waste.": "ओला कचरा जागेवर प्रोसेस न करणाऱ्या मोठ्या सोसायट्यांसाठी पिंपरी-चिंचवडच्या नोटिसांमध्ये दंड ठरवलेला आहे.",
  "{n} kg a flat a day, in the usual range": "फ्लॅटमागे रोज {n} किलो, नेहमीच्या मर्यादेत",
  "{n} kg a flat a day, outside 0.5 to 3": "फ्लॅटमागे रोज {n} किलो, ०.५ ते ३ च्या बाहेर",
  "Pune (PMC)": "पुणे (PMC)",
  "Pimpri-Chinchwad (PCMC)": "पिंपरी-चिंचवड (PCMC)",
  "{city}, ward {w}": "{city}, वॉर्ड {w}",

  // --- phone demo and waste methods ---
  "How to use VACHAN on your phone": "मोबाईलवर वचन कसं वापरायचं",
  "Type your area": "तुमचा भाग टाइप करा",
  "See promises near you": "जवळची वचनं बघा",
  "Open the promise and its page": "वचन आणि त्याचं पेज उघडा",
  "Officers print a check-first list": "अधिकारी 'आधी तपासा' यादी छापतात",
  "Organic waste converter (OWC)": "ऑरगॅनिक वेस्ट कन्व्हर्टर (OWC)",
  "In-situ composting": "जागेवरच कंपोस्टिंग",
  "Vermicomposting": "गांडूळ खत",
  "Biogas plant": "बायोगॅस प्लांट",
  "Composting on site": "जागेवरच कंपोस्टिंग",
  "Composted": "कंपोस्ट झालं",
  "Processed": "प्रोसेस झालं",
  "Printed": "छापलं",
  "on site": "जागेवरच",
  "Ward": "वॉर्ड",
  "kg a day": "किलो रोज",
  "a person must check": "माणसाने तपासावं",
  "Live data, not a mock-up.": "खरा डेटा, डेमो नाही.",

  // --- officer list and the reasons the pipeline writes ---
  "Projects in this ward that promised to process the most wet waste on site, largest first. Use it to choose where to visit first. Being on this list does not mean anything is wrong.": "या वॉर्डमधले जे प्रोजेक्ट सर्वाधिक ओला कचरा जागेवरच प्रक्रिया करण्याचे वचन देतात ते, सर्वांत मोठे आधी. आधी कुठे भेट द्यायची हे ठरवण्यासाठी ही यादी वापरा. या यादीत असणे म्हणजे काही चुकले आहे असे नाही.",
  "No recommended projects found in this ward.": "या वॉर्डमध्ये मंजुरीला गेलेले प्रोजेक्ट सापडले नाहीत.",
  "Project": "प्रोजेक्ट",
  "Wet waste a day": "ओला कचरा दररोज",
  "Promised": "वचन दिलेले",
  "Recommended": "शिफारस",
  "Source": "स्रोत",
  "Check first: {n} projects": "आधी तपासा: {n} प्रोजेक्ट",
  "Check first: {n} project": "आधी तपासा: {n} प्रोजेक्ट",
  "A person must check these: {n}": "हे माणसाने तपासावे: {n}",
  "Ward boundaries: the older PCMC layout, from DataMeet. Each row links to its promise and its page in the minutes.": "वॉर्डच्या सीमा: पिंपरी-चिंचवडची जुनी रचना, DataMeet कडून. प्रत्येक ओळ तिच्या वचनाशी आणि मिनिट्समधल्या पेजशी जोडलेली आहे.",
  "The promise list did not load.": "वचनांची यादी उघडली नाही.",
  "The data server did not answer. Try again in a minute.": "डेटा सर्व्हरने उत्तर दिले नाही. एका मिनिटानं पुन्हा प्रयत्न करा.",
  "The promise did not load.": "वचन उघडले नाही.",
  "The map did not load.": "नकाशा उघडला नाही.",
  "No promise with this link.": "या लिंकशी जुळणारे वचन नाही.",
  "Search for a project or address.": "प्रोजेक्ट किंवा पत्ता शोधा.",
  "Could not find this wet-waste figure in the minutes.": "हा ओल्या कचऱ्याचा आकडा मिनिट्समध्ये सापडला नाही.",
  "Could not tell the construction phase from the operation phase. A person must check this.": "कन्स्ट्रक्शन फेज आणि ऑपरेशन फेज यांतला फरक ओळखता आला नाही. हे माणसाने तपासावे.",
  "Could not read the committee's decision.": "समितीचा निर्णय वाचता आला नाही.",
  "Wet waste per flat is outside 0.5 to 3 kg a day.": "प्रत्येक फ्लॅटमागे ओला कचरा दररोज ०.५ ते ३ किलोच्या बाहेर आहे.",
  "The stated OWC capacity is below the promised wet waste.": "सांगितलेली प्लांटची क्षमता वचन दिलेल्या ओल्या कचऱ्यापेक्षा कमी आहे.",
  "Could not find this figure word for word": "हा आकडा जसाच्या तसा सापडला नाही",
  "Could not tell the operation phase from construction": "ऑपरेशन फेज आणि बांधकाम यांतला फरक ओळखता आला नाही",
  "Could not read the committee's decision": "समितीचा निर्णय वाचता आला नाही",
  "Stated plant capacity is below the promised waste": "सांगितलेली प्लांटची क्षमता वचन दिलेल्या कचऱ्यापेक्षा कमी आहे",
};

const hi: Dict = {
  // --- masthead and navigation ---
  "Residents": "निवासी",
  "Ward officers": "वार्ड अधिकारी",
  "How it works": "यह कैसे काम करता है",
  "VACHAN, home": "वचन, होम",
  "Search projects and addresses": "प्रोजेक्ट और पते खोजें",
  "Close": "बंद करें",
  "Language": "भाषा",

  // --- home ---
  "Read the fine print before you pay the fine.": "जुर्माना भरने से पहले बारीक अक्षरों में लिखी शर्तें पढ़ें।",
  "Did your builder promise to process your society's wet waste?": "क्या आपके बिल्डर ने आपकी सोसायटी का गीला कचरा साइट पर ही प्रोसेस करने का वादा किया था?",
  "Find the promise and its page. Then ask for the plant to run.": "वह वादा और उसका पेज खोजें। फिर प्लांट चालू करने को कहें।",
  "{owc} of the {total} Pune projects recommended for clearance did, in writing.": "मंज़ूरी के लिए भेजे गए {total} पुणे प्रोजेक्ट में से {owc} ने यह लिखित में किया।",
  "Pune's large housing projects did, in writing.": "पुणे की बड़ी आवासीय प्रोजेक्ट ने यह लिखित में किया।",
  "Find the promise": "वादा खोजें",
  "Area, project or builder": "क्षेत्र, प्रोजेक्ट या बिल्डर",
  "Search by area, address, project, builder or village": "क्षेत्र, पता, प्रोजेक्ट, बिल्डर या गाँव से खोजें",
  "or": "या",
  "try": "उदाहरण के लिए",
  "Not from Pune?": "पुणे से नहीं हैं?",
  "See a real promise": "एक असली वादा देखें",
  "{v} of {c} quotes re-checked against the government PDF.": "{c} में से {v} कोट सरकारी पीडीएफ से दोबारा मिलाए गए।",

  // --- the chain: problem to impact ---
  "The problem": "समस्या",
  "The solution": "समाधान",
  "How": "कैसे",
  "The outcome": "नतीजा",
  "The impact": "कुल असर",
  "Who is keeping the promise?": "वादा कौन निभा रहा है?",
  "of wet waste a day goes from Pune's housing societies and malls to city plants, says": "इतना गीला कचरा रोज़ पुणे की सोसायटियों और मॉल से शहर के प्लांटों तक जाता है, ऐसा कहना है",
  "In Pimpri-Chinchwad, notices set fines for large societies that don't process their own.": "पिंपरी-चिंचवड में, अपना कचरा साइट पर न प्रोसेस करने वाली बड़ी सोसायटियों के लिए नोटिस में जुर्माना तय है।",
  "Search your area": "अपना क्षेत्र खोजें",
  "See the promise and its page": "वादा और उसका पेज देखें",
  "Ask for the plant to run": "प्लांट चालू करने को कहें",
  "A letter that quotes the builder's own promise.": "ऐसा पत्र जो बिल्डर का अपना वादा कोट किया करता है।",

  // --- the two audiences ---
  "For residents and flat buyers": "रहने वालों और फ्लैट खरीदने वालों के लिए",
  "For ward officers": "वार्ड अधिकारियों के लिए",
  "Your society got a wet-waste notice, or you are about to buy a flat.": "आपकी सोसायटी को गीले कचरे का नोटिस मिला है, या आप फ्लैट खरीदने वाले हैं।",
  "See what your builder promised in writing, and the page": "देखें आपके बिल्डर ने लिखित में क्या वादा किया, और वह पेज",
  "Send a letter asking for the plant to run": "प्लांट चालू करने को कहता पत्र भेजें",
  "Share it with your society group": "इसे अपनी सोसायटी के समूह में शेयर करें",
  "Find your building's promise": "अपनी इमारत का वादा खोजें",
  "A list for your ward, biggest written promises first": "आपके वार्ड की सूची, सबसे बड़े लिखित वादे पहले",
  "Each row links to its page in the minutes": "हर पंक्ति मीटिंग के रिकॉर्ड में अपने पेज से जुड़ी है",
  "Print it for field visits.": "फील्ड विज़िट के लिए इसे छापें।",
  "Open the ward list": "वार्ड सूची खोलें",

  // --- map ---
  "Every dot is a written promise": "हर बिंदु एक लिखित वादा है",
  "bigger dot = more wet waste promised": "बड़ा बिंदु = ज़्यादा गीले कचरे का वादा",
  "hollow = a person must check": "खोखला = इसे किसी व्यक्ति को जाँचना है",
  "Zoom in": "पास लाएँ",
  "Zoom out": "दूर करें",
  "Whole city": "पूरा शहर",
  "A person must check this": "इसे किसी व्यक्ति को जाँचना है",
  "wet waste a day promised": "गीला कचरा रोज़, वादा किया गया",

  // --- the card ---
  "What the builder promised in writing": "बिल्डर ने लिखित में क्या वादा किया",
  "of wet waste a day": "गीला कचरा रोज़",
  "promised in writing to be processed on site:": "साइट पर ही प्रोसेस करने का लिखित वादा:",
  "The builder promised in writing to process this waste on site. Ask whether the plant is built and running.": "बिल्डर ने यह कचरा साइट पर ही प्रोसेस करने का लिखित वादा किया। पूछें कि प्लांट बना है या नहीं और चल रहा है या नहीं।",
  "If this plant runs, {t} tonnes a year stays where it is made, instead of on trucks to the city's dumping grounds.": "यह प्लांट चले तो साल में {t} टन कचरा वहीं रहेगा जहाँ बनता है, शहर की डंपिंग ग्राउंड तक ट्रक से जाने के बजाय।",
  "Send to my society group": "मेरी सोसायटी के समूह में भेजें",
  "A free letter to the builder or ward office, in English, मराठी or हिंदी. No sign-in.": "बिल्डर या वार्ड कार्यालय के लिए मुफ़्त पत्र — अंग्रेज़ी, मराठी या हिंदी में। कोई साइन-इन नहीं।",
  "From the minutes": "मीटिंग के रिकॉर्ड से",
  "Operation Phase": "संचालन चरण",
  "Operation phase, not construction": "संचालन चरण, निर्माण नहीं",
  "See it on page {p}": "पेज {p} पर देखें",
  "Open the page and check it yourself": "पेज खोलें और खुद जाँचें",
  "Original on PARIVESH": "परिवेश पर मूल दस्तावेज़",
  "Builder:": "बिल्डर:",
  "Flats:": "फ्लैट:",
  "Proposal:": "प्रस्ताव:",
  "Recommended for clearance:": "मंज़ूरी के लिए भेजा गया:",
  "Committee meeting:": "समिति की बैठक:",
  "Spotted a mistake on this card?": "इस कार्ड में कोई गलती दिखी?",
  "Tell us": "हमें बताएँ",
  ", with the page it is on.": ", उस पेज के साथ जिस पर वह है।",
  "Search another building": "दूसरी इमारत खोजें",
  "Checks": "जाँचें",
  "Found word for word in the minutes": "मीटिंग के रिकॉर्ड में हूबहू मिला",
  "Recommended for clearance": "मंज़ूरी के लिए भेजा गया",
  "Plant capacity covers the promised waste": "प्लांट की क्षमता वादा किए गए कचरे के लिए पर्याप्त है",
  "On page {p}": "पेज {p} पर",
  "Read by machine, checks passed": "मशीन ने पढ़ा, जाँचें पास हुईं",
  "as read by machine": "जैसा मशीन ने पढ़ा",

  // --- the pdf viewer ---
  "Page {p} of the minutes": "मीटिंग के रिकॉर्ड का पेज {p}",
  "The promise is highlighted where it is printed.": "वादा जहाँ छपा है वहीं उजागर किया गया है।",
  "The quoted line is on this page.": "कोट किया पंक्ति इसी पेज पर है।",
  "Opening the page…": "पेज खुल रहा है…",
  "The page would not open here. Use the link below.": "यह पेज यहाँ नहीं खुला। नीचे दिया लिंक इस्तेमाल करें।",
  "Open the full PDF": "पूरी पीडीएफ खोलें",

  // --- the letter ---
  "Who should we ask?": "हम किससे पूछें?",
  "the builder": "बिल्डर",
  "ward office": "वार्ड कार्यालय",
  "Write my letter": "मेरा पत्र लिखें",
  "Drafting from the minutes…": "मीटिंग के रिकॉर्ड से मसौदा बन रहा है…",
  "Your letter": "आपका पत्र",
  "Drafted by Amazon Bedrock from the minutes.": "मीटिंग के रिकॉर्ड से Amazon Bedrock ने मसौदा बनाया।",
  "Read it before you send.": "भेजने से पहले इसे पढ़ें।",
  "Copy letter": "पत्र कॉपी करें",
  "Copied": "कॉपी हो गया",
  "Send on WhatsApp": "व्हाट्सएप पर भेजें",
  "Send by email": "ईमेल से भेजें",
  "Show all": "सब दिखाएँ",
  "Letter text, you can edit it": "पत्र का टेक्स्ट, आप इसे एडिट कर सकते हैं",
  "The letter could not be drafted.": "पत्र का मसौदा नहीं बन सका।",
  "The promise and the page are still here.": "वादा और उसका पेज यहीं हैं।",
  "Try again": "फिर कोशिश करें",

  // --- sharing ---
  "Copy link": "लिंक कॉपी करें",
  "Link copied": "लिंक कॉपी हो गया",
  "The link opens this page with the PDF page.": "यह लिंक इस पेज को पीडीएफ के पेज सहित खोलता है।",

  // --- officer ---
  "Ward {w}: which projects to check first": "वार्ड {w}: पहले कौन-से प्रोजेक्ट जाँचें",
  "For PCMC ward officers planning visits to large societies": "बड़ी सोसायटियों के दौरे तय करने वाले पिंपरी-चिंचवड वार्ड अधिकारियों के लिए",
  "Print this list": "यह सूची छापें",

  // --- states ---
  "Reading the minutes…": "मीटिंग के रिकॉर्ड पढ़ा जा रहा है…",
  "No projects match this search.": "इस खोज से कोई प्रोजेक्ट मेल नहीं खाता।",
  "Search still works.": "खोज अब भी काम करती है।",

  // --- map section and closing ---
  "PCMC is surveying about 1,155 large waste generators. Where do you start?": "पिंपरी-चिंचवड करीब 1,155 बड़े कचरा पैदा करने वालों का सर्वे कर रहा है। शुरुआत कहाँ से करें?",
  "{n} housing project sites in Pune (PMC) and Pimpri-Chinchwad (PCMC). A bigger dot means more wet waste promised. A hollow dot means a person must check it.": "पुणे (PMC) और पिंपरी-चिंचवड (PCMC) में {n} हाउसिंग प्रोजेक्ट की जगहें। बड़ा बिंदु यानी ज़्यादा गीले कचरे का वादा। खोखला बिंदु यानी उसे किसी व्यक्ति को जाँचना है।",
  "Housing project sites in Pune (PMC) and Pimpri-Chinchwad (PCMC). A bigger dot means more wet waste promised. A hollow dot means a person must check it.": "पुणे (PMC) और पिंपरी-चिंचवड (PCMC) में हाउसिंग प्रोजेक्ट की जगहें। बड़ा बिंदु यानी ज़्यादा गीले कचरे का वादा। खोखला बिंदु यानी उसे किसी व्यक्ति को जाँचना है।",
  "How we find and check each promise": "हर वादा हम कैसे ढूँढते और जाँचते हैं",
  "Is your society's plant running?": "क्या आपकी सोसायटी का प्लांट चल रहा है?",
  "Find what your builder promised in writing, and the page it is on.": "ढूँढें कि आपके बिल्डर ने लिखित में क्या वादा किया, और वह किस पेज पर है।",
  "Open one to see the page and ask for the plant to run.": "पेज देखने और प्लांट चालू करने को कहने के लिए कोई एक खोलें।",
  "A promise is not proof that a plant was built or runs.": "वादा इस बात का प्रमाण नहीं कि प्लांट बना या चल रहा है।",

  // --- chain and card details ---
  "From the problem to the impact": "समस्या से असर तक",
  "To get environmental clearance, {owc} of the {total} Pune projects promised in writing to process their wet waste on site. VACHAN finds that promise in over a thousand public PDFs nobody reads.": "पर्यावरण मंजूरी के लिए {total} में से {owc} पुणे प्रोजेक्ट ने अपना गीला कचरा साइट पर ही प्रोसेस करने का लिखित वादा किया। जिन्हें कोई नहीं पढ़ता, ऐसी हज़ार से ज़्यादा सरकारी PDF में से वचन यह वादा ढूँढ निकालता है।",
  "To get environmental clearance, each large project promised in writing to process its wet waste on site. VACHAN finds that promise in over a thousand public PDFs nobody reads.": "पर्यावरण मंजूरी के लिए हर बड़े प्रोजेक्ट ने अपना गीला कचरा साइट पर ही प्रोसेस करने का लिखित वादा किया। जिन्हें कोई नहीं पढ़ता, ऐसी हज़ार से ज़्यादा सरकारी PDF में से वचन यह वादा ढूँढ निकालता है।",
  "It goes to the builder or the ward office, with the page. Ward officers get a list of whom to check first.": "यह पेज के साथ बिल्डर या वार्ड ऑफिस को जाता है। वार्ड अधिकारियों को मिलती है सूची कि पहले किसके पास जाना है।",
  "of wet waste a day, promised in writing to be processed on site across Pune. Every plant that runs keeps that waste where it is made, instead of on trucks to the city's dumping grounds and waste plants.": "इतना गीला कचरा रोज़, पुणे भर में साइट पर ही प्रोसेस करने का लिखित वादा किया हुआ। चलता हुआ हर प्लांट उस कचरे को वहीं रखता है जहाँ बनता है, शहर की डंपिंग ग्राउंड और प्लांट तक ट्रक से जाने के बजाय।",
  "PCMC notices set fines for large societies that don't process wet waste.": "गीला कचरा साइट पर प्रोसेस न करने वाली बड़ी सोसायटियों के लिए पिंपरी-चिंचवड के नोटिस में जुर्माना तय है।",
  "{n} kg a flat a day, in the usual range": "प्रति फ्लैट रोज़ {n} किलो, सामान्य दायरे में",
  "{n} kg a flat a day, outside 0.5 to 3": "प्रति फ्लैट रोज़ {n} किलो, 0.5 से 3 के बाहर",
  "Pune (PMC)": "पुणे (PMC)",
  "Pimpri-Chinchwad (PCMC)": "पिंपरी-चिंचवड (PCMC)",
  "{city}, ward {w}": "{city}, वार्ड {w}",

  // --- phone demo and waste methods ---
  "How to use VACHAN on your phone": "मोबाइल पर वचन कैसे इस्तेमाल करें",
  "Type your area": "अपना इलाक़ा टाइप करें",
  "See promises near you": "आस-पास के वादे देखें",
  "Open the promise and its page": "वादा और उसका पेज खोलें",
  "Officers print a check-first list": "अधिकारी 'पहले जाँचें' सूची छापते हैं",
  "Organic waste converter (OWC)": "ऑर्गेनिक वेस्ट कन्वर्टर (OWC)",
  "In-situ composting": "साइट पर ही कंपोस्टिंग",
  "Vermicomposting": "केंचुआ खाद",
  "Biogas plant": "बायोगैस प्लांट",
  "Composting on site": "साइट पर ही कंपोस्टिंग",
  "Composted": "कंपोस्ट हुआ",
  "Processed": "प्रोसेस हुआ",
  "Printed": "छप गया",
  "on site": "साइट पर ही",
  "Ward": "वार्ड",
  "kg a day": "किलो रोज़",
  "a person must check": "किसी व्यक्ति को जाँचना है",
  "Live data, not a mock-up.": "असली डेटा, डेमो नहीं।",

  // --- officer list and the reasons the pipeline writes ---
  "Projects in this ward that promised to process the most wet waste on site, largest first. Use it to choose where to visit first. Being on this list does not mean anything is wrong.": "इस वार्ड के वे प्रोजेक्ट जिन्होंने सबसे ज़्यादा गीला कचरा साइट पर प्रोसेस करने का वादा किया, सबसे बड़े पहले। पहले कहाँ जाना है यह तय करने के लिए इसका उपयोग करें। इस सूची में होने का मतलब यह नहीं कि कुछ गलत है।",
  "No recommended projects found in this ward.": "इस वार्ड में मंज़ूरी के लिए भेजे गए प्रोजेक्ट नहीं मिले।",
  "Project": "प्रोजेक्ट",
  "Wet waste a day": "गीला कचरा रोज़",
  "Promised": "वादा किया गया",
  "Recommended": "मंज़ूरी के लिए भेजा गया",
  "Source": "स्रोत",
  "Check first: {n} projects": "पहले जाँचें: {n} प्रोजेक्ट",
  "Check first: {n} project": "पहले जाँचें: {n} प्रोजेक्ट",
  "A person must check these: {n}": "इन्हें किसी व्यक्ति को जाँचना है: {n}",
  "Ward boundaries: the older PCMC layout, from DataMeet. Each row links to its promise and its page in the minutes.": "वार्ड सीमाएँ: पिंपरी-चिंचवड का पुराना ढाँचा, DataMeet से। हर पंक्ति अपने वादे और मीटिंग के रिकॉर्ड के पेज से जुड़ी है।",
  "The promise list did not load.": "वादों की सूची नहीं खुली।",
  "The data server did not answer. Try again in a minute.": "डेटा सर्वर ने जवाब नहीं दिया। एक मिनट बाद फिर कोशिश करें।",
  "The promise did not load.": "वादा नहीं खुला।",
  "The map did not load.": "नक्शा नहीं खुला।",
  "No promise with this link.": "इस लिंक से कोई वादा नहीं मिला।",
  "Search for a project or address.": "कोई प्रोजेक्ट या पता खोजें।",
  "Could not find this wet-waste figure in the minutes.": "यह गीले कचरे का आँकड़ा मीटिंग के रिकॉर्ड में नहीं मिला।",
  "Could not tell the construction phase from the operation phase. A person must check this.": "निर्माण चरण और संचालन चरण का अंतर पता नहीं चला। इसे किसी व्यक्ति को जाँचना है।",
  "Could not read the committee's decision.": "समिति का निर्णय पढ़ा नहीं जा सका।",
  "Wet waste per flat is outside 0.5 to 3 kg a day.": "प्रति फ्लैट गीला कचरा रोज़ 0.5 से 3 किलो की सीमा से बाहर है।",
  "The stated OWC capacity is below the promised wet waste.": "बताई गई प्लांट क्षमता वादा किए गए गीले कचरे से कम है।",
  "Could not find this figure word for word": "यह आँकड़ा हूबहू नहीं मिला",
  "Could not tell the operation phase from construction": "संचालन चरण और निर्माण का अंतर पता नहीं चला",
  "Could not read the committee's decision": "समिति का निर्णय पढ़ा नहीं जा सका",
  "Stated plant capacity is below the promised waste": "बताई गई प्लांट क्षमता वादा किए गए कचरे से कम है",
};

const DICT: Record<Exclude<Lang, "en">, Dict> = { mr, hi };
export const dictionaries = DICT;
