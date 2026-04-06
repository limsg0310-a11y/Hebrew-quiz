import { useState, useRef, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};
const fbApp  = initializeApp(firebaseConfig);
const fbAuth = getAuth(fbApp);
const fbDb   = getFirestore(fbApp);

let XLSX_LIB = null;
async function getXLSX() {
  if (XLSX_LIB) return XLSX_LIB;
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload = () => { XLSX_LIB = window.XLSX; resolve(window.XLSX); };
    document.head.appendChild(s);
  });
}

const DEFAULT_WORDS = [
  { id: 1, hebrew: "שָׁלוֹם",    meaning: "평화 / 안녕",  status: "learning", streak: 0, wrongCount: 0 },
  { id: 2, hebrew: "תּוֹדָה",    meaning: "감사합니다",    status: "learning", streak: 0, wrongCount: 0 },
  { id: 3, hebrew: "בְּרֵאשִׁית", meaning: "태초에",       status: "learning", streak: 0, wrongCount: 0 },
  { id: 4, hebrew: "אֱלֹהִים",   meaning: "하나님",       status: "learning", streak: 0, wrongCount: 0 },
  { id: 5, hebrew: "אֶרֶץ",      meaning: "땅 / 나라",    status: "learning", streak: 0, wrongCount: 0 },
  { id: 6, hebrew: "מַיִם",      meaning: "물",           status: "learning", streak: 0, wrongCount: 0 },
  { id: 7, hebrew: "אוֹר",       meaning: "빛",           status: "learning", streak: 0, wrongCount: 0 },
  { id: 8, hebrew: "לֵב",        meaning: "마음 / 심장",  status: "learning", streak: 0, wrongCount: 0 },
];

const MODES = { LIST:"list", QUIZ:"quiz", ESSAY:"essay", RESULT:"result", ESSAY_RESULT:"essay_result", VARIANT:"variant", VARIANT_RESULT:"variant_result" };
const QUIZ_TYPES = { HEB_TO_MEAN:"heb_to_mean", MEAN_TO_HEB:"mean_to_heb", MIXED:"mixed" };
const QUIZ_FILTERS = { ALL:"all", LEARNING_ONLY:"learning_only", EXCLUDE_MASTERED:"exclude_mastered", HARD_ONLY:"hard_only" };

const VARIANT_TYPES = [
  { id:"gender_f",  label:{ko:"여성형 단수 (היא)",en:"Feminine sg."},   prompt:{ko:"여성형 단수는?",en:"Feminine singular?"} },
  { id:"gender_m",  label:{ko:"남성형 단수 (הוא)",en:"Masculine sg."},  prompt:{ko:"남성형 단수는?",en:"Masculine singular?"} },
  { id:"plural_m",  label:{ko:"남성형 복수 (הם)",en:"Masculine pl."},   prompt:{ko:"남성형 복수는?",en:"Masculine plural?"} },
  { id:"plural_f",  label:{ko:"여성형 복수 (הן)",en:"Feminine pl."},    prompt:{ko:"여성형 복수는?",en:"Feminine plural?"} },
  { id:"past_1s",   label:{ko:"과거 — 나 (אני)",en:"Past — I"},         prompt:{ko:"אני — 나는 ~했다",en:"אני (past)"} },
  { id:"past_2ms",  label:{ko:"과거 — 너M (אתה)",en:"Past — You M"},    prompt:{ko:"אתה — 너는 ~했다",en:"אתה (past)"} },
  { id:"past_2fs",  label:{ko:"과거 — 너F (את)",en:"Past — You F"},     prompt:{ko:"את — 너는 ~했다",en:"את (past)"} },
  { id:"past_3ms",  label:{ko:"과거 — 그 (הוא)",en:"Past — He"},        prompt:{ko:"הוא — 그는 ~했다",en:"הוא (past)"} },
  { id:"past_3fs",  label:{ko:"과거 — 그녀 (היא)",en:"Past — She"},     prompt:{ko:"היא — 그녀는 ~했다",en:"היא (past)"} },
  { id:"past_1p",   label:{ko:"과거 — 우리 (אנחנו)",en:"Past — We"},    prompt:{ko:"אנחנו — 우리는 ~했다",en:"אנחנו (past)"} },
  { id:"past_2mp",  label:{ko:"과거 — 너희M (אתם)",en:"Past — You pl.M"},prompt:{ko:"אתם — 너희는 ~했다",en:"אתם (past)"} },
  { id:"past_2fp",  label:{ko:"과거 — 너희F (אתן)",en:"Past — You pl.F"},prompt:{ko:"אתן — 너희는 ~했다",en:"אתן (past)"} },
  { id:"past_3mp",  label:{ko:"과거 — 그들M (הם)",en:"Past — They M"}, prompt:{ko:"הם — 그들은 ~했다",en:"הם (past)"} },
  { id:"past_3fp",  label:{ko:"과거 — 그들F (הן)",en:"Past — They F"}, prompt:{ko:"הן — 그들은 ~했다",en:"הן (past)"} },
  { id:"pres_ms",   label:{ko:"현재 — M단수",en:"Present — M sg."},    prompt:{ko:"현재 남단?",en:"M sg. (present)"} },
  { id:"pres_fs",   label:{ko:"현재 — F단수",en:"Present — F sg."},    prompt:{ko:"현재 여단?",en:"F sg. (present)"} },
  { id:"pres_mp",   label:{ko:"현재 — M복수",en:"Present — M pl."},    prompt:{ko:"현재 남복?",en:"M pl. (present)"} },
  { id:"pres_fp",   label:{ko:"현재 — F복수",en:"Present — F pl."},    prompt:{ko:"현재 여복?",en:"F pl. (present)"} },
  { id:"fut_1s",    label:{ko:"미래 — 나 (אני)",en:"Future — I"},        prompt:{ko:"אני — 나는 ~할 것",en:"אני (future)"} },
  { id:"fut_2ms",   label:{ko:"미래 — 너M (אתה)",en:"Future — You M"},  prompt:{ko:"אתה — 너는 ~할 것",en:"אתה (future)"} },
  { id:"fut_2fs",   label:{ko:"미래 — 너F (את)",en:"Future — You F"},   prompt:{ko:"את — 너는 ~할 것",en:"את (future)"} },
  { id:"fut_3ms",   label:{ko:"미래 — 그 (הוא)",en:"Future — He"},      prompt:{ko:"הוא — 그는 ~할 것",en:"הוא (future)"} },
  { id:"fut_3fs",   label:{ko:"미래 — 그녀 (היא)",en:"Future — She"},   prompt:{ko:"היא — 그녀는 ~할 것",en:"היא (future)"} },
  { id:"fut_1p",    label:{ko:"미래 — 우리 (אנחנו)",en:"Future — We"},  prompt:{ko:"아나흐누 — 우리는 ~할 것",en:"אנחנו (future)"} },
  { id:"fut_2mp",   label:{ko:"미래 — 너희M (אתם)",en:"Future — You pl.M"},prompt:{ko:"아템 — 너희는 ~할 것",en:"אתם (future)"} },
  { id:"fut_2fp",   label:{ko:"미래 — 너희F (אתן)",en:"Future — You pl.F"},prompt:{ko:"아텐 — 너희는 ~할 것",en:"אתן (future)"} },
  { id:"fut_3mp",   label:{ko:"미래 — 그들M (הם)",en:"Future — They M"},prompt:{ko:"헴 — 그들은 ~할 것",en:"הם (future)"} },
  { id:"fut_3fp",   label:{ko:"미래 — 그들F (הן)",en:"Future — They F"},prompt:{ko:"헨 — 그들은 ~할 것",en:"הן (future)"} },
  { id:"imp_2ms",   label:{ko:"명령 — 너M (אתה)",en:"Imp. — You M"},   prompt:{ko:"아타 — ~해라!",en:"אתה — Do!"} },
  { id:"imp_2fs",   label:{ko:"명령 — 너F (את)",en:"Imp. — You F"},    prompt:{ko:"앗 — ~해라!",en:"את — Do!"} },
  { id:"imp_2mp",   label:{ko:"명령 — 너희M (אתם)",en:"Imp. — You pl.M"},prompt:{ko:"아템 — ~해라!",en:"אתם — Do!"} },
  { id:"imp_2fp",   label:{ko:"명령 — 너희F (אתן)",en:"Imp. — You pl.F"},prompt:{ko:"아텐 — ~해라!",en:"אתן — Do!"} },
  { id:"poss_1s",   label:{ko:"소유 — 나의 (שלי)",en:"Poss. — My"},     prompt:{ko:"나의 ~?",en:"My ~?"} },
  { id:"poss_2ms",  label:{ko:"소유 — 너의M (שלך)",en:"Poss. — Your M"},prompt:{ko:"너의 ~(남)?",en:"Your (M) ~?"} },
  { id:"poss_2fs",  label:{ko:"소유 — 너의F (שלך)",en:"Poss. — Your F"},prompt:{ko:"너의 ~(여)?",en:"Your (F) ~?"} },
  { id:"poss_3ms",  label:{ko:"소유 — 그의 (שלו)",en:"Poss. — His"},    prompt:{ko:"그의 ~?",en:"His ~?"} },
  { id:"poss_3fs",  label:{ko:"소유 — 그녀의 (שלה)",en:"Poss. — Her"},  prompt:{ko:"그녀의 ~?",en:"Her ~?"} },
  { id:"poss_1p",   label:{ko:"소유 — 우리의 (שלנו)",en:"Poss. — Our"}, prompt:{ko:"우리의 ~?",en:"Our ~?"} },
  { id:"poss_2mp",  label:{ko:"소유 — 너희의M (שלכם)",en:"Poss. — Your pl.M"},prompt:{ko:"너희의 ~(남)?",en:"Your pl. (M) ~?"} },
  { id:"poss_2fp",  label:{ko:"소유 — 너희의F (שלכן)",en:"Poss. — Your pl.F"},prompt:{ko:"너희의 ~(여)?",en:"Your pl. (F) ~?"} },
  { id:"poss_3mp",  label:{ko:"소유 — 그들의M (שלהם)",en:"Poss. — Their M"},prompt:{ko:"그들의 ~(남)?",en:"Their (M) ~?"} },
  { id:"poss_3fp",  label:{ko:"소유 — 그들의F (שלהן)",en:"Poss. — Their F"},prompt:{ko:"그들의 ~(여)?",en:"Their (F) ~?"} },
  { id:"infinitive",label:{ko:"to부정사 (ל...)",en:"Infinitive (ל...)"},  prompt:{ko:"동사 원형은?",en:"Infinitive form?"} },
];

const WIDE_VARIANT_HEADER_MAP = {
  "여성형":"gender_f","gender_f":"gender_f","feminine":"gender_f",
  "남성형":"gender_m","gender_m":"gender_m","masculine":"gender_m",
  "복수 남성형":"plural_m","plural_m":"plural_m",
  "복수 여성형":"plural_f","plural_f":"plural_f",
  "소유 1인칭":"poss_1s","poss_1s":"poss_1s",
  "소유 2인칭(남)":"poss_2ms","poss_2ms":"poss_2ms",
  "소유 2인칭(여)":"poss_2fs","poss_2fs":"poss_2fs",
  "소유 3인칭(남)":"poss_3ms","poss_3ms":"poss_3ms",
  "소유 3인칭(여)":"poss_3fs","poss_3fs":"poss_3fs",
};

function normalizeHeader(h) {
  return String(h).replace(/\n.*$/,"").replace(/\(.*?\)/g,"").trim().toLowerCase();
}

function parseVariantExcel(rows) {
  if (!rows.length) return {};
  const header = rows[0].map(h => String(h||""));
  const result = {};
  const variantCols = [];
  for (let ci = 2; ci < header.length; ci++) {
    const norm = normalizeHeader(header[ci]);
    const mapped = WIDE_VARIANT_HEADER_MAP[norm] || WIDE_VARIANT_HEADER_MAP[header[ci].toLowerCase()];
    if (mapped) variantCols.push({ colIdx: ci, type: mapped });
  }
  for (let i = 1; i < rows.length; i++) {
    const heb  = String(rows[i][0]||"").trim();
    const mean = String(rows[i][1]||"").trim();
    if (!heb) continue;
    if (!result[heb]) result[heb] = { meaning: mean, variants: [] };
    for (const { colIdx, type } of variantCols) {
      const form = String(rows[i][colIdx]||"").trim();
      if (form) result[heb].variants.push({ type, form });
    }
  }
  return result;
}

const VARIANT_CATS = [
  { id:"gender",    label:{ko:"성별 변형",    en:"Gender"},       color:"#E84A5F", types:["gender_f","gender_m"] },
  { id:"plural",    label:{ko:"단수/복수",    en:"Plural"},       color:"#5B9CF6", types:["plural_m","plural_f"] },
  { id:"infinitive",label:{ko:"to부정사",     en:"Infinitive"},   color:"#50C898", types:["infinitive"] },
  { id:"present",   label:{ko:"현재형",       en:"Present"},      color:"#50C898", types:["pres_ms","pres_fs","pres_mp","pres_fp"] },
  { id:"past",      label:{ko:"과거형",       en:"Past"},         color:"#FF9A6C", types:["past_1s","past_2ms","past_2fs","past_3ms","past_3fs","past_1p","past_2mp","past_2fp","past_3mp","past_3fp"] },
  { id:"future",    label:{ko:"미래형",       en:"Future"},       color:"#5B9CF6", types:["fut_1s","fut_2ms","fut_2fs","fut_3ms","fut_3fs","fut_1p","fut_2mp","fut_2fp","fut_3mp","fut_3fp"] },
  { id:"imperative",label:{ko:"명령형",       en:"Imperative"},   color:"#E84A5F", types:["imp_2ms","imp_2fs","imp_2mp","imp_2fp"] },
  { id:"poss",      label:{ko:"소유격",       en:"Possessive"},   color:"#A78BFA", types:["poss_1s","poss_2ms","poss_2fs","poss_3ms","poss_3fs","poss_1p","poss_2mp","poss_2fp","poss_3mp","poss_3fp"] },
];

const WORD_TYPES = [
  { id:"verb",    label:{ko:"동사",   en:"Verb"},      emoji:"🔵", cats:["infinitive","past","present","future","imperative"], hint:{ko:"예: לָלֶכֶת (가다)", en:"e.g. to go"} },
  { id:"noun",    label:{ko:"명사",   en:"Noun"},      emoji:"🟡", cats:["gender","plural","poss"], hint:{ko:"예: בַּיִת (집)", en:"e.g. house"} },
  { id:"adj",     label:{ko:"형용사", en:"Adjective"}, emoji:"🟠", cats:["gender","plural"], hint:{ko:"예: גָּדוֹל (큰)", en:"e.g. big"} },
  { id:"pronoun", label:{ko:"대명사", en:"Pronoun"},   emoji:"🟣", cats:["gender","plural"], hint:{ko:"예: אֲנִי (나)", en:"e.g. I, he"} },
  { id:"other",   label:{ko:"기타",   en:"Other"},     emoji:"⚪", cats:["gender","plural","poss"], hint:{ko:"부사, 전치사 등", en:"adverb, prep."} },
];

function getAllowedCats(wordType) {
  if(!wordType) return VARIANT_CATS;
  const wt = WORD_TYPES.find(t=>t.id===wordType);
  if(!wt) return VARIANT_CATS;
  return VARIANT_CATS.filter(c=>wt.cats.includes(c.id));
}

const VARIANT_PASTE_ORDER = [
  "gender_f","gender_m","plural_m","plural_f",
  "past_1s","past_2ms","past_2fs","past_3ms","past_3fs","past_1p","past_2mp","past_2fp","past_3mp","past_3fp",
  "pres_ms","pres_fs","pres_mp","pres_fp",
  "fut_1s","fut_2ms","fut_2fs","fut_3ms","fut_3fs","fut_1p","fut_2mp","fut_2fp","fut_3mp","fut_3fp",
  "imp_2ms","imp_2fs","imp_2mp","imp_2fp",
  "poss_1s","poss_2ms","poss_2fs","poss_3ms","poss_3fs","poss_1p","poss_2mp","poss_2fp","poss_3mp","poss_3fp",
  "infinitive"
];

function getAllowedPasteOrder(wordType) {
  const allowed = new Set(getAllowedCats(wordType).flatMap(c=>c.types));
  return VARIANT_PASTE_ORDER.filter(t=>allowed.has(t));
}

const BOOKS = [
  { id:"hebrew",  label:{ko:"히브리어",en:"Hebrew"},  emoji:"🇮🇱", color:"#FF9A6C", ttsLang:"he-IL", ttsName:"he-IL-Neural2-A", ttsRate:0.9,
    termA:{ko:"히브리어",en:"Word"}, termB:{ko:"뜻",en:"Meaning"},
    placeholderA:{ko:"עברית (히브리어)",en:"Hebrew word"}, placeholderB:{ko:"뜻 (한국어/영어)",en:"Meaning"}, dir:"rtl" },
  { id:"english", label:{ko:"영어",en:"English"}, emoji:"🇺🇸", color:"#5B9CF6", ttsLang:"en-US", ttsName:"en-US-Standard-C", ttsRate:0.9,
    termA:{ko:"영어 단어",en:"English word"}, termB:{ko:"뜻 (한국어)",en:"Korean meaning"},
    placeholderA:{ko:"English word",en:"English word"}, placeholderB:{ko:"뜻 (한국어)",en:"Korean meaning"}, dir:"ltr" },
  { id:"korean",  label:{ko:"한국어",en:"Korean"}, emoji:"🇰🇷", color:"#E84A5F", ttsLang:"ko-KR", ttsName:"ko-KR-Standard-A", ttsRate:0.9,
    termA:{ko:"한국어 단어",en:"Korean word"}, termB:{ko:"뜻 (영어)",en:"English meaning"},
    placeholderA:{ko:"한국어 단어",en:"Korean word"}, placeholderB:{ko:"뜻 (영어)",en:"English meaning"}, dir:"ltr" },
];

const UI_TEXT = {
  ko:{
    appTitle:"히브리어 단어 퀴즈", appSub:"Hebrew Vocabulary Trainer",
    addWord:"+ 단어 추가", editWord:"단어 수정 중", addBtn:"추가", editBtn:"수정 완료", cancelBtn:"취소",
    saveLoad:"저장 / 불러오기", telegramTip:"파일 저장 안 되면 복사 사용",
    fileSave:"⬇ 파일 저장", copy:"복사", fileOpen:"⬆ 불러오기", paste:"붙여넣기", textAdd:"텍스트", csvExcel:"CSV/엑셀",
    searchPlaceholder:"검색...", all:"전체", learning:"학습중", hard:"어려움", done:"완료",
    selectAll:"전체 선택", deselect:"선택 해제", deleteN:(n)=>`${n}개 삭제`, wordCount:(n)=>`${n}개`,
    mcqTitle:"객관식 퀴즈", direction:"문제 방향", wordRange:"단어 범위", questionCount:"문제 수",
    dirAtoB:(b)=>`${b.termA.ko} → ${b.termB.ko}`, dirBtoA:(b)=>`${b.termB.ko} → ${b.termA.ko}`, mixed:"랜덤 혼합",
    allRange:(n)=>`전체 (${n})`, excludeMastered:(n)=>`암기 제외 (${n})`, hardOnly:(n)=>`어려운 것만 (${n})`,
    startMCQ:(n)=>`시작 — ${n}문제`, needMore:(n)=>`단어 최소 4개 필요 (현재 ${n}개)`,
    essayTitle:"서술형 시험", essaySub:"직접 타이핑! 부분 정답도 인정됩니다.",
    dirAtoB_e:(b)=>`${b.termA.ko} → ${b.termB.ko} 입력`, dirBtoA_e:(b)=>`${b.termB.ko} → ${b.termA.ko} 입력`,
    startEssay:(n)=>`서술형 시작 — ${n}문제`,
    questionTagAtoB:(b)=>`${b.termA.ko}의 ${b.termB.ko}는?`, questionTagBtoA:(b)=>`${b.termB.ko}에 해당하는 ${b.termA.ko}는?`,
    inputPlaceholderA:(b)=>`${b.termB.ko}을 입력하세요...`, inputPlaceholderB:(b)=>`${b.termA.ko}로 입력하세요...`,
    correct:"정답", wrong:(a)=>`오답 — 정답: ${a}`,
    confirm:"확인", next:"다음 →", finish:"결과 보기", quit:"그만하기",
    autoSaveLocal:"이 기기에만 저장됩니다 — Google 로그인하면 모든 기기 동기화",
    autoSaveCloud:(name)=>`${name}의 단어장 — 모든 기기 자동 동기화`,
    login:"Google 로그인", logout:"로그아웃", saving:"저장중...",
    directInput:"직접:",
    importWords:"단어 가져오기", importSearch:"뜻으로 히브리어 검색",
    reversoImport:"Reverso 동사 변형", rootSearch:"어근으로 검색 (Pealim)",
    verbForm:"동사변형 양식 불러오기", formDownload:"양식 다운로드",
    refreshVariants:"변형 다시 불러오기",
    cardStyle:"카드:", menuStyle:"메뉴", inlineStyle:"인라인",
    addToWordbook:"단어장 선택",
    sortDefault:"기본", sortHebAsc:"히브리어 ↑", sortHebDesc:"히브리어 ↓",
    sortMeanAsc:"뜻 ↑", sortMeanDesc:"뜻 ↓", sortHardFirst:"어려운 것 먼저",
    sortMasteredFirst:"암기 먼저", sortWrongFirst:"오답 많은 것 먼저",
    learningOnly:(n)=>`학습중 (${n})`,
    variantQuizTitle:"변형 퀴즈", variantUnavailable:"변형 없음",
    variantTypeSelect:"변형 유형 선택", wordRangeNote:"(변형 있는 단어만)",
    allDeselect:"전체 해제", allSelectAll:"전체 선택",
  },
  en:{
    appTitle:"Vocabulary Quiz", appSub:"Multi-language Vocabulary Trainer",
    addWord:"+ Add Word", editWord:"Editing Word", addBtn:"Add", editBtn:"Save", cancelBtn:"Cancel",
    saveLoad:"Save / Load", telegramTip:"Can't save files? Use Copy instead",
    fileSave:"⬇ Export", copy:"Copy", fileOpen:"⬆ Import", paste:"Paste", textAdd:"Text", csvExcel:"CSV/Excel",
    searchPlaceholder:"Search...", all:"All", learning:"Learning", hard:"Hard", done:"Done",
    selectAll:"Select All", deselect:"Deselect", deleteN:(n)=>`Delete ${n}`, wordCount:(n)=>`${n} words`,
    mcqTitle:"Multiple Choice", direction:"Direction", wordRange:"Word Range", questionCount:"Questions",
    dirAtoB:(b)=>`${b.termA.en} → ${b.termB.en}`, dirBtoA:(b)=>`${b.termB.en} → ${b.termA.en}`, mixed:"Random Mix",
    allRange:(n)=>`All (${n})`, excludeMastered:(n)=>`Excl. Mastered (${n})`, hardOnly:(n)=>`Hard Only (${n})`,
    startMCQ:(n)=>`Start — ${n} questions`, needMore:(n)=>`Need at least 4 words (now ${n})`,
    essayTitle:"Written Test", essaySub:"Type your answer! Partial answers accepted.",
    dirAtoB_e:(b)=>`${b.termA.en} → type ${b.termB.en}`, dirBtoA_e:(b)=>`${b.termB.en} → type ${b.termA.en}`,
    startEssay:(n)=>`Start — ${n} questions`,
    questionTagAtoB:(b)=>`What is the ${b.termB.en}?`, questionTagBtoA:(b)=>`What is the ${b.termA.en}?`,
    inputPlaceholderA:(b)=>`Type the ${b.termB.en}...`, inputPlaceholderB:(b)=>`Type the ${b.termA.en}...`,
    correct:"Correct!", wrong:(a)=>`Wrong — Answer: ${a}`,
    confirm:"Check", next:"Next →", finish:"See Results", quit:"Quit",
    autoSaveLocal:"Saved on this device only. Login to sync across devices.",
    autoSaveCloud:(name)=>`${name}'s words — Synced across all devices`,
    login:"Sign in with Google", logout:"Sign out", saving:"Saving...",
    directInput:"Custom:",
    importWords:"Import Words", importSearch:"Search by meaning",
    reversoImport:"Reverso Conjugation", rootSearch:"Root Search (Pealim)",
    verbForm:"Verb Form Excel", formDownload:"Download Form",
    refreshVariants:"Refresh Variants",
    cardStyle:"Card:", menuStyle:"Menu", inlineStyle:"Inline",
    addToWordbook:"Add to wordbook",
    sortDefault:"Default", sortHebAsc:"Hebrew ↑", sortHebDesc:"Hebrew ↓",
    sortMeanAsc:"Meaning ↑", sortMeanDesc:"Meaning ↓", sortHardFirst:"Hard first",
    sortMasteredFirst:"Mastered first", sortWrongFirst:"Most wrong first",
    learningOnly:(n)=>`Learning (${n})`,
    variantQuizTitle:"Variant Quiz", variantUnavailable:"No variants",
    variantTypeSelect:"Variant types", wordRangeNote:"(words with variants only)",
    allDeselect:"Deselect All", allSelectAll:"Select All",
  }
};

