/* eslint-disable */
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
  { id:1, hebrew:"שָׁלוֹם",    meaning:"평화 / 안녕",  status:"learning", streak:0, wrongCount:0 },
  { id:2, hebrew:"תּוֹדָה",    meaning:"감사합니다",    status:"learning", streak:0, wrongCount:0 },
  { id:3, hebrew:"בְּרֵאשִׁית", meaning:"태초에",       status:"learning", streak:0, wrongCount:0 },
  { id:4, hebrew:"אֱלֹהִים",   meaning:"하나님",       status:"learning", streak:0, wrongCount:0 },
  { id:5, hebrew:"אֶרֶץ",      meaning:"땅 / 나라",    status:"learning", streak:0, wrongCount:0 },
  { id:6, hebrew:"מַיִם",      meaning:"물",           status:"learning", streak:0, wrongCount:0 },
  { id:7, hebrew:"אוֹר",       meaning:"빛",           status:"learning", streak:0, wrongCount:0 },
  { id:8, hebrew:"לֵב",        meaning:"마음 / 심장",  status:"learning", streak:0, wrongCount:0 },
];
const MODES = { LIST:"list", QUIZ:"quiz", ESSAY:"essay", RESULT:"result", ESSAY_RESULT:"essay_result", VARIANT:"variant", VARIANT_RESULT:"variant_result" };
const QUIZ_TYPES = { HEB_TO_MEAN:"heb_to_mean", MEAN_TO_HEB:"mean_to_heb", MIXED:"mixed" };
const QUIZ_FILTERS = { ALL:"all", LEARNING_ONLY:"learning_only", EXCLUDE_MASTERED:"exclude_mastered", HARD_ONLY:"hard_only" };

const VARIANT_TYPES = [
  { id:"gender_f",  label:{ko:"여성형 단수",en:"Feminine sg."},   prompt:{ko:"여성형 단수는?",en:"Feminine singular?"} },
  { id:"gender_m",  label:{ko:"남성형 단수",en:"Masculine sg."},  prompt:{ko:"남성형 단수는?",en:"Masculine singular?"} },
  { id:"plural_m",  label:{ko:"남성형 복수",en:"Masculine pl."},  prompt:{ko:"남성형 복수는?",en:"Masculine plural?"} },
  { id:"plural_f",  label:{ko:"여성형 복수",en:"Feminine pl."},   prompt:{ko:"여성형 복수는?",en:"Feminine plural?"} },
  { id:"past_1s",   label:{ko:"과거 — 나 (אני)",en:"Past — I"},    prompt:{ko:"אני — 나는 ~했다",en:"אני (past)"} },
  { id:"past_2ms",  label:{ko:"과거 — 너M",en:"Past — You M"},    prompt:{ko:"אתה — 너는 ~했다",en:"אתה (past)"} },
  { id:"past_2fs",  label:{ko:"과거 — 너F",en:"Past — You F"},    prompt:{ko:"את — 너는 ~했다",en:"את (past)"} },
  { id:"past_3ms",  label:{ko:"과거 — 그",en:"Past — He"},        prompt:{ko:"הוא — 그는 ~했다",en:"הוא (past)"} },
  { id:"past_3fs",  label:{ko:"과거 — 그녀",en:"Past — She"},     prompt:{ko:"היא — 그녀는 ~했다",en:"היא (past)"} },
  { id:"past_1p",   label:{ko:"과거 — 우리",en:"Past — We"},      prompt:{ko:"אנחנו — 우리는 ~했다",en:"אנחנו (past)"} },
  { id:"past_2mp",  label:{ko:"과거 — 너희M",en:"Past — You pl.M"},prompt:{ko:"אתם — 너희는 ~했다",en:"אתם (past)"} },
  { id:"past_2fp",  label:{ko:"과거 — 너희F",en:"Past — You pl.F"},prompt:{ko:"אתן — 너희는 ~했다",en:"אתן (past)"} },
  { id:"past_3mp",  label:{ko:"과거 — 그들M",en:"Past — They M"}, prompt:{ko:"הם — 그들은 ~했다",en:"הם (past)"} },
  { id:"past_3fp",  label:{ko:"과거 — 그들F",en:"Past — They F"}, prompt:{ko:"הן — 그들은 ~했다",en:"הן (past)"} },
  { id:"pres_ms",   label:{ko:"현재 — M단수",en:"Present M sg."},  prompt:{ko:"현재 남단?",en:"M sg. (present)"} },
  { id:"pres_fs",   label:{ko:"현재 — F단수",en:"Present F sg."},  prompt:{ko:"현재 여단?",en:"F sg. (present)"} },
  { id:"pres_mp",   label:{ko:"현재 — M복수",en:"Present M pl."},  prompt:{ko:"현재 남복?",en:"M pl. (present)"} },
  { id:"pres_fp",   label:{ko:"현재 — F복수",en:"Present F pl."},  prompt:{ko:"현재 여복?",en:"F pl. (present)"} },
  { id:"fut_1s",    label:{ko:"미래 — 나",en:"Future — I"},        prompt:{ko:"아니 — 나는 ~할 것",en:"אני (future)"} },
  { id:"fut_2ms",   label:{ko:"미래 — 너M",en:"Future — You M"},   prompt:{ko:"아타 — 너는 ~할 것",en:"אתה (future)"} },
  { id:"fut_2fs",   label:{ko:"미래 — 너F",en:"Future — You F"},   prompt:{ko:"앗 — 너는 ~할 것",en:"את (future)"} },
  { id:"fut_3ms",   label:{ko:"미래 — 그",en:"Future — He"},       prompt:{ko:"후 — 그는 ~할 것",en:"הוא (future)"} },
  { id:"fut_3fs",   label:{ko:"미래 — 그녀",en:"Future — She"},    prompt:{ko:"히 — 그녀는 ~할 것",en:"היא (future)"} },
  { id:"fut_1p",    label:{ko:"미래 — 우리",en:"Future — We"},     prompt:{ko:"아나흐누 — 우리는 ~할 것",en:"אנחנו (future)"} },
  { id:"fut_2mp",   label:{ko:"미래 — 너희M",en:"Future — You pl.M"},prompt:{ko:"아템 — 너희는 ~할 것",en:"אתם (future)"} },
  { id:"fut_2fp",   label:{ko:"미래 — 너희F",en:"Future — You pl.F"},prompt:{ko:"아텐 — 너희는 ~할 것",en:"אתן (future)"} },
  { id:"fut_3mp",   label:{ko:"미래 — 그들M",en:"Future — They M"},prompt:{ko:"헴 — 그들은 ~할 것",en:"הם (future)"} },
  { id:"fut_3fp",   label:{ko:"미래 — 그들F",en:"Future — They F"},prompt:{ko:"헨 — 그들은 ~할 것",en:"הן (future)"} },
  { id:"imp_2ms",   label:{ko:"명령 — 너M",en:"Imp. — You M"},     prompt:{ko:"아타 — ~해라!",en:"אתה — Do!"} },
  { id:"imp_2fs",   label:{ko:"명령 — 너F",en:"Imp. — You F"},     prompt:{ko:"앗 — ~해라!",en:"את — Do!"} },
  { id:"imp_2mp",   label:{ko:"명령 — 너희M",en:"Imp. — You pl.M"},prompt:{ko:"아템 — ~해라!",en:"אתם — Do!"} },
  { id:"imp_2fp",   label:{ko:"명령 — 너희F",en:"Imp. — You pl.F"},prompt:{ko:"아텐 — ~해라!",en:"אתן — Do!"} },
  { id:"poss_1s",   label:{ko:"소유 — 나의",en:"Poss. — My"},      prompt:{ko:"나의 ~?",en:"My ~?"} },
  { id:"poss_2ms",  label:{ko:"소유 — 너의M",en:"Poss. — Your M"}, prompt:{ko:"너의 ~(남)?",en:"Your (M) ~?"} },
  { id:"poss_2fs",  label:{ko:"소유 — 너의F",en:"Poss. — Your F"}, prompt:{ko:"너의 ~(여)?",en:"Your (F) ~?"} },
  { id:"poss_3ms",  label:{ko:"소유 — 그의",en:"Poss. — His"},     prompt:{ko:"그의 ~?",en:"His ~?"} },
  { id:"poss_3fs",  label:{ko:"소유 — 그녀의",en:"Poss. — Her"},   prompt:{ko:"그녀의 ~?",en:"Her ~?"} },
  { id:"poss_1p",   label:{ko:"소유 — 우리의",en:"Poss. — Our"},   prompt:{ko:"우리의 ~?",en:"Our ~?"} },
  { id:"poss_2mp",  label:{ko:"소유 — 너희의M",en:"Poss. — Your pl.M"},prompt:{ko:"너희의 ~(남)?",en:"Your pl. (M) ~?"} },
  { id:"poss_2fp",  label:{ko:"소유 — 너희의F",en:"Poss. — Your pl.F"},prompt:{ko:"너희의 ~(여)?",en:"Your pl. (F) ~?"} },
  { id:"poss_3mp",  label:{ko:"소유 — 그들의M",en:"Poss. — Their M"},prompt:{ko:"그들의 ~(남)?",en:"Their (M) ~?"} },
  { id:"poss_3fp",  label:{ko:"소유 — 그들의F",en:"Poss. — Their F"},prompt:{ko:"그들의 ~(여)?",en:"Their (F) ~?"} },
  { id:"infinitive",label:{ko:"to부정사 (ל...)",en:"Infinitive"},   prompt:{ko:"동사 원형은?",en:"Infinitive form?"} },
];

const VARIANT_CATS = [
  { id:"gender",    label:{ko:"성별",      en:"Gender"},      color:"#E84A5F", types:["gender_f","gender_m"] },
  { id:"plural",    label:{ko:"복수",      en:"Plural"},      color:"#5B9CF6", types:["plural_m","plural_f"] },
  { id:"infinitive",label:{ko:"to부정사",  en:"Infinitive"},  color:"#50C898", types:["infinitive"] },
  { id:"present",   label:{ko:"현재형",    en:"Present"},     color:"#50C898", types:["pres_ms","pres_fs","pres_mp","pres_fp"] },
  { id:"past",      label:{ko:"과거형",    en:"Past"},        color:"#FF9A6C", types:["past_1s","past_2ms","past_2fs","past_3ms","past_3fs","past_1p","past_2mp","past_2fp","past_3mp","past_3fp"] },
  { id:"future",    label:{ko:"미래형",    en:"Future"},      color:"#5B9CF6", types:["fut_1s","fut_2ms","fut_2fs","fut_3ms","fut_3fs","fut_1p","fut_2mp","fut_2fp","fut_3mp","fut_3fp"] },
  { id:"imperative",label:{ko:"명령형",    en:"Imperative"},  color:"#E84A5F", types:["imp_2ms","imp_2fs","imp_2mp","imp_2fp"] },
  { id:"poss",      label:{ko:"소유격",    en:"Possessive"},  color:"#A78BFA", types:["poss_1s","poss_2ms","poss_2fs","poss_3ms","poss_3fs","poss_1p","poss_2mp","poss_2fp","poss_3mp","poss_3fp"] },
];

const WORD_TYPES = [
  { id:"verb",    label:{ko:"동사",   en:"Verb"},      emoji:"🔵", cats:["infinitive","past","present","future","imperative"] },
  { id:"noun",    label:{ko:"명사",   en:"Noun"},      emoji:"🟡", cats:["gender","plural","poss"] },
  { id:"adj",     label:{ko:"형용사", en:"Adjective"}, emoji:"🟠", cats:["gender","plural"] },
  { id:"pronoun", label:{ko:"대명사", en:"Pronoun"},   emoji:"🟣", cats:["gender","plural"] },
  { id:"other",   label:{ko:"기타",   en:"Other"},     emoji:"⚪", cats:["gender","plural","poss"] },
];

function getAllowedCats(wordType) {
  if(!wordType) return VARIANT_CATS;
  const wt=WORD_TYPES.find(t=>t.id===wordType); if(!wt) return VARIANT_CATS;
  return VARIANT_CATS.filter(c=>wt.cats.includes(c.id));
}

const VARIANT_PASTE_ORDER = [
  "gender_f","gender_m","plural_m","plural_f",
  "past_1s","past_2ms","past_2fs","past_3ms","past_3fs","past_1p","past_2mp","past_2fp","past_3mp","past_3fp",
  "pres_ms","pres_fs","pres_mp","pres_fp",
  "fut_1s","fut_2ms","fut_2fs","fut_3ms","fut_3fs","fut_1p","fut_2mp","fut_2fp","fut_3mp","fut_3fp",
  "imp_2ms","imp_2fs","imp_2mp","imp_2fp",
  "poss_1s","poss_2ms","poss_2fs","poss_3ms","poss_3fs","poss_1p","poss_2mp","poss_2fp","poss_3mp","poss_3fp","infinitive"
];

function getAllowedPasteOrder(wordType) {
  const allowed=new Set(getAllowedCats(wordType).flatMap(c=>c.types));
  return VARIANT_PASTE_ORDER.filter(t=>allowed.has(t));
}

const BOOKS = [
  { id:"hebrew",  label:{ko:"히브리어",en:"Hebrew"},  emoji:"🇮🇱", color:"#FF9A6C", ttsLang:"he-IL", ttsName:"he-IL-Neural2-A", ttsRate:0.9, termA:{ko:"히브리어",en:"Word"}, termB:{ko:"뜻",en:"Meaning"}, placeholderA:{ko:"עברית",en:"Hebrew word"}, placeholderB:{ko:"뜻 (한국어/영어)",en:"Meaning"}, dir:"rtl" },
  { id:"english", label:{ko:"영어",en:"English"},     emoji:"🇺🇸", color:"#5B9CF6", ttsLang:"en-US", ttsName:"en-US-Standard-C", ttsRate:0.9, termA:{ko:"영어 단어",en:"English"}, termB:{ko:"뜻",en:"Korean"}, placeholderA:{ko:"English word",en:"English word"}, placeholderB:{ko:"뜻 (한국어)",en:"Korean meaning"}, dir:"ltr" },
  { id:"korean",  label:{ko:"한국어",en:"Korean"},    emoji:"🇰🇷", color:"#E84A5F", ttsLang:"ko-KR", ttsName:"ko-KR-Standard-A", ttsRate:0.9, termA:{ko:"한국어",en:"Korean"}, termB:{ko:"뜻",en:"Meaning"}, placeholderA:{ko:"한국어 단어",en:"Korean word"}, placeholderB:{ko:"뜻 (영어)",en:"English meaning"}, dir:"ltr" },
];

const UI_TEXT = {
  ko:{
    appTitle:"히브리어 퀴즈", appSub:"Hebrew Vocabulary Trainer",
    addWord:"단어 추가", editWord:"단어 수정", addBtn:"추가", editBtn:"완료", cancelBtn:"취소",
    all:"전체", learning:"학습중", hard:"어려움", done:"완료",
    selectAll:"전체 선택", deselect:"해제", deleteN:(n)=>`${n}개 삭제`, wordCount:(n)=>`${n}개`,
    mcqTitle:"객관식", essayTitle:"서술형", variantQuizTitle:"변형 퀴즈",
    direction:"문제 방향", wordRange:"단어 범위", questionCount:"문제 수",
    dirAtoB:(b)=>`${b.termA.ko} → ${b.termB.ko}`, dirBtoA:(b)=>`${b.termB.ko} → ${b.termA.ko}`, mixed:"랜덤",
    allRange:(n)=>`전체 (${n})`, excludeMastered:(n)=>`암기 제외 (${n})`, hardOnly:(n)=>`어려운 것 (${n})`, learningOnly:(n)=>`학습중 (${n})`,
    startMCQ:(n)=>`객관식 시작 — ${n}문제`, needMore:(n)=>`단어 최소 4개 필요 (현재 ${n}개)`,
    essaySub:"직접 타이핑! 부분 정답도 인정됩니다.",
    startEssay:(n)=>`서술형 시작 — ${n}문제`,
    qTagAtoB:(b)=>`${b.termA.ko}의 ${b.termB.ko}는?`, qTagBtoA:(b)=>`${b.termB.ko}에 해당하는 ${b.termA.ko}는?`,
    inputA:(b)=>`${b.termB.ko}을 입력하세요...`, inputB:(b)=>`${b.termA.ko}로 입력하세요...`,
    correct:"정답", wrong:(a)=>`오답 — 정답: ${a}`,
    confirm:"확인", next:"다음 →", finish:"결과 보기", quit:"그만하기",
    login:"Google 로그인", logout:"로그아웃",
    tabList:"단어장", tabAdd:"추가", tabQuiz:"퀴즈", tabWallets:"단어장", tabSettings:"설정",
    sortDefault:"기본", sortHebAsc:"히브리어 ↑", sortHebDesc:"히브리어 ↓", sortMeanAsc:"뜻 ↑", sortMeanDesc:"뜻 ↓", sortHardFirst:"어려운 먼저", sortMasteredFirst:"암기 먼저", sortWrongFirst:"오답 많은 먼저",
    variantUnavailable:"변형 없음", variantTypeSelect:"변형 유형", allDeselect:"전체 해제", allSelectAll:"전체 선택",
    reversoImport:"Reverso 변형 가져오기", rootSearch:"어근으로 검색", importSearch:"뜻으로 검색",
    textAdd:"텍스트 일괄 추가", csvExcel:"CSV/엑셀 가져오기",
    cardStyle:"카드 스타일", menuStyle:"메뉴형", inlineStyle:"인라인형",
    soundSetting:"발음 설정", soundAuto:"자동", soundManual:"수동", soundMute:"음소거",
    saveLoad:"저장 / 불러오기", fileSave:"⬇ 파일 저장", copy:"📋 복사", fileOpen:"⬆ 불러오기", paste:"붙여넣기 불러오기",
    addToWordbook:"단어장 추가",
  },
  en:{
    appTitle:"Vocabulary Quiz", appSub:"Multi-language Trainer",
    addWord:"Add Word", editWord:"Edit Word", addBtn:"Add", editBtn:"Save", cancelBtn:"Cancel",
    all:"All", learning:"Learning", hard:"Hard", done:"Done",
    selectAll:"Select All", deselect:"Deselect", deleteN:(n)=>`Delete ${n}`, wordCount:(n)=>`${n} words`,
    mcqTitle:"Multiple Choice", essayTitle:"Written Test", variantQuizTitle:"Variant Quiz",
    direction:"Direction", wordRange:"Word Range", questionCount:"Questions",
    dirAtoB:(b)=>`${b.termA.en} → ${b.termB.en}`, dirBtoA:(b)=>`${b.termB.en} → ${b.termA.en}`, mixed:"Random",
    allRange:(n)=>`All (${n})`, excludeMastered:(n)=>`Excl. Mastered (${n})`, hardOnly:(n)=>`Hard Only (${n})`, learningOnly:(n)=>`Learning (${n})`,
    startMCQ:(n)=>`Start MCQ — ${n} questions`, needMore:(n)=>`Need at least 4 words (now ${n})`,
    essaySub:"Type your answer! Partial answers accepted.",
    startEssay:(n)=>`Start Written — ${n} questions`,
    qTagAtoB:(b)=>`What is the ${b.termB.en}?`, qTagBtoA:(b)=>`What is the ${b.termA.en}?`,
    inputA:(b)=>`Type the ${b.termB.en}...`, inputB:(b)=>`Type the ${b.termA.en}...`,
    correct:"Correct!", wrong:(a)=>`Wrong — Answer: ${a}`,
    confirm:"Check", next:"Next →", finish:"See Results", quit:"Quit",
    login:"Sign in with Google", logout:"Sign out",
    tabList:"Words", tabAdd:"Add", tabQuiz:"Quiz", tabWallets:"Books", tabSettings:"Settings",
    sortDefault:"Default", sortHebAsc:"Word ↑", sortHebDesc:"Word ↓", sortMeanAsc:"Meaning ↑", sortMeanDesc:"Meaning ↓", sortHardFirst:"Hard first", sortMasteredFirst:"Mastered first", sortWrongFirst:"Most wrong first",
    variantUnavailable:"No variants", variantTypeSelect:"Variant types", allDeselect:"Deselect All", allSelectAll:"Select All",
    reversoImport:"Reverso Conjugation", rootSearch:"Root Search", importSearch:"Search by Meaning",
    textAdd:"Batch Text Add", csvExcel:"CSV/Excel Import",
    cardStyle:"Card Style", menuStyle:"Menu", inlineStyle:"Inline",
    soundSetting:"Sound", soundAuto:"Auto", soundManual:"Manual", soundMute:"Mute",
    saveLoad:"Save / Load", fileSave:"⬇ Export", copy:"📋 Copy", fileOpen:"⬆ Import", paste:"Paste Import",
    addToWordbook:"Add to Wordbook",
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
const TB="#09080D",TS="#0F0E14",TS2="#151320";
const TA="#E84A5F",TH="#FF9A6C",TG="#50C898",TBL="#5B9CF6",TP="#A78BFA";
const TT="#F0EDE8",TM="rgba(240,237,232,0.45)",TD="rgba(240,237,232,0.2)",TL="rgba(255,255,255,0.06)";

function stripNikkud(t){return t.replace(/[\u0591-\u05C7]/g,"");}
function shuffle(a){return[...a].sort(()=>Math.random()-0.5);}
function loadWords(book){try{const k=book&&book!=="hebrew"?getLSKey(book):LS_KEY;const s=localStorage.getItem(k);if(s)return JSON.parse(s);}catch{}return book&&book!=="hebrew"?[]:DEFAULT_WORDS;}
function saveWords(words,book){try{const k=book&&book!=="hebrew"?getLSKey(book):LS_KEY;localStorage.setItem(k,JSON.stringify(words));}catch{}}

function checkEssayAnswer(u,c){const n=s=>s.trim().toLowerCase().replace(/[\/\-,.·]/g," ").replace(/\s+/g," ").trim();const uu=n(u),cc=n(c);if(uu===cc) return"exact";const cw=cc.split(" ").filter(w=>w.length>1),uw=uu.split(" ").filter(w=>w.length>1);const m=cw.filter(w=>uw.some(x=>x.includes(w)||w.includes(x)));if(m.length>=Math.ceil(cw.length*0.6)) return"partial";return"wrong";}

function generateQuestion(word,allWords,type){
  let t=type===QUIZ_TYPES.MIXED?(word.meaning&&Math.random()>0.5?QUIZ_TYPES.MEAN_TO_HEB:QUIZ_TYPES.HEB_TO_MEAN):type;
  if(t===QUIZ_TYPES.MEAN_TO_HEB&&!word.meaning) t=QUIZ_TYPES.HEB_TO_MEAN;
  const q=t===QUIZ_TYPES.HEB_TO_MEAN?word.hebrew:word.meaning;
  const a=t===QUIZ_TYPES.HEB_TO_MEAN?word.meaning:word.hebrew;
  const pool=allWords.filter(w=>w.id!==word.id&&(t===QUIZ_TYPES.HEB_TO_MEAN?!!w.meaning:!!w.hebrew));
  const seen=new Set([a]);const dist=[];
  for(const w of shuffle(pool)){const v=t===QUIZ_TYPES.HEB_TO_MEAN?w.meaning:w.hebrew;if(!seen.has(v)){seen.add(v);dist.push(v);}if(dist.length>=3)break;}
  while(dist.length<3) dist.push("—");
  return{question:q,answer:a,choices:shuffle([a,...dist]),questionType:t,wordId:word.id};
}

function parseVariantExcel(rows){
  if(!rows.length) return{};
  const header=rows[0].map(h=>String(h||""));const result={};const variantCols=[];
  const map={"여성형":"gender_f","gender_f":"gender_f","여성":"gender_f","남성형":"gender_m","gender_m":"gender_m","남성":"gender_m","복수 남성형":"plural_m","plural_m":"plural_m","복수 여성형":"plural_f","plural_f":"plural_f","소유 1인칭":"poss_1s","poss_1s":"poss_1s","소유 2인칭(남)":"poss_2ms","소유 2인칭(여)":"poss_2fs"};
  for(let ci=2;ci<header.length;ci++){const norm=String(header[ci]).replace(/\n.*/,"").replace(/\(.*?\)/g,"").trim().toLowerCase();const mapped=map[norm]||map[header[ci].toLowerCase()];if(mapped) variantCols.push({colIdx:ci,type:mapped});}
  for(let i=1;i<rows.length;i++){const heb=String(rows[i][0]||"").trim();const mean=String(rows[i][1]||"").trim();if(!heb) continue;if(!result[heb]) result[heb]={meaning:mean,variants:[]};for(const{colIdx,type}of variantCols){const form=String(rows[i][colIdx]||"").trim();if(form) result[heb].variants.push({type,form});}}
  return result;
}

let _currentAudio=null;
async function googleTTS(text,apiKey,lang="he-IL",name="he-IL-Wavenet-A",rate=0.9){
  const names=lang.startsWith("he")?["he-IL-Neural2-A","he-IL-Wavenet-A","he-IL-Standard-A"]:[name];
  for(const n of names){try{const res=await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({input:{text},voice:{languageCode:lang,name},audioConfig:{audioEncoding:"MP3",speakingRate:rate,pitch:0}})});if(!res.ok) continue;const d=await res.json();if(d.audioContent){const audio=new Audio(`data:audio/mp3;base64,${d.audioContent}`);_currentAudio=audio;audio.play();return;}}catch{}}
  throw new Error("TTS error");
}
function browserTTS(text,lang="he-IL",rate=0.9){if(!window.speechSynthesis) return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(lang.startsWith("he")?stripNikkud(text):text);u.lang=lang;u.rate=rate;window.speechSynthesis.speak(u);}

