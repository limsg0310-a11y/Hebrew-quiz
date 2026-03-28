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

// SheetJS 동적 로드 (xlsx 파일 파싱용)
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

// 변형 타입 설정
const VARIANT_TYPES = [
  // 성별/복수
  { id:"gender_f",  label:{ko:"여성형 단수 (היא)",         en:"Feminine sg. (היא)"},    prompt:{ko:"여성형 단수는?",         en:"Feminine singular?"} },
  { id:"gender_m",  label:{ko:"남성형 단수 (הוא)",         en:"Masculine sg. (הוא)"},   prompt:{ko:"남성형 단수는?",         en:"Masculine singular?"} },
  { id:"plural_m",  label:{ko:"남성형 복수 (הם)",           en:"Masculine pl. (הם)"},    prompt:{ko:"남성형 복수는?",         en:"Masculine plural?"} },
  { id:"plural_f",  label:{ko:"여성형 복수 (הן)",           en:"Feminine pl. (הן)"},     prompt:{ko:"여성형 복수는?",         en:"Feminine plural?"} },
  // 과거형
  { id:"past_1s",   label:{ko:"과거 — 나 (אני)",            en:"Past — I (אני)"},         prompt:{ko:"אני — 나는 ~했다",       en:"אני (past)"} },
  { id:"past_2ms",  label:{ko:"과거 — 너, 남성 (אתה)",      en:"Past — You M (אתה)"},     prompt:{ko:"אתה — 너는 ~했다",       en:"אתה (past)"} },
  { id:"past_2fs",  label:{ko:"과거 — 너, 여성 (את)",       en:"Past — You F (את)"},      prompt:{ko:"את — 너는 ~했다",        en:"את (past)"} },
  { id:"past_3ms",  label:{ko:"과거 — 그 (הוא)",            en:"Past — He (הוא)"},        prompt:{ko:"הוא — 그는 ~했다",       en:"הוא (past)"} },
  { id:"past_3fs",  label:{ko:"과거 — 그녀 (היא)",          en:"Past — She (היא)"},       prompt:{ko:"היא — 그녀는 ~했다",     en:"היא (past)"} },
  { id:"past_1p",   label:{ko:"과거 — 우리 (אנחנו)",        en:"Past — We (אנחנו)"},      prompt:{ko:"אנחנו — 우리는 ~했다",   en:"אנחנו (past)"} },
  { id:"past_2mp",  label:{ko:"과거 — 너희, 남성 (אתם)",    en:"Past — You pl.M (אתם)"},  prompt:{ko:"אתם — 너희는 ~했다",     en:"אתם (past)"} },
  { id:"past_2fp",  label:{ko:"과거 — 너희, 여성 (אתן)",    en:"Past — You pl.F (אתן)"},  prompt:{ko:"אתן — 너희는 ~했다",     en:"אתן (past)"} },
  { id:"past_3mp",  label:{ko:"과거 — 그들, 남성 (הם)",     en:"Past — They M (הם)"},     prompt:{ko:"הם — 그들은 ~했다",      en:"הם (past)"} },
  { id:"past_3fp",  label:{ko:"과거 — 그들, 여성 (הן)",     en:"Past — They F (הן)"},     prompt:{ko:"הן — 그들은 ~했다",      en:"הן (past)"} },
  // 현재형 (분사)
  { id:"pres_ms",   label:{ko:"현재 — 남성 단수 (אני/אתה/הוא)",  en:"Present — M sg."},  prompt:{ko:"אני/הוא — ~하는 중 (남단)", en:"M sg. (present)"} },
  { id:"pres_fs",   label:{ko:"현재 — 여성 단수 (אני/את/היא)",   en:"Present — F sg."},  prompt:{ko:"אני/היא — ~하는 중 (여단)", en:"F sg. (present)"} },
  { id:"pres_mp",   label:{ko:"현재 — 남성 복수 (אנחנו/אתם/הם)", en:"Present — M pl."},  prompt:{ko:"אנחנו/הם — ~하는 중 (남복)",en:"M pl. (present)"} },
  { id:"pres_fp",   label:{ko:"현재 — 여성 복수 (אנחנו/אתן/הן)", en:"Present — F pl."},  prompt:{ko:"אנחנו/הן — ~하는 중 (여복)",en:"F pl. (present)"} },
  // 미래형
  { id:"fut_1s",    label:{ko:"미래 — 나 (אני)",             en:"Future — I (אני)"},      prompt:{ko:"אני — 나는 ~할 것이다",  en:"אני (future)"} },
  { id:"fut_2ms",   label:{ko:"미래 — 너, 남성 (אתה)",       en:"Future — You M (אתה)"},  prompt:{ko:"אתה — 너는 ~할 것",      en:"אתה (future)"} },
  { id:"fut_2fs",   label:{ko:"미래 — 너, 여성 (את)",        en:"Future — You F (את)"},   prompt:{ko:"את — 너는 ~할 것",       en:"את (future)"} },
  { id:"fut_3ms",   label:{ko:"미래 — 그 (הוא)",             en:"Future — He (הוא)"},     prompt:{ko:"הוא — 그는 ~할 것이다",  en:"הוא (future)"} },
  { id:"fut_3fs",   label:{ko:"미래 — 그녀 (היא)",           en:"Future — She (היא)"},    prompt:{ko:"היא — 그녀는 ~할 것이다",en:"היא (future)"} },
  { id:"fut_1p",    label:{ko:"미래 — 우리 (אנחנו)",         en:"Future — We (אנחנו)"},   prompt:{ko:"אנחנו — 우리는 ~할 것",  en:"אנחנו (future)"} },
  { id:"fut_2mp",   label:{ko:"미래 — 너희, 남성 (אתם)",     en:"Future — You pl.M (אתם)"},prompt:{ko:"אתם — 너희는 ~할 것",   en:"אתם (future)"} },
  { id:"fut_2fp",   label:{ko:"미래 — 너희, 여성 (אתן)",     en:"Future — You pl.F (אתן)"},prompt:{ko:"אתן — 너희는 ~할 것",   en:"אתן (future)"} },
  { id:"fut_3mp",   label:{ko:"미래 — 그들, 남성 (הם)",      en:"Future — They M (הם)"},  prompt:{ko:"הם — 그들은 ~할 것",     en:"הם (future)"} },
  { id:"fut_3fp",   label:{ko:"미래 — 그들, 여성 (הן)",      en:"Future — They F (הן)"},  prompt:{ko:"הן — 그들은 ~할 것",     en:"הן (future)"} },
  // 명령형
  { id:"imp_2ms",   label:{ko:"명령 — 너, 남성 (אתה)",       en:"Imperative — You M (אתה)"},  prompt:{ko:"אתה — ~해라! (남단)",  en:"אתה — Do!"} },
  { id:"imp_2fs",   label:{ko:"명령 — 너, 여성 (את)",        en:"Imperative — You F (את)"},   prompt:{ko:"את — ~해라! (여단)",   en:"את — Do!"} },
  { id:"imp_2mp",   label:{ko:"명령 — 너희, 남성 (אתם)",     en:"Imperative — You pl.M (אתם)"},prompt:{ko:"אתם — ~해라! (남복)", en:"אתם — Do!"} },
  { id:"imp_2fp",   label:{ko:"명령 — 너희, 여성 (אתן)",     en:"Imperative — You pl.F (אתן)"},prompt:{ko:"אתן — ~해라! (여복)", en:"אתן — Do!"} },
  // 소유격
  { id:"poss_1s",   label:{ko:"소유격 — 나의 (שלי)",          en:"Poss. — My (שלי)"},       prompt:{ko:"나의 ~ (שלי)?",         en:"My ~?"} },
  { id:"poss_2ms",  label:{ko:"소유격 — 너의, 남성 (שלך)",    en:"Poss. — Your M (שלך)"},   prompt:{ko:"너의 ~ (שלך, 남)?",     en:"Your (M) ~?"} },
  { id:"poss_2fs",  label:{ko:"소유격 — 너의, 여성 (שלך)",    en:"Poss. — Your F (שלך)"},   prompt:{ko:"너의 ~ (שלך, 여)?",     en:"Your (F) ~?"} },
  { id:"poss_3ms",  label:{ko:"소유격 — 그의 (שלו)",          en:"Poss. — His (שלו)"},       prompt:{ko:"그의 ~ (שלו)?",         en:"His ~?"} },
  { id:"poss_3fs",  label:{ko:"소유격 — 그녀의 (שלה)",        en:"Poss. — Her (שלה)"},       prompt:{ko:"그녀의 ~ (שלה)?",       en:"Her ~?"} },
  { id:"poss_1p",   label:{ko:"소유격 — 우리의 (שלנו)",       en:"Poss. — Our (שלנו)"},      prompt:{ko:"우리의 ~ (שלנו)?",      en:"Our ~?"} },
  { id:"poss_2mp",  label:{ko:"소유격 — 너희의, 남성 (שלכם)", en:"Poss. — Your pl.M (שלכם)"},prompt:{ko:"너희의 ~ (שלכם)?",      en:"Your pl. (M) ~?"} },
  { id:"poss_2fp",  label:{ko:"소유격 — 너희의, 여성 (שלכן)", en:"Poss. — Your pl.F (שלכן)"},prompt:{ko:"너희의 ~ (שלכן)?",      en:"Your pl. (F) ~?"} },
  { id:"poss_3mp",  label:{ko:"소유격 — 그들의, 남성 (שלהם)", en:"Poss. — Their M (שלהם)"}, prompt:{ko:"그들의 ~ (שלהם)?",      en:"Their (M) ~?"} },
  { id:"poss_3fp",  label:{ko:"소유격 — 그들의, 여성 (שלהן)", en:"Poss. — Their F (שלהן)"}, prompt:{ko:"그들의 ~ (שלהן)?",      en:"Their (F) ~?"} },
  // to부정사
  { id:"infinitive",label:{ko:"to부정사 — 원형 (ל...)",       en:"Infinitive (ל...)"},       prompt:{ko:"동사 원형은?",           en:"Infinitive form?"} },
];


// 가로형 변형 헤더 → type 매핑
const WIDE_VARIANT_HEADER_MAP = {
  "여성형": "gender_f", "gender_f": "gender_f", "feminine": "gender_f",
  "남성형": "gender_m", "gender_m": "gender_m", "masculine": "gender_m",
  "복수 남성형": "plural_m", "plural_m": "plural_m", "plural(m)": "plural_m",
  "복수 여성형": "plural_f", "plural_f": "plural_f", "plural(f)": "plural_f",
  "1인칭 단수": "verb_1s", "verb_1s": "verb_1s", "1st sg.": "verb_1s",
  "2인칭 남단수": "verb_2ms", "verb_2ms": "verb_2ms", "2nd sg. m": "verb_2ms",
  "2인칭 여단수": "verb_2fs", "verb_2fs": "verb_2fs", "2nd sg. f": "verb_2fs",
  "3인칭 남단수": "verb_3ms", "verb_3ms": "verb_3ms",
  "3인칭 여단수": "verb_3fs", "verb_3fs": "verb_3fs",
  "1인칭 복수": "verb_1p", "verb_1p": "verb_1p",
  "2인칭 남복수": "verb_2mp", "verb_2mp": "verb_2mp",
  "2인칭 여복수": "verb_2fp", "verb_2fp": "verb_2fp",
  "3인칭 남복수": "verb_3mp", "verb_3mp": "verb_3mp",
  "3인칭 여복수": "verb_3fp", "verb_3fp": "verb_3fp",
  "소유 1인칭": "poss_1s", "poss_1s": "poss_1s",
  "소유 2인칭(남)": "poss_2ms", "poss_2ms": "poss_2ms",
  "소유 2인칭(여)": "poss_2fs", "poss_2fs": "poss_2fs",
  "소유 3인칭(남)": "poss_3ms", "poss_3ms": "poss_3ms",
  "소유 3인칭(여)": "poss_3fs", "poss_3fs": "poss_3fs",
};

// 헤더 정규화 (줄바꿈·괄호·공백 제거 후 소문자)
function normalizeHeader(h) {
  return String(h).replace(/\n.*$/,"").replace(/\(.*?\)/g,"").trim().toLowerCase();
}

// 엑셀 변형 데이터 파싱 (가로형 + 세로형 자동 감지)
function parseVariantExcel(rows) {
  if (!rows.length) return [];
  const header = rows[0].map(h => String(h||""));

  // 세로형 감지: 3열 이상이고 3번째 열이 variant type 코드인지 확인
  const isLong = header.length >= 4 && (
    header[2].toLowerCase().includes("변형") ||
    header[2].toLowerCase().includes("type") ||
    header[2].toLowerCase().includes("코드") ||
    // 데이터 첫 행의 3열이 알려진 variant type인지
    (rows[1] && Object.keys(WIDE_VARIANT_HEADER_MAP).some(k => rows[1][2] && String(rows[1][2]).toLowerCase().includes(k.split("_")[0])))
  );

  const result = {}; // hebrew → { meaning, variants[] }

  if (isLong) {
    // 세로형: 히브리어, 뜻, 변형유형, 변형형태
    for (let i = 1; i < rows.length; i++) {
      const [heb, mean, vtype, vform] = rows[i].map(c => String(c||"").trim());
      if (!heb || !vtype || !vform) continue;
      const typeKey = WIDE_VARIANT_HEADER_MAP[vtype] || WIDE_VARIANT_HEADER_MAP[vtype.toLowerCase()] || vtype;
      if (!result[heb]) result[heb] = { meaning: mean, variants: [] };
      if (result[heb].meaning === "") result[heb].meaning = mean;
      result[heb].variants.push({ type: typeKey, form: vform });
    }
  } else {
    // 가로형: 히브리어, 뜻, [변형열들...]
    const variantCols = []; // { colIdx, type }
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
  }
  return result;
}

// 변형 카테고리
const VARIANT_CATS = [
  { id:"gender",    label:{ko:"성별 변형",      en:"Gender"},         color:"#e06080", types:["gender_f","gender_m"] },
  { id:"plural",    label:{ko:"단수/복수",      en:"Plural"},         color:"#60a0e0", types:["plural_m","plural_f"] },
  { id:"past",      label:{ko:"과거형",         en:"Past Tense"},     color:"#c4a050", types:["past_1s","past_2ms","past_2fs","past_3ms","past_3fs","past_1p","past_2mp","past_2fp","past_3mp","past_3fp"] },
  { id:"present",   label:{ko:"현재형(분사)",    en:"Present"},        color:"#60c880", types:["pres_ms","pres_fs","pres_mp","pres_fp"] },
  { id:"future",    label:{ko:"미래형",         en:"Future Tense"},   color:"#60a0e0", types:["fut_1s","fut_2ms","fut_2fs","fut_3ms","fut_3fs","fut_1p","fut_2mp","fut_2fp","fut_3mp","fut_3fp"] },
  { id:"imperative",label:{ko:"명령형",         en:"Imperative"},     color:"#f07050", types:["imp_2ms","imp_2fs","imp_2mp","imp_2fp"] },
  { id:"poss",      label:{ko:"소유격",         en:"Possessive"},     color:"#9060f0", types:["poss_1s","poss_2ms","poss_2fs","poss_3ms","poss_3fs","poss_1p","poss_2mp","poss_2fp","poss_3mp","poss_3fp"] },
  { id:"infinitive",label:{ko:"to부정사",       en:"Infinitive"},     color:"#50c898", types:["infinitive"] },
];

// 품사 정의 — 각 품사가 사용할 수 있는 변형 카테고리
const WORD_TYPES = [
  { id:"verb",    label:{ko:"동사",   en:"Verb"},      emoji:"🔵",
    cats:["infinitive","past","present","future","imperative"],
    hint:{ko:"예: לָלֶכֶת (가다), לֶאֱכֹל (먹다)", en:"e.g. to go, to eat"} },
  { id:"noun",    label:{ko:"명사",   en:"Noun"},      emoji:"🟡",
    cats:["gender","plural","poss"],
    hint:{ko:"예: בַּיִת (집), יֶלֶד (아이)", en:"e.g. house, child"} },
  { id:"adj",     label:{ko:"형용사", en:"Adjective"}, emoji:"🟠",
    cats:["gender","plural"],
    hint:{ko:"예: גָּדוֹל (큰), טוֹב (좋은)", en:"e.g. big, good"} },
  { id:"pronoun", label:{ko:"대명사", en:"Pronoun"},   emoji:"🟣",
    cats:["gender","plural"],
    hint:{ko:"예: אֲנִי (나), הוּא (그)", en:"e.g. I, he, she"} },
  { id:"other",   label:{ko:"기타",   en:"Other"},     emoji:"⚪",
    cats:["gender","plural","poss"],
    hint:{ko:"부사, 전치사, 숙어 등", en:"adverb, preposition, phrase"} },
];

// 품사에 따라 허용된 카테고리 반환
function getAllowedCats(wordType) {
  if(!wordType) return VARIANT_CATS; // 품사 미지정 → 전체
  const wt = WORD_TYPES.find(t=>t.id===wordType);
  if(!wt) return VARIANT_CATS;
  return VARIANT_CATS.filter(c=>wt.cats.includes(c.id));
}

// 붙여넣기 순서 — 카테고리별 순서대로 펼친 배열
const VARIANT_PASTE_ORDER = [
  "gender_f","gender_m","plural_m","plural_f",
  "past_1s","past_2ms","past_2fs","past_3ms","past_3fs","past_1p","past_2mp","past_2fp","past_3mp","past_3fp",
  "pres_ms","pres_fs","pres_mp","pres_fp",
  "fut_1s","fut_2ms","fut_2fs","fut_3ms","fut_3fs","fut_1p","fut_2mp","fut_2fp","fut_3mp","fut_3fp",
  "imp_2ms","imp_2fs","imp_2mp","imp_2fp",
  "poss_1s","poss_2ms","poss_2fs","poss_3ms","poss_3fs","poss_1p","poss_2mp","poss_2fp","poss_3mp","poss_3fp",
  "infinitive"
];

// 품사에 따라 붙여넣기 순서 반환
function getAllowedPasteOrder(wordType) {
  const allowed = new Set(getAllowedCats(wordType).flatMap(c=>c.types));
  return VARIANT_PASTE_ORDER.filter(t=>allowed.has(t));
}
const BOOKS = [
  { id:"hebrew",  label:{ko:"히브리어", en:"Hebrew"},  emoji:"🇮🇱", color:"#c4a050", ttsLang:"he-IL", ttsName:"he-IL-Neural2-A", ttsRate:0.9,
    termA:{ko:"히브리어", en:"Word"}, termB:{ko:"뜻", en:"Meaning"},
    placeholderA:{ko:"עברית (히브리어)", en:"Hebrew word"},
    placeholderB:{ko:"뜻 (한국어/영어)", en:"Meaning"},
    dir:"rtl" },
  { id:"english", label:{ko:"영어", en:"English"}, emoji:"🇺🇸", color:"#60a0e0", ttsLang:"en-US", ttsName:"en-US-Standard-C", ttsRate:0.9,
    termA:{ko:"영어 단어", en:"English word"}, termB:{ko:"뜻 (한국어)", en:"Korean meaning"},
    placeholderA:{ko:"English word", en:"English word"},
    placeholderB:{ko:"뜻 (한국어)", en:"Korean meaning"},
    dir:"ltr" },
  { id:"korean",  label:{ko:"한국어", en:"Korean"}, emoji:"🇰🇷", color:"#e06080", ttsLang:"ko-KR", ttsName:"ko-KR-Standard-A", ttsRate:0.9,
    termA:{ko:"한국어 단어", en:"Korean word"}, termB:{ko:"뜻 (영어)", en:"English meaning"},
    placeholderA:{ko:"한국어 단어", en:"Korean word"},
    placeholderB:{ko:"뜻 (영어)", en:"English meaning"},
    dir:"ltr" },
];

// UI 언어별 텍스트
const UI_TEXT = {
  ko: {
    appTitle:"히브리어 단어 퀴즈", appSub:"Hebrew Vocabulary Trainer",
    addWord:"➕ 단어 추가", editWord:"✏️ 단어 수정", addBtn:"추가", editBtn:"수정 완료", cancelBtn:"취소",
    saveLoad:"💾 단어장 저장 / 불러오기", telegramTip:"텔레그램 등 파일 저장이 안 되면 📋 복사 사용",
    fileSave:"⬇️ 파일 저장", copy:"📋 복사", fileOpen:"⬆️ 파일 열기", paste:"📋 붙여넣기", textAdd:"📝 텍스트 추가", csvExcel:"📊 CSV/엑셀",
    searchPlaceholder:"단어 검색...", all:"전체", learning:"📖 학습중", hard:"🔥 어려움", done:"✅ 완료",
    selectAll:"전체 선택", deselect:"선택 해제", deleteN:(n)=>`🗑️ ${n}개 삭제`, wordCount:(n)=>`${n}개 단어`,
    mcqTitle:"🎯 객관식 퀴즈", direction:"문제 방향", wordRange:"단어 범위", questionCount:"문제 수",
    dirAtoB:(b)=>`${b.termA.ko} → ${b.termB.ko}`, dirBtoA:(b)=>`${b.termB.ko} → ${b.termA.ko}`, mixed:"랜덤 혼합",
    allRange:(n)=>`전체 (${n})`, excludeMastered:(n)=>`암기 제외 (${n})`, hardOnly:(n)=>`🔥 어려운 것만 (${n})`,
    autoPlay:"🔊 퀴즈 자동 발음", autoPlaySub:"문제 시 자동 재생", mute:"🔇 음소거", muteSub:"모든 발음을 끕니다", soundLabel:"발음 설정",
    startMCQ:(n)=>`🚀 객관식 시작! (${n}문제)`, needMore:(n)=>`단어 최소 4개 필요 (현재 ${n}개)`,
    essayTitle:"✍️ 서술형 시험", essaySub:"직접 타이핑해서 답하는 서술형! 부분 정답도 인정됩니다.",
    dirAtoB_e:(b)=>`${b.termA.ko} → ${b.termB.ko} 입력`, dirBtoA_e:(b)=>`${b.termB.ko} → ${b.termA.ko} 입력`,
    startEssay:(n)=>`✍️ 서술형 시작! (${n}문제)`,
    questionTagAtoB:(b)=>`${b.termA.ko}의 ${b.termB.ko}는?`, questionTagBtoA:(b)=>`${b.termB.ko}에 해당하는 ${b.termA.ko}는?`,
    inputPlaceholderA:(b)=>`${b.termB.ko}을 입력하세요...`, inputPlaceholderB:(b)=>`${b.termA.ko}로 입력하세요...`,
    markHard:"🔥 어려움으로 표시", markedHard:"🔥 어려움으로 분류됨",
    correct:"✅ 정답!", wrong:(a)=>`❌ 오답 — 정답: ${a}`,
    confirm:"확인", next:"다음 문제 →", finish:"결과 보기 🏁", quit:"그만하기",
    autoSaveLocal:"💾 이 기기에만 저장돼요. Google 로그인하면 모든 기기에서 동기화!",
    autoSaveCloud:(name)=>`☁️ ${name}의 단어장 — 모든 기기에서 자동 동기화돼요!`,
    login:"Google 로그인", logout:"로그아웃", saving:"저장중...",
    directInput:"직접:", questions:(n)=>`${n}문제`,
  },
  en: {
    appTitle:"Vocabulary Quiz", appSub:"Multi-language Vocabulary Trainer",
    addWord:"➕ Add Word", editWord:"✏️ Edit Word", addBtn:"Add", editBtn:"Save", cancelBtn:"Cancel",
    saveLoad:"💾 Save / Load", telegramTip:"Can't save files? Use 📋 Copy instead",
    fileSave:"⬇️ Export", copy:"📋 Copy", fileOpen:"⬆️ Import", paste:"📋 Paste", textAdd:"📝 Text", csvExcel:"📊 CSV/Excel",
    searchPlaceholder:"Search words...", all:"All", learning:"📖 Learning", hard:"🔥 Hard", done:"✅ Done",
    selectAll:"Select All", deselect:"Deselect", deleteN:(n)=>`🗑️ Delete ${n}`, wordCount:(n)=>`${n} words`,
    mcqTitle:"🎯 Multiple Choice", direction:"Direction", wordRange:"Word Range", questionCount:"Questions",
    dirAtoB:(b)=>`${b.termA.en} → ${b.termB.en}`, dirBtoA:(b)=>`${b.termB.en} → ${b.termA.en}`, mixed:"Random Mix",
    allRange:(n)=>`All (${n})`, excludeMastered:(n)=>`Excl. Mastered (${n})`, hardOnly:(n)=>`🔥 Hard Only (${n})`,
    autoPlay:"🔊 Auto Pronunciation", autoPlaySub:"Auto play on question", mute:"🔇 Mute", muteSub:"Mute all sounds", soundLabel:"Sound",
    startMCQ:(n)=>`🚀 Start! (${n} questions)`, needMore:(n)=>`Need at least 4 words (now ${n})`,
    essayTitle:"✍️ Written Test", essaySub:"Type your answer directly! Partial answers accepted.",
    dirAtoB_e:(b)=>`${b.termA.en} → type ${b.termB.en}`, dirBtoA_e:(b)=>`${b.termB.en} → type ${b.termA.en}`,
    startEssay:(n)=>`✍️ Start! (${n} questions)`,
    questionTagAtoB:(b)=>`What is the ${b.termB.en}?`, questionTagBtoA:(b)=>`What is the ${b.termA.en}?`,
    inputPlaceholderA:(b)=>`Type the ${b.termB.en}...`, inputPlaceholderB:(b)=>`Type the ${b.termA.en}...`,
    markHard:"🔥 Mark as Hard", markedHard:"🔥 Marked as Hard",
    correct:"✅ Correct!", wrong:(a)=>`❌ Wrong — Answer: ${a}`,
    confirm:"Check", next:"Next →", finish:"See Results 🏁", quit:"Quit",
    autoSaveLocal:"💾 Saved on this device only. Login to sync across devices!",
    autoSaveCloud:(name)=>`☁️ ${name}'s words — Synced across all devices!`,
    login:"Sign in with Google", logout:"Sign out", saving:"Saving...",
    directInput:"Custom:", questions:(n)=>`${n} q`,
  }
};
function getLSKey(book) { return `hebrew_quiz_words_${book||"hebrew"}`; }
const LS_KEY = "hebrew_quiz_words"; // legacy key

const STATUS_CONFIG = {
  learning: { label:"학습중",   emoji:"📖", color:"#9090b0", bg:"rgba(120,120,160,0.15)", border:"rgba(120,120,160,0.3)" },
  mastered: { label:"암기완료", emoji:"✅", color:"#60c880", bg:"rgba(60,180,100,0.15)",  border:"rgba(60,180,100,0.35)" },
  hard:     { label:"어려움",   emoji:"🔥", color:"#f07050", bg:"rgba(200,80,60,0.15)",   border:"rgba(200,80,60,0.35)" },
};