function getLSKey(book) { return `hebrew_quiz_words_${book||"hebrew"}`; }
const LS_KEY = "hebrew_quiz_words";

const STATUS_CONFIG = {
  learning:{ labelKo:"학습중",   labelEn:"Learning", emoji:"◎", color:"#8A8AAA", bg:"rgba(138,138,170,0.07)", border:"rgba(138,138,170,0.18)" },
  mastered:{ labelKo:"암기완료", labelEn:"Mastered", emoji:"✓", color:"#50C898", bg:"rgba(80,200,152,0.07)",  border:"rgba(80,200,152,0.22)" },
  hard:    { labelKo:"어려움",   labelEn:"Hard",     emoji:"!", color:"#E84A5F", bg:"rgba(232,74,95,0.07)",   border:"rgba(232,74,95,0.22)" },
};

// Design tokens
const TB  = "#09080D";
const TS  = "#0F0E14";
const TS2 = "#151320";
const TA  = "#E84A5F";
const TH  = "#FF9A6C";
const TG  = "#50C898";
const TBL = "#5B9CF6";
const TP  = "#A78BFA";
const TT  = "#F0EDE8";
const TM  = "rgba(240,237,232,0.4)";
const TD  = "rgba(240,237,232,0.18)";
const TL  = "rgba(255,255,255,0.06)";

function stripNikkud(text) { return text.replace(/[\u0591-\u05C7]/g,""); }
function shuffle(arr) { return [...arr].sort(()=>Math.random()-0.5); }
function loadWords(book) {
  try {
    const key = book && book !== "hebrew" ? getLSKey(book) : LS_KEY;
    const s = localStorage.getItem(key);
    if (s) return JSON.parse(s);
    if (!book || book === "hebrew") {
      const leg = localStorage.getItem(LS_KEY);
      if (leg) return JSON.parse(leg);
    }
  } catch {}
  return book && book !== "hebrew" ? [] : DEFAULT_WORDS;
}
function saveWords(words, book) {
  try {
    const key = book && book !== "hebrew" ? getLSKey(book) : LS_KEY;
    localStorage.setItem(key, JSON.stringify(words));
  } catch {}
}

function checkEssayAnswer(userInput, correctAnswer) {
  const norm = s => s.trim().toLowerCase().replace(/[\/\-,\.·]/g," ").replace(/\s+/g," ").trim();
  const user = norm(userInput); const correct = norm(correctAnswer);
  if (user === correct) return "exact";
  const cWords = correct.split(" ").filter(w=>w.length>1);
  const uWords = user.split(" ").filter(w=>w.length>1);
  const matches = cWords.filter(w=>uWords.some(u=>u.includes(w)||w.includes(u)));
  if (matches.length >= Math.ceil(cWords.length*0.6)) return "partial";
  return "wrong";
}

function generateQuestion(word, allWords, type) {
  const canMeanToHeb = !!word.meaning;
  let actualType = type===QUIZ_TYPES.MIXED
    ? (canMeanToHeb&&Math.random()>0.5 ? QUIZ_TYPES.MEAN_TO_HEB : QUIZ_TYPES.HEB_TO_MEAN)
    : type;
  if(actualType===QUIZ_TYPES.MEAN_TO_HEB && !canMeanToHeb) actualType=QUIZ_TYPES.HEB_TO_MEAN;
  const question = actualType===QUIZ_TYPES.HEB_TO_MEAN ? word.hebrew : word.meaning;
  const answer   = actualType===QUIZ_TYPES.HEB_TO_MEAN ? word.meaning : word.hebrew;
  const pool = allWords.filter(w=>w.id!==word.id&&(actualType===QUIZ_TYPES.HEB_TO_MEAN?!!w.meaning:!!w.hebrew));
  const seen = new Set([answer]); const distractors = [];
  for(const w of shuffle(pool)){
    const val = actualType===QUIZ_TYPES.HEB_TO_MEAN ? w.meaning : w.hebrew;
    if(!seen.has(val)){ seen.add(val); distractors.push(val); }
    if(distractors.length >= 3) break;
  }
  while(distractors.length < 3) distractors.push("—");
  return { question, answer, choices:shuffle([answer,...distractors]), questionType:actualType, wordId:word.id };
}