function parseCSV(text){const lines=text.split(/\r?\n/).filter(l=>l.trim());const r=[];for(const line of lines){let cols=[];if(/\t|;/.test(line)){cols=line.split(/[\t;]/).map(c=>c.trim().replace(/^["']|["']$/g,""));}else{const re=/("([^"]*)")|([^,]+)/g;let m;while((m=re.exec(line))!==null)cols.push((m[2]!==undefined?m[2]:m[3]).trim());}if(cols.length>=2&&cols[0]&&cols[1])r.push({hebrew:cols[0],meaning:cols[1]});}return r;}
function parseTextFormat(text){const lines=text.split(/\r?\n/).filter(l=>l.trim());const r=[];for(const l of lines){const i=l.search(/[=:]/);if(i>0){const a=l.slice(0,i).trim();const b=l.slice(i+1).trim();if(a&&b)r.push({hebrew:a,meaning:b});}}return r;}

// ── Speak components ─────────────────────────────────────────
function SpeakBtn({text,onSpeak,size="md",muted=false}){
  const [p,setP]=useState(false);
  const h=async(e)=>{e.stopPropagation();if(muted)return;setP(true);try{await onSpeak(text);}catch{}setTimeout(()=>setP(false),1200);};
  return<button onClick={h} style={{background:muted?"transparent":p?`rgba(232,74,95,0.18)`:"rgba(255,255,255,0.04)",border:`1px solid ${muted?"rgba(255,255,255,0.05)":p?"rgba(232,74,95,0.45)":TL}`,borderRadius:"2px",cursor:muted?"default":"pointer",padding:size==="lg"?"9px 15px":"4px 8px",fontSize:size==="lg"?"0.95rem":"0.82rem",lineHeight:1,flexShrink:0,opacity:muted?0.22:1,color:p?TA:TM,transition:"all 0.15s"}}>{muted?"○":p?"▶":"▷"}</button>;
}
function SpeakOnceBtn({text,onSpeak,muted=false,repeatN=1}){
  const [p,setP]=useState(false);const [cnt,setCnt]=useState(0);const stopRef=useRef(false);
  const stop=()=>{stopRef.current=true;window.speechSynthesis?.cancel();if(_currentAudio){_currentAudio.pause();_currentAudio=null;}setP(false);setCnt(0);};
  const h=async(e)=>{e.stopPropagation();if(muted)return;if(p){stop();return;}stopRef.current=false;setP(true);for(let i=0;i<repeatN;i++){if(stopRef.current)break;setCnt(i+1);try{await onSpeak(text);}catch{}if(i<repeatN-1)await new Promise(r=>setTimeout(r,1400));}setP(false);setCnt(0);};
  return<button onClick={h} style={{background:p?"rgba(232,74,95,0.12)":"rgba(255,255,255,0.04)",border:`1px solid ${p?"rgba(232,74,95,0.4)":TL}`,borderRadius:"2px",cursor:muted?"default":"pointer",padding:"4px 8px",fontSize:"0.8rem",lineHeight:1,opacity:muted?0.22:1,color:p?TA:TM}}>{p?`■ ${cnt}`:"▷"}</button>;
}
function RepeatSpeakBtn({text,onSpeak,muted=false}){
  const [p,setP]=useState(false);const [cnt,setCnt]=useState(0);const [rm,setRm]=useState(1);const stopRef=useRef(false);
  const hs=async(e)=>{e.stopPropagation();if(muted||p)return;stopRef.current=false;setP(true);for(let i=0;i<rm;i++){if(stopRef.current)break;setCnt(i+1);try{await onSpeak(text);}catch{}if(i<rm-1)await new Promise(r=>setTimeout(r,1400));}setP(false);setCnt(0);};
  const hst=(e)=>{e.stopPropagation();stopRef.current=true;window.speechSynthesis?.cancel();setP(false);setCnt(0);};
  return<div style={{display:"flex",alignItems:"center",gap:"4px"}}>
    {[1,5,10].map(m=><button key={m} onClick={e=>{e.stopPropagation();if(!p)setRm(m);}} style={{padding:"4px 7px",borderRadius:"2px",border:"1px solid",fontSize:"0.62rem",fontWeight:700,cursor:p?"not-allowed":"pointer",background:rm===m?"rgba(232,74,95,0.18)":"rgba(255,255,255,0.03)",borderColor:rm===m?"rgba(232,74,95,0.5)":TL,color:rm===m?TA:TD}}>{m}×</button>)}
    <button onClick={p?hst:hs} style={{background:muted?"transparent":p?"rgba(232,74,95,0.12)":"rgba(255,255,255,0.04)",border:`1px solid ${muted?"transparent":p?"rgba(232,74,95,0.4)":TL}`,borderRadius:"2px",cursor:muted?"default":"pointer",padding:"9px 15px",fontSize:"0.92rem",lineHeight:1,opacity:muted?0.22:1,color:p?TA:TM}}>{muted?"○":p?`■ ${cnt}/${rm}`:"▷"}</button>
  </div>;
}

// ── Main App ──────────────────────────────────────────────────
// ── Style helpers ─────────────────────────────────────────────
const SL={margin:"0 0 6px",fontSize:"0.58rem",color:TD,textTransform:"uppercase",letterSpacing:"1.5px",fontWeight:600};
const OR={display:"flex",gap:"5px",marginBottom:"12px",flexWrap:"wrap"};
const Mo={overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:900,padding:"16px"},box:{background:TS,border:`1px solid rgba(255,255,255,0.07)`,borderRadius:"2px",padding:"22px",maxWidth:"440px",width:"100%",boxShadow:"0 24px 60px rgba(0,0,0,0.7)"},title:{margin:"0 0 6px",color:TT,fontSize:"0.92rem",fontWeight:600},sub:{margin:"0 0 10px",color:TD,fontSize:"0.78rem"},ta:{width:"100%",height:"145px",background:"rgba(255,255,255,0.03)",border:`1px solid ${TL}`,borderRadius:"2px",color:TT,padding:"10px",fontSize:"0.78rem",resize:"vertical",outline:"none",fontFamily:"monospace",marginBottom:"10px"},row:{display:"flex",gap:"6px"}};
const Bt={primary:{padding:"9px 17px",borderRadius:"2px",background:TA,border:"none",color:"#fff",fontWeight:600,cursor:"pointer",fontSize:"0.8rem"},ghost:{padding:"8px 13px",borderRadius:"2px",background:"transparent",border:`1px solid ${TL}`,color:TM,cursor:"pointer",fontSize:"0.8rem"},green:{padding:"9px 17px",borderRadius:"2px",background:TG,border:"none",color:"#071a0e",fontWeight:600,cursor:"pointer",fontSize:"0.8rem"},essay:{padding:"9px 17px",borderRadius:"2px",background:TP,border:"none",color:"#fff",fontWeight:600,cursor:"pointer",fontSize:"0.8rem"},input:{width:"100%",padding:"10px 13px",background:"rgba(255,255,255,0.04)",border:`1px solid ${TL}`,borderRadius:"2px",color:TT,fontSize:"0.92rem",outline:"none",fontFamily:"inherit"},opt:{padding:"7px 11px",borderRadius:"2px",border:`1px solid ${TL}`,background:"transparent",color:TM,cursor:"pointer",fontSize:"0.72rem"},optActive:{background:"rgba(232,74,95,0.1)",borderColor:"rgba(232,74,95,0.45)",color:TA},essayOptActive:{background:"rgba(167,139,250,0.1)",borderColor:"rgba(167,139,250,0.4)",color:TP}};

export default function App() {
  const envKey=process.env.REACT_APP_GOOGLE_TTS_KEY||"";
  const [apiKey]=useState(envKey);
  const ttsReady=!!envKey;

  // Firebase
  const [user,setUser]=useState(null);
  const [syncing,setSyncing]=useState(false);
  const [showMergeModal,setShowMergeModal]=useState(false);
  const [pendingCloudWords,setPendingCloudWords]=useState(null);

  // UI
  const [activeTab,setActiveTab]=useState("list"); // list | add | quiz | wallets | settings
  const [currentBook,setCurrentBook]=useState("hebrew");
  const [uiLang,setUiLang]=useState(()=>{try{return localStorage.getItem("uiLang")||"ko";}catch{return"ko";}});
  const T=UI_TEXT[uiLang]||UI_TEXT.ko;
  const bookInfo=BOOKS.find(b=>b.id===currentBook)||BOOKS[0];

  // Words
  const [words,setWordsRaw]=useState(()=>loadWords("hebrew"));
  const [mode,setMode]=useState(MODES.LIST);

  // Settings
  const [cardStyle,setCardStyle]=useState(()=>{try{return localStorage.getItem("cardStyle")||"menu";}catch{return"menu";}});
  const setCardStyleSave=(v)=>{setCardStyle(v);try{localStorage.setItem("cardStyle",v);}catch{}};
  const [soundMode,setSoundMode]=useState("auto");
  const muted=soundMode==="mute";

  // Word form
  const [newHebrew,setNewHebrew]=useState("");
  const [newMeaning,setNewMeaning]=useState("");
  const [newWordType,setNewWordType]=useState(null);
  const [newWordWallets,setNewWordWallets]=useState(new Set());
  const [editId,setEditId]=useState(null);

  // List
  const [listFilter,setListFilter]=useState(()=>{try{return localStorage.getItem("listFilter")||"all";}catch{return"all";}});
  const setListFilterSave=(v)=>{setListFilter(v);try{localStorage.setItem("listFilter",v);}catch{}};
  const [walletFilter,setWalletFilter]=useState(null);
  const [searchQuery,setSearchQuery]=useState("");
  const [sortBy,setSortBy]=useState(()=>{try{return localStorage.getItem("sortBy")||"default";}catch{return"default";}});
  const setSortBySave=(v)=>{setSortBy(v);try{localStorage.setItem("sortBy",v);}catch{}};
  const [pageSize,setPageSize]=useState(()=>{try{const s=localStorage.getItem("pageSize");return s?Number(s):20;}catch{return 20;}});
  const setPageSizeSave=(n)=>{setPageSize(n);try{localStorage.setItem("pageSize",n);}catch{}};
  const [page,setPage]=useState(0);
  const [selectedIds,setSelectedIds]=useState(new Set());
  const [bulkWalletOpen,setBulkWalletOpen]=useState(false);

  // Wallets
  const [wallets,setWallets]=useState(()=>{try{const s=localStorage.getItem("wordWallets");return s?JSON.parse(s):[];}catch{return[];}});
  const [walletPickWord,setWalletPickWord]=useState(null);
  const [walletName,setWalletName]=useState("");
  const [walletColor,setWalletColor]=useState(TA);
  const [walletDetailId,setWalletDetailId]=useState(null);
  const saveWallets=(w)=>{setWallets(w);try{localStorage.setItem("wordWallets",JSON.stringify(w));}catch{} if(user){setDoc(doc(fbDb,"users",user.uid),{wallets:w,walletsUpdatedAt:new Date().toISOString()},{merge:true}).catch(()=>{});}};
  const createWallet=()=>{if(!walletName.trim())return;saveWallets([{id:Date.now(),name:walletName.trim(),color:walletColor,wordIds:[]},...wallets]);setWalletName("");setWalletColor(TA);};
  const deleteWallet=(id)=>saveWallets(wallets.filter(w=>w.id!==id));
  const toggleWordInWallet=(wid,wordId)=>saveWallets(wallets.map(w=>w.id===wid?{...w,wordIds:w.wordIds.includes(wordId)?w.wordIds.filter(i=>i!==wordId):[...w.wordIds,wordId]}:w));
  const getWalletWords=(wid)=>{const w=wallets.find(x=>x.id===wid);return w?words.filter(wd=>w.wordIds.includes(wd.id)):[];};

  // Import / modals
  const [importPreview,setImportPreview]=useState(null);
  const [showPasteModal,setShowPasteModal]=useState(false);
  const [showBatchModal,setShowBatchModal]=useState(false);
  const [pasteText,setPasteText]=useState("");
  const batchTextRef=useRef(null);
  const fileInputRef=useRef(null);
  const csvInputRef=useRef(null);
  const verbFormFileRef=useRef(null);

  // Add tab sub-views
  const [addSubView,setAddSubView]=useState("form"); // form | reverso | root | meaning
  const [pealimRoot,setPealimRoot]=useState("");
  const [pealimLoading,setPealimLoading]=useState(false);
  const [pealimError,setPealimError]=useState("");
  const [pealimPreview,setPealimPreview]=useState(null);
  const [rootSearchInput,setRootSearchInput]=useState("");
  const [rootSearchResults,setRootSearchResults]=useState([]);
  const [rootSearchLoading,setRootSearchLoading]=useState(false);
  const [rootSearchError,setRootSearchError]=useState("");
  const [rootSelected,setRootSelected]=useState(new Set());
  const [rootGroupName,setRootGroupName]=useState("");
  const [wordSearchInput,setWordSearchInput]=useState("");
  const [wordSearchResults,setWordSearchResults]=useState([]);
  const [wordSearchLoading,setWordSearchLoading]=useState(false);
  const [wordSearchError,setWordSearchError]=useState("");
  const [wordSearchSelected,setWordSearchSelected]=useState(new Set());
  const [importTargetWallets,setImportTargetWallets]=useState(new Set());
  const [refreshingVariants,setRefreshingVariants]=useState(false);
  const [refreshLog,setRefreshLog]=useState([]);
  const [showRefreshLog,setShowRefreshLog]=useState(false);

  // Variant edit
  const [expandedVariantWord,setExpandedVariantWord]=useState(null);
  const [variantDraft,setVariantDraft]=useState({});
  const [variantPasteMode,setVariantPasteMode]=useState(false);
  const [variantPasteText,setVariantPasteText]=useState("");

  // Quiz
  const [questions,setQuestions]=useState([]);
  const [current,setCurrent]=useState(0);
  const [selected,setSelected]=useState(null);
  const [confirmed,setConfirmed]=useState(false);
  const [score,setScore]=useState(0);
  const [wrongWords,setWrongWords]=useState([]);
  const [animKey,setAnimKey]=useState(0);
  const [quizType,setQuizType]=useState(()=>{try{return localStorage.getItem("quizType")||QUIZ_TYPES.HEB_TO_MEAN;}catch{return QUIZ_TYPES.HEB_TO_MEAN;}});
  const setQuizTypeSave=(v)=>{setQuizType(v);try{localStorage.setItem("quizType",v);}catch{}};
  const [quizFilter,setQuizFilter]=useState(()=>{try{return localStorage.getItem("quizFilter")||QUIZ_FILTERS.ALL;}catch{return QUIZ_FILTERS.ALL;}});
  const setQuizFilterSave=(v)=>{setQuizFilter(v);try{localStorage.setItem("quizFilter",v);}catch{}};
  const [quizCount,setQuizCount]=useState(()=>{try{const s=localStorage.getItem("quizCount");return s?Number(s):10;}catch{return 10;}});
  const setQuizCountSave=(v)=>{setQuizCount(v);try{localStorage.setItem("quizCount",v);}catch{}};

  // Essay
  const [essayQuestions,setEssayQuestions]=useState([]);
  const [essayCurrent,setEssayCurrent]=useState(0);
  const [essayInput,setEssayInput]=useState("");
  const [essayConfirmed,setEssayConfirmed]=useState(false);
  const [essayResults,setEssayResults]=useState([]);
  const [essayFilter,setEssayFilter]=useState(()=>{try{return localStorage.getItem("essayFilter")||QUIZ_FILTERS.ALL;}catch{return QUIZ_FILTERS.ALL;}});
  const setEssayFilterSave=(v)=>{setEssayFilter(v);try{localStorage.setItem("essayFilter",v);}catch{}};
  const [essayCount,setEssayCount]=useState(()=>{try{const s=localStorage.getItem("essayCount");return s?Number(s):10;}catch{return 10;}});
  const setEssayCountSave=(v)=>{setEssayCount(v);try{localStorage.setItem("essayCount",v);}catch{}};
  const [essayType,setEssayType]=useState(()=>{try{return localStorage.getItem("essayType")||"heb_to_mean";}catch{return"heb_to_mean";}});
  const setEssayTypeSave=(v)=>{setEssayType(v);try{localStorage.setItem("essayType",v);}catch{}};
  const essayInputRef=useRef(null);
  const essayHebrewRef=useRef(null);

  // Variant quiz
  const [variantQuestions,setVariantQuestions]=useState([]);
  const [variantCur,setVariantCur]=useState(0);
  const [variantQuizType,setVariantQuizType]=useState("essay");
  const [variantSelected,setVariantSelected]=useState(null);
  const [variantInput,setVariantInput]=useState("");
  const [variantConfirmed,setVariantConfirmed]=useState(false);
  const [variantResults,setVariantResults]=useState([]);
  const [variantFilter,setVariantFilter]=useState(()=>{try{return localStorage.getItem("variantFilter")||QUIZ_FILTERS.ALL;}catch{return QUIZ_FILTERS.ALL;}});
  const setVariantFilterSave=(v)=>{setVariantFilter(v);try{localStorage.setItem("variantFilter",v);}catch{}};
  const [variantCount,setVariantCount]=useState(10);
  const [variantCats,setVariantCats]=useState(()=>{try{const s=localStorage.getItem("variantCats");return s?JSON.parse(s):VARIANT_CATS.map(c=>c.id);}catch{return VARIANT_CATS.map(c=>c.id);}});
  const setVariantCatsSave=(v)=>{const next=typeof v==="function"?v(variantCats):v;setVariantCats(next);try{localStorage.setItem("variantCats",JSON.stringify(next));}catch{}};
  const variantInputRef=useRef(null);

  // Toast
  const [toast,setToast]=useState(null);
  const showToast=(msg,type="ok")=>{setToast({msg,type});setTimeout(()=>setToast(null),3000);};

  // TTS
  const speak=useCallback(async(text)=>{
    if(soundMode!=="auto") return;
    const book=BOOKS.find(b=>b.id===currentBook)||BOOKS[0];
    if(apiKey){try{await googleTTS(text,apiKey,book.ttsLang,book.ttsName,book.ttsRate);return;}catch{}}
    browserTTS(text,book.ttsLang,book.ttsRate);
  },[apiKey,currentBook,soundMode]);
  const speakOnDemand=useCallback(async(text)=>{
    if(soundMode==="mute") return;
    const book=BOOKS.find(b=>b.id===currentBook)||BOOKS[0];
    if(apiKey){try{await googleTTS(text,apiKey,book.ttsLang,book.ttsName,book.ttsRate);return;}catch{}}
    browserTTS(text,book.ttsLang,book.ttsRate);
  },[apiKey,currentBook,soundMode]);

  // Computed
  const masteredCount=words.filter(w=>w.status==="mastered").length;
  const hardCount=words.filter(w=>w.status==="hard").length;
  const learningCount=words.filter(w=>w.status==="learning").length;
  const getPool=(filter)=>{const f=filter||quizFilter;if(f===QUIZ_FILTERS.LEARNING_ONLY)return words.filter(w=>w.status==="learning");if(f===QUIZ_FILTERS.EXCLUDE_MASTERED)return words.filter(w=>w.status!=="mastered");if(f===QUIZ_FILTERS.HARD_ONLY)return words.filter(w=>w.status==="hard");return words;};
  const variantPoolSize=(()=>{const st=new Set(VARIANT_CATS.filter(c=>variantCats.includes(c.id)).flatMap(c=>c.types));const pool=getPool(variantFilter).filter(w=>(w.variants||[]).some(v=>st.has(v.type)));return pool.flatMap(w=>(w.variants||[]).filter(v=>st.has(v.type))).length;})();
  const poolSize=getPool().length;
  const essayPoolSize=getPool(essayFilter).length;
  const countOptions=[5,10,20,"전체"].map(v=>({label:v==="전체"?(uiLang==="en"?"All":"전체"):`${v}`,value:v==="전체"?9999:v}));

  const setWords=(updater)=>{setWordsRaw(prev=>{const next=typeof updater==="function"?updater(prev):updater;saveWords(next,currentBook);syncToCloud(next);return next;});};
  const switchBook=(bookId)=>{setCurrentBook(bookId);const loaded=loadWords(bookId);setWordsRaw(loaded);setListFilter("all");setSearchQuery("");setPage(0);setSelectedIds(new Set());setMode(MODES.LIST);};

  const searchedWords=(()=>{
    let result=words.filter(w=>{const mf=listFilter==="all"||w.status===listFilter;if(!mf)return false;if(walletFilter){const wl=wallets.find(x=>x.id===walletFilter);if(!wl||!wl.wordIds.includes(w.id))return false;}if(!searchQuery.trim())return true;const q=searchQuery.toLowerCase();return w.hebrew.includes(searchQuery.trim())||w.meaning.toLowerCase().includes(q)||(w.hebrew&&stripNikkud(w.hebrew).includes(searchQuery.trim()));});
    if(sortBy==="hebrew_asc")result=[...result].sort((a,b)=>a.hebrew.localeCompare(b.hebrew,'he'));
    else if(sortBy==="hebrew_desc")result=[...result].sort((a,b)=>b.hebrew.localeCompare(a.hebrew,'he'));
    else if(sortBy==="meaning_asc")result=[...result].sort((a,b)=>a.meaning.localeCompare(b.meaning));
    else if(sortBy==="meaning_desc")result=[...result].sort((a,b)=>b.meaning.localeCompare(a.meaning));
    else if(sortBy==="hard_first")result=[...result].sort((a,b)=>{const o={hard:0,learning:1,mastered:2};return(o[a.status]??1)-(o[b.status]??1);});
    else if(sortBy==="mastered_first")result=[...result].sort((a,b)=>{const o={mastered:0,learning:1,hard:2};return(o[a.status]??1)-(o[b.status]??1);});
    else if(sortBy==="wrong_desc")result=[...result].sort((a,b)=>(b.wrongCount||0)-(a.wrongCount||0));
    return result;
  })();
  const totalPages=Math.ceil(searchedWords.length/pageSize);
  const filteredWords=pageSize===9999?searchedWords:searchedWords.slice(page*pageSize,(page+1)*pageSize);

  // ── Firebase Auth ──────────────────────────────────────────
  useEffect(()=>{
    const unsub=onAuthStateChanged(fbAuth,async(u)=>{
      setUser(u);
      if(u){try{
        const snap=await getDoc(doc(fbDb,"users",u.uid));
        const localWords=loadWords();
        const hasLocal=localWords.length>0&&!(localWords.length===8&&localWords[0].hebrew==="שָׁלוֹם");
        const syncKey=`synced_${u.uid}`;
        const alreadySynced=localStorage.getItem(syncKey);
        if(snap.exists()){
          const sd=snap.data();
          const cloud=sd.words;
          const cloudWallets=sd.wallets;
          if(cloudWallets&&cloudWallets.length){const lw=(()=>{try{const s=localStorage.getItem("wordWallets");return s?JSON.parse(s):[];}catch{return[];}})();if(!lw.length){setWallets(cloudWallets);try{localStorage.setItem("wordWallets",JSON.stringify(cloudWallets));}catch{}}else{const merged=[...cloudWallets];lw.forEach(x=>{if(!merged.find(c=>c.id===x.id))merged.push(x);});setWallets(merged);try{localStorage.setItem("wordWallets",JSON.stringify(merged));}catch{}}}
          if(cloud&&cloud.length){if(hasLocal&&!alreadySynced){const ls=new Set(localWords.map(w=>w.hebrew));const cs=new Set(cloud.map(w=>w.hebrew));const same=localWords.length===cloud.length&&[...ls].every(h=>cs.has(h));if(same){setWordsRaw(cloud);saveWords(cloud);localStorage.setItem(syncKey,"1");}else{setPendingCloudWords(cloud);setShowMergeModal(true);}}else{setWordsRaw(cloud);saveWords(cloud);if(!alreadySynced)showToast("클라우드 단어장을 불러왔어요!");localStorage.setItem(syncKey,"1");}}else if(hasLocal){await setDoc(doc(fbDb,"users",u.uid),{words:localWords,updatedAt:new Date().toISOString()});localStorage.setItem(syncKey,"1");showToast("단어장을 클라우드에 저장했어요!");}
        }else if(hasLocal){await setDoc(doc(fbDb,"users",u.uid),{words:localWords,updatedAt:new Date().toISOString()});localStorage.setItem(syncKey,"1");showToast("단어장을 클라우드에 저장했어요!");}
      }catch(e){console.error(e);}}
    });
    return()=>unsub();
  },[]); // eslint-disable-line

  const handleMerge=(choice)=>{if(!pendingCloudWords)return;if(choice==="cloud"){setWordsRaw(pendingCloudWords);saveWords(pendingCloudWords);showToast("클라우드 단어장으로 교체했어요!");}else if(choice==="local"){const local=loadWords();if(user)setDoc(doc(fbDb,"users",user.uid),{words:local,updatedAt:new Date().toISOString()});showToast("기기 단어장을 클라우드에 저장했어요!");}else{const local=loadWords();const hs=new Set(pendingCloudWords.map(w=>w.hebrew));const merged=[...pendingCloudWords,...local.filter(w=>!hs.has(w.hebrew))];setWordsRaw(merged);saveWords(merged);if(user)setDoc(doc(fbDb,"users",user.uid),{words:merged,updatedAt:new Date().toISOString()});showToast(`병합 완료! 총 ${merged.length}개 단어`);}setPendingCloudWords(null);setShowMergeModal(false);if(user)localStorage.setItem(`synced_${user.uid}`,"1");};
  const signInGoogle=async()=>{try{await signInWithPopup(fbAuth,new GoogleAuthProvider());showToast("로그인 성공!");}catch(e){showToast("로그인 실패: "+e.message,"err");}};
  const signOutUser=async()=>{await signOut(fbAuth);showToast("로그아웃 됐어요.");};
  const syncToCloud=async(w)=>{if(!user)return;setSyncing(true);try{const data={words:w,updatedAt:new Date().toISOString()};if(wallets&&wallets.length)data.wallets=wallets;await setDoc(doc(fbDb,"users",user.uid),data);}catch(e){console.error(e);}finally{setSyncing(false);}};

  // ── Core word ops ─────────────────────────────────────────
  const updateWordStats=(wordId,correct)=>{setWords(ws=>ws.map(w=>{if(w.id!==wordId)return w;const ns=correct?w.streak+1:0;const nw=correct?w.wrongCount:w.wrongCount+1;let st=w.status;if(correct&&ns>=3)st="mastered";else if(!correct&&nw>=2)st="hard";return{...w,streak:ns,wrongCount:nw,status:st};}));};
  const setManualStatus=(id,status)=>{setWords(ws=>ws.map(w=>w.id===id?{...w,status,streak:status==="mastered"?3:0,wrongCount:status==="hard"?2:0}:w));};
  const addWord=()=>{if(!newHebrew.trim()||!newMeaning.trim())return;if(editId!==null){setWords(ws=>ws.map(w=>w.id===editId?{...w,hebrew:newHebrew.trim(),meaning:newMeaning.trim(),...(newWordType?{wordType:newWordType}:{})}:w));setEditId(null);}else{const newId=Date.now();setWords(ws=>[{id:newId,hebrew:newHebrew.trim(),meaning:newMeaning.trim(),status:"learning",streak:0,wrongCount:0,...(newWordType?{wordType:newWordType}:{})}, ...ws]);setPage(0);if(newWordWallets.size>0){saveWallets(wallets.map(wl=>newWordWallets.has(wl.id)?{...wl,wordIds:[...wl.wordIds,newId]}:wl));}};setNewHebrew("");setNewMeaning("");setNewWordType(null);};
  const deleteWord=(id)=>{if(walletFilter){saveWallets(wallets.map(wl=>wl.id===walletFilter?{...wl,wordIds:wl.wordIds.filter(i=>i!==id)}:wl));}else{setWords(ws=>ws.filter(w=>w.id!==id));saveWallets(wallets.map(wl=>({...wl,wordIds:wl.wordIds.filter(i=>i!==id)})));}};
  const startEdit=word=>{setEditId(word.id);setNewHebrew(word.hebrew);setNewMeaning(word.meaning);setNewWordType(word.wordType||null);setActiveTab("add");setAddSubView("form");window.scrollTo({top:0,behavior:"smooth"});};
  const cancelEdit=()=>{setEditId(null);setNewHebrew("");setNewMeaning("");setNewWordType(null);};
  const openVariantModal=(word)=>{const draft={};(word.variants||[]).forEach(v=>{draft[v.type]=v.form;});setVariantDraft(draft);setVariantPasteMode((word.variants||[]).length>0?"view":false);setExpandedVariantWord(word.id);};
  const saveVariantDraft=(wordId)=>{const variants=Object.entries(variantDraft).filter(([,form])=>form.trim()).map(([type,form])=>({type,form:form.trim()}));setWords(ws=>ws.map(w=>w.id===wordId?{...w,variants}:w));setExpandedVariantWord(null);showToast(`변형 ${variants.length}개 저장됐어요!`);};
  const applyVariantPaste=(text)=>{const lines=text.split(/[\n\t]/).map(l=>l.trim());const draft={...variantDraft};const ew=words.find(w=>w.id===expandedVariantWord);const order=getAllowedPasteOrder(ew?.wordType);let oi=0;lines.forEach(form=>{if(oi>=order.length)return;if(form){draft[order[oi]]=form;oi++;}else{oi++;}});setVariantDraft(draft);setVariantPasteText("");setVariantPasteMode(false);showToast(`${Math.min(lines.length,VARIANT_PASTE_ORDER.length)}개 변형을 입력했어요!`);};

  // ── IO / Import ───────────────────────────────────────────
  const exportWords=()=>{const data={version:1,exportedAt:new Date().toISOString(),words};const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`hebrew-vocab-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);showToast(`${words.length}개 단어를 내보냈어요!`);};
  const copyToClipboard=async()=>{const text=JSON.stringify({version:1,exportedAt:new Date().toISOString(),words},null,2);try{await navigator.clipboard.writeText(text);showToast("클립보드에 복사됐어요!");}catch{const ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);showToast("복사됐어요!");}};
  const handleFileChange=(e)=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=(ev)=>{try{const parsed=JSON.parse(ev.target.result);const raw=Array.isArray(parsed)?parsed:(parsed.words||[]);const imported=raw.map(w=>({id:Date.now()+Math.random(),hebrew:(w.hebrew||"").trim(),meaning:(w.meaning||"").trim(),status:["learning","mastered","hard"].includes(w.status)?w.status:"learning",streak:w.streak||0,wrongCount:w.wrongCount||0})).filter(w=>w.hebrew&&w.meaning);if(!imported.length){showToast("불러올 단어가 없어요.","err");return;}setImportPreview({words:imported,fileName:file.name});}catch{showToast("파일을 읽을 수 없어요.","err");}};reader.readAsText(file);e.target.value="";};
  const handleCSVChange=async(e)=>{const file=e.target.files[0];if(!file)return;const isX=/\.xlsx?$/i.test(file.name);if(isX){try{const XLSX=await getXLSX();const buf=await file.arrayBuffer();const wb=XLSX.read(buf,{type:"array"});const ws=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});const parsed=rows.filter(r=>r[0]&&r[1]).map(r=>({hebrew:String(r[0]).trim(),meaning:String(r[1]).trim()})).filter(w=>w.hebrew&&w.meaning);if(!parsed.length){showToast("인식된 단어가 없어요.","err");return;}setImportPreview({words:parsed.map(w=>({...w,id:Date.now()+Math.random(),status:"learning",streak:0,wrongCount:0})),fileName:file.name});}catch{showToast("엑셀 파일을 읽을 수 없어요.","err");}}else{const reader=new FileReader();reader.onload=(ev)=>{const parsed=parseCSV(ev.target.result);if(!parsed.length){showToast("인식된 단어가 없어요.","err");return;}setImportPreview({words:parsed.map(w=>({...w,id:Date.now()+Math.random(),status:"learning",streak:0,wrongCount:0})),fileName:file.name});};reader.readAsText(file,"UTF-8");}e.target.value="";};
  const importFromText=()=>{try{const parsed=JSON.parse(pasteText);const raw=Array.isArray(parsed)?parsed:(parsed.words||[]);const imported=raw.map(w=>({id:Date.now()+Math.random(),hebrew:(w.hebrew||"").trim(),meaning:(w.meaning||"").trim(),status:["learning","mastered","hard"].includes(w.status)?w.status:"learning",streak:w.streak||0,wrongCount:w.wrongCount||0})).filter(w=>w.hebrew&&w.meaning);if(!imported.length){showToast("불러올 단어가 없어요.","err");return;}setImportPreview({words:imported,fileName:"클립보드에서"});setShowPasteModal(false);setPasteText("");}catch{showToast("올바른 형식이 아니에요.","err");}};
  const importFromBatchText=()=>{const raw=batchTextRef.current?batchTextRef.current.value:"";const parsed=parseTextFormat(raw);if(!parsed.length){showToast("인식된 단어가 없어요.","err");return;}setImportPreview({words:parsed.map(w=>({...w,id:Date.now()+Math.random(),status:"learning",streak:0,wrongCount:0})),fileName:`텍스트 (${parsed.length}개)`});setShowBatchModal(false);if(batchTextRef.current)batchTextRef.current.value="";};
  const confirmImport=(merge)=>{if(!importPreview)return;if(merge){const ex=new Set(words.map(w=>w.hebrew));const newOnes=importPreview.words.filter(w=>!ex.has(w.hebrew));setWords(ws=>[...ws,...newOnes]);showToast(`${newOnes.length}개 추가!`);}else{setWords(importPreview.words);showToast(`${importPreview.words.length}개 단어로 교체했어요!`);}setImportPreview(null);setListFilter("all");};

  // ── Search & import flows ──────────────────────────────────
  const translateText=async(text,from,to)=>{const res=await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`);const data=await res.json();return data?.[0]?.[0]?.[0]||"";};
  const searchWordByMeaning=async()=>{if(!wordSearchInput.trim()){setWordSearchError("검색어를 입력해주세요");return;}setWordSearchLoading(true);setWordSearchError("");setWordSearchResults([]);setWordSearchSelected(new Set());try{const q=wordSearchInput.trim();const hasKorean=/[ㄱ-ㅎ가-힣]/.test(q);let searchQ=q;if(hasKorean){try{const t=await translateText(q,"ko","en");if(t)searchQ=t;}catch{}}const res=await fetch(`/api/Reverso?mode=word_search&q=${encodeURIComponent(searchQ)}`);const data=await res.json();if(data.error){setWordSearchError(data.error);return;}if(!data.results?.length){setWordSearchError(`"${q}" 검색 결과가 없어요.`);return;}setWordSearchResults(data.results);}catch(e){setWordSearchError("오류: "+e.message);}finally{setWordSearchLoading(false);}};
  const addSelectedWordSearchResults=()=>{if(!wordSearchSelected.size){setWordSearchError("단어를 선택해주세요");return;}const toAdd=[...wordSearchSelected].map(i=>wordSearchResults[i]).filter(Boolean);const newWords=toAdd.map(r=>({id:Date.now()+Math.random(),hebrew:r.hebrew,meaning:r.meaning||"",status:"learning",streak:0,wrongCount:0,wordType:r.pos==="translation"?null:r.pos||null,variants:[]}));setWords(ws=>[...newWords,...ws]);setPage(0);if(importTargetWallets.size>0){const ids=newWords.map(w=>w.id);saveWallets(wallets.map(wl=>importTargetWallets.has(wl.id)?{...wl,wordIds:[...wl.wordIds,...ids]}:wl));}showToast(`${newWords.length}개 단어를 추가했어요!`);setWordSearchSelected(new Set());setWordSearchResults([]);setWordSearchInput("");};
  const searchByRoot=async()=>{if(!rootSearchInput.trim()){setRootSearchError("어근을 입력해주세요");return;}setRootSearchLoading(true);setRootSearchError("");setRootSearchResults([]);setRootSelected(new Set());try{const res=await fetch(`/api/Reverso?mode=root_search&root=${encodeURIComponent(rootSearchInput.trim())}`);const data=await res.json();if(data.error){setRootSearchError(data.error);return;}if(!data.results?.length){setRootSearchError("검색 결과가 없어요.");return;}setRootSearchResults(data.results);setRootGroupName(rootSearchInput.trim());}catch(e){setRootSearchError("오류: "+e.message);}finally{setRootSearchLoading(false);}};
  const addSelectedRootWords=()=>{if(!rootSelected.size){setRootSearchError("단어를 선택해주세요");return;}const toAdd=[...rootSelected].map(i=>rootSearchResults[i]).filter(Boolean);const newWords=toAdd.map(r=>({id:Date.now()+Math.random(),hebrew:r.hebrew,meaning:r.meaning||"",status:"learning",streak:0,wrongCount:0,wordType:r.pos||null,root:rootGroupName,rootGroup:rootGroupName,variants:[]}));setWords(ws=>[...newWords,...ws]);setPage(0);if(importTargetWallets.size>0){const ids=newWords.map(w=>w.id);saveWallets(wallets.map(wl=>importTargetWallets.has(wl.id)?{...wl,wordIds:[...wl.wordIds,...ids]}:wl));}showToast(`${newWords.length}개 단어를 추가했어요!`);setRootSelected(new Set());setRootSearchResults([]);setRootSearchInput("");};
  const searchPealim=async()=>{if(!pealimRoot.trim()){setPealimError("동사를 입력해주세요");return;}setPealimLoading(true);setPealimError("");setPealimPreview(null);try{const res=await fetch(`/api/Reverso?mode=conjugation&verb=${encodeURIComponent(pealimRoot.trim())}`);const data=await res.json();if(data.error){setPealimError(data.error);return;}if(!data.variantCount){setPealimError("변형 없음");return;}const ew=words.find(w=>stripNikkud(w.hebrew)===stripNikkud(data.infinitive));const m=ew?.meaning||data.meaning||"";setPealimPreview({...data,meaning:m,root:pealimRoot.trim()});}catch(e){setPealimError("오류: "+e.message);}finally{setPealimLoading(false);}};
  const addNewWordFromPealim=()=>{if(!pealimPreview?.infinitive)return;const variants=Object.entries(pealimPreview.variants).filter(([,f])=>f).map(([type,form])=>({type,form}));const exists=words.find(w=>stripNikkud(w.hebrew)===stripNikkud(pealimPreview.infinitive));if(exists){setWords(ws=>ws.map(w=>w.id===exists.id?{...w,variants}:w));showToast(`"${pealimPreview.infinitive}" 변형 ${variants.length}개 업데이트!`);}else{const newId=Date.now();const nw={id:newId,hebrew:pealimPreview.infinitive,meaning:pealimPreview.meaning||"",status:"learning",streak:0,wrongCount:0,wordType:pealimPreview.wordType||null,variants,root:pealimPreview.root||""};setWords(ws=>[nw,...ws]);setPage(0);if(importTargetWallets.size>0){saveWallets(wallets.map(wl=>importTargetWallets.has(wl.id)?{...wl,wordIds:[...wl.wordIds,newId]}:wl));}showToast(`"${pealimPreview.infinitive}" 단어와 변형 ${variants.length}개 추가!`);}setPealimPreview(null);setPealimRoot("");};
  const refreshAllVariants=async()=>{const vw=words.filter(w=>w.wordType==="verb"||(w.variants||[]).length>0);if(!vw.length){showToast("동사 단어가 없어요.","err");return;}setRefreshingVariants(true);setRefreshLog([]);const log=[];const done=new Set();for(const w of vw){const key=stripNikkud(w.hebrew);if(done.has(key))continue;done.add(key);try{const res=await fetch(`/api/Reverso?mode=conjugation&verb=${encodeURIComponent(w.hebrew)}`);const cd=await res.json();if(cd.error||!cd.variantCount){log.push({hebrew:w.hebrew,meaning:w.meaning,status:"fail",variantCount:0,error:cd.error||"변형 없음"});continue;}const variants=Object.entries(cd.variants).filter(([,f])=>f).map(([type,form])=>({type,form}));if(!variants.length){log.push({hebrew:w.hebrew,meaning:w.meaning,status:"fail",variantCount:0,error:"변형 없음"});continue;}setWords(ws=>ws.map(ww=>stripNikkud(ww.hebrew)===key?{...ww,variants,meaning:ww.meaning||cd.meaning||""}:ww));log.push({hebrew:w.hebrew,meaning:w.meaning,status:"ok",variantCount:variants.length});}catch(e){log.push({hebrew:w.hebrew,meaning:w.meaning,status:"fail",variantCount:0,error:e.message});}}setRefreshLog(log);setShowRefreshLog(true);setRefreshingVariants(false);showToast(`${log.filter(l=>l.status==="ok").length}개 성공 / ${log.filter(l=>l.status==="fail").length}개 실패`);};

  // ── Quiz handlers ─────────────────────────────────────────
  const startQuiz=()=>{const pool=getPool();if(pool.length<4)return;const count=Math.min(quizCount===9999?pool.length:quizCount,pool.length);const qs=shuffle(pool).slice(0,count).map(w=>generateQuestion(w,words,quizType));setQuestions(qs);setCurrent(0);setSelected(null);setConfirmed(false);setScore(0);setWrongWords([]);setMode(MODES.QUIZ);setAnimKey(k=>k+1);};
  const startEssay=()=>{const pool=getPool(essayFilter);if(!pool.length)return;const count=Math.min(essayCount===9999?pool.length:essayCount,pool.length);const qs=shuffle(pool).slice(0,count).map(w=>{let type=essayType;if(type==="mixed")type=Math.random()>0.5?"heb_to_mean":"mean_to_heb";return type==="heb_to_mean"?{wordId:w.id,question:w.hebrew,answer:w.meaning,questionType:"heb_to_mean",hebrewWord:w.hebrew}:{wordId:w.id,question:w.meaning,answer:w.hebrew,questionType:"mean_to_heb",hebrewWord:w.hebrew};});setEssayQuestions(qs);setEssayCurrent(0);setEssayInput("");setEssayConfirmed(false);setEssayResults([]);setMode(MODES.ESSAY);setAnimKey(k=>k+1);};
  const startVariantQuiz=()=>{const st=new Set(VARIANT_CATS.filter(c=>variantCats.includes(c.id)).flatMap(c=>c.types));const pool=getPool(variantFilter).filter(w=>(w.variants||[]).some(v=>st.has(v.type)));if(!pool.length){showToast("선택한 변형 유형의 단어가 없어요.","err");return;}const allForms=[...new Set(pool.flatMap(w=>(w.variants||[]).filter(v=>st.has(v.type)).map(v=>v.form)))];const pairs=[];for(const w of pool){for(const v of (w.variants||[])){if(!st.has(v.type))continue;const dist=shuffle(allForms.filter(f=>f!==v.form)).slice(0,3);while(dist.length<3)dist.push("—");pairs.push({wordId:w.id,base:w.hebrew,meaning:w.meaning,variantType:v.type,answer:v.form,choices:shuffle([v.form,...dist])});}}const count=Math.min(variantCount===9999?pairs.length:variantCount,pairs.length);setVariantQuestions(shuffle(pairs).slice(0,count));setVariantCur(0);setVariantInput("");setVariantConfirmed(false);setVariantResults([]);setVariantSelected(null);setMode(MODES.VARIANT);setAnimKey(k=>k+1);};
  const handleVariantConfirm=()=>{const q=variantQuestions[variantCur];if(variantQuizType==="mcq"){if(!variantSelected)return;const correct=variantSelected===q.answer;updateWordStats(q.wordId,correct);setVariantResults(r=>[...r,{...q,userInput:variantSelected,correct}]);setVariantConfirmed(true);speak(q.answer);}else{if(!variantInput.trim())return;const correct=stripNikkud(variantInput.trim())===stripNikkud(q.answer)||variantInput.trim()===q.answer;updateWordStats(q.wordId,correct);setVariantResults(r=>[...r,{...q,userInput:variantInput,correct}]);setVariantConfirmed(true);speak(q.answer);}};
  const handleVariantNext=()=>{if(variantCur+1>=variantQuestions.length){setMode(MODES.VARIANT_RESULT);return;}setVariantCur(c=>c+1);setVariantInput("");setVariantConfirmed(false);setVariantSelected(null);if(variantQuizType==="essay"&&variantInputRef.current)variantInputRef.current.focus();};
  const handleEssayConfirm=()=>{const q=essayQuestions[essayCurrent];const inputVal=q.questionType==="mean_to_heb"?essayHebrewRef.current?.value||"":essayInput;if(!inputVal.trim())return;const cv=q.questionType==="mean_to_heb"?stripNikkud(inputVal):inputVal;const ca=q.questionType==="mean_to_heb"?stripNikkud(q.answer):q.answer;const result=checkEssayAnswer(cv,ca);updateWordStats(q.wordId,result!=="wrong");setEssayResults(r=>[...r,{...q,userInput:inputVal,result}]);setEssayConfirmed(true);speak(q.hebrewWord||q.question);};
  const handleEssayNext=()=>{if(essayCurrent+1>=essayQuestions.length){setMode(MODES.ESSAY_RESULT);return;}setEssayCurrent(c=>c+1);setEssayInput("");setEssayConfirmed(false);setAnimKey(k=>k+1);if(essayHebrewRef.current)essayHebrewRef.current.value="";};
  const handleConfirm=()=>{if(!selected)return;const correct=selected===questions[current].answer;if(correct)setScore(s=>s+1);else setWrongWords(w=>[...w,questions[current]]);updateWordStats(questions[current].wordId,correct);setConfirmed(true);};
  const handleNext=()=>{if(current+1>=questions.length){setMode(MODES.RESULT);return;}setCurrent(c=>c+1);setSelected(null);setConfirmed(false);setAnimKey(k=>k+1);};

  const spokenKey=useRef(-1);
  useEffect(()=>{if(mode!==MODES.QUIZ||soundMode!=="auto")return;const q=questions[current];if(!q||q.questionType!==QUIZ_TYPES.HEB_TO_MEAN)return;if(spokenKey.current===animKey)return;spokenKey.current=animKey;const t=setTimeout(()=>speak(q.question),500);return()=>clearTimeout(t);},[current,animKey,mode,soundMode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{if(mode===MODES.ESSAY&&essayInputRef.current)essayInputRef.current.focus();},[essayCurrent,mode]);

  const q=questions[current];const eq=essayQuestions[essayCurrent];
  const progress=questions.length>0?((current+(confirmed?1:0))/questions.length)*100:0;
  const essayProgress=essayQuestions.length>0?((essayCurrent+(essayConfirmed?1:0))/essayQuestions.length)*100:0;
  const essayScore=essayResults.filter(r=>r.result==="exact").length;
  const essayPartial=essayResults.filter(r=>r.result==="partial").length;
  const isQuizActive=[MODES.QUIZ,MODES.ESSAY,MODES.VARIANT,MODES.RESULT,MODES.ESSAY_RESULT,MODES.VARIANT_RESULT].includes(mode);

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",background:TB,color:TT,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        *{box-sizing:border-box;} body{margin:0;background:#09080D;}
        input,button,textarea{-webkit-tap-highlight-color:transparent;font-family:'DM Sans',sans-serif;}
        input:focus,textarea:focus{outline:none;border-color:rgba(232,74,95,0.55)!important;background:rgba(255,255,255,0.06)!important;}
        ::-webkit-scrollbar{width:3px;height:3px;} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);}
        @media(max-width:480px){.cg{grid-template-columns:1fr!important;}.qr{flex-direction:column!important;}.rb{flex-direction:column!important;}}
      `}</style>

      {/* Toast */}
      {toast&&<div style={{position:"fixed",top:"16px",left:"50%",transform:"translateX(-50%)",background:toast.type==="err"?"#cc2222":TA,color:"#fff",padding:"9px 18px",borderRadius:"2px",fontSize:"0.78rem",fontWeight:600,zIndex:1000,boxShadow:`0 4px 20px rgba(232,74,95,0.35)`,whiteSpace:"nowrap",maxWidth:"90vw",textAlign:"center"}}>{toast.msg}</div>}

      {/* ── MODALS ─────────────────────────────────────────── */}

      {/* Merge Modal */}
      {showMergeModal&&pendingCloudWords&&<div style={Mo.overlay}><div style={Mo.box}><h3 style={Mo.title}>단어장 동기화</h3><p style={Mo.sub}>기기와 클라우드 단어장이 모두 있어요.</p><div style={{display:"flex",flexDirection:"column",gap:"5px"}}><button style={{...Bt.primary,padding:"11px"}} onClick={()=>handleMerge("merge")}>합치기 ({(()=>{const local=loadWords();const set=new Set(pendingCloudWords.map(w=>w.hebrew));return pendingCloudWords.length+local.filter(w=>!set.has(w.hebrew)).length;})()}개)</button><button style={{...Bt.ghost,padding:"11px"}} onClick={()=>handleMerge("cloud")}>클라우드 사용 ({pendingCloudWords.length}개)</button><button style={{...Bt.ghost,padding:"11px"}} onClick={()=>handleMerge("local")}>기기 단어 유지</button></div></div></div>}

      {/* Import Preview */}
      {importPreview&&<div style={Mo.overlay}><div style={Mo.box}><h3 style={Mo.title}>단어 불러오기</h3><p style={Mo.sub}><span style={{color:TH}}>{importPreview.fileName}</span> — <b style={{color:TT}}>{importPreview.words.length}</b>개 단어</p><div style={{borderTop:`1px solid ${TL}`,marginBottom:"12px"}}>{importPreview.words.slice(0,5).map((w,i)=>(<div key={i} style={{padding:"6px 0",borderBottom:`1px solid ${TL}`,display:"flex",alignItems:"center",gap:"8px",fontSize:"0.82rem"}}><span style={{fontFamily:"Arial",color:TH,direction:"rtl"}}>{w.hebrew}</span><span style={{color:TD}}>→</span><span style={{color:TM}}>{w.meaning}</span></div>))}{importPreview.words.length>5&&<p style={{color:TD,fontSize:"0.72rem",margin:"5px 0 0"}}>… 외 {importPreview.words.length-5}개</p>}</div><div style={Mo.row}><button style={Bt.primary} onClick={()=>confirmImport(true)}>+ 추가</button><button style={Bt.ghost} onClick={()=>confirmImport(false)}>전체 교체</button><button style={Bt.ghost} onClick={()=>setImportPreview(null)}>취소</button></div></div></div>}

      {/* Paste Modal */}
      {showPasteModal&&<div style={Mo.overlay} onClick={()=>setShowPasteModal(false)}><div style={Mo.box} onClick={e=>e.stopPropagation()}><h3 style={Mo.title}>붙여넣기 불러오기</h3><textarea style={Mo.ta} placeholder='{"version":1,"words":[...]}' value={pasteText} onChange={e=>setPasteText(e.target.value)}/><div style={Mo.row}><button style={Bt.primary} onClick={importFromText}>불러오기</button><button style={Bt.ghost} onClick={()=>{setShowPasteModal(false);setPasteText("");}}>취소</button></div></div></div>}

      {/* Batch Modal */}
      {showBatchModal&&<div style={Mo.overlay} onClick={()=>setShowBatchModal(false)}><div style={Mo.box} onClick={e=>e.stopPropagation()}><h3 style={Mo.title}>텍스트 일괄 추가</h3><p style={Mo.sub}>한 줄에 하나씩 — 히브리어=뜻 형식</p><div style={{background:"rgba(232,74,95,0.06)",border:"1px solid rgba(232,74,95,0.15)",borderRadius:"2px",padding:"8px 12px",marginBottom:"8px",fontSize:"0.75rem",color:TA,fontFamily:"monospace",lineHeight:1.9}}>שָׁלוֹם=평화<br/>תּוֹדָה=감사합니다</div><textarea ref={batchTextRef} style={{...Mo.ta,fontFamily:"Arial,sans-serif",unicodeBidi:"plaintext"}} lang="he" spellCheck={false} autoCorrect="off" defaultValue=""/><div style={Mo.row}><button style={Bt.primary} onClick={importFromBatchText}>단어 추가</button><button style={Bt.ghost} onClick={()=>{setShowBatchModal(false);if(batchTextRef.current)batchTextRef.current.value="";}}>취소</button></div></div></div>}

      {/* Wallet Pick */}
      {walletPickWord&&<div style={{...Mo.overlay,zIndex:9999}} onClick={()=>setWalletPickWord(null)}><div style={{...Mo.box,maxWidth:"300px"}} onClick={e=>e.stopPropagation()}><h3 style={Mo.title}>단어장 선택</h3><div style={{display:"flex",flexDirection:"column",gap:"4px",marginBottom:"12px"}}>{wallets.map(wl=>{const inW=wl.wordIds.includes(walletPickWord);return (<button key={wl.id} onClick={()=>toggleWordInWallet(wl.id,walletPickWord)} style={{display:"flex",alignItems:"center",gap:"9px",padding:"9px 12px",borderRadius:"2px",background:inW?"rgba(232,74,95,0.07)":"rgba(255,255,255,0.02)",border:`1px solid ${inW?"rgba(232,74,95,0.28)":TL}`,cursor:"pointer",textAlign:"left"}}><div style={{width:"13px",height:"13px",borderRadius:"2px",flexShrink:0,background:inW?wl.color:"transparent",border:`1px solid ${inW?wl.color:"rgba(255,255,255,0.2)"}`,display:"flex",alignItems:"center",justifyContent:"center"}}>{inW&&<span style={{color:"#fff",fontSize:"0.55rem",fontWeight:700}}>✓</span>}</div><span style={{color:TT,flex:1,fontWeight:inW?600:400,fontSize:"0.85rem"}}>{wl.name}</span></button>);}}</div><button style={{...Bt.primary,width:"100%"}} onClick={()=>setWalletPickWord(null)}>완료</button></div></div>}

      {/* Variant Edit Modal */}
      {expandedVariantWord&&!String(expandedVariantWord).startsWith("menu_")&&(()=>{
        const ew=words.find(w=>w.id===expandedVariantWord);if(!ew)return null;
        return<div style={{...Mo.overlay,alignItems:"flex-start",paddingTop:"16px",overflowY:"auto"}}><div style={{...Mo.box,maxWidth:"580px",maxHeight:"90vh",overflowY:"auto"}}><div style={{marginBottom:"12px"}}><h3 style={{...Mo.title,marginBottom:"4px"}}>변형 편집</h3><div style={{display:"flex",alignItems:"center",gap:"10px"}}><span style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.3rem",color:TH}}>{ew.hebrew}</span><SpeakBtn text={ew.hebrew} onSpeak={speakOnDemand} muted={muted}/><span style={{fontSize:"0.78rem",color:TM}}>{ew.meaning}</span></div></div>
          <div style={{display:"flex",gap:"5px",marginBottom:"12px"}}>{[["false","편집"],["view","보기"],["paste","붙여넣기"]].map(([val,lbl])=><button key={val} onClick={()=>setVariantPasteMode(val==="false"?false:val)} style={{...Bt.ghost,flex:1,fontSize:"0.75rem",...(String(variantPasteMode)===val?{background:"rgba(232,74,95,0.1)",borderColor:"rgba(232,74,95,0.4)",color:TA}:{})}}>{lbl}</button>)}</div>
          {variantPasteMode==="paste"&&<div><textarea style={{width:"100%",minHeight:"120px",background:"rgba(255,255,255,0.03)",border:`1px solid rgba(80,200,152,0.25)`,borderRadius:"2px",color:TT,padding:"10px",fontSize:"1rem",direction:"rtl",fontFamily:"Arial",resize:"vertical",outline:"none"}} placeholder="여성형&#10;남성형&#10;..." lang="he" spellCheck={false} autoCorrect="off" value={variantPasteText} onChange={e=>setVariantPasteText(e.target.value)}/><button style={{...Bt.green,width:"100%",marginTop:"6px"}} onClick={()=>applyVariantPaste(variantPasteText)}>자동 매핑 적용</button></div>}
          {variantPasteMode===false&&<div><div style={{display:"flex",gap:"4px",flexWrap:"wrap",marginBottom:"10px"}}><button onClick={()=>setWords(ws=>ws.map(w=>w.id===ew.id?{...w,wordType:null}:w))} style={{...Bt.ghost,fontSize:"0.7rem",...(!ew.wordType?{borderColor:"rgba(255,255,255,0.25)",color:TT}:{})}}>전체</button>{WORD_TYPES.map(wt=><button key={wt.id} onClick={()=>setWords(ws=>ws.map(w=>w.id===ew.id?{...w,wordType:wt.id}:w))} style={{...Bt.ghost,fontSize:"0.7rem",...(ew.wordType===wt.id?{background:"rgba(232,74,95,0.1)",borderColor:"rgba(232,74,95,0.4)",color:TA}:{})}}>{wt.emoji} {wt.label[uiLang]||wt.label.ko}</button>)}</div>{getAllowedCats(ew.wordType).map(cat=><div key={cat.id} style={{marginBottom:"12px"}}><div style={{fontSize:"0.58rem",fontWeight:700,color:cat.color,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"5px",paddingBottom:"2px",borderBottom:`1px solid ${cat.color}20`}}>{cat.label[uiLang]||cat.label.ko}</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(185px,1fr))",gap:"4px"}}>{cat.types.map(tid=>{const vt=VARIANT_TYPES.find(t=>t.id===tid);const label=vt?vt.label[uiLang]||vt.label.ko:tid;return<div key={tid} style={{display:"flex",flexDirection:"column",gap:"2px"}}><label style={{fontSize:"0.6rem",color:TD,display:"flex",justifyContent:"space-between"}}><span>{label}</span><div style={{display:"flex",gap:"2px"}}>{variantDraft[tid]&&<button onClick={()=>speakOnDemand(variantDraft[tid])} style={{fontSize:"0.58rem",padding:"1px 5px",borderRadius:"2px",background:"rgba(255,255,255,0.03)",border:`1px solid ${TL}`,color:TM,cursor:"pointer"}}>▷</button>}{variantDraft[tid]&&<button onClick={()=>setVariantDraft(d=>({...d,[tid]:""}))} style={{fontSize:"0.55rem",padding:"1px 4px",borderRadius:"2px",background:"rgba(232,74,95,0.05)",border:"1px solid rgba(232,74,95,0.2)",color:TA,cursor:"pointer"}}>✕</button>}</div></label><input value={variantDraft[tid]||""} onChange={e=>setVariantDraft(d=>({...d,[tid]:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();const next=e.target.closest("div").parentElement.nextElementSibling?.querySelector("input");if(next)next.focus();}}} placeholder="히브리어..." lang="he" spellCheck={false} autoCorrect="off" style={{...Bt.input,padding:"6px 10px",fontSize:"0.92rem",direction:"rtl",fontFamily:"Arial",borderColor:variantDraft[tid]?`${cat.color}50`:undefined}}/></div>;})}  </div></div>)}</div>}
          {variantPasteMode==="view"&&(()=>{const de=Object.fromEntries(Object.entries(variantDraft).filter(([,f])=>f.trim()));const se=Object.fromEntries((ew.variants||[]).map(v=>[v.type,v.form]));const v={...se,...de};if(!Object.keys(v).length)return<div style={{textAlign:"center",color:TD,padding:"24px 0",fontSize:"0.8rem"}}>변형 데이터가 없어요.</div>;return<div style={{maxHeight:"360px",overflowY:"auto",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"3px"}}>{Object.entries(v).map(([tid,form])=>{const vt=VARIANT_TYPES.find(t=>t.id===tid);return<div key={tid} onClick={()=>speakOnDemand(form)} style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"6px 4px",background:"rgba(255,255,255,0.02)",borderRadius:"2px",cursor:"pointer",border:`1px solid ${TL}`}}><span style={{color:TD,fontSize:"0.55rem",marginBottom:"2px"}}>{vt?vt.label[uiLang]||vt.label.ko:tid}</span><span style={{fontFamily:"Arial",direction:"rtl",color:TT,fontSize:"0.88rem",fontWeight:600}}>{form}</span></div>;})}</div>;})()}
          <div style={{display:"flex",gap:"6px",marginTop:"10px",paddingTop:"10px",borderTop:`1px solid ${TL}`}}>{variantPasteMode===false&&<button style={{...Bt.primary,flex:1}} onClick={()=>saveVariantDraft(ew.id)}>저장 ({Object.values(variantDraft).filter(v=>v.trim()).length}개)</button>}<button style={Bt.ghost} onClick={()=>{setExpandedVariantWord(null);setVariantPasteMode(false);setVariantPasteText("");}}>취소</button></div>
        </div></div>;
      })()}

      {/* ── MAIN LAYOUT ─────────────────────────────────────── */}
      <div style={{maxWidth:"680px",margin:"0 auto",padding:"0 0 80px"}}>

        {/* TOP HEADER */}
        <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 20px",borderBottom:`1px solid ${TL}`,position:"sticky",top:0,background:TB,zIndex:100}}>
          <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
            <span style={{fontSize:"1.6rem",fontFamily:"'Bebas Neue',sans-serif",color:TA,letterSpacing:"3px",lineHeight:1}}>אב</span>
            <div style={{display:"flex",gap:"4px",background:"rgba(255,255,255,0.04)",borderRadius:"2px",padding:"3px"}}>
              {BOOKS.map(b=><button key={b.id} onClick={()=>switchBook(b.id)} style={{padding:"4px 10px",borderRadius:"2px",border:"none",fontSize:"0.65rem",fontWeight:600,cursor:"pointer",letterSpacing:"0.5px",background:currentBook===b.id?b.color:"transparent",color:currentBook===b.id?"#09080D":TD,transition:"all 0.15s"}}>{b.emoji} {b.label[uiLang]||b.label.ko}</button>)}
            </div>
          </div>
          <div style={{display:"flex",gap:"5px",alignItems:"center"}}>
            <div style={{display:"flex",gap:"3px"}}><span style={{borderRadius:"2px",padding:"2px 6px",fontSize:"0.6rem",fontWeight:700,color:TG,background:"rgba(80,200,152,0.07)",border:`1px solid rgba(80,200,152,0.18)`}}>✓{masteredCount}</span><span style={{borderRadius:"2px",padding:"2px 6px",fontSize:"0.6rem",fontWeight:700,color:TA,background:"rgba(232,74,95,0.07)",border:`1px solid rgba(232,74,95,0.18)`}}>!{hardCount}</span><span style={{borderRadius:"2px",padding:"2px 6px",fontSize:"0.6rem",fontWeight:700,color:"#8A8AAA",background:"rgba(138,138,170,0.07)",border:`1px solid rgba(138,138,170,0.14)`}}>◎{learningCount}</span></div>
            {syncing&&<span style={{fontSize:"0.58rem",color:TD}}>↑</span>}
            {user?<img src={user.photoURL} alt="" style={{width:"22px",height:"22px",borderRadius:"2px",cursor:"pointer"}} onClick={()=>setActiveTab("settings")}/>:<button onClick={()=>setActiveTab("settings")} style={{...Bt.ghost,fontSize:"0.65rem",padding:"4px 8px",color:TA}}>로그인</button>}
          </div>
        </header>

        {/* ── QUIZ OVERLAY (takes over full screen) ─────────── */}
        {isQuizActive&&<div style={{padding:"0 20px"}}>

          {/* MCQ */}
          {mode===MODES.QUIZ&&q&&(<div key={animKey} style={{paddingTop:"16px"}}>
            <div style={{height:"1px",background:TL,overflow:"hidden",marginBottom:"12px"}}><div style={{height:"100%",background:TA,width:`${progress}%`,transition:"width 0.35s ease"}}/></div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.68rem",marginBottom:"16px"}}>
              <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"0.88rem",letterSpacing:"2px",color:TD}}>{current+1} / {questions.length}</span>
              <span style={{color:TA,fontWeight:700,fontFamily:"'Bebas Neue',sans-serif",fontSize:"0.88rem"}}>{score} / {current+(confirmed?1:0)}</span>
            </div>
            <div style={{background:TS,borderRadius:"2px",border:`1px solid rgba(255,255,255,0.06)`,padding:"36px 22px",textAlign:"center",marginBottom:"14px"}}>
              <div style={{fontSize:"0.55rem",color:TD,letterSpacing:"2px",textTransform:"uppercase",marginBottom:"16px"}}>{q.questionType===QUIZ_TYPES.HEB_TO_MEAN?T.qTagAtoB(bookInfo):T.qTagBtoA(bookInfo)}</div>
              <div style={{...(q.questionType===QUIZ_TYPES.HEB_TO_MEAN?{fontFamily:"Arial,sans-serif",fontSize:"clamp(2.2rem,8vw,3.5rem)",direction:"rtl",color:TH}:{fontSize:"clamp(1.1rem,4vw,1.6rem)",color:TT}),lineHeight:1.2,wordBreak:"break-word",marginBottom:"16px"}}>{q.question}</div>
              <div style={{display:"flex",gap:"7px",alignItems:"center",justifyContent:"center"}}>{q.questionType===QUIZ_TYPES.HEB_TO_MEAN?<RepeatSpeakBtn text={q.question} onSpeak={speakOnDemand} muted={muted}/>:confirmed?<><RepeatSpeakBtn text={q.answer} onSpeak={speakOnDemand} muted={muted}/><span style={{fontSize:"0.65rem",color:TD}}>정답 발음</span></>:null}</div>
              {(()=>{const w=words.find(x=>x.id===q.wordId);const sc=w?STATUS_CONFIG[w.status]:null;return sc?<div style={{display:"inline-block",borderRadius:"2px",padding:"2px 9px",fontSize:"0.62rem",fontWeight:600,marginTop:"10px",color:sc.color,background:sc.bg,border:`1px solid ${sc.border}`}}>{sc.emoji} {uiLang==="en"?sc.labelEn:sc.labelKo}</div>:null;})()}
            </div>
            <div className="cg" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px",marginBottom:"10px"}}>
              {q.choices.map((choice,idx)=>{let ex={};if(confirmed){if(choice===q.answer)ex={background:"rgba(80,200,152,0.08)",borderColor:"rgba(80,200,152,0.45)",color:TG};else if(choice===selected)ex={background:"rgba(232,74,95,0.08)",borderColor:"rgba(232,74,95,0.4)",color:TA};}else if(choice===selected)ex={background:"rgba(232,74,95,0.07)",borderColor:"rgba(232,74,95,0.45)",color:TT};return<button key={idx} onClick={()=>!confirmed&&setSelected(choice)} style={{padding:"13px 12px",borderRadius:"2px",background:TS,border:`1px solid ${TL}`,color:TM,cursor:"pointer",fontSize:"0.85rem",textAlign:"left",display:"flex",alignItems:"center",gap:"9px",fontFamily:"inherit",minHeight:"52px",width:"100%",...ex}}><span style={{width:"20px",height:"20px",borderRadius:"2px",background:"rgba(255,255,255,0.04)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.62rem",fontWeight:700,flexShrink:0,fontFamily:"'Bebas Neue',sans-serif",color:TD}}>{"ABCD"[idx]}</span><span style={q.questionType===QUIZ_TYPES.MEAN_TO_HEB?{fontFamily:"Arial,sans-serif",fontSize:"1.2rem",direction:"rtl",color:TH}:{}}>{choice}</span></button>;})}
            </div>
            <div style={{minHeight:"68px",marginBottom:"8px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
              {confirmed&&(<><div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"7px",flexWrap:"wrap",textAlign:"center",padding:"8px 12px",borderRadius:"2px",background:selected===q.answer?"rgba(80,200,152,0.07)":"rgba(232,74,95,0.07)",border:`1px solid ${selected===q.answer?"rgba(80,200,152,0.2)":"rgba(232,74,95,0.2)"}`,color:selected===q.answer?TG:TA,fontWeight:600,marginBottom:"6px",fontSize:"0.82rem"}}>{selected===q.answer?T.correct:T.wrong(q.answer)}</div><div style={{display:"flex",gap:"4px",justifyContent:"center",flexWrap:"wrap"}}>{(()=>{const w=words.find(x=>x.id===q.wordId);if(!w)return null;return<>{w.status!=="hard"&&<button onClick={()=>setManualStatus(q.wordId,"hard")} style={{...Bt.ghost,padding:"2px 9px",fontSize:"0.68rem",borderColor:"rgba(232,74,95,0.28)",color:TA}}>! 어려움</button>}{w.status!=="mastered"&&<button onClick={()=>setManualStatus(q.wordId,"mastered")} style={{...Bt.ghost,padding:"2px 9px",fontSize:"0.68rem",borderColor:"rgba(80,200,152,0.28)",color:TG}}>✓ 암기완료</button>}{w.status!=="learning"&&<button onClick={()=>setManualStatus(q.wordId,"learning")} style={{...Bt.ghost,padding:"2px 9px",fontSize:"0.68rem"}}>◎ 학습중</button>}</>;})()}</div></>)}
            </div>
            <div className="qr" style={{display:"flex",gap:"6px"}}>
              {!confirmed?<button style={{flex:1,padding:"13px",borderRadius:"2px",background:TA,border:"none",color:"#fff",fontWeight:600,cursor:"pointer",fontSize:"0.88rem",...(!selected?{opacity:0.22,cursor:"not-allowed"}:{})}} onClick={handleConfirm} disabled={!selected}>{T.confirm}</button>:<button style={{flex:1,padding:"13px",borderRadius:"2px",background:TP,border:"none",color:"#fff",fontWeight:600,cursor:"pointer",fontSize:"0.88rem"}} onClick={handleNext}>{current+1>=questions.length?T.finish:T.next}</button>}
              <button style={{padding:"13px 17px",borderRadius:"2px",background:"transparent",border:`1px solid ${TL}`,color:TD,cursor:"pointer",fontSize:"0.82rem"}} onClick={()=>{window.speechSynthesis?.cancel();setMode(MODES.LIST);}}>{T.quit}</button>
            </div>
          </div>)}

          {/* Essay */}
          {mode===MODES.ESSAY&&eq&&(<div key={animKey} style={{paddingTop:"16px"}}>
            <div style={{height:"1px",background:"rgba(167,139,250,0.12)",overflow:"hidden",marginBottom:"12px"}}><div style={{height:"100%",background:TP,width:`${essayProgress}%`,transition:"width 0.35s ease"}}/></div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"16px"}}>
              <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"0.88rem",letterSpacing:"2px",color:TD}}>{essayCurrent+1} / {essayQuestions.length}</span>
              <span style={{color:TP,fontWeight:700,fontFamily:"'Bebas Neue',sans-serif",fontSize:"0.88rem"}}>✓ {essayResults.filter(r=>r.result!=="wrong").length} / {essayCurrent+(essayConfirmed?1:0)}</span>
            </div>
            <div style={{background:TS,borderRadius:"2px",border:`1px solid rgba(167,139,250,0.12)`,padding:"36px 22px",textAlign:"center",marginBottom:"14px"}}>
              <div style={{fontSize:"0.55rem",color:TP,letterSpacing:"2px",textTransform:"uppercase",marginBottom:"16px"}}>{eq.questionType==="heb_to_mean"?T.qTagAtoB(bookInfo):T.qTagBtoA(bookInfo)}</div>
              {eq.questionType==="heb_to_mean"?<div style={{fontFamily:"Arial,sans-serif",fontSize:"clamp(2.2rem,8vw,3.5rem)",direction:"rtl",color:TH,marginBottom:"16px"}}>{eq.question}</div>:<div style={{fontSize:"clamp(1.1rem,4vw,1.6rem)",color:TT,marginBottom:"16px",lineHeight:1.3}}>{eq.question}</div>}
              <RepeatSpeakBtn text={eq.hebrewWord} onSpeak={speakOnDemand} muted={muted}/>
            </div>
            {eq.questionType==="heb_to_mean"&&<input ref={essayInputRef} style={{...Bt.input,fontSize:"1rem",marginBottom:"10px",...(essayConfirmed?{borderColor:essayResults[essayResults.length-1]?.result==="exact"?"rgba(80,200,152,0.5)":essayResults[essayResults.length-1]?.result==="partial"?"rgba(232,74,95,0.3)":"rgba(232,74,95,0.5)"}:{})}} placeholder={T.inputA(bookInfo)} value={essayInput} onChange={e=>!essayConfirmed&&setEssayInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){if(!essayConfirmed)handleEssayConfirm();else handleEssayNext();}}} readOnly={essayConfirmed}/>}
            {eq.questionType==="mean_to_heb"&&<input ref={essayHebrewRef} style={{...Bt.input,fontSize:"1.3rem",fontFamily:"Arial,sans-serif",direction:"rtl",marginBottom:"10px",...(essayConfirmed?{borderColor:essayResults[essayResults.length-1]?.result==="exact"?"rgba(80,200,152,0.5)":"rgba(232,74,95,0.5)"}:{})}} placeholder={T.inputB(bookInfo)} lang="he" spellCheck={false} autoCorrect="off" defaultValue="" readOnly={essayConfirmed} onKeyDown={e=>{if(e.key==="Enter"){if(!essayConfirmed)handleEssayConfirm();else handleEssayNext();}}}/>}
            {essayConfirmed&&(()=>{const last=essayResults[essayResults.length-1];const w=words.find(x=>x.id===eq.wordId);return<><div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"7px",flexWrap:"wrap",padding:"8px 12px",borderRadius:"2px",background:last?.result==="exact"?"rgba(80,200,152,0.07)":"rgba(232,74,95,0.07)",border:`1px solid ${last?.result==="exact"?"rgba(80,200,152,0.2)":"rgba(232,74,95,0.2)"}`,color:last?.result==="exact"?TG:TA,fontWeight:600,marginBottom:"6px",fontSize:"0.82rem"}}>{last?.result==="exact"?T.correct:last?.result==="partial"?`부분 정답! 정답: ${eq.answer}`:`오답 — 정답: ${eq.answer}`} <SpeakBtn text={eq.hebrewWord} onSpeak={speakOnDemand} muted={muted}/></div>{w&&<div style={{display:"flex",gap:"4px",justifyContent:"center",flexWrap:"wrap",marginBottom:"7px"}}>{w.status!=="hard"&&<button onClick={()=>setManualStatus(eq.wordId,"hard")} style={{...Bt.ghost,padding:"2px 9px",fontSize:"0.68rem",borderColor:"rgba(232,74,95,0.28)",color:TA}}>! 어려움</button>}{w.status!=="mastered"&&<button onClick={()=>setManualStatus(eq.wordId,"mastered")} style={{...Bt.ghost,padding:"2px 9px",fontSize:"0.68rem",borderColor:"rgba(80,200,152,0.28)",color:TG}}>✓ 암기완료</button>}</div>}</>;})()} 
            <div className="qr" style={{display:"flex",gap:"6px"}}>
              {!essayConfirmed?<button style={{flex:1,padding:"13px",borderRadius:"2px",background:TP,border:"none",color:"#fff",fontWeight:600,cursor:"pointer",fontSize:"0.88rem"}} onClick={handleEssayConfirm}>{T.confirm}</button>:<button style={{flex:1,padding:"13px",borderRadius:"2px",background:TP,border:"none",color:"#fff",fontWeight:600,cursor:"pointer",fontSize:"0.88rem"}} onClick={handleEssayNext}>{essayCurrent+1>=essayQuestions.length?T.finish:T.next}</button>}
              <button style={{padding:"13px 17px",borderRadius:"2px",background:"transparent",border:`1px solid ${TL}`,color:TD,cursor:"pointer",fontSize:"0.82rem"}} onClick={()=>{window.speechSynthesis?.cancel();setMode(MODES.LIST);}}>{T.quit}</button>
            </div>
          </div>)}

          {/* Variant Quiz */}
          {mode===MODES.VARIANT&&variantQuestions[variantCur]&&(()=>{
            const vq=variantQuestions[variantCur];const vt=VARIANT_TYPES.find(t=>t.id===vq.variantType);
            const prog=((variantCur+(variantConfirmed?1:0))/variantQuestions.length)*100;
            const last=variantResults[variantResults.length-1];
            return<div style={{paddingTop:"16px"}}>
              <div style={{height:"1px",background:"rgba(80,200,152,0.12)",overflow:"hidden",marginBottom:"12px"}}><div style={{height:"100%",background:TG,width:`${prog}%`,transition:"width 0.35s ease"}}/></div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:"16px"}}><span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"0.88rem",letterSpacing:"2px",color:TD}}>{variantCur+1} / {variantQuestions.length}</span><span style={{color:TG,fontWeight:700,fontFamily:"'Bebas Neue',sans-serif",fontSize:"0.88rem"}}>{variantResults.filter(r=>r.correct).length} / {variantCur+(variantConfirmed?1:0)}</span></div>
              <div style={{background:TS,borderRadius:"2px",border:`1px solid rgba(80,200,152,0.12)`,padding:"36px 22px",textAlign:"center",marginBottom:"14px"}}>
                <div style={{fontSize:"0.55rem",color:TG,letterSpacing:"2px",textTransform:"uppercase",marginBottom:"10px"}}>{vt?vt.prompt[uiLang]||vt.prompt.ko:vq.variantType}</div>
                <div style={{fontFamily:"Arial",fontSize:"clamp(2.5rem,9vw,4.5rem)",direction:"rtl",color:TH,marginBottom:"6px",lineHeight:1.1}}>{vq.base}</div>
                <div style={{fontSize:"0.9rem",color:TM,marginBottom:"16px"}}>{vq.meaning}</div>
                <SpeakBtn text={vq.base} onSpeak={speakOnDemand} muted={muted} size="lg"/>
              </div>
              {variantQuizType==="essay"&&<><input ref={variantInputRef} style={{...Bt.input,fontSize:"1.3rem",fontFamily:"Arial",direction:"rtl",marginBottom:"10px",...(variantConfirmed?{borderColor:last?.correct?"rgba(80,200,152,0.5)":"rgba(232,74,95,0.5)"}:{})}} placeholder="변형을 히브리어로 입력..." value={variantInput} onChange={e=>!variantConfirmed&&setVariantInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){if(!variantConfirmed)handleVariantConfirm();else handleVariantNext();}}} readOnly={variantConfirmed} lang="he" spellCheck={false} autoCorrect="off"/>{variantConfirmed&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"7px",marginBottom:"10px"}}>{last?.correct?<div style={{padding:"8px 14px",borderRadius:"2px",background:"rgba(80,200,152,0.07)",border:"1px solid rgba(80,200,152,0.2)",color:TG,fontWeight:600,fontSize:"0.82rem"}}>정답</div>:<div style={{display:"flex",alignItems:"center",gap:"8px",padding:"8px 14px",borderRadius:"2px",background:"rgba(232,74,95,0.07)",border:"1px solid rgba(232,74,95,0.2)",color:TA,fontWeight:600,fontSize:"0.82rem"}}>오답 — 정답: <b style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.2rem"}}>{vq.answer}</b><SpeakBtn text={vq.answer} onSpeak={speakOnDemand} muted={muted}/></div>}</div>}</>}
              {variantQuizType==="mcq"&&<><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px",marginBottom:"10px"}}>{(vq.choices||[]).map((choice,ci)=>{const iS=variantSelected===choice;const iC=variantConfirmed&&choice===vq.answer;const iW=variantConfirmed&&iS&&choice!==vq.answer;return<button key={ci} onClick={()=>{if(!variantConfirmed)setVariantSelected(choice);}} style={{padding:"13px 10px",borderRadius:"2px",fontFamily:"Arial",direction:"rtl",fontSize:"clamp(1rem,4vw,1.4rem)",fontWeight:600,cursor:variantConfirmed?"default":"pointer",border:`1px solid ${iC?"rgba(80,200,152,0.5)":iW?"rgba(232,74,95,0.5)":iS?"rgba(80,200,152,0.35)":TL}`,background:iC?"rgba(80,200,152,0.08)":iW?"rgba(232,74,95,0.08)":iS?"rgba(80,200,152,0.06)":"rgba(255,255,255,0.02)",color:iC?TG:iW?TA:iS?TG:TT}}>{choice}</button>;})} </div>{variantConfirmed&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"7px",marginBottom:"10px"}}>{last?.correct?<div style={{padding:"8px 14px",borderRadius:"2px",background:"rgba(80,200,152,0.07)",border:"1px solid rgba(80,200,152,0.2)",color:TG,fontWeight:600,fontSize:"0.82rem"}}>정답</div>:<div style={{display:"flex",alignItems:"center",gap:"8px",padding:"8px 14px",borderRadius:"2px",background:"rgba(232,74,95,0.07)",border:"1px solid rgba(232,74,95,0.2)",color:TA,fontWeight:600,fontSize:"0.82rem"}}>오답 — 정답: <b style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.2rem"}}>{vq.answer}</b><SpeakBtn text={vq.answer} onSpeak={speakOnDemand} muted={muted}/></div>}</div>}</>}
              <div className="qr" style={{display:"flex",gap:"6px"}}>
                {!variantConfirmed?<button style={{flex:1,padding:"13px",borderRadius:"2px",background:TG,border:"none",color:"#071a0e",fontWeight:600,cursor:"pointer",fontSize:"0.88rem",...(variantQuizType==="essay"?(!variantInput.trim()?{opacity:0.22,cursor:"not-allowed"}:{}):(variantSelected===null?{opacity:0.22,cursor:"not-allowed"}:{}))}} onClick={handleVariantConfirm} disabled={variantQuizType==="essay"?!variantInput.trim():variantSelected===null}>{T.confirm}</button>:<button style={{flex:1,padding:"13px",borderRadius:"2px",background:TG,border:"none",color:"#071a0e",fontWeight:600,cursor:"pointer",fontSize:"0.88rem"}} onClick={handleVariantNext}>{variantCur+1>=variantQuestions.length?T.finish:T.next}</button>}
                <button style={{padding:"13px 17px",borderRadius:"2px",background:"transparent",border:`1px solid ${TL}`,color:TD,cursor:"pointer",fontSize:"0.82rem"}} onClick={()=>{window.speechSynthesis?.cancel();setMode(MODES.LIST);}}>그만하기</button>
              </div>
            </div>;
          })()}

          {/* Variant Result */}
          {mode===MODES.VARIANT_RESULT&&<div style={{textAlign:"center",padding:"40px 0"}}>
            <div style={{width:"110px",height:"110px",borderRadius:"2px",background:"rgba(80,200,152,0.06)",border:"1px solid rgba(80,200,152,0.25)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px"}}><span style={{fontSize:"2.8rem",fontWeight:800,color:TG,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"3px"}}>{variantResults.filter(r=>r.correct).length}</span><span style={{fontSize:"1rem",color:TD,alignSelf:"flex-end",marginBottom:"8px"}}>/{variantQuestions.length}</span></div>
            <p style={{fontSize:"0.58rem",color:TG,fontWeight:700,letterSpacing:"2px",textTransform:"uppercase",marginBottom:"4px"}}>VARIANT QUIZ</p>
            <p style={{fontSize:"1rem",color:TT,marginBottom:"18px"}}>{variantResults.filter(r=>r.correct).length===variantQuestions.length?"Perfect!":variantResults.filter(r=>r.correct).length>=variantQuestions.length*0.7?"잘했어요!":"틀린 변형을 복습해봐요!"}</p>
            <div style={{background:TS,borderRadius:"2px",border:`1px solid ${TL}`,padding:"12px",marginBottom:"14px",textAlign:"left",maxHeight:"300px",overflowY:"auto"}}>
              <h3 style={{margin:"0 0 8px",fontSize:"0.58rem",color:TD,letterSpacing:"2px",textTransform:"uppercase"}}>결과</h3>
              {variantResults.map((r,i)=>{const vt=VARIANT_TYPES.find(t=>t.id===r.variantType);return<div key={i} style={{padding:"6px 0",borderBottom:`1px solid ${TL}`,display:"flex",flexDirection:"column",gap:"2px"}}><div style={{display:"flex",alignItems:"center",gap:"7px"}}><span style={{color:r.correct?TG:TA,fontSize:"0.7rem",fontWeight:700}}>{r.correct?"✓":"✕"}</span><span style={{fontFamily:"Arial",direction:"rtl",color:TH,fontSize:"0.95rem"}}>{r.base}</span><span style={{fontSize:"0.58rem",color:TG,background:"rgba(80,200,152,0.07)",padding:"1px 5px",borderRadius:"2px"}}>{vt?vt.label[uiLang]||vt.label.ko:r.variantType}</span><SpeakBtn text={r.answer} onSpeak={speakOnDemand} muted={muted}/></div><div style={{paddingLeft:"18px",fontSize:"0.72rem"}}><span style={{color:TD}}>입력: </span><span style={{color:r.correct?TG:TA,fontFamily:"Arial",direction:"rtl"}}>{r.userInput}</span>{!r.correct&&<><span style={{color:TD,marginLeft:"7px"}}>정답: </span><span style={{color:TG,fontFamily:"Arial",direction:"rtl"}}>{r.answer}</span></>}</div></div>;})}
            </div>
            <div className="rb" style={{display:"flex",gap:"7px"}}><button style={{flex:1,padding:"13px",borderRadius:"2px",background:TG,border:"none",color:"#071a0e",fontWeight:600,cursor:"pointer",fontSize:"0.88rem"}} onClick={startVariantQuiz}>다시 풀기</button><button style={{flex:1,padding:"13px",borderRadius:"2px",background:"transparent",border:`1px solid ${TL}`,color:TD,cursor:"pointer",fontSize:"0.88rem"}} onClick={()=>setMode(MODES.LIST)}>단어장으로</button></div>
          </div>}

          {/* MCQ Result */}
          {mode===MODES.RESULT&&<div style={{textAlign:"center",padding:"40px 0"}}>
            <div style={{width:"110px",height:"110px",borderRadius:"2px",background:"rgba(232,74,95,0.06)",border:"1px solid rgba(232,74,95,0.25)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px"}}><span style={{fontSize:"2.8rem",fontWeight:800,color:TA,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"3px"}}>{score}</span><span style={{fontSize:"1rem",color:TD,alignSelf:"flex-end",marginBottom:"8px"}}>/{questions.length}</span></div>
            <p style={{fontSize:"1rem",color:TT,marginBottom:"4px"}}>{score===questions.length?"Perfect!":score>=questions.length*0.7?"잘했어요!":score>=questions.length*0.5?"조금 더 연습!":"틀린 단어를 복습해봐요!"}</p>
            <p style={{fontSize:"0.72rem",color:TD,marginBottom:"20px"}}>{Math.round(score/questions.length*100)}%</p>
            <div style={{display:"flex",justifyContent:"center",gap:"26px",marginBottom:"20px"}}>{[["mastered","✓ 암기완료",TG],["hard","! 어려움",TA],["learning","◎ 학습중","#8A8AAA"]].map(([st,label,color])=><div key={st} style={{display:"flex",flexDirection:"column",alignItems:"center",color}}><span style={{fontSize:"1.9rem",fontWeight:800,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"2px"}}>{words.filter(w=>w.status===st).length}</span><span style={{fontSize:"0.58rem",opacity:0.5,letterSpacing:"1px",textTransform:"uppercase"}}>{label}</span></div>)}</div>
            {wrongWords.length>0&&<div style={{background:TS,borderRadius:"2px",border:`1px solid ${TL}`,padding:"12px",marginBottom:"14px",textAlign:"left"}}><h3 style={{margin:"0 0 8px",fontSize:"0.58rem",color:TD,letterSpacing:"2px",textTransform:"uppercase"}}>틀린 단어</h3>{wrongWords.map((q,i)=>{const w=words.find(x=>x.id===q.wordId);return w?<div key={i} style={{padding:"6px 0",borderBottom:`1px solid ${TL}`,display:"flex",alignItems:"center",gap:"8px"}}><span style={{fontFamily:"Arial,sans-serif",fontSize:"1.05rem",direction:"rtl",color:TH}}>{w.hebrew}</span><SpeakBtn text={w.hebrew} onSpeak={speakOnDemand} muted={muted}/><span style={{color:TD}}>→</span><span style={{fontSize:"0.85rem",color:TM}}>{w.meaning}</span></div>:null;})}</div>}
            <div className="rb" style={{display:"flex",gap:"7px"}}><button style={{flex:1,padding:"13px",borderRadius:"2px",background:TA,border:"none",color:"#fff",fontWeight:600,cursor:"pointer",fontSize:"0.88rem"}} onClick={startQuiz}>다시 풀기</button><button style={{flex:1,padding:"13px",borderRadius:"2px",background:"transparent",border:`1px solid ${TL}`,color:TD,cursor:"pointer",fontSize:"0.88rem"}} onClick={()=>setMode(MODES.LIST)}>단어장으로</button></div>
          </div>}

          {/* Essay Result */}
          {mode===MODES.ESSAY_RESULT&&<div style={{textAlign:"center",padding:"40px 0"}}>
            <div style={{width:"110px",height:"110px",borderRadius:"2px",background:"rgba(167,139,250,0.06)",border:"1px solid rgba(167,139,250,0.25)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 18px"}}><span style={{fontSize:"2.8rem",fontWeight:800,color:TP,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"3px"}}>{essayScore+essayPartial}</span><span style={{fontSize:"1rem",color:TD,alignSelf:"flex-end",marginBottom:"8px"}}>/{essayQuestions.length}</span></div>
            <div style={{display:"flex",justifyContent:"center",gap:"26px",marginBottom:"20px"}}><div style={{textAlign:"center",color:TG}}><div style={{fontSize:"1.9rem",fontWeight:800,fontFamily:"'Bebas Neue',sans-serif"}}>{essayScore}</div><div style={{fontSize:"0.58rem",opacity:0.5,letterSpacing:"1px",textTransform:"uppercase"}}>정답</div></div><div style={{textAlign:"center",color:TA}}><div style={{fontSize:"1.9rem",fontWeight:800,fontFamily:"'Bebas Neue',sans-serif"}}>{essayPartial}</div><div style={{fontSize:"0.58rem",opacity:0.5,letterSpacing:"1px",textTransform:"uppercase"}}>부분</div></div><div style={{textAlign:"center",color:TD}}><div style={{fontSize:"1.9rem",fontWeight:800,fontFamily:"'Bebas Neue',sans-serif"}}>{essayQuestions.length-essayScore-essayPartial}</div><div style={{fontSize:"0.58rem",opacity:0.5,letterSpacing:"1px",textTransform:"uppercase"}}>오답</div></div></div>
            <div style={{background:TS,borderRadius:"2px",border:`1px solid ${TL}`,padding:"12px",marginBottom:"14px",textAlign:"left",maxHeight:"300px",overflowY:"auto"}}><h3 style={{margin:"0 0 8px",fontSize:"0.58rem",color:TP,letterSpacing:"2px",textTransform:"uppercase"}}>전체 결과</h3>{essayResults.map((r,i)=>{const color=r.result==="exact"?TG:r.result==="partial"?TA:"rgba(232,74,95,0.55)";return<div key={i} style={{padding:"6px 0",borderBottom:`1px solid ${TL}`,display:"flex",flexDirection:"column",gap:"2px"}}><div style={{display:"flex",alignItems:"center",gap:"7px"}}><span style={{fontFamily:r.questionType==="mean_to_heb"?"inherit":"Arial",fontSize:r.questionType==="mean_to_heb"?"0.85rem":"1.05rem",direction:r.questionType==="mean_to_heb"?"ltr":"rtl",color:TH}}>{r.question}</span><SpeakBtn text={r.question} onSpeak={speakOnDemand} muted={muted}/><span style={{marginLeft:"auto",fontSize:"0.7rem",color}}>{r.result==="exact"?"✓":r.result==="partial"?"△":"✕"}</span></div><div style={{fontSize:"0.72rem",color:TD}}>내 답: <span style={{color}}>{r.userInput}</span>{r.result!=="exact"&&<> | 정답: <span style={{color:TG}}>{r.answer}</span></>}</div></div>;})}</div>
            <div className="rb" style={{display:"flex",gap:"7px"}}><button style={{flex:1,padding:"13px",borderRadius:"2px",background:TP,border:"none",color:"#fff",fontWeight:600,cursor:"pointer",fontSize:"0.88rem"}} onClick={startEssay}>다시 풀기</button><button style={{flex:1,padding:"13px",borderRadius:"2px",background:"transparent",border:`1px solid ${TL}`,color:TD,cursor:"pointer",fontSize:"0.88rem"}} onClick={()=>setMode(MODES.LIST)}>단어장으로</button></div>
          </div>}

        </div>} {/* end isQuizActive */}

        {/* ── TAB CONTENT (hidden when quiz active) ─────────── */}
        {!isQuizActive&&<div style={{padding:"0 20px"}}>

          {/* ══════ TAB: 단어장 (LIST) ══════ */}
          {activeTab==="list"&&<div>
            {/* Filter Row */}
            <div style={{display:"flex",gap:"7px",padding:"12px 0",borderBottom:`1px solid ${TL}`,alignItems:"center",flexWrap:"wrap"}}>
              <input style={{...Bt.input,flex:1,minWidth:"130px",padding:"8px 12px",fontSize:"0.85rem"}} placeholder={uiLang==="en"?"Search...":"검색..."} value={searchQuery} onChange={e=>{setSearchQuery(e.target.value);setPage(0);}}/>
              <select value={sortBy} onChange={e=>{setSortBySave(e.target.value);setPage(0);}} style={{padding:"7px 9px",borderRadius:"2px",background:"rgba(255,255,255,0.04)",border:`1px solid ${TL}`,color:TM,fontSize:"0.68rem",cursor:"pointer",outline:"none"}}>
                <option value="default">{T.sortDefault}</option><option value="hebrew_asc">{T.sortHebAsc}</option><option value="hebrew_desc">{T.sortHebDesc}</option><option value="meaning_asc">{T.sortMeanAsc}</option><option value="meaning_desc">{T.sortMeanDesc}</option><option value="hard_first">{T.sortHardFirst}</option><option value="mastered_first">{T.sortMasteredFirst}</option><option value="wrong_desc">{T.sortWrongFirst}</option>
              </select>
              {[10,20,9999].map(n=><button key={n} onClick={()=>{setPageSizeSave(n);setPage(0);}} style={{...Bt.ghost,padding:"7px 9px",fontSize:"0.68rem",color:pageSize===n?TT:TD,...(pageSize===n?{borderColor:"rgba(255,255,255,0.2)"}:{})}}>{n===9999?(uiLang==="en"?"All":"전체"):n}</button>)}
            </div>

            {/* Status + Wallet Tabs */}
            <div style={{display:"flex",borderBottom:`1px solid ${TL}`,overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}}>
              {[["all",T.all,words.length],["learning",T.learning,learningCount],["hard",T.hard,hardCount],["mastered",T.done,masteredCount]].map(([val,label,cnt])=><button key={val} onClick={()=>{setListFilterSave(val);setWalletFilter(null);setPage(0);setSelectedIds(new Set());}} style={{padding:"9px 13px",border:"none",borderBottom:`2px solid ${listFilter===val&&!walletFilter?TA:"transparent"}`,background:"transparent",color:listFilter===val&&!walletFilter?TT:TD,cursor:"pointer",fontSize:"0.68rem",whiteSpace:"nowrap",flexShrink:0,letterSpacing:"0.5px",textTransform:"uppercase",fontWeight:listFilter===val&&!walletFilter?600:400}}>{label} <span style={{fontSize:"0.6rem",opacity:0.5,marginLeft:"2px"}}>{cnt}</span></button>)}
              {wallets.map(wl=>{const cnt=words.filter(w=>wl.wordIds.includes(w.id)).length;const isA=walletFilter===wl.id;return<button key={wl.id} onClick={()=>{setWalletFilter(isA?null:wl.id);setPage(0);setSelectedIds(new Set());}} style={{padding:"9px 12px",border:"none",borderBottom:`2px solid ${isA?wl.color:"transparent"}`,background:"transparent",color:isA?wl.color:TD,cursor:"pointer",fontSize:"0.68rem",whiteSpace:"nowrap",flexShrink:0,display:"flex",alignItems:"center",gap:"4px"}}><span style={{width:"5px",height:"5px",borderRadius:"50%",background:wl.color}}/>{wl.name} <span style={{opacity:0.5,fontSize:"0.6rem"}}>{cnt}</span></button>;})}
            </div>

            {/* Bulk Actions */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:`1px solid ${TL}`}}>
              <div style={{display:"flex",alignItems:"center",gap:"7px",flexWrap:"wrap"}}>
                <span style={{fontSize:"0.62rem",color:TD}}>{T.wordCount(searchedWords.length)}</span>
                <button onClick={()=>{if(selectedIds.size===filteredWords.length)setSelectedIds(new Set());else setSelectedIds(new Set(filteredWords.map(w=>w.id)));}} style={{...Bt.ghost,fontSize:"0.62rem",padding:"2px 7px"}}>{selectedIds.size===filteredWords.length&&filteredWords.length>0?T.deselect:T.selectAll}</button>
                {selectedIds.size>0&&<><div style={{position:"relative"}}><button onClick={()=>setBulkWalletOpen(v=>!v)} style={{...Bt.ghost,fontSize:"0.62rem",padding:"2px 7px",color:TH}}>📚 {selectedIds.size}개 ▾</button>{bulkWalletOpen&&<div style={{position:"absolute",top:"100%",left:0,zIndex:50,marginTop:"2px",background:TS,border:`1px solid ${TL}`,borderRadius:"2px",padding:"8px",minWidth:"155px",boxShadow:"0 8px 24px rgba(0,0,0,0.6)"}}>{(()=>{const sel=bulkWalletOpen instanceof Set?bulkWalletOpen:new Set();return<>{wallets.map(wl=>{const checked=sel.has(wl.id);return<button key={wl.id} onClick={()=>{const ns=new Set(sel);checked?ns.delete(wl.id):ns.add(wl.id);setBulkWalletOpen(ns);}} style={{display:"flex",alignItems:"center",gap:"7px",padding:"5px 7px",width:"100%",background:"transparent",border:"none",borderRadius:"2px",cursor:"pointer",color:checked?wl.color:TT,fontSize:"0.78rem",marginBottom:"1px"}}><span style={{width:"11px",height:"11px",borderRadius:"2px",flexShrink:0,background:checked?wl.color:"transparent",border:`1px solid ${checked?wl.color:"rgba(255,255,255,0.2)"}`,display:"flex",alignItems:"center",justifyContent:"center"}}>{checked&&<span style={{color:"#fff",fontSize:"0.5rem"}}>✓</span>}</span>{wl.name}</button>;}){sel.size>0&&<button onClick={()=>{saveWallets(wallets.map(wl=>sel.has(wl.id)?{...wl,wordIds:[...new Set([...wl.wordIds,...selectedIds])]}:wl));setBulkWalletOpen(false);setSelectedIds(new Set());showToast(`${selectedIds.size}개 추가!`);}} style={{...Bt.primary,width:"100%",marginTop:"4px",padding:"5px",fontSize:"0.75rem"}}>{sel.size}개 단어장에 추가</button>}</>;})()}</div>}</div><button onClick={()=>{if(window.confirm(`${selectedIds.size}개 삭제할까요?`)){setWords(ws=>ws.filter(w=>!selectedIds.has(w.id)));setSelectedIds(new Set());}}} style={{...Bt.ghost,fontSize:"0.62rem",padding:"2px 7px",color:TA,borderColor:"rgba(232,74,95,0.28)"}}>{T.deleteN(selectedIds.size)}</button></>}
              </div>
            </div>

            {/* Word List */}
            {filteredWords.length===0&&<div style={{textAlign:"center",color:TD,padding:"60px 0",fontSize:"0.82rem"}}>{searchQuery?`"${searchQuery}" 검색 결과가 없어요`:"단어가 없어요"}</div>}
            {filteredWords.map((w,i)=>{
              const st=STATUS_CONFIG[w.status];
              const isMenuOpen=expandedVariantWord===`menu_${w.id}`;
              return<div key={w.id} style={{display:"flex",alignItems:"center",gap:"10px",borderBottom:`1px solid ${TL}`,padding:"10px 0",background:selectedIds.has(w.id)?"rgba(232,74,95,0.04)":"transparent"}}>
                <input type="checkbox" checked={selectedIds.has(w.id)} onChange={e=>{const s=new Set(selectedIds);e.target.checked?s.add(w.id):s.delete(w.id);setSelectedIds(s);}} style={{width:"13px",height:"13px",cursor:"pointer",accentColor:TA,flexShrink:0}}/>
                <span style={{fontSize:"0.55rem",color:TD,minWidth:"18px",flexShrink:0,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"1px"}}>{(page*pageSize)+i+1}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:"Arial,sans-serif",fontSize:"1.08rem",color:TH,direction:"rtl",marginBottom:"1px"}}>{w.hebrew}</div>
                  <div style={{display:"flex",alignItems:"center",gap:"5px",flexWrap:"wrap"}}>
                    <span style={{fontSize:"0.75rem",color:TM}}>{w.meaning||<span style={{color:TD,fontStyle:"italic"}}>뜻 없음</span>}</span>
                    {w.wordType&&(()=>{const wt=WORD_TYPES.find(t=>t.id===w.wordType);return wt?<span style={{fontSize:"0.5rem",background:"rgba(255,255,255,0.04)",border:`1px solid ${TL}`,borderRadius:"2px",padding:"0px 3px",color:TD}}>{wt.emoji}</span>:null;})()}
                    {w.root&&<span style={{fontSize:"0.5rem",background:"rgba(80,200,152,0.05)",border:"1px solid rgba(80,200,152,0.14)",borderRadius:"2px",padding:"0px 4px",color:TG,fontFamily:"Arial",direction:"rtl"}}>{w.root}</span>}
                    {(w.variants||[]).length>0&&<span style={{fontSize:"0.5rem",color:TG,background:"rgba(80,200,152,0.05)",border:"1px solid rgba(80,200,152,0.12)",borderRadius:"2px",padding:"0px 3px"}}>{w.variants.length}v</span>}
                  </div>
                  {cardStyle==="inline"&&<div style={{display:"flex",alignItems:"center",gap:"4px",marginTop:"4px",flexWrap:"wrap"}}>
                    <SpeakOnceBtn text={w.hebrew} onSpeak={speakOnDemand} muted={muted} repeatN={1}/>
                    {(()=>{const sc=STATUS_CONFIG[w.status];const order=["learning","hard","mastered"];const next=order[(order.indexOf(w.status)+1)%3];return<button onClick={()=>setManualStatus(w.id,next)} style={{padding:"2px 6px",borderRadius:"2px",border:`1px solid ${sc.border}`,background:sc.bg,color:sc.color,cursor:"pointer",fontSize:"0.6rem",fontWeight:600}}>{sc.emoji} {uiLang==="en"?sc.labelEn:sc.labelKo}</button>;})()}
                    <button onClick={()=>startEdit(w)} style={{padding:"2px 6px",borderRadius:"2px",border:`1px solid ${TL}`,background:"transparent",color:TD,cursor:"pointer",fontSize:"0.62rem"}}>편집</button>
                    {(w.variants||[]).length>0&&<button onClick={()=>openVariantModal(w)} style={{padding:"2px 6px",borderRadius:"2px",border:"1px solid rgba(167,139,250,0.18)",background:"transparent",color:TP,cursor:"pointer",fontSize:"0.62rem"}}>변형</button>}
                    <button onClick={()=>{if(window.confirm("삭제할까요?"))deleteWord(w.id);}} style={{padding:"2px 6px",borderRadius:"2px",border:"1px solid rgba(232,74,95,0.18)",background:"transparent",color:TA,cursor:"pointer",fontSize:"0.62rem"}}>삭제</button>
                  </div>}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"4px",flexShrink:0}}>
                  <div style={{width:"5px",height:"5px",borderRadius:"50%",background:st.color}}/>
                  <SpeakOnceBtn text={w.hebrew} onSpeak={speakOnDemand} muted={muted} repeatN={1}/>
                  {cardStyle==="menu"&&<div style={{position:"relative"}}>
                    <button onClick={e=>{e.stopPropagation();setExpandedVariantWord(isMenuOpen?null:`menu_${w.id}`);}} style={{padding:"4px 7px",borderRadius:"2px",border:`1px solid ${isMenuOpen?"rgba(255,255,255,0.14)":TL}`,background:isMenuOpen?"rgba(255,255,255,0.07)":"transparent",color:TM,cursor:"pointer",fontSize:"0.72rem",letterSpacing:"2px"}}>···</button>
                    {isMenuOpen&&<div onClick={e=>e.stopPropagation()} style={{position:"absolute",right:0,top:"calc(100% + 3px)",background:TS,border:`1px solid rgba(255,255,255,0.09)`,borderRadius:"2px",padding:"8px",display:"flex",flexDirection:"column",gap:"4px",minWidth:"145px",zIndex:10,boxShadow:"0 8px 28px rgba(0,0,0,0.6)"}}>
                      <div style={{display:"flex",gap:"3px",marginBottom:"3px"}}>{["learning","hard","mastered"].map(s=>{const sc2=STATUS_CONFIG[s];return<button key={s} onClick={()=>{setManualStatus(w.id,s);setExpandedVariantWord(null);}} style={{flex:1,padding:"4px 2px",borderRadius:"2px",border:`1px solid ${w.status===s?sc2.border:TL}`,background:w.status===s?sc2.bg:"transparent",color:w.status===s?sc2.color:TD,cursor:"pointer",fontSize:"0.72rem",fontWeight:600}}>{sc2.emoji}</button>;})}  </div>
                      {(()=>{const [rn,setRn]=[w._repeatN||1,n=>setWords(ws=>ws.map(x=>x.id===w.id?{...x,_repeatN:n}:x))];return<div style={{display:"flex",gap:"3px",alignItems:"center",marginBottom:"3px"}}><span style={{fontSize:"0.58rem",color:TD,flexShrink:0}}>발음</span><SpeakOnceBtn text={w.hebrew} onSpeak={speakOnDemand} muted={muted} repeatN={rn}/><input type="number" min={1} max={20} value={rn} onClick={e=>e.stopPropagation()} onChange={e=>setRn(Math.max(1,Math.min(20,Number(e.target.value)||1)))} style={{width:"32px",padding:"2px 4px",borderRadius:"2px",background:"rgba(255,255,255,0.04)",border:`1px solid ${TL}`,color:TH,fontSize:"0.7rem",textAlign:"center",outline:"none"}}/><span style={{fontSize:"0.58rem",color:TD}}>회</span></div>;})()}
                      <div style={{display:"flex",gap:"3px",paddingTop:"4px",borderTop:`1px solid ${TL}`}}>
                        <button onClick={()=>{startEdit(w);setExpandedVariantWord(null);}} style={{flex:1,padding:"4px",borderRadius:"2px",border:`1px solid ${TL}`,background:"transparent",color:TM,cursor:"pointer",fontSize:"0.7rem"}}>편집</button>
                        <button onClick={()=>{setExpandedVariantWord(w.id);openVariantModal(w);}} style={{flex:1,padding:"4px",borderRadius:"2px",border:"1px solid rgba(167,139,250,0.18)",background:"transparent",color:TP,cursor:"pointer",fontSize:"0.7rem"}}>변형{w.variants?.length?` ${w.variants.length}`:""}</button>
                        {wallets.length>0&&<button onClick={e=>{e.stopPropagation();setWalletPickWord(w.id);}} style={{flex:1,padding:"4px",borderRadius:"2px",border:`1px solid rgba(255,154,108,0.18)`,background:"transparent",color:TH,cursor:"pointer",fontSize:"0.7rem"}}>📚</button>}
                        <button onClick={()=>{const msg=walletFilter?"이 단어장에서 제거할까요?":"완전히 삭제할까요?";if(window.confirm(msg))deleteWord(w.id);}} style={{flex:1,padding:"4px",borderRadius:"2px",border:"1px solid rgba(232,74,95,0.18)",background:"transparent",color:TA,cursor:"pointer",fontSize:"0.7rem"}}>삭제</button>
                      </div>
                    </div>}
                  </div>}
                </div>
              </div>;
            })}

            {/* Pagination */}
            {pageSize!==9999&&totalPages>1&&<div style={{display:"flex",justifyContent:"center",gap:"3px",padding:"14px 0"}}>
              <button style={{...Bt.ghost,opacity:page===0?0.22:1}} onClick={()=>page>0&&setPage(p=>p-1)} disabled={page===0}>←</button>
              {Array.from({length:totalPages},(_,i)=><button key={i} style={{...Bt.ghost,...(page===i?{background:"rgba(232,74,95,0.1)",borderColor:"rgba(232,74,95,0.4)",color:TA}:{})}} onClick={()=>setPage(i)}>{i+1}</button>)}
              <button style={{...Bt.ghost,opacity:page===totalPages-1?0.22:1}} onClick={()=>page<totalPages-1&&setPage(p=>p+1)} disabled={page===totalPages-1}>→</button>
            </div>}
          </div>}

          {/* ══════ TAB: 추가 (ADD) ══════ */}
          {activeTab==="add"&&<div style={{paddingTop:"16px"}}>
            {/* Sub-tab pills */}
            <div style={{display:"flex",gap:"4px",background:"rgba(255,255,255,0.04)",borderRadius:"2px",padding:"4px",marginBottom:"16px",overflowX:"auto",scrollbarWidth:"none"}}>
              {[["form",uiLang==="en"?"Direct Input":"직접 입력"],["reverso","Reverso"],["root",uiLang==="en"?"Root Search":"어근 검색"],["meaning",uiLang==="en"?"Meaning Search":"뜻 검색"],["batch",uiLang==="en"?"Batch":"일괄 추가"]].map(([v,l])=><button key={v} onClick={()=>setAddSubView(v)} style={{padding:"7px 12px",borderRadius:"2px",border:"none",fontSize:"0.7rem",fontWeight:600,cursor:"pointer",flexShrink:0,background:addSubView===v?TA:"transparent",color:addSubView===v?"#fff":TD,transition:"all 0.15s"}}>{l}</button>)}
            </div>

            {/* Direct Input */}
            {addSubView==="form"&&<div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
              <div style={{background:TS,borderRadius:"2px",border:`1px solid ${TL}`,padding:"16px"}}>
                {editId!==null&&<div style={{fontSize:"0.6rem",color:TA,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"10px",fontWeight:700}}>수정 중</div>}
                <div style={{display:"flex",gap:"8px",marginBottom:"8px"}}>
                  <input style={{...Bt.input,flex:1,direction:bookInfo.dir,fontFamily:"Arial,sans-serif",fontSize:"1rem"}} placeholder={bookInfo.placeholderA[uiLang]||bookInfo.placeholderA.ko} value={newHebrew} onChange={e=>setNewHebrew(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addWord()}/>
                  <input style={{...Bt.input,flex:1}} placeholder={bookInfo.placeholderB[uiLang]||bookInfo.placeholderB.ko} value={newMeaning} onChange={e=>setNewMeaning(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addWord()}/>
                </div>
                {currentBook==="hebrew"&&<div style={{display:"flex",gap:"4px",flexWrap:"wrap",marginBottom:"8px"}}>{WORD_TYPES.map(wt=><button key={wt.id} onClick={()=>setNewWordType(t=>t===wt.id?null:wt.id)} style={{...Bt.ghost,padding:"4px 9px",fontSize:"0.7rem",...(newWordType===wt.id?{background:"rgba(232,74,95,0.1)",borderColor:"rgba(232,74,95,0.4)",color:TA}:{})}}>{wt.emoji} {wt.label[uiLang]||wt.label.ko}</button>)}</div>}
                {wallets.length>0&&editId===null&&<div style={{marginBottom:"8px"}}><div style={{fontSize:"0.58rem",color:TD,marginBottom:"4px",letterSpacing:"0.8px",textTransform:"uppercase"}}>{T.addToWordbook}</div><div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>{wallets.map(wl=>{const sel=newWordWallets.has(wl.id);return<button key={wl.id} onClick={()=>setNewWordWallets(s=>{const n=new Set(s);sel?n.delete(wl.id):n.add(wl.id);return n;})} style={{padding:"3px 9px",borderRadius:"2px",fontSize:"0.7rem",cursor:"pointer",border:"1px solid",background:sel?`${wl.color}10`:"transparent",borderColor:sel?`${wl.color}50`:TL,color:sel?wl.color:TD}}><span style={{width:"5px",height:"5px",borderRadius:"50%",background:wl.color,display:"inline-block",marginRight:"4px"}}/>{wl.name}{sel?" ✓":""}</button>);})</div></div>}
                <div style={{display:"flex",gap:"6px"}}>
                  <button style={{...Bt.primary,flex:1}} onClick={addWord}>{editId!==null?(uiLang==="en"?T.editBtn:"수정 완료"):(uiLang==="en"?T.addBtn:"추가")}</button>
                  {newHebrew&&<SpeakBtn text={newHebrew} onSpeak={speakOnDemand} muted={muted}/>}
                  {editId!==null&&<button style={Bt.ghost} onClick={cancelEdit}>{T.cancelBtn}</button>}
                </div>
              </div>
              {/* CSV/File quick import */}
              <div style={{background:TS,borderRadius:"2px",border:`1px solid ${TL}`,padding:"14px"}}>
                <div style={{fontSize:"0.6rem",color:TD,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"10px",fontWeight:700}}>파일로 가져오기</div>
                <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                  {[[uiLang==="en"?"⬆ JSON Import":"⬆ JSON 불러오기",()=>fileInputRef.current.click(),TM],[uiLang==="en"?"CSV/Excel":"CSV/엑셀",()=>csvInputRef.current.click(),TBL],[uiLang==="en"?"Paste JSON":"붙여넣기",()=>setShowPasteModal(true),TBL]].map(([label,handler,color])=><button key={label} onClick={handler} style={{padding:"7px 12px",borderRadius:"2px",background:"rgba(255,255,255,0.03)",border:`1px solid ${TL}`,color,cursor:"pointer",fontSize:"0.72rem"}}>{label}</button>)}
                  <input ref={fileInputRef} type="file" accept=".json" style={{display:"none"}} onChange={handleFileChange}/>
                  <input ref={csvInputRef} type="file" accept=".xlsx,.xls,.csv,.tsv,.txt" style={{display:"none"}} onChange={handleCSVChange}/>
                </div>
              </div>
            </div>}

            {/* Reverso */}
            {addSubView==="reverso"&&<div style={{background:TS,borderRadius:"2px",border:`1px solid rgba(80,200,152,0.15)`,padding:"16px"}}>
              <div style={{fontSize:"0.6rem",color:TG,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"12px",fontWeight:700}}>Reverso 동사 변형 가져오기</div>
              <p style={{fontSize:"0.75rem",color:TD,marginBottom:"10px"}}>히브리어 동사 원형을 입력하면 변형표를 자동으로 가져와요</p>
              <div style={{display:"flex",gap:"8px",marginBottom:"8px"}}>
                <input style={{...Bt.input,flex:1,direction:"rtl",fontFamily:"Arial",fontSize:"1.05rem"}} placeholder="לָשִׁיר, לְדַבֵּר..." value={pealimRoot} onChange={e=>setPealimRoot(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchPealim()} lang="he" spellCheck={false} autoCorrect="off"/>
                <button onClick={searchPealim} disabled={pealimLoading} style={{...Bt.green,minWidth:"56px",opacity:pealimLoading?0.5:1}}>{pealimLoading?"…":"검색"}</button>
              </div>
              <div style={{display:"flex",gap:"5px",flexWrap:"wrap",marginBottom:"10px"}}>{[["לְדַבֵּר","말하다"],["לָלֶכֶת","가다"],["לֶאֱכֹל","먹다"],["לִכְתּוֹב","쓰다"],["לָשִׁיר","노래"],["לִשְׁמֹעַ","듣다"]].map(([v,h])=><button key={v} onClick={()=>setPealimRoot(v)} style={{padding:"3px 9px",borderRadius:"2px",background:"rgba(255,255,255,0.03)",border:`1px solid ${TL}`,color:TH,fontSize:"0.72rem",cursor:"pointer",fontFamily:"Arial",direction:"rtl"}}>{v} <span style={{color:TD,direction:"ltr"}}>{h}</span></button>)}</div>
              {pealimError&&<div style={{padding:"8px",background:"rgba(232,74,95,0.06)",border:"1px solid rgba(232,74,95,0.2)",borderRadius:"2px",color:"#f08080",fontSize:"0.8rem",marginBottom:"8px"}}>{pealimError}</div>}
              {pealimPreview&&<div><div style={{background:"rgba(80,200,152,0.05)",border:"1px solid rgba(80,200,152,0.15)",borderRadius:"2px",padding:"14px",marginBottom:"10px"}}><div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px"}}><span style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.4rem",color:TG}}>{pealimPreview.infinitive}</span><span style={{fontSize:"0.62rem",background:"rgba(80,200,152,0.1)",padding:"2px 7px",borderRadius:"2px",color:TG}}>{Object.keys(pealimPreview.variants||{}).length}개 변형</span></div><input value={pealimPreview.meaning||""} onChange={e=>setPealimPreview(p=>({...p,meaning:e.target.value}))} style={{...Bt.input,marginBottom:"10px"}} placeholder="뜻 입력 *필수"/><div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"2px",maxHeight:"200px",overflowY:"auto"}}>{Object.entries(pealimPreview.variants||{}).filter(([,f])=>f).map(([tid,form])=><div key={tid} onClick={()=>speakOnDemand(form)} style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"5px 3px",background:"rgba(255,255,255,0.03)",borderRadius:"2px",cursor:"pointer",border:`1px solid ${TL}`}}><span style={{color:TD,fontSize:"0.55rem"}}>{tid}</span><span style={{fontFamily:"Arial",direction:"rtl",color:TT,fontSize:"0.85rem",fontWeight:600}}>{form}</span></div>)}</div></div><button onClick={addNewWordFromPealim} style={{...Bt.green,width:"100%",padding:"12px",marginBottom:"6px"}}>단어장에 추가</button><button onClick={()=>setPealimPreview(null)} style={{...Bt.ghost,width:"100%"}}>← 다시 검색</button></div>}
              {/* Refresh all */}
              <div style={{marginTop:"14px",paddingTop:"12px",borderTop:`1px solid ${TL}`}}>
                <button onClick={refreshAllVariants} disabled={refreshingVariants} style={{...Bt.ghost,width:"100%",color:TG,borderColor:"rgba(80,200,152,0.25)",fontSize:"0.75rem",padding:"9px"}}>{refreshingVariants?"업데이트 중...":"🔄 모든 변형 다시 불러오기"}</button>
                {refreshLog.length>0&&<div style={{marginTop:"6px"}}><button onClick={()=>setShowRefreshLog(v=>!v)} style={{...Bt.ghost,width:"100%",fontSize:"0.68rem",marginBottom:"3px"}}>{showRefreshLog?"▲ 숨기기":"▼ 결과"} ({refreshLog.filter(l=>l.status==="ok").length}성공/{refreshLog.filter(l=>l.status==="fail").length}실패)</button>{showRefreshLog&&<div style={{maxHeight:"140px",overflowY:"auto"}}>{refreshLog.map((l,i)=><div key={i} style={{display:"flex",gap:"7px",alignItems:"center",padding:"4px 0",borderBottom:`1px solid ${TL}`,fontSize:"0.7rem"}}><span style={{color:l.status==="ok"?TG:TA}}>{l.status==="ok"?"✓":"✕"}</span><span style={{fontFamily:"Arial",direction:"rtl",color:TH,minWidth:"55px"}}>{l.hebrew}</span><span style={{color:TM,flex:1}}>{l.meaning}</span>{l.status==="ok"?<span style={{color:TG,fontSize:"0.65rem"}}>{l.variantCount}개</span>:<span style={{color:TA,fontSize:"0.65rem"}}>{l.error}</span>}</div>)}</div>}</div>}
              </div>
              {/* Wallet targeting */}
              {wallets.length>0&&<div style={{marginTop:"10px",padding:"9px 12px",border:`1px solid ${TL}`,borderRadius:"2px"}}><div style={{fontSize:"0.58rem",color:TD,marginBottom:"4px",letterSpacing:"0.8px",textTransform:"uppercase"}}>{T.addToWordbook}</div><div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>{wallets.map(wl=>{const sel=importTargetWallets.has(wl.id);return<button key={wl.id} onClick={()=>setImportTargetWallets(s=>{const n=new Set(s);sel?n.delete(wl.id):n.add(wl.id);return n;})} style={{padding:"3px 9px",borderRadius:"2px",fontSize:"0.7rem",cursor:"pointer",border:"1px solid",background:sel?`${wl.color}10`:"transparent",borderColor:sel?`${wl.color}50`:TL,color:sel?wl.color:TD}}>{wl.name}{sel?" ✓":""}</button>);})</div></div>}
            </div>}

            {/* Root Search */}
            {addSubView==="root"&&<div style={{background:TS,borderRadius:"2px",border:`1px solid ${TL}`,padding:"16px"}}>
              <div style={{fontSize:"0.6rem",color:TM,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"12px",fontWeight:700}}>어근으로 단어 검색 (Pealim)</div>
              <div style={{display:"flex",gap:"8px",marginBottom:"10px"}}>
                <input style={{...Bt.input,flex:1,direction:"rtl",fontFamily:"Arial",fontSize:"1.05rem"}} placeholder="ד-ב-ר" value={rootSearchInput} onChange={e=>setRootSearchInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchByRoot()}/>
                <button onClick={searchByRoot} disabled={rootSearchLoading} style={{...Bt.primary,minWidth:"52px",opacity:rootSearchLoading?0.5:1}}>{rootSearchLoading?"…":"검색"}</button>
              </div>
              {rootSearchError&&<div style={{color:TA,fontSize:"0.78rem",marginBottom:"8px",padding:"7px",background:"rgba(232,74,95,0.06)",borderRadius:"2px"}}>{rootSearchError}</div>}
              {rootSearchResults.length>0&&<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}><span style={{fontSize:"0.68rem",color:TD}}>{rootSearchResults.length}개</span><div style={{display:"flex",gap:"5px"}}><button onClick={()=>setRootSelected(s=>s.size===rootSearchResults.length?new Set():new Set(rootSearchResults.map((_,i)=>i)))} style={{...Bt.ghost,fontSize:"0.68rem",padding:"2px 7px"}}>전체선택</button>{rootSelected.size>0&&<button onClick={addSelectedRootWords} style={{...Bt.primary,padding:"4px 10px",fontSize:"0.75rem"}}>{rootSelected.size}개 추가</button>}</div></div><div style={{maxHeight:"280px",overflowY:"auto"}}>{rootSearchResults.map((r,i)=>{const iS=rootSelected.has(i);const already=!!words.find(w=>stripNikkud(w.hebrew)===stripNikkud(r.hebrew));return<div key={i} onClick={()=>{if(already)return;setRootSelected(s=>{const n=new Set(s);n.has(i)?n.delete(i):n.add(i);return n;});}} style={{display:"flex",gap:"8px",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${TL}`,cursor:already?"default":"pointer",opacity:already?0.4:1}}><div style={{width:"13px",height:"13px",borderRadius:"2px",flexShrink:0,border:`1px solid ${iS?"rgba(232,74,95,0.6)":"rgba(255,255,255,0.15)"}`,background:iS?"rgba(232,74,95,0.8)":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>{iS&&<span style={{color:"#fff",fontSize:"0.55rem",fontWeight:700}}>✓</span>}</div>{r.pos&&<span style={{fontSize:"0.58rem",padding:"1px 5px",borderRadius:"2px",background:"rgba(255,255,255,0.04)",color:TM,flexShrink:0}}>{r.pos}</span>}<span style={{fontFamily:"Arial",direction:"rtl",fontSize:"1rem",color:TH,minWidth:"65px"}}>{r.hebrew}</span><span style={{fontSize:"0.78rem",color:TM,flex:1}}>{r.meaning||""}</span>{already&&<span style={{fontSize:"0.6rem",color:TG}}>✓</span>}</div>);})</div></div>}
            </div>}

            {/* Meaning Search */}
            {addSubView==="meaning"&&<div style={{background:TS,borderRadius:"2px",border:`1px solid ${TL}`,padding:"16px"}}>
              <div style={{fontSize:"0.6rem",color:TH,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"12px",fontWeight:700}}>뜻으로 히브리어 검색</div>
              <div style={{display:"flex",gap:"8px",marginBottom:"10px"}}>
                <input style={{...Bt.input,flex:1}} placeholder="사랑, love..." value={wordSearchInput} onChange={e=>setWordSearchInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchWordByMeaning()}/>
                <button onClick={searchWordByMeaning} disabled={wordSearchLoading} style={{...Bt.primary,minWidth:"52px",opacity:wordSearchLoading?0.5:1}}>{wordSearchLoading?"…":"검색"}</button>
              </div>
              {wordSearchError&&<div style={{color:TA,fontSize:"0.78rem",marginBottom:"8px",padding:"7px",background:"rgba(232,74,95,0.06)",borderRadius:"2px"}}>{wordSearchError}</div>}
              {wordSearchResults.length>0&&<div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}><span style={{fontSize:"0.68rem",color:TD}}>{wordSearchResults.length}개</span><div style={{display:"flex",gap:"5px"}}><button onClick={()=>setWordSearchSelected(s=>s.size===wordSearchResults.length?new Set():new Set(wordSearchResults.map((_,i)=>i)))} style={{...Bt.ghost,fontSize:"0.68rem",padding:"2px 7px"}}>전체선택</button>{wordSearchSelected.size>0&&<button onClick={addSelectedWordSearchResults} style={{...Bt.primary,padding:"4px 10px",fontSize:"0.75rem"}}>{wordSearchSelected.size}개 추가</button>}</div></div><div style={{maxHeight:"300px",overflowY:"auto"}}>{wordSearchResults.map((r,i)=>{const sel=wordSearchSelected.has(i);const exists=!!words.find(w=>stripNikkud(w.hebrew||"")===stripNikkud(r.hebrew||"")&&w.meaning===r.meaning);return<div key={i} onClick={()=>{if(exists)return;setWordSearchSelected(s=>{const n=new Set(s);n.has(i)?n.delete(i):n.add(i);return n;});}} style={{display:"flex",gap:"8px",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${TL}`,cursor:exists?"default":"pointer",opacity:exists?0.4:1}}><div style={{width:"13px",height:"13px",borderRadius:"2px",flexShrink:0,border:`1px solid ${sel?"rgba(232,74,95,0.6)":"rgba(255,255,255,0.15)"}`,background:sel?"rgba(232,74,95,0.8)":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>{sel&&<span style={{color:"#fff",fontSize:"0.55rem",fontWeight:700}}>✓</span>}</div>{r.pos!=="translation"&&<span style={{fontFamily:"Arial",direction:"rtl",fontSize:"1rem",color:TH,minWidth:"70px"}}>{r.hebrew}</span>}<span style={{fontSize:"0.8rem",color:TT,flex:1}}>{r.meaning}</span>{exists&&<span style={{fontSize:"0.6rem",color:TG}}>✓</span>}</div>);})</div></div>}
            </div>}

            {/* Batch Text */}
            {addSubView==="batch"&&<div style={{background:TS,borderRadius:"2px",border:`1px solid ${TL}`,padding:"16px"}}>
              <div style={{fontSize:"0.6rem",color:TG,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"8px",fontWeight:700}}>텍스트 일괄 추가</div>
              <div style={{background:"rgba(232,74,95,0.06)",border:"1px solid rgba(232,74,95,0.15)",borderRadius:"2px",padding:"8px 12px",marginBottom:"10px",fontSize:"0.75rem",color:TA,fontFamily:"monospace",lineHeight:1.9}}>שָׁלוֹם=평화<br/>תּוֹדָה=감사합니다<br/>אֱלֹהִים=하나님</div>
              <textarea ref={batchTextRef} style={{width:"100%",minHeight:"200px",background:"rgba(255,255,255,0.03)",border:`1px solid ${TL}`,borderRadius:"2px",color:TT,padding:"10px",fontSize:"1rem",direction:"rtl",fontFamily:"Arial",resize:"vertical",outline:"none",lineHeight:1.8,marginBottom:"10px"}} lang="he" spellCheck={false} autoCorrect="off" placeholder={"שָׁלוֹם=평화\nתּוֹדָה=감사합니다"} defaultValue=""/>
              <button onClick={importFromBatchText} style={{...Bt.primary,width:"100%",padding:"12px"}}>단어 추가하기</button>
            </div>}
          </div>}

          {/* ══════ TAB: 퀴즈 (QUIZ) ══════ */}
          {activeTab==="quiz"&&<div style={{paddingTop:"16px"}}>
            {/* Quiz type cards */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px",marginBottom:"20px"}}>
              {[{key:"mcq",icon:"🎯",color:TA,title:T.mcqTitle,desc:uiLang==="en"?"4 choices":"객관식 4지선다",cnt:`${poolSize}${uiLang==="en"?" words":" 개"}`},{key:"essay",icon:"✍️",color:TP,title:T.essayTitle,desc:uiLang==="en"?"Type answers":"직접 입력",cnt:`${essayPoolSize}${uiLang==="en"?" words":" 개"}`},{key:"variant",icon:"📐",color:TG,title:T.variantQuizTitle,desc:uiLang==="en"?"Conjugations":"변형/활용",cnt:`${variantPoolSize}${uiLang==="en"?" forms":" 개"}`}].map(qt=>{
                return<button key={qt.key} onClick={()=>document.getElementById(`quiz-${qt.key}`)?.scrollIntoView({behavior:"smooth"})} style={{background:TS,border:`1px solid ${TL}`,borderRadius:"2px",padding:"14px 10px",cursor:"pointer",textAlign:"left",transition:"border-color 0.15s"}}>
                  <div style={{fontSize:"1.3rem",marginBottom:"6px"}}>{qt.icon}</div>
                  <div style={{fontSize:"0.75rem",fontWeight:700,color:qt.color,marginBottom:"2px",letterSpacing:"0.3px"}}>{qt.title}</div>
                  <div style={{fontSize:"0.6rem",color:TD,marginBottom:"4px"}}>{qt.desc}</div>
                  <div style={{fontSize:"0.62rem",color:qt.color,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:"1px"}}>{qt.cnt}</div>
                </button>;
              })}
            </div>

            {/* MCQ Settings */}
            <div id="quiz-mcq" style={{background:TS,borderRadius:"2px",border:`1px solid rgba(232,74,95,0.18)`,padding:"16px",marginBottom:"12px"}}>
              <div style={{fontSize:"0.6rem",color:TA,letterSpacing:"2px",textTransform:"uppercase",marginBottom:"14px",fontWeight:700}}>🎯 {T.mcqTitle}</div>
              <p style={SL}>{T.direction}</p>
              <div style={OR}>{[[QUIZ_TYPES.HEB_TO_MEAN,T.dirAtoB(bookInfo)],[QUIZ_TYPES.MEAN_TO_HEB,T.dirBtoA(bookInfo)],[QUIZ_TYPES.MIXED,T.mixed]].map(([v,l])=><button key={v} style={{...Bt.opt,...(quizType===v?Bt.optActive:{})}} onClick={()=>setQuizTypeSave(v)}>{l}</button>)}</div>
              <p style={SL}>{T.wordRange}</p>
              <div style={OR}>{[[QUIZ_FILTERS.ALL,T.allRange(words.length)],[QUIZ_FILTERS.LEARNING_ONLY,T.learningOnly(learningCount)],[QUIZ_FILTERS.EXCLUDE_MASTERED,T.excludeMastered(words.filter(w=>w.status!=="mastered").length)],[QUIZ_FILTERS.HARD_ONLY,T.hardOnly(hardCount)]].map(([v,l])=><button key={v} style={{...Bt.opt,...(quizFilter===v?Bt.optActive:{})}} onClick={()=>setQuizFilterSave(v)}>{l}</button>)}</div>
              <p style={SL}>{T.questionCount}</p>
              <div style={{display:"flex",gap:"5px",marginBottom:"10px",flexWrap:"wrap"}}>{countOptions.map(({label,value})=>{const d=value!==9999&&value>poolSize;return<button key={value} style={{...Bt.opt,...(quizCount===value?Bt.optActive:{}),...(d?{opacity:0.22,cursor:"not-allowed"}:{})}} onClick={()=>!d&&setQuizCountSave(value)} disabled={d}>{label}</button>;})}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"9px",marginBottom:"14px",padding:"9px 12px",background:"rgba(255,255,255,0.02)",borderRadius:"2px",border:`1px solid ${TL}`}}>
                <input type="range" min={1} max={Math.max(4,poolSize)} value={Math.min(quizCount===9999?poolSize:quizCount,poolSize)} onChange={e=>setQuizCountSave(Number(e.target.value))} style={{flex:1,accentColor:TA,cursor:"pointer"}}/>
                <input type="number" min={1} max={poolSize} value={quizCount===9999?poolSize:Math.min(quizCount,poolSize)} onChange={e=>{const v=Math.max(1,Math.min(poolSize,Number(e.target.value)||1));setQuizCountSave(v);}} style={{width:"46px",padding:"3px 5px",background:"rgba(255,255,255,0.04)",border:`1px solid rgba(232,74,95,0.3)`,borderRadius:"2px",color:TA,fontSize:"0.85rem",fontWeight:700,textAlign:"center",outline:"none"}}/>
              </div>
              <p style={SL}>{uiLang==="en"?"Sound":"발음"}</p>
              <div style={{display:"flex",gap:"5px",marginBottom:"14px"}}>
                {[{m:"auto",ic:"▶",l:uiLang==="en"?"Auto":"자동",c:TA},{m:"manual",ic:"▷",l:uiLang==="en"?"Manual":"수동",c:TG},{m:"mute",ic:"○",l:uiLang==="en"?"Mute":"음소거",c:TD}].map(({m,ic,l,c})=><button key={m} onClick={()=>setSoundMode(m)} style={{flex:1,padding:"9px 5px",borderRadius:"2px",border:`1px solid ${soundMode===m?`${c}50`:TL}`,background:soundMode===m?`${c}0D`:"transparent",color:soundMode===m?c:TD,cursor:"pointer",textAlign:"center"}}><div style={{fontSize:"0.95rem",marginBottom:"2px"}}>{ic}</div><div style={{fontSize:"0.68rem",fontWeight:soundMode===m?600:400}}>{l}</div></button>)}
              </div>
              <button style={{...Bt.primary,width:"100%",padding:"13px",...(poolSize<4?{opacity:0.22,cursor:"not-allowed"}:{})}} onClick={startQuiz} disabled={poolSize<4}>{poolSize<4?T.needMore(poolSize):T.startMCQ(quizCount===9999?poolSize:Math.min(quizCount,poolSize))}</button>
            </div>

            {/* Essay Settings */}
            <div id="quiz-essay" style={{background:TS,borderRadius:"2px",border:`1px solid rgba(167,139,250,0.18)`,padding:"16px",marginBottom:"12px"}}>
              <div style={{fontSize:"0.6rem",color:TP,letterSpacing:"2px",textTransform:"uppercase",marginBottom:"8px",fontWeight:700}}>✍️ {T.essayTitle}</div>
              <p style={{fontSize:"0.75rem",color:TD,marginBottom:"12px"}}>{T.essaySub}</p>
              <p style={SL}>{T.direction}</p>
              <div style={OR}>{[["heb_to_mean",T.dirAtoB(bookInfo)],["mean_to_heb",T.dirBtoA(bookInfo)],["mixed",T.mixed]].map(([v,l])=><button key={v} style={{...Bt.opt,...(essayType===v?Bt.essayOptActive:{})}} onClick={()=>setEssayTypeSave(v)}>{l}</button>)}</div>
              <p style={SL}>{T.wordRange}</p>
              <div style={OR}>{[[QUIZ_FILTERS.ALL,T.allRange(words.length)],[QUIZ_FILTERS.EXCLUDE_MASTERED,T.excludeMastered(words.filter(w=>w.status!=="mastered").length)],[QUIZ_FILTERS.HARD_ONLY,T.hardOnly(hardCount)]].map(([v,l])=><button key={v} style={{...Bt.opt,...(essayFilter===v?Bt.essayOptActive:{})}} onClick={()=>setEssayFilterSave(v)}>{l}</button>)}</div>
              <div style={{display:"flex",alignItems:"center",gap:"9px",marginBottom:"14px",padding:"9px 12px",background:"rgba(255,255,255,0.02)",borderRadius:"2px",border:`1px solid ${TL}`}}>
                <input type="range" min={1} max={Math.max(1,essayPoolSize)} value={Math.min(essayCount===9999?essayPoolSize:essayCount,essayPoolSize)} onChange={e=>setEssayCountSave(Number(e.target.value))} style={{flex:1,accentColor:TP,cursor:"pointer"}}/>
                <input type="number" min={1} max={essayPoolSize} value={essayCount===9999?essayPoolSize:Math.min(essayCount,essayPoolSize)} onChange={e=>{const v=Math.max(1,Math.min(essayPoolSize,Number(e.target.value)||1));setEssayCountSave(v);}} style={{width:"46px",padding:"3px 5px",background:"rgba(255,255,255,0.04)",border:`1px solid rgba(167,139,250,0.3)`,borderRadius:"2px",color:TP,fontSize:"0.85rem",fontWeight:700,textAlign:"center",outline:"none"}}/>
              </div>
              <button style={{...Bt.essay,width:"100%",padding:"13px",...(!essayPoolSize?{opacity:0.22,cursor:"not-allowed"}:{})}} onClick={startEssay} disabled={!essayPoolSize}>{T.startEssay(essayCount===9999?essayPoolSize:Math.min(essayCount,essayPoolSize))}</button>
            </div>

            {/* Variant Quiz Settings */}
            {currentBook==="hebrew"&&<div id="quiz-variant" style={{background:TS,borderRadius:"2px",border:`1px solid rgba(80,200,152,0.18)`,padding:"16px",marginBottom:"12px"}}>
              <div style={{fontSize:"0.6rem",color:TG,letterSpacing:"2px",textTransform:"uppercase",marginBottom:"14px",fontWeight:700}}>📐 {T.variantQuizTitle}</div>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"6px"}}><p style={{...SL,margin:0}}>{T.variantTypeSelect}</p><button onClick={()=>setVariantCatsSave(variantCats.length===VARIANT_CATS.length?[]:VARIANT_CATS.map(c=>c.id))} style={{...Bt.ghost,fontSize:"0.62rem",padding:"2px 7px"}}>{variantCats.length===VARIANT_CATS.length?T.allDeselect:T.allSelectAll}</button></div>
              <div style={{display:"flex",gap:"4px",marginBottom:"12px",flexWrap:"wrap"}}>{VARIANT_CATS.map(cat=><button key={cat.id} style={{...Bt.opt,...(variantCats.includes(cat.id)?{background:"rgba(80,200,152,0.1)",borderColor:"rgba(80,200,152,0.4)",color:TG}:{})}} onClick={()=>setVariantCatsSave(v=>v.includes(cat.id)?v.filter(x=>x!==cat.id):[...v,cat.id])}>{cat.label[uiLang]||cat.label.ko}</button>)}</div>
              {(()=>{const st=new Set(VARIANT_CATS.filter(c=>variantCats.includes(c.id)).flatMap(c=>c.types));const hv=w=>(w.variants||[]).some(v=>st.has(v.type));const vA=words.filter(hv).length,vL=words.filter(w=>w.status==="learning"&&hv(w)).length,vH=words.filter(w=>w.status==="hard"&&hv(w)).length,vE=words.filter(w=>w.status!=="mastered"&&hv(w)).length;return<div style={OR}>{[[QUIZ_FILTERS.ALL,`전체(${vA})`],[QUIZ_FILTERS.LEARNING_ONLY,`학습중(${vL})`],[QUIZ_FILTERS.HARD_ONLY,`어려움(${vH})`],[QUIZ_FILTERS.EXCLUDE_MASTERED,`암기제외(${vE})`]].map(([v,l])=><button key={v} style={{...Bt.opt,...(variantFilter===v?{background:"rgba(80,200,152,0.1)",borderColor:"rgba(80,200,152,0.4)",color:TG}:{})}} onClick={()=>setVariantFilterSave(v)}>{l}</button>)}</div>;})()}
              <div style={{display:"flex",gap:"5px",marginBottom:"10px"}}>{[["essay","서술형"],["mcq","객관식"]].map(([t,l])=><button key={t} onClick={()=>setVariantQuizType(t)} style={{...Bt.opt,flex:1,...(variantQuizType===t?{background:"rgba(80,200,152,0.1)",borderColor:"rgba(80,200,152,0.4)",color:TG}:{})}}>{l}</button>)}</div>
              <div style={{display:"flex",alignItems:"center",gap:"9px",marginBottom:"12px",padding:"9px 12px",background:"rgba(255,255,255,0.02)",borderRadius:"2px",border:`1px solid ${TL}`}}>
                <input type="range" min={1} max={Math.max(1,variantPoolSize)} value={Math.min(variantCount===9999?variantPoolSize:variantCount,Math.max(1,variantPoolSize))} onChange={e=>setVariantCount(Number(e.target.value))} style={{flex:1,accentColor:TG,cursor:"pointer"}}/>
                <input type="number" min={1} max={variantPoolSize} value={variantCount===9999?variantPoolSize:Math.min(variantCount,variantPoolSize)} onChange={e=>{const v=Math.max(1,Math.min(variantPoolSize,Number(e.target.value)||1));setVariantCount(v);}} style={{width:"46px",padding:"3px 5px",background:"rgba(255,255,255,0.04)",border:`1px solid rgba(80,200,152,0.3)`,borderRadius:"2px",color:TG,fontSize:"0.85rem",fontWeight:700,textAlign:"center",outline:"none"}}/>
              </div>
              <button style={{...Bt.green,width:"100%",padding:"13px",...(!variantPoolSize||!variantCats.length?{opacity:0.22,cursor:"not-allowed"}:{})}} onClick={startVariantQuiz} disabled={!variantPoolSize||!variantCats.length}>변형 퀴즈 시작 ({variantCount===9999?variantPoolSize:Math.min(variantCount,variantPoolSize)}문제)</button>
            </div>}
          </div>}

          {/* ══════ TAB: 단어장(WALLETS) ══════ */}
          {activeTab==="wallets"&&<div style={{paddingTop:"16px"}}>
            {walletDetailId!==null?(()=>{
              const wl=wallets.find(w=>w.id===walletDetailId);if(!wl)return null;
              const wlWords=getWalletWords(walletDetailId);
              return<div>
                <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"14px"}}>
                  <button onClick={()=>setWalletDetailId(null)} style={{...Bt.ghost,padding:"5px 10px",fontSize:"0.75rem"}}>← 목록</button>
                  <div style={{width:"8px",height:"8px",borderRadius:"2px",background:wl.color,flexShrink:0}}/>
                  <span style={{fontWeight:700,color:wl.color,fontSize:"0.95rem"}}>{wl.name}</span>
                  <span style={{fontSize:"0.7rem",color:TD}}>{wlWords.length}개 단어</span>
                </div>
                {wlWords.length>0?<><div style={{marginBottom:"10px"}}>{wlWords.map(w=><div key={w.id} style={{display:"flex",alignItems:"center",gap:"8px",padding:"8px 0",borderBottom:`1px solid ${TL}`}}><span style={{fontFamily:"Arial",direction:"rtl",color:TH,fontSize:"1rem",minWidth:"70px"}}>{w.hebrew}</span><span style={{color:TM,fontSize:"0.78rem",flex:1}}>{w.meaning}</span><SpeakBtn text={w.hebrew} onSpeak={speakOnDemand} muted={muted}/><button onClick={()=>toggleWordInWallet(wl.id,w.id)} style={{padding:"2px 7px",borderRadius:"2px",background:"rgba(232,74,95,0.07)",border:"1px solid rgba(232,74,95,0.2)",color:TA,cursor:"pointer",fontSize:"0.68rem"}}>제거</button></div>)}</div>
                <div style={{display:"flex",gap:"6px"}}><button onClick={()=>{if(wlWords.length<4){showToast("객관식은 4개 이상 필요해요","err");return;}const qs=wlWords.map(w=>generateQuestion(w,wlWords.length>=4?wlWords:words,quizType));setQuestions(qs);setCurrent(0);setSelected(null);setConfirmed(false);setScore(0);setWrongWords([]);setMode(MODES.QUIZ);setAnimKey(k=>k+1);}} style={{flex:1,...Bt.primary,fontSize:"0.8rem",padding:"10px"}}>MCQ</button><button onClick={()=>{const qs=wlWords.map(w=>({wordId:w.id,question:w.hebrew,answer:w.meaning,hebrewWord:w.hebrew,questionType:"heb_to_mean"}));setEssayQuestions(qs);setEssayCurrent(0);setEssayInput("");setEssayConfirmed(false);setEssayResults([]);setMode(MODES.ESSAY);setAnimKey(k=>k+1);}} style={{flex:1,...Bt.essay,fontSize:"0.8rem",padding:"10px"}}>서술형</button></div></>:<div style={{textAlign:"center",color:TD,padding:"40px 0",fontSize:"0.82rem"}}>단어가 없어요. 단어 목록에서 📚 버튼을 눌러 추가하세요.</div>}
              </div>;
            })():(<>
              {/* Create wallet */}
              <div style={{background:TS,border:`1px solid ${TL}`,borderRadius:"2px",padding:"14px",marginBottom:"14px"}}>
                <div style={{fontSize:"0.6rem",color:TM,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"10px",fontWeight:700}}>새 단어장 만들기</div>
                <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
                  <input value={walletName} onChange={e=>setWalletName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createWallet()} style={{...Bt.input,flex:1}} placeholder="단어장 이름..."/>
                  <div style={{display:"flex",gap:"3px"}}>{[TA,TG,TP,TBL,TH,"#F59E0B"].map(c=><button key={c} onClick={()=>setWalletColor(c)} style={{width:"18px",height:"18px",borderRadius:"2px",background:c,border:walletColor===c?"2px solid #fff":"2px solid transparent",cursor:"pointer",flexShrink:0}}/>)}</div>
                  <button onClick={createWallet} disabled={!walletName.trim()} style={{...Bt.primary,padding:"9px 14px",opacity:walletName.trim()?1:0.4,fontSize:"0.78rem"}}>만들기</button>
                </div>
              </div>
              {/* Wallet list */}
              {wallets.length===0?<div style={{textAlign:"center",color:TD,padding:"40px 0",fontSize:"0.82rem"}}>아직 단어장이 없어요.<br/>위에서 새 단어장을 만들어보세요!</div>:<div>{wallets.map(wl=>{const cnt=words.filter(w=>wl.wordIds.includes(w.id)).length;return<div key={wl.id} style={{display:"flex",alignItems:"center",gap:"10px",padding:"12px 0",borderBottom:`1px solid ${TL}`}}><div style={{width:"10px",height:"10px",borderRadius:"2px",background:wl.color,flexShrink:0}}/><button onClick={()=>setWalletDetailId(wl.id)} style={{flex:1,background:"none",border:"none",color:TT,cursor:"pointer",textAlign:"left",fontSize:"0.9rem",fontWeight:500}}>{wl.name}</button><span style={{fontSize:"0.7rem",color:TD,minWidth:"30px",textAlign:"right"}}>{cnt}개</span><button onClick={()=>{if(window.confirm(`"${wl.name}"을 삭제할까요?`))deleteWallet(wl.id);}} style={{padding:"4px 9px",borderRadius:"2px",background:"rgba(232,74,95,0.07)",border:"1px solid rgba(232,74,95,0.2)",color:TA,cursor:"pointer",fontSize:"0.7rem"}}>삭제</button></div>;})}</div>}
            </>)}
          </div>}

          {/* ══════ TAB: 설정 (SETTINGS) ══════ */}
          {activeTab==="settings"&&<div style={{paddingTop:"16px",display:"flex",flexDirection:"column",gap:"10px"}}>
            {/* Account */}
            <div style={{background:TS,border:`1px solid ${TL}`,borderRadius:"2px",padding:"16px"}}>
              <div style={{fontSize:"0.6rem",color:TM,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"12px",fontWeight:700}}>{uiLang==="en"?"Account":"계정"}</div>
              {user?<div><div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"12px"}}><img src={user.photoURL} alt="" style={{width:"36px",height:"36px",borderRadius:"2px"}}/><div><div style={{fontWeight:600,fontSize:"0.9rem"}}>{user.displayName}</div><div style={{fontSize:"0.7rem",color:TD}}>{user.email} {syncing&&"· 동기화 중..."}</div></div></div><div style={{fontSize:"0.72rem",color:TG,marginBottom:"10px"}}>● 모든 기기 자동 동기화 활성화</div><button onClick={signOutUser} style={{...Bt.ghost,width:"100%",color:TA,borderColor:"rgba(232,74,95,0.28)"}}>{T.logout}</button></div>:<div><p style={{fontSize:"0.82rem",color:TM,marginBottom:"12px",lineHeight:1.5}}>Google 계정으로 로그인하면 모든 기기에서 단어장을 자동으로 동기화해요.</p><button onClick={signInGoogle} style={{...Bt.primary,width:"100%",padding:"12px",fontSize:"0.88rem"}}>{T.login}</button></div>}
            </div>
            {/* Language */}
            <div style={{background:TS,border:`1px solid ${TL}`,borderRadius:"2px",padding:"16px"}}>
              <div style={{fontSize:"0.6rem",color:TM,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"12px",fontWeight:700}}>{uiLang==="en"?"Language":"언어"}</div>
              <div style={{display:"flex",gap:"6px"}}>{[["ko","한국어 🇰🇷"],["en","English 🇺🇸"]].map(([v,l])=><button key={v} onClick={()=>{setUiLang(v);try{localStorage.setItem("uiLang",v);}catch{}}} style={{flex:1,padding:"10px",borderRadius:"2px",border:`1px solid ${uiLang===v?TA:TL}`,background:uiLang===v?"rgba(232,74,95,0.1)":"transparent",color:uiLang===v?TA:TM,cursor:"pointer",fontSize:"0.82rem",fontWeight:uiLang===v?700:400}}>{l}</button>)}</div>
            </div>
            {/* Card style */}
            <div style={{background:TS,border:`1px solid ${TL}`,borderRadius:"2px",padding:"16px"}}>
              <div style={{fontSize:"0.6rem",color:TM,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"12px",fontWeight:700}}>{T.cardStyle}</div>
              <div style={{display:"flex",gap:"6px"}}>{[["menu",T.menuStyle,"···"],["inline",T.inlineStyle,"—"]].map(([v,l,icon])=><button key={v} onClick={()=>setCardStyleSave(v)} style={{flex:1,padding:"10px",borderRadius:"2px",border:`1px solid ${cardStyle===v?TA:TL}`,background:cardStyle===v?"rgba(232,74,95,0.1)":"transparent",color:cardStyle===v?TA:TM,cursor:"pointer",fontSize:"0.8rem",fontWeight:cardStyle===v?700:400}}><span style={{fontSize:"1rem",display:"block",marginBottom:"3px"}}>{icon}</span>{l}</button>)}</div>
            </div>
            {/* Sound */}
            <div style={{background:TS,border:`1px solid ${TL}`,borderRadius:"2px",padding:"16px"}}>
              <div style={{fontSize:"0.6rem",color:TM,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"6px",fontWeight:700}}>{T.soundSetting}</div>
              <div style={{fontSize:"0.7rem",color:TD,marginBottom:"10px"}}>{ttsReady?"● Google TTS 연결됨":"○ 브라우저 TTS 사용 중 (Google API 키 없음)"}</div>
              <div style={{display:"flex",gap:"6px"}}>{[{m:"auto",ic:"▶",l:T.soundAuto,c:TA},{m:"manual",ic:"▷",l:T.soundManual,c:TG},{m:"mute",ic:"○",l:T.soundMute,c:TD}].map(({m,ic,l,c})=><button key={m} onClick={()=>setSoundMode(m)} style={{flex:1,padding:"10px 5px",borderRadius:"2px",border:`1px solid ${soundMode===m?`${c}50`:TL}`,background:soundMode===m?`${c}0D`:"transparent",color:soundMode===m?c:TD,cursor:"pointer",textAlign:"center"}}><div style={{fontSize:"0.95rem",marginBottom:"2px"}}>{ic}</div><div style={{fontSize:"0.7rem",fontWeight:soundMode===m?600:400}}>{l}</div></button>)}</div>
            </div>
            {/* Save/Load */}
            <div style={{background:TS,border:`1px solid ${TL}`,borderRadius:"2px",padding:"16px"}}>
              <div style={{fontSize:"0.6rem",color:TM,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"12px",fontWeight:700}}>{T.saveLoad}</div>
              <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                {[[T.fileSave,exportWords,TA],[T.copy,copyToClipboard,TM],[T.fileOpen,()=>fileInputRef.current.click(),TM],[T.paste,()=>setShowPasteModal(true),TBL]].map(([label,handler,color])=><button key={label} onClick={handler} style={{padding:"8px 12px",borderRadius:"2px",background:"rgba(255,255,255,0.03)",border:`1px solid ${TL}`,color,cursor:"pointer",fontSize:"0.75rem"}}>{label}</button>)}
                <input ref={fileInputRef} type="file" accept=".json" style={{display:"none"}} onChange={handleFileChange}/>
              </div>
            </div>
          </div>}

        </div>} {/* end !isQuizActive */}

        {/* ── BOTTOM TAB BAR ────────────────────────────────── */}
        {!isQuizActive&&<nav style={{position:"fixed",bottom:0,left:0,right:0,background:TB,borderTop:`1px solid ${TL}`,display:"flex",zIndex:200,backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)"}}>
          {[
            {id:"list",   icon:"📚", label:T.tabList,     badge:null},
            {id:"add",    icon:"➕", label:T.tabAdd,      badge:null},
            {id:"quiz",   icon:"🎯", label:T.tabQuiz,     badge:null},
            {id:"wallets",icon:"🗂️", label:T.tabWallets,  badge:wallets.length||null},
            {id:"settings",icon:"⚙️",label:T.tabSettings, badge:user?"●":null},
          ].map(tab=><button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{flex:1,padding:"10px 4px 8px",border:"none",background:"transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:"3px",position:"relative"}}>
            {tab.badge&&<span style={{position:"absolute",top:"7px",right:"calc(50% - 14px)",width:"14px",height:"14px",borderRadius:"50%",background:tab.id==="settings"?TG:TA,fontSize:"0.52rem",fontWeight:700,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>{typeof tab.badge==="number"?tab.badge:""}</span>}
            <span style={{fontSize:"1.2rem",lineHeight:1}}>{tab.icon}</span>
            <span style={{fontSize:"0.58rem",color:activeTab===tab.id?TA:TD,fontWeight:activeTab===tab.id?700:400,letterSpacing:"0.3px",transition:"color 0.15s"}}>{tab.label}</span>
            {activeTab===tab.id&&<span style={{position:"absolute",bottom:0,left:"20%",right:"20%",height:"2px",background:TA,borderRadius:"1px 1px 0 0"}}/>}
          </button>)}
        </nav>}

      </div> {/* end main container */}
    </div>
  );
}