function stripNikkud(text) { return text.replace(/[\u0591-\u05C7]/g,""); }
function shuffle(arr) { return [...arr].sort(()=>Math.random()-0.5); }
function loadWords(book) {
  try {
    const key = book && book !== "hebrew" ? getLSKey(book) : LS_KEY;
    const s = localStorage.getItem(key);
    if (s) return JSON.parse(s);
    // legacy migration: 처음 hebrew로 로드할 때 기존 키도 확인
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
  const user = norm(userInput);
  const correct = norm(correctAnswer);
  if (user === correct) return "exact";
  const cWords = correct.split(" ").filter(w=>w.length>1);
  const uWords = user.split(" ").filter(w=>w.length>1);
  const matches = cWords.filter(w=>uWords.some(u=>u.includes(w)||w.includes(u)));
  if (matches.length >= Math.ceil(cWords.length*0.6)) return "partial";
  return "wrong";
}

function generateQuestion(word, allWords, type) {
  // meaning 없는 단어는 heb_to_mean만 가능
  const canMeanToHeb = !!word.meaning;
  let actualType = type===QUIZ_TYPES.MIXED
    ? (canMeanToHeb&&Math.random()>0.5 ? QUIZ_TYPES.MEAN_TO_HEB : QUIZ_TYPES.HEB_TO_MEAN)
    : type;
  // mean_to_heb인데 meaning이 없으면 heb_to_mean으로 fallback
  if(actualType===QUIZ_TYPES.MEAN_TO_HEB && !canMeanToHeb) actualType=QUIZ_TYPES.HEB_TO_MEAN;

  const question = actualType===QUIZ_TYPES.HEB_TO_MEAN ? word.hebrew : word.meaning;
  const answer   = actualType===QUIZ_TYPES.HEB_TO_MEAN ? word.meaning : word.hebrew;

  // 보기: 정답과 다른 값, 중복 제거
  const pool = allWords.filter(w => w.id!==word.id && (actualType===QUIZ_TYPES.HEB_TO_MEAN ? !!w.meaning : !!w.hebrew));
  const seen = new Set([answer]);
  const distractors = [];
  for(const w of shuffle(pool)){
    const val = actualType===QUIZ_TYPES.HEB_TO_MEAN ? w.meaning : w.hebrew;
    if(!seen.has(val)){ seen.add(val); distractors.push(val); }
    if(distractors.length >= 3) break;
  }
  while(distractors.length < 3) distractors.push("—");

  return { question, answer, choices:shuffle([answer,...distractors]), questionType:actualType, wordId:word.id };
}

async function googleTTS(text, apiKey, lang="he-IL", name="he-IL-Wavenet-A", rate=0.9) {
  // Google TTS: 히브리어는 닉쿠드 포함해서 전송 (닉쿠드가 있어야 정확한 발음)
  // 단, 다른 언어도 그대로 전송
  const input = text;

  // Neural2 먼저 시도, 실패하면 Wavenet으로 폴백
  const voiceNames = lang.startsWith("he")
    ? ["he-IL-Neural2-A", "he-IL-Wavenet-A", "he-IL-Standard-A"]
    : [name];

  for(const voiceName of voiceNames){
    try{
      const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          input:{text:input},
          voice:{languageCode:lang, name:voiceName},
          audioConfig:{audioEncoding:"MP3", speakingRate:rate, pitch:0}
        }),
      });
      if(!res.ok) continue; // 이 음성 안 되면 다음 시도
      const data=await res.json();
      if(data.audioContent){
        new Audio(`data:audio/mp3;base64,${data.audioContent}`).play();
        return; // 성공
      }
    }catch{}
  }
  throw new Error("TTS error");
}
function browserTTS(text, lang="he-IL", rate=0.9) {
  if(!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  // 브라우저 TTS: 닉쿠드 제거 (브라우저는 닉쿠드 처리 못함)
  const input = lang.startsWith("he") ? stripNikkud(text) : text;
  const utt=new SpeechSynthesisUtterance(input);
  utt.lang=lang; utt.rate=rate; window.speechSynthesis.speak(utt);
}

function SpeakBtn({text,onSpeak,size="md",muted=false}) {
  const [playing,setPlaying]=useState(false);
  const handleClick=async(e)=>{
    e.stopPropagation();
    if(muted) return;
    setPlaying(true);
    try{await onSpeak(text);}catch{}
    setTimeout(()=>setPlaying(false),1200);
  };
  return <button onClick={handleClick} title={muted?"음소거 중":"발음 듣기"} style={{background:muted?"rgba(100,100,100,0.1)":playing?"rgba(196,160,80,0.3)":"rgba(196,160,80,0.1)",border:muted?"1px solid rgba(150,150,150,0.2)":"1px solid rgba(196,160,80,0.35)",borderRadius:"8px",cursor:muted?"default":"pointer",padding:size==="lg"?"10px 16px":"6px 10px",fontSize:size==="lg"?"1.2rem":"0.95rem",lineHeight:1,flexShrink:0,opacity:muted?0.4:1}}>{muted?"🔇":playing?"🔊":"🔈"}</button>;
}

// 반복 재생 버튼 (1회/5회/10회)
function RepeatSpeakBtn({text,onSpeak,muted=false,size="lg"}) { // size: lg | sm
  const [playing,setPlaying]=useState(false);
  const [count,setCount]=useState(0); // 진행 중인 카운트
  const [repeatMode,setRepeatMode]=useState(1); // 1, 5, 10
  const stopRef=useRef(false);

  const handleSpeak=async(e)=>{
    e.stopPropagation();
    if(muted||playing) return;
    stopRef.current=false;
    setPlaying(true);
    for(let i=0;i<repeatMode;i++){
      if(stopRef.current) break;
      setCount(i+1);
      try{await onSpeak(text);}catch{}
      if(i<repeatMode-1) await new Promise(r=>setTimeout(r,1400));
    }
    setPlaying(false); setCount(0);
  };
  const handleStop=(e)=>{ e.stopPropagation(); stopRef.current=true; window.speechSynthesis?.cancel(); setPlaying(false); setCount(0); };

  const modes=[1,5,10];
  return(
    <div className="repeat-btn-row" style={{display:"flex",alignItems:"center",gap:"6px",flexShrink:0}}>
      {/* 모드 선택 버튼 */}
      <div style={{display:"flex",gap:"3px"}}>
        {modes.map(m=>(
          <button key={m} onClick={e=>{e.stopPropagation();if(!playing)setRepeatMode(m);}} style={{padding:size==="sm"?"3px 6px":"4px 8px",borderRadius:"6px",border:"1px solid",fontSize:size==="sm"?"0.65rem":"0.72rem",fontWeight:700,cursor:playing?"not-allowed":"pointer",background:repeatMode===m?"rgba(196,160,80,0.3)":"rgba(255,255,255,0.05)",borderColor:repeatMode===m?"rgba(196,160,80,0.6)":"rgba(255,255,255,0.1)",color:repeatMode===m?"#c4a050":"#5a5870",opacity:playing&&repeatMode!==m?0.4:1}}>
            {m}회
          </button>
        ))}
      </div>
      {/* 재생/정지 버튼 */}
      <button onClick={playing?handleStop:handleSpeak} title={muted?"음소거 중":playing?"정지":"발음 듣기"}
        style={{background:muted?"rgba(100,100,100,0.1)":playing?"rgba(200,60,60,0.2)":"rgba(196,160,80,0.1)",border:muted?"1px solid rgba(150,150,150,0.2)":playing?"1px solid rgba(200,60,60,0.4)":"1px solid rgba(196,160,80,0.35)",borderRadius:"8px",cursor:muted?"default":"pointer",padding:size==="sm"?"5px 10px":"10px 16px",fontSize:size==="sm"?"0.9rem":"1.2rem",lineHeight:1,flexShrink:0,opacity:muted?0.4:1}}>
        {muted?"🔇":playing?`⏹ ${count}/${repeatMode}`:"🔈"}
      </button>
    </div>
  );
}

function parseCSV(text) {
  // 탭/세미콜론 구분자면 단순 분리, 쉼표는 quoted CSV 파싱
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const results = [];
  for (const line of lines) {
    let cols = [];
    if (/\t|;/.test(line)) {
      // 탭 또는 세미콜론 구분자
      cols = line.split(/[\t;]/).map(c => c.trim().replace(/^["']|["']$/g, ""));
    } else {
      // 쉼표 구분자 — 따옴표 안의 쉼표는 무시
      const re = /("([^"]*)")|([^,]+)/g;
      let m;
      while ((m = re.exec(line)) !== null) {
        cols.push((m[2] !== undefined ? m[2] : m[3]).trim());
      }
    }
    if (cols.length >= 2 && cols[0] && cols[1]) {
      results.push({ hebrew: cols[0], meaning: cols[1] });
    }
  }
  return results;
}

function parseTextFormat(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const results = [];
  for (const line of lines) {
    // 첫 번째 = 또는 : 기준으로만 분리 (뜻에 괄호/기호 포함 허용)
    const idx = line.search(/[=:]/);
    if (idx > 0) {
      const a = line.slice(0, idx).trim();
      const b = line.slice(idx + 1).trim();
      if (a && b) results.push({ hebrew: a, meaning: b });
    }
  }
  return results;
}

export default function HebrewQuiz() {
  const envKey=process.env.REACT_APP_GOOGLE_TTS_KEY||"";
  const [apiKey]=useState(envKey); const ttsReady=!!envKey;
  // ── Firebase 로그인 상태 ──
  const [user,setUser]     =useState(null);   // null = 비로그인
  const [syncing,setSyncing]=useState(false);

  const [showMergeModal,setShowMergeModal]=useState(false);
  const [pendingCloudWords,setPendingCloudWords]=useState(null);

  useEffect(()=>{
    const unsub = onAuthStateChanged(fbAuth, async(u)=>{
      setUser(u);
      if(u){
        try{
          const snap = await getDoc(doc(fbDb,"users",u.uid));
          const localWords = loadWords();
          const hasLocal = localWords.length > 0 && !(localWords.length===8 && localWords[0].hebrew==="שָׁלוֹם");

          const syncKey = `synced_${u.uid}`;
          const alreadySynced = localStorage.getItem(syncKey);

          if(snap.exists()){
            const cloud = snap.data().words;
            if(cloud&&cloud.length){
              if(hasLocal && !alreadySynced){
                // 로컬과 클라우드 내용이 같으면 모달 없이 클라우드 로드
                const localSet = new Set(localWords.map(w=>w.hebrew));
                const cloudSet = new Set(cloud.map(w=>w.hebrew));
                const isSame = localWords.length === cloud.length &&
                  [...localSet].every(h=>cloudSet.has(h));
                if(isSame){
                  setWordsRaw(cloud); saveWords(cloud);
                  localStorage.setItem(syncKey,"1");
                } else {
                  // 다를 때만 선택 모달
                  setPendingCloudWords(cloud);
                  setShowMergeModal(true);
                }
              } else {
                // 이미 동기화했거나 로컬 단어 없음 → 클라우드 로드
                setWordsRaw(cloud); saveWords(cloud);
                if(!alreadySynced) showToast("☁️ 클라우드 단어장을 불러왔어요!");
                localStorage.setItem(syncKey,"1");
              }
            } else {
              // 클라우드 비어있음 → 로컬 단어를 클라우드에 업로드
              if(hasLocal){
                await setDoc(doc(fbDb,"users",u.uid),{words:localWords,updatedAt:new Date().toISOString()});
                localStorage.setItem(syncKey,"1");
                showToast("☁️ 기존 단어장을 클라우드에 저장했어요!");
              }
            }
          } else {
            // 클라우드에 계정 없음(첫 로그인) → 로컬 단어 업로드
            if(hasLocal){
              await setDoc(doc(fbDb,"users",u.uid),{words:localWords,updatedAt:new Date().toISOString()});
              localStorage.setItem(syncKey,"1");
              showToast("☁️ 기존 단어장을 클라우드에 저장했어요!");
            }
          }
        }catch(e){ console.error(e); }
      }
    });
    return ()=>unsub();
  },[]); // eslint-disable-line

  // 병합 or 클라우드 선택
  const handleMerge=(choice)=>{
    if(!pendingCloudWords) return;
    if(choice==="cloud"){
      setWordsRaw(pendingCloudWords); saveWords(pendingCloudWords);
      showToast("☁️ 클라우드 단어장으로 교체했어요!");
    } else if(choice==="local"){
      // 로컬 유지, 클라우드에 로컬 업로드
      const local=loadWords();
      if(user) setDoc(doc(fbDb,"users",user.uid),{words:local,updatedAt:new Date().toISOString()});
      showToast("💾 기존 단어장을 클라우드에 저장했어요!");
    } else {
      // 병합: 히브리어 기준 중복 제거
      const local=loadWords();
      const hebrewSet=new Set(pendingCloudWords.map(w=>w.hebrew));
      const merged=[...pendingCloudWords,...local.filter(w=>!hebrewSet.has(w.hebrew))];
      setWordsRaw(merged); saveWords(merged);
      if(user) setDoc(doc(fbDb,"users",user.uid),{words:merged,updatedAt:new Date().toISOString()});
      showToast(`☁️ 병합 완료! 총 ${merged.length}개 단어`);
    }
    setPendingCloudWords(null); setShowMergeModal(false);
    if(user) localStorage.setItem(`synced_${user.uid}`,"1");
  };

  const signInGoogle = async()=>{
    try{ await signInWithPopup(fbAuth, new GoogleAuthProvider()); showToast("로그인 성공! 단어장을 불러오는 중..."); }
    catch(e){ showToast("로그인 실패: "+e.message,"err"); }
  };
  const signOutUser = async()=>{
    await signOut(fbAuth); showToast("로그아웃 됐어요.");
  };
  const syncToCloud = async(wordsToSync)=>{
    if(!user) return;
    setSyncing(true);
    try{ await setDoc(doc(fbDb,"users",user.uid),{words:wordsToSync,updatedAt:new Date().toISOString()}); }
    catch(e){ console.error("sync error",e); }
    finally{ setSyncing(false); }
  };

  const [currentBook,setCurrentBook]     =useState("hebrew");
  const [uiLang,setUiLang]               =useState("ko");
  const T = UI_TEXT[uiLang] || UI_TEXT.ko;
  const bookInfo = BOOKS.find(b=>b.id===currentBook)||BOOKS[0];
  const [words,setWordsRaw]             =useState(()=>loadWords("hebrew"));
  const [mode,setMode]                  =useState(MODES.LIST);
  const [newHebrew,setNewHebrew]        =useState("");
  const [newWordType,setNewWordType]    =useState(null);
  const [newWordWallets,setNewWordWallets]=useState(new Set()); // 추가할 커스텀 단어장들
  const [newWordExcludeDefault,setNewWordExcludeDefault]=useState(false); // 기본 단어장 제외
  const [newMeaning,setNewMeaning]      =useState("");
  const [editId,setEditId]              =useState(null);
  const [quizType,setQuizType] = useState(()=>{ try{return localStorage.getItem("quizType")||QUIZ_TYPES.HEB_TO_MEAN;}catch{return QUIZ_TYPES.HEB_TO_MEAN;} });
  const setQuizTypeSave=(v)=>{setQuizType(v);try{localStorage.setItem("quizType",v);}catch{}};
  const [quizFilter,setQuizFilter] = useState(()=>{ try{return localStorage.getItem("quizFilter")||QUIZ_FILTERS.ALL;}catch{return QUIZ_FILTERS.ALL;} });
  const setQuizFilterSave=(v)=>{setQuizFilter(v);try{localStorage.setItem("quizFilter",v);}catch{}};
  const [quizCount,setQuizCount] = useState(()=>{ try{const s=localStorage.getItem("quizCount");return s?Number(s):10;}catch{return 10;} });
  const setQuizCountSave=(v)=>{setQuizCount(v);try{localStorage.setItem("quizCount",v);}catch{}};
  const [listFilter,setListFilter] = useState(()=>{
    try{ return localStorage.getItem("listFilter")||"all"; }catch{ return "all"; }
  });
  const setListFilterSave=(v)=>{ setListFilter(v); try{localStorage.setItem("listFilter",v);}catch{}; };
  const [sortBy,setSortBy] = useState(()=>{
    try{ return localStorage.getItem("sortBy")||"default"; }catch{ return "default"; }
  });
  const setSortBySave=(v)=>{ setSortBy(v); try{localStorage.setItem("sortBy",v);}catch{}; };
  const [searchQuery,setSearchQuery]    =useState("");
  const [pageSize,setPageSize] = useState(()=>{
    try{ const s=localStorage.getItem("pageSize"); return s?Number(s):20; }catch{ return 20; }
  });
  const setPageSizeSave=(n)=>{ setPageSize(n); try{localStorage.setItem("pageSize",n);}catch{}; };
  const [page,setPage]                  =useState(0);
  const [selectedIds,setSelectedIds]    =useState(new Set());
  const [questions,setQuestions]        =useState([]);
  const [current,setCurrent]            =useState(0);
  const [selected,setSelected]          =useState(null);
  const [confirmed,setConfirmed]        =useState(false);
  const [score,setScore]                =useState(0);
  const [wrongWords,setWrongWords]      =useState([]);
  const [animKey,setAnimKey]            =useState(0);
  const [importPreview,setImportPreview]=useState(null);
  const [toast,setToast]                =useState(null);
  const [soundMode,setSoundMode]         =useState("auto"); // "auto" | "manual" | "mute"
  const autoPlay = soundMode === "auto";
  const muted    = soundMode === "mute";
  // speak: forcePlay=true 이면 soundMode 무시하고 재생 (버튼 직접 클릭 시)
  const speak=useCallback(async(text,forceMuted=false,forcePlay=false)=>{
    if(forceMuted) return;
    if(!forcePlay && soundMode!=="auto") return; // auto 모드가 아니면 자동 재생 차단
    const book = BOOKS.find(b=>b.id===currentBook)||BOOKS[0];
    const {ttsLang,ttsName,ttsRate} = book;
    if(apiKey){ try{ await googleTTS(text,apiKey,ttsLang,ttsName,ttsRate); return; }catch{} }
    browserTTS(text,ttsLang,ttsRate);
  },[apiKey,currentBook,soundMode]);
  // 버튼 클릭 시 발음 — soundMode 상관없이 재생 (음소거 제외)
  const speakOnDemand=useCallback(async(text)=>{
    if(soundMode==="mute") return;
    const book = BOOKS.find(b=>b.id===currentBook)||BOOKS[0];
    const {ttsLang,ttsName,ttsRate} = book;
    if(apiKey){ try{ await googleTTS(text,apiKey,ttsLang,ttsName,ttsRate); return; }catch{} }
    browserTTS(text,ttsLang,ttsRate);
  },[apiKey,currentBook,soundMode]);
  const [showPasteModal,setShowPasteModal]=useState(false);
  const [showBatchModal,setShowBatchModal]=useState(false);
  const [showPealimModal,setShowPealimModal]=useState(false);
  const [showRootModal,setShowRootModal]    =useState(false);
  const [importTargetWallets,setImportTargetWallets]=useState(new Set()); // 가져오기 대상 단어장
  const [importExcludeDefault,setImportExcludeDefault]=useState(false);  // 기본 단어장 제외
  // ── 단어 지갑 ──
  const [showWalletModal,setShowWalletModal]=useState(false);
  const [walletPickWord,setWalletPickWord]=useState(null); // 단어장 선택 팝업용 wordId
  const [wallets,setWallets]=useState(()=>{
    try{ const s=localStorage.getItem("wordWallets"); return s?JSON.parse(s):[]; }catch{ return []; }
  });
  const [walletEditId,setWalletEditId]=useState(null); // 편집 중인 지갑 id
  const [walletName,setWalletName]=useState("");
  const [walletColor,setWalletColor]=useState("#c4a050");
  const [walletView,setWalletView]=useState(null); // 보고 있는 지갑 id
  const saveWallets=(w)=>{ setWallets(w); try{localStorage.setItem("wordWallets",JSON.stringify(w));}catch{}; };
  const createWallet=()=>{
    if(!walletName.trim()) return;
    const nw=[{id:Date.now(),name:walletName.trim(),color:walletColor,wordIds:[]}, ...wallets];
    saveWallets(nw); setWalletName(""); setWalletColor("#c4a050");
  };
  const deleteWallet=(id)=>saveWallets(wallets.filter(w=>w.id!==id));
  const toggleWordInWallet=(walletId,wordId)=>{
    saveWallets(wallets.map(w=>w.id===walletId
      ?{...w,wordIds:w.wordIds.includes(wordId)?w.wordIds.filter(i=>i!==wordId):[...w.wordIds,wordId]}
      :w));
  };
  const getWalletWords=(walletId)=>{ const w=wallets.find(w=>w.id===walletId); return w?words.filter(wd=>w.wordIds.includes(wd.id)):[];};   // 어근 단어 검색 모달
  const [rootSearchInput,setRootSearchInput]=useState("");
  const [wordSearchInput,setWordSearchInput]=useState("");   // 한/영으로 히브리어 검색
  const [wordSearchResults,setWordSearchResults]=useState([]);
  const [wordSearchLoading,setWordSearchLoading]=useState(false);
  const [wordSearchError,setWordSearchError]=useState("");
  const [wordSearchSelected,setWordSearchSelected]=useState(new Set());
  const [showWordSearchModal,setShowWordSearchModal]=useState(false);       // 어근 입력
  const [rootSearchResults,setRootSearchResults]=useState([]);   // 검색 결과
  const [rootSearchLoading,setRootSearchLoading]=useState(false);
  const [rootSearchError,setRootSearchError]=useState("");
  const [rootSelected,setRootSelected]      =useState(new Set()); // 선택된 결과 인덱스
  const [rootGroupName,setRootGroupName]    =useState("");       // 그룹 이름 (어근)
  const [pealimRoot,setPealimRoot]        =useState("");
  const [pealimResults,setPealimResults]  =useState([]);
  const [pealimLoading,setPealimLoading]  =useState(false);
  const [pealimError,setPealimError]      =useState("");
  const [pealimPreview,setPealimPreview]  =useState(null); // {meaning, infinitive, variants}
  const [pealimSelected,setPealimSelected]=useState(new Set()); // 선택된 검색 결과 인덱스
  const [pasteText,setPasteText]        =useState("");
  const batchTextRef                    =useRef(null); // uncontrolled — fixes Hebrew IME input issue
  const [essayQuestions,setEssayQuestions]=useState([]);
  const [essayCurrent,setEssayCurrent]  =useState(0);
  const [essayInput,setEssayInput]      =useState("");
  const [essayConfirmed,setEssayConfirmed]=useState(false);
  const [essayResults,setEssayResults]  =useState([]);
  const [essayFilter,setEssayFilter] = useState(()=>{ try{return localStorage.getItem("essayFilter")||QUIZ_FILTERS.ALL;}catch{return QUIZ_FILTERS.ALL;} });
  const setEssayFilterSave=(v)=>{setEssayFilter(v);try{localStorage.setItem("essayFilter",v);}catch{}};
  const [essayCount,setEssayCount] = useState(()=>{ try{const s=localStorage.getItem("essayCount");return s?Number(s):10;}catch{return 10;} });
  const setEssayCountSave=(v)=>{setEssayCount(v);try{localStorage.setItem("essayCount",v);}catch{}};
  const [essayType,setEssayType] = useState(()=>{ try{return localStorage.getItem("essayType")||"heb_to_mean";}catch{return "heb_to_mean";} });
  const setEssayTypeSave=(v)=>{setEssayType(v);try{localStorage.setItem("essayType",v);}catch{}};
  const essayInputRef=useRef(null); const essayHebrewRef=useRef(null); const fileInputRef=useRef(null); const csvInputRef=useRef(null); const variantFileRef=useRef(null);
  const variantInputRef=useRef(null);
  const verbFormFileRef=useRef(null);

  // 변형 퀴즈 state
  const [variantQuestions,setVariantQuestions]=useState([]);
  const [variantCur,setVariantCur]           =useState(0);
  const [variantQuizType,setVariantQuizType] =useState("essay"); // "essay" | "mcq"
  const [variantSelected,setVariantSelected] =useState(null);    // 객관식 선택
  const [variantInput,setVariantInput]       =useState("");
  const [variantConfirmed,setVariantConfirmed]=useState(false);
  const [variantResults,setVariantResults]   =useState([]);
  const [variantFilter,setVariantFilter] = useState(()=>{
    try{ return localStorage.getItem("variantFilter")||QUIZ_FILTERS.ALL; }catch{ return QUIZ_FILTERS.ALL; }
  });
  const setVariantFilterSave=(v)=>{ setVariantFilter(v); try{localStorage.setItem("variantFilter",v);}catch{}; };
  const [variantCount,setVariantCount]       =useState(10);
  const [variantCats,setVariantCats] = useState(()=>{
    try{ const s=localStorage.getItem("variantCats"); return s?JSON.parse(s):VARIANT_CATS.map(c=>c.id); }catch{ return VARIANT_CATS.map(c=>c.id); }
  });
  const setVariantCatsSave=(v)=>{ const next=typeof v==="function"?v(variantCats):v; setVariantCats(next); try{localStorage.setItem("variantCats",JSON.stringify(next));}catch{} };
  const [expandedVariantWord,setExpandedVariantWord]=useState(null);
  // 섹션 접기/펼치기
  const [openSections,setOpenSections]    =useState(()=>{
    try{
      const saved=localStorage.getItem("openSections");
      if(saved) return JSON.parse(saved);
    }catch{}
    return {add:false, io:false, import:false, quiz_mcq:false, quiz_essay:false, quiz_variant:false};
  });
  const toggleSection=(key)=>setOpenSections(s=>{
    const next={...s,[key]:!s[key]};
    try{ localStorage.setItem("openSections",JSON.stringify(next)); }catch{}
    return next;
  });
  const SectionHeader=({sectionKey,title,color="#c4a050",badge=null})=>(
    <button onClick={()=>toggleSection(sectionKey)}
      style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
        background:"none",border:"none",cursor:"pointer",padding:"0",textAlign:"left"}}>
      <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
        <span style={{fontSize:"0.9rem",fontWeight:600,color}}>{title}</span>
        {badge&&<span style={{fontSize:"0.7rem",background:"rgba(255,255,255,0.08)",padding:"2px 7px",borderRadius:"10px",color:"#7a7890"}}>{badge}</span>}
      </div>
      <span style={{fontSize:"0.75rem",color:"#5a5870",transition:"transform 0.2s",
        display:"inline-block",transform:openSections[sectionKey]?"rotate(180deg)":"rotate(0deg)"}}>▼</span>
    </button>
  );

  const [rootGroupView,setRootGroupView]   =useState(false);  // 어근 그룹 뷰 ON/OFF
  const [selectedRoot,setSelectedRoot]     =useState(null);   // 선택된 어근
  const [rootQuizType,setRootQuizType]     =useState("variant"); // "mcq"|"essay"|"variant" // 변형 편집 모달 열린 단어 id
  const [variantDraft,setVariantDraft]       =useState({}); // {type_id: form_string}
  const [variantPasteMode,setVariantPasteMode]=useState(false); // 붙여넣기 모드
  const [variantPasteText,setVariantPasteText]=useState(""); // 붙여넣기 텍스트
  const [variantEditType,setVariantEditType] =useState("");
  const [variantEditForm,setVariantEditForm] =useState("");

  const setWords=(updater)=>{ setWordsRaw(prev=>{ const next=typeof updater==="function"?updater(prev):updater; saveWords(next,currentBook); syncToCloud(next); return next; }); };
  const masteredCount=words.filter(w=>w.status==="mastered").length;
  const hardCount=words.filter(w=>w.status==="hard").length;
  const learningCount=words.filter(w=>w.status==="learning").length;
  const showToast=(msg,type="ok")=>{ setToast({msg,type}); setTimeout(()=>setToast(null),3000); };

  const switchBook=(bookId)=>{
    setCurrentBook(bookId);
    const loaded = loadWords(bookId);
    setWordsRaw(loaded);
    setListFilter("all"); setSearchQuery(""); setPage(0); setSelectedIds(new Set()); setMode(MODES.LIST);
  };

  // 변형 붙여넣기 파싱
  const applyVariantPaste=(text)=>{
    // 줄바꿈 또는 탭으로 분리
    const lines = text.split(/[\n\t]/).map(l=>l.trim());
    const draft = {...variantDraft};
    // 현재 편집 중인 단어의 품사에 맞는 순서 사용
    const editWord = words.find(w=>w.id===expandedVariantWord);
    const order = getAllowedPasteOrder(editWord?.wordType);
    let orderIdx = 0;
    lines.forEach(form=>{
      if(orderIdx >= order.length) return;
      if(form) { draft[order[orderIdx]] = form; orderIdx++; }
      else { orderIdx++; } // 빈 줄 = 건너뛰기
    });
    setVariantDraft(draft);
    setVariantPasteText("");
    setVariantPasteMode(false);
    showToast(`📋 ${Math.min(lines.length, VARIANT_PASTE_ORDER.length)}개 변형을 입력했어요!`);
  };

  // 변형 편집
  const openVariantModal=(word)=>{
    // 기존 변형을 draft로 로드
    const draft = {};
    (word.variants||[]).forEach(v=>{ draft[v.type]=v.form; });
    setVariantDraft(draft);
    setExpandedVariantWord(word.id);
  };
  const saveVariantDraft=(wordId)=>{
    const variants = Object.entries(variantDraft)
      .filter(([,form])=>form.trim())
      .map(([type,form])=>({type,form:form.trim()}));
    // 이전 변형 수 체크
    const prevCount=(words.find(w=>w.id===wordId)?.variants||[]).length;
    setWords(ws=>ws.map(w=>w.id===wordId?{...w,variants}:w));
    setExpandedVariantWord(null);
    const diff=variants.length-prevCount;
    if(diff<0) showToast(`✅ ${variants.length}개 저장! (${Math.abs(diff)}개 삭제됨)`);
    else showToast(`✅ 변형 ${variants.length}개 저장됐어요!`);
  };
  const deleteVariant=(wordId,vIdx)=>{
    setWords(ws=>ws.map(w=>w.id===wordId?{...w,variants:(w.variants||[]).filter((_,i)=>i!==vIdx)}:w));
  };

  // Pealim 어근 검색
  // ── 어근 기반 단어 검색 (Pealim) ──
  // ── 한국어/영어로 히브리어 단어 검색 ──
  // 번역 유틸
  const translateText=async(text, from, to)=>{
    const res=await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`);
    const data=await res.json();
    return data?.[0]?.[0]?.[0]||"";
  };

  const searchWordByMeaning=async()=>{
    if(!wordSearchInput.trim()){setWordSearchError("검색어를 입력해주세요");return;}
    setWordSearchLoading(true); setWordSearchError(""); setWordSearchResults([]); setWordSearchSelected(new Set());
    try{
      const q=wordSearchInput.trim();
      const hasKorean=/[ㄱ-ㅎ가-힣]/.test(q);
      const hasHebrew=/[א-ת]/.test(q);

      if(currentBook==="hebrew"){
        // 히브리어 단어장: 한/영 → 히브리어 (Pealim)
        let searchQ=q;
        if(hasKorean){
          try{ const t=await translateText(q,"ko","en"); if(t) searchQ=t; }catch{}
        }
        const res=await fetch(`/api/Reverso?mode=word_search&q=${encodeURIComponent(searchQ)}`);
        const data=await res.json();
        if(data.error){setWordSearchError(data.error);return;}
        if(!data.results?.length){setWordSearchError(`"${q}"${hasKorean?` → "${searchQ}"`:""} 검색 결과가 없어요.`);return;}
        setWordSearchResults(data.results);

      } else if(currentBook==="english"){
        // 영어 단어장: 한국어 → 영어 번역 결과를 카드로 표시
        if(!hasKorean){setWordSearchError("한국어로 입력해주세요 (예: 사과, 사랑)");return;}
        const translated=await translateText(q,"ko","en");
        if(!translated){setWordSearchError("번역 결과가 없어요.");return;}
        setWordSearchResults([{meaning:translated,hebrew:"",pos:"translation",note:`"${q}" 번역 결과`}]);

      } else if(currentBook==="korean"){
        // 한국어 단어장: 영어/히브리어 → 한국어
        let fromLang="en";
        if(hasHebrew) fromLang="he";
        const translated=await translateText(q,fromLang,"ko");
        if(!translated){setWordSearchError("번역 결과가 없어요.");return;}
        setWordSearchResults([{meaning:translated,hebrew:q,pos:"translation",note:`"${q}" 번역 결과`}]);
      }
    }catch(e){setWordSearchError("오류: "+e.message);}
    finally{setWordSearchLoading(false);}
  };

  const addSelectedWordSearchResults=()=>{
    if(!wordSearchSelected.size){setWordSearchError("단어를 선택해주세요");return;}
    const toAdd=[...wordSearchSelected].map(i=>wordSearchResults[i]).filter(Boolean);
    const newWords=toAdd.map(r=>{
      // 단어장별 hebrew/meaning 필드 결정
      let hebrew="", meaning="";
      if(currentBook==="hebrew"){ hebrew=r.hebrew; meaning=r.meaning||""; }
      else if(currentBook==="english"){ hebrew=""; meaning=r.meaning||""; } // 영어 단어장: meaning=영어단어
      else if(currentBook==="korean"){ hebrew=r.hebrew||""; meaning=r.meaning||""; } // 한국어: meaning=한국어
      return { id:Date.now()+Math.random(), hebrew, meaning, status:"learning", streak:0, wrongCount:0, wordType:r.pos==="translation"?null:r.pos||null, variants:[] };
    });
    if(!importExcludeDefault){
      setWords(ws=>[...newWords,...ws]); setPage(0);
    } else {
      setWords(ws=>[...newWords,...ws]);
    }
    if(importTargetWallets.size>0){
      const ids=newWords.map(w=>w.id);
      saveWallets(wallets.map(wl=>importTargetWallets.has(wl.id)?{...wl,wordIds:[...wl.wordIds,...ids]}:wl));
    }
    showToast(`✅ ${newWords.length}개 단어를 추가했어요!`);
    setWordSearchSelected(new Set());
    setShowWordSearchModal(false); setWordSearchResults([]); setWordSearchInput("");
  };

  const searchByRoot=async()=>{
    if(!rootSearchInput.trim()){setRootSearchError("어근을 입력해주세요");return;}
    setRootSearchLoading(true); setRootSearchError(""); setRootSearchResults([]); setRootSelected(new Set());
    try{
      const res=await fetch(`/api/Reverso?mode=root_search&root=${encodeURIComponent(rootSearchInput.trim())}`);
      const data=await res.json();
      if(data.error){setRootSearchError(data.error);return;}
      if(!data.results?.length){setRootSearchError("검색 결과가 없어요. 어근을 확인해주세요.");return;}
      setRootSearchResults(data.results);
      setRootGroupName(rootSearchInput.trim());
    }catch(e){setRootSearchError("오류: "+e.message);}
    finally{setRootSearchLoading(false);}
  };

  const addSelectedRootWords=()=>{
    if(!rootSelected.size){setRootSearchError("단어를 선택해주세요");return;}
    const toAdd=[...rootSelected].map(i=>rootSearchResults[i]).filter(Boolean);
    const newWords=toAdd.map(r=>({
      id:Date.now()+Math.random(),
      hebrew:r.hebrew,
      meaning:r.meaning||"",
      status:"learning",streak:0,wrongCount:0,
      wordType:r.pos||null,
      root:rootGroupName,
      rootGroup:rootGroupName,
      variants:[]
    }));
    // 기본 단어장에 추가 (제외 옵션 없으면)
    if(!importExcludeDefault){
      setWords(ws=>[...newWords,...ws]);
      setPage(0);
    } else if(newWords.length>0) {
      // 기본 제외해도 words에는 넣어야 함 (데이터 저장)
      setWords(ws=>[...newWords,...ws]);
    }
    // 커스텀 단어장에 추가
    if(importTargetWallets.size>0){
      const ids=newWords.map(w=>w.id);
      saveWallets(wallets.map(wl=>importTargetWallets.has(wl.id)?{...wl,wordIds:[...wl.wordIds,...ids]}:wl));
    }
    showToast(`✅ ${newWords.length}개 단어를 추가했어요!`);
    setRootSelected(new Set());
    setShowRootModal(false); setRootSearchResults([]); setRootSearchInput("");
  };

  const searchPealim=async()=>{
    if(!pealimRoot.trim()){setPealimError("동사를 입력해주세요");return;}
    setPealimLoading(true); setPealimError(""); setPealimResults([]); setPealimPreview(null);
    setPealimSelected(new Set());
    try{
      // Reverso: 인피니티브 직접 조회
      const res=await fetch(`/api/Reverso?mode=conjugation&verb=${encodeURIComponent(pealimRoot.trim())}`);
      const data=await res.json();
      if(data.error){setPealimError(data.error);return;}
      if(!data.variantCount){
        const dbg=data.debug||{};
        setPealimError(`변형 없음. 섹션:${(dbg.sections||[]).join(',')||"없음"} / h4레이블:${(dbg.h4labels||[]).join('|')||"없음"}`);
        return;
      }
      // 단어장에 같은 히브리어가 있으면 뜻 자동 채우기
      const existingWord = words.find(w=>stripNikkud(w.hebrew)===stripNikkud(data.infinitive)||w.hebrew===data.infinitive);
      const autoMeaning = existingWord?.meaning || data.meaning || "";
      setPealimPreview({...data, meaning:autoMeaning, root:pealimRoot.trim()});
    }catch(e){setPealimError("불러오는 중 오류: "+e.message);}
    finally{setPealimLoading(false);}
  };

  // 선택된 결과들 일괄 단어장 추가
  const addSelectedPealimWords=async()=>{
    if(!pealimSelected.size){ setPealimError("단어를 먼저 선택해주세요"); return; }
    setPealimLoading(true); setPealimError("");

    const selectedList = [...pealimSelected].map(idx=>pealimResults[idx]).filter(Boolean);
    if(!selectedList.length){ setPealimLoading(false); setPealimError("선택된 항목이 없어요"); return; }

    const newWords = [];
    for(let i=0; i<selectedList.length; i++){
      const r = selectedList[i];
      try{
        const conjUrl = r.url||`https://conjugator.reverso.net/conjugation-hebrew-verb-${encodeURIComponent(r.hebrew)}.html`;
        const res = await fetch(`/api/Reverso?mode=conjugation&url=${encodeURIComponent(conjUrl)}`);
        if(!res.ok) throw new Error("서버 오류 "+res.status);
        const data = await res.json();
        if(data.error) throw new Error(data.error);
        const variants = Object.entries(data.variants||{})
          .filter(([,f])=>f)
          .map(([type,form])=>({type,form}));
        newWords.push({
          id: Date.now()+Math.random()+i,
          hebrew: data.infinitive||r.hebrew,
          meaning: data.meaning||r.meaning||"",
          status:"learning", streak:0, wrongCount:0,
          wordType: data.wordType||null, variants, root:pealimRoot
        });
      }catch(e){
        // API 실패해도 단어 자체는 추가
        newWords.push({
          id: Date.now()+Math.random()+i,
          hebrew: r.hebrew,
          meaning: r.meaning||"",
          status:"learning", streak:0, wrongCount:0,
          wordType:"other", variants:[], root:pealimRoot
        });
      }
    }

    if(newWords.length===0){
      setPealimLoading(false);
      setPealimError("단어 추가에 실패했어요. 다시 시도해주세요.");
      return;
    }

    // 기본 단어장에 저장
    if(!importExcludeDefault){
      setWordsRaw(prev=>{ const next=[...newWords,...prev]; saveWords(next,currentBook); syncToCloud(next); return next; });
      setPage(0);
    } else {
      // 기본 제외해도 words에 넣어야 함
      setWordsRaw(prev=>{ const next=[...newWords,...prev]; saveWords(next,currentBook); syncToCloud(next); return next; });
    }
    // 커스텀 단어장에 추가
    if(importTargetWallets.size>0){
      const ids=newWords.map(w=>w.id);
      saveWallets(wallets.map(wl=>importTargetWallets.has(wl.id)?{...wl,wordIds:[...wl.wordIds,...ids]}:wl));
    }

    setPealimLoading(false);
    setPealimSelected(new Set());
    const withVariants = newWords.filter(w=>w.variants.length>0).length;
    showToast(`✅ ${newWords.length}개 단어 추가! (변형 ${withVariants}개 포함)`);
    setShowPealimModal(false);
    setPealimResults([]);
    setPealimRoot("");
    setPealimPreview(null);
  };

  const fetchPealimConjugation=async(url, root)=>{
    setPealimLoading(true); setPealimError(""); setPealimPreview(null);
    try{
      const res=await fetch(`/api/Reverso?mode=conjugation&url=${encodeURIComponent(url)}`);
      const data=await res.json();
      if(data.error){setPealimError(data.error);return;}
      if(!data.variantCount){
        const dbg=data.debug||{};
        setPealimError(`변형 없음. 섹션:${(dbg.sections||[]).join(',')||"없음"} h4:${(dbg.h4labels||[]).join('|')||"없음"}`);
        return;
      }
      const existingW = words.find(w=>stripNikkud(w.hebrew)===stripNikkud(data.infinitive)||w.hebrew===data.infinitive);
      const autoM = existingW?.meaning || data.meaning || "";
      setPealimPreview({...data, meaning:autoM, root: root||pealimRoot});
    }catch(e){setPealimError("변형 데이터를 가져오는 중 오류: "+e.message);}
    finally{setPealimLoading(false);}
  };

  const importPealimToWord=(wordId)=>{
    if(!pealimPreview) return;
    const variants=Object.entries(pealimPreview.variants)
      .filter(([,form])=>form)
      .map(([type,form])=>({type,form}));
    setWords(ws=>ws.map(w=>w.id===wordId?{...w,variants}:w)); // wordType 유지
    setShowPealimModal(false); setPealimPreview(null); setPealimRoot(""); setPealimResults([]);
    showToast(`✅ ${variants.length}개 변형을 단어장에 저장했어요!`);
  };

  // root가 있는 단어들 변형 일괄 재로딩
  const [refreshingVariants,setRefreshingVariants]=useState(false);
  const [refreshLog,setRefreshLog]=useState([]); // 불러온 단어 로그
  const [showRefreshLog,setShowRefreshLog]=useState(false);

  const downloadTemplate=()=>{
    const b64="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";
    const bin=atob(b64);
    const arr=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
    const blob=new Blob([arr],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download="Hebrew_동사변형_양식.xlsx"; a.click();
    URL.revokeObjectURL(url);
  };
  const refreshAllVariants=async()=>{
    const verbWords=words.filter(w=>w.wordType==="verb"||(w.variants||[]).length>0);
    if(!verbWords.length){ showToast("동사 단어가 없어요.","err"); return; }
    setRefreshingVariants(true);
    setRefreshLog([]);
    const log=[];
    const done=new Set();
    for(const w of verbWords){
      const key=stripNikkud(w.hebrew);
      if(done.has(key)) continue;
      done.add(key);
      try{
        const res=await fetch(`/api/Reverso?mode=conjugation&verb=${encodeURIComponent(w.hebrew)}`);
        const cd=await res.json();
        if(cd.error||!cd.variantCount){
          log.push({hebrew:w.hebrew,meaning:w.meaning,status:"fail",variantCount:0,error:cd.error||"변형 없음"});
          continue;
        }
        const variants=Object.entries(cd.variants).filter(([,f])=>f).map(([type,form])=>({type,form}));
        if(!variants.length){ log.push({hebrew:w.hebrew,meaning:w.meaning,status:"fail",variantCount:0,error:"변형 없음"}); continue; }
        setWords(ws=>ws.map(ww=>stripNikkud(ww.hebrew)===key?{...ww,variants,meaning:ww.meaning||cd.meaning||""}:ww));
        log.push({hebrew:w.hebrew,meaning:w.meaning,status:"ok",variantCount:variants.length});
      }catch(e){
        log.push({hebrew:w.hebrew,meaning:w.meaning,status:"fail",variantCount:0,error:e.message});
      }
    }
    setRefreshLog(log);
    setShowRefreshLog(true);
    setRefreshingVariants(false);
    const ok=log.filter(l=>l.status==="ok").length;
    showToast(`✅ ${ok}개 성공 / ${log.length-ok}개 실패`);
  };

  const addNewWordFromPealim=()=>{
    if(!pealimPreview||!pealimPreview.infinitive) return;
    const variants=Object.entries(pealimPreview.variants)
      .filter(([,form])=>form)
      .map(([type,form])=>({type,form}));
    // 이미 단어장에 있는지 확인
    const exists = words.find(w=>stripNikkud(w.hebrew)===stripNikkud(pealimPreview.infinitive));
    if(exists){
      // 기존 단어에 변형만 업데이트
      setWords(ws=>ws.map(w=>w.id===exists.id?{...w,variants}:w)); // wordType 유지
      showToast(`✅ "${pealimPreview.infinitive}" 변형 ${variants.length}개 업데이트됐어요!`);
    } else {
      const newWord={
        id:Date.now()+Math.random(),
        hebrew:pealimPreview.infinitive,
        meaning:pealimPreview.meaning||"",
        status:"learning",streak:0,wrongCount:0,
        wordType: pealimPreview.wordType||null, variants,
        root: pealimPreview.root||""
      };
      setWords(ws=>[newWord,...ws]);
      setPage(0);
      showToast(`✅ "${pealimPreview.infinitive}" 단어와 변형 ${variants.length}개가 추가됐어요!`);
    }
    setShowPealimModal(false); setPealimPreview(null); setPealimRoot(""); setPealimResults([]);
  };

  // 변형 엑셀 불러오기
  const handleVariantExcel=async(e)=>{
    const file=e.target.files[0]; if(!file) return;
    try{
      const XLSX=await getXLSX();
      const buf=await file.arrayBuffer();
      const wb=XLSX.read(buf,{type:"array"});
      // 시트 1 또는 "가로형" "세로형" 시트 자동 선택
      let sheetName = wb.SheetNames[0];
      if(wb.SheetNames.some(s=>s.includes("가로형"))) sheetName=wb.SheetNames.find(s=>s.includes("가로형"));
      else if(wb.SheetNames.some(s=>s.includes("세로형"))) sheetName=wb.SheetNames.find(s=>s.includes("세로형"));
      const ws=wb.Sheets[sheetName];
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
      const parsed=parseVariantExcel(rows);
      const entries=Object.entries(parsed);
      if(!entries.length){showToast("변형 데이터를 찾을 수 없어요.","err");return;}
      let added=0, updated=0;
      setWords(ws=>{
        return ws.map(w=>{
          const match=entries.find(([heb])=>stripNikkud(heb)===stripNikkud(w.hebrew)||heb===w.hebrew);
          if(!match) return w;
          const {variants:newV}=match[1];
          const existing=new Set((w.variants||[]).map(v=>v.type+"|"+v.form));
          const toAdd=newV.filter(v=>!existing.has(v.type+"|"+v.form));
          if(!toAdd.length) return w;
          updated++;added+=toAdd.length;
          return{...w,variants:[...(w.variants||[]),...toAdd]};
        });
      });
      showToast(`📥 ${updated}개 단어에 변형 ${added}개 추가됐어요!`);
    }catch(err){showToast("파일을 읽을 수 없어요: "+err.message,"err");}
    e.target.value="";
  };

  // 변형 퀴즈 시작
  const startVariantQuiz=()=>{
    const selectedTypes=new Set(VARIANT_CATS.filter(c=>variantCats.includes(c.id)).flatMap(c=>c.types));
    const pool=getPool(variantFilter).filter(w=>(w.variants||[]).some(v=>selectedTypes.has(v.type)));
    if(!pool.length){showToast("선택한 변형 유형의 단어가 없어요.","err");return;}
    // 모든 가능한 변형 form 목록 (객관식 보기용)
    const allForms=[...new Set(pool.flatMap(w=>(w.variants||[]).filter(v=>selectedTypes.has(v.type)).map(v=>v.form)))];
    const pairs=[];
    for(const w of pool){
      for(const v of (w.variants||[])){
        if(!selectedTypes.has(v.type)) continue;
        // 객관식 보기: 정답 + 다른 형태 3개
        const distractors=shuffle(allForms.filter(f=>f!==v.form)).slice(0,3);
        while(distractors.length<3) distractors.push("—");
        const choices=shuffle([v.form,...distractors]);
        pairs.push({wordId:w.id,base:w.hebrew,meaning:w.meaning,variantType:v.type,answer:v.form,choices});
      }
    }
    const count=Math.min(variantCount===9999?pairs.length:variantCount,pairs.length);
    const qs=shuffle(pairs).slice(0,count);
    setVariantQuestions(qs); setVariantCur(0); setVariantInput(""); setVariantConfirmed(false); setVariantResults([]);
    setVariantSelected(null);
    setMode(MODES.VARIANT); setAnimKey(k=>k+1);
  };

  const handleVariantConfirm=()=>{
    const q=variantQuestions[variantCur];
    if(variantQuizType==="mcq"){
      if(!variantSelected) return;
      const correct=variantSelected===q.answer;
      updateWordStats(q.wordId,correct);
      setVariantResults(r=>[...r,{...q,userInput:variantSelected,correct}]);
      setVariantConfirmed(true);
      speak(q.answer);
    } else {
      if(!variantInput.trim()) return;
      const correct=stripNikkud(variantInput.trim())===stripNikkud(q.answer)||variantInput.trim()===q.answer;
      updateWordStats(q.wordId,correct);
      setVariantResults(r=>[...r,{...q,userInput:variantInput,correct}]);
      setVariantConfirmed(true);
      speak(q.answer);
    }
  };
  const handleVariantNext=()=>{
    if(variantCur+1>=variantQuestions.length){setMode(MODES.VARIANT_RESULT);return;}
    setVariantCur(c=>c+1); setVariantInput(""); setVariantConfirmed(false); setVariantSelected(null);
    if(variantQuizType==="essay"&&variantInputRef.current) variantInputRef.current.focus();
  };

  // 문제 자동발음 — animKey가 바뀔 때(새 문제)만 1회 재생
  const spokenKey = useRef(-1);
  useEffect(()=>{
    if(mode!==MODES.QUIZ||soundMode!=="auto") return;
    const q=questions[current];
    if(!q||q.questionType!==QUIZ_TYPES.HEB_TO_MEAN) return;
    if(spokenKey.current===animKey) return; // 이미 재생함
    spokenKey.current=animKey;
    const t=setTimeout(()=>speak(q.question),500);
    return()=>clearTimeout(t);
  },[current,animKey,mode,soundMode]); // eslint-disable-line
  useEffect(()=>{ if(mode===MODES.ESSAY&&essayInputRef.current) essayInputRef.current.focus(); },[essayCurrent,mode]);

  const updateWordStats=(wordId,correct)=>{ setWords(ws=>ws.map(w=>{ if(w.id!==wordId) return w; const ns=correct?w.streak+1:0; const nw=correct?w.wrongCount:w.wrongCount+1; let st=w.status; if(correct&&ns>=3) st="mastered"; else if(!correct&&nw>=2) st="hard"; return{...w,streak:ns,wrongCount:nw,status:st}; })); };
  const setManualStatus=(id,status)=>{ setWords(ws=>ws.map(w=>w.id===id?{...w,status,streak:status==="mastered"?3:0,wrongCount:status==="hard"?2:0}:w)); };

  const exportWords=()=>{ const data={version:1,exportedAt:new Date().toISOString(),words}; const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`hebrew-vocab-${new Date().toISOString().slice(0,10)}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); showToast(`✅ ${words.length}개 단어를 내보냈어요!`); };
  const copyToClipboard=async()=>{ const text=JSON.stringify({version:1,exportedAt:new Date().toISOString(),words},null,2); try{await navigator.clipboard.writeText(text); showToast("📋 클립보드에 복사됐어요!");}catch{const ta=document.createElement("textarea"); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); showToast("📋 클립보드에 복사됐어요!");} };
  const importFromText=()=>{ try{ const parsed=JSON.parse(pasteText); const raw=Array.isArray(parsed)?parsed:(parsed.words||[]); const imported=raw.map(w=>({id:Date.now()+Math.random(),hebrew:(w.hebrew||"").trim(),meaning:(w.meaning||"").trim(),status:["learning","mastered","hard"].includes(w.status)?w.status:"learning",streak:w.streak||0,wrongCount:w.wrongCount||0})).filter(w=>w.hebrew&&w.meaning); if(!imported.length){showToast("불러올 단어가 없어요.","err");return;} setImportPreview({words:imported,fileName:"클립보드에서 붙여넣기"}); setShowPasteModal(false); setPasteText(""); }catch{showToast("올바른 형식이 아니에요.","err");} };
  const importFromBatchText=()=>{ const raw=batchTextRef.current?batchTextRef.current.value:""; const parsed=parseTextFormat(raw); if(!parsed.length){showToast("인식된 단어가 없어요. שלום=평화 형식으로 입력해주세요.","err");return;} setImportPreview({words:parsed.map(w=>({...w,id:Date.now()+Math.random(),status:"learning",streak:0,wrongCount:0})),fileName:`텍스트 형식 (${parsed.length}개)`}); setShowBatchModal(false); if(batchTextRef.current) batchTextRef.current.value=""; };
  const handleFileChange=(e)=>{ const file=e.target.files[0]; if(!file) return; const reader=new FileReader(); reader.onload=(ev)=>{ try{ const parsed=JSON.parse(ev.target.result); const raw=Array.isArray(parsed)?parsed:(parsed.words||[]); const imported=raw.map(w=>({id:Date.now()+Math.random(),hebrew:(w.hebrew||"").trim(),meaning:(w.meaning||"").trim(),status:["learning","mastered","hard"].includes(w.status)?w.status:"learning",streak:w.streak||0,wrongCount:w.wrongCount||0})).filter(w=>w.hebrew&&w.meaning); if(!imported.length){showToast("불러올 단어가 없어요.","err");return;} setImportPreview({words:imported,fileName:file.name}); }catch{showToast("파일을 읽을 수 없어요.","err");} }; reader.readAsText(file); e.target.value=""; };
  // ── 히브리어 동사변형 엑셀 양식 파싱 ──
  const parseVerbFormExcel=(rows)=>{
    // 양식 구조: 헤더 행들 + 데이터 행들 (빈 행 = 데이터 행)
    // B3: infinitive
    // B5/C5/D5/E5: pres_ms/pres_fs/pres_mp/pres_fp
    // B7/D7: past_1s/past_1p
    // B9/C9/D9/E9: past_2ms/past_2fs/past_2mp/past_2fp
    // B11/C11/D11/E11: past_3ms/past_3fs/past_3mp/past_3fp
    // B13/D13: fut_1s/fut_1p
    // B15/C15/D15/E15: fut_2ms/fut_2fs/fut_2mp/fut_2fp
    // B17/C17/D17/E17: fut_3ms/fut_3fs/fut_3mp/fut_3fp
    // B19~E22: imperative
    const r=(row,col)=>{ const ro=rows[row]; return ro&&ro[col]!=null&&String(ro[col]).trim()?String(ro[col]).trim():null; };
    const v={};
    // infinitive (row 2, col 1 = B3)
    if(r(2,1)) v['infinitive']=r(2,1);
    // present (row 4, cols 1-4 = B5-E5)
    if(r(4,1)) v['pres_ms']=r(4,1);
    if(r(4,2)) v['pres_fs']=r(4,2);
    if(r(4,3)) v['pres_mp']=r(4,3);
    if(r(4,4)) v['pres_fp']=r(4,4);
    // past 1st (row 6: B7/D7)
    if(r(6,1)) v['past_1s']=r(6,1);
    if(r(6,3)) v['past_1p']=r(6,3);
    // past 2nd (row 8: B9-E9)
    if(r(8,1)) v['past_2ms']=r(8,1);
    if(r(8,2)) v['past_2fs']=r(8,2);
    if(r(8,3)) v['past_2mp']=r(8,3);
    if(r(8,4)) v['past_2fp']=r(8,4);
    // past 3rd (row 10: B11-E11)
    if(r(10,1)) v['past_3ms']=r(10,1);
    if(r(10,2)) v['past_3fs']=r(10,2);
    if(r(10,3)) v['past_3mp']=r(10,3);
    if(r(10,4)) v['past_3fp']=r(10,4);
    // future 1st (row 12: B13/D13)
    if(r(12,1)) v['fut_1s']=r(12,1);
    if(r(12,3)) v['fut_1p']=r(12,3);
    // future 2nd (row 14: B15-E15)
    if(r(14,1)) v['fut_2ms']=r(14,1);
    if(r(14,2)) v['fut_2fs']=r(14,2);
    if(r(14,3)) v['fut_2mp']=r(14,3);
    if(r(14,4)) v['fut_2fp']=r(14,4);
    // future 3rd (row 16: B17-E17)
    if(r(16,1)) v['fut_3ms']=r(16,1);
    if(r(16,2)) v['fut_3fs']=r(16,2);
    if(r(16,3)) v['fut_3mp']=r(16,3);
    if(r(16,4)) v['fut_3fp']=r(16,4);
    // imperative — row 18 이후 빈 행들
    const impRows=[19,20,21,22];
    const impKeys=['imp_2ms','imp_2fs','imp_2mp','imp_2fp'];
    let impIdx=0;
    for(const ri of impRows){
      for(let ci=1;ci<=4&&impIdx<4;ci++){
        if(r(ri,ci)){ v[impKeys[impIdx]]=r(ri,ci); impIdx++; }
      }
    }
    return v;
  };

  const handleVerbFormExcel=(e)=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      try{
        const XLSX=window.XLSX;
        const wb=XLSX.read(ev.target.result,{type:'binary'});
        const ws=wb.Sheets[wb.SheetNames[0]];
        const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});
        const variants_obj=parseVerbFormExcel(rows);
        const variantCount=Object.keys(variants_obj).length;
        if(variantCount===0){showToast("변형 데이터가 없어요. 엑셀 양식을 확인해주세요.","err");return;}
        const infinitive=variants_obj['infinitive']||'';
        const variants=Object.entries(variants_obj).filter(([k,v])=>v&&k!=='infinitive').map(([type,form])=>({type,form}));
        // 미리보기로 표시
        setPealimPreview({infinitive, meaning:'', wordType:null, variants:variants_obj, variantCount, root:''});
        setShowPealimModal(true);
        showToast(`✅ ${variantCount}개 변형 불러옴! 뜻을 입력하고 추가해주세요.`);
      }catch(err){showToast("파일을 읽을 수 없어요: "+err.message,"err");}
    };
    reader.readAsBinaryString(file);
    e.target.value='';
  };

  const handleCSVChange=async(e)=>{
    const file=e.target.files[0]; if(!file) return;
    const isXlsx = /\.xlsx?$/i.test(file.name);
    if (isXlsx) {
      // xlsx 파일 — SheetJS로 파싱
      try {
        const XLSX = await getXLSX();
        const buf = await file.arrayBuffer();
        const wb  = XLSX.read(buf, { type: "array" });
        const ws  = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const parsed = rows
          .filter(r => r[0] && r[1])
          .map(r => ({ hebrew: String(r[0]).trim(), meaning: String(r[1]).trim() }))
          .filter(w => w.hebrew && w.meaning);
        if (!parsed.length) { showToast("인식된 단어가 없어요. A열: 히브리어, B열: 뜻 형식인지 확인해주세요.", "err"); return; }
        setImportPreview({ words: parsed.map(w=>({...w,id:Date.now()+Math.random(),status:"learning",streak:0,wrongCount:0})), fileName:`${file.name}` });
      } catch { showToast("엑셀 파일을 읽을 수 없어요.", "err"); }
    } else {
      // CSV / TSV / TXT 파일
      const reader = new FileReader();
      reader.onload = (ev) => {
        const parsed = parseCSV(ev.target.result);
        if (!parsed.length) { showToast("인식된 단어가 없어요. 첫째 열: 히브리어, 둘째 열: 뜻 형식인지 확인해주세요.", "err"); return; }
        setImportPreview({ words: parsed.map(w=>({...w,id:Date.now()+Math.random(),status:"learning",streak:0,wrongCount:0})), fileName:`${file.name}` });
      };
      reader.readAsText(file, "UTF-8");
    }
    e.target.value = "";
  };
  const confirmImport=(merge)=>{ if(!importPreview) return; if(merge){const ex=new Set(words.map(w=>w.hebrew)); const newOnes=importPreview.words.filter(w=>!ex.has(w.hebrew)); setWords(ws=>[...ws,...newOnes]); showToast(`📥 ${newOnes.length}개 추가! (중복 ${importPreview.words.length-newOnes.length}개 제외)`);}else{setWords(importPreview.words); showToast(`📥 ${importPreview.words.length}개 단어로 교체했어요!`);} setImportPreview(null); setListFilter("all"); };

  const getPool=(filter)=>{ const f=filter||quizFilter; if(f===QUIZ_FILTERS.LEARNING_ONLY) return words.filter(w=>w.status==="learning"); if(f===QUIZ_FILTERS.EXCLUDE_MASTERED) return words.filter(w=>w.status!=="mastered"); if(f===QUIZ_FILTERS.HARD_ONLY) return words.filter(w=>w.status==="hard"); return words; };
  const variantPoolSize=(()=>{
    const selectedTypes=new Set(VARIANT_CATS.filter(c=>variantCats.includes(c.id)).flatMap(c=>c.types));
    // 변형 있는 단어만 pool에서 필터
    const pool=getPool(variantFilter).filter(w=>(w.variants||[]).some(v=>selectedTypes.has(v.type)));
    const pairs=pool.flatMap(w=>(w.variants||[]).filter(v=>selectedTypes.has(v.type)));
    return pairs.length;
  })();
  // 어근별 퀴즈 시작
  const startRootQuiz=(root, type)=>{
    const rootWords = words.filter(w=>w.root===root);
    if(!rootWords.length) return;
    if(type==="mcq"){
      if(rootWords.length<2){showToast("객관식은 단어 2개 이상 필요해요","err");return;}
      const qs = rootWords.map(w=>generateQuestion(w, rootWords.length>=4?rootWords:words, quizType));
      setQuestions(qs); setCurrent(0); setSelected(null); setConfirmed(false); setScore(0); setWrongWords([]);
      setMode(MODES.QUIZ); setAnimKey(k=>k+1);
    } else if(type==="essay"){
      const qs = shuffle(rootWords).map(w=>({
        wordId:w.id, question:essayType==="heb_to_mean"?w.hebrew:w.meaning,
        answer:essayType==="heb_to_mean"?w.meaning:w.hebrew,
        hebrewWord:w.hebrew, questionType:essayType
      }));
      setEssayQuestions(qs); setEssayCurrent(0); setEssayInput(""); setEssayConfirmed(false); setEssayResults([]);
      setMode(MODES.ESSAY); setAnimKey(k=>k+1);
    } else if(type==="variant"){
      const selectedTypes=new Set(VARIANT_CATS.filter(c=>variantCats.includes(c.id)).flatMap(c=>c.types));
      const pairs=rootWords.flatMap(w=>(w.variants||[]).filter(v=>selectedTypes.has(v.type))
        .map(v=>({wordId:w.id,base:w.hebrew,meaning:w.meaning,variantType:v.type,answer:v.form})));
      if(!pairs.length){showToast("선택된 변형 유형의 데이터가 없어요","err");return;}
      setVariantQuestions(shuffle(pairs)); setVariantCur(0); setVariantInput(""); setVariantConfirmed(false); setVariantResults([]);
      setMode(MODES.VARIANT); setAnimKey(k=>k+1);
    }
    setRootGroupView(false);
  };

  const startQuiz=()=>{ const pool=getPool(); if(pool.length<4) return; const count=Math.min(quizCount===9999?pool.length:quizCount,pool.length); const qs=shuffle(pool).slice(0,count).map(w=>generateQuestion(w,words,quizType)); setQuestions(qs); setCurrent(0); setSelected(null); setConfirmed(false); setScore(0); setWrongWords([]); setMode(MODES.QUIZ); setAnimKey(k=>k+1); };
  const startEssay=()=>{
    const pool=getPool(essayFilter); if(!pool.length) return;
    const count=Math.min(essayCount===9999?pool.length:essayCount,pool.length);
    const qs=shuffle(pool).slice(0,count).map(w=>{
      let type=essayType;
      if(type==="mixed") type=Math.random()>0.5?"heb_to_mean":"mean_to_heb";
      return type==="heb_to_mean"
        ?{wordId:w.id,question:w.hebrew,answer:w.meaning,questionType:"heb_to_mean",hebrewWord:w.hebrew}
        :{wordId:w.id,question:w.meaning,answer:w.hebrew,questionType:"mean_to_heb",hebrewWord:w.hebrew};
    });
    setEssayQuestions(qs); setEssayCurrent(0); setEssayInput(""); setEssayConfirmed(false); setEssayResults([]); setMode(MODES.ESSAY); setAnimKey(k=>k+1);
  };
  const getEssayInputValue=()=>{
    const q=essayQuestions[essayCurrent];
    if(q?.questionType==="mean_to_heb") return essayHebrewRef.current?essayHebrewRef.current.value:"";
    return essayInput;
  };
  const handleEssayConfirm=()=>{
    const q=essayQuestions[essayCurrent];
    const inputVal=getEssayInputValue();
    if(!inputVal.trim()) return;
    // For mean_to_heb: compare after stripping nikkud
    const checkVal = q.questionType==="mean_to_heb" ? stripNikkud(inputVal) : inputVal;
    const checkAns = q.questionType==="mean_to_heb" ? stripNikkud(q.answer) : q.answer;
    const result=checkEssayAnswer(checkVal,checkAns);
    updateWordStats(q.wordId,result!=="wrong");
    setEssayResults(r=>[...r,{...q,userInput:inputVal,result}]);
    setEssayConfirmed(true);
    speak(q.hebrewWord||q.question);
  };
  const handleEssayNext=()=>{ if(essayCurrent+1>=essayQuestions.length){setMode(MODES.ESSAY_RESULT);return;} setEssayCurrent(c=>c+1); setEssayInput(""); setEssayConfirmed(false); setAnimKey(k=>k+1); if(essayHebrewRef.current) essayHebrewRef.current.value=""; };
  const handleSelect=choice=>{ if(!confirmed) setSelected(choice); };
  const handleConfirm=()=>{ if(!selected) return; const correct=selected===questions[current].answer; if(correct) setScore(s=>s+1); else setWrongWords(w=>[...w,questions[current]]); updateWordStats(questions[current].wordId,correct); setConfirmed(true); };  // eslint-disable-line
  const handleNext=()=>{ if(current+1>=questions.length){setMode(MODES.RESULT);return;} setCurrent(c=>c+1); setSelected(null); setConfirmed(false); setAnimKey(k=>k+1); };
  const addWord=()=>{
    if(!newHebrew.trim()||!newMeaning.trim()) return;
    if(editId!==null){
      setWords(ws=>ws.map(w=>w.id===editId?{...w,hebrew:newHebrew.trim(),meaning:newMeaning.trim(),...(newWordType?{wordType:newWordType}:{})}:w));
      setEditId(null);
    }else{
      const newId=Date.now();
      // 기본 단어장 제외 옵션이 아닐 때만 기본 단어장에 추가
      if(!newWordExcludeDefault){
        setWords(ws=>[{id:newId,hebrew:newHebrew.trim(),meaning:newMeaning.trim(),status:"learning",streak:0,wrongCount:0,...(newWordType?{wordType:newWordType}:{})}, ...ws]);
        setPage(0);
      }
      // 선택된 커스텀 단어장에 추가
      if(newWordWallets.size>0){
        saveWallets(wallets.map(wl=>newWordWallets.has(wl.id)?{...wl,wordIds:[...wl.wordIds,newId]}:wl));
        // 커스텀 단어장 전용이면 words에도 넣어야 함 (단어 데이터 보존)
        if(newWordExcludeDefault){
          setWords(ws=>[{id:newId,hebrew:newHebrew.trim(),meaning:newMeaning.trim(),status:"learning",streak:0,wrongCount:0,...(newWordType?{wordType:newWordType}:{})}, ...ws]);
        }
      }
      if(!newWordExcludeDefault||newWordWallets.size>0) setPage(0);
    }
    setNewHebrew(""); setNewMeaning(""); setNewWordType(null);
    // 커스텀 단어장 선택은 유지 (연속 추가 편의)
  };
  const deleteWord=id=>setWords(ws=>ws.filter(w=>w.id!==id));
  const startEdit=word=>{ setEditId(word.id); setNewHebrew(word.hebrew); setNewMeaning(word.meaning); setNewWordType(word.wordType||null); setOpenSections(s=>({...s,add:true})); window.scrollTo({top:0,behavior:'smooth'}); };
  const cancelEdit=()=>{ setEditId(null); setNewHebrew(""); setNewMeaning(""); setNewWordType(null); };

  const searchedWords = (()=>{
    let result = words.filter(w => {
      const matchFilter = listFilter === "all" || w.status === listFilter;
      if (!matchFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      // 히브리어, 뜻(영어/한국어) 모두 검색
      return w.hebrew.includes(searchQuery.trim())
        || w.meaning.toLowerCase().includes(q)
        || (w.hebrew && stripNikkud(w.hebrew).includes(searchQuery.trim()));
    });
    if(sortBy==="hebrew_asc") result=[...result].sort((a,b)=>a.hebrew.localeCompare(b.hebrew,'he'));
    else if(sortBy==="hebrew_desc") result=[...result].sort((a,b)=>b.hebrew.localeCompare(a.hebrew,'he'));
    else if(sortBy==="meaning_asc") result=[...result].sort((a,b)=>a.meaning.localeCompare(b.meaning));
    else if(sortBy==="meaning_desc") result=[...result].sort((a,b)=>b.meaning.localeCompare(a.meaning));
    else if(sortBy==="hard_first") result=[...result].sort((a,b)=>{const o={hard:0,learning:1,mastered:2};return(o[a.status]??1)-(o[b.status]??1);});
    else if(sortBy==="mastered_first") result=[...result].sort((a,b)=>{const o={mastered:0,learning:1,hard:2};return(o[a.status]??1)-(o[b.status]??1);});
    else if(sortBy==="wrong_desc") result=[...result].sort((a,b)=>(b.wrongCount||0)-(a.wrongCount||0));
    return result;
  })();
  const totalPages = Math.ceil(searchedWords.length / pageSize);
  const filteredWords = pageSize === 9999
    ? searchedWords
    : searchedWords.slice(page * pageSize, (page + 1) * pageSize);
  const q=questions[current]; const eq=essayQuestions[essayCurrent];
  const progress=questions.length>0?((current+(confirmed?1:0))/questions.length)*100:0;
  const essayProgress=essayQuestions.length>0?((essayCurrent+(essayConfirmed?1:0))/essayQuestions.length)*100:0;
  const poolSize=getPool().length; const essayPoolSize=getPool(essayFilter).length;
  const countOptions=[5,10,20,"전체"].map(v=>({label:v==="전체"?"전체":`${v}문제`,value:v==="전체"?9999:v}));
  const essayScore=essayResults.filter(r=>r.result==="exact").length;
  const essayPartial=essayResults.filter(r=>r.result==="partial").length;

  const Modal=({show,onClose,title,children})=>show?(<div style={S.modalOverlay}><div style={S.modal}><h3 style={S.modalTitle}>{title}</h3>{children}</div></div>):null;

  return (
    <div style={S.root}>
      <style>{`
  *{box-sizing:border-box;}
  body{margin:0;}
  input,button,textarea{-webkit-tap-highlight-color:transparent;font-family:Arial,'Noto Sans KR',sans-serif;}
  input:focus,textarea:focus{outline:none;border-color:rgba(196,160,80,0.6)!important;}
  button{line-height:1.3;word-break:keep-all;}
  span,div{word-break:break-word;}
  .emoji{font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif;display:inline-block;}
  @media(max-width:480px){
    .choices-grid{grid-template-columns:1fr!important;}
    .form-row{flex-direction:column!important;}
    .quiz-btn-row{flex-direction:column!important;}
    .result-btn-row{flex-direction:column!important;}
    .modal-btn-row{flex-direction:column!important;}
    .io-btns{flex-wrap:wrap!important;}
    .repeat-btn-row{flex-wrap:wrap!important;gap:4px!important;}
  }
`}</style>
      <div style={S.bgDeco1}/><div style={S.bgDeco2}/>
      {toast&&<div style={{...S.toast,...(toast.type==="err"?S.toastErr:{})}}>{toast.msg}</div>}

      <Modal show={showPasteModal} onClose={()=>setShowPasteModal(false)} title="📋 텍스트로 불러오기">
        <p style={S.modalSub}>📋 복사로 저장한 JSON 텍스트를 붙여넣어주세요</p>
        <textarea style={S.modalTA} placeholder='{"version":1,"words":[...]}' value={pasteText} onChange={e=>setPasteText(e.target.value)}/>
        <div className="modal-btn-row" style={S.modalBtnRow}>
          <button style={S.btnMerge} onClick={importFromText}>✅ 불러오기</button>
          <button style={S.btnCancel2} onClick={()=>{setShowPasteModal(false);setPasteText("");}}>취소</button>
        </div>
      </Modal>

      {/* Pealim 동사 변형 가져오기 모달 */}
      {/* ── 단어장 선택 팝업 (여러 지갑 중 선택) ── */}
      {walletPickWord&&(
        <div style={{...S.modalOverlay,zIndex:9999}} onClick={()=>setWalletPickWord(null)}>
          <div style={{...S.modal,maxWidth:"320px",padding:"16px"}} onClick={e=>e.stopPropagation()}>
            <h3 style={{...S.modalTitle,marginBottom:"12px"}}>📚 단어장 선택</h3>
            <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
              {wallets.map(wl=>{
                const inWallet=wl.wordIds.includes(walletPickWord);
                return(
                  <button key={wl.id} onClick={()=>{toggleWordInWallet(wl.id,walletPickWord);setWalletPickWord(null);}}
                    style={{display:"flex",alignItems:"center",gap:"10px",padding:"10px 14px",borderRadius:"10px",
                      background:inWallet?"rgba(196,160,80,0.15)":"rgba(255,255,255,0.04)",
                      border:`1px solid ${inWallet?"rgba(196,160,80,0.4)":wl.color+"30"}`,cursor:"pointer",textAlign:"left"}}>
                    <div style={{width:"12px",height:"12px",borderRadius:"50%",background:wl.color,flexShrink:0}}/>
                    <span style={{color:"#e8e6f0",flex:1}}>{wl.name}</span>
                    <span style={{fontSize:"0.75rem",color:"#5a5870"}}>{words.filter(w=>wl.wordIds.includes(w.id)).length}개</span>
                    {inWallet&&<span style={{fontSize:"0.72rem",color:"#c4a050"}}>✓ 담김</span>}
                  </button>
                );
              })}
            </div>
            <button style={{...S.btnCancel2,width:"100%",marginTop:"10px"}} onClick={()=>setWalletPickWord(null)}>취소</button>
          </div>
        </div>
      )}

      {/* ── 단어 지갑 모달 ── */}
      {showWalletModal&&(
        <div style={S.modalOverlay} onClick={()=>setShowWalletModal(false)}>
          <div style={{...S.modal,maxWidth:"480px",maxHeight:"80vh",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
            <h3 style={S.modalTitle}>📚 커스텀 단어장</h3>
            <p style={S.modalSub}>단어를 직접 분류해서 저장하세요. 지갑별로 단어를 모아보고 퀴즈도 볼 수 있어요.</p>

            {/* 지갑 보기 모드 */}
            {walletView!==null?(()=>{
              const wl=wallets.find(w=>w.id===walletView);
              if(!wl) return null;
              const wlWords=getWalletWords(walletView);
              return(
                <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"12px"}}>
                    <button onClick={()=>setWalletView(null)} style={{...S.scrollBtn,padding:"4px 10px",fontSize:"0.78rem"}}>← 목록</button>
                    <span style={{fontWeight:700,color:wl.color,fontSize:"1rem"}}>{wl.name}</span>
                    <span style={{fontSize:"0.75rem",color:"#5a5870"}}>{wlWords.length}개 단어</span>
                  </div>
                  {wlWords.length>0?(
                    <>
                      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:"4px",marginBottom:"10px"}}>
                        {wlWords.map(w=>(
                          <div key={w.id} style={{display:"flex",alignItems:"center",gap:"8px",padding:"7px 10px",borderRadius:"8px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)"}}>
                            <span style={{fontFamily:"Arial",direction:"rtl",color:"#c4a050",fontSize:"1rem",minWidth:"80px"}}>{w.hebrew}</span>
                            <span style={{color:"#7a7890",fontSize:"0.82rem",flex:1}}>{w.meaning}</span>
                            <button onClick={()=>toggleWordInWallet(wl.id,w.id)}
                              style={{padding:"3px 8px",borderRadius:"6px",background:"rgba(200,60,60,0.1)",border:"1px solid rgba(200,60,60,0.3)",color:"#f07050",cursor:"pointer",fontSize:"0.72rem"}}>제거</button>
                          </div>
                        ))}
                      </div>
                      {/* 퀴즈 시작 */}
                      <div style={{display:"flex",gap:"6px"}}>
                        <button onClick={()=>{
                          if(wlWords.length<4){showToast("객관식은 4개 이상 필요해요","err");return;}
                          const qs=wlWords.map(w=>generateQuestion(w,wlWords.length>=4?wlWords:words,quizType));
                          setQuestions(qs);setCurrent(0);setSelected(null);setConfirmed(false);setScore(0);setWrongWords([]);
                          setMode(MODES.QUIZ);setAnimKey(k=>k+1);setShowWalletModal(false);
                        }} style={{flex:1,padding:"8px",borderRadius:"9px",background:"linear-gradient(135deg,#c4a050,#e8c875)",border:"none",color:"#1a1820",fontWeight:700,cursor:"pointer",fontSize:"0.82rem"}}>
                          🎯 객관식 퀴즈
                        </button>
                        <button onClick={()=>{
                          const qs=wlWords.map(w=>({wordId:w.id,question:w.hebrew,answer:w.meaning,hebrewWord:w.hebrew,questionType:"heb_to_mean"}));
                          setEssayQuestions(qs);setEssayCurrent(0);setEssayInput("");setEssayConfirmed(false);setEssayResults([]);
                          setMode(MODES.ESSAY);setAnimKey(k=>k+1);setShowWalletModal(false);
                        }} style={{flex:1,padding:"8px",borderRadius:"9px",background:"rgba(100,80,200,0.2)",border:"1px solid rgba(100,80,200,0.4)",color:"#c0b0ff",fontWeight:700,cursor:"pointer",fontSize:"0.82rem"}}>
                          ✍️ 서술형 퀴즈
                        </button>
                      </div>
                    </>
                  ):(
                    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#5a5870",gap:"8px"}}>
                      <div style={{fontSize:"2rem"}}>👜</div>
                      <div style={{fontSize:"0.85rem"}}>단어장에서 📚 버튼을 눌러 단어를 추가하세요</div>
                    </div>
                  )}
                </div>
              );
            })():(
              <>
                {/* 새 지갑 만들기 */}
                <div style={{display:"flex",gap:"8px",marginBottom:"12px",alignItems:"center"}}>
                  <input value={walletName} onChange={e=>setWalletName(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&createWallet()}
                    style={{...S.input,flex:1,padding:"8px 12px"}} placeholder="단어장 이름 입력..."/>
                  {/* 색상 선택 */}
                  <div style={{display:"flex",gap:"4px"}}>
                    {["#c4a050","#50c898","#9060f0","#f07050","#60a0e0","#e06080"].map(c=>(
                      <button key={c} onClick={()=>setWalletColor(c)}
                        style={{width:"20px",height:"20px",borderRadius:"50%",background:c,border:walletColor===c?"2px solid #fff":"2px solid transparent",cursor:"pointer",flexShrink:0}}/>
                    ))}
                  </div>
                  <button onClick={createWallet} disabled={!walletName.trim()}
                    style={{...S.btnAdd,padding:"8px 14px",opacity:walletName.trim()?1:0.5}}>만들기</button>
                </div>

                {/* 지갑 목록 */}
                {wallets.length===0?(
                  <div style={{textAlign:"center",color:"#5a5870",padding:"30px 0",fontSize:"0.85rem"}}>
                    아직 단어장이 없어요. 새 단어장을 만들어보세요!
                  </div>
                ):(
                  <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:"6px"}}>
                    {wallets.map(wl=>{
                      const cnt=words.filter(w=>wl.wordIds.includes(w.id)).length;
                      return(
                        <div key={wl.id} style={{display:"flex",alignItems:"center",gap:"8px",padding:"10px 12px",borderRadius:"10px",
                          background:"rgba(255,255,255,0.04)",border:`1px solid ${wl.color}30`}}>
                          <div style={{width:"12px",height:"12px",borderRadius:"50%",background:wl.color,flexShrink:0}}/>
                          <button onClick={()=>setWalletView(wl.id)}
                            style={{flex:1,background:"none",border:"none",color:"#e8e6f0",cursor:"pointer",textAlign:"left",fontSize:"0.9rem",fontWeight:600}}>
                            {wl.name}
                          </button>
                          <span style={{fontSize:"0.75rem",color:"#5a5870"}}>{cnt}개</span>
                          <button onClick={()=>setWalletView(wl.id)}
                            style={{padding:"3px 8px",borderRadius:"6px",background:`${wl.color}20`,border:`1px solid ${wl.color}40`,color:wl.color,cursor:"pointer",fontSize:"0.72rem"}}>보기</button>
                          <button onClick={()=>deleteWallet(wl.id)}
                            style={{padding:"3px 8px",borderRadius:"6px",background:"rgba(200,60,60,0.1)",border:"1px solid rgba(200,60,60,0.3)",color:"#f07050",cursor:"pointer",fontSize:"0.72rem"}}>삭제</button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 단어장에서 단어장에 추가 안내 */}
                {words.length>0&&wallets.length>0&&(
                  <div style={{marginTop:"10px",padding:"8px 12px",borderRadius:"8px",background:"rgba(196,160,80,0.06)",border:"1px solid rgba(196,160,80,0.15)",fontSize:"0.75rem",color:"#7a7890"}}>
                    💡 단어 추가 시 단어장을 선택하거나, 각 단어의 📚 버튼을 클릭해서 추가할 수 있어요
                  </div>
                )}
              </>
            )}

            <div style={{marginTop:"12px"}}>
              <button style={S.btnCancel2} onClick={()=>{setShowWalletModal(false);setWalletView(null);}}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 뜻으로 히브리어 검색 모달 ── */}
      {showWordSearchModal&&(
        <div style={S.modalOverlay} onClick={()=>setShowWordSearchModal(false)}>
          <div style={{...S.modal,maxWidth:"480px"}} onClick={e=>e.stopPropagation()}>
            <h3 style={S.modalTitle}>🔎 {currentBook==="hebrew"?"뜻으로 히브리어 검색":currentBook==="english"?"한국어로 영어 찾기":"영어/히브리어로 한국어 찾기"}</h3>
            <p style={S.modalSub}>{
              currentBook==="hebrew"?"한국어 또는 영어로 입력하면 히브리어 단어를 찾아줘요. 한국어는 자동 번역돼요. 예: 사랑, love":
              currentBook==="english"?"한국어를 입력하면 영어로 번역해줘요. 예: 사과, 감사합니다":
              "영어 또는 히브리어를 입력하면 한국어 뜻을 찾아줘요. 예: love, שלום"
            }</p>
            <div style={{display:"flex",gap:"8px",marginBottom:"10px"}}>
              <input style={{...S.input,flex:1}}
                placeholder={currentBook==="hebrew"?"사랑, love, apple...":currentBook==="english"?"한국어 입력 (예: 사과, 감사)":"영어 또는 히브리어 입력"}
                value={wordSearchInput}
                onChange={e=>setWordSearchInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&searchWordByMeaning()}/>
              <button onClick={searchWordByMeaning} disabled={wordSearchLoading}
                style={{...S.btnAdd,minWidth:"64px",opacity:wordSearchLoading?0.6:1}}>
                {wordSearchLoading?"...":"검색"}
              </button>
            </div>
            {wordSearchError&&<div style={{color:"#f07050",fontSize:"0.82rem",marginBottom:"8px",padding:"8px",background:"rgba(200,60,60,0.1)",borderRadius:"8px"}}>{wordSearchError}</div>}
            {wordSearchResults.length>0&&(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                  <span style={{fontSize:"0.78rem",color:"#7a7890"}}>{wordSearchResults.length}개 결과</span>
                  <div style={{display:"flex",gap:"6px"}}>
                    <button onClick={()=>setWordSearchSelected(s=>s.size===wordSearchResults.length?new Set():new Set(wordSearchResults.map((_,i)=>i)))}
                      style={{...S.scrollBtn,fontSize:"0.72rem",padding:"3px 8px"}}>
                      {wordSearchSelected.size===wordSearchResults.length?"전체 해제":"전체 선택"}
                    </button>
                    {wordSearchSelected.size>0&&<button onClick={addSelectedWordSearchResults}
                      style={{padding:"5px 12px",borderRadius:"8px",background:"linear-gradient(135deg,#c4a050,#e8c875)",border:"none",color:"#1a1820",fontWeight:700,cursor:"pointer",fontSize:"0.8rem"}}>
                      ✅ {wordSearchSelected.size}개 추가
                    </button>}
                  </div>
                </div>
                <div style={{maxHeight:"340px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"5px"}}>
                  {wordSearchResults.map((r,i)=>{
                    const sel=wordSearchSelected.has(i);
                    const isTranslation=r.pos==="translation";
                    const exists=!isTranslation&&!!words.find(w=>stripNikkud(w.hebrew||"")===stripNikkud(r.hebrew||"")&&w.meaning===r.meaning);
                    const posColors={verb:"#60c880",noun:"#c4a050",adj:"#f09050"};
                    const posLabels={verb:"동사",noun:"명사",adj:"형용사"};
                    return(
                      <div key={i} onClick={()=>{if(exists)return;setWordSearchSelected(s=>{const n=new Set(s);n.has(i)?n.delete(i):n.add(i);return n;});}}
                        style={{display:"flex",gap:"8px",alignItems:"center",padding:"10px 12px",borderRadius:"10px",
                          background:sel?"rgba(196,160,80,0.1)":isTranslation?"rgba(100,80,200,0.06)":"rgba(255,255,255,0.03)",
                          border:`1px solid ${sel?"rgba(196,160,80,0.4)":isTranslation?"rgba(100,80,200,0.25)":exists?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.08)"}`,
                          cursor:exists?"default":"pointer",opacity:exists?0.5:1}}>
                        <div style={{width:"16px",height:"16px",borderRadius:"4px",flexShrink:0,
                          border:`2px solid ${sel?"#c4a050":"rgba(255,255,255,0.2)"}`,
                          background:sel?"#c4a050":"transparent",
                          display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {sel&&<span style={{color:"#1a1820",fontSize:"0.65rem",fontWeight:700}}>✓</span>}
                        </div>
                        {isTranslation?(
                          <div style={{flex:1}}>
                            {r.note&&<div style={{fontSize:"0.65rem",color:"#7a7890",marginBottom:"2px"}}>{r.note}</div>}
                            <span style={{fontSize:"1.1rem",color:"#c4a050",fontWeight:600}}>{r.meaning}</span>
                            {r.hebrew&&<span style={{fontFamily:"Arial",direction:"rtl",fontSize:"0.9rem",color:"#a0a0c0",marginLeft:"8px"}}>{r.hebrew}</span>}
                          </div>
                        ):(
                          <>
                            {r.pos&&<span style={{fontSize:"0.62rem",padding:"1px 6px",borderRadius:"4px",flexShrink:0,
                              background:`rgba(${r.pos==="verb"?"96,200,128":r.pos==="noun"?"196,160,80":"240,144,80"},0.15)`,
                              color:posColors[r.pos]||"#a0a0c0"}}>{posLabels[r.pos]||r.pos}</span>}
                            <span style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.05rem",color:"#c4a050",minWidth:"80px"}}>{r.hebrew}</span>
                            <span style={{fontSize:"0.82rem",color:"#a0a0c0",flex:1}}>{r.meaning}</span>
                          </>
                        )}
                        {exists&&<span style={{fontSize:"0.65rem",color:"#50c898",flexShrink:0}}>✓ 있음</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{marginTop:"14px"}}>
              <button style={S.btnCancel2} onClick={()=>{setShowWordSearchModal(false);setWordSearchResults([]);setWordSearchInput("");setWordSearchError("");}}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 어근 단어 검색 모달 ── */}
      {showRootModal&&(
        <div style={S.modalOverlay} onClick={()=>setShowRootModal(false)}>
          <div style={{...S.modal,maxWidth:"480px"}} onClick={e=>e.stopPropagation()}>
            <h3 style={S.modalTitle}>🌿 어근으로 단어 검색 (Pealim)</h3>
            <p style={S.modalSub}>히브리어 어근을 입력하면 파생된 동사·명사·형용사를 모두 가져와요. 예: ד-ב-ר, כ-ת-ב</p>

            {/* 어근 입력 */}
            <div style={{display:"flex",gap:"8px",marginBottom:"10px"}}>
              <input style={{...S.input,flex:1,direction:"rtl",fontFamily:"Arial",fontSize:"1.1rem"}}
                placeholder="ד-ב-ר"
                value={rootSearchInput}
                onChange={e=>setRootSearchInput(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&searchByRoot()}/>
              <button onClick={searchByRoot} disabled={rootSearchLoading}
                style={{...S.btnAdd,minWidth:"64px",opacity:rootSearchLoading?0.6:1}}>
                {rootSearchLoading?"...":"검색"}
              </button>
            </div>

            {rootSearchError&&<div style={{color:"#f07050",fontSize:"0.82rem",marginBottom:"8px",padding:"8px",background:"rgba(200,60,60,0.1)",borderRadius:"8px"}}>{rootSearchError}</div>}

            {/* 검색 결과 */}
            {rootSearchResults.length>0&&(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px",flexWrap:"wrap",gap:"6px"}}>
                  <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
                    <span style={{fontSize:"0.78rem",color:"#7a7890"}}>{rootSearchResults.length}개 결과</span>
                    <button onClick={()=>setRootSelected(s=>s.size===rootSearchResults.length?new Set():new Set(rootSearchResults.map((_,i)=>i)))}
                      style={{...S.scrollBtn,fontSize:"0.72rem",padding:"3px 8px"}}>
                      {rootSelected.size===rootSearchResults.length?"전체 해제":"전체 선택"}
                    </button>
                  </div>
                  {rootSelected.size>0&&(
                    <button onClick={addSelectedRootWords}
                      style={{padding:"7px 14px",borderRadius:"9px",background:"linear-gradient(135deg,#c4a050,#e8c875)",border:"none",color:"#1a1820",fontWeight:700,cursor:"pointer",fontSize:"0.82rem"}}>
                      ✅ {rootSelected.size}개 단어장에 추가
                    </button>
                  )}
                </div>

                <div style={{display:"flex",flexDirection:"column",gap:"5px",maxHeight:"320px",overflowY:"auto"}}>
                  {rootSearchResults.map((r,i)=>{
                    const isSelected=rootSelected.has(i);
                    const alreadyAdded=!!words.find(w=>stripNikkud(w.hebrew)===stripNikkud(r.hebrew));
                    const posColors={verb:"#60c880",noun:"#c4a050",adj:"#f09050",other:"#a0a0c0"};
                    const posLabels={verb:"동사",noun:"명사",adj:"형용사",other:"기타"};
                    return(
                      <div key={i} onClick={()=>{if(alreadyAdded)return; setRootSelected(s=>{const n=new Set(s);n.has(i)?n.delete(i):n.add(i);return n;});}}
                        style={{display:"flex",gap:"8px",alignItems:"center",padding:"8px 12px",borderRadius:"10px",
                          background:isSelected?"rgba(196,160,80,0.1)":"rgba(255,255,255,0.03)",
                          border:`1px solid ${isSelected?"rgba(196,160,80,0.4)":alreadyAdded?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.08)"}`,
                          cursor:alreadyAdded?"default":"pointer",opacity:alreadyAdded?0.5:1}}>
                        {/* 체크박스 */}
                        <div style={{width:"16px",height:"16px",borderRadius:"4px",flexShrink:0,
                          border:`2px solid ${isSelected?"#c4a050":"rgba(255,255,255,0.2)"}`,
                          background:isSelected?"#c4a050":"transparent",
                          display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {isSelected&&<span style={{color:"#1a1820",fontSize:"0.65rem",fontWeight:700}}>✓</span>}
                        </div>
                        {/* 품사 태그 */}
                        {r.pos&&<span style={{fontSize:"0.62rem",padding:"1px 6px",borderRadius:"4px",flexShrink:0,
                          background:`rgba(${r.pos==="verb"?"96,200,128":r.pos==="noun"?"196,160,80":r.pos==="adj"?"240,144,80":"160,160,192"},0.15)`,
                          color:posColors[r.pos]||"#a0a0c0"}}>
                          {posLabels[r.pos]||r.pos}
                        </span>}
                        {/* 히브리어 */}
                        <span style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.05rem",color:"#c4a050",minWidth:"70px"}}>{r.hebrew}</span>
                        {/* 뜻 */}
                        <span style={{fontSize:"0.78rem",color:"#7a7890",flex:1}}>{r.meaning||""}</span>
                        {alreadyAdded&&<span style={{fontSize:"0.65rem",color:"#50c898",flexShrink:0}}>✓ 있음</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{marginTop:"14px"}}>
              <button style={S.btnCancel2} onClick={()=>{setShowRootModal(false);setRootSearchResults([]);setRootSearchInput("");setRootSearchError("");}}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {showPealimModal&&(
        <div style={S.modalOverlay}>
          <div style={{...S.modal,maxWidth:"500px",maxHeight:"88vh",overflowY:"auto"}}>
            <h3 style={S.modalTitle}>🔍 Reverso 동사 변형 불러오기</h3>
            <p style={S.modalSub}>히브리어 동사 원형(to부정사)을 입력하면 변형표를 자동으로 가져와요. 예: לָשִׁיר, לְדַבֵּר, לֶאֱכֹל</p>

            {/* 어근 입력 */}
            <div style={{display:"flex",gap:"8px",marginBottom:"12px"}}>
              <input
                style={{...S.input,flex:1,direction:"rtl",fontFamily:"Arial",fontSize:"1.1rem"}}
                placeholder="לָשִׁיר, לְדַבֵּר, לֶאֱכֹל ..."
                value={pealimRoot}
                onChange={e=>setPealimRoot(e.target.value)}
                onKeyDown={e=>e.key==="Enter"&&searchPealim()}
                lang="he" spellCheck={false} autoCorrect="off"
              />
              <button
                id="pealim-search-btn"
                onClick={searchPealim}
                disabled={pealimLoading}
                style={{padding:"10px 16px",borderRadius:"10px",background:"linear-gradient(135deg,#c4a050,#e8c875)",border:"none",color:"#1a1820",fontWeight:700,cursor:"pointer",opacity:pealimLoading?0.6:1}}>
                {pealimLoading?"검색 중...":"검색"}
              </button>
            </div>

            {/* 입력 예시 */}
            <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"12px"}}>
              {[["לְדַבֵּר","말하다"],["לָלֶכֶת","가다"],["לֶאֱכֹל","먹다"],["לִכְתּוֹב","쓰다"],["לִרְאוֹת","보다"],["לָשִׁיר","노래하다"],["לֶאֱהֹב","사랑하다"]].map(([verb,hint])=>(
                <button key={verb} onClick={()=>{setPealimRoot(verb);}}
                  style={{padding:"4px 10px",borderRadius:"6px",background:"rgba(196,160,80,0.1)",border:"1px solid rgba(196,160,80,0.3)",color:"#c4a050",fontSize:"0.78rem",cursor:"pointer",fontFamily:"Arial",direction:"rtl"}}>
                  {verb} <span style={{color:"#5a5870",direction:"ltr"}}>{hint}</span>
                </button>
              ))}
            </div>

            {/* 에러 */}
            {pealimError&&<div style={{padding:"10px",background:"rgba(200,60,60,0.15)",border:"1px solid rgba(200,60,60,0.3)",borderRadius:"8px",color:"#f08080",fontSize:"0.85rem",marginBottom:"10px"}}>{pealimError}</div>}

            {/* 검색 결과 목록 */}
            {pealimResults.length>0&&!pealimPreview&&(
              <div>
                {/* 상단 툴바 */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px",flexWrap:"wrap",gap:"6px"}}>
                  <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
                    <span style={{fontSize:"0.78rem",color:"#7a7890"}}>{pealimResults.length}개 결과</span>
                    <button onClick={()=>setPealimSelected(s=>s.size===pealimResults.length?new Set():new Set(pealimResults.map((_,i)=>i)))}
                      style={{...S.scrollBtn,fontSize:"0.72rem",padding:"3px 8px"}}>
                      {pealimSelected.size===pealimResults.length?"전체 해제":"전체 선택"}
                    </button>
                  </div>
                  {pealimSelected.size>0&&(
                    <button onClick={addSelectedPealimWords} disabled={pealimLoading}
                      style={{padding:"7px 14px",borderRadius:"9px",background:"linear-gradient(135deg,#50c898,#70e8b8)",border:"none",color:"#0f1a14",fontWeight:700,cursor:"pointer",fontSize:"0.82rem",opacity:pealimLoading?0.6:1}}>
                      {pealimLoading?"불러오는 중...":` ✅ ${pealimSelected.size}개 단어장에 추가`}
                    </button>
                  )}
                </div>
                {pealimSelected.size>0&&(
                  <div style={{fontSize:"0.72rem",color:"#50c898",marginBottom:"8px",padding:"6px 10px",background:"rgba(80,160,120,0.08)",borderRadius:"6px"}}>
                    뜻과 변형을 자동으로 불러와서 저장해요 (시간이 조금 걸릴 수 있어요)
                  </div>
                )}
                {/* 결과 목록 */}
                <div style={{display:"flex",flexDirection:"column",gap:"5px",maxHeight:"280px",overflowY:"auto"}}>
                  {pealimResults.map((r,i)=>{
                    const isSelected=pealimSelected.has(i);
                    const alreadyAdded=!!words.find(w=>stripNikkud(w.hebrew)===stripNikkud(r.hebrew));
                    return(
                      <div key={i} style={{display:"flex",gap:"8px",alignItems:"center",padding:"8px 12px",borderRadius:"10px",
                        background:isSelected?"rgba(80,160,120,0.12)":"rgba(255,255,255,0.03)",
                        border:`1px solid ${isSelected?"rgba(80,160,120,0.4)":alreadyAdded?"rgba(196,160,80,0.2)":"rgba(255,255,255,0.08)"}`,
                        cursor:alreadyAdded?"default":"pointer",
                        opacity:alreadyAdded?0.5:1}}
                        onClick={()=>{
                          if(alreadyAdded) return;
                          setPealimSelected(s=>{const n=new Set(s); n.has(i)?n.delete(i):n.add(i); return n;});
                        }}>
                        {/* 체크박스 */}
                        <div style={{width:"18px",height:"18px",borderRadius:"4px",border:`2px solid ${isSelected?"#50c898":"rgba(255,255,255,0.2)"}`,
                          background:isSelected?"#50c898":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {isSelected&&<span style={{color:"#0f1a14",fontSize:"0.7rem",fontWeight:700}}>✓</span>}
                        </div>
                        {/* 히브리어 */}
                        <span style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.1rem",color:"#c4a050",minWidth:"80px"}}>{r.hebrew}</span>
                        {/* 뜻 (있으면 표시) */}
                        <span style={{fontSize:"0.8rem",color:"#7a7890",flex:1}}>{r.meaning||r.url.replace("https://www.pealim.com","")}</span>
                        {/* 이미 추가됨 */}
                        {alreadyAdded&&<span style={{fontSize:"0.68rem",color:"#c4a050",flexShrink:0}}>✓ 추가됨</span>}
                        {/* 변형만 보기 버튼 */}
                        {!alreadyAdded&&<button onClick={e=>{e.stopPropagation();fetchPealimConjugation(r.url,pealimRoot);}}
                          style={{padding:"4px 8px",borderRadius:"6px",background:"rgba(80,160,120,0.15)",border:"1px solid rgba(80,160,120,0.3)",color:"#50c898",cursor:"pointer",fontSize:"0.68rem",flexShrink:0}}
                          title="변형 미리보기">
                          미리보기
                        </button>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 변형 미리보기 */}
            {pealimPreview&&(
              <div>
                {/* 미리보기 */}
                <div style={{background:"rgba(80,160,120,0.08)",border:"1px solid rgba(80,160,120,0.2)",borderRadius:"10px",padding:"14px",marginBottom:"12px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px",flexWrap:"wrap"}}>
                    <span style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.5rem",color:"#50c898"}}>{pealimPreview.infinitive}</span>
                    <span style={{fontSize:"0.72rem",background:"rgba(80,160,120,0.2)",padding:"3px 10px",borderRadius:"6px",color:"#50c898",fontWeight:600}}>
                      {Object.keys(pealimPreview.variants||{}).length}개 변형
                    </span>
                  </div>
                  {/* 뜻 — 항상 수정 가능 */}
                  <input value={pealimPreview.meaning||""}
                    onChange={e=>setPealimPreview(p=>({...p,meaning:e.target.value}))}
                    style={{...S.input,padding:"7px 12px",fontSize:"0.9rem",marginBottom:"10px"}}
                    placeholder="뜻 입력 (한국어/영어) *필수"/>
                  {/* 품사 선택 (선택사항) */}
                  <div style={{marginBottom:"8px"}}>
                    <div style={{fontSize:"0.72rem",color:"#7a7890",marginBottom:"5px"}}>품사 선택 <span style={{color:"#5a5870"}}>(선택사항)</span></div>
                    <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                      {/* 선택 안함 버튼 */}
                      <button onClick={()=>setPealimPreview(p=>({...p,wordType:null}))}
                        style={{padding:"4px 10px",borderRadius:"7px",fontSize:"0.75rem",cursor:"pointer",border:"1px solid",
                          background:!pealimPreview.wordType?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.04)",
                          borderColor:!pealimPreview.wordType?"rgba(255,255,255,0.3)":"rgba(255,255,255,0.1)",
                          color:!pealimPreview.wordType?"#e8e6f0":"#5a5870"}}>
                        ⚪ 선택 안함
                      </button>
                      {WORD_TYPES.map(wt=>(
                        <button key={wt.id}
                          onClick={()=>setPealimPreview(p=>({...p,wordType:p.wordType===wt.id?null:wt.id}))}
                          style={{padding:"4px 10px",borderRadius:"7px",fontSize:"0.75rem",cursor:"pointer",border:"1px solid",
                            background:pealimPreview.wordType===wt.id?"rgba(196,160,80,0.2)":"rgba(255,255,255,0.04)",
                            borderColor:pealimPreview.wordType===wt.id?"rgba(196,160,80,0.5)":"rgba(255,255,255,0.1)",
                            color:pealimPreview.wordType===wt.id?"#c4a050":"#5a5870"}}>
                          {wt.emoji} {wt.label.ko}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* 변형 목록 — 카테고리별 그룹 */}
                  <div style={{maxHeight:"260px",overflowY:"auto"}}>
                    {VARIANT_CATS.map(cat=>{
                      const catVariants=cat.types.filter(tid=>(pealimPreview.variants||{})[tid]);
                      if(!catVariants.length) return null;
                      return(
                        <div key={cat.id} style={{marginBottom:"8px"}}>
                          <div style={{fontSize:"0.68rem",fontWeight:700,color:cat.color,marginBottom:"4px",
                            textTransform:"uppercase",letterSpacing:"0.6px",borderBottom:`1px solid ${cat.color}30`,paddingBottom:"2px"}}>
                            {cat.label.ko}
                          </div>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"3px"}}>
                            {catVariants.map(tid=>{
                              const vt=VARIANT_TYPES.find(t=>t.id===tid);
                              const form=(pealimPreview.variants||{})[tid];
                              // 히브리어 글자 수에 따라 폰트 크기 자동 조절
                              const formLen = (form||'').length;
                              const fontSize = formLen>8?"0.72rem":formLen>6?"0.82rem":"0.95rem";
                              return(
                                <div key={tid} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                                  padding:"4px 6px",background:"rgba(255,255,255,0.03)",borderRadius:"5px",gap:"4px",minWidth:0,overflow:"hidden"}}>
                                  <span style={{color:"#7a7890",fontSize:"0.6rem",flexShrink:1,lineHeight:1.2,minWidth:0,
                                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                    {vt?(()=>{
                                      const lbl=vt.label.ko;
                                      const m=lbl.match(/^(.*?)(\s*\([א-תְ-ׇ\/\s]+\))$/);
                                      if(m) return <>{m[1]}<span style={{fontFamily:"Arial",direction:"rtl",whiteSpace:"nowrap"}}>{m[2]}</span></>;
                                      return lbl;
                                    })():tid}
                                  </span>
                                  <span style={{fontFamily:"Arial",direction:"rtl",color:"#e8e6f0",fontSize,
                                    flexShrink:0,whiteSpace:"nowrap",textAlign:"right",marginLeft:"4px"}}>
                                    {form}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* 저장 버튼 */}
                <button onClick={addNewWordFromPealim}
                  style={{...S.btnMerge,width:"100%",background:"linear-gradient(135deg,#50c898,#70e8b8)",color:"#0f1a14",padding:"13px",fontSize:"1rem"}}>
                  ✅ 단어장에 추가
                </button>
                <button onClick={()=>setPealimPreview(null)} style={{...S.btnCancel2,width:"100%",marginTop:"8px",textAlign:"center"}}>← 다시 검색</button>
              </div>
            )}

            <div style={{display:"flex",gap:"8px",marginTop:"14px"}}>
              <button style={S.btnCancel2} onClick={()=>{setShowPealimModal(false);setPealimRoot("");setPealimResults([]);setPealimPreview(null);setPealimError("");}}>닫기</button>
            </div>
          </div>
        </div>
      )}

      <Modal show={showBatchModal} onClose={()=>setShowBatchModal(false)} title="📝 텍스트 형식으로 단어 추가">
        <p style={S.modalSub}>한 줄에 하나씩 <code style={{color:"#c4a050"}}>히브리어=뜻</code> 형식으로 입력하세요</p>
        <div style={{background:"rgba(196,160,80,0.08)",border:"1px solid rgba(196,160,80,0.2)",borderRadius:"10px",padding:"10px 12px",marginBottom:"10px",fontSize:"0.82rem",color:"#c4a050",lineHeight:1.8,fontFamily:"monospace"}}>
          שָׁלוֹם=평화<br/>תּוֹדָה=감사합니다<br/>אֱלֹהִים=하나님
        </div>
        <textarea ref={batchTextRef} style={{...S.modalTA, fontFamily:"Arial,sans-serif", unicodeBidi:"plaintext"}} lang="he" placeholder={"שָׁלוֹם=평화\nתּוֹדָה=감사합니다"} defaultValue="" spellCheck={false} autoCorrect="off" autoCapitalize="off"/>
        <div className="modal-btn-row" style={S.modalBtnRow}>
          <button style={S.btnMerge} onClick={importFromBatchText}>✅ 단어 추가</button>
          <button style={S.btnCancel2} onClick={()=>{setShowBatchModal(false); if(batchTextRef.current) batchTextRef.current.value="";}}>취소</button>
        </div>
      </Modal>

      {/* ── 변형 전체 편집 모달 ── */}
      {expandedVariantWord&&(()=>{
        const editWord = words.find(w=>w.id===expandedVariantWord);
        if(!editWord) return null;
        return(
          <div style={{...S.modalOverlay,alignItems:"flex-start",paddingTop:"20px",overflowY:"auto"}}>
            <div style={{...S.modal,maxWidth:"600px",maxHeight:"90vh",overflowY:"auto"}}>
              {/* 헤더 */}
              <div style={{marginBottom:"14px"}}>
                <h3 style={{...S.modalTitle,fontSize:"1.1rem",marginBottom:"4px"}}>🔀 변형 편집</h3>
                <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
                  <div style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.3rem",color:"#c4a050"}}>{editWord.hebrew}</div>
                  <div style={{fontSize:"0.8rem",color:"#7a7890"}}>{editWord.meaning}</div>
                </div>
              </div>
              {/* 모드 탭 */}
              <div style={{display:"flex",gap:"6px",marginBottom:"14px"}}>
                <button onClick={()=>setVariantPasteMode(false)}
                  style={{...S.optBtn,flex:1,...(!variantPasteMode?S.essayOptActive:{})}}>
                  ✏️ 개별 입력
                </button>
                <button onClick={()=>setVariantPasteMode(true)}
                  style={{...S.optBtn,flex:1,...(variantPasteMode?{background:"rgba(80,160,120,0.2)",borderColor:"rgba(80,160,120,0.5)",color:"#50c898"}:{})}}>
                  📋 한번에 붙여넣기
                </button>
              </div>

              {/* 붙여넣기 모드 */}
              {variantPasteMode&&(
                <div>
                  <div style={{background:"rgba(80,160,120,0.08)",border:"1px solid rgba(80,160,120,0.2)",borderRadius:"10px",padding:"12px",marginBottom:"12px",fontSize:"0.78rem",lineHeight:1.8,color:"#5a5870"}}>
                    <div style={{color:"#50c898",fontWeight:600,marginBottom:"6px"}}>📋 붙여넣기 순서 (줄바꿈으로 구분)</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"2px 16px"}}>
                      {getAllowedPasteOrder(editWord.wordType).map((tid,idx)=>{
                        const vt=VARIANT_TYPES.find(t=>t.id===tid);
                        const cat=VARIANT_CATS.find(c=>c.types.includes(tid));
                        return(
                          <div key={tid} style={{display:"flex",gap:"6px",alignItems:"center"}}>
                            <span style={{color:"#3a3848",fontSize:"0.65rem",minWidth:"18px"}}>{idx+1}.</span>
                            <span style={{color:cat?cat.color:"#7a7890",fontSize:"0.72rem"}}>{vt?vt.label[uiLang]||vt.label.ko:tid}</span>
                            {variantDraft[tid]&&<span style={{fontFamily:"Arial",direction:"rtl",color:"#50c898",fontSize:"0.8rem"}}>✓ {variantDraft[tid]}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{fontSize:"0.78rem",color:"#7a7890",marginBottom:"6px"}}>
                    순서대로 줄바꿈하여 붙여넣으면 자동으로 매핑됩니다. 없는 변형은 빈 줄로 건너뛰세요.
                  </div>
                  <textarea
                    style={{width:"100%",minHeight:"140px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(80,160,120,0.3)",borderRadius:"10px",color:"#e8e6f0",padding:"12px",fontSize:"1rem",direction:"rtl",fontFamily:"Arial",resize:"vertical",outline:"none",lineHeight:1.8}}
                    placeholder={"여성형\n남성형\n복수(남)\n...(순서대로 입력)"}
                    lang="he" spellCheck={false} autoCorrect="off"
                    value={variantPasteText}
                    onChange={e=>setVariantPasteText(e.target.value)}
                  />
                  <button style={{...S.btnMerge,width:"100%",marginTop:"8px",background:"linear-gradient(135deg,#50c898,#70e8b8)",color:"#0f1a14"}}
                    onClick={()=>applyVariantPaste(variantPasteText)}>
                    📋 자동 매핑 적용
                  </button>
                  <div style={{fontSize:"0.72rem",color:"#5a5870",textAlign:"center",marginTop:"6px"}}>적용 후 개별 입력 탭에서 확인 및 수정 가능</div>
                </div>
              )}

              {/* 카테고리별 입력 폼 */}
              {/* 품사 선택 */}
              {!variantPasteMode&&(
                <div style={{marginBottom:"14px"}}>
                  <div style={{fontSize:"0.72rem",color:"#7a7890",marginBottom:"6px"}}>품사 선택 — 해당하는 변형만 표시돼요</div>
                  <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                    <button onClick={()=>setWords(ws=>ws.map(w=>w.id===editWord.id?{...w,wordType:null}:w))}
                      style={{...S.optBtn,padding:"5px 10px",fontSize:"0.78rem",...(!editWord.wordType?{background:"rgba(255,255,255,0.1)",borderColor:"rgba(255,255,255,0.3)",color:"#e8e6f0"}:{})}}>
                      ⚪ 전체
                    </button>
                    {WORD_TYPES.map(wt=>(
                      <button key={wt.id}
                        onClick={()=>setWords(ws=>ws.map(w=>w.id===editWord.id?{...w,wordType:wt.id}:w))}
                        style={{...S.optBtn,padding:"5px 10px",fontSize:"0.78rem",
                          ...(editWord.wordType===wt.id?{background:"rgba(196,160,80,0.2)",borderColor:"rgba(196,160,80,0.5)",color:"#c4a050"}:{})}}>
                        {wt.emoji} {wt.label[uiLang]||wt.label.ko}
                      </button>
                    ))}
                  </div>
                  {editWord.wordType&&(()=>{ const wt=WORD_TYPES.find(t=>t.id===editWord.wordType);
                    return wt?<div style={{fontSize:"0.72rem",color:"#5a5870",marginTop:"4px"}}>{wt.hint[uiLang]||wt.hint.ko}</div>:null;
                  })()}
                </div>
              )}
              {!variantPasteMode&&getAllowedCats(editWord.wordType).map(cat=>(
                <div key={cat.id} style={{marginBottom:"16px"}}>
                  <div style={{fontSize:"0.72rem",fontWeight:700,color:cat.color,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:"8px",borderBottom:`1px solid ${cat.color}40`,paddingBottom:"4px"}}>
                    {cat.label[uiLang]||cat.label.ko}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"6px"}}>
                    {cat.types.map(tid=>{
                      const vt=VARIANT_TYPES.find(t=>t.id===tid);
                      const label=vt?(vt.label[uiLang]||vt.label.ko):tid;
                      return(
                        <div key={tid} style={{display:"flex",flexDirection:"column",gap:"3px"}}>
                          <label style={{fontSize:"0.68rem",color:"#7a7890",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                            <span>{label}</span>
                            {variantDraft[tid]&&<button onClick={()=>setVariantDraft(d=>({...d,[tid]:""}))}
                              style={{fontSize:"0.6rem",padding:"1px 5px",borderRadius:"4px",background:"rgba(200,60,60,0.1)",
                                border:"1px solid rgba(200,60,60,0.3)",color:"#f07050",cursor:"pointer",lineHeight:1.4}}>삭제</button>}
                          </label>
                          <input
                            value={variantDraft[tid]||""}
                            onChange={e=>setVariantDraft(d=>({...d,[tid]:e.target.value}))}
                            onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); const next=e.target.closest("div").parentElement.nextElementSibling?.querySelector("input"); if(next) next.focus(); }}}
                            placeholder="히브리어 입력..."
                            lang="he" spellCheck={false} autoCorrect="off"
                            style={{...S.input,padding:"7px 10px",fontSize:"1rem",direction:"rtl",fontFamily:"Arial",
                              borderColor:variantDraft[tid]?`${cat.color}80`:"rgba(255,255,255,0.1)"}}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {/* 저장/취소 버튼 */}
              <div style={{display:"flex",gap:"8px",marginTop:"8px",position:"sticky",bottom:0,background:"#1a1828",paddingTop:"12px"}}>
                {!variantPasteMode&&<button style={{...S.btnMerge,flex:1}} onClick={()=>saveVariantDraft(editWord.id)}>
                  ✅ 저장 ({Object.values(variantDraft).filter(v=>v.trim()).length}개 입력됨)
                </button>}
                <button style={S.btnCancel2} onClick={()=>{setExpandedVariantWord(null);setVariantPasteMode(false);setVariantPasteText("");}}>취소</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 로그인 시 단어 병합 선택 모달 */}
      {showMergeModal&&pendingCloudWords&&(
        <div style={S.modalOverlay}>
          <div style={S.modal}>
            <h3 style={S.modalTitle}>☁️ 단어장 동기화</h3>
            <p style={S.modalSub}>기기에 저장된 단어와 클라우드 단어가 모두 있어요. 어떻게 할까요?</p>
            <div style={{display:"flex",flexDirection:"column",gap:"8px",marginBottom:"4px"}}>
              <button style={{...S.btnMerge,padding:"12px"}} onClick={()=>handleMerge("merge")}>
                🔀 합치기 — 두 단어장을 합쳐요 ({(() => { const local=loadWords(); const set=new Set(pendingCloudWords.map(w=>w.hebrew)); return pendingCloudWords.length + local.filter(w=>!set.has(w.hebrew)).length; })()}개)
              </button>
              <button style={{...S.btnReplace,padding:"12px"}} onClick={()=>handleMerge("cloud")}>
                ☁️ 클라우드 사용 — 클라우드 단어장으로 교체 ({pendingCloudWords.length}개)
              </button>
              <button style={{...S.btnCancel2,padding:"12px"}} onClick={()=>handleMerge("local")}>
                💾 기기 단어 유지 — 현재 기기 단어장을 클라우드에 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {importPreview&&(
        <div style={S.modalOverlay}><div style={S.modal}>
          <h3 style={S.modalTitle}>📥 단어 불러오기</h3>
          <p style={S.modalSub}>출처: <span style={{color:"#c4a050"}}>{importPreview.fileName}</span></p>
          <p style={S.modalSub}><b style={{color:"#e8e6f0"}}>{importPreview.words.length}개</b> 단어 발견</p>
          <div style={S.modalPreview}>
            {importPreview.words.slice(0,5).map((w,i)=>(
              <div key={i} style={S.modalPreviewItem}>
                <span style={{fontFamily:"Arial,sans-serif",color:"#c4a050",direction:"rtl"}}>{w.hebrew}</span>
                <span style={{color:"#5a5870",margin:"0 6px"}}>→</span>
                <span style={{color:"#a0a0c0",fontSize:"0.85rem"}}>{w.meaning}</span>
              </div>
            ))}
            {importPreview.words.length>5&&<p style={{color:"#5a5870",fontSize:"0.8rem",margin:"6px 0 0"}}>...외 {importPreview.words.length-5}개</p>}
          </div>
          <div className="modal-btn-row" style={S.modalBtnRow}>
            <button style={S.btnMerge} onClick={()=>confirmImport(true)}>➕ 현재에 추가</button>
            <button style={S.btnReplace} onClick={()=>confirmImport(false)}>🔄 전체 교체</button>
            <button style={S.btnCancel2} onClick={()=>setImportPreview(null)}>취소</button>
          </div>
        </div></div>
      )}

      <div style={S.container}>
        <header style={S.header}>
          <div style={S.headerLeft}>
            <span style={S.logo}>אב</span>
            <div><h1 style={S.title}>{T.appTitle}</h1><p style={S.subtitle}>{T.appSub}</p></div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"6px"}}>
            <div style={S.statsRow}>
              <div style={{...S.statBadge,color:"#60c880",background:"rgba(60,180,100,0.12)",border:"1px solid rgba(60,180,100,0.3)"}}>✅ {masteredCount}</div>
              <div style={{...S.statBadge,color:"#f07050",background:"rgba(200,80,60,0.12)",border:"1px solid rgba(200,80,60,0.3)"}}>🔥 {hardCount}</div>
              <div style={{...S.statBadge,color:"#c4a050",background:"rgba(196,160,80,0.12)",border:"1px solid rgba(196,160,80,0.3)"}}>📖 {learningCount}</div>
            </div>
            <div style={{fontSize:"0.68rem",color:ttsReady?"#60c880":"#f07050"}}>{ttsReady?"🔊 Google TTS 연결됨":"⚠️ 브라우저 TTS 사용 중"}</div>
            {user
              ? <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                  <img src={user.photoURL} alt="" style={{width:"22px",height:"22px",borderRadius:"50%"}}/>
                  <span style={{fontSize:"0.7rem",color:"#c4a050",maxWidth:"80px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.displayName}</span>
                  {syncing&&<span style={{fontSize:"0.65rem",color:"#5a5870"}}>{T.saving}</span>}
                  <button onClick={()=>setShowWalletModal(true)}
                    style={{fontSize:"0.78rem",padding:"3px 7px",borderRadius:"6px",background:"rgba(196,160,80,0.1)",border:"1px solid rgba(196,160,80,0.3)",color:"#c4a050",cursor:"pointer"}}>
                    📚{wallets.length>0?` ${wallets.length}`:""}
                  </button>
                  <button onClick={()=>setUiLang(l=>l==="ko"?"en":"ko")} style={{fontSize:"0.65rem",padding:"3px 8px",borderRadius:"6px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",color:"#c4a050",cursor:"pointer",fontWeight:700}}>{uiLang==="ko"?"EN":"KO"}</button>
                  <button onClick={signOutUser} style={{fontSize:"0.65rem",padding:"3px 8px",borderRadius:"6px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",color:"#7a7890",cursor:"pointer"}}>{T.logout}</button>
                </div>
              : <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
                  <button onClick={()=>setShowWalletModal(true)}
                    style={{fontSize:"0.8rem",padding:"5px 8px",borderRadius:"8px",background:"rgba(196,160,80,0.1)",border:"1px solid rgba(196,160,80,0.3)",color:"#c4a050",cursor:"pointer"}}>
                    📚{wallets.length>0?` (${wallets.length})`:""}
                  </button>
                  <button onClick={signInGoogle} style={{fontSize:"0.72rem",padding:"5px 10px",borderRadius:"8px",background:"linear-gradient(135deg,#c4a050,#e8c875)",border:"none",color:"#1a1820",fontWeight:700,cursor:"pointer"}}>{T.login}</button>
                  <button onClick={()=>setUiLang(l=>l==="ko"?"en":"ko")} style={{fontSize:"0.65rem",padding:"3px 8px",borderRadius:"6px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",color:"#c4a050",cursor:"pointer",fontWeight:700}}>{uiLang==="ko"?"EN":"KO"}</button>
                </div>
            }
          </div>
        </header>

        <div style={{...S.autoSaveBanner,borderColor:user?"rgba(60,180,100,0.3)":"rgba(196,160,80,0.2)",color:user?"#60c880":"#c4a050"}}>{user?T.autoSaveCloud(user.displayName):T.autoSaveLocal}</div>

        {/* 단어장 탭 */}
        <div style={{display:"flex",gap:"6px",marginBottom:"12px",flexWrap:"wrap"}}>
          {BOOKS.map(b=>(
            <button key={b.id} onClick={()=>switchBook(b.id)}
              style={{padding:"8px 16px",borderRadius:"10px",border:"1px solid",fontSize:"0.85rem",fontWeight:600,cursor:"pointer",
                background:currentBook===b.id?`rgba(${b.id==="hebrew"?"196,160,80":b.id==="english"?"60,100,200":"200,60,100"},0.2)`:"rgba(255,255,255,0.04)",
                borderColor:currentBook===b.id?b.color:"rgba(255,255,255,0.1)",
                color:currentBook===b.id?b.color:"#5a5870"}}>
              {b.emoji} {b.label[uiLang]||b.label.ko}
            </button>
          ))}
        </div>

        {/* 플로팅 스크롤 버튼 — 단어장 화면에서만 표시 */}
        {mode===MODES.LIST&&(
          <>
            <button
              onClick={()=>window.scrollTo({top:0,behavior:"smooth"})}
              style={S.floatBtn}
              title="맨 위로">
              ↑
            </button>
            <button
              onClick={()=>window.scrollTo({top:document.body.scrollHeight,behavior:"smooth"})}
              style={{...S.floatBtn,bottom:"70px"}}
              title="맨 아래로">
              ↓
            </button>
          </>
        )}

        {/* ── LIST MODE ── */}
        {mode===MODES.LIST&&(
          <div>
            <div style={S.card}>
              <SectionHeader sectionKey="add" title={editId!==null?T.editWord:T.addWord} badge={editId!==null?"수정 중":null}/>
              {openSections.add&&<div className="form-row" style={{...S.formRow,marginTop:"12px"}}>
                <input style={{...S.input,direction:bookInfo.dir,fontFamily:"Arial,sans-serif",fontSize:"1.1rem"}}
                  placeholder={bookInfo.placeholderA[uiLang]||bookInfo.placeholderA.ko}
                  value={newHebrew} onChange={e=>setNewHebrew(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addWord()}/>
                <input style={S.input}
                  placeholder={bookInfo.placeholderB[uiLang]||bookInfo.placeholderB.ko}
                  value={newMeaning} onChange={e=>setNewMeaning(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addWord()}/>
                {/* 품사 선택 (히브리어 단어장만) */}
                {currentBook==="hebrew"&&(
                  <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                    {WORD_TYPES.map(wt=>(
                      <button key={wt.id}
                        onClick={()=>setNewWordType(t=>t===wt.id?null:wt.id)}
                        style={{...S.optBtn,padding:"6px 10px",fontSize:"0.78rem",
                          ...(newWordType===wt.id?{background:"rgba(196,160,80,0.2)",borderColor:"rgba(196,160,80,0.5)",color:"#c4a050"}:{})}}>
                        {wt.emoji} {wt.label[uiLang]||wt.label.ko}
                      </button>
                    ))}
                    <span style={{fontSize:"0.72rem",color:"#5a5870",alignSelf:"center"}}>품사 선택 (선택사항)</span>
                  </div>
                )}
                {/* 커스텀 단어장 선택 */}
                {wallets.length>0&&editId===null&&(
                  <div style={{marginBottom:"6px"}}>
                    <div style={{fontSize:"0.72rem",color:"#7a7890",marginBottom:"5px"}}>📚 추가할 단어장 선택</div>
                    <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                      {/* 기본 단어장 */}
                      <button onClick={()=>setNewWordExcludeDefault(v=>!v)}
                        style={{padding:"4px 10px",borderRadius:"7px",fontSize:"0.75rem",cursor:"pointer",border:"1px solid",
                          background:!newWordExcludeDefault?"rgba(196,160,80,0.2)":"rgba(255,255,255,0.04)",
                          borderColor:!newWordExcludeDefault?"rgba(196,160,80,0.5)":"rgba(255,255,255,0.1)",
                          color:!newWordExcludeDefault?"#c4a050":"#5a5870",display:"flex",alignItems:"center",gap:"5px"}}>
                        <span style={{width:"8px",height:"8px",borderRadius:"50%",background:"#c4a050",display:"inline-block",flexShrink:0}}/>
                        기본 단어장{!newWordExcludeDefault?" ✓":""}
                      </button>
                      {/* 커스텀 단어장들 */}
                      {wallets.map(wl=>{
                        const sel=newWordWallets.has(wl.id);
                        return(
                          <button key={wl.id} onClick={()=>setNewWordWallets(s=>{const n=new Set(s);sel?n.delete(wl.id):n.add(wl.id);return n;})}
                            style={{padding:"4px 10px",borderRadius:"7px",fontSize:"0.75rem",cursor:"pointer",border:"1px solid",
                              background:sel?wl.color+"25":"rgba(255,255,255,0.04)",
                              borderColor:sel?wl.color+"60":"rgba(255,255,255,0.1)",
                              color:sel?wl.color:"#5a5870",display:"flex",alignItems:"center",gap:"5px"}}>
                            <span style={{width:"8px",height:"8px",borderRadius:"50%",background:wl.color,flexShrink:0,display:"inline-block"}}/>
                            {wl.name}{sel?" ✓":""}
                          </button>
                        );
                      })}
                    </div>
                    {newWordExcludeDefault&&newWordWallets.size===0&&(
                      <div style={{fontSize:"0.68rem",color:"#f07050",marginTop:"4px"}}>⚠️ 커스텀 단어장을 하나 이상 선택해야 해요</div>
                    )}
                  </div>
                )}
                <div style={{display:"flex",gap:"8px"}}>
                  <button style={{...S.btnAdd,flex:1}} onClick={addWord}>{editId!==null?T.editBtn:T.addBtn}</button>
                  {newHebrew&&<SpeakBtn text={newHebrew} onSpeak={speakOnDemand} muted={muted}/>}
                  {editId!==null&&<button style={S.btnCancel} onClick={cancelEdit}>{T.cancelBtn}</button>}
                </div>
              </div>}
            </div>

            <div style={S.ioCard}>
              <SectionHeader sectionKey="io" title={T.saveLoad} color="#a0a0c0"/>
              {openSections.io&&<>
              <div style={{...S.ioSub,margin:"10px 0 8px"}}>{T.telegramTip}</div>
              {currentBook!=="hebrew"&&(
                <div style={{marginBottom:"8px"}}>
                  <button style={{...S.btnIO("#c4a050","rgba(196,160,80,0.15)","rgba(196,160,80,0.4)"),width:"100%"}} onClick={()=>setShowWordSearchModal(true)}>
                    🔎 {currentBook==="korean"?"한국어로 히브리어 검색":"Search Hebrew by meaning"}
                  </button>
                </div>
              )}
              <div className="io-btns" style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                <button style={S.btnIO("#c4a050","rgba(196,160,80,0.15)","rgba(196,160,80,0.4)")} onClick={exportWords}>⬇️ 파일 저장</button>
                <button style={S.btnIO("#c4a050","rgba(196,160,80,0.1)","rgba(196,160,80,0.3)")} onClick={copyToClipboard}>📋 복사</button>
                <button style={S.btnIO("#a0a0c0","rgba(255,255,255,0.06)","rgba(255,255,255,0.15)")} onClick={()=>fileInputRef.current.click()}>⬆️ 파일 열기</button>
                <button style={S.btnIO("#c0b0ff","rgba(100,80,200,0.15)","rgba(100,80,200,0.4)")} onClick={()=>setShowPasteModal(true)}>📋 붙여넣기</button>
                <button style={S.btnIO("#60c880","rgba(60,180,100,0.15)","rgba(60,180,100,0.4)")} onClick={()=>setShowBatchModal(true)}>📝 텍스트 추가</button>
                <button style={S.btnIO("#80a0e0","rgba(60,120,200,0.15)","rgba(60,120,200,0.4)")} onClick={()=>csvInputRef.current.click()}>📊 CSV/엑셀</button>
                <input ref={fileInputRef} type="file" accept=".json" style={{display:"none"}} onChange={handleFileChange}/>
                <input ref={csvInputRef} type="file" accept=".xlsx,.xls,.csv,.tsv,.txt" style={{display:"none"}} onChange={handleCSVChange}/>
              </div>
              </>}
            </div>

            {/* 단어 가져오기 섹션 — 히브리어 단어장만 */}
            {currentBook==="hebrew"&&<div style={{...S.ioCard,borderColor:"rgba(80,160,120,0.2)"}}>
              <SectionHeader sectionKey="import" title="📥 단어 가져오기" color="#50c898"/>
              {openSections.import&&<div style={{marginTop:"10px"}}>
                <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"10px"}}>
                  <button style={S.btnIO("#c4a050","rgba(196,160,80,0.15)","rgba(196,160,80,0.4)")} onClick={()=>setShowWordSearchModal(true)}>🔎 뜻으로 히브리어 검색</button>
                  <button style={S.btnIO("#50c898","rgba(80,160,120,0.15)","rgba(80,160,120,0.4)")} onClick={()=>setShowPealimModal(true)}>🔍 Reverso 동사 변형 가져오기</button>
                  <button style={S.btnIO("#c4a050","rgba(196,160,80,0.15)","rgba(196,160,80,0.4)")} onClick={()=>setShowRootModal(true)}>🌿 어근으로 단어 검색 (Pealim)</button>
                  <button style={S.btnIO("#9060f0","rgba(100,80,200,0.15)","rgba(100,80,200,0.4)")} onClick={()=>variantFileRef.current.click()}>📥 변형 엑셀 불러오기</button>
                  <button style={S.btnIO("#50c898","rgba(80,160,120,0.15)","rgba(80,160,120,0.4)")} onClick={()=>verbFormFileRef.current?.click()}>📋 동사변형 양식 불러오기</button>
                  <button onClick={downloadTemplate} style={S.btnIO("#c4a050","rgba(196,160,80,0.1)","rgba(196,160,80,0.3)")}>⬇️ 동사변형 양식 다운로드</button>
                  <button onClick={refreshAllVariants} disabled={refreshingVariants}
                    style={{...S.btnIO("#50c898","rgba(80,160,120,0.15)","rgba(80,160,120,0.4)"),opacity:refreshingVariants?0.6:1}}>
                    {refreshingVariants?"🔄 업데이트 중...":"🔄 기존 단어 변형 다시 불러오기"}
                  </button>
                </div>
                {/* 변형 불러오기 결과 로그 */}
                {refreshLog.length>0&&<div style={{marginBottom:"8px"}}>
                  <button onClick={()=>setShowRefreshLog(v=>!v)}
                    style={{...S.scrollBtn,width:"100%",marginBottom:"4px",fontSize:"0.78rem"}}>
                    {showRefreshLog?"▲ 결과 숨기기":"▼ 불러오기 결과"} ({refreshLog.filter(l=>l.status==="ok").length}개 성공 / {refreshLog.filter(l=>l.status==="fail").length}개 실패)
                  </button>
                  {showRefreshLog&&<div style={{maxHeight:"180px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"3px"}}>
                    {refreshLog.map((l,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:"8px",padding:"5px 10px",borderRadius:"7px",
                        background:l.status==="ok"?"rgba(80,160,120,0.08)":"rgba(200,60,60,0.06)",
                        border:"1px solid "+(l.status==="ok"?"rgba(80,160,120,0.2)":"rgba(200,60,60,0.2)")}}>
                        <span>{l.status==="ok"?"✅":"❌"}</span>
                        <span style={{fontFamily:"Arial",direction:"rtl",color:"#c4a050",fontSize:"0.9rem",minWidth:"70px"}}>{l.hebrew}</span>
                        <span style={{color:"#7a7890",fontSize:"0.78rem",flex:1}}>{l.meaning}</span>
                        {l.status==="ok"
                          ?<span style={{fontSize:"0.7rem",color:"#50c898",flexShrink:0}}>변형 {l.variantCount}개</span>
                          :<span style={{fontSize:"0.7rem",color:"#f07050",flexShrink:0}}>{l.error}</span>}
                      </div>
                    ))}
                  </div>}
                </div>}
                {/* 가져올 단어장 선택 */}
                {wallets.length>0&&(
                  <div style={{padding:"10px 12px",borderRadius:"10px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)"}}>
                    <div style={{fontSize:"0.72rem",color:"#7a7890",marginBottom:"6px"}}>📚 추가할 단어장 선택</div>
                    <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                      <button onClick={()=>setImportExcludeDefault(v=>!v)}
                        style={{padding:"4px 10px",borderRadius:"7px",fontSize:"0.75rem",cursor:"pointer",border:"1px solid",
                          background:!importExcludeDefault?"rgba(196,160,80,0.2)":"rgba(255,255,255,0.04)",
                          borderColor:!importExcludeDefault?"rgba(196,160,80,0.5)":"rgba(255,255,255,0.1)",
                          color:!importExcludeDefault?"#c4a050":"#5a5870",display:"flex",alignItems:"center",gap:"5px"}}>
                        <span style={{width:"8px",height:"8px",borderRadius:"50%",background:"#c4a050",display:"inline-block",flexShrink:0}}/>
                        기본 단어장{!importExcludeDefault?" ✓":""}
                      </button>
                      {wallets.map(wl=>{
                        const sel=importTargetWallets.has(wl.id);
                        return(
                          <button key={wl.id} onClick={()=>setImportTargetWallets(s=>{const n=new Set(s);sel?n.delete(wl.id):n.add(wl.id);return n;})}
                            style={{padding:"4px 10px",borderRadius:"7px",fontSize:"0.75rem",cursor:"pointer",border:"1px solid",
                              background:sel?wl.color+"25":"rgba(255,255,255,0.04)",
                              borderColor:sel?wl.color+"60":"rgba(255,255,255,0.1)",
                              color:sel?wl.color:"#5a5870",display:"flex",alignItems:"center",gap:"5px"}}>
                            <span style={{width:"8px",height:"8px",borderRadius:"50%",background:wl.color,display:"inline-block",flexShrink:0}}/>
                            {wl.name}{sel?" ✓":""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>}
            </div>}

            {/* 검색 + 정렬 + 보기 수 */}
            <div style={{display:"flex",gap:"8px",marginBottom:"10px",flexWrap:"wrap",alignItems:"center"}}>
              <input
                style={{...S.input,flex:1,minWidth:"160px",padding:"9px 14px",fontSize:"0.9rem"}}
                placeholder={currentBook==="hebrew"?"히브리어 또는 뜻으로 검색...":currentBook==="english"?"Search English or Hebrew...":"한국어 또는 히브리어로 검색..."}
                value={searchQuery}
                onChange={e=>{setSearchQuery(e.target.value);setPage(0);}}
              />
              {/* 정렬 */}
              <select value={sortBy} onChange={e=>{setSortBySave(e.target.value);setPage(0);}}
                style={{padding:"8px 10px",borderRadius:"8px",background:"rgba(255,255,255,0.06)",
                  border:"1px solid rgba(255,255,255,0.15)",color:"#c4a050",fontSize:"0.78rem",cursor:"pointer",outline:"none"}}>
                <option value="default">기본순</option>
                <option value="hebrew_asc">히브리어 ↑</option>
                <option value="hebrew_desc">히브리어 ↓</option>
                <option value="meaning_asc">뜻 ↑</option>
                <option value="meaning_desc">뜻 ↓</option>
                <option value="hard_first">🔥 어려운 것 먼저</option>
                <option value="mastered_first">✅ 암기 먼저</option>
                <option value="wrong_desc">❌ 오답 많은 것 먼저</option>
              </select>
              {/* 보기 수 */}
              <div style={{display:"flex",gap:"4px"}}>
                {[10,20,9999].map(n=>(
                  <button key={n} style={{...S.optBtn,padding:"8px 10px",fontSize:"0.78rem",...(pageSize===n?S.optBtnActive:{})}}
                    onClick={()=>{setPageSizeSave(n);setPage(0);}}>
                    {n===9999?"전체":n+"개"}
                  </button>
                ))}
              </div>
            </div>

            {/* 어근 그룹 뷰 토글 */}
            {currentBook==="hebrew"&&words.some(w=>w.root)&&(
              <button onClick={()=>setRootGroupView(v=>!v)}
                style={{...S.scrollBtn,marginBottom:"10px",width:"100%",padding:"9px",fontSize:"0.82rem",
                  ...(rootGroupView?{background:"rgba(80,160,120,0.2)",borderColor:"rgba(80,160,120,0.5)",color:"#50c898"}:{})}}>
                🌿 {rootGroupView?"어근 그룹 보기 끄기":"어근별로 단어 묶어보기"}
              </button>
            )}

            {/* 어근 그룹 뷰 */}
            {rootGroupView&&(()=>{
              // root 있는 단어들만 그룹핑
              const grouped = {};
              words.filter(w=>w.root).forEach(w=>{
                const r = w.root;
                if(!grouped[r]) grouped[r]=[];
                grouped[r].push(w);
              });
              const roots = Object.entries(grouped).sort((a,b)=>b[1].length-a[1].length);
              if(!roots.length) return <div style={S.emptyMsg}>어근 정보가 있는 단어가 없어요. Pealim에서 단어를 추가하면 어근이 자동으로 저장돼요.</div>;
              return(
                <div style={{marginBottom:"14px"}}>
                  {roots.map(([root, ws])=>(
                    <div key={root} style={{marginBottom:"10px",background:"rgba(255,255,255,0.03)",borderRadius:"14px",border:"1px solid rgba(80,160,120,0.2)",overflow:"hidden"}}>
                      {/* 어근 헤더 */}
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"rgba(80,160,120,0.08)",flexWrap:"wrap",gap:"8px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                          <span style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.2rem",color:"#50c898",fontWeight:700}}>{root}</span>
                          <span style={{fontSize:"0.75rem",color:"#5a5870"}}>{ws.length}개 단어</span>
                        </div>
                        {/* 퀴즈 버튼 */}
                        <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                          <button onClick={async()=>{
                            // 해당 어근 단어들만 변형 새로고침
                            setRefreshingVariants(true);
                            try{
                              const searchRes=await fetch(`/api/Reverso?mode=search&root=${encodeURIComponent(root)}`);
                              const sd=await searchRes.json();
                              if(!sd.error&&sd.results){
                                for(const r of sd.results){
                                  const match=ws.find(w=>stripNikkud(w.hebrew)===stripNikkud(r.hebrew));
                                  if(!match) continue;
                                  const cr=await fetch(`/api/Reverso?mode=conjugation&url=${encodeURIComponent(r.url)}`);
                                  const cd=await cr.json();
                                  if(!cd.error&&cd.variants){
                                    const variants=Object.entries(cd.variants).filter(([,f])=>f).map(([type,form])=>({type,form}));
                                    setWords(prev=>prev.map(w=>w.id===match.id?{...w,variants,meaning:w.meaning||cd.meaning||""}:w));
                                  }
                                }
                              }
                            }catch(e){console.error(e);}
                            setRefreshingVariants(false);
                            showToast(`✅ ${root} 어근 변형 업데이트 완료!`);
                          }} disabled={refreshingVariants}
                            style={{padding:"5px 10px",borderRadius:"7px",background:"rgba(80,160,120,0.1)",border:"1px solid rgba(80,160,120,0.3)",color:"#50c898",cursor:"pointer",fontSize:"0.72rem",opacity:refreshingVariants?0.5:1}}>
                            🔄
                          </button>
                          {ws.length>=2&&<button onClick={()=>startRootQuiz(root,"mcq")}
                            style={{padding:"5px 10px",borderRadius:"7px",background:"rgba(196,160,80,0.2)",border:"1px solid rgba(196,160,80,0.4)",color:"#c4a050",cursor:"pointer",fontSize:"0.72rem",fontWeight:600}}>
                            🎯 객관식
                          </button>}
                          <button onClick={()=>startRootQuiz(root,"essay")}
                            style={{padding:"5px 10px",borderRadius:"7px",background:"rgba(100,80,200,0.2)",border:"1px solid rgba(100,80,200,0.4)",color:"#c0b0ff",cursor:"pointer",fontSize:"0.72rem",fontWeight:600}}>
                            ✍️ 서술형
                          </button>
                          {ws.some(w=>(w.variants||[]).length>0)&&<button onClick={()=>startRootQuiz(root,"variant")}
                            style={{padding:"5px 10px",borderRadius:"7px",background:"rgba(80,160,120,0.2)",border:"1px solid rgba(80,160,120,0.4)",color:"#50c898",cursor:"pointer",fontSize:"0.72rem",fontWeight:600}}>
                            🔀 변형
                          </button>}
                        </div>
                      </div>
                      {/* 단어 목록 */}
                      <div style={{padding:"10px 14px",display:"flex",flexWrap:"wrap",gap:"8px"}}>
                        {ws.map(w=>{
                          const st=STATUS_CONFIG[w.status];
                          return(
                            <div key={w.id} style={{display:"flex",alignItems:"center",gap:"6px",padding:"6px 10px",background:"rgba(255,255,255,0.04)",borderRadius:"9px",border:`1px solid ${st.border}`}}>
                              <span style={{fontFamily:"Arial",direction:"rtl",color:"#c4a050",fontSize:"1rem"}}>{w.hebrew}</span>
                              <span style={{color:"#7a7890",fontSize:"0.78rem"}}>{w.meaning||<span style={{color:"#3a3848",fontStyle:"italic"}}>뜻 없음</span>}</span>
                              <span style={{fontSize:"0.7rem"}}>{st.emoji}</span>
                              {(w.variants||[]).length>0&&<span style={{fontSize:"0.65rem",color:"#50c898",background:"rgba(80,160,120,0.1)",padding:"1px 5px",borderRadius:"4px"}}>변형 {w.variants.length}개</span>}
                              <button onClick={()=>startEdit(w)} style={{...S.btnEdit,padding:"2px 5px",fontSize:"0.75rem"}}>✏️</button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  {/* 어근 없는 단어 수 표시 */}
                  {words.filter(w=>!w.root).length>0&&(
                    <div style={{fontSize:"0.72rem",color:"#5a5870",textAlign:"center",padding:"8px"}}>
                      어근 정보 없는 단어: {words.filter(w=>!w.root).length}개 (일반 단어장에서 확인)
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 필터 탭 */}
            <div style={S.filterTabs}>
              {[["all",T.all,words.length],["learning",T.learning,learningCount],["hard",T.hard,hardCount],["mastered",T.done,masteredCount]].map(([val,label,cnt])=>(
                <button key={val} style={{...S.filterTab,...(listFilter===val?S.filterTabActive:{})}} onClick={()=>{setListFilterSave(val);setPage(0);setSelectedIds(new Set());}}>
                  {label}<span style={S.filterCnt}>{cnt}</span>
                </button>
              ))}
            </div>

            {/* 맨 위로 버튼 + 전체 선택 삭제 */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px",flexWrap:"wrap",gap:"6px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                <span style={{fontSize:"0.78rem",color:"#5a5870"}}>{T.wordCount(searchedWords.length)}</span>
                <button style={{...S.scrollBtn,fontSize:"0.75rem"}} onClick={()=>{
                  if(selectedIds.size===filteredWords.length) setSelectedIds(new Set());
                  else setSelectedIds(new Set(filteredWords.map(w=>w.id)));
                }}>
                  {selectedIds.size===filteredWords.length&&filteredWords.length>0?T.deselect:T.selectAll}
                </button>
                {selectedIds.size>0&&(
                  <button style={{...S.scrollBtn,background:"rgba(200,60,60,0.15)",borderColor:"rgba(200,60,60,0.4)",color:"#f08080",fontSize:"0.75rem"}}
                    onClick={()=>{ if(window.confirm(uiLang==="en"?`Delete ${selectedIds.size} selected words?`:`선택한 ${selectedIds.size}개 단어를 삭제할까요?`)){setWords(ws=>ws.filter(w=>!selectedIds.has(w.id)));setSelectedIds(new Set());} }}>
                    {T.deleteN(selectedIds.size)}
                  </button>
                )}
              </div>

            </div>

            <div style={S.wordList}>
              {filteredWords.length===0&&<div style={S.emptyMsg}>{searchQuery?(uiLang==="en"?"No results":"검색 결과가 없어요"):(uiLang==="en"?"No words yet":"단어가 없어요")}</div>}
              {filteredWords.map((w,i)=>{ const st=STATUS_CONFIG[w.status]; return(
                <div key={w.id} style={{...S.wordItem,borderColor:selectedIds.has(w.id)?"rgba(200,60,60,0.5)":st.border,background:selectedIds.has(w.id)?"rgba(200,60,60,0.08)":undefined}}>
                  <input type="checkbox" checked={selectedIds.has(w.id)}
                    onChange={e=>{ const s=new Set(selectedIds); e.target.checked?s.add(w.id):s.delete(w.id); setSelectedIds(s); }}
                    style={{width:"16px",height:"16px",cursor:"pointer",accentColor:"#f08080",flexShrink:0}}/>
                  <span style={S.wordIndex}>{i+1}</span>
                  {/* 카드 내용: flex-column */}
                  <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:"4px"}}>
                    {/* 상단: 히브리어 + 상태버튼 */}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"6px"}}>
                      <span style={{...S.wordHeb,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{w.hebrew}</span>
                      <div style={{display:"flex",gap:"3px",flexShrink:0}}>
                        {["learning","hard","mastered"].map(s=>{ const sc=STATUS_CONFIG[s]; return<button key={s} title={sc.label} style={{...S.statusBtn,...(w.status===s?{background:sc.bg,borderColor:sc.border,opacity:1}:{})}} onClick={()=>setManualStatus(w.id,s)}>{sc.emoji}</button>; })}
                      </div>
                    </div>
                    {/* 뜻 + 태그 */}
                    <div style={{display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
                      <span style={S.wordMean}>{w.meaning||<span style={{color:"#3a3848",fontStyle:"italic"}}>뜻 없음</span>}</span>
                      {w.wordType&&(()=>{ const wt=WORD_TYPES.find(t=>t.id===w.wordType);
                        return wt?<span style={{fontSize:"0.65rem",background:"rgba(196,160,80,0.12)",border:"1px solid rgba(196,160,80,0.25)",borderRadius:"4px",padding:"1px 5px",color:"#c4a050"}}>{wt.emoji} {wt.label[uiLang]||wt.label.ko}</span>:null;
                      })()}
                      {w.root&&<button onClick={()=>{setPealimRoot(w.root);setShowPealimModal(true);setTimeout(()=>document.getElementById("pealim-search-btn")?.click(),100);}} style={{fontSize:"0.65rem",background:"rgba(80,160,120,0.12)",border:"1px solid rgba(80,160,120,0.3)",borderRadius:"4px",padding:"1px 6px",color:"#50c898",cursor:"pointer",fontFamily:"Arial",direction:"rtl"}}>{w.root}</button>}
                    </div>
                    {/* 하단: 발음버튼 + 편집버튼 — 완전 분리된 행 */}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"6px",marginTop:"2px"}}>
                      <RepeatSpeakBtn text={w.hebrew} onSpeak={speakOnDemand} muted={muted} size="sm"/>
                      <div style={{display:"flex",gap:"4px",flexShrink:0}}>
                        <button style={S.btnEdit} onClick={()=>startEdit(w)}>✏️</button>
                        <button title="변형 추가" style={{...S.btnEdit,opacity:(w.variants&&w.variants.length>0)?1:0.35,color:"#9060f0"}}
                          onClick={()=>expandedVariantWord===w.id?setExpandedVariantWord(null):openVariantModal(w)}>
                          {w.variants&&w.variants.length>0?`🔀${w.variants.length}`:"🔀"}
                        </button>
                        {wallets.length>0&&(
                          <button title="단어장에 추가" style={{...S.btnEdit,
                            color:wallets.some(wl=>wl.wordIds.includes(w.id))?"#c4a050":"inherit",
                            opacity:wallets.some(wl=>wl.wordIds.includes(w.id))?1:0.45}}
                            onClick={e=>{
                              e.stopPropagation();
                              if(wallets.length===1){ toggleWordInWallet(wallets[0].id,w.id); }
                              else { setWalletPickWord(w.id); }
                            }}>📚</button>
                        )}
                        <button style={S.btnDel} onClick={()=>deleteWord(w.id)}>🗑️</button>
                      </div>
                    </div>
                  </div>
                </div>

              );})}
            </div>

            {/* 페이지네이션 */}
            {pageSize!==9999&&totalPages>1&&(
              <div style={{display:"flex",justifyContent:"center",gap:"6px",marginBottom:"14px",flexWrap:"wrap"}}>
                <button style={{...S.scrollBtn,...(page===0?{opacity:0.3,cursor:"not-allowed"}:{})}} onClick={()=>page>0&&setPage(p=>p-1)} disabled={page===0}>← 이전</button>
                {Array.from({length:totalPages},(_,i)=>(
                  <button key={i} style={{...S.scrollBtn,...(page===i?{background:"rgba(196,160,80,0.3)",borderColor:"rgba(196,160,80,0.6)",color:"#c4a050"}:{})}} onClick={()=>setPage(i)}>{i+1}</button>
                ))}
                <button style={{...S.scrollBtn,...(page===totalPages-1?{opacity:0.3,cursor:"not-allowed"}:{})}} onClick={()=>page<totalPages-1&&setPage(p=>p+1)} disabled={page===totalPages-1}>다음 →</button>
              </div>
            )}

            {/* 객관식 */}
            <div style={S.card}>
              <SectionHeader sectionKey="quiz_mcq" title={T.mcqTitle}
                badge={poolSize>0?`${poolSize}개 가능`:uiLang==="en"?"No words":"단어 없음"}/>
              {openSections.quiz_mcq&&<div style={{marginTop:"12px"}}>
              <p style={S.settingLabel}>{T.direction}</p>
              <div style={S.optionRow}>{[[QUIZ_TYPES.HEB_TO_MEAN,T.dirAtoB(bookInfo)],[QUIZ_TYPES.MEAN_TO_HEB,T.dirBtoA(bookInfo)],[QUIZ_TYPES.MIXED,T.mixed]].map(([val,label])=><button key={val} style={{...S.optBtn,...(quizType===val?S.optBtnActive:{})}} onClick={()=>setQuizTypeSave(val)}>{label}</button>)}</div>
              <p style={S.settingLabel}>{T.wordRange}</p>
              <div style={S.optionRow}>{[
                [QUIZ_FILTERS.ALL,T.allRange(words.length)],
                [QUIZ_FILTERS.LEARNING_ONLY, `📖 학습중 (${learningCount})`],
                [QUIZ_FILTERS.EXCLUDE_MASTERED,T.excludeMastered(words.filter(w=>w.status!=="mastered").length)],
                [QUIZ_FILTERS.HARD_ONLY,T.hardOnly(hardCount)]
              ].map(([val,label])=><button key={val} style={{...S.optBtn,...(quizFilter===val?S.optBtnActive:{})}} onClick={()=>setQuizFilterSave(val)}>{label}</button>)}</div>
              <p style={S.settingLabel}>{T.questionCount}</p>
              <div style={S.optionRow}>{countOptions.map(({label,value})=>{ const d=value!==9999&&value>poolSize; return<button key={value} style={{...S.optBtn,...(quizCount===value?S.optBtnActive:{}),...(d?{opacity:0.3,cursor:"not-allowed"}:{})}} onClick={()=>!d&&setQuizCount(value)} disabled={d}>{label}</button>; })}</div>
              <div style={S.sliderWrap}>
                <span style={S.sliderLabel}>{T.directInput}</span>
                <input type="range" min={1} max={Math.max(4,poolSize)} value={Math.min(quizCount===9999?poolSize:quizCount,poolSize)} onChange={e=>setQuizCountSave(Number(e.target.value))} style={S.slider}/>
                <input type="number" min={1} max={poolSize} value={quizCount===9999?poolSize:Math.min(quizCount,poolSize)}
                  onChange={e=>{ const v=Math.max(1,Math.min(poolSize,Number(e.target.value)||1)); setQuizCountSave(v); }}
                  style={{width:"52px",padding:"4px 6px",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(196,160,80,0.4)",borderRadius:"6px",color:"#c4a050",fontSize:"0.9rem",fontWeight:700,textAlign:"center",outline:"none"}}/>
              </div>
              <div style={{...S.autoPlayRow,marginBottom:"14px",flexDirection:"column",alignItems:"flex-start",gap:"10px"}}>
                <div style={{fontSize:"0.85rem",fontWeight:600,color:"#c4a050"}}>{uiLang==="en"?"Sound":"발음 설정"}</div>
                <div style={{display:"flex",gap:"6px",width:"100%"}}>
                  {[
                    {mode:"auto",   icon:"🔊", label:uiLang==="en"?"Auto":"자동",   sub:uiLang==="en"?"Auto play":"문제마다 자동", color:"#c4a050", bg:"rgba(196,160,80,0.2)", border:"rgba(196,160,80,0.5)"},
                    {mode:"manual", icon:"🔈", label:uiLang==="en"?"Manual":"수동", sub:uiLang==="en"?"Button only":"버튼 눌러야 재생", color:"#60c880", bg:"rgba(60,180,100,0.2)", border:"rgba(60,180,100,0.5)"},
                    {mode:"mute",   icon:"🔇", label:uiLang==="en"?"Mute":"음소거",  sub:uiLang==="en"?"No sound":"발음 완전 끔", color:"#f07050", bg:"rgba(200,60,60,0.2)", border:"rgba(200,60,60,0.5)"},
                  ].map(({mode,icon,label,sub,color,bg,border})=>(
                    <button key={mode} onClick={()=>setSoundMode(mode)}
                      style={{flex:1,padding:"10px 6px",borderRadius:"10px",border:`1px solid ${soundMode===mode?border:"rgba(255,255,255,0.1)"}`,
                        background:soundMode===mode?bg:"rgba(255,255,255,0.04)",
                        color:soundMode===mode?color:"#5a5870",cursor:"pointer",textAlign:"center"}}>
                      <div style={{fontSize:"1.1rem",marginBottom:"3px"}}>{icon}</div>
                      <div style={{fontSize:"0.78rem",fontWeight:700}}>{label}</div>
                      <div style={{fontSize:"0.65rem",opacity:0.7,marginTop:"2px"}}>{sub}</div>
                    </button>
                  ))}
                </div>
              </div>
              <button style={{...S.btnStart,...(poolSize<4?S.btnDisabled:{})}} onClick={startQuiz} disabled={poolSize<4}>{poolSize<4?T.needMore(poolSize):T.startMCQ(quizCount===9999?poolSize:Math.min(quizCount,poolSize))}</button>
              </div>}
            </div>

            {/* 서술형 */}
            <div style={{...S.card,border:"1px solid rgba(100,80,200,0.3)"}}>
              <SectionHeader sectionKey="quiz_essay" title={T.essayTitle} color="#9060f0"
                badge={essayPoolSize>0?`${essayPoolSize}개 가능`:uiLang==="en"?"No words":"단어 없음"}/>
              {openSections.quiz_essay&&<div style={{marginTop:"12px"}}>
              <p style={{fontSize:"0.82rem",color:"#7a7890",marginBottom:"12px"}}>{T.essaySub}</p>
              <p style={S.settingLabel}>문제 방향</p>
              <div style={S.optionRow}>
                {[["heb_to_mean",T.dirAtoB_e(bookInfo)],["mean_to_heb",T.dirBtoA_e(bookInfo)],["mixed",T.mixed]].map(([val,label])=>(
                  <button key={val} style={{...S.optBtn,...(essayType===val?S.essayOptActive:{})}} onClick={()=>setEssayType(val)}>{label}</button>
                ))}
              </div>
              <p style={S.settingLabel}>단어 범위</p>
              <div style={S.optionRow}>{[[QUIZ_FILTERS.ALL,T.allRange(words.length)],[QUIZ_FILTERS.EXCLUDE_MASTERED,T.excludeMastered(words.filter(w=>w.status!=="mastered").length)],[QUIZ_FILTERS.HARD_ONLY,T.hardOnly(hardCount)]].map(([val,label])=><button key={val} style={{...S.optBtn,...(essayFilter===val?S.essayOptActive:{})}} onClick={()=>setEssayFilterSave(val)}>{label}</button>)}</div>
              <p style={S.settingLabel}>{T.questionCount}</p>
              <div style={S.optionRow}>{countOptions.map(({label,value})=>{ const d=value!==9999&&value>essayPoolSize; return<button key={value} style={{...S.optBtn,...(essayCount===value?S.essayOptActive:{}),...(d?{opacity:0.3,cursor:"not-allowed"}:{})}} onClick={()=>!d&&setEssayCountSave(value)} disabled={d}>{label}</button>; })}</div>
              <div style={S.sliderWrap}>
                <span style={S.sliderLabel}>{T.directInput}</span>
                <input type="range" min={1} max={Math.max(1,essayPoolSize)} value={Math.min(essayCount===9999?essayPoolSize:essayCount,essayPoolSize)} onChange={e=>setEssayCountSave(Number(e.target.value))} style={S.slider}/>
                <input type="number" min={1} max={essayPoolSize} value={essayCount===9999?essayPoolSize:Math.min(essayCount,essayPoolSize)}
                  onChange={e=>{ const v=Math.max(1,Math.min(essayPoolSize,Number(e.target.value)||1)); setEssayCountSave(v); }}
                  style={{width:"52px",padding:"4px 6px",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(100,80,200,0.4)",borderRadius:"6px",color:"#c0b0ff",fontSize:"0.9rem",fontWeight:700,textAlign:"center",outline:"none"}}/>
              </div>
              <button style={{...S.btnEssayStart,...(!essayPoolSize?S.btnDisabled:{})}} onClick={startEssay} disabled={!essayPoolSize}>✍️ 서술형 시작! ({essayCount===9999?essayPoolSize:Math.min(essayCount,essayPoolSize)} {uiLang==="en"?"questions":"문제"})</button>
              </div>}
            </div>
            {/* 변형 퀴즈 — 히브리어 단어장만 */}
            {currentBook==="hebrew"&&<div style={{...S.card,border:"1px solid rgba(80,160,120,0.3)"}}>
              <SectionHeader sectionKey="quiz_variant" title="🔀 변형 퀴즈" color="#50c898"
                badge={variantPoolSize>0?`${variantPoolSize}개 가능`:"변형 없음"}/>
              {openSections.quiz_variant&&<div style={{marginTop:"12px"}}>
              <p style={{fontSize:"0.82rem",color:"#7a7890",marginBottom:"8px"}}>변형 유형과 단어 범위를 선택하고 퀴즈를 시작해요. 변형 추가는 위 📥 단어 가져오기 섹션을 이용하세요.</p>

              <input ref={verbFormFileRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={handleVerbFormExcel}/>
              <input ref={variantFileRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={handleVariantExcel}/>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"6px"}}>
                <p style={{...S.settingLabel,margin:0}}>변형 유형 선택</p>
                <button onClick={()=>setVariantCatsSave(variantCats.length===VARIANT_CATS.length?[]:VARIANT_CATS.map(c=>c.id))}
                  style={{...S.scrollBtn,padding:"3px 10px",fontSize:"0.72rem"}}>
                  {variantCats.length===VARIANT_CATS.length?"전체 해제":"전체 선택"}
                </button>
              </div>
              <div style={S.optionRow}>
                {VARIANT_CATS.map(cat=>(
                  <button key={cat.id}
                    style={{...S.optBtn,...(variantCats.includes(cat.id)?{background:"rgba(80,160,120,0.2)",borderColor:"rgba(80,160,120,0.5)",color:"#50c898"}:{})}}
                    onClick={()=>setVariantCatsSave(v=>v.includes(cat.id)?v.filter(x=>x!==cat.id):[...v,cat.id])}>
                    {cat.label[uiLang]||cat.label.ko}
                  </button>
                ))}
              </div>
              <p style={S.settingLabel}>단어 범위 <span style={{color:"#5a5870",fontWeight:400,fontSize:"0.8rem"}}>(변형 있는 단어만 표시)</span></p>
              {(()=>{
                // 선택된 변형 유형에 해당하는 단어만 카운트
                const selectedTypes=new Set(VARIANT_CATS.filter(c=>variantCats.includes(c.id)).flatMap(c=>c.types));
                const hasVariant=w=>(w.variants||[]).some(v=>selectedTypes.has(v.type));
                const vAll=words.filter(hasVariant).length;
                const vLearning=words.filter(w=>w.status==="learning"&&hasVariant(w)).length;
                const vHard=words.filter(w=>w.status==="hard"&&hasVariant(w)).length;
                const vMastered=words.filter(w=>w.status==="mastered"&&hasVariant(w)).length;
                const vExclude=words.filter(w=>w.status!=="mastered"&&hasVariant(w)).length;
                return(
                  <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                    {[
                      [QUIZ_FILTERS.ALL, `전체 (${vAll})`],
                      [QUIZ_FILTERS.LEARNING_ONLY, `📖 학습중 (${vLearning})`],
                      [QUIZ_FILTERS.HARD_ONLY, `🔥 어려움 (${vHard})`],
                      [QUIZ_FILTERS.EXCLUDE_MASTERED, `암기 제외 (${vExclude})`],
                    ].map(([val,label])=>(
                      <button key={val} style={{...S.optBtn,...(variantFilter===val?{background:"rgba(80,160,120,0.2)",borderColor:"rgba(80,160,120,0.5)",color:"#50c898"}:{})}}
                        onClick={()=>setVariantFilterSave(val)}>{label}</button>
                    ))}
                  </div>
                );
              })()}
              <p style={S.settingLabel}>{T.questionCount} <span style={{color:"#5a5870",fontWeight:400,textTransform:"none"}}>(가능: {variantPoolSize}개)</span></p>
              <div style={S.sliderWrap}>
                <span style={S.sliderLabel}>{T.directInput}</span>
                <input type="range" min={1} max={Math.max(1,variantPoolSize)} value={Math.min(variantCount===9999?variantPoolSize:variantCount,Math.max(1,variantPoolSize))} onChange={e=>setVariantCount(Number(e.target.value))} style={{...S.slider,accentColor:"#50c898"}}/>
                <input type="number" min={1} max={variantPoolSize} value={variantCount===9999?variantPoolSize:Math.min(variantCount,variantPoolSize)}
                  onChange={e=>{ const v=Math.max(1,Math.min(variantPoolSize,Number(e.target.value)||1)); setVariantCount(v); }}
                  style={{width:"52px",padding:"4px 6px",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(80,160,120,0.4)",borderRadius:"6px",color:"#50c898",fontSize:"0.9rem",fontWeight:700,textAlign:"center",outline:"none"}}/>
              </div>
              <button style={{...S.btnStart,background:"linear-gradient(135deg,#50c898,#70e8b8)",color:"#0f1a14",...(!variantPoolSize||!variantCats.length?S.btnDisabled:{})}}
                onClick={startVariantQuiz} disabled={!variantPoolSize||!variantCats.length}>
                🔀 변형 퀴즈 시작! ({variantCount===9999?variantPoolSize:Math.min(variantCount,variantPoolSize)}문제)
              </button>
              <div style={{display:"flex",gap:"6px",marginTop:"8px"}}>
                {[["essay","✍️ 서술형"],["mcq","🎯 객관식"]].map(([t,label])=>(
                  <button key={t} onClick={()=>setVariantQuizType(t)}
                    style={{...S.optBtn,flex:1,...(variantQuizType===t?{background:"rgba(80,160,120,0.2)",borderColor:"rgba(80,160,120,0.5)",color:"#50c898"}:{})}}>
                    {label}
                  </button>
                ))}
              </div>
              </div>}
            </div>}
          </div>
        )}

        {/* ── QUIZ MODE ── */}
        {mode===MODES.QUIZ&&q&&(
          <div key={animKey}>
            <div style={S.progressBar}><div style={{...S.progressFill,width:`${progress}%`}}/></div>
            <div style={S.progressLabel}><span>{current+1} / {questions.length}</span><span style={S.scoreLabel}>점수: {score} / {current+(confirmed?1:0)}</span></div>
            <div style={S.questionCard}>
              <div style={S.questionTag}>{q.questionType===QUIZ_TYPES.HEB_TO_MEAN?T.questionTagAtoB(bookInfo):T.questionTagBtoA(bookInfo)}</div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"12px"}}>
                <div style={{...S.questionText,...(q.questionType===QUIZ_TYPES.HEB_TO_MEAN?{fontFamily:"Arial,sans-serif",fontSize:"clamp(2rem,8vw,3rem)",direction:"rtl"}:{fontSize:"clamp(1.1rem,4vw,1.5rem)"})}}>
                  {q.question}
                </div>
                <div style={{display:"flex",gap:"8px",alignItems:"center",justifyContent:"center",flexWrap:"wrap"}}>
                  {q.questionType===QUIZ_TYPES.HEB_TO_MEAN?(<RepeatSpeakBtn text={q.question} onSpeak={speakOnDemand} muted={muted}/>)
                  :confirmed?(<><RepeatSpeakBtn text={q.answer} onSpeak={speakOnDemand} muted={muted}/><span style={{fontSize:"0.75rem",color:"#5a5870"}}>{uiLang==="en"?"Answer pronunciation":"정답 발음"}</span></>):null}
                </div>
              </div>
              {(()=>{const w=words.find(x=>x.id===q.wordId);const st=w?STATUS_CONFIG[w.status]:null;return st?<div style={{...S.statusPill,color:st.color,background:st.bg,border:`1px solid ${st.border}`}}>{st.emoji} {st.label}</div>:null;})()}
            </div>
            <div className="choices-grid" style={S.choicesGrid}>
              {q.choices.map((choice,idx)=>{ let extra={}; if(confirmed){if(choice===q.answer)extra=S.choiceCorrect;else if(choice===selected)extra=S.choiceWrong;}else if(choice===selected)extra=S.choiceSelected; return(
                <button key={idx} style={{...S.choiceBtn,...extra}} onClick={()=>handleSelect(choice)}>
                  <span style={S.choiceAlpha}>{"ABCD"[idx]}</span>
                  <span style={q.questionType===QUIZ_TYPES.MEAN_TO_HEB?{fontFamily:"Arial,sans-serif",fontSize:"1.2rem",direction:"rtl"}:{}}>{choice}</span>
                  {q.questionType===QUIZ_TYPES.MEAN_TO_HEB&&<span style={{marginLeft:"auto"}} onClick={e=>{e.stopPropagation();speakOnDemand(choice);}}>🔈</span>}
                </button>
              );})}
            </div>
            {/* 피드백 + 분류 버튼 — 고정 높이로 버튼 밀림 방지 */}
            <div style={{height:"80px",marginBottom:"8px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
              {confirmed&&(
                <>
                  <div style={{...(selected===q.answer?S.feedbackCorrect:S.feedbackWrong),marginBottom:"6px",padding:"8px 12px",fontSize:"0.88rem"}}>
                    {selected===q.answer?T.correct:T.wrong(q.answer)}
                    {(()=>{const w=words.find(x=>x.id===q.wordId);const st=w?STATUS_CONFIG[w.status]:null;return st?<span style={{marginLeft:6,fontSize:"0.75rem",opacity:0.8}}>{st.emoji} {st.label}</span>:null;})()}
                  </div>
                  {/* 퀴즈 중 상태 분류 버튼 */}
                  <div style={{display:"flex",gap:"6px",justifyContent:"center",flexWrap:"wrap"}}>
                    {(()=>{ const w=words.find(x=>x.id===q.wordId); if(!w) return null;
                      return(<>
                        {w.status!=="hard"&&<button onClick={()=>setManualStatus(q.wordId,"hard")}
                          style={{padding:"3px 10px",borderRadius:"6px",background:"rgba(200,80,60,0.15)",border:"1px solid rgba(200,80,60,0.4)",color:"#f07050",fontSize:"0.72rem",cursor:"pointer",fontWeight:600}}>
                          🔥 {uiLang==="en"?"Mark Hard":"어려움"}
                        </button>}
                        {w.status!=="mastered"&&<button onClick={()=>setManualStatus(q.wordId,"mastered")}
                          style={{padding:"3px 10px",borderRadius:"6px",background:"rgba(60,180,100,0.15)",border:"1px solid rgba(60,180,100,0.4)",color:"#60c880",fontSize:"0.72rem",cursor:"pointer",fontWeight:600}}>
                          ✅ {uiLang==="en"?"Mark Done":"암기완료"}
                        </button>}
                        {w.status!=="learning"&&<button onClick={()=>setManualStatus(q.wordId,"learning")}
                          style={{padding:"3px 10px",borderRadius:"6px",background:"rgba(120,120,160,0.15)",border:"1px solid rgba(120,120,160,0.3)",color:"#9090b0",fontSize:"0.72rem",cursor:"pointer",fontWeight:600}}>
                          📖 {uiLang==="en"?"Learning":"학습중"}
                        </button>}
                      </>);
                    })()}
                  </div>
                </>
              )}
            </div>
            <div className="quiz-btn-row" style={S.quizBtnRow}>
              {!confirmed?<button style={{...S.btnConfirm,...(!selected?S.btnDisabled:{})}} onClick={handleConfirm} disabled={!selected}>{T.confirm}</button>:<button style={S.btnNext} onClick={handleNext}>{current+1>=questions.length?T.finish:T.next}</button>}
              <button style={S.btnQuit} onClick={()=>{window.speechSynthesis?.cancel();setMode(MODES.LIST);}}>{T.quit}</button>
            </div>
          </div>
        )}

        {/* ── ESSAY MODE ── */}
        {mode===MODES.ESSAY&&eq&&(
          <div key={animKey}>
            <div style={{...S.progressBar,background:"rgba(100,80,200,0.15)"}}><div style={{...S.progressFill,width:`${essayProgress}%`,background:"linear-gradient(90deg,#6040c8,#9060f0)"}}/></div>
            <div style={S.progressLabel}><span>✍️ {essayCurrent+1} / {essayQuestions.length}</span><span style={{color:"#9060f0",fontWeight:600}}>정답 {essayResults.filter(r=>r.result!=="wrong").length} / {essayCurrent+(essayConfirmed?1:0)}</span></div>
            <div style={{...S.questionCard,border:"1px solid rgba(100,80,200,0.3)"}}>
              <div style={{...S.questionTag,color:"#9060f0"}}>
                {eq.questionType==="heb_to_mean"?T.questionTagAtoB(bookInfo):T.questionTagBtoA(bookInfo)}
              </div>
              {eq.questionType==="heb_to_mean"
                ?<div style={{fontFamily:"Arial,sans-serif",fontSize:"clamp(2rem,8vw,3rem)",direction:"rtl",color:"#f0ece0",marginBottom:"14px"}}>{eq.question}</div>
                :<div style={{fontSize:"clamp(1.1rem,4vw,1.5rem)",color:"#f0ece0",marginBottom:"14px",lineHeight:1.4}}>{eq.question}</div>
              }
              <div style={{display:"flex",alignItems:"center",gap:"8px",justifyContent:"center",flexWrap:"wrap"}}>
                <RepeatSpeakBtn text={eq.hebrewWord} onSpeak={speakOnDemand} muted={muted}/>
              </div>
            </div>

            {/* 뜻 입력 (heb_to_mean) — controlled */}
            {eq.questionType==="heb_to_mean"&&(
              <input ref={essayInputRef}
                style={{...S.input,fontSize:"1.1rem",marginBottom:"12px",...(essayConfirmed?{borderColor:essayResults[essayResults.length-1]?.result==="exact"?"rgba(60,180,100,0.6)":essayResults[essayResults.length-1]?.result==="partial"?"rgba(196,160,80,0.6)":"rgba(200,60,60,0.6)"}:{})}}
                placeholder={T.inputPlaceholderA(bookInfo)} value={essayInput}
                onChange={e=>!essayConfirmed&&setEssayInput(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"){if(!essayConfirmed)handleEssayConfirm();else handleEssayNext();}}}
                readOnly={essayConfirmed}/>
            )}

            {/* 히브리어 입력 (mean_to_heb) — uncontrolled ref (히브리어 IME 문제 방지) */}
            {eq.questionType==="mean_to_heb"&&(
              <input ref={essayHebrewRef}
                style={{...S.input,fontSize:"1.3rem",fontFamily:"Arial,sans-serif",direction:"rtl",marginBottom:"12px",unicodeBidi:"plaintext",...(essayConfirmed?{borderColor:essayResults[essayResults.length-1]?.result==="exact"?"rgba(60,180,100,0.6)":essayResults[essayResults.length-1]?.result==="partial"?"rgba(196,160,80,0.6)":"rgba(200,60,60,0.6)"}:{})}}
                placeholder={T.inputPlaceholderB(bookInfo)} lang="he" spellCheck={false} autoCorrect="off"
                defaultValue="" readOnly={essayConfirmed}
                onKeyDown={e=>{if(e.key==="Enter"){if(!essayConfirmed)handleEssayConfirm();else handleEssayNext();}}}/>
            )}

            {essayConfirmed&&(()=>{ const last=essayResults[essayResults.length-1]; const w=words.find(x=>x.id===eq.wordId);
              return(<>
                {last?.result==="exact"
                  ?<div style={{...S.feedbackCorrect,flexWrap:"wrap",marginBottom:"6px"}}>✅ 정답! <SpeakBtn text={eq.hebrewWord} onSpeak={speakOnDemand} muted={muted}/></div>
                  :last?.result==="partial"
                  ?<div style={{...S.feedbackCorrect,background:"rgba(196,160,80,0.15)",borderColor:"rgba(196,160,80,0.3)",color:"#e8c875",flexWrap:"wrap",marginBottom:"6px"}}>부분 정답! 정답: <b>{eq.answer}</b> <SpeakBtn text={eq.hebrewWord} onSpeak={speakOnDemand} muted={muted}/></div>
                  :<div style={{...S.feedbackWrong,flexWrap:"wrap",marginBottom:"6px"}}>❌ 오답 — 정답: <b>{eq.answer}</b> <SpeakBtn text={eq.hebrewWord} onSpeak={speakOnDemand} muted={muted}/></div>
                }
                {w&&<div style={{display:"flex",gap:"6px",justifyContent:"center",flexWrap:"wrap",marginBottom:"8px"}}>
                  {w.status!=="hard"&&<button onClick={()=>setManualStatus(eq.wordId,"hard")}
                    style={{padding:"3px 10px",borderRadius:"6px",background:"rgba(200,80,60,0.15)",border:"1px solid rgba(200,80,60,0.4)",color:"#f07050",fontSize:"0.72rem",cursor:"pointer",fontWeight:600}}>
                    🔥 {uiLang==="en"?"Mark Hard":"어려움"}
                  </button>}
                  {w.status!=="mastered"&&<button onClick={()=>setManualStatus(eq.wordId,"mastered")}
                    style={{padding:"3px 10px",borderRadius:"6px",background:"rgba(60,180,100,0.15)",border:"1px solid rgba(60,180,100,0.4)",color:"#60c880",fontSize:"0.72rem",cursor:"pointer",fontWeight:600}}>
                    ✅ {uiLang==="en"?"Mark Done":"암기완료"}
                  </button>}
                  {w.status!=="learning"&&<button onClick={()=>setManualStatus(eq.wordId,"learning")}
                    style={{padding:"3px 10px",borderRadius:"6px",background:"rgba(120,120,160,0.15)",border:"1px solid rgba(120,120,160,0.3)",color:"#9090b0",fontSize:"0.72rem",cursor:"pointer",fontWeight:600}}>
                    📖 {uiLang==="en"?"Learning":"학습중"}
                  </button>}
                </div>}
              </>);
            })()}

            <div className="quiz-btn-row" style={S.quizBtnRow}>
              {!essayConfirmed
                ?<button style={S.btnEssayConfirm} onClick={handleEssayConfirm}>{T.confirm}</button>
                :<button style={S.btnNext} onClick={handleEssayNext}>{essayCurrent+1>=essayQuestions.length?T.finish:T.next}</button>}
              <button style={S.btnQuit} onClick={()=>{window.speechSynthesis?.cancel();setMode(MODES.LIST);}}>{T.quit}</button>
            </div>
          </div>
        )}

        {/* ── VARIANT QUIZ MODE ── */}
        {mode===MODES.VARIANT&&variantQuestions[variantCur]&&(()=>{
          const vq=variantQuestions[variantCur];
          const vt=VARIANT_TYPES.find(t=>t.id===vq.variantType);
          const prog=((variantCur+(variantConfirmed?1:0))/variantQuestions.length)*100;
          const lastResult=variantResults[variantResults.length-1];
          return(
            <div>
              <div style={{...S.progressBar,background:"rgba(80,160,120,0.15)"}}><div style={{...S.progressFill,width:`${prog}%`,background:"linear-gradient(90deg,#50c898,#70e8b8)"}}/></div>
              <div style={S.progressLabel}>
                <span>🔀 {variantCur+1} / {variantQuestions.length}</span>
                <span style={{color:"#50c898",fontWeight:600}}>정답 {variantResults.filter(r=>r.correct).length} / {variantCur+(variantConfirmed?1:0)}</span>
              </div>
              <div style={{...S.questionCard,border:"1px solid rgba(80,160,120,0.3)"}}>
                {/* 문제 유형 태그 */}
                <div style={{...S.questionTag,color:"#50c898",fontSize:"0.85rem",marginBottom:"10px"}}>{vt?vt.prompt[uiLang]||vt.prompt.ko:vq.variantType}</div>
                {/* 기본형 — 크게 */}
                <div style={{fontFamily:"Arial",fontSize:"clamp(2.5rem,9vw,4rem)",direction:"rtl",color:"#f0ece0",marginBottom:"6px",lineHeight:1.2}}>{vq.base}</div>
                {/* 뜻 */}
                <div style={{fontSize:"1rem",color:"#a0a0c0",marginBottom:"16px"}}>{vq.meaning}</div>
                <div style={{display:"flex",alignItems:"center",gap:"8px",justifyContent:"center"}}>
                  <SpeakBtn text={vq.base} onSpeak={speakOnDemand} muted={muted} size="lg"/>
                </div>
              </div>

              {/* 서술형 입력 */}
              {variantQuizType==="essay"&&(
                <>
                  <input
                    ref={variantInputRef}
                    style={{...S.input,fontSize:"1.3rem",fontFamily:"Arial",direction:"rtl",marginBottom:"12px",
                      ...(variantConfirmed?{borderColor:lastResult?.correct?"rgba(60,180,100,0.6)":"rgba(200,60,60,0.6)"}:{})}}
                    placeholder="변형을 히브리어로 입력..."
                    value={variantInput} onChange={e=>!variantConfirmed&&setVariantInput(e.target.value)}
                    onKeyDown={e=>{if(e.key==="Enter"){if(!variantConfirmed)handleVariantConfirm();else handleVariantNext();}}}
                    readOnly={variantConfirmed} lang="he" spellCheck={false} autoCorrect="off"/>
                  {variantConfirmed&&(
                    <div style={{marginBottom:"10px",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px"}}>
                      {lastResult?.correct
                        ?<div style={{...S.feedbackCorrect,padding:"8px 16px"}}>✅ 정답!</div>
                        :<div style={{...S.feedbackWrong,padding:"8px 16px",display:"flex",alignItems:"center",gap:"8px"}}>
                          ❌ 정답: <b style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.2rem"}}>{vq.answer}</b>
                          <SpeakBtn text={vq.answer} onSpeak={speakOnDemand} muted={muted}/>
                        </div>}
                    </div>
                  )}
                </>
              )}

              {/* 객관식 보기 */}
              {variantQuizType==="mcq"&&(
                <>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"12px"}}>
                    {(vq.choices||[]).map((choice,ci)=>{
                      const isSelected=variantSelected===choice;
                      const isCorrect=variantConfirmed&&choice===vq.answer;
                      const isWrong=variantConfirmed&&isSelected&&choice!==vq.answer;
                      return(
                        <button key={ci} onClick={()=>{if(!variantConfirmed){setVariantSelected(choice);}}}
                          style={{padding:"14px 10px",borderRadius:"12px",fontFamily:"Arial",direction:"rtl",
                            fontSize:"clamp(1rem,4vw,1.4rem)",fontWeight:600,cursor:variantConfirmed?"default":"pointer",
                            border:`2px solid ${isCorrect?"rgba(60,180,100,0.8)":isWrong?"rgba(200,60,60,0.8)":isSelected?"rgba(80,160,120,0.6)":"rgba(255,255,255,0.1)"}`,
                            background:isCorrect?"rgba(60,180,100,0.2)":isWrong?"rgba(200,60,60,0.15)":isSelected?"rgba(80,160,120,0.15)":"rgba(255,255,255,0.04)",
                            color:isCorrect?"#60e898":isWrong?"#f07070":isSelected?"#50c898":"#e8e6f0",
                            transition:"all 0.15s"}}>
                          {choice}
                        </button>
                      );
                    })}
                  </div>
                  {variantConfirmed&&(
                    <div style={{marginBottom:"10px",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px"}}>
                      {lastResult?.correct
                        ?<div style={{...S.feedbackCorrect,padding:"8px 16px"}}>✅ 정답!</div>
                        :<div style={{...S.feedbackWrong,padding:"8px 16px",display:"flex",alignItems:"center",gap:"8px"}}>
                          ❌ 정답: <b style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.2rem"}}>{vq.answer}</b>
                          <SpeakBtn text={vq.answer} onSpeak={speakOnDemand} muted={muted}/>
                        </div>}
                    </div>
                  )}
                </>
              )}
              {variantConfirmed&&(()=>{const vw=words.find(x=>x.id===vq.wordId);return vw?(
                <div style={{display:"flex",gap:"6px",marginBottom:"8px",justifyContent:"center",flexWrap:"wrap"}}>
                  {vw.status!=="hard"&&<button onClick={()=>setManualStatus(vq.wordId,"hard")}
                    style={{...S.statusBtn,opacity:1,background:"rgba(240,112,80,0.15)",borderColor:"rgba(240,112,80,0.4)",color:"#f07050",padding:"5px 12px",fontSize:"0.8rem"}}>
                    🔥 {uiLang==="en"?"Hard":"어려움"}
                  </button>}
                  {vw.status!=="mastered"&&<button onClick={()=>setManualStatus(vq.wordId,"mastered")}
                    style={{...S.statusBtn,opacity:1,background:"rgba(60,180,100,0.15)",borderColor:"rgba(60,180,100,0.4)",color:"#60c880",padding:"5px 12px",fontSize:"0.8rem"}}>
                    ✅ {uiLang==="en"?"Done":"암기완료"}
                  </button>}
                  {vw.status!=="learning"&&<button onClick={()=>setManualStatus(vq.wordId,"learning")}
                    style={{...S.statusBtn,opacity:1,background:"rgba(100,100,160,0.15)",borderColor:"rgba(100,100,160,0.4)",color:"#9090c0",padding:"5px 12px",fontSize:"0.8rem"}}>
                    📖 {uiLang==="en"?"Learning":"학습중"}
                  </button>}
                </div>
              ):null;})()}
              <div className="quiz-btn-row" style={S.quizBtnRow}>
                {!variantConfirmed
                  ?<button style={{...S.btnConfirm,background:"linear-gradient(135deg,#50c898,#70e8b8)",color:"#0f1a14",...(variantQuizType==="essay"?(!variantInput.trim()?S.btnDisabled:{}):(variantSelected===null?S.btnDisabled:{}))}}
                    onClick={handleVariantConfirm} disabled={variantQuizType==="essay"?!variantInput.trim():variantSelected===null}>{T.confirm}</button>
                  :<button style={{...S.btnNext,background:"linear-gradient(135deg,#50c898,#70e8b8)",color:"#0f1a14"}} onClick={handleVariantNext}>{variantCur+1>=variantQuestions.length?T.finish:T.next}</button>}
                <button style={S.btnQuit} onClick={()=>{window.speechSynthesis?.cancel();setMode(MODES.LIST);}}>{T.quit}</button>
              </div>
            </div>
          );
        })()}

        {/* ── VARIANT RESULT ── */}
        {mode===MODES.VARIANT_RESULT&&(
          <div style={S.resultWrap}>
            <div style={{...S.resultCircle,border:"3px solid rgba(80,160,120,0.5)",background:"rgba(80,160,120,0.1)"}}>
              <span style={{...S.resultScore,color:"#50c898"}}>{variantResults.filter(r=>r.correct).length}</span>
              <span style={S.resultTotal}>/{variantQuestions.length}</span>
            </div>
            <p style={{fontSize:"0.8rem",color:"#50c898",fontWeight:600,marginBottom:"4px"}}>🔀 변형 퀴즈 결과</p>
            <p style={S.resultMsg}>{variantResults.filter(r=>r.correct).length===variantQuestions.length?"🎉 완벽해요!":variantResults.filter(r=>r.correct).length>=variantQuestions.length*0.7?"👏 잘했어요!":"📖 틀린 변형을 복습해봐요!"}</p>
            <p style={S.resultPct}>정답률: {Math.round(variantResults.filter(r=>r.correct).length/variantQuestions.length*100)}%</p>
            <div style={S.wrongList}>
              <h3 style={{...S.wrongTitle,color:"#50c898"}}>📋 전체 결과</h3>
              {variantResults.map((r,i)=>{
                const vt=VARIANT_TYPES.find(t=>t.id===r.variantType);
                return(
                  <div key={i} style={{...S.wrongItem,flexDirection:"column",alignItems:"flex-start",gap:"3px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:"8px",width:"100%"}}>
                      <span style={{fontSize:"0.85rem"}}>{r.correct?"✅":"❌"}</span>
                      <span style={{fontFamily:"Arial",direction:"rtl",color:"#c4a050",fontSize:"1rem"}}>{r.base}</span>
                      <span style={{fontSize:"0.72rem",color:"#50c898",background:"rgba(80,160,120,0.15)",padding:"2px 6px",borderRadius:"4px"}}>{vt?vt.label[uiLang]||vt.label.ko:r.variantType}</span>
                      <SpeakBtn text={r.answer} onSpeak={speakOnDemand} muted={muted}/>
                    </div>
                    <div style={{paddingLeft:"28px",fontSize:"0.82rem"}}>
                      <span style={{color:"#7a7890"}}>입력: </span><span style={{color:r.correct?"#80e8a0":"#f08080",fontFamily:"Arial",direction:"rtl"}}>{r.userInput}</span>
                      {!r.correct&&<><span style={{color:"#7a7890",marginLeft:"8px"}}>정답: </span><span style={{color:"#50c898",fontFamily:"Arial",direction:"rtl"}}>{r.answer}</span></>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="result-btn-row" style={S.resultBtnRow}>
              <button style={{...S.btnStart,flex:1,background:"linear-gradient(135deg,#50c898,#70e8b8)",color:"#0f1a14"}} onClick={startVariantQuiz}>🔄 다시 풀기</button>
              <button style={{...S.btnQuit,flex:1}} onClick={()=>setMode(MODES.LIST)}>📚 단어장으로</button>
            </div>
          </div>
        )}

        {/* ── RESULT ── */}
        {mode===MODES.RESULT&&(
          <div style={S.resultWrap}>
            <div style={S.resultCircle}><span style={S.resultScore}>{score}</span><span style={S.resultTotal}>/{questions.length}</span></div>
            <p style={S.resultMsg}>{score===questions.length?"🎉 완벽해요!":score>=questions.length*0.7?"👏 잘했어요!":score>=questions.length*0.5?"💪 조금 더 연습해봐요!":"📖 틀린 단어를 복습해봐요!"}</p>
            <p style={S.resultPct}>정답률: {Math.round(score/questions.length*100)}%</p>
            <div style={S.resultStats}>{[["mastered","✅ 암기완료","#60c880"],["hard","🔥 어려움","#f07050"],["learning","📖 학습중","#9090b0"]].map(([st,label,color])=><div key={st} style={{...S.resultStatItem,color}}><span style={S.resultStatNum}>{words.filter(w=>w.status===st).length}</span><span style={S.resultStatLabel}>{label}</span></div>)}</div>
            {wrongWords.length>0&&<div style={S.wrongList}><h3 style={S.wrongTitle}>❌ 틀린 단어</h3>{wrongWords.map((q,i)=>{const w=words.find(x=>x.id===q.wordId);return w?<div key={i} style={S.wrongItem}><span style={{fontFamily:"Arial,sans-serif",fontSize:"1.1rem",direction:"rtl",color:"#c4a050",whiteSpace:"nowrap"}}>{w.hebrew}</span><SpeakBtn text={w.hebrew} onSpeak={speakOnDemand} muted={muted}/><span style={{color:"#a0a0b0",margin:"0 4px"}}>→</span><span style={{fontSize:"0.9rem"}}>{w.meaning}</span></div>:null;})}</div>}
            <div className="result-btn-row" style={S.resultBtnRow}><button style={{...S.btnStart,flex:1}} onClick={startQuiz}>🔄 다시 풀기</button><button style={{...S.btnQuit,flex:1}} onClick={()=>setMode(MODES.LIST)}>📚 단어장으로</button></div>
          </div>
        )}

        {/* ── ESSAY RESULT ── */}
        {mode===MODES.ESSAY_RESULT&&(
          <div style={S.resultWrap}>
            <div style={{...S.resultCircle,border:"3px solid rgba(100,80,200,0.5)",background:"rgba(100,80,200,0.1)"}}>
              <span style={{...S.resultScore,color:"#9060f0"}}>{essayScore+essayPartial}</span>
              <span style={S.resultTotal}>/{essayQuestions.length}</span>
            </div>
            <p style={S.resultMsg}>{essayScore===essayQuestions.length?"🎉 완벽해요!":(essayScore+essayPartial)>=essayQuestions.length*0.7?"👏 잘했어요!":"📖 틀린 단어를 복습해봐요!"}</p>
            <div style={{display:"flex",justifyContent:"center",gap:"20px",marginBottom:"20px",flexWrap:"wrap"}}>
              <div style={{textAlign:"center",color:"#60c880"}}><div style={{fontSize:"1.6rem",fontWeight:800}}>{essayScore}</div><div style={{fontSize:"0.72rem",opacity:0.7}}>✅ 완전 정답</div></div>
              <div style={{textAlign:"center",color:"#e8c875"}}><div style={{fontSize:"1.6rem",fontWeight:800}}>{essayPartial}</div><div style={{fontSize:"0.72rem",opacity:0.7}}>🟡 부분 정답</div></div>
              <div style={{textAlign:"center",color:"#f08080"}}><div style={{fontSize:"1.6rem",fontWeight:800}}>{essayQuestions.length-essayScore-essayPartial}</div><div style={{fontSize:"0.72rem",opacity:0.7}}>❌ 오답</div></div>
            </div>
            <div style={S.wrongList}>
              <h3 style={{...S.wrongTitle,color:"#c4a050"}}>📋 전체 결과</h3>
              {essayResults.map((r,i)=>{
                const color=r.result==="exact"?"#60c880":r.result==="partial"?"#e8c875":"#f08080";
                const icon=r.result==="exact"?"✅":r.result==="partial"?"🟡":"❌";
                return<div key={i} style={{...S.wrongItem,flexDirection:"column",alignItems:"flex-start",gap:"4px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"8px",width:"100%"}}>
                    <span style={{fontFamily:r.questionType==="mean_to_heb"?"inherit":"Arial,sans-serif",fontSize:r.questionType==="mean_to_heb"?"0.95rem":"1.1rem",direction:r.questionType==="mean_to_heb"?"ltr":"rtl",color:"#c4a050"}}>{r.question}</span>
                    <SpeakBtn text={r.question} onSpeak={speakOnDemand} muted={muted}/>
                    <span style={{marginLeft:"auto"}}>{icon}</span>
                  </div>
                  <div style={{fontSize:"0.82rem",color:"#7a7890"}}>내 답: <span style={{color}}>{r.userInput}</span></div>
                  {r.result!=="exact"&&<div style={{fontSize:"0.82rem",color:"#a0a0c0"}}>정답: <span style={{color:"#60c880"}}>{r.answer}</span></div>}
                </div>;
              })}
            </div>
            <div className="result-btn-row" style={S.resultBtnRow}>
              <button style={{...S.btnEssayStart,flex:1}} onClick={startEssay}>🔄 다시 풀기</button>
              <button style={{...S.btnQuit,flex:1}} onClick={()=>setMode(MODES.LIST)}>📚 단어장으로</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const S={
  root:{minHeight:"100vh",background:"#0f0e17",color:"#e8e6f0",fontFamily:"Arial,'Noto Sans KR',sans-serif",position:"relative",overflow:"hidden",padding:"16px 0 80px"},
  bgDeco1:{position:"fixed",top:"-200px",right:"-200px",width:"500px",height:"500px",borderRadius:"50%",background:"radial-gradient(circle,rgba(196,160,80,0.12) 0%,transparent 70%)",pointerEvents:"none"},
  bgDeco2:{position:"fixed",bottom:"-150px",left:"-150px",width:"400px",height:"400px",borderRadius:"50%",background:"radial-gradient(circle,rgba(100,80,180,0.15) 0%,transparent 70%)",pointerEvents:"none"},
  container:{maxWidth:"700px",margin:"0 auto",padding:"0 12px",position:"relative",zIndex:1},
  toast:{position:"fixed",top:"16px",left:"50%",transform:"translateX(-50%)",background:"rgba(60,180,100,0.97)",color:"#fff",padding:"12px 22px",borderRadius:"12px",fontSize:"0.88rem",fontWeight:600,zIndex:1000,boxShadow:"0 4px 20px rgba(0,0,0,0.4)",whiteSpace:"nowrap",maxWidth:"90vw",textAlign:"center"},
  toastErr:{background:"rgba(200,60,60,0.97)"},
  autoSaveBanner:{background:"rgba(60,180,100,0.08)",border:"1px solid rgba(60,180,100,0.2)",borderRadius:"12px",padding:"10px 16px",marginBottom:"14px",fontSize:"0.82rem",color:"#60c880"},
  modalOverlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:900,padding:"16px"},
  modal:{background:"#1a1828",border:"1px solid rgba(196,160,80,0.3)",borderRadius:"20px",padding:"24px",maxWidth:"440px",width:"100%"},
  modalTitle:{margin:"0 0 6px",color:"#c4a050",fontSize:"1.05rem"},
  modalSub:{margin:"0 0 10px",color:"#7a7890",fontSize:"0.85rem"},
  modalTA:{width:"100%",height:"160px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"10px",color:"#e8e6f0",padding:"12px",fontSize:"0.82rem",resize:"vertical",outline:"none",fontFamily:"monospace",marginBottom:"12px"},
  modalPreview:{background:"rgba(255,255,255,0.04)",borderRadius:"10px",padding:"10px",marginBottom:"14px",maxHeight:"150px",overflowY:"auto"},
  modalPreviewItem:{padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",alignItems:"center",fontSize:"0.88rem",gap:"4px"},
  modalBtnRow:{display:"flex",gap:"8px"},
  btnMerge:{flex:1,padding:"12px 10px",borderRadius:"10px",background:"linear-gradient(135deg,#c4a050,#e8c875)",border:"none",color:"#1a1820",fontWeight:700,cursor:"pointer",fontSize:"0.88rem"},
  btnReplace:{flex:1,padding:"12px 10px",borderRadius:"10px",background:"rgba(100,80,200,0.3)",border:"1px solid rgba(100,80,200,0.5)",color:"#c0b0ff",fontWeight:600,cursor:"pointer",fontSize:"0.88rem"},
  btnCancel2:{padding:"12px 14px",borderRadius:"10px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#7a7890",cursor:"pointer",fontSize:"0.88rem"},
  header:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px",padding:"14px 16px",background:"rgba(255,255,255,0.04)",borderRadius:"16px",border:"1px solid rgba(196,160,80,0.2)"},
  headerLeft:{display:"flex",alignItems:"center",gap:"12px"},
  logo:{fontSize:"1.6rem",fontFamily:"Arial,sans-serif",color:"#c4a050",background:"rgba(196,160,80,0.15)",width:"44px",height:"44px",borderRadius:"10px",display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid rgba(196,160,80,0.3)",flexShrink:0},
  title:{margin:0,fontSize:"1rem",fontWeight:700,color:"#f0ece0"},
  subtitle:{margin:"2px 0 0",fontSize:"0.68rem",color:"#7a7890"},
  statsRow:{display:"flex",gap:"5px"},
  statBadge:{borderRadius:"8px",padding:"5px 9px",fontSize:"0.78rem",fontWeight:600},
  ioCard:{background:"rgba(196,160,80,0.06)",border:"1px solid rgba(196,160,80,0.15)",borderRadius:"14px",padding:"14px 16px",marginBottom:"14px"},
  ioTitle:{fontSize:"0.88rem",fontWeight:600,color:"#c4a050",marginBottom:"3px"},
  ioSub:{fontSize:"0.74rem",color:"#5a5870"},
  btnIO:(color,bg,border)=>({padding:"9px 12px",borderRadius:"9px",background:bg,border:`1px solid ${border}`,color,fontWeight:600,cursor:"pointer",fontSize:"0.8rem"}),
  card:{background:"rgba(255,255,255,0.04)",borderRadius:"16px",border:"1px solid rgba(255,255,255,0.08)",padding:"16px",marginBottom:"12px"},
  cardTitle:{margin:"0 0 12px",fontSize:"0.9rem",fontWeight:600,color:"#c4a050"},
  formRow:{display:"flex",gap:"8px",flexDirection:"column"},
  input:{width:"100%",padding:"12px 14px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"10px",color:"#e8e6f0",fontSize:"1rem",outline:"none",fontFamily:"inherit"},
  btnAdd:{padding:"12px 18px",borderRadius:"10px",background:"linear-gradient(135deg,#c4a050,#e8c875)",border:"none",color:"#1a1820",fontWeight:700,cursor:"pointer",fontSize:"0.95rem"},
  btnCancel:{padding:"12px 14px",borderRadius:"10px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",color:"#a0a0b0",cursor:"pointer",fontSize:"0.9rem"},
  scrollBtn:{padding:"6px 12px",borderRadius:"8px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.12)",color:"#a0a0c0",cursor:"pointer",fontSize:"0.78rem"},
  floatBtn:{position:"fixed",right:"16px",bottom:"20px",width:"44px",height:"44px",borderRadius:"50%",background:"rgba(196,160,80,0.9)",border:"none",color:"#1a1820",fontWeight:700,fontSize:"1.1rem",cursor:"pointer",zIndex:500,boxShadow:"0 4px 14px rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center"},
  filterTabs:{display:"flex",gap:"6px",marginBottom:"12px",alignItems:"stretch",overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",msOverflowStyle:"none",paddingBottom:"2px"},
  filterTab:{padding:"7px 10px",borderRadius:"8px",border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"#7a7890",cursor:"pointer",fontSize:"0.78rem",display:"flex",alignItems:"center",gap:"4px",whiteSpace:"nowrap",flexShrink:0},
  filterTabActive:{background:"rgba(196,160,80,0.15)",borderColor:"rgba(196,160,80,0.4)",color:"#c4a050"},
  filterCnt:{background:"rgba(255,255,255,0.1)",borderRadius:"4px",padding:"1px 5px",marginLeft:"4px",fontSize:"0.7rem"},
  wordList:{display:"flex",flexDirection:"column",gap:"8px",marginBottom:"12px"},
  emptyMsg:{textAlign:"center",color:"#4a4860",padding:"24px",fontSize:"0.9rem"},
  wordItem:{display:"flex",alignItems:"center",gap:"10px",background:"rgba(255,255,255,0.03)",borderRadius:"12px",border:"1px solid",padding:"12px 14px"},
  wordIndex:{fontSize:"0.7rem",color:"#4a4860",minWidth:"16px",flexShrink:0},
  wordCenter:{display:"flex",flexDirection:"column",gap:"4px",flex:1,minWidth:0},
  wordHeb:{fontFamily:"Arial,sans-serif",fontSize:"1.15rem",color:"#c4a050",direction:"rtl"},
  wordMean:{fontSize:"0.82rem",color:"#a0a0c0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},
  wordRight:{display:"flex",flexDirection:"column",gap:"3px",alignItems:"flex-end",flexShrink:0,width:"80px"},
  statusBtns:{display:"flex",gap:"3px",justifyContent:"flex-end"},
  statusBtn:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"6px",padding:"4px 8px",cursor:"pointer",fontSize:"0.9rem",opacity:0.45},
  wordActions:{display:"flex",gap:"2px",justifyContent:"flex-end"},
  btnEdit:{background:"transparent",border:"none",cursor:"pointer",fontSize:"0.9rem",opacity:0.45,padding:"2px 4px"},
  btnDel:{background:"transparent",border:"none",cursor:"pointer",fontSize:"0.9rem",opacity:0.45,padding:"2px 4px"},
  settingLabel:{margin:"0 0 8px",fontSize:"0.72rem",color:"#5a5870",textTransform:"uppercase",letterSpacing:"0.8px",fontWeight:600},
  optionRow:{display:"flex",gap:"6px",marginBottom:"12px",flexWrap:"wrap"},
  optBtn:{padding:"9px 13px",borderRadius:"9px",border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"#7a7890",cursor:"pointer",fontSize:"0.82rem"},
  optBtnActive:{background:"rgba(196,160,80,0.15)",borderColor:"rgba(196,160,80,0.4)",color:"#c4a050"},
  essayOptActive:{background:"rgba(100,80,200,0.2)",borderColor:"rgba(100,80,200,0.5)",color:"#c0b0ff"},
  sliderWrap:{display:"flex",alignItems:"center",gap:"10px",marginBottom:"14px",padding:"10px 14px",background:"rgba(255,255,255,0.03)",borderRadius:"10px",border:"1px solid rgba(255,255,255,0.06)"},
  sliderLabel:{fontSize:"0.8rem",color:"#5a5870",flexShrink:0},
  slider:{flex:1,accentColor:"#c4a050",cursor:"pointer"},
  sliderVal:{fontSize:"0.88rem",fontWeight:700,color:"#c4a050",minWidth:"44px",textAlign:"right",flexShrink:0},
  autoPlayRow:{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(196,160,80,0.06)",border:"1px solid rgba(196,160,80,0.15)",borderRadius:"12px",padding:"12px 14px",marginBottom:"14px"},
  toggleBtn:{padding:"7px 16px",borderRadius:"20px",border:"none",fontWeight:700,cursor:"pointer",fontSize:"0.85rem"},
  toggleOn:{background:"linear-gradient(135deg,#c4a050,#e8c875)",color:"#1a1820"},
  toggleOff:{background:"rgba(255,255,255,0.08)",color:"#7a7890"},
  btnStart:{width:"100%",padding:"14px",borderRadius:"12px",background:"linear-gradient(135deg,#c4a050,#e8c875)",border:"none",color:"#1a1820",fontWeight:800,cursor:"pointer",fontSize:"1rem"},
  btnEssayStart:{width:"100%",padding:"14px",borderRadius:"12px",background:"linear-gradient(135deg,#6040c8,#9060f0)",border:"none",color:"#fff",fontWeight:800,cursor:"pointer",fontSize:"1rem"},
  btnEssayConfirm:{flex:1,padding:"15px",borderRadius:"12px",background:"linear-gradient(135deg,#6040c8,#9060f0)",border:"none",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:"1rem"},
  btnDisabled:{opacity:0.4,cursor:"not-allowed"},
  progressBar:{height:"5px",background:"rgba(255,255,255,0.08)",borderRadius:"3px",marginBottom:"10px",overflow:"hidden"},
  progressFill:{height:"100%",background:"linear-gradient(90deg,#c4a050,#e8c875)",borderRadius:"3px",transition:"width 0.4s ease"},
  progressLabel:{display:"flex",justifyContent:"space-between",fontSize:"0.82rem",color:"#5a5870",marginBottom:"16px"},
  scoreLabel:{color:"#c4a050",fontWeight:600},
  questionCard:{background:"rgba(255,255,255,0.04)",borderRadius:"20px",border:"1px solid rgba(196,160,80,0.2)",padding:"28px 20px",textAlign:"center",marginBottom:"16px"},
  questionTag:{fontSize:"0.7rem",color:"#c4a050",letterSpacing:"1px",textTransform:"uppercase",marginBottom:"14px"},
  questionText:{color:"#f0ece0",lineHeight:1.3,wordBreak:"break-word"},
  statusPill:{display:"inline-block",borderRadius:"20px",padding:"4px 12px",fontSize:"0.75rem",fontWeight:600,marginTop:"14px"},
  choicesGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"14px"},
  choiceBtn:{padding:"14px 12px",borderRadius:"12px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:"#c8c6d8",cursor:"pointer",fontSize:"0.88rem",textAlign:"left",display:"flex",alignItems:"center",gap:"10px",fontFamily:"inherit",minHeight:"56px",width:"100%"},
  choiceSelected:{background:"rgba(100,80,200,0.2)",borderColor:"rgba(100,80,200,0.6)",color:"#d0c8ff"},
  choiceCorrect:{background:"rgba(60,180,100,0.2)",borderColor:"rgba(60,180,100,0.6)",color:"#80e8a0"},
  choiceWrong:{background:"rgba(200,60,60,0.2)",borderColor:"rgba(200,60,60,0.5)",color:"#f08080"},
  choiceAlpha:{width:"26px",height:"26px",borderRadius:"6px",background:"rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.72rem",fontWeight:700,flexShrink:0},
  feedbackCorrect:{display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",flexWrap:"wrap",textAlign:"center",padding:"12px",borderRadius:"10px",background:"rgba(60,180,100,0.15)",border:"1px solid rgba(60,180,100,0.3)",color:"#80e8a0",fontWeight:600,marginBottom:"14px",fontSize:"0.95rem"},
  feedbackWrong:{display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",flexWrap:"wrap",textAlign:"center",padding:"12px",borderRadius:"10px",background:"rgba(200,60,60,0.15)",border:"1px solid rgba(200,60,60,0.3)",color:"#f08080",fontWeight:600,marginBottom:"14px",fontSize:"0.95rem"},
  quizBtnRow:{display:"flex",gap:"10px"},
  btnConfirm:{flex:1,padding:"15px",borderRadius:"12px",background:"linear-gradient(135deg,#c4a050,#e8c875)",border:"none",color:"#1a1820",fontWeight:700,cursor:"pointer",fontSize:"1rem"},
  btnNext:{flex:1,padding:"15px",borderRadius:"12px",background:"linear-gradient(135deg,#6040c8,#9060f0)",border:"none",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:"1rem"},
  btnQuit:{padding:"15px 16px",borderRadius:"12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"#7a7890",cursor:"pointer",fontSize:"0.9rem"},
  resultWrap:{textAlign:"center",padding:"16px 0"},
  resultCircle:{width:"120px",height:"120px",borderRadius:"50%",background:"rgba(196,160,80,0.1)",border:"3px solid rgba(196,160,80,0.4)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"},
  resultScore:{fontSize:"2.4rem",fontWeight:800,color:"#c4a050"},
  resultTotal:{fontSize:"1.1rem",color:"#5a5870",alignSelf:"flex-end",marginBottom:"8px"},
  resultMsg:{fontSize:"1.05rem",color:"#e8e6f0",marginBottom:"4px"},
  resultPct:{fontSize:"0.88rem",color:"#7a7890",marginBottom:"20px"},
  resultStats:{display:"flex",justifyContent:"center",gap:"24px",marginBottom:"20px"},
  resultStatItem:{display:"flex",flexDirection:"column",alignItems:"center"},
  resultStatNum:{fontSize:"1.6rem",fontWeight:800},
  resultStatLabel:{fontSize:"0.7rem",opacity:0.7,marginTop:"2px"},
  wrongList:{background:"rgba(255,255,255,0.04)",borderRadius:"14px",border:"1px solid rgba(200,60,60,0.2)",padding:"14px",marginBottom:"16px",textAlign:"left"},
  wrongTitle:{margin:"0 0 10px",fontSize:"0.88rem",color:"#f08080"},
  wrongItem:{padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",alignItems:"center",gap:"8px"},
  resultBtnRow:{display:"flex",gap:"10px"},
};