async function googleTTS(text, apiKey, lang="he-IL", name="he-IL-Wavenet-A", rate=0.9) {
  const voiceNames = lang.startsWith("he") ? ["he-IL-Neural2-A","he-IL-Wavenet-A","he-IL-Standard-A"] : [name];
  for(const voiceName of voiceNames){
    try{
      const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ input:{text}, voice:{languageCode:lang,name:voiceName}, audioConfig:{audioEncoding:"MP3",speakingRate:rate,pitch:0} }),
      });
      if(!res.ok) continue;
      const data=await res.json();
      if(data.audioContent){ const audio=new Audio(`data:audio/mp3;base64,${data.audioContent}`); _currentAudio=audio; audio.play(); return; }
    }catch{}
  }
  throw new Error("TTS error");
}
function browserTTS(text, lang="he-IL", rate=0.9) {
  if(!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const input = lang.startsWith("he") ? stripNikkud(text) : text;
  const utt=new SpeechSynthesisUtterance(input);
  utt.lang=lang; utt.rate=rate; window.speechSynthesis.speak(utt);
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l=>l.trim()); const results = [];
  for (const line of lines) {
    let cols = [];
    if (/\t|;/.test(line)) { cols = line.split(/[\t;]/).map(c=>c.trim().replace(/^["']|["']$/g,"")); }
    else { const re=/("([^"]*)")|([^,]+)/g; let m; while((m=re.exec(line))!==null) cols.push((m[2]!==undefined?m[2]:m[3]).trim()); }
    if (cols.length>=2&&cols[0]&&cols[1]) results.push({hebrew:cols[0],meaning:cols[1]});
  }
  return results;
}

function parseTextFormat(text) {
  const lines = text.split(/\r?\n/).filter(l=>l.trim()); const results = [];
  for (const line of lines) {
    const idx = line.search(/[=:]/);
    if (idx>0) { const a=line.slice(0,idx).trim(); const b=line.slice(idx+1).trim(); if(a&&b) results.push({hebrew:a,meaning:b}); }
  }
  return results;
}

// ── UI Components ──────────────────────────────────────────────
let _currentAudio = null;

function SpeakBtn({text,onSpeak,size="md",muted=false}) {
  const [playing,setPlaying]=useState(false);
  const handleClick=async(e)=>{ e.stopPropagation(); if(muted) return; setPlaying(true); try{await onSpeak(text);}catch{} setTimeout(()=>setPlaying(false),1200); };
  return <button onClick={handleClick} style={{background:muted?"transparent":playing?`rgba(232,74,95,0.18)`:"rgba(255,255,255,0.04)",border:`1px solid ${muted?"rgba(255,255,255,0.05)":playing?"rgba(232,74,95,0.45)":TL}`,borderRadius:"2px",cursor:muted?"default":"pointer",padding:size==="lg"?"10px 16px":"5px 9px",fontSize:size==="lg"?"1rem":"0.85rem",lineHeight:1,flexShrink:0,opacity:muted?0.25:1,color:playing?TA:TM,transition:"all 0.15s"}}>{muted?"○":playing?"▶":"▷"}</button>;
}

function SpeakOnceBtn({text,onSpeak,muted=false,repeatN=1}){
  const [playing,setPlaying]=useState(false); const [count,setCount]=useState(0); const stopRef=useRef(false);
  const globalStop=()=>{ stopRef.current=true; window.speechSynthesis?.cancel(); if(_currentAudio){_currentAudio.pause();_currentAudio.currentTime=0;_currentAudio=null;} setPlaying(false); setCount(0); };
  const handle=async(e)=>{ e.stopPropagation(); if(muted) return; if(playing){globalStop();return;} stopRef.current=false; setPlaying(true); for(let i=0;i<repeatN;i++){ if(stopRef.current) break; setCount(i+1); try{await onSpeak(text);}catch{} if(i<repeatN-1) await new Promise(r=>setTimeout(r,1400)); } setPlaying(false); setCount(0); };
  return(<button onClick={handle} style={{background:playing?`rgba(232,74,95,0.12)`:"rgba(255,255,255,0.04)",border:`1px solid ${playing?"rgba(232,74,95,0.4)":TL}`,borderRadius:"2px",cursor:muted?"default":"pointer",padding:"4px 9px",fontSize:"0.8rem",lineHeight:1,opacity:muted?0.22:1,color:playing?TA:TM,transition:"all 0.1s"}}>{playing?`■ ${count}`:"▷"}</button>);
}

function RepeatSpeakBtn({text,onSpeak,muted=false}) {
  const [playing,setPlaying]=useState(false); const [count,setCount]=useState(0); const [repeatMode,setRepeatMode]=useState(1); const stopRef=useRef(false);
  const handleSpeak=async(e)=>{ e.stopPropagation(); if(muted||playing) return; stopRef.current=false; setPlaying(true); for(let i=0;i<repeatMode;i++){ if(stopRef.current) break; setCount(i+1); try{await onSpeak(text);}catch{} if(i<repeatMode-1) await new Promise(r=>setTimeout(r,1400)); } setPlaying(false); setCount(0); };
  const handleStop=(e)=>{e.stopPropagation();stopRef.current=true;window.speechSynthesis?.cancel();setPlaying(false);setCount(0);};
  return(<div style={{display:"flex",alignItems:"center",gap:"4px"}}>
    {[1,5,10].map(m=>(<button key={m} onClick={e=>{e.stopPropagation();if(!playing)setRepeatMode(m);}} style={{padding:"4px 8px",borderRadius:"2px",border:"1px solid",fontSize:"0.65rem",fontWeight:700,cursor:playing?"not-allowed":"pointer",background:repeatMode===m?`rgba(232,74,95,0.18)`:"rgba(255,255,255,0.03)",borderColor:repeatMode===m?"rgba(232,74,95,0.5)":TL,color:repeatMode===m?TA:TD,opacity:playing&&repeatMode!==m?0.4:1}}>{m}×</button>))}
    <button onClick={playing?handleStop:handleSpeak} style={{background:muted?"transparent":playing?`rgba(232,74,95,0.12)`:"rgba(255,255,255,0.04)",border:`1px solid ${muted?"rgba(255,255,255,0.05)":playing?"rgba(232,74,95,0.4)":TL}`,borderRadius:"2px",cursor:muted?"default":"pointer",padding:"10px 16px",fontSize:"0.95rem",lineHeight:1,flexShrink:0,opacity:muted?0.25:1,color:playing?TA:TM}}>
      {muted?"○":playing?`■ ${count}/${repeatMode}`:"▷"}
    </button>
  </div>);
}

// ── Main App ───────────────────────────────────────────────────
export default function HebrewQuiz() {
  const envKey=process.env.REACT_APP_GOOGLE_TTS_KEY||"";
  const [apiKey]=useState(envKey);
  const ttsReady=!!envKey;
  const [user,setUser]=useState(null);
  const [syncing,setSyncing]=useState(false);
  const [showMergeModal,setShowMergeModal]=useState(false);
  const [pendingCloudWords,setPendingCloudWords]=useState(null);

  const [currentBook,setCurrentBook]=useState("hebrew");
  const [uiLang,setUiLang]=useState(()=>{ try{return localStorage.getItem("uiLang")||"ko";}catch{return "ko";} });
  const T=UI_TEXT[uiLang]||UI_TEXT.ko;
  const bookInfo=BOOKS.find(b=>b.id===currentBook)||BOOKS[0];

  const [words,setWordsRaw]=useState(()=>loadWords("hebrew"));
  const [mode,setMode]=useState(MODES.LIST);
  const [newHebrew,setNewHebrew]=useState("");
  const [newWordType,setNewWordType]=useState(null);
  const [newWordWallets,setNewWordWallets]=useState(new Set());
  const [newWordExcludeDefault,setNewWordExcludeDefault]=useState(false);
  const [newMeaning,setNewMeaning]=useState("");
  const [editId,setEditId]=useState(null);

  const [quizType,setQuizType]=useState(()=>{ try{return localStorage.getItem("quizType")||QUIZ_TYPES.HEB_TO_MEAN;}catch{return QUIZ_TYPES.HEB_TO_MEAN;} });
  const setQuizTypeSave=(v)=>{setQuizType(v);try{localStorage.setItem("quizType",v);}catch{}};
  const [quizFilter,setQuizFilter]=useState(()=>{ try{return localStorage.getItem("quizFilter")||QUIZ_FILTERS.ALL;}catch{return QUIZ_FILTERS.ALL;} });
  const setQuizFilterSave=(v)=>{setQuizFilter(v);try{localStorage.setItem("quizFilter",v);}catch{}};
  const [quizCount,setQuizCount]=useState(()=>{ try{const s=localStorage.getItem("quizCount");return s?Number(s):10;}catch{return 10;} });
  const setQuizCountSave=(v)=>{setQuizCount(v);try{localStorage.setItem("quizCount",v);}catch{}};

  const [listFilter,setListFilter]=useState(()=>{ try{return localStorage.getItem("listFilter")||"all";}catch{return "all";} });
  const setListFilterSave=(v)=>{setListFilter(v);try{localStorage.setItem("listFilter",v);}catch{};};
  const [walletFilter,setWalletFilter]=useState(null);
  const [cardStyle,setCardStyle]=useState(()=>{ try{return localStorage.getItem("cardStyle")||"menu";}catch{return "menu";} });
  const setCardStyleSave=(v)=>{setCardStyle(v);try{localStorage.setItem("cardStyle",v);}catch{}};
  const [sortBy,setSortBy]=useState(()=>{ try{return localStorage.getItem("sortBy")||"default";}catch{return "default";} });
  const setSortBySave=(v)=>{setSortBy(v);try{localStorage.setItem("sortBy",v);}catch{};};
  const [searchQuery,setSearchQuery]=useState("");
  const [pageSize,setPageSize]=useState(()=>{ try{const s=localStorage.getItem("pageSize");return s?Number(s):20;}catch{return 20;} });
  const setPageSizeSave=(n)=>{setPageSize(n);try{localStorage.setItem("pageSize",n);}catch{};};
  const [page,setPage]=useState(0);
  const [selectedIds,setSelectedIds]=useState(new Set());

  const [questions,setQuestions]=useState([]);
  const [current,setCurrent]=useState(0);
  const [selected,setSelected]=useState(null);
  const [confirmed,setConfirmed]=useState(false);
  const [score,setScore]=useState(0);
  const [wrongWords,setWrongWords]=useState([]);
  const [animKey,setAnimKey]=useState(0);
  const [importPreview,setImportPreview]=useState(null);
  const [toast,setToast]=useState(null);
  const [soundMode,setSoundMode]=useState("auto");
  const muted=soundMode==="mute";

  const speak=useCallback(async(text)=>{
    if(soundMode!=="auto") return;
    const book=BOOKS.find(b=>b.id===currentBook)||BOOKS[0];
    if(apiKey){ try{ await googleTTS(text,apiKey,book.ttsLang,book.ttsName,book.ttsRate); return; }catch{} }
    browserTTS(text,book.ttsLang,book.ttsRate);
  },[apiKey,currentBook,soundMode]);

  const speakOnDemand=useCallback(async(text)=>{
    if(soundMode==="mute") return;
    const book=BOOKS.find(b=>b.id===currentBook)||BOOKS[0];
    if(apiKey){ try{ await googleTTS(text,apiKey,book.ttsLang,book.ttsName,book.ttsRate); return; }catch{} }
    browserTTS(text,book.ttsLang,book.ttsRate);
  },[apiKey,currentBook,soundMode]);

  const [showPasteModal,setShowPasteModal]=useState(false);
  const [showBatchModal,setShowBatchModal]=useState(false);
  const [showPealimModal,setShowPealimModal]=useState(false);
  const [showRootModal,setShowRootModal]=useState(false);
  const [importTargetWallets,setImportTargetWallets]=useState(new Set());
  const [importExcludeDefault,setImportExcludeDefault]=useState(false);

  const [showWalletModal,setShowWalletModal]=useState(false);
  const [walletPickWord,setWalletPickWord]=useState(null);
  const [bulkWalletOpen,setBulkWalletOpen]=useState(false);
  const [wallets,setWallets]=useState(()=>{ try{const s=localStorage.getItem("wordWallets");return s?JSON.parse(s):[];}catch{return [];} });
  const [walletName,setWalletName]=useState("");
  const [walletColor,setWalletColor]=useState(TA);
  const [walletView,setWalletView]=useState(null);
  const saveWallets=(w)=>{ setWallets(w); try{localStorage.setItem("wordWallets",JSON.stringify(w));}catch{} if(user){setDoc(doc(fbDb,"users",user.uid),{wallets:w,walletsUpdatedAt:new Date().toISOString()},{merge:true}).catch(e=>console.error(e));} };
  const createWallet=()=>{ if(!walletName.trim()) return; const nw=[{id:Date.now(),name:walletName.trim(),color:walletColor,wordIds:[]}, ...wallets]; saveWallets(nw); setWalletName(""); setWalletColor(TA); };
  const deleteWallet=(id)=>saveWallets(wallets.filter(w=>w.id!==id));
  const toggleWordInWallet=(walletId,wordId)=>{ saveWallets(wallets.map(w=>w.id===walletId?{...w,wordIds:w.wordIds.includes(wordId)?w.wordIds.filter(i=>i!==wordId):[...w.wordIds,wordId]}:w)); };
  const getWalletWords=(walletId)=>{ const w=wallets.find(w=>w.id===walletId); return w?words.filter(wd=>w.wordIds.includes(wd.id)):[]; };

  const [rootSearchInput,setRootSearchInput]=useState("");
  const [wordSearchInput,setWordSearchInput]=useState("");
  const [wordSearchResults,setWordSearchResults]=useState([]);
  const [wordSearchLoading,setWordSearchLoading]=useState(false);
  const [wordSearchError,setWordSearchError]=useState("");
  const [wordSearchSelected,setWordSearchSelected]=useState(new Set());
  const [showWordSearchModal,setShowWordSearchModal]=useState(false);
  const [rootSearchResults,setRootSearchResults]=useState([]);
  const [rootSearchLoading,setRootSearchLoading]=useState(false);
  const [rootSearchError,setRootSearchError]=useState("");
  const [rootSelected,setRootSelected]=useState(new Set());
  const [rootGroupName,setRootGroupName]=useState("");

  const [pealimRoot,setPealimRoot]=useState("");
  const [pealimResults,setPealimResults]=useState([]);
  const [pealimLoading,setPealimLoading]=useState(false);
  const [pealimError,setPealimError]=useState("");
  const [pealimPreview,setPealimPreview]=useState(null);
  const [pealimSelected,setPealimSelected]=useState(new Set());

  const [pasteText,setPasteText]=useState("");
  const batchTextRef=useRef(null);

  const [essayQuestions,setEssayQuestions]=useState([]);
  const [essayCurrent,setEssayCurrent]=useState(0);
  const [essayInput,setEssayInput]=useState("");
  const [essayConfirmed,setEssayConfirmed]=useState(false);
  const [essayResults,setEssayResults]=useState([]);
  const [essayFilter,setEssayFilter]=useState(()=>{ try{return localStorage.getItem("essayFilter")||QUIZ_FILTERS.ALL;}catch{return QUIZ_FILTERS.ALL;} });
  const setEssayFilterSave=(v)=>{setEssayFilter(v);try{localStorage.setItem("essayFilter",v);}catch{}};
  const [essayCount,setEssayCount]=useState(()=>{ try{const s=localStorage.getItem("essayCount");return s?Number(s):10;}catch{return 10;} });
  const setEssayCountSave=(v)=>{setEssayCount(v);try{localStorage.setItem("essayCount",v);}catch{}};
  const [essayType,setEssayType]=useState(()=>{ try{return localStorage.getItem("essayType")||"heb_to_mean";}catch{return "heb_to_mean";} });
  const setEssayTypeSave=(v)=>{setEssayType(v);try{localStorage.setItem("essayType",v);}catch{}};
  const essayInputRef=useRef(null); const essayHebrewRef=useRef(null);
  const fileInputRef=useRef(null); const csvInputRef=useRef(null);
  const verbFormFileRef=useRef(null); const variantInputRef=useRef(null);

  const [variantQuestions,setVariantQuestions]=useState([]);
  const [variantCur,setVariantCur]=useState(0);
  const [variantQuizType,setVariantQuizType]=useState("essay");
  const [variantSelected,setVariantSelected]=useState(null);
  const [variantInput,setVariantInput]=useState("");
  const [variantConfirmed,setVariantConfirmed]=useState(false);
  const [variantResults,setVariantResults]=useState([]);
  const [variantFilter,setVariantFilter]=useState(()=>{ try{return localStorage.getItem("variantFilter")||QUIZ_FILTERS.ALL;}catch{return QUIZ_FILTERS.ALL;} });
  const setVariantFilterSave=(v)=>{setVariantFilter(v);try{localStorage.setItem("variantFilter",v);}catch{};};
  const [variantCount,setVariantCount]=useState(10);
  const [variantCats,setVariantCats]=useState(()=>{ try{const s=localStorage.getItem("variantCats");return s?JSON.parse(s):VARIANT_CATS.map(c=>c.id);}catch{return VARIANT_CATS.map(c=>c.id);} });
  const setVariantCatsSave=(v)=>{ const next=typeof v==="function"?v(variantCats):v; setVariantCats(next); try{localStorage.setItem("variantCats",JSON.stringify(next));}catch{} };
  const [expandedVariantWord,setExpandedVariantWord]=useState(null);
  const [variantDraft,setVariantDraft]=useState({});
  const [variantPasteMode,setVariantPasteMode]=useState(false);
  const [variantPasteText,setVariantPasteText]=useState("");

  const [openSections,setOpenSections]=useState(()=>{ try{const s=localStorage.getItem("openSections");if(s) return JSON.parse(s);}catch{} return {add:false,io:false,import:false,quiz_mcq:false,quiz_essay:false,quiz_variant:false}; });
  const toggleSection=(key)=>setOpenSections(s=>{ const next={...s,[key]:!s[key]}; try{localStorage.setItem("openSections",JSON.stringify(next));}catch{} return next; });

  const [refreshingVariants,setRefreshingVariants]=useState(false);
  const [refreshLog,setRefreshLog]=useState([]);
  const [showRefreshLog,setShowRefreshLog]=useState(false);
  const [rootGroupView,setRootGroupView]=useState(false);

  // ── Firebase Auth ─────────────────────────────────────────
  useEffect(()=>{
    const unsub=onAuthStateChanged(fbAuth,async(u)=>{
      setUser(u);
      if(u){
        try{
          const snap=await getDoc(doc(fbDb,"users",u.uid));
          const localWords=loadWords();
          const hasLocal=localWords.length>0&&!(localWords.length===8&&localWords[0].hebrew==="שָׁלוֹם");
          const syncKey=`synced_${u.uid}`;
          const alreadySynced=localStorage.getItem(syncKey);
          if(snap.exists()){
            const snapData=snap.data();
            const cloud=snapData.words;
            const cloudWallets=snapData.wallets;
            if(cloudWallets&&cloudWallets.length){
              const localWallets=(()=>{ try{const s=localStorage.getItem("wordWallets");return s?JSON.parse(s):[];}catch{return [];} })();
              if(!localWallets.length){ setWallets(cloudWallets); try{localStorage.setItem("wordWallets",JSON.stringify(cloudWallets));}catch{} }
              else { const merged=[...cloudWallets]; localWallets.forEach(lw=>{ if(!merged.find(cw=>cw.id===lw.id)) merged.push(lw); }); setWallets(merged); try{localStorage.setItem("wordWallets",JSON.stringify(merged));}catch{} }
            }
            if(cloud&&cloud.length){
              if(hasLocal&&!alreadySynced){
                const localSet=new Set(localWords.map(w=>w.hebrew)); const cloudSet=new Set(cloud.map(w=>w.hebrew));
                const isSame=localWords.length===cloud.length&&[...localSet].every(h=>cloudSet.has(h));
                if(isSame){ setWordsRaw(cloud); saveWords(cloud); localStorage.setItem(syncKey,"1"); }
                else{ setPendingCloudWords(cloud); setShowMergeModal(true); }
              } else { setWordsRaw(cloud); saveWords(cloud); if(!alreadySynced) showToast("클라우드 단어장을 불러왔어요!"); localStorage.setItem(syncKey,"1"); }
            } else if(hasLocal){ await setDoc(doc(fbDb,"users",u.uid),{words:localWords,updatedAt:new Date().toISOString()}); localStorage.setItem(syncKey,"1"); showToast("기존 단어장을 클라우드에 저장했어요!"); }
          } else if(hasLocal){ await setDoc(doc(fbDb,"users",u.uid),{words:localWords,updatedAt:new Date().toISOString()}); localStorage.setItem(syncKey,"1"); showToast("기존 단어장을 클라우드에 저장했어요!"); }
        }catch(e){ console.error(e); }
      }
    });
    return ()=>unsub();
  },[]); // eslint-disable-line

  const handleMerge=(choice)=>{
    if(!pendingCloudWords) return;
    if(choice==="cloud"){ setWordsRaw(pendingCloudWords); saveWords(pendingCloudWords); showToast("클라우드 단어장으로 교체했어요!"); }
    else if(choice==="local"){ const local=loadWords(); if(user) setDoc(doc(fbDb,"users",user.uid),{words:local,updatedAt:new Date().toISOString()}); showToast("기기 단어장을 클라우드에 저장했어요!"); }
    else { const local=loadWords(); const hs=new Set(pendingCloudWords.map(w=>w.hebrew)); const merged=[...pendingCloudWords,...local.filter(w=>!hs.has(w.hebrew))]; setWordsRaw(merged); saveWords(merged); if(user) setDoc(doc(fbDb,"users",user.uid),{words:merged,updatedAt:new Date().toISOString()}); showToast(`병합 완료! 총 ${merged.length}개 단어`); }
    setPendingCloudWords(null); setShowMergeModal(false);
    if(user) localStorage.setItem(`synced_${user.uid}`,"1");
  };

  const signInGoogle=async()=>{ try{ await signInWithPopup(fbAuth,new GoogleAuthProvider()); showToast("로그인 성공! 불러오는 중..."); }catch(e){ showToast("로그인 실패: "+e.message,"err"); } };
  const signOutUser=async()=>{ await signOut(fbAuth); showToast("로그아웃 됐어요."); };
  const syncToCloud=async(wordsToSync)=>{ if(!user) return; setSyncing(true); try{ const data={words:wordsToSync,updatedAt:new Date().toISOString()}; if(wallets&&wallets.length) data.wallets=wallets; await setDoc(doc(fbDb,"users",user.uid),data); }catch(e){ console.error("sync error",e); }finally{ setSyncing(false); } };

  const setWords=(updater)=>{ setWordsRaw(prev=>{ const next=typeof updater==="function"?updater(prev):updater; saveWords(next,currentBook); syncToCloud(next); return next; }); };
  const masteredCount=words.filter(w=>w.status==="mastered").length;
  const hardCount=words.filter(w=>w.status==="hard").length;
  const learningCount=words.filter(w=>w.status==="learning").length;
  const showToast=(msg,type="ok")=>{ setToast({msg,type}); setTimeout(()=>setToast(null),3000); };
  const switchBook=(bookId)=>{ setCurrentBook(bookId); const loaded=loadWords(bookId); setWordsRaw(loaded); setListFilter("all"); setSearchQuery(""); setPage(0); setSelectedIds(new Set()); setMode(MODES.LIST); };

  // ── Handlers ───────────────────────────────────────────────
  const applyVariantPaste=(text)=>{ const lines=text.split(/[\n\t]/).map(l=>l.trim()); const draft={...variantDraft}; const editWord=words.find(w=>w.id===expandedVariantWord); const order=getAllowedPasteOrder(editWord?.wordType); let orderIdx=0; lines.forEach(form=>{ if(orderIdx>=order.length) return; if(form){draft[order[orderIdx]]=form;orderIdx++;}else{orderIdx++;} }); setVariantDraft(draft); setVariantPasteText(""); setVariantPasteMode(false); showToast(`${Math.min(lines.length,VARIANT_PASTE_ORDER.length)}개 변형을 입력했어요!`); };
  const openVariantModal=(word)=>{ const draft={}; (word.variants||[]).forEach(v=>{draft[v.type]=v.form;}); setVariantDraft(draft); setVariantPasteMode((word.variants||[]).length>0?"view":false); setExpandedVariantWord(word.id); };
  const saveVariantDraft=(wordId)=>{ const variants=Object.entries(variantDraft).filter(([,form])=>form.trim()).map(([type,form])=>({type,form:form.trim()})); setWords(ws=>ws.map(w=>w.id===wordId?{...w,variants}:w)); setExpandedVariantWord(null); showToast(`변형 ${variants.length}개 저장됐어요!`); };

  const translateText=async(text,from,to)=>{ const res=await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`); const data=await res.json(); return data?.[0]?.[0]?.[0]||""; };

  const searchWordByMeaning=async()=>{
    if(!wordSearchInput.trim()){setWordSearchError("검색어를 입력해주세요");return;}
    setWordSearchLoading(true); setWordSearchError(""); setWordSearchResults([]); setWordSearchSelected(new Set());
    try{
      const q=wordSearchInput.trim(); const hasKorean=/[ㄱ-ㅎ가-힣]/.test(q); const hasHebrew=/[א-ת]/.test(q);
      if(currentBook==="hebrew"){ let searchQ=q; if(hasKorean){try{const t=await translateText(q,"ko","en");if(t)searchQ=t;}catch{}} const res=await fetch(`/api/Reverso?mode=word_search&q=${encodeURIComponent(searchQ)}`); const data=await res.json(); if(data.error){setWordSearchError(data.error);return;} if(!data.results?.length){setWordSearchError(`"${q}" 검색 결과가 없어요.`);return;} setWordSearchResults(data.results); }
      else if(currentBook==="english"){ if(!hasKorean){setWordSearchError("한국어로 입력해주세요");return;} const translated=await translateText(q,"ko","en"); if(!translated){setWordSearchError("번역 결과가 없어요.");return;} setWordSearchResults([{meaning:translated,hebrew:"",pos:"translation",note:`"${q}" 번역 결과`}]); }
      else if(currentBook==="korean"){ let fromLang="en"; if(hasHebrew)fromLang="he"; const translated=await translateText(q,fromLang,"ko"); if(!translated){setWordSearchError("번역 결과가 없어요.");return;} setWordSearchResults([{meaning:translated,hebrew:q,pos:"translation"}]); }
    }catch(e){setWordSearchError("오류: "+e.message);}
    finally{setWordSearchLoading(false);}
  };

  const addSelectedWordSearchResults=()=>{
    if(!wordSearchSelected.size){setWordSearchError("단어를 선택해주세요");return;}
    const toAdd=[...wordSearchSelected].map(i=>wordSearchResults[i]).filter(Boolean);
    const newWords=toAdd.map(r=>{ let hebrew="",meaning=""; if(currentBook==="hebrew"){hebrew=r.hebrew;meaning=r.meaning||"";}else if(currentBook==="english"){hebrew="";meaning=r.meaning||"";}else{hebrew=r.hebrew||"";meaning=r.meaning||"";} return{id:Date.now()+Math.random(),hebrew,meaning,status:"learning",streak:0,wrongCount:0,wordType:r.pos==="translation"?null:r.pos||null,variants:[]}; });
    setWords(ws=>[...newWords,...ws]); setPage(0);
    if(importTargetWallets.size>0){ const ids=newWords.map(w=>w.id); saveWallets(wallets.map(wl=>importTargetWallets.has(wl.id)?{...wl,wordIds:[...wl.wordIds,...ids]}:wl)); }
    showToast(`${newWords.length}개 단어를 추가했어요!`); setWordSearchSelected(new Set()); setShowWordSearchModal(false); setWordSearchResults([]); setWordSearchInput("");
  };

  const searchByRoot=async()=>{
    if(!rootSearchInput.trim()){setRootSearchError("어근을 입력해주세요");return;}
    setRootSearchLoading(true); setRootSearchError(""); setRootSearchResults([]); setRootSelected(new Set());
    try{ const res=await fetch(`/api/Reverso?mode=root_search&root=${encodeURIComponent(rootSearchInput.trim())}`); const data=await res.json(); if(data.error){setRootSearchError(data.error);return;} if(!data.results?.length){setRootSearchError("검색 결과가 없어요. 어근을 확인해주세요.");return;} setRootSearchResults(data.results); setRootGroupName(rootSearchInput.trim()); }
    catch(e){setRootSearchError("오류: "+e.message);}
    finally{setRootSearchLoading(false);}
  };

  const addSelectedRootWords=()=>{
    if(!rootSelected.size){setRootSearchError("단어를 선택해주세요");return;}
    const toAdd=[...rootSelected].map(i=>rootSearchResults[i]).filter(Boolean);
    const newWords=toAdd.map(r=>({id:Date.now()+Math.random(),hebrew:r.hebrew,meaning:r.meaning||"",status:"learning",streak:0,wrongCount:0,wordType:r.pos||null,root:rootGroupName,rootGroup:rootGroupName,variants:[]}));
    setWords(ws=>[...newWords,...ws]); setPage(0);
    if(importTargetWallets.size>0){ const ids=newWords.map(w=>w.id); saveWallets(wallets.map(wl=>importTargetWallets.has(wl.id)?{...wl,wordIds:[...wl.wordIds,...ids]}:wl)); }
    showToast(`${newWords.length}개 단어를 추가했어요!`); setRootSelected(new Set()); setShowRootModal(false); setRootSearchResults([]); setRootSearchInput("");
  };

  const searchPealim=async()=>{
    if(!pealimRoot.trim()){setPealimError("동사를 입력해주세요");return;}
    setPealimLoading(true); setPealimError(""); setPealimResults([]); setPealimPreview(null); setPealimSelected(new Set());
    try{ const res=await fetch(`/api/Reverso?mode=conjugation&verb=${encodeURIComponent(pealimRoot.trim())}`); const data=await res.json(); if(data.error){setPealimError(data.error);return;} if(!data.variantCount){setPealimError("변형 없음");return;} const existingWord=words.find(w=>stripNikkud(w.hebrew)===stripNikkud(data.infinitive)||w.hebrew===data.infinitive); const autoMeaning=existingWord?.meaning||data.meaning||""; setPealimPreview({...data,meaning:autoMeaning,root:pealimRoot.trim()}); }
    catch(e){setPealimError("불러오는 중 오류: "+e.message);}
    finally{setPealimLoading(false);}
  };

  const addNewWordFromPealim=()=>{
    if(!pealimPreview||!pealimPreview.infinitive) return;
    const variants=Object.entries(pealimPreview.variants).filter(([,form])=>form).map(([type,form])=>({type,form}));
    const exists=words.find(w=>stripNikkud(w.hebrew)===stripNikkud(pealimPreview.infinitive));
    if(exists){ setWords(ws=>ws.map(w=>w.id===exists.id?{...w,variants}:w)); if(importTargetWallets.size>0){saveWallets(wallets.map(wl=>importTargetWallets.has(wl.id)?{...wl,wordIds:[...new Set([...wl.wordIds,exists.id])]}:wl));} showToast(`"${pealimPreview.infinitive}" 변형 ${variants.length}개 업데이트!`); }
    else { const newId=Date.now()+Math.random(); const newWord={id:newId,hebrew:pealimPreview.infinitive,meaning:pealimPreview.meaning||"",status:"learning",streak:0,wrongCount:0,wordType:pealimPreview.wordType||null,variants,root:pealimPreview.root||""}; setWords(ws=>[newWord,...ws]); setPage(0); if(importTargetWallets.size>0){saveWallets(wallets.map(wl=>importTargetWallets.has(wl.id)?{...wl,wordIds:[...wl.wordIds,newId]}:wl));} showToast(`"${pealimPreview.infinitive}" 단어와 변형 ${variants.length}개 추가!`); }
    setShowPealimModal(false); setPealimPreview(null); setPealimRoot(""); setPealimResults([]);
  };

  const refreshAllVariants=async()=>{
    const verbWords=words.filter(w=>w.wordType==="verb"||(w.variants||[]).length>0);
    if(!verbWords.length){showToast("동사 단어가 없어요.","err");return;}
    setRefreshingVariants(true); setRefreshLog([]);
    const log=[]; const done=new Set();
    for(const w of verbWords){ const key=stripNikkud(w.hebrew); if(done.has(key)) continue; done.add(key); try{ const res=await fetch(`/api/Reverso?mode=conjugation&verb=${encodeURIComponent(w.hebrew)}`); const cd=await res.json(); if(cd.error||!cd.variantCount){log.push({hebrew:w.hebrew,meaning:w.meaning,status:"fail",variantCount:0,error:cd.error||"변형 없음"});continue;} const variants=Object.entries(cd.variants).filter(([,f])=>f).map(([type,form])=>({type,form})); if(!variants.length){log.push({hebrew:w.hebrew,meaning:w.meaning,status:"fail",variantCount:0,error:"변형 없음"});continue;} setWords(ws=>ws.map(ww=>stripNikkud(ww.hebrew)===key?{...ww,variants,meaning:ww.meaning||cd.meaning||""}:ww)); log.push({hebrew:w.hebrew,meaning:w.meaning,status:"ok",variantCount:variants.length}); }catch(e){log.push({hebrew:w.hebrew,meaning:w.meaning,status:"fail",variantCount:0,error:e.message});} }
    setRefreshLog(log); setShowRefreshLog(true); setRefreshingVariants(false);
    const ok=log.filter(l=>l.status==="ok").length;
    showToast(`${ok}개 성공 / ${log.length-ok}개 실패`);
  };

  const handleVariantExcel=async(e)=>{
    const file=e.target.files[0]; if(!file) return;
    try{ const XLSX=await getXLSX(); const buf=await file.arrayBuffer(); const wb=XLSX.read(buf,{type:"array"}); const ws=wb.Sheets[wb.SheetNames[0]]; const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""}); const parsed=parseVariantExcel(rows); const entries=Object.entries(parsed); if(!entries.length){showToast("변형 데이터를 찾을 수 없어요.","err");return;} let added=0,updated=0; setWords(ws=>ws.map(w=>{ const match=entries.find(([heb])=>stripNikkud(heb)===stripNikkud(w.hebrew)||heb===w.hebrew); if(!match) return w; const {variants:newV}=match[1]; const existing=new Set((w.variants||[]).map(v=>v.type+"|"+v.form)); const toAdd=newV.filter(v=>!existing.has(v.type+"|"+v.form)); if(!toAdd.length) return w; updated++;added+=toAdd.length; return{...w,variants:[...(w.variants||[]),...toAdd]}; })); showToast(`${updated}개 단어에 변형 ${added}개 추가!`); }
    catch(err){showToast("파일을 읽을 수 없어요: "+err.message,"err");}
    e.target.value="";
  };

  const parseVerbFormExcel=(rows)=>{ const r=(row,col)=>{ const ro=rows[row]; return ro&&ro[col]!=null&&String(ro[col]).trim()?String(ro[col]).trim():null; }; const v={}; if(r(2,1)) v['infinitive']=r(2,1); if(r(4,1)) v['pres_ms']=r(4,1); if(r(4,2)) v['pres_fs']=r(4,2); if(r(4,3)) v['pres_mp']=r(4,3); if(r(4,4)) v['pres_fp']=r(4,4); if(r(6,1)) v['past_1s']=r(6,1); if(r(6,3)) v['past_1p']=r(6,3); if(r(8,1)) v['past_2ms']=r(8,1); if(r(8,2)) v['past_2fs']=r(8,2); if(r(8,3)) v['past_2mp']=r(8,3); if(r(8,4)) v['past_2fp']=r(8,4); if(r(10,1)) v['past_3ms']=r(10,1); if(r(10,2)) v['past_3fs']=r(10,2); if(r(10,3)) v['past_3mp']=r(10,3); if(r(10,4)) v['past_3fp']=r(10,4); if(r(12,1)) v['fut_1s']=r(12,1); if(r(12,3)) v['fut_1p']=r(12,3); if(r(14,1)) v['fut_2ms']=r(14,1); if(r(14,2)) v['fut_2fs']=r(14,2); if(r(14,3)) v['fut_2mp']=r(14,3); if(r(14,4)) v['fut_2fp']=r(14,4); if(r(16,1)) v['fut_3ms']=r(16,1); if(r(16,2)) v['fut_3fs']=r(16,2); if(r(16,3)) v['fut_3mp']=r(16,3); if(r(16,4)) v['fut_3fp']=r(16,4); return v; };
  const handleVerbFormExcel=(e)=>{ const file=e.target.files[0]; if(!file) return; const reader=new FileReader(); reader.onload=(ev)=>{ try{ const XLSX=window.XLSX; const wb=XLSX.read(ev.target.result,{type:'binary'}); const ws=wb.Sheets[wb.SheetNames[0]]; const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null}); const variants_obj=parseVerbFormExcel(rows); const variantCount=Object.keys(variants_obj).length; if(variantCount===0){showToast("변형 데이터가 없어요.","err");return;} setPealimPreview({infinitive:variants_obj['infinitive']||'',meaning:'',wordType:null,variants:variants_obj,variantCount,root:''}); setShowPealimModal(true); showToast(`${variantCount}개 변형 불러옴!`); }catch(err){showToast("파일을 읽을 수 없어요: "+err.message,"err");} }; reader.readAsBinaryString(file); e.target.value=''; };

  const handleCSVChange=async(e)=>{ const file=e.target.files[0]; if(!file) return; const isXlsx=/\.xlsx?$/i.test(file.name); if(isXlsx){ try{ const XLSX=await getXLSX(); const buf=await file.arrayBuffer(); const wb=XLSX.read(buf,{type:"array"}); const ws=wb.Sheets[wb.SheetNames[0]]; const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""}); const parsed=rows.filter(r=>r[0]&&r[1]).map(r=>({hebrew:String(r[0]).trim(),meaning:String(r[1]).trim()})).filter(w=>w.hebrew&&w.meaning); if(!parsed.length){showToast("인식된 단어가 없어요.","err");return;} setImportPreview({words:parsed.map(w=>({...w,id:Date.now()+Math.random(),status:"learning",streak:0,wrongCount:0})),fileName:file.name}); }catch{showToast("엑셀 파일을 읽을 수 없어요.","err");} } else { const reader=new FileReader(); reader.onload=(ev)=>{ const parsed=parseCSV(ev.target.result); if(!parsed.length){showToast("인식된 단어가 없어요.","err");return;} setImportPreview({words:parsed.map(w=>({...w,id:Date.now()+Math.random(),status:"learning",streak:0,wrongCount:0})),fileName:file.name}); }; reader.readAsText(file,"UTF-8"); } e.target.value=""; };
  const handleFileChange=(e)=>{ const file=e.target.files[0]; if(!file) return; const reader=new FileReader(); reader.onload=(ev)=>{ try{ const parsed=JSON.parse(ev.target.result); const raw=Array.isArray(parsed)?parsed:(parsed.words||[]); const imported=raw.map(w=>({id:Date.now()+Math.random(),hebrew:(w.hebrew||"").trim(),meaning:(w.meaning||"").trim(),status:["learning","mastered","hard"].includes(w.status)?w.status:"learning",streak:w.streak||0,wrongCount:w.wrongCount||0})).filter(w=>w.hebrew&&w.meaning); if(!imported.length){showToast("불러올 단어가 없어요.","err");return;} setImportPreview({words:imported,fileName:file.name}); }catch{showToast("파일을 읽을 수 없어요.","err");} }; reader.readAsText(file); e.target.value=""; };
  const importFromText=()=>{ try{ const parsed=JSON.parse(pasteText); const raw=Array.isArray(parsed)?parsed:(parsed.words||[]); const imported=raw.map(w=>({id:Date.now()+Math.random(),hebrew:(w.hebrew||"").trim(),meaning:(w.meaning||"").trim(),status:["learning","mastered","hard"].includes(w.status)?w.status:"learning",streak:w.streak||0,wrongCount:w.wrongCount||0})).filter(w=>w.hebrew&&w.meaning); if(!imported.length){showToast("불러올 단어가 없어요.","err");return;} setImportPreview({words:imported,fileName:"클립보드에서"}); setShowPasteModal(false); setPasteText(""); }catch{showToast("올바른 형식이 아니에요.","err");} };
  const importFromBatchText=()=>{ const raw=batchTextRef.current?batchTextRef.current.value:""; const parsed=parseTextFormat(raw); if(!parsed.length){showToast("인식된 단어가 없어요.","err");return;} setImportPreview({words:parsed.map(w=>({...w,id:Date.now()+Math.random(),status:"learning",streak:0,wrongCount:0})),fileName:`텍스트 형식 (${parsed.length}개)`}); setShowBatchModal(false); if(batchTextRef.current) batchTextRef.current.value=""; };
  const exportWords=()=>{ const data={version:1,exportedAt:new Date().toISOString(),words}; const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`hebrew-vocab-${new Date().toISOString().slice(0,10)}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); showToast(`${words.length}개 단어를 내보냈어요!`); };
  const copyToClipboard=async()=>{ const text=JSON.stringify({version:1,exportedAt:new Date().toISOString(),words},null,2); try{await navigator.clipboard.writeText(text); showToast("클립보드에 복사됐어요!");}catch{const ta=document.createElement("textarea"); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); showToast("복사됐어요!");} };
  const confirmImport=(merge)=>{ if(!importPreview) return; if(merge){const ex=new Set(words.map(w=>w.hebrew));const newOnes=importPreview.words.filter(w=>!ex.has(w.hebrew));setWords(ws=>[...ws,...newOnes]);showToast(`${newOnes.length}개 추가! (중복 ${importPreview.words.length-newOnes.length}개 제외)`);}else{setWords(importPreview.words);showToast(`${importPreview.words.length}개 단어로 교체했어요!`);} setImportPreview(null); setListFilter("all"); };
  const downloadTemplate=()=>{ const url="data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,UEsDBBQABgAIAAAAIQBi7p1oXgEAAJAEAAATAAgCW0NvbnRlbnRfVHlwZXNdLnhtbCCiBAIooAAC"; const a=document.createElement("a"); a.href=url; a.download="Hebrew_Conjugation_Template.xlsx"; a.click(); };

  const getPool=(filter)=>{ const f=filter||quizFilter; if(f===QUIZ_FILTERS.LEARNING_ONLY) return words.filter(w=>w.status==="learning"); if(f===QUIZ_FILTERS.EXCLUDE_MASTERED) return words.filter(w=>w.status!=="mastered"); if(f===QUIZ_FILTERS.HARD_ONLY) return words.filter(w=>w.status==="hard"); return words; };
  const variantPoolSize=(()=>{ const st=new Set(VARIANT_CATS.filter(c=>variantCats.includes(c.id)).flatMap(c=>c.types)); const pool=getPool(variantFilter).filter(w=>(w.variants||[]).some(v=>st.has(v.type))); return pool.flatMap(w=>(w.variants||[]).filter(v=>st.has(v.type))).length; })();

  const updateWordStats=(wordId,correct)=>{ setWords(ws=>ws.map(w=>{ if(w.id!==wordId) return w; const ns=correct?w.streak+1:0; const nw=correct?w.wrongCount:w.wrongCount+1; let st=w.status; if(correct&&ns>=3) st="mastered"; else if(!correct&&nw>=2) st="hard"; return{...w,streak:ns,wrongCount:nw,status:st}; })); };
  const setManualStatus=(id,status)=>{ setWords(ws=>ws.map(w=>w.id===id?{...w,status,streak:status==="mastered"?3:0,wrongCount:status==="hard"?2:0}:w)); };

  const startQuiz=()=>{ const pool=getPool(); if(pool.length<4) return; const count=Math.min(quizCount===9999?pool.length:quizCount,pool.length); const qs=shuffle(pool).slice(0,count).map(w=>generateQuestion(w,words,quizType)); setQuestions(qs); setCurrent(0); setSelected(null); setConfirmed(false); setScore(0); setWrongWords([]); setMode(MODES.QUIZ); setAnimKey(k=>k+1); };
  const startEssay=()=>{ const pool=getPool(essayFilter); if(!pool.length) return; const count=Math.min(essayCount===9999?pool.length:essayCount,pool.length); const qs=shuffle(pool).slice(0,count).map(w=>{ let type=essayType; if(type==="mixed") type=Math.random()>0.5?"heb_to_mean":"mean_to_heb"; return type==="heb_to_mean"?{wordId:w.id,question:w.hebrew,answer:w.meaning,questionType:"heb_to_mean",hebrewWord:w.hebrew}:{wordId:w.id,question:w.meaning,answer:w.hebrew,questionType:"mean_to_heb",hebrewWord:w.hebrew}; }); setEssayQuestions(qs); setEssayCurrent(0); setEssayInput(""); setEssayConfirmed(false); setEssayResults([]); setMode(MODES.ESSAY); setAnimKey(k=>k+1); };

  const startVariantQuiz=()=>{
    const selectedTypes=new Set(VARIANT_CATS.filter(c=>variantCats.includes(c.id)).flatMap(c=>c.types));
    const pool=getPool(variantFilter).filter(w=>(w.variants||[]).some(v=>selectedTypes.has(v.type)));
    if(!pool.length){showToast("선택한 변형 유형의 단어가 없어요.","err");return;}
    const allForms=[...new Set(pool.flatMap(w=>(w.variants||[]).filter(v=>selectedTypes.has(v.type)).map(v=>v.form)))];
    const pairs=[];
    for(const w of pool){ for(const v of (w.variants||[])){ if(!selectedTypes.has(v.type)) continue; const distractors=shuffle(allForms.filter(f=>f!==v.form)).slice(0,3); while(distractors.length<3) distractors.push("—"); pairs.push({wordId:w.id,base:w.hebrew,meaning:w.meaning,variantType:v.type,answer:v.form,choices:shuffle([v.form,...distractors])}); } }
    const count=Math.min(variantCount===9999?pairs.length:variantCount,pairs.length);
    setVariantQuestions(shuffle(pairs).slice(0,count)); setVariantCur(0); setVariantInput(""); setVariantConfirmed(false); setVariantResults([]); setVariantSelected(null); setMode(MODES.VARIANT); setAnimKey(k=>k+1);
  };

  const handleVariantConfirm=()=>{ const q=variantQuestions[variantCur]; if(variantQuizType==="mcq"){ if(!variantSelected) return; const correct=variantSelected===q.answer; updateWordStats(q.wordId,correct); setVariantResults(r=>[...r,{...q,userInput:variantSelected,correct}]); setVariantConfirmed(true); speak(q.answer); } else { if(!variantInput.trim()) return; const correct=stripNikkud(variantInput.trim())===stripNikkud(q.answer)||variantInput.trim()===q.answer; updateWordStats(q.wordId,correct); setVariantResults(r=>[...r,{...q,userInput:variantInput,correct}]); setVariantConfirmed(true); speak(q.answer); } };
  const handleVariantNext=()=>{ if(variantCur+1>=variantQuestions.length){setMode(MODES.VARIANT_RESULT);return;} setVariantCur(c=>c+1); setVariantInput(""); setVariantConfirmed(false); setVariantSelected(null); if(variantQuizType==="essay"&&variantInputRef.current) variantInputRef.current.focus(); };

  const getEssayInputValue=()=>{ const q=essayQuestions[essayCurrent]; if(q?.questionType==="mean_to_heb") return essayHebrewRef.current?essayHebrewRef.current.value:""; return essayInput; };
  const handleEssayConfirm=()=>{ const q=essayQuestions[essayCurrent]; const inputVal=getEssayInputValue(); if(!inputVal.trim()) return; const checkVal=q.questionType==="mean_to_heb"?stripNikkud(inputVal):inputVal; const checkAns=q.questionType==="mean_to_heb"?stripNikkud(q.answer):q.answer; const result=checkEssayAnswer(checkVal,checkAns); updateWordStats(q.wordId,result!=="wrong"); setEssayResults(r=>[...r,{...q,userInput:inputVal,result}]); setEssayConfirmed(true); speak(q.hebrewWord||q.question); };
  const handleEssayNext=()=>{ if(essayCurrent+1>=essayQuestions.length){setMode(MODES.ESSAY_RESULT);return;} setEssayCurrent(c=>c+1); setEssayInput(""); setEssayConfirmed(false); setAnimKey(k=>k+1); if(essayHebrewRef.current) essayHebrewRef.current.value=""; };
  const handleSelect=choice=>{ if(!confirmed) setSelected(choice); };
  const handleConfirm=()=>{ if(!selected) return; const correct=selected===questions[current].answer; if(correct) setScore(s=>s+1); else setWrongWords(w=>[...w,questions[current]]); updateWordStats(questions[current].wordId,correct); setConfirmed(true); }; // eslint-disable-line
  const handleNext=()=>{ if(current+1>=questions.length){setMode(MODES.RESULT);return;} setCurrent(c=>c+1); setSelected(null); setConfirmed(false); setAnimKey(k=>k+1); };

  const addWord=()=>{
    if(!newHebrew.trim()||!newMeaning.trim()) return;
    if(editId!==null){ setWords(ws=>ws.map(w=>w.id===editId?{...w,hebrew:newHebrew.trim(),meaning:newMeaning.trim(),...(newWordType?{wordType:newWordType}:{})}:w)); setEditId(null); }
    else { const newId=Date.now(); setWords(ws=>[{id:newId,hebrew:newHebrew.trim(),meaning:newMeaning.trim(),status:"learning",streak:0,wrongCount:0,...(newWordType?{wordType:newWordType}:{})}, ...ws]); setPage(0); if(newWordWallets.size>0){saveWallets(wallets.map(wl=>newWordWallets.has(wl.id)?{...wl,wordIds:[...wl.wordIds,newId]}:wl));} }
    setNewHebrew(""); setNewMeaning(""); setNewWordType(null);
  };
  const deleteWord=(id)=>{ if(walletFilter){saveWallets(wallets.map(wl=>wl.id===walletFilter?{...wl,wordIds:wl.wordIds.filter(i=>i!==id)}:wl));}else{setWords(ws=>ws.filter(w=>w.id!==id));saveWallets(wallets.map(wl=>({...wl,wordIds:wl.wordIds.filter(i=>i!==id)})));} };
  const startEdit=word=>{ setEditId(word.id); setNewHebrew(word.hebrew); setNewMeaning(word.meaning); setNewWordType(word.wordType||null); setOpenSections(s=>({...s,add:true})); window.scrollTo({top:0,behavior:'smooth'}); };
  const cancelEdit=()=>{ setEditId(null); setNewHebrew(""); setNewMeaning(""); setNewWordType(null); };

  // Auto-speak
  const spokenKey=useRef(-1);
  useEffect(()=>{ if(mode!==MODES.QUIZ||soundMode!=="auto") return; const q=questions[current]; if(!q||q.questionType!==QUIZ_TYPES.HEB_TO_MEAN) return; if(spokenKey.current===animKey) return; spokenKey.current=animKey; const t=setTimeout(()=>speak(q.question),500); return()=>clearTimeout(t); },[current,animKey,mode,soundMode]); // eslint-disable-line
  useEffect(()=>{ if(mode===MODES.ESSAY&&essayInputRef.current) essayInputRef.current.focus(); },[essayCurrent,mode]);

  // Computed
  const searchedWords=(()=>{
    let result=words.filter(w=>{ const matchFilter=listFilter==="all"||w.status===listFilter; if(!matchFilter) return false; if(walletFilter){const wl=wallets.find(x=>x.id===walletFilter);if(!wl||!wl.wordIds.includes(w.id)) return false;} if(!searchQuery.trim()) return true; const q=searchQuery.toLowerCase(); return w.hebrew.includes(searchQuery.trim())||w.meaning.toLowerCase().includes(q)||(w.hebrew&&stripNikkud(w.hebrew).includes(searchQuery.trim())); });
    if(sortBy==="hebrew_asc") result=[...result].sort((a,b)=>a.hebrew.localeCompare(b.hebrew,'he'));
    else if(sortBy==="hebrew_desc") result=[...result].sort((a,b)=>b.hebrew.localeCompare(a.hebrew,'he'));
    else if(sortBy==="meaning_asc") result=[...result].sort((a,b)=>a.meaning.localeCompare(b.meaning));
    else if(sortBy==="meaning_desc") result=[...result].sort((a,b)=>b.meaning.localeCompare(a.meaning));
    else if(sortBy==="hard_first") result=[...result].sort((a,b)=>{const o={hard:0,learning:1,mastered:2};return(o[a.status]??1)-(o[b.status]??1);});
    else if(sortBy==="mastered_first") result=[...result].sort((a,b)=>{const o={mastered:0,learning:1,hard:2};return(o[a.status]??1)-(o[b.status]??1);});
    else if(sortBy==="wrong_desc") result=[...result].sort((a,b)=>(b.wrongCount||0)-(a.wrongCount||0));
    return result;
  })();
  const totalPages=Math.ceil(searchedWords.length/pageSize);
  const filteredWords=pageSize===9999?searchedWords:searchedWords.slice(page*pageSize,(page+1)*pageSize);
  const q=questions[current]; const eq=essayQuestions[essayCurrent];
  const progress=questions.length>0?((current+(confirmed?1:0))/questions.length)*100:0;
  const essayProgress=essayQuestions.length>0?((essayCurrent+(essayConfirmed?1:0))/essayQuestions.length)*100:0;
  const poolSize=getPool().length; const essayPoolSize=getPool(essayFilter).length;
  const countOptions=[5,10,20,"전체"].map(v=>({label:v==="전체"?(uiLang==="en"?"All":"전체"):`${v}`,value:v==="전체"?9999:v}));
  const essayScore=essayResults.filter(r=>r.result==="exact").length;
  const essayPartial=essayResults.filter(r=>r.result==="partial").length;

  // Section header component
  const SectionHeader=({sectionKey,title,color=TA,badge=null})=>(
    <button onClick={()=>toggleSection(sectionKey)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",background:"none",border:"none",cursor:"pointer",padding:"18px 0",textAlign:"left"}}>
      <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
        <span style={{fontSize:"0.62rem",fontWeight:700,color,letterSpacing:"2px",textTransform:"uppercase"}}>{title}</span>
        {badge&&<span style={{fontSize:"0.6rem",background:"rgba(255,255,255,0.05)",padding:"2px 7px",borderRadius:"2px",color:TD,letterSpacing:"0.5px"}}>{badge}</span>}
      </div>
      <span style={{fontSize:"0.6rem",color:TD,transition:"transform 0.2s",display:"inline-block",transform:openSections[sectionKey]?"rotate(180deg)":"rotate(0deg)"}}>▾</span>
    </button>
  );

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",background:TB,color:TT,fontFamily:"'DM Sans',sans-serif",padding:"0 0 100px"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        *{box-sizing:border-box;} body{margin:0;background:#09080D;}
        input,button,textarea{-webkit-tap-highlight-color:transparent;font-family:'DM Sans',sans-serif;}
        input:focus,textarea:focus{outline:none;border-color:rgba(232,74,95,0.55)!important;background:rgba(255,255,255,0.06)!important;}
        ::-webkit-scrollbar{width:3px;height:3px;} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);}
        @media(max-width:480px){.cg{grid-template-columns:1fr!important;}.qr{flex-direction:column!important;}.rb{flex-direction:column!important;}}
      `}</style>

      {/* Toast */}
      {toast&&<div style={{position:"fixed",top:"16px",left:"50%",transform:"translateX(-50%)",background:toast.type==="err"?"#cc2222":TA,color:"#fff",padding:"9px 18px",borderRadius:"2px",fontSize:"0.78rem",fontWeight:600,zIndex:1000,boxShadow:`0 4px 20px rgba(232,74,95,0.35)`,whiteSpace:"nowrap",maxWidth:"90vw",textAlign:"center",letterSpacing:"0.3px"}}>{toast.msg}</div>}

      {/* Paste Modal */}
      {showPasteModal&&<div style={Mo.overlay} onClick={()=>setShowPasteModal(false)}><div style={Mo.box} onClick={e=>e.stopPropagation()}><h3 style={Mo.title}>{uiLang==="en"?"Import from Text":"텍스트로 불러오기"}</h3><textarea style={Mo.ta} placeholder='{"version":1,"words":[...]}' value={pasteText} onChange={e=>setPasteText(e.target.value)}/><div style={Mo.row}><button style={Bt.primary} onClick={importFromText}>{uiLang==="en"?"Import":"불러오기"}</button><button style={Bt.ghost} onClick={()=>{setShowPasteModal(false);setPasteText("");}}>취소</button></div></div></div>}

      {/* Batch Text Modal */}
      {showBatchModal&&<div style={Mo.overlay} onClick={()=>setShowBatchModal(false)}><div style={Mo.box} onClick={e=>e.stopPropagation()}><h3 style={Mo.title}>{uiLang==="en"?"Add by Text":"텍스트 형식으로 단어 추가"}</h3><p style={Mo.sub}>히브리어=뜻 형식으로 한 줄에 하나씩</p><textarea ref={batchTextRef} style={{...Mo.ta,fontFamily:"Arial,sans-serif"}} lang="he" placeholder={"שָׁלוֹם=평화\nתּוֹדָה=감사합니다"} defaultValue="" spellCheck={false} autoCorrect="off"/><div style={Mo.row}><button style={Bt.primary} onClick={importFromBatchText}>{uiLang==="en"?"Add":"단어 추가"}</button><button style={Bt.ghost} onClick={()=>{setShowBatchModal(false);if(batchTextRef.current)batchTextRef.current.value="";}}>취소</button></div></div></div>}

      {/* Word Search Modal */}
      {showWordSearchModal&&<div style={Mo.overlay} onClick={()=>setShowWordSearchModal(false)}><div style={{...Mo.box,maxWidth:"480px"}} onClick={e=>e.stopPropagation()}><h3 style={Mo.title}>{uiLang==="en"?"Search by Meaning":"뜻으로 검색"}</h3><p style={Mo.sub}>{uiLang==="en"?"Enter Korean or English to find Hebrew words":"한국어 또는 영어로 히브리어 단어를 찾아요"}</p><div style={{display:"flex",gap:"8px",marginBottom:"10px"}}><input style={{...Bt.input,flex:1}} placeholder="사랑, love..." value={wordSearchInput} onChange={e=>setWordSearchInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchWordByMeaning()}/><button onClick={searchWordByMeaning} disabled={wordSearchLoading} style={{...Bt.primary,minWidth:"52px",opacity:wordSearchLoading?0.5:1}}>{wordSearchLoading?"…":"검색"}</button></div>{wordSearchError&&<div style={{color:TA,fontSize:"0.78rem",marginBottom:"8px",padding:"7px 10px",background:"rgba(232,74,95,0.06)",borderRadius:"2px"}}>{wordSearchError}</div>}{wordSearchResults.length>0&&(<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}><span style={{fontSize:"0.68rem",color:TD}}>{wordSearchResults.length}개</span><div style={{display:"flex",gap:"5px"}}><button onClick={()=>setWordSearchSelected(s=>s.size===wordSearchResults.length?new Set():new Set(wordSearchResults.map((_,i)=>i)))} style={{...Bt.ghost,fontSize:"0.68rem",padding:"2px 7px"}}>전체선택</button>{wordSearchSelected.size>0&&<button onClick={addSelectedWordSearchResults} style={{...Bt.primary,padding:"4px 10px",fontSize:"0.75rem"}}>{wordSearchSelected.size}개 추가</button>}</div></div><div style={{maxHeight:"300px",overflowY:"auto"}}>{wordSearchResults.map((r,i)=>{const sel=wordSearchSelected.has(i);const exists=!!words.find(w=>stripNikkud(w.hebrew||"")===stripNikkud(r.hebrew||"")&&w.meaning===r.meaning);return(<div key={i} onClick={()=>{if(exists)return;setWordSearchSelected(s=>{const n=new Set(s);n.has(i)?n.delete(i):n.add(i);return n;});}} style={{display:"flex",gap:"8px",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${TL}`,cursor:exists?"default":"pointer",opacity:exists?0.4:1}}><div style={{width:"13px",height:"13px",borderRadius:"2px",flexShrink:0,border:`1px solid ${sel?"rgba(232,74,95,0.6)":"rgba(255,255,255,0.15)"}`,background:sel?"rgba(232,74,95,0.8)":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>{sel&&<span style={{color:"#fff",fontSize:"0.55rem",fontWeight:700}}>✓</span>}</div>{r.pos!=="translation"&&<span style={{fontFamily:"Arial",direction:"rtl",fontSize:"1rem",color:TH,minWidth:"70px"}}>{r.hebrew}</span>}<span style={{fontSize:"0.8rem",color:TT,flex:1}}>{r.meaning}</span>{exists&&<span style={{fontSize:"0.6rem",color:TG}}>✓</span>}</div>);})}</div></div>)}<div style={{marginTop:"12px"}}><button style={{...Bt.ghost,width:"100%"}} onClick={()=>{setShowWordSearchModal(false);setWordSearchResults([]);setWordSearchInput("");}}>닫기</button></div></div></div>}

      {/* Root Search Modal */}
      {showRootModal&&<div style={Mo.overlay} onClick={()=>setShowRootModal(false)}><div style={{...Mo.box,maxWidth:"480px"}} onClick={e=>e.stopPropagation()}><h3 style={Mo.title}>{T.rootSearch}</h3><p style={Mo.sub}>{uiLang==="en"?"Enter a Hebrew root (e.g. ד-ב-ר)":"히브리어 어근을 입력하면 파생 단어를 가져와요"}</p><div style={{display:"flex",gap:"8px",marginBottom:"10px"}}><input style={{...Bt.input,flex:1,direction:"rtl",fontFamily:"Arial",fontSize:"1.05rem"}} placeholder="ד-ב-ר" value={rootSearchInput} onChange={e=>setRootSearchInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchByRoot()}/><button onClick={searchByRoot} disabled={rootSearchLoading} style={{...Bt.primary,minWidth:"52px",opacity:rootSearchLoading?0.5:1}}>{rootSearchLoading?"…":"검색"}</button></div>{rootSearchError&&<div style={{color:TA,fontSize:"0.78rem",marginBottom:"8px",padding:"7px",background:"rgba(232,74,95,0.06)",borderRadius:"2px"}}>{rootSearchError}</div>}{rootSearchResults.length>0&&(<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px",gap:"6px"}}><span style={{fontSize:"0.68rem",color:TD}}>{rootSearchResults.length}개</span><div style={{display:"flex",gap:"5px"}}><button onClick={()=>setRootSelected(s=>s.size===rootSearchResults.length?new Set():new Set(rootSearchResults.map((_,i)=>i)))} style={{...Bt.ghost,fontSize:"0.68rem",padding:"2px 7px"}}>전체선택</button>{rootSelected.size>0&&<button onClick={addSelectedRootWords} style={{...Bt.primary,padding:"4px 10px",fontSize:"0.75rem"}}>{rootSelected.size}개 추가</button>}</div></div><div style={{maxHeight:"280px",overflowY:"auto"}}>{rootSearchResults.map((r,i)=>{const isSelected=rootSelected.has(i);const alreadyAdded=!!words.find(w=>stripNikkud(w.hebrew)===stripNikkud(r.hebrew));return(<div key={i} onClick={()=>{if(alreadyAdded)return;setRootSelected(s=>{const n=new Set(s);n.has(i)?n.delete(i):n.add(i);return n;});}} style={{display:"flex",gap:"8px",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${TL}`,cursor:alreadyAdded?"default":"pointer",opacity:alreadyAdded?0.4:1}}><div style={{width:"13px",height:"13px",borderRadius:"2px",flexShrink:0,border:`1px solid ${isSelected?"rgba(232,74,95,0.6)":"rgba(255,255,255,0.15)"}`,background:isSelected?"rgba(232,74,95,0.8)":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>{isSelected&&<span style={{color:"#fff",fontSize:"0.55rem",fontWeight:700}}>✓</span>}</div>{r.pos&&<span style={{fontSize:"0.58rem",padding:"1px 5px",borderRadius:"2px",background:"rgba(255,255,255,0.04)",color:TM,flexShrink:0}}>{r.pos}</span>}<span style={{fontFamily:"Arial",direction:"rtl",fontSize:"1rem",color:TH,minWidth:"65px"}}>{r.hebrew}</span><span style={{fontSize:"0.78rem",color:TM,flex:1}}>{r.meaning||""}</span>{alreadyAdded&&<span style={{fontSize:"0.6rem",color:TG}}>✓</span>}</div>);})}</div></div>)}<div style={{marginTop:"12px"}}><button style={{...Bt.ghost,width:"100%"}} onClick={()=>{setShowRootModal(false);setRootSearchResults([]);setRootSearchInput("");}}>닫기</button></div></div></div>}

      {/* Pealim Modal */}
      {showPealimModal&&<div style={Mo.overlay}><div style={{...Mo.box,maxWidth:"500px",maxHeight:"88vh",overflowY:"auto"}}><h3 style={Mo.title}>{uiLang==="en"?"Reverso Conjugation":"Reverso 동사 변형"}</h3><p style={Mo.sub}>{uiLang==="en"?"Enter a Hebrew verb infinitive (e.g. לָשִׁיר)":"히브리어 동사 원형을 입력하면 변형표를 자동으로 가져와요"}</p><div style={{display:"flex",gap:"8px",marginBottom:"10px"}}><input style={{...Bt.input,flex:1,direction:"rtl",fontFamily:"Arial",fontSize:"1.05rem"}} placeholder="לָשִׁיר, לְדַבֵּר..." value={pealimRoot} onChange={e=>setPealimRoot(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchPealim()} lang="he" spellCheck={false} autoCorrect="off"/><button onClick={searchPealim} disabled={pealimLoading} style={{...Bt.green,minWidth:"52px",opacity:pealimLoading?0.5:1}}>{pealimLoading?"…":"검색"}</button></div><div style={{display:"flex",gap:"5px",flexWrap:"wrap",marginBottom:"10px"}}>{[["לְדַבֵּר","말하다"],["לָלֶכֶת","가다"],["לֶאֱכֹל","먹다"],["לִכְתּוֹב","쓰다"],["לָשִׁיר","노래"]].map(([v,h])=>(<button key={v} onClick={()=>setPealimRoot(v)} style={{padding:"3px 9px",borderRadius:"2px",background:"rgba(255,255,255,0.03)",border:`1px solid ${TL}`,color:TH,fontSize:"0.75rem",cursor:"pointer",fontFamily:"Arial",direction:"rtl"}}>{v} <span style={{color:TD,direction:"ltr"}}>{h}</span></button>))}</div>{pealimError&&<div style={{padding:"8px",background:"rgba(232,74,95,0.06)",border:"1px solid rgba(232,74,95,0.2)",borderRadius:"2px",color:"#f08080",fontSize:"0.8rem",marginBottom:"8px"}}>{pealimError}</div>}{pealimPreview&&(<div><div style={{background:"rgba(80,200,152,0.05)",border:"1px solid rgba(80,200,152,0.15)",borderRadius:"2px",padding:"14px",marginBottom:"10px"}}><div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px"}}><span style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.4rem",color:TG}}>{pealimPreview.infinitive}</span><span style={{fontSize:"0.65rem",background:"rgba(80,200,152,0.1)",padding:"2px 7px",borderRadius:"2px",color:TG}}>{Object.keys(pealimPreview.variants||{}).length}개 변형</span></div><input value={pealimPreview.meaning||""} onChange={e=>setPealimPreview(p=>({...p,meaning:e.target.value}))} style={{...Bt.input,marginBottom:"10px"}} placeholder={uiLang==="en"?"Enter meaning (required)":"뜻 입력 *필수"}/><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"2px",maxHeight:"200px",overflowY:"auto"}}>{Object.entries(pealimPreview.variants||{}).filter(([,f])=>f).map(([tid,form])=>(<div key={tid} onClick={()=>speakOnDemand(form)} style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"5px 3px",background:"rgba(255,255,255,0.03)",borderRadius:"2px",cursor:"pointer",border:`1px solid ${TL}`}}><span style={{color:TD,fontSize:"0.55rem"}}>{tid}</span><span style={{fontFamily:"Arial",direction:"rtl",color:TT,fontSize:"0.85rem",fontWeight:600}}>{form}</span></div>))}</div></div><button onClick={addNewWordFromPealim} style={{...Bt.green,width:"100%",padding:"12px",marginBottom:"6px"}}>단어장에 추가</button><button onClick={()=>setPealimPreview(null)} style={{...Bt.ghost,width:"100%"}}>← 다시 검색</button></div>)}<div style={{marginTop:"12px"}}><button style={{...Bt.ghost,width:"100%"}} onClick={()=>{setShowPealimModal(false);setPealimRoot("");setPealimPreview(null);}}>닫기</button></div></div></div>}

      {/* Wallet Pick */}
      {walletPickWord&&<div style={{...Mo.overlay,zIndex:9999}} onClick={()=>setWalletPickWord(null)}><div style={{...Mo.box,maxWidth:"300px"}} onClick={e=>e.stopPropagation()}><h3 style={Mo.title}>{uiLang==="en"?"Add to Wordbook":"단어장 선택"}</h3><div style={{display:"flex",flexDirection:"column",gap:"4px",marginBottom:"12px"}}>{wallets.map(wl=>{const inWallet=wl.wordIds.includes(walletPickWord);return(<button key={wl.id} onClick={()=>toggleWordInWallet(wl.id,walletPickWord)} style={{display:"flex",alignItems:"center",gap:"9px",padding:"9px 12px",borderRadius:"2px",background:inWallet?"rgba(232,74,95,0.07)":"rgba(255,255,255,0.02)",border:`1px solid ${inWallet?"rgba(232,74,95,0.28)":TL}`,cursor:"pointer",textAlign:"left"}}><div style={{width:"13px",height:"13px",borderRadius:"2px",flexShrink:0,background:inWallet?wl.color:"transparent",border:`1px solid ${inWallet?wl.color:"rgba(255,255,255,0.2)"}`,display:"flex",alignItems:"center",justifyContent:"center"}}>{inWallet&&<span style={{color:"#fff",fontSize:"0.55rem",fontWeight:700}}>✓</span>}</div><span style={{color:TT,flex:1,fontWeight:inWallet?600:400,fontSize:"0.85rem"}}>{wl.name}</span></button>);})}</div><button style={{...Bt.primary,width:"100%"}} onClick={()=>setWalletPickWord(null)}>완료</button></div></div>}

      {/* Wallet Modal */}
      {showWalletModal&&<div style={Mo.overlay} onClick={()=>setShowWalletModal(false)}><div style={{...Mo.box,maxWidth:"440px",maxHeight:"80vh",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}><h3 style={Mo.title}>{uiLang==="en"?"Wordbooks":"커스텀 단어장"}</h3>{walletView!==null?(()=>{const wl=wallets.find(w=>w.id===walletView);if(!wl)return null;const wlWords=getWalletWords(walletView);return(<div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}><div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"10px"}}><button onClick={()=>setWalletView(null)} style={{...Bt.ghost,padding:"3px 9px",fontSize:"0.72rem"}}>← 목록</button><span style={{fontWeight:700,color:wl.color,fontSize:"0.88rem"}}>{wl.name}</span><span style={{fontSize:"0.68rem",color:TD}}>{wlWords.length}개</span></div>{wlWords.length>0?(<><div style={{flex:1,overflowY:"auto",marginBottom:"8px"}}>{wlWords.map(w=>(<div key={w.id} style={{display:"flex",alignItems:"center",gap:"8px",padding:"7px 0",borderBottom:`1px solid ${TL}`}}><span style={{fontFamily:"Arial",direction:"rtl",color:TH,fontSize:"1rem",minWidth:"70px"}}>{w.hebrew}</span><span style={{color:TM,fontSize:"0.78rem",flex:1}}>{w.meaning}</span><button onClick={()=>toggleWordInWallet(wl.id,w.id)} style={{padding:"2px 7px",borderRadius:"2px",background:"rgba(232,74,95,0.07)",border:"1px solid rgba(232,74,95,0.2)",color:TA,cursor:"pointer",fontSize:"0.68rem"}}>제거</button></div>))}</div><div style={{display:"flex",gap:"6px"}}><button onClick={()=>{if(wlWords.length<4){showToast("객관식은 4개 이상 필요해요","err");return;}const qs=wlWords.map(w=>generateQuestion(w,wlWords.length>=4?wlWords:words,quizType));setQuestions(qs);setCurrent(0);setSelected(null);setConfirmed(false);setScore(0);setWrongWords([]);setMode(MODES.QUIZ);setAnimKey(k=>k+1);setShowWalletModal(false);}} style={{flex:1,...Bt.primary,fontSize:"0.78rem",padding:"8px"}}>MCQ</button><button onClick={()=>{const qs=wlWords.map(w=>({wordId:w.id,question:w.hebrew,answer:w.meaning,hebrewWord:w.hebrew,questionType:"heb_to_mean"}));setEssayQuestions(qs);setEssayCurrent(0);setEssayInput("");setEssayConfirmed(false);setEssayResults([]);setMode(MODES.ESSAY);setAnimKey(k=>k+1);setShowWalletModal(false);}} style={{flex:1,...Bt.essay,fontSize:"0.78rem",padding:"8px"}}>서술형</button></div></>):(<div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:TD,fontSize:"0.82rem"}}>단어가 없어요. 각 단어의 📚 버튼을 눌러 추가하세요.</div>)}</div>);}):(<><div style={{display:"flex",gap:"8px",marginBottom:"10px",alignItems:"center"}}><input value={walletName} onChange={e=>setWalletName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createWallet()} style={{...Bt.input,flex:1}} placeholder="단어장 이름..."/><div style={{display:"flex",gap:"3px"}}>{[TA,TG,TP,TBL,TH,"#F59E0B"].map(c=>(<button key={c} onClick={()=>setWalletColor(c)} style={{width:"16px",height:"16px",borderRadius:"2px",background:c,border:walletColor===c?"2px solid #fff":"2px solid transparent",cursor:"pointer",flexShrink:0}}/>))}</div><button onClick={createWallet} disabled={!walletName.trim()} style={{...Bt.primary,padding:"8px 12px",opacity:walletName.trim()?1:0.4,fontSize:"0.78rem"}}>만들기</button></div>{wallets.length===0?<div style={{textAlign:"center",color:TD,padding:"28px 0",fontSize:"0.8rem"}}>아직 단어장이 없어요.</div>:<div style={{flex:1,overflowY:"auto"}}>{wallets.map(wl=>{const cnt=words.filter(w=>wl.wordIds.includes(w.id)).length;return(<div key={wl.id} style={{display:"flex",alignItems:"center",gap:"8px",padding:"9px 0",borderBottom:`1px solid ${TL}`}}><div style={{width:"8px",height:"8px",borderRadius:"2px",background:wl.color,flexShrink:0}}/><button onClick={()=>setWalletView(wl.id)} style={{flex:1,background:"none",border:"none",color:TT,cursor:"pointer",textAlign:"left",fontSize:"0.85rem",fontWeight:500}}>{wl.name}</button><span style={{fontSize:"0.68rem",color:TD}}>{cnt}</span><button onClick={()=>deleteWallet(wl.id)} style={{padding:"2px 7px",borderRadius:"2px",background:"rgba(232,74,95,0.07)",border:"1px solid rgba(232,74,95,0.2)",color:TA,cursor:"pointer",fontSize:"0.68rem"}}>삭제</button></div>);})}</div>}</>)}<div style={{marginTop:"10px"}}><button style={{...Bt.ghost,width:"100%"}} onClick={()=>{setShowWalletModal(false);setWalletView(null);}}>닫기</button></div></div></div>}

      {/* Merge Modal */}
      {showMergeModal&&pendingCloudWords&&<div style={Mo.overlay}><div style={Mo.box}><h3 style={Mo.title}>{uiLang==="en"?"Sync Wordbook":"단어장 동기화"}</h3><p style={Mo.sub}>기기와 클라우드 단어장이 모두 있어요. 어떻게 할까요?</p><div style={{display:"flex",flexDirection:"column",gap:"5px"}}><button style={{...Bt.primary,padding:"11px"}} onClick={()=>handleMerge("merge")}>합치기 ({(() => { const local=loadWords(); const set=new Set(pendingCloudWords.map(w=>w.hebrew)); return pendingCloudWords.length + local.filter(w=>!set.has(w.hebrew)).length; })()}개)</button><button style={{...Bt.ghost,padding:"11px"}} onClick={()=>handleMerge("cloud")}>클라우드 사용 ({pendingCloudWords.length}개)</button><button style={{...Bt.ghost,padding:"11px"}} onClick={()=>handleMerge("local")}>기기 단어 유지</button></div></div></div>}

      {/* Import Preview */}
      {importPreview&&<div style={Mo.overlay}><div style={Mo.box}><h3 style={Mo.title}>{uiLang==="en"?"Import Words":"단어 불러오기"}</h3><p style={Mo.sub}><span style={{color:TH}}>{importPreview.fileName}</span> — <b style={{color:TT}}>{importPreview.words.length}</b>개 단어</p><div style={{borderTop:`1px solid ${TL}`,marginBottom:"12px"}}>{importPreview.words.slice(0,5).map((w,i)=>(<div key={i} style={{padding:"6px 0",borderBottom:`1px solid ${TL}`,display:"flex",alignItems:"center",gap:"8px",fontSize:"0.82rem"}}><span style={{fontFamily:"Arial,sans-serif",color:TH,direction:"rtl"}}>{w.hebrew}</span><span style={{color:TD}}>→</span><span style={{color:TM}}>{w.meaning}</span></div>))}{importPreview.words.length>5&&<p style={{color:TD,fontSize:"0.72rem",margin:"5px 0 0"}}>… 외 {importPreview.words.length-5}개</p>}</div><div style={Mo.row}><button style={Bt.primary} onClick={()=>confirmImport(true)}>+ 추가</button><button style={Bt.ghost} onClick={()=>confirmImport(false)}>전체 교체</button><button style={Bt.ghost} onClick={()=>setImportPreview(null)}>취소</button></div></div></div>}

      {/* Variant Edit Modal */}
      {expandedVariantWord&&!String(expandedVariantWord).startsWith("menu_")&&(()=>{
        const editWord=words.find(w=>w.id===expandedVariantWord);if(!editWord) return null;
        return(<div style={{...Mo.overlay,alignItems:"flex-start",paddingTop:"16px",overflowY:"auto"}}><div style={{...Mo.box,maxWidth:"580px",maxHeight:"90vh",overflowY:"auto"}}><div style={{marginBottom:"12px"}}><h3 style={{...Mo.title,marginBottom:"4px"}}>{uiLang==="en"?"Edit Variants":"변형 편집"}</h3><div style={{display:"flex",alignItems:"center",gap:"10px"}}><span style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.3rem",color:TH}}>{editWord.hebrew}</span><button onClick={()=>speakOnDemand(editWord.hebrew)} style={{...Bt.ghost,padding:"3px 7px",fontSize:"0.8rem"}}>▷</button><span style={{fontSize:"0.78rem",color:TM}}>{editWord.meaning}</span></div></div><div style={{display:"flex",gap:"5px",marginBottom:"12px"}}>{[["false","편집"],["view","보기"],["paste","붙여넣기"]].map(([val,lbl])=>(<button key={val} onClick={()=>setVariantPasteMode(val==="false"?false:val)} style={{...Bt.ghost,flex:1,fontSize:"0.75rem",...(String(variantPasteMode)===val?{background:"rgba(232,74,95,0.1)",borderColor:"rgba(232,74,95,0.4)",color:TA}:{})}}>{lbl}</button>))}</div>{variantPasteMode==="paste"&&(<div><div style={{fontSize:"0.68rem",color:TD,marginBottom:"5px"}}>순서대로 줄바꿈하여 붙여넣으면 자동 매핑됩니다.</div><textarea style={{width:"100%",minHeight:"120px",background:"rgba(255,255,255,0.03)",border:`1px solid rgba(80,200,152,0.25)`,borderRadius:"2px",color:TT,padding:"10px",fontSize:"1rem",direction:"rtl",fontFamily:"Arial",resize:"vertical",outline:"none",lineHeight:1.8}} placeholder="여성형&#10;남성형&#10;..." lang="he" spellCheck={false} autoCorrect="off" value={variantPasteText} onChange={e=>setVariantPasteText(e.target.value)}/><button style={{...Bt.green,width:"100%",marginTop:"6px"}} onClick={()=>applyVariantPaste(variantPasteText)}>자동 매핑 적용</button></div>)}{variantPasteMode===false&&(<div><div style={{display:"flex",gap:"5px",flexWrap:"wrap",marginBottom:"10px"}}><button onClick={()=>setWords(ws=>ws.map(w=>w.id===editWord.id?{...w,wordType:null}:w))} style={{...Bt.ghost,fontSize:"0.72rem",...(!editWord.wordType?{borderColor:"rgba(255,255,255,0.25)",color:TT}:{})}}>전체</button>{WORD_TYPES.map(wt=>(<button key={wt.id} onClick={()=>setWords(ws=>ws.map(w=>w.id===editWord.id?{...w,wordType:wt.id}:w))} style={{...Bt.ghost,fontSize:"0.72rem",...(editWord.wordType===wt.id?{background:"rgba(232,74,95,0.1)",borderColor:"rgba(232,74,95,0.4)",color:TA}:{})}}>{wt.emoji} {wt.label[uiLang]||wt.label.ko}</button>))}</div>{getAllowedCats(editWord.wordType).map(cat=>(<div key={cat.id} style={{marginBottom:"14px"}}><div style={{fontSize:"0.58rem",fontWeight:700,color:cat.color,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"5px",paddingBottom:"2px",borderBottom:`1px solid ${cat.color}20`}}>{cat.label[uiLang]||cat.label.ko}</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(185px,1fr))",gap:"5px"}}>{cat.types.map(tid=>{const vt=VARIANT_TYPES.find(t=>t.id===tid);const label=vt?(vt.label[uiLang]||vt.label.ko):tid;return(<div key={tid} style={{display:"flex",flexDirection:"column",gap:"2px"}}><label style={{fontSize:"0.6rem",color:TD,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span>{label}</span><div style={{display:"flex",gap:"2px"}}>{variantDraft[tid]&&<button onClick={()=>speakOnDemand(variantDraft[tid])} style={{fontSize:"0.6rem",padding:"1px 5px",borderRadius:"2px",background:"rgba(255,255,255,0.03)",border:`1px solid ${TL}`,color:TM,cursor:"pointer"}}>▷</button>}{variantDraft[tid]&&<button onClick={()=>setVariantDraft(d=>({...d,[tid]:""}))} style={{fontSize:"0.58rem",padding:"1px 4px",borderRadius:"2px",background:"rgba(232,74,95,0.05)",border:"1px solid rgba(232,74,95,0.2)",color:TA,cursor:"pointer"}}>✕</button>}</div></label><input value={variantDraft[tid]||""} onChange={e=>setVariantDraft(d=>({...d,[tid]:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();const next=e.target.closest("div").parentElement.nextElementSibling?.querySelector("input");if(next)next.focus();}}} placeholder="히브리어..." lang="he" spellCheck={false} autoCorrect="off" style={{...Bt.input,padding:"6px 10px",fontSize:"0.95rem",direction:"rtl",fontFamily:"Arial",borderColor:variantDraft[tid]?`${cat.color}50`:undefined}}/></div>);})}</div></div>))}</div>)}{variantPasteMode==="view"&&(()=>{const draftEntries=Object.fromEntries(Object.entries(variantDraft).filter(([,f])=>f.trim()));const savedEntries=Object.fromEntries((editWord.variants||[]).map(v=>[v.type,v.form]));const v={...savedEntries,...draftEntries};if(!Object.keys(v).length) return(<div style={{textAlign:"center",color:TD,padding:"24px 0",fontSize:"0.8rem"}}>변형 데이터가 없어요.</div>);return(<div style={{maxHeight:"360px",overflowY:"auto"}}><div style={{fontSize:"0.65rem",color:TD,marginBottom:"6px"}}>클릭하면 발음을 들을 수 있어요</div><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"3px"}}>{Object.entries(v).map(([tid,form])=>{const vt=VARIANT_TYPES.find(t=>t.id===tid);return(<div key={tid} onClick={()=>speakOnDemand(form)} style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"6px 4px",background:"rgba(255,255,255,0.02)",borderRadius:"2px",cursor:"pointer",border:`1px solid ${TL}`}}><span style={{color:TD,fontSize:"0.55rem",marginBottom:"2px"}}>{vt?vt.label[uiLang]||vt.label.ko:tid}</span><span style={{fontFamily:"Arial",direction:"rtl",color:TT,fontSize:"0.88rem",fontWeight:600}}>{form}</span></div>);})})</div></div>);})()}<div style={{display:"flex",gap:"6px",marginTop:"10px",paddingTop:"10px",borderTop:`1px solid ${TL}`}}>{variantPasteMode===false&&<button style={{...Bt.primary,flex:1}} onClick={()=>saveVariantDraft(editWord.id)}>저장 ({Object.values(variantDraft).filter(v=>v.trim()).length}개)</button>}<button style={Bt.ghost} onClick={()=>{setExpandedVariantWord(null);setVariantPasteMode(false);setVariantPasteText("");}}>취소</button></div></div></div>);
      })()}

      {/* ─── MAIN CONTAINER ───────────────────────────────────── */}
      <div style={{maxWidth:"720px",margin:"0 auto",padding:"0 20px"}}>

        {/* HEADER */}
        <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"20px 0",borderBottom:`1px solid ${TL}`}}>
          <div style={{display:"flex",alignItems:"center",gap:"14px"}}>
            <span style={{fontSize:"1.7rem",fontFamily:"'Bebas Neue',sans-serif",color:TA,letterSpacing:"3px",lineHeight:1}}>אב</span>
            <div><h1 style={{margin:0,fontSize:"0.68rem",fontWeight:600,color:TT,letterSpacing:"2.5px",textTransform:"uppercase"}}>{T.appTitle}</h1><p style={{margin:"1px 0 0",fontSize:"0.56rem",color:TD,letterSpacing:"0.8px"}}>{T.appSub}</p></div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"4px"}}>
            <div style={{display:"flex",gap:"5px"}}>
              <span style={{borderRadius:"2px",padding:"3px 7px",fontSize:"0.65rem",fontWeight:700,color:TG,background:"rgba(80,200,152,0.07)",border:`1px solid rgba(80,200,152,0.18)`,letterSpacing:"0.5px"}}>✓ {masteredCount}</span>
              <span style={{borderRadius:"2px",padding:"3px 7px",fontSize:"0.65rem",fontWeight:700,color:TA,background:"rgba(232,74,95,0.07)",border:`1px solid rgba(232,74,95,0.18)`,letterSpacing:"0.5px"}}>! {hardCount}</span>
              <span style={{borderRadius:"2px",padding:"3px 7px",fontSize:"0.65rem",fontWeight:700,color:"#8A8AAA",background:"rgba(138,138,170,0.07)",border:`1px solid rgba(138,138,170,0.15)`,letterSpacing:"0.5px"}}>◎ {learningCount}</span>
            </div>
            <div style={{fontSize:"0.58rem",color:ttsReady?TG:TA,letterSpacing:"0.3px"}}>{ttsReady?"● Google TTS":"○ Browser TTS"}</div>
            {user
              ?<div style={{display:"flex",alignItems:"center",gap:"5px",flexWrap:"wrap",justifyContent:"flex-end"}}>
                <img src={user.photoURL} alt="" style={{width:"18px",height:"18px",borderRadius:"2px"}}/>
                <span style={{fontSize:"0.65rem",color:TM,maxWidth:"80px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.displayName}</span>
                {syncing&&<span style={{fontSize:"0.58rem",color:TD}}>↑</span>}
                <button onClick={()=>setShowWalletModal(true)} style={{...Bt.ghost,fontSize:"0.68rem",padding:"3px 8px",color:TH}}>📚 {wallets.length||"+"}</button>
                <button onClick={()=>{const nl=uiLang==="ko"?"en":"ko";setUiLang(nl);try{localStorage.setItem("uiLang",nl);}catch{}}} style={{...Bt.ghost,fontSize:"0.58rem",padding:"2px 6px",color:TA,fontWeight:700}}>{uiLang==="ko"?"EN":"KO"}</button>
                <button onClick={signOutUser} style={{...Bt.ghost,fontSize:"0.58rem",padding:"2px 6px"}}>{T.logout}</button>
              </div>
              :<div style={{display:"flex",gap:"4px",alignItems:"center"}}>
                <button onClick={()=>setShowWalletModal(true)} style={{...Bt.ghost,fontSize:"0.68rem",padding:"3px 7px"}}>📚{wallets.length>0?` ${wallets.length}`:""}</button>
                <button onClick={signInGoogle} style={{...Bt.primary,fontSize:"0.68rem",padding:"5px 10px"}}>{T.login}</button>
                <button onClick={()=>{const nl=uiLang==="ko"?"en":"ko";setUiLang(nl);try{localStorage.setItem("uiLang",nl);}catch{}}} style={{...Bt.ghost,fontSize:"0.58rem",padding:"2px 6px",color:TA,fontWeight:700}}>{uiLang==="ko"?"EN":"KO"}</button>
              </div>
            }
          </div>
        </header>

        {/* Sync Banner */}
        <div style={{fontSize:"0.6rem",color:user?TG:TD,padding:"7px 0",borderBottom:`1px solid ${TL}`,letterSpacing:"0.4px"}}>{user?`● ${user.displayName} — 모든 기기 자동 동기화`:"○ 이 기기에만 저장됩니다 — 로그인하면 모든 기기에서 동기화"}</div>

        {/* Book Tabs */}
        <div style={{display:"flex",borderBottom:`1px solid ${TL}`}}>
          {BOOKS.map(b=>(<button key={b.id} onClick={()=>switchBook(b.id)} style={{padding:"10px 16px",border:"none",borderBottom:`2px solid ${currentBook===b.id?b.color:"transparent"}`,fontSize:"0.72rem",fontWeight:600,cursor:"pointer",letterSpacing:"0.8px",textTransform:"uppercase",background:"transparent",color:currentBook===b.id?b.color:TD,transition:"all 0.15s"}}>{b.emoji} {b.label[uiLang]||b.label.ko}</button>))}
        </div>

        {/* Float Buttons */}
        {mode===MODES.LIST&&(<><button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} style={{position:"fixed",right:"16px",bottom:"58px",width:"34px",height:"34px",borderRadius:"2px",background:TA,border:"none",color:"#fff",fontWeight:700,fontSize:"0.85rem",cursor:"pointer",zIndex:500,boxShadow:`0 2px 14px rgba(232,74,95,0.28)`,display:"flex",alignItems:"center",justifyContent:"center"}}>↑</button><button onClick={()=>window.scrollTo({top:document.body.scrollHeight,behavior:"smooth"})} style={{position:"fixed",right:"16px",bottom:"14px",width:"34px",height:"34px",borderRadius:"2px",background:TA,border:"none",color:"#fff",fontWeight:700,fontSize:"0.85rem",cursor:"pointer",zIndex:500,boxShadow:`0 2px 14px rgba(232,74,95,0.28)`,display:"flex",alignItems:"center",justifyContent:"center"}}>↓</button></>)}

        {/* ─── LIST MODE ─────────────────────────────────────── */}
        {mode===MODES.LIST&&(<div>

          {/* Add Word */}
          <div style={{borderBottom:`1px solid ${TL}`}}>
            <SectionHeader sectionKey="add" title={editId!==null?T.editWord:T.addWord} badge={editId!==null?"수정 중":null}/>
            {openSections.add&&(<div style={{display:"flex",flexDirection:"column",gap:"8px",paddingBottom:"16px"}}>
              <div style={{display:"flex",gap:"8px"}}><input style={{...Bt.input,flex:1,direction:bookInfo.dir,fontFamily:"Arial,sans-serif",fontSize:"1rem"}} placeholder={bookInfo.placeholderA[uiLang]||bookInfo.placeholderA.ko} value={newHebrew} onChange={e=>setNewHebrew(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addWord()}/><input style={{...Bt.input,flex:1}} placeholder={bookInfo.placeholderB[uiLang]||bookInfo.placeholderB.ko} value={newMeaning} onChange={e=>setNewMeaning(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addWord()}/></div>
              {currentBook==="hebrew"&&<div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>{WORD_TYPES.map(wt=>(<button key={wt.id} onClick={()=>setNewWordType(t=>t===wt.id?null:wt.id)} style={{...Bt.ghost,padding:"5px 10px",fontSize:"0.72rem",...(newWordType===wt.id?{background:"rgba(232,74,95,0.1)",borderColor:"rgba(232,74,95,0.4)",color:TA}:{})}}>{wt.emoji} {wt.label[uiLang]||wt.label.ko}</button>))}</div>}
              {wallets.length>0&&editId===null&&<div><div style={{fontSize:"0.58rem",color:TD,marginBottom:"4px",letterSpacing:"0.8px",textTransform:"uppercase"}}>{T.addToWordbook}</div><div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>{wallets.map(wl=>{const sel=newWordWallets.has(wl.id);return(<button key={wl.id} onClick={()=>setNewWordWallets(s=>{const n=new Set(s);sel?n.delete(wl.id):n.add(wl.id);return n;})} style={{padding:"3px 9px",borderRadius:"2px",fontSize:"0.7rem",cursor:"pointer",border:"1px solid",background:sel?`${wl.color}10`:"transparent",borderColor:sel?`${wl.color}50`:TL,color:sel?wl.color:TD}}><span style={{width:"5px",height:"5px",borderRadius:"50%",background:wl.color,display:"inline-block",marginRight:"4px"}}/>{wl.name}{sel?" ✓":""}</button>);})}</div></div>}
              <div style={{display:"flex",gap:"6px"}}><button style={{...Bt.primary,flex:1}} onClick={addWord}>{editId!==null?T.editBtn:T.addBtn}</button>{newHebrew&&<SpeakBtn text={newHebrew} onSpeak={speakOnDemand} muted={muted}/>}{editId!==null&&<button style={Bt.ghost} onClick={cancelEdit}>{T.cancelBtn}</button>}</div>
            </div>)}
          </div>

          {/* Save/Load */}
          <div style={{borderBottom:`1px solid ${TL}`}}>
            <SectionHeader sectionKey="io" title={T.saveLoad} color={TM}/>
            {openSections.io&&(<div style={{paddingBottom:"16px"}}>
              <div style={{fontSize:"0.65rem",color:TD,marginBottom:"8px"}}>{T.telegramTip}</div>
              <div style={{display:"flex",gap:"5px",marginBottom:"8px",alignItems:"center"}}><span style={{fontSize:"0.6rem",color:TD,letterSpacing:"0.5px",textTransform:"uppercase"}}>{T.cardStyle}</span>{[["menu",T.menuStyle],["inline",T.inlineStyle]].map(([v,l])=>(<button key={v} onClick={()=>setCardStyleSave(v)} style={{...Bt.ghost,fontSize:"0.65rem",padding:"2px 8px",color:cardStyle===v?TT:TD,...(cardStyle===v?{borderColor:"rgba(255,255,255,0.2)"}:{})}}>{l}</button>))}</div>
              {currentBook!=="hebrew"&&<button style={{...Bt.ghost,width:"100%",marginBottom:"8px",color:TH,borderColor:"rgba(255,154,108,0.25)"}} onClick={()=>setShowWordSearchModal(true)}>{uiLang==="en"?"Search by meaning":"뜻으로 검색"}</button>}
              <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                {[[T.fileSave,exportWords,TA],[T.copy,copyToClipboard,TM],[T.fileOpen,()=>fileInputRef.current.click(),TM],[T.paste,()=>setShowPasteModal(true),TBL],[T.textAdd,()=>setShowBatchModal(true),TG],[T.csvExcel,()=>csvInputRef.current.click(),TBL]].map(([label,handler,color])=>(<button key={label} onClick={handler} style={{padding:"7px 11px",borderRadius:"2px",background:"rgba(255,255,255,0.03)",border:`1px solid ${TL}`,color,cursor:"pointer",fontSize:"0.72rem"}}>{label}</button>))}
                <input ref={fileInputRef} type="file" accept=".json" style={{display:"none"}} onChange={handleFileChange}/>
                <input ref={csvInputRef} type="file" accept=".xlsx,.xls,.csv,.tsv,.txt" style={{display:"none"}} onChange={handleCSVChange}/>
              </div>
            </div>)}
          </div>

          {/* Import */}
          {currentBook==="hebrew"&&(<div style={{borderBottom:`1px solid rgba(80,200,152,0.1)`}}>
            <SectionHeader sectionKey="import" title={T.importWords} color={TG}/>
            {openSections.import&&(<div style={{paddingBottom:"16px"}}>
              <div style={{display:"flex",gap:"5px",flexWrap:"wrap",marginBottom:"10px"}}>
                {[[T.importSearch,()=>setShowWordSearchModal(true),TH],[T.reversoImport,()=>setShowPealimModal(true),TG],[T.rootSearch,()=>setShowRootModal(true),TM],[T.verbForm,()=>verbFormFileRef.current?.click(),TG],[T.formDownload,downloadTemplate,TH],[refreshingVariants?"업데이트 중...":T.refreshVariants,refreshAllVariants,TG]].map(([label,handler,color])=>(<button key={label} onClick={handler} disabled={refreshingVariants&&label.includes("중")} style={{padding:"6px 11px",borderRadius:"2px",background:"rgba(255,255,255,0.02)",border:`1px solid ${TL}`,color,cursor:"pointer",fontSize:"0.72rem"}}>{label}</button>))}
              </div>
              {refreshLog.length>0&&(<div style={{marginBottom:"8px"}}><button onClick={()=>setShowRefreshLog(v=>!v)} style={{...Bt.ghost,width:"100%",fontSize:"0.68rem",marginBottom:"3px"}}>{showRefreshLog?"▲ 숨기기":"▼ 결과"} ({refreshLog.filter(l=>l.status==="ok").length}성공/{refreshLog.filter(l=>l.status==="fail").length}실패)</button>{showRefreshLog&&<div style={{maxHeight:"150px",overflowY:"auto"}}>{refreshLog.map((l,i)=>(<div key={i} style={{display:"flex",gap:"7px",alignItems:"center",padding:"4px 0",borderBottom:`1px solid ${TL}`,fontSize:"0.72rem"}}><span style={{color:l.status==="ok"?TG:TA}}>{l.status==="ok"?"✓":"✕"}</span><span style={{fontFamily:"Arial",direction:"rtl",color:TH,minWidth:"55px"}}>{l.hebrew}</span><span style={{color:TM,flex:1}}>{l.meaning}</span>{l.status==="ok"?<span style={{color:TG,fontSize:"0.65rem"}}>{l.variantCount}개</span>:<span style={{color:TA,fontSize:"0.65rem"}}>{l.error}</span>}</div>))}</div>}</div>)}
              {wallets.length>0&&(<div style={{padding:"9px 12px",border:`1px solid ${TL}`,borderRadius:"2px"}}><div style={{fontSize:"0.58rem",color:TD,marginBottom:"4px",letterSpacing:"0.8px",textTransform:"uppercase"}}>{T.addToWordbook}</div><div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>{wallets.map(wl=>{const sel=importTargetWallets.has(wl.id);return(<button key={wl.id} onClick={()=>setImportTargetWallets(s=>{const n=new Set(s);sel?n.delete(wl.id):n.add(wl.id);return n;})} style={{padding:"3px 9px",borderRadius:"2px",fontSize:"0.7rem",cursor:"pointer",border:"1px solid",background:sel?`${wl.color}10`:"transparent",borderColor:sel?`${wl.color}50`:TL,color:sel?wl.color:TD}}>{wl.name}{sel?" ✓":""}</button>);})}</div></div>)}
              <input ref={verbFormFileRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={handleVerbFormExcel}/>
            </div>)}
          </div>)}

          {/* Search + Sort */}
          <div style={{display:"flex",gap:"7px",padding:"12px 0",borderBottom:`1px solid ${TL}`,alignItems:"center",flexWrap:"wrap"}}>
            <input style={{...Bt.input,flex:1,minWidth:"150px",padding:"8px 12px",fontSize:"0.85rem"}} placeholder={T.searchPlaceholder} value={searchQuery} onChange={e=>{setSearchQuery(e.target.value);setPage(0);}}/>
            <select value={sortBy} onChange={e=>{setSortBySave(e.target.value);setPage(0);}} style={{padding:"7px 9px",borderRadius:"2px",background:"rgba(255,255,255,0.04)",border:`1px solid ${TL}`,color:TM,fontSize:"0.7rem",cursor:"pointer",outline:"none"}}>
              <option value="default">{T.sortDefault}</option><option value="hebrew_asc">{T.sortHebAsc}</option><option value="hebrew_desc">{T.sortHebDesc}</option><option value="meaning_asc">{T.sortMeanAsc}</option><option value="meaning_desc">{T.sortMeanDesc}</option><option value="hard_first">{T.sortHardFirst}</option><option value="mastered_first">{T.sortMasteredFirst}</option><option value="wrong_desc">{T.sortWrongFirst}</option>
            </select>
            {[10,20,9999].map(n=>(<button key={n} onClick={()=>{setPageSizeSave(n);setPage(0);}} style={{...Bt.ghost,padding:"7px 9px",fontSize:"0.7rem",color:pageSize===n?TT:TD,...(pageSize===n?{borderColor:"rgba(255,255,255,0.2)"}:{})}}>{n===9999?(uiLang==="en"?"All":"전체"):n}</button>))}
          </div>

          {/* Filter Tabs */}
          <div style={{display:"flex",borderBottom:`1px solid ${TL}`,overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}}>
            {[["all",T.all,words.length],["learning",T.learning,learningCount],["hard",T.hard,hardCount],["mastered",T.done,masteredCount]].map(([val,label,cnt])=>(<button key={val} onClick={()=>{setListFilterSave(val);setWalletFilter(null);setPage(0);setSelectedIds(new Set());}} style={{padding:"9px 13px",border:"none",borderBottom:`2px solid ${listFilter===val&&!walletFilter?TA:"transparent"}`,background:"transparent",color:listFilter===val&&!walletFilter?TT:TD,cursor:"pointer",fontSize:"0.68rem",whiteSpace:"nowrap",flexShrink:0,letterSpacing:"0.5px",textTransform:"uppercase",fontWeight:listFilter===val&&!walletFilter?600:400}}>{label} <span style={{fontSize:"0.6rem",opacity:0.5,marginLeft:"2px"}}>{cnt}</span></button>))}
            {wallets.map(wl=>{const cnt=words.filter(w=>wl.wordIds.includes(w.id)).length;const isActive=walletFilter===wl.id;return(<button key={wl.id} onClick={()=>{setWalletFilter(isActive?null:wl.id);setPage(0);setSelectedIds(new Set());}} style={{padding:"9px 12px",border:"none",borderBottom:`2px solid ${isActive?wl.color:"transparent"}`,background:"transparent",color:isActive?wl.color:TD,cursor:"pointer",fontSize:"0.68rem",whiteSpace:"nowrap",flexShrink:0,display:"flex",alignItems:"center",gap:"4px"}}><span style={{width:"5px",height:"5px",borderRadius:"50%",background:wl.color}}/>{wl.name} <span style={{opacity:0.5,fontSize:"0.6rem"}}>{cnt}</span></button>);})}
          </div>

          {/* Bulk Actions */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${TL}`}}>
            <div style={{display:"flex",alignItems:"center",gap:"7px",flexWrap:"wrap"}}>
              <span style={{fontSize:"0.65rem",color:TD}}>{T.wordCount(searchedWords.length)}</span>
              <button onClick={()=>{if(selectedIds.size===filteredWords.length)setSelectedIds(new Set());else setSelectedIds(new Set(filteredWords.map(w=>w.id)));}} style={{...Bt.ghost,fontSize:"0.65rem",padding:"2px 7px"}}>{selectedIds.size===filteredWords.length&&filteredWords.length>0?T.deselect:T.selectAll}</button>
              {selectedIds.size>0&&(<>
                {wallets.length>0&&(<div style={{position:"relative"}}>
                  <button onClick={()=>setBulkWalletOpen(v=>!v)} style={{...Bt.ghost,fontSize:"0.65rem",padding:"2px 7px",color:TH}}>📚 {selectedIds.size}개 → 단어장 ▾</button>
                  {bulkWalletOpen&&(<div style={{position:"absolute",top:"100%",left:0,zIndex:50,marginTop:"2px",background:TS,border:`1px solid ${TL}`,borderRadius:"2px",padding:"8px",minWidth:"155px",boxShadow:"0 8px 24px rgba(0,0,0,0.6)"}}>
                    {(()=>{const sel=bulkWalletOpen instanceof Set?bulkWalletOpen:new Set();return(<>{wallets.map(wl=>{const checked=sel.has(wl.id);return(<button key={wl.id} onClick={()=>{const ns=new Set(sel);checked?ns.delete(wl.id):ns.add(wl.id);setBulkWalletOpen(ns);}} style={{display:"flex",alignItems:"center",gap:"7px",padding:"5px 7px",width:"100%",background:"transparent",border:"none",borderRadius:"2px",cursor:"pointer",color:checked?wl.color:TT,fontSize:"0.78rem",marginBottom:"1px"}}><span style={{width:"11px",height:"11px",borderRadius:"2px",flexShrink:0,background:checked?wl.color:"transparent",border:`1px solid ${checked?wl.color:"rgba(255,255,255,0.2)"}`,display:"flex",alignItems:"center",justifyContent:"center"}}>{checked&&<span style={{color:"#fff",fontSize:"0.5rem"}}>✓</span>}</span>{wl.name}</button>);}){sel.size>0&&<button onClick={()=>{saveWallets(wallets.map(wl=>sel.has(wl.id)?{...wl,wordIds:[...new Set([...wl.wordIds,...selectedIds])]}:wl));setBulkWalletOpen(false);setSelectedIds(new Set());showToast(`${selectedIds.size}개 추가!`);}} style={{...Bt.primary,width:"100%",marginTop:"4px",padding:"5px",fontSize:"0.75rem"}}>{sel.size}개 단어장에 추가</button>}</>);})()}
                  </div>)}
                </div>)}
                <button onClick={()=>{if(window.confirm(`${selectedIds.size}개 삭제할까요?`)){setWords(ws=>ws.filter(w=>!selectedIds.has(w.id)));setSelectedIds(new Set());}}} style={{...Bt.ghost,fontSize:"0.65rem",padding:"2px 7px",color:TA,borderColor:"rgba(232,74,95,0.28)"}}>{T.deleteN(selectedIds.size)}</button>
              </>)}
            </div>
          </div>

          {/* Word List */}
          <div>
            {filteredWords.length===0&&<div style={{textAlign:"center",color:TD,padding:"60px 0",fontSize:"0.82rem",letterSpacing:"0.5px"}}>{searchQuery?`"${searchQuery}" 검색 결과가 없어요`:"단어가 없어요"}</div>}
            {filteredWords.map((w,i)=>{
              const st=STATUS_CONFIG[w.status];
              const isMenuOpen=expandedVariantWord===`menu_${w.id}`;
              return(
                <div key={w.id} style={{display:"flex",alignItems:"center",gap:"11px",borderBottom:`1px solid ${TL}`,padding:"11px 0",background:selectedIds.has(w.id)?"rgba(232,74,95,0.04)":"transparent"}}>
                  <input type="checkbox" checked={selectedIds.has(w.id)} onChange={e=>{const s=new Set(selectedIds);e.target.checked?s.add(w.id):s.delete(w.id);setSelectedIds(s);}} style={{width:"13px",height:"13px",cursor:"pointer",accentColor:TA,flexShrink:0}}/>
                  <span style={{fontSize:"0.58rem",color:TD,minWidth:"20px",flexShrink:0,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"1px"}}>{(page*pageSize)+i+1}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:"Arial,sans-serif",fontSize:"1.1rem",color:TH,direction:"rtl",marginBottom:"1px"}}>{w.hebrew}</div>
                    <div style={{display:"flex",alignItems:"center",gap:"5px",flexWrap:"wrap"}}>
                      <span style={{fontSize:"0.75rem",color:TM}}>{w.meaning||<span style={{color:TD,fontStyle:"italic"}}>뜻 없음</span>}</span>
                      {w.wordType&&(()=>{const wt=WORD_TYPES.find(t=>t.id===w.wordType);return wt?<span style={{fontSize:"0.52rem",background:"rgba(255,255,255,0.04)",border:`1px solid ${TL}`,borderRadius:"2px",padding:"0px 3px",color:TD}}>{wt.emoji}</span>:null;})()}
                      {w.root&&<span style={{fontSize:"0.52rem",background:"rgba(80,200,152,0.05)",border:"1px solid rgba(80,200,152,0.14)",borderRadius:"2px",padding:"0px 4px",color:TG,fontFamily:"Arial",direction:"rtl"}}>{w.root}</span>}
                      {(w.variants||[]).length>0&&<span style={{fontSize:"0.52rem",color:TG,background:"rgba(80,200,152,0.05)",border:"1px solid rgba(80,200,152,0.12)",borderRadius:"2px",padding:"0px 3px"}}>{w.variants.length}v</span>}
                    </div>
                    {cardStyle==="inline"&&(<div style={{display:"flex",alignItems:"center",gap:"4px",marginTop:"4px",flexWrap:"wrap"}}>
                      <SpeakOnceBtn text={w.hebrew} onSpeak={speakOnDemand} muted={muted} repeatN={1}/>
                      {(()=>{const sc=STATUS_CONFIG[w.status];const order=["learning","hard","mastered"];const next=order[(order.indexOf(w.status)+1)%3];return<button onClick={()=>setManualStatus(w.id,next)} style={{padding:"2px 6px",borderRadius:"2px",border:`1px solid ${sc.border}`,background:sc.bg,color:sc.color,cursor:"pointer",fontSize:"0.6rem",fontWeight:600}}>{sc.emoji} {(uiLang==="en"?sc.labelEn:sc.labelKo)}</button>;})()}
                      <button onClick={()=>startEdit(w)} style={{padding:"2px 6px",borderRadius:"2px",border:`1px solid ${TL}`,background:"transparent",color:TD,cursor:"pointer",fontSize:"0.65rem"}}>편집</button>
                      {(w.variants||[]).length>0&&<button onClick={()=>openVariantModal(w)} style={{padding:"2px 6px",borderRadius:"2px",border:"1px solid rgba(167,139,250,0.18)",background:"transparent",color:TP,cursor:"pointer",fontSize:"0.65rem"}}>변형</button>}
                      <button onClick={()=>{if(window.confirm("삭제할까요?"))deleteWord(w.id);}} style={{padding:"2px 6px",borderRadius:"2px",border:"1px solid rgba(232,74,95,0.18)",background:"transparent",color:TA,cursor:"pointer",fontSize:"0.65rem"}}>삭제</button>
                    </div>)}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:"4px",flexShrink:0}}>
                    <div style={{width:"5px",height:"5px",borderRadius:"50%",background:st.color}}/>
                    <SpeakOnceBtn text={w.hebrew} onSpeak={speakOnDemand} muted={muted} repeatN={1}/>
                    {cardStyle==="menu"&&(<div style={{position:"relative"}}>
                      <button onClick={e=>{e.stopPropagation();setExpandedVariantWord(isMenuOpen?null:`menu_${w.id}`);}} style={{padding:"4px 8px",borderRadius:"2px",border:`1px solid ${isMenuOpen?"rgba(255,255,255,0.14)":TL}`,background:isMenuOpen?"rgba(255,255,255,0.07)":"transparent",color:TM,cursor:"pointer",fontSize:"0.72rem",letterSpacing:"2px"}}>···</button>
                      {isMenuOpen&&(<div onClick={e=>e.stopPropagation()} style={{position:"absolute",right:0,top:"calc(100% + 3px)",background:TS,border:`1px solid rgba(255,255,255,0.09)`,borderRadius:"2px",padding:"8px",display:"flex",flexDirection:"column",gap:"4px",minWidth:"145px",zIndex:10,boxShadow:"0 8px 28px rgba(0,0,0,0.6)"}}>
                        <div style={{display:"flex",gap:"3px",marginBottom:"3px"}}>{["learning","hard","mastered"].map(s=>{const sc2=STATUS_CONFIG[s];return(<button key={s} onClick={()=>{setManualStatus(w.id,s);setExpandedVariantWord(null);}} style={{flex:1,padding:"4px 2px",borderRadius:"2px",border:`1px solid ${w.status===s?sc2.border:TL}`,background:w.status===s?sc2.bg:"transparent",color:w.status===s?sc2.color:TD,cursor:"pointer",fontSize:"0.72rem",fontWeight:600}}>{sc2.emoji}</button>);})}</div>
                        {(()=>{const [rn,setRn]=[w._repeatN||1,n=>setWords(ws=>ws.map(x=>x.id===w.id?{...x,_repeatN:n}:x))];return(<div style={{display:"flex",gap:"3px",alignItems:"center",marginBottom:"3px"}}><span style={{fontSize:"0.58rem",color:TD,flexShrink:0}}>발음</span><SpeakOnceBtn text={w.hebrew} onSpeak={speakOnDemand} muted={muted} repeatN={rn}/><input type="number" min={1} max={20} value={rn} onClick={e=>e.stopPropagation()} onChange={e=>setRn(Math.max(1,Math.min(20,Number(e.target.value)||1)))} style={{width:"32px",padding:"2px 4px",borderRadius:"2px",background:"rgba(255,255,255,0.04)",border:`1px solid ${TL}`,color:TH,fontSize:"0.7rem",textAlign:"center",outline:"none"}}/><span style={{fontSize:"0.58rem",color:TD}}>회</span></div>);})()}
                        <div style={{display:"flex",gap:"3px",paddingTop:"4px",borderTop:`1px solid ${TL}`}}>
                          <button onClick={()=>{startEdit(w);setExpandedVariantWord(null);}} style={{flex:1,padding:"4px",borderRadius:"2px",border:`1px solid ${TL}`,background:"transparent",color:TM,cursor:"pointer",fontSize:"0.7rem"}}>편집</button>
                          <button onClick={()=>{setExpandedVariantWord(w.id);openVariantModal(w);}} style={{flex:1,padding:"4px",borderRadius:"2px",border:"1px solid rgba(167,139,250,0.18)",background:"transparent",color:TP,cursor:"pointer",fontSize:"0.7rem"}}>변형{w.variants?.length?` ${w.variants.length}`:""}</button>
                          {wallets.length>0&&<button onClick={e=>{e.stopPropagation();setWalletPickWord(w.id);}} style={{flex:1,padding:"4px",borderRadius:"2px",border:`1px solid rgba(255,154,108,0.18)`,background:"transparent",color:TH,cursor:"pointer",fontSize:"0.7rem"}}>📚</button>}
                          <button onClick={()=>{const msg=walletFilter?"이 단어장에서 제거할까요?":"단어를 완전히 삭제할까요?";if(window.confirm(msg))deleteWord(w.id);}} style={{flex:1,padding:"4px",borderRadius:"2px",border:"1px solid rgba(232,74,95,0.18)",background:"transparent",color:TA,cursor:"pointer",fontSize:"0.7rem"}}>삭제</button>
                        </div>
                      </div>)}
                    </div>)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {pageSize!==9999&&totalPages>1&&(<div style={{display:"flex",justifyContent:"center",gap:"3px",padding:"14px 0",borderBottom:`1px solid ${TL}`}}>
            <button style={{...Bt.ghost,opacity:page===0?0.22:1}} onClick={()=>page>0&&setPage(p=>p-1)} disabled={page===0}>←</button>
            {Array.from({length:totalPages},(_,i)=>(<button key={i} style={{...Bt.ghost,...(page===i?{background:"rgba(232,74,95,0.1)",borderColor:"rgba(232,74,95,0.4)",color:TA}:{})}} onClick={()=>setPage(i)}>{i+1}</button>))}
            <button style={{...Bt.ghost,opacity:page===totalPages-1?0.22:1}} onClick={()=>page<totalPages-1&&setPage(p=>p+1)} disabled={page===totalPages-1}>→</button>
          </div>)}

          {/* MCQ Settings */}
          <div style={{borderBottom:`1px solid ${TL}`}}>
            <SectionHeader sectionKey="quiz_mcq" title={T.mcqTitle} badge={poolSize>0?`${poolSize}개`:undefined}/>
            {openSections.quiz_mcq&&(<div style={{paddingBottom:"16px"}}>
              <p style={{margin:"0 0 6px",fontSize:"0.58rem",color:TD,textTransform:"uppercase",letterSpacing:"1.5px",fontWeight:600}}>{T.direction}</p>
              <div style={{display:"flex",gap:"5px",marginBottom:"12px",flexWrap:"wrap"}}>{[[QUIZ_TYPES.HEB_TO_MEAN,T.dirAtoB(bookInfo)],[QUIZ_TYPES.MEAN_TO_HEB,T.dirBtoA(bookInfo)],[QUIZ_TYPES.MIXED,T.mixed]].map(([val,label])=><button key={val} style={{...Bt.opt,...(quizType===val?Bt.optActive:{})}} onClick={()=>setQuizTypeSave(val)}>{label}</button>)}</div>
              <p style={{margin:"0 0 6px",fontSize:"0.58rem",color:TD,textTransform:"uppercase",letterSpacing:"1.5px",fontWeight:600}}>{T.wordRange}</p>
              <div style={{display:"flex",gap:"5px",marginBottom:"12px",flexWrap:"wrap"}}>{[[QUIZ_FILTERS.ALL,T.allRange(words.length)],[QUIZ_FILTERS.LEARNING_ONLY,T.learningOnly(learningCount)],[QUIZ_FILTERS.EXCLUDE_MASTERED,T.excludeMastered(words.filter(w=>w.status!=="mastered").length)],[QUIZ_FILTERS.HARD_ONLY,T.hardOnly(hardCount)]].map(([val,label])=><button key={val} style={{...Bt.opt,...(quizFilter===val?Bt.optActive:{})}} onClick={()=>setQuizFilterSave(val)}>{label}</button>)}</div>
              <p style={{margin:"0 0 6px",fontSize:"0.58rem",color:TD,textTransform:"uppercase",letterSpacing:"1.5px",fontWeight:600}}>{T.questionCount}</p>
              <div style={{display:"flex",gap:"5px",marginBottom:"10px",flexWrap:"wrap"}}>{countOptions.map(({label,value})=>{const d=value!==9999&&value>poolSize;return<button key={value} style={{...Bt.opt,...(quizCount===value?Bt.optActive:{}),...(d?{opacity:0.22,cursor:"not-allowed"}:{})}} onClick={()=>!d&&setQuizCount(value)} disabled={d}>{label}</button>;})}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"9px",marginBottom:"12px",padding:"9px 12px",background:"rgba(255,255,255,0.02)",borderRadius:"2px",border:`1px solid ${TL}`}}>
                <span style={{fontSize:"0.68rem",color:TD,flexShrink:0}}>{T.directInput}</span>
                <input type="range" min={1} max={Math.max(4,poolSize)} value={Math.min(quizCount===9999?poolSize:quizCount,poolSize)} onChange={e=>setQuizCountSave(Number(e.target.value))} style={{flex:1,accentColor:TA,cursor:"pointer"}}/>
                <input type="number" min={1} max={poolSize} value={quizCount===9999?poolSize:Math.min(quizCount,poolSize)} onChange={e=>{const v=Math.max(1,Math.min(poolSize,Number(e.target.value)||1));setQuizCountSave(v);}} style={{width:"46px",padding:"3px 5px",background:"rgba(255,255,255,0.04)",border:`1px solid rgba(232,74,95,0.3)`,borderRadius:"2px",color:TA,fontSize:"0.85rem",fontWeight:700,textAlign:"center",outline:"none"}}/>
              </div>
              <p style={{margin:"0 0 8px",fontSize:"0.58rem",color:TD,textTransform:"uppercase",letterSpacing:"1.5px",fontWeight:600}}>{uiLang==="en"?"Sound":"발음 설정"}</p>
              <div style={{display:"flex",gap:"5px",marginBottom:"14px"}}>
                {[{mode:"auto",icon:"▶",label:uiLang==="en"?"Auto":"자동",color:TA},{mode:"manual",icon:"▷",label:uiLang==="en"?"Manual":"수동",color:TG},{mode:"mute",icon:"○",label:uiLang==="en"?"Mute":"음소거",color:TD}].map(({mode,icon,label,color})=>(<button key={mode} onClick={()=>setSoundMode(mode)} style={{flex:1,padding:"9px 5px",borderRadius:"2px",border:`1px solid ${soundMode===mode?`${color}50`:TL}`,background:soundMode===mode?`${color}0D`:"transparent",color:soundMode===mode?color:TD,cursor:"pointer",textAlign:"center"}}><div style={{fontSize:"0.95rem",marginBottom:"2px"}}>{icon}</div><div style={{fontSize:"0.72rem",fontWeight:soundMode===mode?600:400}}>{label}</div></button>))}
              </div>
              <button style={{...Bt.primary,width:"100%",padding:"13px",...(poolSize<4?{opacity:0.22,cursor:"not-allowed"}:{})}} onClick={startQuiz} disabled={poolSize<4}>{poolSize<4?T.needMore(poolSize):T.startMCQ(quizCount===9999?poolSize:Math.min(quizCount,poolSize))}</button>
            </div>)}
          </div>

          {/* Essay Settings */}
          <div style={{borderBottom:`1px solid rgba(167,139,250,0.1)`}}>
            <SectionHeader sectionKey="quiz_essay" title={T.essayTitle} color={TP} badge={essayPoolSize>0?`${essayPoolSize}개`:undefined}/>
            {openSections.quiz_essay&&(<div style={{paddingBottom:"16px"}}>
              <p style={{fontSize:"0.75rem",color:TD,marginBottom:"12px"}}>{T.essaySub}</p>
              <p style={{margin:"0 0 6px",fontSize:"0.58rem",color:TD,textTransform:"uppercase",letterSpacing:"1.5px",fontWeight:600}}>{T.direction}</p>
              <div style={{display:"flex",gap:"5px",marginBottom:"12px",flexWrap:"wrap"}}>{[["heb_to_mean",T.dirAtoB_e(bookInfo)],["mean_to_heb",T.dirBtoA_e(bookInfo)],["mixed",T.mixed]].map(([val,label])=><button key={val} style={{...Bt.opt,...(essayType===val?Bt.essayOptActive:{})}} onClick={()=>setEssayTypeSave(val)}>{label}</button>)}</div>
              <p style={{margin:"0 0 6px",fontSize:"0.58rem",color:TD,textTransform:"uppercase",letterSpacing:"1.5px",fontWeight:600}}>{T.wordRange}</p>
              <div style={{display:"flex",gap:"5px",marginBottom:"12px",flexWrap:"wrap"}}>{[[QUIZ_FILTERS.ALL,T.allRange(words.length)],[QUIZ_FILTERS.EXCLUDE_MASTERED,T.excludeMastered(words.filter(w=>w.status!=="mastered").length)],[QUIZ_FILTERS.HARD_ONLY,T.hardOnly(hardCount)]].map(([val,label])=><button key={val} style={{...Bt.opt,...(essayFilter===val?Bt.essayOptActive:{})}} onClick={()=>setEssayFilterSave(val)}>{label}</button>)}</div>
              <p style={{margin:"0 0 6px",fontSize:"0.58rem",color:TD,textTransform:"uppercase",letterSpacing:"1.5px",fontWeight:600}}>{T.questionCount}</p>
              <div style={{display:"flex",gap:"5px",marginBottom:"10px",flexWrap:"wrap"}}>{countOptions.map(({label,value})=>{const d=value!==9999&&value>essayPoolSize;return<button key={value} style={{...Bt.opt,...(essayCount===value?Bt.essayOptActive:{}),...(d?{opacity:0.22,cursor:"not-allowed"}:{})}} onClick={()=>!d&&setEssayCountSave(value)} disabled={d}>{label}</button>;})}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"9px",marginBottom:"14px",padding:"9px 12px",background:"rgba(255,255,255,0.02)",borderRadius:"2px",border:`1px solid ${TL}`}}>
                <span style={{fontSize:"0.68rem",color:TD,flexShrink:0}}>{T.directInput}</span>
                <input type="range" min={1} max={Math.max(1,essayPoolSize)} value={Math.min(essayCount===9999?essayPoolSize:essayCount,essayPoolSize)} onChange={e=>setEssayCountSave(Number(e.target.value))} style={{flex:1,accentColor:TP,cursor:"pointer"}}/>
                <input type="number" min={1} max={essayPoolSize} value={essayCount===9999?essayPoolSize:Math.min(essayCount,essayPoolSize)} onChange={e=>{const v=Math.max(1,Math.min(essayPoolSize,Number(e.target.value)||1));setEssayCountSave(v);}} style={{width:"46px",padding:"3px 5px",background:"rgba(255,255,255,0.04)",border:`1px solid rgba(167,139,250,0.3)`,borderRadius:"2px",color:TP,fontSize:"0.85rem",fontWeight:700,textAlign:"center",outline:"none"}}/>
              </div>
              <button style={{...Bt.essay,width:"100%",padding:"13px",...(!essayPoolSize?{opacity:0.22,cursor:"not-allowed"}:{})}} onClick={startEssay} disabled={!essayPoolSize}>{T.startEssay(essayCount===9999?essayPoolSize:Math.min(essayCount,essayPoolSize))}</button>
            </div>)}
          </div>

          {/* Variant Quiz Settings */}
          {currentBook==="hebrew"&&(<div style={{borderBottom:`1px solid rgba(80,200,152,0.1)`}}>
            <SectionHeader sectionKey="quiz_variant" title={T.variantQuizTitle} color={TG} badge={variantPoolSize>0?`${variantPoolSize}개`:T.variantUnavailable}/>
            {openSections.quiz_variant&&(<div style={{paddingBottom:"16px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"6px"}}><p style={{margin:0,fontSize:"0.58rem",color:TD,textTransform:"uppercase",letterSpacing:"1.5px",fontWeight:600}}>{T.variantTypeSelect}</p><button onClick={()=>setVariantCatsSave(variantCats.length===VARIANT_CATS.length?[]:VARIANT_CATS.map(c=>c.id))} style={{...Bt.ghost,fontSize:"0.62rem",padding:"2px 7px"}}>{variantCats.length===VARIANT_CATS.length?T.allDeselect:T.allSelectAll}</button></div>
              <div style={{display:"flex",gap:"4px",marginBottom:"12px",flexWrap:"wrap"}}>{VARIANT_CATS.map(cat=>(<button key={cat.id} style={{...Bt.opt,...(variantCats.includes(cat.id)?{background:"rgba(80,200,152,0.1)",borderColor:"rgba(80,200,152,0.4)",color:TG}:{})}} onClick={()=>setVariantCatsSave(v=>v.includes(cat.id)?v.filter(x=>x!==cat.id):[...v,cat.id])}>{cat.label[uiLang]||cat.label.ko}</button>))}</div>
              {(()=>{ const st=new Set(VARIANT_CATS.filter(c=>variantCats.includes(c.id)).flatMap(c=>c.types)); const hv=w=>(w.variants||[]).some(v=>st.has(v.type)); const vAll=words.filter(hv).length; const vL=words.filter(w=>w.status==="learning"&&hv(w)).length; const vH=words.filter(w=>w.status==="hard"&&hv(w)).length; const vE=words.filter(w=>w.status!=="mastered"&&hv(w)).length; return(<div style={{display:"flex",gap:"4px",marginBottom:"12px",flexWrap:"wrap"}}>{[[QUIZ_FILTERS.ALL,`전체 (${vAll})`],[QUIZ_FILTERS.LEARNING_ONLY,`학습중 (${vL})`],[QUIZ_FILTERS.HARD_ONLY,`어려움 (${vH})`],[QUIZ_FILTERS.EXCLUDE_MASTERED,`암기 제외 (${vE})`]].map(([val,label])=>(<button key={val} style={{...Bt.opt,...(variantFilter===val?{background:"rgba(80,200,152,0.1)",borderColor:"rgba(80,200,152,0.4)",color:TG}:{})}} onClick={()=>setVariantFilterSave(val)}>{label}</button>))}</div>); })()}
              <div style={{display:"flex",alignItems:"center",gap:"9px",marginBottom:"10px",padding:"9px 12px",background:"rgba(255,255,255,0.02)",borderRadius:"2px",border:`1px solid ${TL}`}}>
                <span style={{fontSize:"0.68rem",color:TD,flexShrink:0}}>{T.directInput}</span>
                <input type="range" min={1} max={Math.max(1,variantPoolSize)} value={Math.min(variantCount===9999?variantPoolSize:variantCount,Math.max(1,variantPoolSize))} onChange={e=>setVariantCount(Number(e.target.value))} style={{flex:1,accentColor:TG,cursor:"pointer"}}/>
                <input type="number" min={1} max={variantPoolSize} value={variantCount===9999?variantPoolSize:Math.min(variantCount,variantPoolSize)} onChange={e=>{const v=Math.max(1,Math.min(variantPoolSize,Number(e.target.value)||1));setVariantCount(v);}} style={{width:"46px",padding:"3px 5px",background:"rgba(255,255,255,0.04)",border:`1px solid rgba(80,200,152,0.3)`,borderRadius:"2px",color:TG,fontSize:"0.85rem",fontWeight:700,textAlign:"center",outline:"none"}}/>
              </div>
              <div style={{display:"flex",gap:"5px",marginBottom:"10px"}}>{[["essay","서술형"],["mcq","객관식"]].map(([t,label])=>(<button key={t} onClick={()=>setVariantQuizType(t)} style={{...Bt.opt,flex:1,...(variantQuizType===t?{background:"rgba(80,200,152,0.1)",borderColor:"rgba(80,200,152,0.4)",color:TG}:{})}}>{label}</button>))}</div>
              <button style={{...Bt.green,width:"100%",padding:"13px",...(!variantPoolSize||!variantCats.length?{opacity:0.22,cursor:"not-allowed"}:{})}} onClick={startVariantQuiz} disabled={!variantPoolSize||!variantCats.length}>변형 퀴즈 시작 ({variantCount===9999?variantPoolSize:Math.min(variantCount,variantPoolSize)}문제)</button>
            </div>)}
          </div>)}

        </div>)} {/* END LIST MODE */}

        {/* ─── QUIZ MODE ─────────────────────────────────────── */}
        {mode===MODES.QUIZ&&q&&(<div key={animKey} style={{paddingTop:"16px"}}>
          <div style={{height:"1px",background:TL,marginBottom:"12px",overflow:"hidden"}}><div style={{height:"100%",background:TA,width:`${progress}%`,transition:"width 0.35s ease"}}/></div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.68rem",color:TD,marginBottom:"16px"}}>
            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"0.88rem",letterSpacing:"2px"}}>{current+1} / {questions.length}</span>
            <span style={{color:TA,fontWeight:700,fontFamily:"'Bebas Neue',sans-serif",fontSize:"0.88rem",letterSpacing:"1px"}}>{score} / {current+(confirmed?1:0)}</span>
          </div>
          <div style={{background:TS,borderRadius:"2px",border:`1px solid rgba(255,255,255,0.06)`,padding:"38px 22px",textAlign:"center",marginBottom:"14px"}}>
            <div style={{fontSize:"0.55rem",color:TD,letterSpacing:"2px",textTransform:"uppercase",marginBottom:"18px"}}>{q.questionType===QUIZ_TYPES.HEB_TO_MEAN?T.questionTagAtoB(bookInfo):T.questionTagBtoA(bookInfo)}</div>
            <div style={{...(q.questionType===QUIZ_TYPES.HEB_TO_MEAN?{fontFamily:"Arial,sans-serif",fontSize:"clamp(2.2rem,8vw,3.5rem)",direction:"rtl",color:TH}:{fontSize:"clamp(1.1rem,4vw,1.6rem)",color:TT}),lineHeight:1.2,wordBreak:"break-word",marginBottom:"16px"}}>{q.question}</div>
            <div style={{display:"flex",gap:"7px",alignItems:"center",justifyContent:"center",flexWrap:"wrap"}}>
              {q.questionType===QUIZ_TYPES.HEB_TO_MEAN?(<RepeatSpeakBtn text={q.question} onSpeak={speakOnDemand} muted={muted}/>):confirmed?(<><RepeatSpeakBtn text={q.answer} onSpeak={speakOnDemand} muted={muted}/><span style={{fontSize:"0.65rem",color:TD}}>정답 발음</span></>):null}
            </div>
            {(()=>{const w=words.find(x=>x.id===q.wordId);const sc=w?STATUS_CONFIG[w.status]:null;return sc?<div style={{display:"inline-block",borderRadius:"2px",padding:"2px 9px",fontSize:"0.62rem",fontWeight:600,marginTop:"10px",color:sc.color,background:sc.bg,border:`1px solid ${sc.border}`,letterSpacing:"0.5px"}}>{sc.emoji} {(uiLang==="en"?sc.labelEn:sc.labelKo)}</div>:null;})()}
          </div>
          <div className="cg" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px",marginBottom:"10px"}}>
            {q.choices.map((choice,idx)=>{ let extra={}; if(confirmed){if(choice===q.answer)extra={background:"rgba(80,200,152,0.08)",borderColor:"rgba(80,200,152,0.45)",color:TG};else if(choice===selected)extra={background:"rgba(232,74,95,0.08)",borderColor:"rgba(232,74,95,0.4)",color:TA};}else if(choice===selected)extra={background:"rgba(232,74,95,0.07)",borderColor:"rgba(232,74,95,0.45)",color:TT}; return(<button key={idx} style={{padding:"13px 12px",borderRadius:"2px",background:TS,border:`1px solid ${TL}`,color:TM,cursor:"pointer",fontSize:"0.85rem",textAlign:"left",display:"flex",alignItems:"center",gap:"9px",fontFamily:"inherit",minHeight:"52px",width:"100%",transition:"all 0.1s",...extra}} onClick={()=>handleSelect(choice)}>
              <span style={{width:"20px",height:"20px",borderRadius:"2px",background:"rgba(255,255,255,0.04)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.62rem",fontWeight:700,flexShrink:0,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"1px",color:TD}}>{"ABCD"[idx]}</span>
              <span style={q.questionType===QUIZ_TYPES.MEAN_TO_HEB?{fontFamily:"Arial,sans-serif",fontSize:"1.2rem",direction:"rtl",color:TH}:{}}>{choice}</span>
              {q.questionType===QUIZ_TYPES.MEAN_TO_HEB&&<span style={{marginLeft:"auto",opacity:0.35}} onClick={e=>{e.stopPropagation();speakOnDemand(choice);}}>▷</span>}
            </button>);})}
          </div>
          <div style={{minHeight:"68px",marginBottom:"7px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
            {confirmed&&(<>
              <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"7px",flexWrap:"wrap",textAlign:"center",padding:"8px 12px",borderRadius:"2px",background:selected===q.answer?"rgba(80,200,152,0.07)":"rgba(232,74,95,0.07)",border:`1px solid ${selected===q.answer?"rgba(80,200,152,0.2)":"rgba(232,74,95,0.2)"}`,color:selected===q.answer?TG:TA,fontWeight:600,marginBottom:"6px",fontSize:"0.82rem"}}>{selected===q.answer?T.correct:T.wrong(q.answer)}{(()=>{const w=words.find(x=>x.id===q.wordId);const sc=w?STATUS_CONFIG[w.status]:null;return sc?<span style={{marginLeft:5,fontSize:"0.65rem",opacity:0.7}}>{sc.emoji} {(uiLang==="en"?sc.labelEn:sc.labelKo)}</span>:null;})()}</div>
              <div style={{display:"flex",gap:"4px",justifyContent:"center",flexWrap:"wrap"}}>{(()=>{const w=words.find(x=>x.id===q.wordId);if(!w) return null;return(<>{w.status!=="hard"&&<button onClick={()=>setManualStatus(q.wordId,"hard")} style={{...Bt.ghost,padding:"2px 9px",fontSize:"0.68rem",borderColor:"rgba(232,74,95,0.28)",color:TA}}>! 어려움</button>}{w.status!=="mastered"&&<button onClick={()=>setManualStatus(q.wordId,"mastered")} style={{...Bt.ghost,padding:"2px 9px",fontSize:"0.68rem",borderColor:"rgba(80,200,152,0.28)",color:TG}}>✓ 암기완료</button>}{w.status!=="learning"&&<button onClick={()=>setManualStatus(q.wordId,"learning")} style={{...Bt.ghost,padding:"2px 9px",fontSize:"0.68rem"}}>◎ 학습중</button>}</>);})()} </div>
            </>)}
          </div>
          <div className="qr" style={{display:"flex",gap:"6px"}}>
            {!confirmed?<button style={{flex:1,padding:"13px",borderRadius:"2px",background:TA,border:"none",color:"#fff",fontWeight:600,cursor:"pointer",fontSize:"0.88rem",...(!selected?{opacity:0.22,cursor:"not-allowed"}:{})}} onClick={handleConfirm} disabled={!selected}>{T.confirm}</button>:<button style={{flex:1,padding:"13px",borderRadius:"2px",background:TP,border:"none",color:"#fff",fontWeight:600,cursor:"pointer",fontSize:"0.88rem"}} onClick={handleNext}>{current+1>=questions.length?T.finish:T.next}</button>}
            <button style={{padding:"13px 17px",borderRadius:"2px",background:"transparent",border:`1px solid ${TL}`,color:TD,cursor:"pointer",fontSize:"0.82rem"}} onClick={()=>{window.speechSynthesis?.cancel();setMode(MODES.LIST);}}>{T.quit}</button>
          </div>
        </div>)}

        {/* ─── ESSAY MODE ─────────────────────────────────────── */}
        {mode===MODES.ESSAY&&eq&&(<div key={animKey} style={{paddingTop:"16px"}}>
          <div style={{height:"1px",background:"rgba(167,139,250,0.12)",marginBottom:"12px",overflow:"hidden"}}><div style={{height:"100%",background:TP,width:`${essayProgress}%`,transition:"width 0.35s ease"}}/></div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:"16px"}}>
            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"0.88rem",letterSpacing:"2px",color:TD}}>{essayCurrent+1} / {essayQuestions.length}</span>
            <span style={{color:TP,fontWeight:700,fontFamily:"'Bebas Neue',sans-serif",fontSize:"0.88rem"}}>✓ {essayResults.filter(r=>r.result!=="wrong").length} / {essayCurrent+(essayConfirmed?1:0)}</span>
          </div>
          <div style={{background:TS,borderRadius:"2px",border:`1px solid rgba(167,139,250,0.12)`,padding:"38px 22px",textAlign:"center",marginBottom:"14px"}}>
            <div style={{fontSize:"0.55rem",color:TP,letterSpacing:"2px",textTransform:"uppercase",marginBottom:"18px"}}>{eq.questionType==="heb_to_mean"?T.questionTagAtoB(bookInfo):T.questionTagBtoA(bookInfo)}</div>
            {eq.questionType==="heb_to_mean"?<div style={{fontFamily:"Arial,sans-serif",fontSize:"clamp(2.2rem,8vw,3.5rem)",direction:"rtl",color:TH,marginBottom:"16px"}}>{eq.question}</div>:<div style={{fontSize:"clamp(1.1rem,4vw,1.6rem)",color:TT,marginBottom:"16px",lineHeight:1.3}}>{eq.question}</div>}
            <div style={{display:"flex",alignItems:"center",gap:"7px",justifyContent:"center"}}><RepeatSpeakBtn text={eq.hebrewWord} onSpeak={speakOnDemand} muted={muted}/></div>
          </div>
          {eq.questionType==="heb_to_mean"&&<input ref={essayInputRef} style={{width:"100%",padding:"10px 13px",background:"rgba(255,255,255,0.04)",border:`1px solid ${TL}`,borderRadius:"2px",color:TT,fontSize:"1rem",outline:"none",fontFamily:"inherit",marginBottom:"10px",...(essayConfirmed?{borderColor:essayResults[essayResults.length-1]?.result==="exact"?"rgba(80,200,152,0.5)":essayResults[essayResults.length-1]?.result==="partial"?"rgba(232,74,95,0.3)":"rgba(232,74,95,0.5)"}:{})}} placeholder={T.inputPlaceholderA(bookInfo)} value={essayInput} onChange={e=>!essayConfirmed&&setEssayInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){if(!essayConfirmed)handleEssayConfirm();else handleEssayNext();}}} readOnly={essayConfirmed}/>}
          {eq.questionType==="mean_to_heb"&&<input ref={essayHebrewRef} style={{width:"100%",padding:"10px 13px",background:"rgba(255,255,255,0.04)",border:`1px solid ${TL}`,borderRadius:"2px",color:TT,fontSize:"1.3rem",fontFamily:"Arial,sans-serif",direction:"rtl",marginBottom:"10px",outline:"none",...(essayConfirmed?{borderColor:essayResults[essayResults.length-1]?.result==="exact"?"rgba(80,200,152,0.5)":"rgba(232,74,95,0.5)"}:{})}} placeholder={T.inputPlaceholderB(bookInfo)} lang="he" spellCheck={false} autoCorrect="off" defaultValue="" readOnly={essayConfirmed} onKeyDown={e=>{if(e.key==="Enter"){if(!essayConfirmed)handleEssayConfirm();else handleEssayNext();}}}/>}
          {essayConfirmed&&(()=>{ const last=essayResults[essayResults.length-1]; const w=words.find(x=>x.id===eq.wordId); return(<>
            {last?.result==="exact"?<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"7px",padding:"8px 12px",borderRadius:"2px",background:"rgba(80,200,152,0.07)",border:"1px solid rgba(80,200,152,0.2)",color:TG,fontWeight:600,marginBottom:"6px",fontSize:"0.82rem"}}>{T.correct} <SpeakBtn text={eq.hebrewWord} onSpeak={speakOnDemand} muted={muted}/></div>
            :last?.result==="partial"?<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"7px",flexWrap:"wrap",padding:"8px 12px",borderRadius:"2px",background:"rgba(232,74,95,0.06)",border:"1px solid rgba(232,74,95,0.18)",color:TA,fontWeight:600,marginBottom:"6px",fontSize:"0.82rem"}}>부분 정답! 정답: <b>{eq.answer}</b> <SpeakBtn text={eq.hebrewWord} onSpeak={speakOnDemand} muted={muted}/></div>
            :<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"7px",flexWrap:"wrap",padding:"8px 12px",borderRadius:"2px",background:"rgba(232,74,95,0.07)",border:"1px solid rgba(232,74,95,0.2)",color:TA,fontWeight:600,marginBottom:"6px",fontSize:"0.82rem"}}>오답 — 정답: <b>{eq.answer}</b> <SpeakBtn text={eq.hebrewWord} onSpeak={speakOnDemand} muted={muted}/></div>}
            {w&&<div style={{display:"flex",gap:"4px",justifyContent:"center",flexWrap:"wrap",marginBottom:"7px"}}>{w.status!=="hard"&&<button onClick={()=>setManualStatus(eq.wordId,"hard")} style={{...Bt.ghost,padding:"2px 9px",fontSize:"0.68rem",borderColor:"rgba(232,74,95,0.28)",color:TA}}>! 어려움</button>}{w.status!=="mastered"&&<button onClick={()=>setManualStatus(eq.wordId,"mastered")} style={{...Bt.ghost,padding:"2px 9px",fontSize:"0.68rem",borderColor:"rgba(80,200,152,0.28)",color:TG}}>✓ 암기완료</button>}{w.status!=="learning"&&<button onClick={()=>setManualStatus(eq.wordId,"learning")} style={{...Bt.ghost,padding:"2px 9px",fontSize:"0.68rem"}}>◎ 학습중</button>}</div>}
          </>);})()}
          <div className="qr" style={{display:"flex",gap:"6px"}}>
            {!essayConfirmed?<button style={{flex:1,padding:"13px",borderRadius:"2px",background:TP,border:"none",color:"#fff",fontWeight:600,cursor:"pointer",fontSize:"0.88rem"}} onClick={handleEssayConfirm}>{T.confirm}</button>:<button style={{flex:1,padding:"13px",borderRadius:"2px",background:TP,border:"none",color:"#fff",fontWeight:600,cursor:"pointer",fontSize:"0.88rem"}} onClick={handleEssayNext}>{essayCurrent+1>=essayQuestions.length?T.finish:T.next}</button>}
            <button style={{padding:"13px 17px",borderRadius:"2px",background:"transparent",border:`1px solid ${TL}`,color:TD,cursor:"pointer",fontSize:"0.82rem"}} onClick={()=>{window.speechSynthesis?.cancel();setMode(MODES.LIST);}}>{T.quit}</button>
          </div>
        </div>)}

        {/* ─── VARIANT QUIZ MODE ──────────────────────────────── */}
        {mode===MODES.VARIANT&&variantQuestions[variantCur]&&(()=>{
          const vq=variantQuestions[variantCur]; const vt=VARIANT_TYPES.find(t=>t.id===vq.variantType);
          const prog=((variantCur+(variantConfirmed?1:0))/variantQuestions.length)*100;
          const lastResult=variantResults[variantResults.length-1];
          return(<div style={{paddingTop:"16px"}}>
            <div style={{height:"1px",background:"rgba(80,200,152,0.12)",marginBottom:"12px",overflow:"hidden"}}><div style={{height:"100%",background:TG,width:`${prog}%`,transition:"width 0.35s ease"}}/></div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"16px"}}>
              <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"0.88rem",letterSpacing:"2px",color:TD}}>{variantCur+1} / {variantQuestions.length}</span>
              <span style={{color:TG,fontWeight:700,fontFamily:"'Bebas Neue',sans-serif",fontSize:"0.88rem"}}>{variantResults.filter(r=>r.correct).length} / {variantCur+(variantConfirmed?1:0)}</span>
            </div>
            <div style={{background:TS,borderRadius:"2px",border:`1px solid rgba(80,200,152,0.12)`,padding:"38px 22px",textAlign:"center",marginBottom:"14px"}}>
              <div style={{fontSize:"0.55rem",color:TG,letterSpacing:"2px",textTransform:"uppercase",marginBottom:"10px"}}>{vt?vt.prompt[uiLang]||vt.prompt.ko:vq.variantType}</div>
              <div style={{fontFamily:"Arial",fontSize:"clamp(2.5rem,9vw,4.5rem)",direction:"rtl",color:TH,marginBottom:"6px",lineHeight:1.1}}>{vq.base}</div>
              <div style={{fontSize:"0.9rem",color:TM,marginBottom:"16px"}}>{vq.meaning}</div>
              <div style={{display:"flex",alignItems:"center",gap:"7px",justifyContent:"center"}}><SpeakBtn text={vq.base} onSpeak={speakOnDemand} muted={muted} size="lg"/></div>
            </div>
            {variantQuizType==="essay"&&(<>
              <input ref={variantInputRef} style={{width:"100%",padding:"10px 13px",background:"rgba(255,255,255,0.04)",border:`1px solid ${TL}`,borderRadius:"2px",color:TT,fontSize:"1.3rem",fontFamily:"Arial",direction:"rtl",marginBottom:"10px",outline:"none",...(variantConfirmed?{borderColor:lastResult?.correct?"rgba(80,200,152,0.5)":"rgba(232,74,95,0.5)"}:{})}} placeholder={uiLang==="en"?"Enter Hebrew variant...":"변형을 히브리어로 입력..."} value={variantInput} onChange={e=>!variantConfirmed&&setVariantInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){if(!variantConfirmed)handleVariantConfirm();else handleVariantNext();}}} readOnly={variantConfirmed} lang="he" spellCheck={false} autoCorrect="off"/>
              {variantConfirmed&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"7px",marginBottom:"10px"}}>{lastResult?.correct?<div style={{padding:"8px 14px",borderRadius:"2px",background:"rgba(80,200,152,0.07)",border:"1px solid rgba(80,200,152,0.2)",color:TG,fontWeight:600,fontSize:"0.82rem"}}>정답</div>:<div style={{display:"flex",alignItems:"center",gap:"8px",padding:"8px 14px",borderRadius:"2px",background:"rgba(232,74,95,0.07)",border:"1px solid rgba(232,74,95,0.2)",color:TA,fontWeight:600,fontSize:"0.82rem"}}>오답 — 정답: <b style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.2rem"}}>{vq.answer}</b><SpeakBtn text={vq.answer} onSpeak={speakOnDemand} muted={muted}/></div>}</div>}
            </>)}
            {variantQuizType==="mcq"&&(<>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px",marginBottom:"10px"}}>
                {(vq.choices||[]).map((choice,ci)=>{ const isSel=variantSelected===choice; const isCorr=variantConfirmed&&choice===vq.answer; const isWrong=variantConfirmed&&isSel&&choice!==vq.answer; return(<button key={ci} onClick={()=>{if(!variantConfirmed)setVariantSelected(choice);}} style={{padding:"13px 10px",borderRadius:"2px",fontFamily:"Arial",direction:"rtl",fontSize:"clamp(1rem,4vw,1.4rem)",fontWeight:600,cursor:variantConfirmed?"default":"pointer",border:`1px solid ${isCorr?"rgba(80,200,152,0.5)":isWrong?"rgba(232,74,95,0.5)":isSel?"rgba(80,200,152,0.35)":TL}`,background:isCorr?"rgba(80,200,152,0.08)":isWrong?"rgba(232,74,95,0.08)":isSel?"rgba(80,200,152,0.06)":"rgba(255,255,255,0.02)",color:isCorr?TG:isWrong?TA:isSel?TG:TT}}>{choice}</button>); })}
              </div>
              {variantConfirmed&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"7px",marginBottom:"10px"}}>{lastResult?.correct?<div style={{padding:"8px 14px",borderRadius:"2px",background:"rgba(80,200,152,0.07)",border:"1px solid rgba(80,200,152,0.2)",color:TG,fontWeight:600,fontSize:"0.82rem"}}>정답</div>:<div style={{display:"flex",alignItems:"center",gap:"8px",padding:"8px 14px",borderRadius:"2px",background:"rgba(232,74,95,0.07)",border:"1px solid rgba(232,74,95,0.2)",color:TA,fontWeight:600,fontSize:"0.82rem"}}>오답 — 정답: <b style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.2rem"}}>{vq.answer}</b><SpeakBtn text={vq.answer} onSpeak={speakOnDemand} muted={muted}/></div>}</div>}
            </>)}
            {variantConfirmed&&(()=>{const vw=words.find(x=>x.id===vq.wordId);return vw?(<div style={{display:"flex",gap:"4px",marginBottom:"7px",justifyContent:"center",flexWrap:"wrap"}}>{vw.status!=="hard"&&<button onClick={()=>setManualStatus(vq.wordId,"hard")} style={{...Bt.ghost,padding:"3px 9px",fontSize:"0.7rem",borderColor:"rgba(232,74,95,0.28)",color:TA}}>! 어려움</button>}{vw.status!=="mastered"&&<button onClick={()=>setManualStatus(vq.wordId,"mastered")} style={{...Bt.ghost,padding:"3px 9px",fontSize:"0.7rem",borderColor:"rgba(80,200,152,0.28)",color:TG}}>✓ 암기완료</button>}</div>):null;})()}
            <div className="qr" style={{display:"flex",gap:"6px"}}>
              {!variantConfirmed?<button style={{flex:1,padding:"13px",borderRadius:"2px",background:TG,border:"none",color:"#071a0e",fontWeight:600,cursor:"pointer",fontSize:"0.88rem",...(variantQuizType==="essay"?(!variantInput.trim()?{opacity:0.22,cursor:"not-allowed"}:{}):(variantSelected===null?{opacity:0.22,cursor:"not-allowed"}:{}))}} onClick={handleVariantConfirm} disabled={variantQuizType==="essay"?!variantInput.trim():variantSelected===null}>{T.confirm}</button>:<button style={{flex:1,padding:"13px",borderRadius:"2px",background:TG,border:"none",color:"#071a0e",fontWeight:600,cursor:"pointer",fontSize:"0.88rem"}} onClick={handleVariantNext}>{variantCur+1>=variantQuestions.length?T.finish:T.next}</button>}
              <button style={{padding:"13px 17px",borderRadius:"2px",background:"transparent",border:`1px solid ${TL}`,color:TD,cursor:"pointer",fontSize:"0.82rem"}} onClick={()=>{window.speechSynthesis?.cancel();setMode(MODES.LIST);}}>{T.quit}</button>
            </div>
          </div>);
        })()}

        {/* ─── VARIANT RESULT ──────────────────────────────────── */}
        {mode===MODES.VARIANT_RESULT&&(<div style={{textAlign:"center",padding:"40px 0"}}>
          <div style={{width:"110px",height:"110px",borderRadius:"2px",background:"rgba(80,200,152,0.06)",border:"1px solid rgba(80,200,152,0.25)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px"}}>
            <span style={{fontSize:"2.8rem",fontWeight:800,color:TG,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"3px"}}>{variantResults.filter(r=>r.correct).length}</span>
            <span style={{fontSize:"1rem",color:TD,alignSelf:"flex-end",marginBottom:"8px"}}>/{variantQuestions.length}</span>
          </div>
          <p style={{fontSize:"0.58rem",color:TG,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",marginBottom:"4px"}}>VARIANT QUIZ</p>
          <p style={{fontSize:"1rem",color:TT,marginBottom:"4px"}}>{variantResults.filter(r=>r.correct).length===variantQuestions.length?"Perfect!":variantResults.filter(r=>r.correct).length>=variantQuestions.length*0.7?"잘했어요!":"틀린 변형을 복습해봐요!"}</p>
          <p style={{fontSize:"0.72rem",color:TD,marginBottom:"20px",letterSpacing:"1px"}}>{Math.round(variantResults.filter(r=>r.correct).length/variantQuestions.length*100)}%</p>
          <div style={{background:TS,borderRadius:"2px",border:`1px solid ${TL}`,padding:"12px",marginBottom:"14px",textAlign:"left"}}>
            <h3 style={{margin:"0 0 8px",fontSize:"0.58rem",color:TD,letterSpacing:"2px",textTransform:"uppercase"}}>결과</h3>
            {variantResults.map((r,i)=>{ const vt=VARIANT_TYPES.find(t=>t.id===r.variantType); return(<div key={i} style={{padding:"7px 0",borderBottom:`1px solid ${TL}`,display:"flex",flexDirection:"column",gap:"2px"}}><div style={{display:"flex",alignItems:"center",gap:"7px"}}><span style={{color:r.correct?TG:TA,fontSize:"0.7rem",fontWeight:700}}>{r.correct?"✓":"✕"}</span><span style={{fontFamily:"Arial",direction:"rtl",color:TH,fontSize:"0.98rem"}}>{r.base}</span><span style={{fontSize:"0.58rem",color:TG,background:"rgba(80,200,152,0.07)",padding:"1px 5px",borderRadius:"2px"}}>{vt?vt.label[uiLang]||vt.label.ko:r.variantType}</span><SpeakBtn text={r.answer} onSpeak={speakOnDemand} muted={muted}/></div><div style={{paddingLeft:"18px",fontSize:"0.75rem"}}><span style={{color:TD}}>입력: </span><span style={{color:r.correct?TG:TA,fontFamily:"Arial",direction:"rtl"}}>{r.userInput}</span>{!r.correct&&<><span style={{color:TD,marginLeft:"7px"}}>정답: </span><span style={{color:TG,fontFamily:"Arial",direction:"rtl"}}>{r.answer}</span></>}</div></div>); })}
          </div>
          <div className="rb" style={{display:"flex",gap:"7px"}}><button style={{flex:1,padding:"13px",borderRadius:"2px",background:TG,border:"none",color:"#071a0e",fontWeight:600,cursor:"pointer",fontSize:"0.88rem"}} onClick={startVariantQuiz}>다시 풀기</button><button style={{flex:1,padding:"13px",borderRadius:"2px",background:"transparent",border:`1px solid ${TL}`,color:TD,cursor:"pointer",fontSize:"0.88rem"}} onClick={()=>setMode(MODES.LIST)}>단어장으로</button></div>
        </div>)}

        {/* ─── MCQ RESULT ──────────────────────────────────────── */}
        {mode===MODES.RESULT&&(<div style={{textAlign:"center",padding:"40px 0"}}>
          <div style={{width:"110px",height:"110px",borderRadius:"2px",background:"rgba(232,74,95,0.06)",border:"1px solid rgba(232,74,95,0.25)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px"}}>
            <span style={{fontSize:"2.8rem",fontWeight:800,color:TA,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"3px"}}>{score}</span>
            <span style={{fontSize:"1rem",color:TD,alignSelf:"flex-end",marginBottom:"8px"}}>/{questions.length}</span>
          </div>
          <p style={{fontSize:"1rem",color:TT,marginBottom:"4px"}}>{score===questions.length?"Perfect!":score>=questions.length*0.7?"잘했어요!":score>=questions.length*0.5?"조금 더 연습!":"틀린 단어를 복습해봐요!"}</p>
          <p style={{fontSize:"0.72rem",color:TD,marginBottom:"20px",letterSpacing:"1px"}}>{Math.round(score/questions.length*100)}%</p>
          <div style={{display:"flex",justifyContent:"center",gap:"26px",marginBottom:"20px"}}>
            {[["mastered","✓ 암기완료",TG],["hard","! 어려움",TA],["learning","◎ 학습중","#8A8AAA"]].map(([st,label,color])=>(<div key={st} style={{display:"flex",flexDirection:"column",alignItems:"center",color}}><span style={{fontSize:"1.9rem",fontWeight:800,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"2px"}}>{words.filter(w=>w.status===st).length}</span><span style={{fontSize:"0.58rem",opacity:0.5,marginTop:"1px",letterSpacing:"1px",textTransform:"uppercase"}}>{label}</span></div>))}
          </div>
          {wrongWords.length>0&&(<div style={{background:TS,borderRadius:"2px",border:`1px solid ${TL}`,padding:"12px",marginBottom:"14px",textAlign:"left"}}>
            <h3 style={{margin:"0 0 8px",fontSize:"0.58rem",color:TD,letterSpacing:"2px",textTransform:"uppercase"}}>틀린 단어</h3>
            {wrongWords.map((q,i)=>{ const w=words.find(x=>x.id===q.wordId); return w?(<div key={i} style={{padding:"6px 0",borderBottom:`1px solid ${TL}`,display:"flex",alignItems:"center",gap:"8px"}}><span style={{fontFamily:"Arial,sans-serif",fontSize:"1.05rem",direction:"rtl",color:TH,whiteSpace:"nowrap"}}>{w.hebrew}</span><SpeakBtn text={w.hebrew} onSpeak={speakOnDemand} muted={muted}/><span style={{color:TD}}>→</span><span style={{fontSize:"0.85rem",color:TM}}>{w.meaning}</span></div>):null; })}
          </div>)}
          <div className="rb" style={{display:"flex",gap:"7px"}}><button style={{flex:1,padding:"13px",borderRadius:"2px",background:TA,border:"none",color:"#fff",fontWeight:600,cursor:"pointer",fontSize:"0.88rem"}} onClick={startQuiz}>다시 풀기</button><button style={{flex:1,padding:"13px",borderRadius:"2px",background:"transparent",border:`1px solid ${TL}`,color:TD,cursor:"pointer",fontSize:"0.88rem"}} onClick={()=>setMode(MODES.LIST)}>단어장으로</button></div>
        </div>)}

        {/* ─── ESSAY RESULT ─────────────────────────────────────── */}
        {mode===MODES.ESSAY_RESULT&&(<div style={{textAlign:"center",padding:"40px 0"}}>
          <div style={{width:"110px",height:"110px",borderRadius:"2px",background:"rgba(167,139,250,0.06)",border:"1px solid rgba(167,139,250,0.25)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px"}}>
            <span style={{fontSize:"2.8rem",fontWeight:800,color:TP,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"3px"}}>{essayScore+essayPartial}</span>
            <span style={{fontSize:"1rem",color:TD,alignSelf:"flex-end",marginBottom:"8px"}}>/{essayQuestions.length}</span>
          </div>
          <p style={{fontSize:"1rem",color:TT,marginBottom:"4px"}}>{essayScore===essayQuestions.length?"Perfect!":(essayScore+essayPartial)>=essayQuestions.length*0.7?"잘했어요!":"틀린 단어를 복습해봐요!"}</p>
          <div style={{display:"flex",justifyContent:"center",gap:"26px",marginBottom:"20px"}}>
            <div style={{textAlign:"center",color:TG}}><div style={{fontSize:"1.9rem",fontWeight:800,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"2px"}}>{essayScore}</div><div style={{fontSize:"0.58rem",opacity:0.5,letterSpacing:"1px",textTransform:"uppercase"}}>정답</div></div>
            <div style={{textAlign:"center",color:TA}}><div style={{fontSize:"1.9rem",fontWeight:800,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"2px"}}>{essayPartial}</div><div style={{fontSize:"0.58rem",opacity:0.5,letterSpacing:"1px",textTransform:"uppercase"}}>부분</div></div>
            <div style={{textAlign:"center",color:TD}}><div style={{fontSize:"1.9rem",fontWeight:800,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"2px"}}>{essayQuestions.length-essayScore-essayPartial}</div><div style={{fontSize:"0.58rem",opacity:0.5,letterSpacing:"1px",textTransform:"uppercase"}}>오답</div></div>
          </div>
          <div style={{background:TS,borderRadius:"2px",border:`1px solid ${TL}`,padding:"12px",marginBottom:"14px",textAlign:"left"}}>
            <h3 style={{margin:"0 0 8px",fontSize:"0.58rem",color:TP,letterSpacing:"2px",textTransform:"uppercase"}}>전체 결과</h3>
            {essayResults.map((r,i)=>{ const color=r.result==="exact"?TG:r.result==="partial"?TA:"rgba(232,74,95,0.55)"; return(<div key={i} style={{padding:"6px 0",borderBottom:`1px solid ${TL}`,display:"flex",flexDirection:"column",gap:"2px"}}><div style={{display:"flex",alignItems:"center",gap:"7px"}}><span style={{fontFamily:r.questionType==="mean_to_heb"?"inherit":"Arial,sans-serif",fontSize:r.questionType==="mean_to_heb"?"0.88rem":"1.05rem",direction:r.questionType==="mean_to_heb"?"ltr":"rtl",color:TH}}>{r.question}</span><SpeakBtn text={r.question} onSpeak={speakOnDemand} muted={muted}/><span style={{marginLeft:"auto",fontSize:"0.7rem",color}}>{r.result==="exact"?"✓":r.result==="partial"?"△":"✕"}</span></div><div style={{fontSize:"0.75rem",color:TD}}>내 답: <span style={{color}}>{r.userInput}</span>{r.result!=="exact"&&<> | 정답: <span style={{color:TG}}>{r.answer}</span></>}</div></div>); })}
          </div>
          <div className="rb" style={{display:"flex",gap:"7px"}}><button style={{flex:1,padding:"13px",borderRadius:"2px",background:TP,border:"none",color:"#fff",fontWeight:600,cursor:"pointer",fontSize:"0.88rem"}} onClick={startEssay}>다시 풀기</button><button style={{flex:1,padding:"13px",borderRadius:"2px",background:"transparent",border:`1px solid ${TL}`,color:TD,cursor:"pointer",fontSize:"0.88rem"}} onClick={()=>setMode(MODES.LIST)}>단어장으로</button></div>
        </div>)}

      </div> {/* end container */}
    </div>
  );
}

// ─── Style Objects ─────────────────────────────────────────────
const Mo = {
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:900,padding:"16px"},
  box:{background:TS,border:`1px solid rgba(255,255,255,0.07)`,borderRadius:"2px",padding:"22px",maxWidth:"440px",width:"100%",boxShadow:"0 24px 60px rgba(0,0,0,0.7)"},
  title:{margin:"0 0 6px",color:TT,fontSize:"0.92rem",fontWeight:600},
  sub:{margin:"0 0 10px",color:TD,fontSize:"0.78rem"},
  ta:{width:"100%",height:"145px",background:"rgba(255,255,255,0.03)",border:`1px solid ${TL}`,borderRadius:"2px",color:TT,padding:"10px",fontSize:"0.78rem",resize:"vertical",outline:"none",fontFamily:"monospace",marginBottom:"10px"},
  row:{display:"flex",gap:"6px"},
};
const Bt = {
  primary:{padding:"9px 17px",borderRadius:"2px",background:TA,border:"none",color:"#fff",fontWeight:600,cursor:"pointer",fontSize:"0.8rem"},
  ghost:{padding:"8px 13px",borderRadius:"2px",background:"transparent",border:`1px solid ${TL}`,color:TM,cursor:"pointer",fontSize:"0.8rem"},
  green:{padding:"9px 17px",borderRadius:"2px",background:TG,border:"none",color:"#071a0e",fontWeight:600,cursor:"pointer",fontSize:"0.8rem"},
  essay:{padding:"9px 17px",borderRadius:"2px",background:TP,border:"none",color:"#fff",fontWeight:600,cursor:"pointer",fontSize:"0.8rem"},
  input:{width:"100%",padding:"10px 13px",background:"rgba(255,255,255,0.04)",border:`1px solid ${TL}`,borderRadius:"2px",color:TT,fontSize:"0.92rem",outline:"none",fontFamily:"inherit"},
  opt:{padding:"7px 11px",borderRadius:"2px",border:`1px solid ${TL}`,background:"transparent",color:TM,cursor:"pointer",fontSize:"0.72rem"},
  optActive:{background:"rgba(232,74,95,0.1)",borderColor:"rgba(232,74,95,0.45)",color:TA},
  essayOptActive:{background:"rgba(167,139,250,0.1)",borderColor:"rgba(167,139,250,0.4)",color:TP},
};
