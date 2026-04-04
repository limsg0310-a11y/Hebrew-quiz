import { useState, useRef, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { S, pillBtn, smallPillBtn, STATUS_CONFIG } from "./HebrewStyles";

const FB = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};
const fbApp = initializeApp(FB);
const fbAuth = getAuth(fbApp);
const fbDb = getFirestore(fbApp);

let XLSX_LIB = null;
async function getXLSX() {
  if (XLSX_LIB) return XLSX_LIB;
  return new Promise(resolve => {
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
const QT = { HEB_TO_MEAN:"heb_to_mean", MEAN_TO_HEB:"mean_to_heb", MIXED:"mixed" };
const QF = { ALL:"all", LEARNING_ONLY:"learning_only", EXCLUDE_MASTERED:"exclude_mastered", HARD_ONLY:"hard_only" };

const BOOKS = [
  { id:"hebrew",  label:{ko:"히브리어",en:"Hebrew"},  emoji:"🇮🇱", color:"#c4a050", ttsLang:"he-IL", ttsName:"he-IL-Neural2-A", ttsRate:0.9, termA:{ko:"히브리어",en:"Word"}, termB:{ko:"뜻",en:"Meaning"}, pA:{ko:"עברית",en:"Hebrew word"}, pB:{ko:"뜻 (한국어/영어)",en:"Meaning"}, dir:"rtl" },
  { id:"english", label:{ko:"영어",en:"English"}, emoji:"🇺🇸", color:"#60a0e0", ttsLang:"en-US", ttsName:"en-US-Standard-C", ttsRate:0.9, termA:{ko:"영어 단어",en:"English word"}, termB:{ko:"뜻 (한국어)",en:"Korean meaning"}, pA:{ko:"English word",en:"English word"}, pB:{ko:"뜻 (한국어)",en:"Korean meaning"}, dir:"ltr" },
  { id:"korean",  label:{ko:"한국어",en:"Korean"}, emoji:"🇰🇷", color:"#e06080", ttsLang:"ko-KR", ttsName:"ko-KR-Standard-A", ttsRate:0.9, termA:{ko:"한국어 단어",en:"Korean word"}, termB:{ko:"뜻 (영어)",en:"English meaning"}, pA:{ko:"한국어 단어",en:"Korean word"}, pB:{ko:"뜻 (영어)",en:"English meaning"}, dir:"ltr" },
];

const VARIANT_CATS = [
  { id:"gender",    label:{ko:"성별 변형",en:"Gender"},      color:"#e06080", types:["gender_f","gender_m"] },
  { id:"plural",    label:{ko:"단수/복수",en:"Plural"},      color:"#60a0e0", types:["plural_m","plural_f"] },
  { id:"infinitive",label:{ko:"to부정사",en:"Infinitive"},   color:"#50c898", types:["infinitive"] },
  { id:"present",   label:{ko:"현재형",en:"Present"},        color:"#60c880", types:["pres_ms","pres_fs","pres_mp","pres_fp"] },
  { id:"past",      label:{ko:"과거형",en:"Past"},           color:"#c4a050", types:["past_1s","past_2ms","past_2fs","past_3ms","past_3fs","past_1p","past_2mp","past_2fp","past_3mp","past_3fp"] },
  { id:"future",    label:{ko:"미래형",en:"Future"},         color:"#60a0e0", types:["fut_1s","fut_2ms","fut_2fs","fut_3ms","fut_3fs","fut_1p","fut_2mp","fut_2fp","fut_3mp","fut_3fp"] },
  { id:"imperative",label:{ko:"명령형",en:"Imperative"},     color:"#f07050", types:["imp_2ms","imp_2fs","imp_2mp","imp_2fp"] },
  { id:"poss",      label:{ko:"소유격",en:"Possessive"},     color:"#9060f0", types:["poss_1s","poss_2ms","poss_2fs","poss_3ms","poss_3fs","poss_1p","poss_2mp","poss_2fp","poss_3mp","poss_3fp"] },
];

const VARIANT_TYPES = [
  {id:"gender_f",  label:{ko:"여성형 단수 (היא)",en:"Feminine sg."}},
  {id:"gender_m",  label:{ko:"남성형 단수 (הוא)",en:"Masculine sg."}},
  {id:"plural_m",  label:{ko:"남성형 복수 (הם)",en:"Masculine pl."}},
  {id:"plural_f",  label:{ko:"여성형 복수 (הן)",en:"Feminine pl."}},
  {id:"past_1s",   label:{ko:"과거 — 나 (אני)",en:"Past — I"}},
  {id:"past_2ms",  label:{ko:"과거 — 너, 남성 (אתה)",en:"Past — You M"}},
  {id:"past_2fs",  label:{ko:"과거 — 너, 여성 (את)",en:"Past — You F"}},
  {id:"past_3ms",  label:{ko:"과거 — 그 (הוא)",en:"Past — He"}},
  {id:"past_3fs",  label:{ko:"과거 — 그녀 (היא)",en:"Past — She"}},
  {id:"past_1p",   label:{ko:"과거 — 우리 (אנחנו)",en:"Past — We"}},
  {id:"past_2mp",  label:{ko:"과거 — 너희, 남성 (אתם)",en:"Past — You pl.M"}},
  {id:"past_2fp",  label:{ko:"과거 — 너희, 여성 (אתן)",en:"Past — You pl.F"}},
  {id:"past_3mp",  label:{ko:"과거 — 그들, 남성 (הם)",en:"Past — They M"}},
  {id:"past_3fp",  label:{ko:"과거 — 그들, 여성 (הן)",en:"Past — They F"}},
  {id:"pres_ms",   label:{ko:"현재 — 남성 단수",en:"Present — M sg."}},
  {id:"pres_fs",   label:{ko:"현재 — 여성 단수",en:"Present — F sg."}},
  {id:"pres_mp",   label:{ko:"현재 — 남성 복수",en:"Present — M pl."}},
  {id:"pres_fp",   label:{ko:"현재 — 여성 복수",en:"Present — F pl."}},
  {id:"fut_1s",    label:{ko:"미래 — 나 (אני)",en:"Future — I"}},
  {id:"fut_2ms",   label:{ko:"미래 — 너, 남성 (אתה)",en:"Future — You M"}},
  {id:"fut_2fs",   label:{ko:"미래 — 너, 여성 (את)",en:"Future — You F"}},
  {id:"fut_3ms",   label:{ko:"미래 — 그 (הוא)",en:"Future — He"}},
  {id:"fut_3fs",   label:{ko:"미래 — 그녀 (היא)",en:"Future — She"}},
  {id:"fut_1p",    label:{ko:"미래 — 우리 (אנחנו)",en:"Future — We"}},
  {id:"fut_2mp",   label:{ko:"미래 — 너희, 남성 (אתם)",en:"Future — You pl.M"}},
  {id:"fut_2fp",   label:{ko:"미래 — 너희, 여성 (אתן)",en:"Future — You pl.F"}},
  {id:"fut_3mp",   label:{ko:"미래 — 그들, 남성 (הם)",en:"Future — They M"}},
  {id:"fut_3fp",   label:{ko:"미래 — 그들, 여성 (הן)",en:"Future — They F"}},
  {id:"imp_2ms",   label:{ko:"명령 — 너, 남성 (אתה)",en:"Imperative — You M"}},
  {id:"imp_2fs",   label:{ko:"명령 — 너, 여성 (את)",en:"Imperative — You F"}},
  {id:"imp_2mp",   label:{ko:"명령 — 너희, 남성 (אתם)",en:"Imperative — You pl.M"}},
  {id:"imp_2fp",   label:{ko:"명령 — 너희, 여성 (אתן)",en:"Imperative — You pl.F"}},
  {id:"poss_1s",   label:{ko:"소유격 — 나의 (שלי)",en:"Poss. — My"}},
  {id:"poss_2ms",  label:{ko:"소유격 — 너의, 남성 (שלך)",en:"Poss. — Your M"}},
  {id:"poss_2fs",  label:{ko:"소유격 — 너의, 여성 (שלך)",en:"Poss. — Your F"}},
  {id:"poss_3ms",  label:{ko:"소유격 — 그의 (שלו)",en:"Poss. — His"}},
  {id:"poss_3fs",  label:{ko:"소유격 — 그녀의 (שלה)",en:"Poss. — Her"}},
  {id:"poss_3fp",  label:{ko:"소유격 — 그들의, 여성 (שלהן)",en:"Poss. — Their F"}},
  {id:"poss_1p",   label:{ko:"소유격 — 우리의 (שלנו)",en:"Poss. — Our"}},
  {id:"poss_2mp",  label:{ko:"소유격 — 너희의, 남성 (שלכם)",en:"Poss. — Your pl.M"}},
  {id:"poss_2fp",  label:{ko:"소유격 — 너희의, 여성 (שלכן)",en:"Poss. — Your pl.F"}},
  {id:"poss_3mp",  label:{ko:"소유격 — 그들의, 남성 (שלהם)",en:"Poss. — Their M"}},
  {id:"infinitive",label:{ko:"to부정사 — 원형 (ל...)",en:"Infinitive (ל...)"}},
];

const WORD_TYPES = [
  {id:"verb",    label:{ko:"동사",en:"Verb"},      emoji:"🔵", cats:["infinitive","past","present","future","imperative"]},
  {id:"noun",    label:{ko:"명사",en:"Noun"},      emoji:"🟡", cats:["gender","plural","poss"]},
  {id:"adj",     label:{ko:"형용사",en:"Adjective"},emoji:"🟠", cats:["gender","plural"]},
  {id:"pronoun", label:{ko:"대명사",en:"Pronoun"},  emoji:"🟣", cats:["gender","plural"]},
  {id:"other",   label:{ko:"기타",en:"Other"},      emoji:"⚪", cats:["gender","plural","poss"]},
];

const VARIANT_PASTE_ORDER = ["gender_f","gender_m","plural_m","plural_f","past_1s","past_2ms","past_2fs","past_3ms","past_3fs","past_1p","past_2mp","past_2fp","past_3mp","past_3fp","pres_ms","pres_fs","pres_mp","pres_fp","fut_1s","fut_2ms","fut_2fs","fut_3ms","fut_3fs","fut_1p","fut_2mp","fut_2fp","fut_3mp","fut_3fp","imp_2ms","imp_2fs","imp_2mp","imp_2fp","poss_1s","poss_2ms","poss_2fs","poss_3ms","poss_3fs","poss_1p","poss_2mp","poss_2fp","poss_3mp","poss_3fp","infinitive"];

function getAllowedCats(wordType) {
  if (!wordType) return VARIANT_CATS;
  const wt = WORD_TYPES.find(t=>t.id===wordType);
  return wt ? VARIANT_CATS.filter(c=>wt.cats.includes(c.id)) : VARIANT_CATS;
}
function getAllowedPasteOrder(wordType) {
  const allowed = new Set(getAllowedCats(wordType).flatMap(c=>c.types));
  return VARIANT_PASTE_ORDER.filter(t=>allowed.has(t));
}

const LS_KEY = "hebrew_quiz_words";
function getLSKey(book) { return book&&book!=="hebrew"?`hebrew_quiz_words_${book}`:LS_KEY; }
function loadWords(book) {
  try { const s=localStorage.getItem(getLSKey(book)); if(s) return JSON.parse(s); if(!book||book==="hebrew"){const l=localStorage.getItem(LS_KEY);if(l) return JSON.parse(l);} } catch {}
  return book&&book!=="hebrew"?[]:DEFAULT_WORDS;
}
function saveWords(words, book) { try { localStorage.setItem(getLSKey(book), JSON.stringify(words)); } catch {} }
function stripNikkud(t) { return t.replace(/[\u0591-\u05C7]/g,""); }
function shuffle(arr) { return [...arr].sort(()=>Math.random()-0.5); }

function checkEssayAnswer(user, correct) {
  const n=s=>s.trim().toLowerCase().replace(/[\/\-,\.·]/g," ").replace(/\s+/g," ").trim();
  const u=n(user),c=n(correct);
  if(u===c) return "exact";
  const cW=c.split(" ").filter(w=>w.length>1),uW=u.split(" ").filter(w=>w.length>1);
  if(cW.filter(w=>uW.some(uw=>uw.includes(w)||w.includes(uw))).length>=Math.ceil(cW.length*0.6)) return "partial";
  return "wrong";
}

function generateQuestion(word, allWords, type) {
  let t = type===QT.MIXED?(word.meaning&&Math.random()>0.5?QT.MEAN_TO_HEB:QT.HEB_TO_MEAN):type;
  if(t===QT.MEAN_TO_HEB&&!word.meaning) t=QT.HEB_TO_MEAN;
  const question=t===QT.HEB_TO_MEAN?word.hebrew:word.meaning, answer=t===QT.HEB_TO_MEAN?word.meaning:word.hebrew;
  const pool=allWords.filter(w=>w.id!==word.id&&(t===QT.HEB_TO_MEAN?!!w.meaning:!!w.hebrew));
  const seen=new Set([answer]),dist=[];
  for(const w of shuffle(pool)){const v=t===QT.HEB_TO_MEAN?w.meaning:w.hebrew;if(!seen.has(v)){seen.add(v);dist.push(v);}if(dist.length>=3)break;}
  while(dist.length<3) dist.push("—");
  return {question,answer,choices:shuffle([answer,...dist]),questionType:t,wordId:word.id};
}

let _currentAudio=null;
async function googleTTS(text,apiKey,lang="he-IL",name="he-IL-Wavenet-A",rate=0.9) {
  const names=lang.startsWith("he")?["he-IL-Neural2-A","he-IL-Wavenet-A","he-IL-Standard-A"]:[name];
  for(const n of names){
    try{
      const res=await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({input:{text},voice:{languageCode:lang,name},audioConfig:{audioEncoding:"MP3",speakingRate:rate,pitch:0}})});
      if(!res.ok) continue;
      const d=await res.json(); if(d.audioContent){const a=new Audio(`data:audio/mp3;base64,${d.audioContent}`);_currentAudio=a;a.play();return;}
    }catch{}
  }
  throw new Error("TTS error");
}
function browserTTS(text,lang="he-IL",rate=0.9){
  if(!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(lang.startsWith("he")?stripNikkud(text):text);u.lang=lang;u.rate=rate;window.speechSynthesis.speak(u);
}

function SpeakBtn({text,onSpeak,muted=false,size="md"}){
  const [p,setP]=useState(false);
  const go=async e=>{e.stopPropagation();if(muted)return;setP(true);try{await onSpeak(text);}catch{}setTimeout(()=>setP(false),1200);};
  return<button onClick={go} style={{background:p?"rgba(196,160,80,0.25)":"rgba(196,160,80,0.1)",border:"1px solid rgba(196,160,80,0.35)",borderRadius:"10px",cursor:muted?"default":"pointer",padding:size==="lg"?"10px 16px":"6px 10px",fontSize:size==="lg"?"1.2rem":"0.95rem",lineHeight:1,flexShrink:0,opacity:muted?0.4:1}}>{muted?"🔇":p?"🔊":"🔈"}</button>;
}

function SpeakOnceBtn({text,onSpeak,muted=false,repeatN=1}){
  const [p,setP]=useState(false),[cnt,setCnt]=useState(0);const ref=useRef(false);
  const stop=()=>{ref.current=true;window.speechSynthesis?.cancel();if(_currentAudio){_currentAudio.pause();_currentAudio=null;}setP(false);setCnt(0);};
  const go=async e=>{
    e.stopPropagation();if(muted)return;if(p){stop();return;}
    ref.current=false;setP(true);
    for(let i=0;i<repeatN;i++){if(ref.current)break;setCnt(i+1);try{await onSpeak(text);}catch{}if(i<repeatN-1)await new Promise(r=>setTimeout(r,1400));}
    setP(false);setCnt(0);
  };
  return<button onClick={go} style={{background:p?"rgba(200,60,60,0.2)":"rgba(196,160,80,0.1)",border:p?"1px solid rgba(200,60,60,0.5)":"1px solid rgba(196,160,80,0.3)",borderRadius:"8px",cursor:muted?"default":"pointer",padding:"5px 10px",fontSize:"0.9rem",lineHeight:1,opacity:muted?0.3:1}}>{p?`⏹ ${cnt}`:"🔈"}</button>;
}

function RepeatSpeakBtn({text,onSpeak,muted=false}){
  const [p,setP]=useState(false),[cnt,setCnt]=useState(0),[rpt,setRpt]=useState(1);const ref=useRef(false);
  const go=async e=>{e.stopPropagation();if(muted||p)return;ref.current=false;setP(true);for(let i=0;i<rpt;i++){if(ref.current)break;setCnt(i+1);try{await onSpeak(text);}catch{}if(i<rpt-1)await new Promise(r=>setTimeout(r,1400));}setP(false);setCnt(0);};
  const stop=e=>{e.stopPropagation();ref.current=true;window.speechSynthesis?.cancel();setP(false);setCnt(0);};
  return(
    <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
      {[1,5,10].map(m=><button key={m} onClick={e=>{e.stopPropagation();if(!p)setRpt(m);}} style={{padding:"4px 10px",borderRadius:"8px",border:"1px solid",fontSize:"0.72rem",fontWeight:700,cursor:p?"not-allowed":"pointer",background:rpt===m?"rgba(196,160,80,0.25)":"rgba(255,255,255,0.05)",borderColor:rpt===m?"rgba(196,160,80,0.5)":"rgba(255,255,255,0.1)",color:rpt===m?"#c4a050":"#5a5870"}}>{m}x</button>)}
      <button onClick={p?stop:go} style={{background:muted?"rgba(100,100,100,0.1)":p?"rgba(200,60,60,0.2)":"rgba(196,160,80,0.1)",border:muted?"1px solid rgba(150,150,150,0.2)":p?"1px solid rgba(200,60,60,0.4)":"1px solid rgba(196,160,80,0.35)",borderRadius:"10px",cursor:muted?"default":"pointer",padding:"10px 16px",fontSize:"1.2rem",lineHeight:1,opacity:muted?0.4:1}}>{muted?"🔇":p?`⏹ ${cnt}/${rpt}`:"🔈"}</button>
    </div>
  );
}

function parseCSV(text){
  return text.split(/\r?\n/).filter(l=>l.trim()).map(line=>{
    let cols=[];
    if(/\t|;/.test(line)){cols=line.split(/[\t;]/).map(c=>c.trim().replace(/^["']|["']$/g,""));}
    else{const re=/("([^"]*)")|([^,]+)/g;let m;while((m=re.exec(line))!==null)cols.push((m[2]!==undefined?m[2]:m[3]).trim());}
    return cols.length>=2&&cols[0]&&cols[1]?{hebrew:cols[0],meaning:cols[1]}:null;
  }).filter(Boolean);
}
function parseTextFormat(text){
  return text.split(/\r?\n/).filter(l=>l.trim()).map(line=>{const i=line.search(/[=:]/);return i>0?{hebrew:line.slice(0,i).trim(),meaning:line.slice(i+1).trim()}:null;}).filter(x=>x&&x.hebrew&&x.meaning);
}

function WIDE_MAP(){
  return {"여성형":"gender_f","gender_f":"gender_f","feminine":"gender_f","남성형":"gender_m","gender_m":"gender_m","masculine":"gender_m","복수 남성형":"plural_m","plural_m":"plural_m","복수 여성형":"plural_f","plural_f":"plural_f","소유 1인칭":"poss_1s","poss_1s":"poss_1s","소유 2인칭(남)":"poss_2ms","poss_2ms":"poss_2ms","소유 2인칭(여)":"poss_2fs","poss_2fs":"poss_2fs","소유 3인칭(남)":"poss_3ms","poss_3ms":"poss_3ms","소유 3인칭(여)":"poss_3fs","poss_3fs":"poss_3fs"};
}

function parseVariantExcel(rows){
  if(!rows.length) return {};
  const hdr=rows[0].map(h=>String(h||""));
  const MAP=WIDE_MAP();
  const result={};
  const varCols=[];
  for(let ci=2;ci<hdr.length;ci++){const norm=hdr[ci].replace(/\n.*$/,"").replace(/\(.*?\)/g,"").trim().toLowerCase();const mapped=MAP[norm]||MAP[hdr[ci].toLowerCase()];if(mapped)varCols.push({ci,type:mapped});}
  for(let i=1;i<rows.length;i++){
    const heb=String(rows[i][0]||"").trim();const mean=String(rows[i][1]||"").trim();if(!heb) continue;
    if(!result[heb]) result[heb]={meaning:mean,variants:[]};
    for(const{ci,type}of varCols){const form=String(rows[i][ci]||"").trim();if(form)result[heb].variants.push({type,form});}
  }
  return result;
}

export default function HebrewQuiz() {
  const envKey = process.env.REACT_APP_GOOGLE_TTS_KEY||"";
  const [apiKey] = useState(envKey);
  const ttsReady = !!envKey;
  const [user, setUser] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [pendingCloud, setPendingCloud] = useState(null);

  const [currentBook, setCurrentBook] = useState("hebrew");
  const [uiLang, setUiLang] = useState(()=>{try{return localStorage.getItem("uiLang")||"ko";}catch{return"ko";}});
  const ko = uiLang === "ko";

  const bookInfo = BOOKS.find(b=>b.id===currentBook)||BOOKS[0];
  const [words, setWordsRaw] = useState(()=>loadWords("hebrew"));
  const [mode, setMode] = useState(MODES.LIST);
  const [soundMode, setSoundMode] = useState("auto");
  const muted = soundMode === "mute";

  // ── 단어 추가
  const [newHebrew, setNewHebrew] = useState("");
  const [newMeaning, setNewMeaning] = useState("");
  const [newWordType, setNewWordType] = useState(null);
  const [newWordWallets, setNewWordWallets] = useState(new Set());
  const [editId, setEditId] = useState(null);

  // ── 퀴즈 설정
  const lsi = (k,def) => {try{const v=localStorage.getItem(k);return v!==null?v:def;}catch{return def;}};
  const lsn = (k,def) => {try{const v=localStorage.getItem(k);return v!==null?Number(v):def;}catch{return def;}};
  const lsj = (k,def) => {try{const v=localStorage.getItem(k);return v?JSON.parse(v):def;}catch{return def;}};
  const lsSet = (k,v) => {try{localStorage.setItem(k,typeof v==="string"?v:JSON.stringify(v));}catch{}};

  const [quizType, setQuizType] = useState(()=>lsi("quizType",QT.HEB_TO_MEAN));
  const [quizFilter, setQuizFilter] = useState(()=>lsi("quizFilter",QF.ALL));
  const [quizCount, setQuizCount] = useState(()=>lsn("quizCount",10));
  const [essayType, setEssayType] = useState(()=>lsi("essayType","heb_to_mean"));
  const [essayFilter, setEssayFilter] = useState(()=>lsi("essayFilter",QF.ALL));
  const [essayCount, setEssayCount] = useState(()=>lsn("essayCount",10));
  const [variantFilter, setVariantFilter] = useState(()=>lsi("variantFilter",QF.ALL));
  const [variantCount, setVariantCount] = useState(10);
  const [variantCats, setVariantCats] = useState(()=>lsj("variantCats",VARIANT_CATS.map(c=>c.id)));
  const [variantQuizType, setVariantQuizType] = useState("essay");

  // ── 리스트 설정
  const [listFilter, setListFilter] = useState(()=>lsi("listFilter","all"));
  const [walletFilter, setWalletFilter] = useState(null);
  const [cardStyle, setCardStyle] = useState(()=>lsi("cardStyle","menu"));
  const [sortBy, setSortBy] = useState(()=>lsi("sortBy","default"));
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(()=>lsn("pageSize",20));
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // ── 퀴즈 상태
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [score, setScore] = useState(0);
  const [wrongWords, setWrongWords] = useState([]);
  const [animKey, setAnimKey] = useState(0);

  // ── 서술형 상태
  const [essayQs, setEssayQs] = useState([]);
  const [essayCur, setEssayCur] = useState(0);
  const [essayInput, setEssayInput] = useState("");
  const [essayConfirmed, setEssayConfirmed] = useState(false);
  const [essayResults, setEssayResults] = useState([]);
  const essayInputRef = useRef(null);
  const essayHebRef = useRef(null);

  // ── 변형 퀴즈 상태
  const [variantQs, setVariantQs] = useState([]);
  const [variantCur, setVariantCur] = useState(0);
  const [variantSelected, setVariantSelected] = useState(null);
  const [variantInput, setVariantInput] = useState("");
  const [variantConfirmed, setVariantConfirmed] = useState(false);
  const [variantResults, setVariantResults] = useState([]);
  const variantInputRef = useRef(null);

  // ── 모달 상태
  const [importPreview, setImportPreview] = useState(null);
  const [toast, setToast] = useState(null);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showPealimModal, setShowPealimModal] = useState(false);
  const [showRootModal, setShowRootModal] = useState(false);
  const [showWordSearchModal, setShowWordSearchModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletPickWord, setWalletPickWord] = useState(null);
  const [expandedVariantWord, setExpandedVariantWord] = useState(null);
  const [variantDraft, setVariantDraft] = useState({});
  const [variantPasteMode, setVariantPasteMode] = useState(false);
  const [variantPasteText, setVariantPasteText] = useState("");
  const [pasteText, setPasteText] = useState("");
  const batchTextRef = useRef(null);

  // ── 단어장(wallet)
  const [wallets, setWallets] = useState(()=>lsj("wordWallets",[]));
  const [walletName, setWalletName] = useState("");
  const [walletColor, setWalletColor] = useState("#c4a050");
  const [walletView, setWalletView] = useState(null);

  // ── 검색 모달 상태
  const [wordSearchInput, setWordSearchInput] = useState("");
  const [wordSearchResults, setWordSearchResults] = useState([]);
  const [wordSearchLoading, setWordSearchLoading] = useState(false);
  const [wordSearchError, setWordSearchError] = useState("");
  const [wordSearchSelected, setWordSearchSelected] = useState(new Set());
  const [rootSearchInput, setRootSearchInput] = useState("");
  const [rootSearchResults, setRootSearchResults] = useState([]);
  const [rootSearchLoading, setRootSearchLoading] = useState(false);
  const [rootSearchError, setRootSearchError] = useState("");
  const [rootSelected, setRootSelected] = useState(new Set());
  const [pealimRoot, setPealimRoot] = useState("");
  const [pealimLoading, setPealimLoading] = useState(false);
  const [pealimError, setPealimError] = useState("");
  const [pealimPreview, setPealimPreview] = useState(null);
  const [importTargetWallets, setImportTargetWallets] = useState(new Set());
  const [importExcludeDefault, setImportExcludeDefault] = useState(false);
  const [refreshingVariants, setRefreshingVariants] = useState(false);
  const [refreshLog, setRefreshLog] = useState([]);
  const [showRefreshLog, setShowRefreshLog] = useState(false);
  const [rootGroupView, setRootGroupView] = useState(false);

  const fileInputRef = useRef(null);
  const csvInputRef = useRef(null);
  const variantFileRef = useRef(null);
  const verbFormFileRef = useRef(null);

  // ── 섹션 열기/닫기
  const [openSections, setOpenSections] = useState(()=>lsj("openSections",{add:false,io:false,import:false,quiz_mcq:false,quiz_essay:false,quiz_variant:false}));
  const toggleSection = k => setOpenSections(s=>{const n={...s,[k]:!s[k]};lsSet("openSections",n);return n;});

  // ── 파생 통계
  const masteredCount = words.filter(w=>w.status==="mastered").length;
  const hardCount = words.filter(w=>w.status==="hard").length;
  const learningCount = words.filter(w=>w.status==="learning").length;

  const showToast = (msg,type="ok") => {setToast({msg,type});setTimeout(()=>setToast(null),3000);};

  // ── Firebase 동기화
  const syncToCloud = useCallback(async (ws,wl) => {
    if(!user) return; setSyncing(true);
    try {
      const data={words:ws,updatedAt:new Date().toISOString()};
      if(wl!==undefined) data.wallets=wl; else if(wallets?.length) data.wallets=wallets;
      await setDoc(doc(fbDb,"users",user.uid),data);
    } catch(e){console.error(e);} finally{setSyncing(false);}
  },[user,wallets]);

  useEffect(()=>{
    const unsub=onAuthStateChanged(fbAuth,async u=>{
      setUser(u);
      if(!u) return;
      try{
        const snap=await getDoc(doc(fbDb,"users",u.uid));
        const local=loadWords();
        const isDefault=local.length===8&&local[0].hebrew==="שָׁלוֹם";
        const hasLocal=local.length>0&&!isDefault;
        const syncKey=`synced_${u.uid}`;
        const alreadySynced=localStorage.getItem(syncKey);
        if(snap.exists()){
          const {words:cloud,wallets:cloudWallets}=snap.data();
          if(cloudWallets?.length){
            const localWallets=lsj("wordWallets",[]);
            if(!localWallets.length){setWallets(cloudWallets);lsSet("wordWallets",cloudWallets);}
            else{const merged=[...cloudWallets,...localWallets.filter(lw=>!cloudWallets.find(cw=>cw.id===lw.id))];setWallets(merged);lsSet("wordWallets",merged);}
          }
          if(cloud?.length){
            if(hasLocal&&!alreadySynced){
              const ls=new Set(local.map(w=>w.hebrew)),cs=new Set(cloud.map(w=>w.hebrew));
              if(local.length===cloud.length&&[...ls].every(h=>cs.has(h))){setWordsRaw(cloud);saveWords(cloud);}
              else{setPendingCloud(cloud);setShowMergeModal(true);}
            } else {setWordsRaw(cloud);saveWords(cloud);if(!alreadySynced)showToast("☁️ 클라우드 단어장 불러옴!");}
            localStorage.setItem(syncKey,"1");
          } else if(hasLocal){await setDoc(doc(fbDb,"users",u.uid),{words:local,updatedAt:new Date().toISOString()});localStorage.setItem(syncKey,"1");showToast("☁️ 단어장을 클라우드에 저장했어요!");}
        } else if(hasLocal){await setDoc(doc(fbDb,"users",u.uid),{words:local,updatedAt:new Date().toISOString()});localStorage.setItem(syncKey,"1");showToast("☁️ 단어장을 클라우드에 저장했어요!");}
      }catch(e){console.error(e);}
    });
    return ()=>unsub();
  },[]); // eslint-disable-line

  const handleMerge = choice => {
    if(!pendingCloud) return;
    const local=loadWords();
    if(choice==="cloud"){setWordsRaw(pendingCloud);saveWords(pendingCloud);showToast("☁️ 클라우드로 교체!");}
    else if(choice==="local"){if(user)setDoc(doc(fbDb,"users",user.uid),{words:local,updatedAt:new Date().toISOString()});showToast("💾 클라우드에 저장!");}
    else{const hs=new Set(pendingCloud.map(w=>w.hebrew));const merged=[...pendingCloud,...local.filter(w=>!hs.has(w.hebrew))];setWordsRaw(merged);saveWords(merged);if(user)setDoc(doc(fbDb,"users",user.uid),{words:merged,updatedAt:new Date().toISOString()});showToast(`☁️ 병합 완료! 총 ${merged.length}개`);}
    setPendingCloud(null);setShowMergeModal(false);
    if(user)localStorage.setItem(`synced_${user.uid}`,"1");
  };

  const signInGoogle = async()=>{try{await signInWithPopup(fbAuth,new GoogleAuthProvider());showToast("로그인 성공!");}catch(e){showToast("로그인 실패: "+e.message,"err");}};
  const signOutUser = async()=>{await signOut(fbAuth);showToast("로그아웃 됐어요.");};

  const speak = useCallback(async (text,_forceMuted=false,forcePlay=false)=>{
    if(!forcePlay&&soundMode!=="auto") return;
    const b=BOOKS.find(b=>b.id===currentBook)||BOOKS[0];
    if(apiKey){try{await googleTTS(text,apiKey,b.ttsLang,b.ttsName,b.ttsRate);return;}catch{}}
    browserTTS(text,b.ttsLang,b.ttsRate);
  },[apiKey,currentBook,soundMode]);

  const speakOnDemand = useCallback(async text=>{
    if(soundMode==="mute") return;
    const b=BOOKS.find(b=>b.id===currentBook)||BOOKS[0];
    if(apiKey){try{await googleTTS(text,apiKey,b.ttsLang,b.ttsName,b.ttsRate);return;}catch{}}
    browserTTS(text,b.ttsLang,b.ttsRate);
  },[apiKey,currentBook,soundMode]);

  const setWords = useCallback(updater=>{
    setWordsRaw(prev=>{
      const next=typeof updater==="function"?updater(prev):updater;
      saveWords(next,currentBook);
      syncToCloud(next);
      return next;
    });
  },[currentBook,syncToCloud]);

  const saveWallets = useCallback(wl=>{
    setWallets(wl);lsSet("wordWallets",wl);
    if(user){setDoc(doc(fbDb,"users",user.uid),{wallets:wl,walletsUpdatedAt:new Date().toISOString()},{merge:true}).catch(console.error);}
  },[user]);

  const switchBook = bookId=>{
    setCurrentBook(bookId);setWordsRaw(loadWords(bookId));
    setListFilter("all");setSearchQuery("");setPage(0);setSelectedIds(new Set());setMode(MODES.LIST);
  };

  const updateWordStats = (wordId,correct)=>{
    setWords(ws=>ws.map(w=>{
      if(w.id!==wordId) return w;
      const ns=correct?w.streak+1:0,nwc=correct?w.wrongCount:w.wrongCount+1;
      let st=w.status;
      if(correct&&ns>=3) st="mastered"; else if(!correct&&nwc>=2) st="hard";
      return {...w,streak:ns,wrongCount:nwc,status:st};
    }));
  };
  const setManualStatus = (id,status)=>setWords(ws=>ws.map(w=>w.id===id?{...w,status,streak:status==="mastered"?3:0,wrongCount:status==="hard"?2:0}:w));

  const getPool = useCallback(filter=>{
    const f=filter||quizFilter;
    if(f===QF.LEARNING_ONLY) return words.filter(w=>w.status==="learning");
    if(f===QF.EXCLUDE_MASTERED) return words.filter(w=>w.status!=="mastered");
    if(f===QF.HARD_ONLY) return words.filter(w=>w.status==="hard");
    return words;
  },[words,quizFilter]);

  // ── 퀴즈 시작
  const startQuiz = ()=>{
    const pool=getPool();if(pool.length<4) return;
    const cnt=Math.min(quizCount===9999?pool.length:quizCount,pool.length);
    const qs=shuffle(pool).slice(0,cnt).map(w=>generateQuestion(w,words,quizType));
    setQuestions(qs);setCurrent(0);setSelected(null);setConfirmed(false);setScore(0);setWrongWords([]);setMode(MODES.QUIZ);setAnimKey(k=>k+1);
  };
  const startEssay = ()=>{
    const pool=getPool(essayFilter);if(!pool.length) return;
    const cnt=Math.min(essayCount===9999?pool.length:essayCount,pool.length);
    const qs=shuffle(pool).slice(0,cnt).map(w=>{
      let t=essayType;if(t==="mixed")t=Math.random()>0.5?"heb_to_mean":"mean_to_heb";
      return t==="heb_to_mean"?{wordId:w.id,question:w.hebrew,answer:w.meaning,questionType:"heb_to_mean",hebrewWord:w.hebrew}:{wordId:w.id,question:w.meaning,answer:w.hebrew,questionType:"mean_to_heb",hebrewWord:w.hebrew};
    });
    setEssayQs(qs);setEssayCur(0);setEssayInput("");setEssayConfirmed(false);setEssayResults([]);setMode(MODES.ESSAY);setAnimKey(k=>k+1);
  };

  const selectedTypes = new Set(VARIANT_CATS.filter(c=>variantCats.includes(c.id)).flatMap(c=>c.types));
  const variantPoolSize = getPool(variantFilter).filter(w=>(w.variants||[]).some(v=>selectedTypes.has(v.type))).flatMap(w=>(w.variants||[]).filter(v=>selectedTypes.has(v.type))).length;

  const startVariantQuiz = ()=>{
    const pool=getPool(variantFilter).filter(w=>(w.variants||[]).some(v=>selectedTypes.has(v.type)));
    if(!pool.length){showToast("해당 변형 단어가 없어요.","err");return;}
    const allForms=[...new Set(pool.flatMap(w=>(w.variants||[]).filter(v=>selectedTypes.has(v.type)).map(v=>v.form)))];
    const pairs=pool.flatMap(w=>(w.variants||[]).filter(v=>selectedTypes.has(v.type)).map(v=>{
      const dist=shuffle(allForms.filter(f=>f!==v.form)).slice(0,3);
      while(dist.length<3)dist.push("—");
      return{wordId:w.id,base:w.hebrew,meaning:w.meaning,variantType:v.type,answer:v.form,choices:shuffle([v.form,...dist])};
    }));
    const cnt=Math.min(variantCount===9999?pairs.length:variantCount,pairs.length);
    const qs=shuffle(pairs).slice(0,cnt);
    setVariantQs(qs);setVariantCur(0);setVariantInput("");setVariantConfirmed(false);setVariantResults([]);setVariantSelected(null);setMode(MODES.VARIANT);setAnimKey(k=>k+1);
  };

  // ── 퀴즈 핸들러
  const handleConfirm = ()=>{
    if(!selected) return;
    const q=questions[current];const correct=selected===q.answer;
    if(correct) setScore(s=>s+1); else setWrongWords(w=>[...w,q]);
    updateWordStats(q.wordId,correct);setConfirmed(true);
  };
  const handleNext = ()=>{
    if(current+1>=questions.length){setMode(MODES.RESULT);return;}
    setCurrent(c=>c+1);setSelected(null);setConfirmed(false);setAnimKey(k=>k+1);
  };

  const getEssayInputVal = ()=>{
    const q=essayQs[essayCur];
    return q?.questionType==="mean_to_heb"?(essayHebRef.current?.value||""):essayInput;
  };
  const handleEssayConfirm = ()=>{
    const q=essayQs[essayCur];const val=getEssayInputVal();if(!val.trim()) return;
    const checkVal=q.questionType==="mean_to_heb"?stripNikkud(val):val;
    const checkAns=q.questionType==="mean_to_heb"?stripNikkud(q.answer):q.answer;
    const result=checkEssayAnswer(checkVal,checkAns);
    updateWordStats(q.wordId,result!=="wrong");setEssayResults(r=>[...r,{...q,userInput:val,result}]);setEssayConfirmed(true);speak(q.hebrewWord||q.question);
  };
  const handleEssayNext = ()=>{
    if(essayCur+1>=essayQs.length){setMode(MODES.ESSAY_RESULT);return;}
    setEssayCur(c=>c+1);setEssayInput("");setEssayConfirmed(false);setAnimKey(k=>k+1);
    if(essayHebRef.current)essayHebRef.current.value="";
  };

  const handleVariantConfirm = ()=>{
    const q=variantQs[variantCur];
    if(variantQuizType==="mcq"){
      if(!variantSelected) return;
      const ok=variantSelected===q.answer;updateWordStats(q.wordId,ok);
      setVariantResults(r=>[...r,{...q,userInput:variantSelected,correct:ok}]);setVariantConfirmed(true);speak(q.answer);
    } else {
      if(!variantInput.trim()) return;
      const ok=stripNikkud(variantInput.trim())===stripNikkud(q.answer)||variantInput.trim()===q.answer;
      updateWordStats(q.wordId,ok);setVariantResults(r=>[...r,{...q,userInput:variantInput,correct:ok}]);setVariantConfirmed(true);speak(q.answer);
    }
  };
  const handleVariantNext = ()=>{
    if(variantCur+1>=variantQs.length){setMode(MODES.VARIANT_RESULT);return;}
    setVariantCur(c=>c+1);setVariantInput("");setVariantConfirmed(false);setVariantSelected(null);
    if(variantQuizType==="essay"&&variantInputRef.current)variantInputRef.current.focus();
  };

  // ── 자동 발음
  const spokenKey = useRef(-1);
  useEffect(()=>{
    if(mode!==MODES.QUIZ||soundMode!=="auto") return;
    const q=questions[current];if(!q||q.questionType!==QT.HEB_TO_MEAN) return;
    if(spokenKey.current===animKey) return;spokenKey.current=animKey;
    const t=setTimeout(()=>speak(q.question),500);return()=>clearTimeout(t);
  },[current,animKey,mode,soundMode]); // eslint-disable-line
  useEffect(()=>{if(mode===MODES.ESSAY&&essayInputRef.current)essayInputRef.current.focus();},[essayCur,mode]);

  // ── 단어 CRUD
  const addWord = ()=>{
    if(!newHebrew.trim()||!newMeaning.trim()) return;
    if(editId!==null){
      setWords(ws=>ws.map(w=>w.id===editId?{...w,hebrew:newHebrew.trim(),meaning:newMeaning.trim(),...(newWordType?{wordType:newWordType}:{})}:w));
      setEditId(null);
    } else {
      const newId=Date.now();
      const newWord={id:newId,hebrew:newHebrew.trim(),meaning:newMeaning.trim(),status:"learning",streak:0,wrongCount:0,...(newWordType?{wordType:newWordType}:{})};
      setWords(ws=>[newWord,...ws]);setPage(0);
      if(newWordWallets.size>0)saveWallets(wallets.map(wl=>newWordWallets.has(wl.id)?{...wl,wordIds:[...wl.wordIds,newId]}:wl));
    }
    setNewHebrew("");setNewMeaning("");setNewWordType(null);
  };
  const deleteWord = id=>{
    if(walletFilter)saveWallets(wallets.map(wl=>wl.id===walletFilter?{...wl,wordIds:wl.wordIds.filter(i=>i!==id)}:wl));
    else{setWords(ws=>ws.filter(w=>w.id!==id));saveWallets(wallets.map(wl=>({...wl,wordIds:wl.wordIds.filter(i=>i!==id)})));}
  };
  const startEdit = w=>{setEditId(w.id);setNewHebrew(w.hebrew);setNewMeaning(w.meaning);setNewWordType(w.wordType||null);setOpenSections(s=>({...s,add:true}));window.scrollTo({top:0,behavior:"smooth"});};
  const cancelEdit = ()=>{setEditId(null);setNewHebrew("");setNewMeaning("");setNewWordType(null);};

  // ── 변형 편집
  const openVariantModal = w=>{const draft={};(w.variants||[]).forEach(v=>{draft[v.type]=v.form;});setVariantDraft(draft);setExpandedVariantWord(w.id);};
  const saveVariantDraft = wordId=>{
    const variants=Object.entries(variantDraft).filter(([,f])=>f.trim()).map(([type,form])=>({type,form:form.trim()}));
    setWords(ws=>ws.map(w=>w.id===wordId?{...w,variants}:w));setExpandedVariantWord(null);
    showToast(`✅ 변형 ${variants.length}개 저장!`);
  };
  const applyVariantPaste = text=>{
    const lines=text.split(/[\n\t]/).map(l=>l.trim());const draft={...variantDraft};
    const editW=words.find(w=>w.id===expandedVariantWord);const order=getAllowedPasteOrder(editW?.wordType);
    let idx=0;lines.forEach(form=>{if(idx>=order.length)return;if(form){draft[order[idx]]=form;idx++;}else idx++;});
    setVariantDraft(draft);setVariantPasteText("");setVariantPasteMode(false);showToast("📋 자동 매핑 적용됨!");
  };

  // ── 가져오기/내보내기
  const exportWords = ()=>{
    const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),words},null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`hebrew-vocab-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);showToast(`✅ ${words.length}개 단어 저장!`);
  };
  const copyToClipboard = async()=>{
    const text=JSON.stringify({version:1,exportedAt:new Date().toISOString(),words},null,2);
    try{await navigator.clipboard.writeText(text);}catch{const ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);}
    showToast("📋 클립보드에 복사됨!");
  };
  const importFromFile = json=>{
    try{const raw=Array.isArray(json)?json:(json.words||[]);const imp=raw.map(w=>({id:Date.now()+Math.random(),hebrew:(w.hebrew||"").trim(),meaning:(w.meaning||"").trim(),status:["learning","mastered","hard"].includes(w.status)?w.status:"learning",streak:w.streak||0,wrongCount:w.wrongCount||0})).filter(w=>w.hebrew&&w.meaning);if(!imp.length){showToast("불러올 단어가 없어요.","err");return null;}return imp;}catch{showToast("올바른 형식이 아니에요.","err");return null;}
  };
  const handleFileChange = e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{try{const imp=importFromFile(JSON.parse(ev.target.result));if(imp)setImportPreview({words:imp,fileName:f.name});}catch{showToast("파일 읽기 실패","err");}};r.readAsText(f);e.target.value="";};
  const importFromText = ()=>{try{const imp=importFromFile(JSON.parse(pasteText));if(imp){setImportPreview({words:imp,fileName:"클립보드에서 붙여넣기"});setShowPasteModal(false);setPasteText("");}}catch{showToast("올바른 형식이 아니에요.","err");}};
  const importFromBatchText = ()=>{const raw=batchTextRef.current?.value||"";const parsed=parseTextFormat(raw);if(!parsed.length){showToast("인식된 단어가 없어요.","err");return;}setImportPreview({words:parsed.map(w=>({...w,id:Date.now()+Math.random(),status:"learning",streak:0,wrongCount:0})),fileName:`텍스트 (${parsed.length}개)`});setShowBatchModal(false);if(batchTextRef.current)batchTextRef.current.value="";};
  const handleCSVChange = async e=>{
    const f=e.target.files[0];if(!f) return;
    if(/\.xlsx?$/i.test(f.name)){
      try{const XLSX=await getXLSX();const buf=await f.arrayBuffer();const wb=XLSX.read(buf,{type:"array"});const ws=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});const parsed=rows.filter(r=>r[0]&&r[1]).map(r=>({hebrew:String(r[0]).trim(),meaning:String(r[1]).trim()})).filter(w=>w.hebrew&&w.meaning);if(!parsed.length){showToast("인식된 단어 없음","err");return;}setImportPreview({words:parsed.map(w=>({...w,id:Date.now()+Math.random(),status:"learning",streak:0,wrongCount:0})),fileName:f.name});}catch{showToast("엑셀 읽기 실패","err");}
    } else {
      const r=new FileReader();r.onload=ev=>{const p=parseCSV(ev.target.result);if(!p.length){showToast("인식된 단어 없음","err");return;}setImportPreview({words:p.map(w=>({...w,id:Date.now()+Math.random(),status:"learning",streak:0,wrongCount:0})),fileName:f.name});};r.readAsText(f,"UTF-8");
    }
    e.target.value="";
  };
  const confirmImport = merge=>{
    if(!importPreview) return;
    if(merge){const ex=new Set(words.map(w=>w.hebrew));const nw=importPreview.words.filter(w=>!ex.has(w.hebrew));setWords(ws=>[...ws,...nw]);showToast(`📥 ${nw.length}개 추가!`);}
    else{setWords(importPreview.words);showToast(`📥 ${importPreview.words.length}개로 교체!`);}
    setImportPreview(null);
  };

  const handleVariantExcel = async e=>{
    const f=e.target.files[0];if(!f) return;
    try{const XLSX=await getXLSX();const buf=await f.arrayBuffer();const wb=XLSX.read(buf,{type:"array"});let sn=wb.SheetNames[0];if(wb.SheetNames.some(s=>s.includes("가로형")))sn=wb.SheetNames.find(s=>s.includes("가로형"));const ws=wb.Sheets[sn];const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});const parsed=parseVariantExcel(rows);const entries=Object.entries(parsed);if(!entries.length){showToast("변형 데이터 없음","err");return;}let added=0,updated=0;setWords(ws=>ws.map(w=>{const m=entries.find(([heb])=>stripNikkud(heb)===stripNikkud(w.hebrew)||heb===w.hebrew);if(!m) return w;const{variants:nv}=m[1];const ex=new Set((w.variants||[]).map(v=>v.type+"|"+v.form));const ta=nv.filter(v=>!ex.has(v.type+"|"+v.form));if(!ta.length) return w;updated++;added+=ta.length;return{...w,variants:[...(w.variants||[]),...ta]};}));showToast(`📥 ${updated}개 단어에 변형 ${added}개 추가!`);}catch(err){showToast("파일 읽기 실패: "+err.message,"err");}
    e.target.value="";
  };

  const refreshAllVariants = async()=>{
    const vws=words.filter(w=>w.wordType==="verb"||(w.variants||[]).length>0);
    if(!vws.length){showToast("동사 단어 없음","err");return;}
    setRefreshingVariants(true);setRefreshLog([]);
    const log=[];const done=new Set();
    for(const w of vws){
      const key=stripNikkud(w.hebrew);if(done.has(key)) continue;done.add(key);
      try{const res=await fetch(`/api/Reverso?mode=conjugation&verb=${encodeURIComponent(w.hebrew)}`);const cd=await res.json();if(cd.error||!cd.variantCount){log.push({hebrew:w.hebrew,meaning:w.meaning,status:"fail",error:cd.error||"변형 없음"});continue;}const variants=Object.entries(cd.variants).filter(([,f])=>f).map(([type,form])=>({type,form}));if(!variants.length){log.push({hebrew:w.hebrew,meaning:w.meaning,status:"fail",error:"변형 없음"});continue;}setWords(ws=>ws.map(ww=>stripNikkud(ww.hebrew)===key?{...ww,variants,meaning:ww.meaning||cd.meaning||""}:ww));log.push({hebrew:w.hebrew,meaning:w.meaning,status:"ok",variantCount:variants.length});}catch(e){log.push({hebrew:w.hebrew,meaning:w.meaning,status:"fail",error:e.message});}
    }
    setRefreshLog(log);setShowRefreshLog(true);setRefreshingVariants(false);
    showToast(`✅ ${log.filter(l=>l.status==="ok").length}개 성공 / ${log.filter(l=>l.status==="fail").length}개 실패`);
  };

  const searchWordByMeaning = async()=>{
    if(!wordSearchInput.trim()){setWordSearchError("검색어를 입력해주세요");return;}
    setWordSearchLoading(true);setWordSearchError("");setWordSearchResults([]);setWordSearchSelected(new Set());
    try{
      const q=wordSearchInput.trim();const hasKo=/[ㄱ-ㅎ가-힣]/.test(q);
      let searchQ=q;
      if(hasKo){try{const res=await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=en&dt=t&q=${encodeURIComponent(q)}`);const d=await res.json();if(d?.[0]?.[0]?.[0])searchQ=d[0][0][0];}catch{}}
      const res=await fetch(`/api/Reverso?mode=word_search&q=${encodeURIComponent(searchQ)}`);const data=await res.json();
      if(data.error){setWordSearchError(data.error);return;}
      if(!data.results?.length){setWordSearchError(`"${q}" 검색 결과 없음`);return;}
      setWordSearchResults(data.results);
    }catch(e){setWordSearchError("오류: "+e.message);}finally{setWordSearchLoading(false);}
  };

  const addWordSearchSelected = ()=>{
    if(!wordSearchSelected.size){setWordSearchError("단어를 선택해주세요");return;}
    const nw=[...wordSearchSelected].map(i=>wordSearchResults[i]).filter(Boolean).map(r=>({id:Date.now()+Math.random(),hebrew:r.hebrew,meaning:r.meaning||"",status:"learning",streak:0,wrongCount:0,wordType:r.pos==="translation"?null:r.pos||null,variants:[]}));
    setWords(ws=>[...nw,...ws]);setPage(0);
    if(importTargetWallets.size>0){const ids=nw.map(w=>w.id);saveWallets(wallets.map(wl=>importTargetWallets.has(wl.id)?{...wl,wordIds:[...wl.wordIds,...ids]}:wl));}
    showToast(`✅ ${nw.length}개 추가!`);setWordSearchSelected(new Set());setShowWordSearchModal(false);setWordSearchResults([]);setWordSearchInput("");
  };

  const searchByRoot = async()=>{
    if(!rootSearchInput.trim()){setRootSearchError("어근을 입력해주세요");return;}
    setRootSearchLoading(true);setRootSearchError("");setRootSearchResults([]);setRootSelected(new Set());
    try{const res=await fetch(`/api/Reverso?mode=root_search&root=${encodeURIComponent(rootSearchInput.trim())}`);const data=await res.json();if(data.error){setRootSearchError(data.error);return;}if(!data.results?.length){setRootSearchError("검색 결과 없음");return;}setRootSearchResults(data.results);}
    catch(e){setRootSearchError("오류: "+e.message);}finally{setRootSearchLoading(false);}
  };

  const addRootSelected = ()=>{
    if(!rootSelected.size){setRootSearchError("단어를 선택해주세요");return;}
    const nw=[...rootSelected].map(i=>rootSearchResults[i]).filter(Boolean).map(r=>({id:Date.now()+Math.random(),hebrew:r.hebrew,meaning:r.meaning||"",status:"learning",streak:0,wrongCount:0,wordType:r.pos||null,root:rootSearchInput.trim(),variants:[]}));
    setWords(ws=>[...nw,...ws]);setPage(0);
    if(importTargetWallets.size>0){const ids=nw.map(w=>w.id);saveWallets(wallets.map(wl=>importTargetWallets.has(wl.id)?{...wl,wordIds:[...wl.wordIds,...ids]}:wl));}
    showToast(`✅ ${nw.length}개 추가!`);setRootSelected(new Set());setShowRootModal(false);setRootSearchResults([]);setRootSearchInput("");
  };

  const searchPealim = async()=>{
    if(!pealimRoot.trim()){setPealimError("동사를 입력해주세요");return;}
    setPealimLoading(true);setPealimError("");setPealimPreview(null);
    try{const res=await fetch(`/api/Reverso?mode=conjugation&verb=${encodeURIComponent(pealimRoot.trim())}`);const data=await res.json();if(data.error){setPealimError(data.error);return;}if(!data.variantCount){setPealimError("변형 없음");return;}const existing=words.find(w=>stripNikkud(w.hebrew)===stripNikkud(data.infinitive));setPealimPreview({...data,meaning:existing?.meaning||data.meaning||"",root:pealimRoot.trim()});}
    catch(e){setPealimError("오류: "+e.message);}finally{setPealimLoading(false);}
  };

  const addFromPealim = ()=>{
    if(!pealimPreview?.infinitive) return;
    const variants=Object.entries(pealimPreview.variants).filter(([,f])=>f).map(([type,form])=>({type,form}));
    const exists=words.find(w=>stripNikkud(w.hebrew)===stripNikkud(pealimPreview.infinitive));
    if(exists){setWords(ws=>ws.map(w=>w.id===exists.id?{...w,variants}:w));showToast(`✅ 변형 ${variants.length}개 업데이트!`);}
    else{const nw={id:Date.now()+Math.random(),hebrew:pealimPreview.infinitive,meaning:pealimPreview.meaning||"",status:"learning",streak:0,wrongCount:0,wordType:null,variants,root:pealimPreview.root||""};setWords(ws=>[nw,...ws]);setPage(0);showToast(`✅ "${pealimPreview.infinitive}" 추가 (변형 ${variants.length}개)!`);}
    setShowPealimModal(false);setPealimPreview(null);setPealimRoot("");
  };

  // ── 필터링/정렬된 단어 목록
  const searchedWords = (() => {
    let r=words.filter(w=>{
      if(listFilter!=="all"&&w.status!==listFilter) return false;
      if(walletFilter){const wl=wallets.find(x=>x.id===walletFilter);if(!wl||!wl.wordIds.includes(w.id)) return false;}
      if(!searchQuery.trim()) return true;
      const q=searchQuery.toLowerCase();
      return w.hebrew.includes(searchQuery)||w.meaning.toLowerCase().includes(q)||stripNikkud(w.hebrew).includes(searchQuery);
    });
    if(sortBy==="hebrew_asc") r=[...r].sort((a,b)=>a.hebrew.localeCompare(b.hebrew,"he"));
    else if(sortBy==="hebrew_desc") r=[...r].sort((a,b)=>b.hebrew.localeCompare(a.hebrew,"he"));
    else if(sortBy==="meaning_asc") r=[...r].sort((a,b)=>a.meaning.localeCompare(b.meaning));
    else if(sortBy==="meaning_desc") r=[...r].sort((a,b)=>b.meaning.localeCompare(a.meaning));
    else if(sortBy==="hard_first") r=[...r].sort((a,b)=>({hard:0,learning:1,mastered:2}[a.status]??1)-({hard:0,learning:1,mastered:2}[b.status]??1));
    else if(sortBy==="mastered_first") r=[...r].sort((a,b)=>({mastered:0,learning:1,hard:2}[a.status]??1)-({mastered:0,learning:1,hard:2}[b.status]??1));
    else if(sortBy==="wrong_desc") r=[...r].sort((a,b)=>(b.wrongCount||0)-(a.wrongCount||0));
    return r;
  })();
  const totalPages=Math.ceil(searchedWords.length/pageSize);
  const filteredWords=pageSize===9999?searchedWords:searchedWords.slice(page*pageSize,(page+1)*pageSize);

  const poolSize=getPool().length;
  const essayPoolSize=getPool(essayFilter).length;
  const essayScore=essayResults.filter(r=>r.result==="exact").length;
  const essayPartial=essayResults.filter(r=>r.result==="partial").length;
  const q=questions[current];
  const eq=essayQs[essayCur];
  const vq=variantQs[variantCur];

  // ── 섹션 헤더 컴포넌트
  const SectionHeader = ({sectionKey,title,color="#c4a050",badge=null}) => (
    <button onClick={()=>toggleSection(sectionKey)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",background:"none",border:"none",cursor:"pointer",padding:0,textAlign:"left"}}>
      <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
        <span style={{fontSize:"0.9rem",fontWeight:600,color}}>{title}</span>
        {badge&&<span style={{fontSize:"0.7rem",background:"rgba(255,255,255,0.06)",padding:"2px 8px",borderRadius:"20px",color:"#5a5870"}}>{badge}</span>}
      </div>
      <span style={{fontSize:"0.75rem",color:"#5a5870",display:"inline-block",transform:openSections[sectionKey]?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>▼</span>
    </button>
  );

  const countOpts=[5,10,20,"전체"].map(v=>({label:v==="전체"?"전체":`${v}`,value:v==="전체"?9999:v}));

  // ── 상태 뱃지
  const StatusBadge = ({status,size="sm"}) => {
    const st=STATUS_CONFIG[status];
    return<span style={{fontSize:size==="sm"?"0.68rem":"0.78rem",padding:"3px 9px",borderRadius:"100px",background:st.bg,border:`1px solid ${st.border}`,color:st.color,fontWeight:600}}>{st.emoji} {st.labelKo}</span>;
  };

  // ── 퀴즈 상태 조작 버튼
  const StatusButtons = ({wordId,compact=false}) => {
    const w=words.find(x=>x.id===wordId);if(!w) return null;
    return(
      <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
        {["hard","mastered","learning"].filter(s=>s!==w.status).map(s=>{const st=STATUS_CONFIG[s];return(
          <button key={s} onClick={()=>setManualStatus(wordId,s)} style={{padding:compact?"3px 8px":"5px 12px",borderRadius:"100px",border:`1px solid ${st.border}`,background:st.bg,color:st.color,cursor:"pointer",fontSize:compact?"0.65rem":"0.72rem",fontWeight:600}}>{st.emoji} {st.labelKo}</button>
        );})}
      </div>
    );
  };

  // ── 모달 컨테이너
  const ModalWrap = ({show,onClose,children,maxW="460px"}) => {
    if(!show) return null;
    return(
      <div style={S.modalOverlay} onClick={onClose}>
        <div style={{...S.modal,maxWidth:maxW}} onClick={e=>e.stopPropagation()}>{children}</div>
      </div>
    );
  };

  return (
    <div style={S.root}>
      <style>{`
        *{box-sizing:border-box;}body{margin:0;}
        input,button,textarea{-webkit-tap-highlight-color:transparent;font-family:-apple-system,'Helvetica Neue','Noto Sans KR',sans-serif;}
        input:focus,textarea:focus{outline:none;border-color:rgba(196,160,80,0.6)!important;}
        button{line-height:1.3;}
        ::-webkit-scrollbar{display:none;}
        @media(max-width:480px){
          .choices-grid{grid-template-columns:1fr!important;}
          .form-row{flex-direction:column!important;}
        }
      `}</style>

      {toast&&<div style={{position:"fixed",bottom:"24px",left:"50%",transform:"translateX(-50%)",background:toast.type==="err"?"rgba(200,60,60,0.95)":"rgba(24,22,44,0.97)",border:`1px solid ${toast.type==="err"?"rgba(200,60,60,0.4)":"rgba(196,160,80,0.3)"}`,color:toast.type==="err"?"#f08080":"#e8e6f0",padding:"11px 20px",borderRadius:"14px",fontSize:"0.9rem",zIndex:9999,boxShadow:"0 4px 20px rgba(0,0,0,0.5)",maxWidth:"90vw",textAlign:"center"}}>{toast.msg}</div>}

      {/* ── 병합 모달 */}
      <ModalWrap show={showMergeModal&&!!pendingCloud} onClose={()=>{}}>
        <h3 style={S.modalTitle}>☁️ 단어장 동기화</h3>
        <p style={S.modalSub}>기기와 클라우드에 단어장이 모두 있어요. 어떻게 할까요?</p>
        <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
          <button style={{...S.btnMerge,padding:"14px",width:"100%"}} onClick={()=>handleMerge("merge")}>🔀 합치기</button>
          <button style={{...S.btnReplace,padding:"14px",width:"100%"}} onClick={()=>handleMerge("cloud")}>☁️ 클라우드 사용 ({pendingCloud?.length}개)</button>
          <button style={{...S.btnCancel2,padding:"14px"}} onClick={()=>handleMerge("local")}>💾 기기 단어 유지</button>
        </div>
      </ModalWrap>

      {/* ── 붙여넣기 모달 */}
      <ModalWrap show={showPasteModal} onClose={()=>{setShowPasteModal(false);setPasteText("");}}>
        <h3 style={S.modalTitle}>📋 텍스트로 불러오기</h3>
        <p style={S.modalSub}>📋 복사로 저장한 JSON 텍스트를 붙여넣어주세요</p>
        <textarea style={S.modalTA} placeholder='{"version":1,"words":[...]}' value={pasteText} onChange={e=>setPasteText(e.target.value)}/>
        <div style={S.modalBtnRow}>
          <button style={S.btnMerge} onClick={importFromText}>✅ 불러오기</button>
          <button style={S.btnCancel2} onClick={()=>{setShowPasteModal(false);setPasteText("");}}>취소</button>
        </div>
      </ModalWrap>

      {/* ── 텍스트 일괄 추가 모달 */}
      <ModalWrap show={showBatchModal} onClose={()=>{setShowBatchModal(false);}}>
        <h3 style={S.modalTitle}>📝 텍스트로 단어 추가</h3>
        <p style={S.modalSub}>한 줄에 하나씩 히브리어=뜻 형식으로 입력하세요</p>
        <div style={{background:"rgba(196,160,80,0.08)",border:"1px solid rgba(196,160,80,0.15)",borderRadius:"12px",padding:"10px 14px",marginBottom:"10px",fontSize:"0.82rem",color:"#c4a050",lineHeight:1.8,fontFamily:"monospace"}}>שָׁלוֹם=평화<br/>תּוֹדָה=감사합니다</div>
        <textarea ref={batchTextRef} style={{...S.modalTA,fontFamily:"Arial,sans-serif"}} lang="he" placeholder={"שָׁלוֹם=평화\nתּוֹדָה=감사합니다"} defaultValue="" spellCheck={false} autoCorrect="off"/>
        <div style={S.modalBtnRow}>
          <button style={S.btnMerge} onClick={importFromBatchText}>✅ 단어 추가</button>
          <button style={S.btnCancel2} onClick={()=>{setShowBatchModal(false);if(batchTextRef.current)batchTextRef.current.value="";}}>취소</button>
        </div>
      </ModalWrap>

      {/* ── 가져오기 미리보기 모달 */}
      <ModalWrap show={!!importPreview} onClose={()=>setImportPreview(null)}>
        <h3 style={S.modalTitle}>📥 단어 불러오기</h3>
        <p style={S.modalSub}>출처: <span style={{color:"#c4a050"}}>{importPreview?.fileName}</span></p>
        <p style={S.modalSub}><b style={{color:"#e8e6f0"}}>{importPreview?.words.length}</b>개 단어 발견</p>
        <div style={S.modalPreview}>
          {importPreview?.words.slice(0,5).map((w,i)=>(<div key={i} style={S.modalPreviewItem}><span style={{fontFamily:"Arial",color:"#c4a050",direction:"rtl"}}>{w.hebrew}</span><span style={{color:"#5a5870",margin:"0 6px"}}>→</span><span style={{color:"#a0a0c0",fontSize:"0.85rem"}}>{w.meaning}</span></div>))}
          {importPreview?.words.length>5&&<p style={{color:"#5a5870",fontSize:"0.8rem",margin:"6px 0 0"}}>...외 {importPreview.words.length-5}개</p>}
        </div>
        <div style={S.modalBtnRow}>
          <button style={S.btnMerge} onClick={()=>confirmImport(true)}>➕ 현재에 추가</button>
          <button style={S.btnReplace} onClick={()=>confirmImport(false)}>🔄 전체 교체</button>
          <button style={S.btnCancel2} onClick={()=>setImportPreview(null)}>취소</button>
        </div>
      </ModalWrap>

      {/* ── 단어장 픽커 모달 */}
      {walletPickWord&&(
        <div style={{...S.modalOverlay,zIndex:9999}} onClick={()=>setWalletPickWord(null)}>
          <div style={{...S.modal,maxWidth:"300px",padding:"20px"}} onClick={e=>e.stopPropagation()}>
            <h3 style={{...S.modalTitle,marginBottom:"4px"}}>📚 단어장 선택</h3>
            <p style={{...S.modalSub,marginBottom:"14px"}}>여러 단어장에 동시 추가 가능</p>
            <div style={{display:"flex",flexDirection:"column",gap:"5px"}}>
              {wallets.map(wl=>{
                const inWallet=wl.wordIds.includes(walletPickWord);
                return(<button key={wl.id} onClick={()=>{const nw=wallets.map(w=>w.id===wl.id?{...w,wordIds:w.wordIds.includes(walletPickWord)?w.wordIds.filter(i=>i!==walletPickWord):[...w.wordIds,walletPickWord]}:w);saveWallets(nw);}} style={{display:"flex",alignItems:"center",gap:"10px",padding:"11px 14px",borderRadius:"12px",background:inWallet?`${wl.color}20`:"rgba(255,255,255,0.04)",border:`1px solid ${inWallet?wl.color+"55":"rgba(255,255,255,0.08)"}`,cursor:"pointer",textAlign:"left"}}>
                  <div style={{width:"18px",height:"18px",borderRadius:"6px",flexShrink:0,background:inWallet?wl.color:"transparent",border:`2px solid ${inWallet?wl.color:"rgba(255,255,255,0.2)"}`,display:"flex",alignItems:"center",justifyContent:"center"}}>{inWallet&&<span style={{color:"#1a1820",fontSize:"0.65rem",fontWeight:700}}>✓</span>}</div>
                  <span style={{color:inWallet?wl.color:"#e8e6f0",flex:1,fontWeight:inWallet?600:400}}>{wl.name}</span>
                  <span style={{fontSize:"0.72rem",color:"#5a5870"}}>{words.filter(w=>wl.wordIds.includes(w.id)).length}</span>
                </button>);
              })}
            </div>
            <button style={{...S.btnMerge,width:"100%",marginTop:"14px"}} onClick={()=>setWalletPickWord(null)}>완료</button>
          </div>
        </div>
      )}

      {/* ── 단어장 관리 모달 */}
      <ModalWrap show={showWalletModal} onClose={()=>{setShowWalletModal(false);setWalletView(null);}} maxW="480px">
        <h3 style={S.modalTitle}>📚 커스텀 단어장</h3>
        {walletView!==null?(()=>{
          const wl=wallets.find(w=>w.id===walletView);if(!wl) return null;
          const wlWords=wl.wordIds.map(id=>words.find(w=>w.id===id)).filter(Boolean);
          return(<div>
            <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"14px"}}>
              <button onClick={()=>setWalletView(null)} style={S.scrollBtn}>← 목록</button>
              <span style={{fontWeight:700,color:wl.color,fontSize:"1rem"}}>{wl.name}</span>
              <span style={{fontSize:"0.75rem",color:"#5a5870"}}>{wlWords.length}개 단어</span>
            </div>
            {wlWords.length>0?(<>
              <div style={{maxHeight:"240px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"4px",marginBottom:"12px"}}>
                {wlWords.map(w=>(<div key={w.id} style={{display:"flex",alignItems:"center",gap:"8px",padding:"10px 14px",borderRadius:"10px",background:"rgba(255,255,255,0.04)"}}>
                  <span style={{fontFamily:"Arial",direction:"rtl",color:"#c4a050",fontSize:"1rem",minWidth:"80px"}}>{w.hebrew}</span>
                  <span style={{color:"#7a7890",fontSize:"0.82rem",flex:1}}>{w.meaning}</span>
                  <button onClick={()=>{const nw=wallets.map(x=>x.id===wl.id?{...x,wordIds:x.wordIds.filter(i=>i!==w.id)}:x);saveWallets(nw);}} style={{padding:"4px 10px",borderRadius:"8px",background:"rgba(200,60,60,0.1)",border:"1px solid rgba(200,60,60,0.3)",color:"#f07050",cursor:"pointer",fontSize:"0.72rem"}}>제거</button>
                </div>))}
              </div>
              <div style={{display:"flex",gap:"8px"}}>
                <button onClick={()=>{if(wlWords.length<4){showToast("객관식은 4개 이상 필요","err");return;}const qs=wlWords.map(w=>generateQuestion(w,wlWords.length>=4?wlWords:words,quizType));setQuestions(qs);setCurrent(0);setSelected(null);setConfirmed(false);setScore(0);setWrongWords([]);setMode(MODES.QUIZ);setAnimKey(k=>k+1);setShowWalletModal(false);}} style={{flex:1,padding:"12px",borderRadius:"12px",background:"linear-gradient(135deg,#c4a050,#e8c875)",border:"none",color:"#1a1620",fontWeight:700,cursor:"pointer",fontSize:"0.85rem"}}>🎯 객관식 퀴즈</button>
                <button onClick={()=>{const qs=wlWords.map(w=>({wordId:w.id,question:w.hebrew,answer:w.meaning,hebrewWord:w.hebrew,questionType:"heb_to_mean"}));setEssayQs(qs);setEssayCur(0);setEssayInput("");setEssayConfirmed(false);setEssayResults([]);setMode(MODES.ESSAY);setAnimKey(k=>k+1);setShowWalletModal(false);}} style={{flex:1,padding:"12px",borderRadius:"12px",background:"rgba(100,80,200,0.2)",border:"1px solid rgba(100,80,200,0.4)",color:"#c0b0ff",fontWeight:700,cursor:"pointer",fontSize:"0.85rem"}}>✍️ 서술형</button>
              </div>
            </>):<div style={{textAlign:"center",padding:"30px",color:"#5a5870",fontSize:"0.85rem"}}>📚 버튼으로 단어를 추가하세요</div>}
          </div>);
        })():(
          <div>
            <div style={{display:"flex",gap:"8px",marginBottom:"12px",alignItems:"center"}}>
              <input value={walletName} onChange={e=>setWalletName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(walletName.trim()&&(saveWallets([{id:Date.now(),name:walletName.trim(),color:walletColor,wordIds:[]},...wallets]),setWalletName("")))} style={{...S.input,flex:1,padding:"10px 14px"}} placeholder="단어장 이름..."/>
              <div style={{display:"flex",gap:"4px"}}>
                {["#c4a050","#50c898","#9060f0","#f07050","#60a0e0","#e06080"].map(c=>(<button key={c} onClick={()=>setWalletColor(c)} style={{width:"22px",height:"22px",borderRadius:"50%",background:c,border:walletColor===c?"2px solid #fff":"2px solid transparent",cursor:"pointer"}}/>))}
              </div>
              <button onClick={()=>{if(!walletName.trim())return;saveWallets([{id:Date.now(),name:walletName.trim(),color:walletColor,wordIds:[]},...wallets]);setWalletName("");}} disabled={!walletName.trim()} style={{...S.btnAdd,padding:"10px 14px",opacity:walletName.trim()?1:0.4}}>만들기</button>
            </div>
            {wallets.length===0?(<div style={{textAlign:"center",color:"#5a5870",padding:"24px 0",fontSize:"0.85rem"}}>아직 단어장이 없어요</div>):(
              <div style={{display:"flex",flexDirection:"column",gap:"4px",maxHeight:"300px",overflowY:"auto"}}>
                {wallets.map(wl=>(<div key={wl.id} style={{display:"flex",alignItems:"center",gap:"8px",padding:"12px 14px",borderRadius:"12px",background:"rgba(255,255,255,0.04)"}}>
                  <div style={{width:"10px",height:"10px",borderRadius:"50%",background:wl.color,flexShrink:0}}/>
                  <button onClick={()=>setWalletView(wl.id)} style={{flex:1,background:"none",border:"none",color:"#e8e6f0",cursor:"pointer",textAlign:"left",fontSize:"0.9rem"}}>{wl.name}</button>
                  <span style={{fontSize:"0.75rem",color:"#5a5870"}}>{words.filter(w=>wl.wordIds.includes(w.id)).length}개</span>
                  <button onClick={()=>setWalletView(wl.id)} style={{...S.scrollBtn,color:wl.color}}>보기</button>
                  <button onClick={()=>saveWallets(wallets.filter(w=>w.id!==wl.id))} style={{...S.scrollBtn,background:"rgba(200,60,60,0.1)",borderColor:"rgba(200,60,60,0.25)",color:"#f07050"}}>삭제</button>
                </div>))}
              </div>
            )}
          </div>
        )}
        <div style={{marginTop:"14px"}}><button style={S.btnCancel2} onClick={()=>{setShowWalletModal(false);setWalletView(null);}}>닫기</button></div>
      </ModalWrap>

      {/* ── 뜻으로 검색 모달 */}
      <ModalWrap show={showWordSearchModal} onClose={()=>{setShowWordSearchModal(false);setWordSearchResults([]);setWordSearchInput("");}} maxW="480px">
        <h3 style={S.modalTitle}>🔎 뜻으로 히브리어 검색</h3>
        <p style={S.modalSub}>한국어 또는 영어로 입력하면 히브리어 단어를 찾아줘요</p>
        <div style={{display:"flex",gap:"8px",marginBottom:"12px"}}>
          <input style={{...S.input,flex:1}} placeholder="사랑, love..." value={wordSearchInput} onChange={e=>setWordSearchInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchWordByMeaning()}/>
          <button onClick={searchWordByMeaning} disabled={wordSearchLoading} style={{...S.btnAdd,minWidth:"70px",opacity:wordSearchLoading?0.6:1}}>{wordSearchLoading?"...":"검색"}</button>
        </div>
        {wordSearchError&&<div style={{color:"#f07050",fontSize:"0.82rem",marginBottom:"10px",padding:"8px 12px",background:"rgba(200,60,60,0.1)",borderRadius:"10px"}}>{wordSearchError}</div>}
        {wordSearchResults.length>0&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
              <span style={{fontSize:"0.78rem",color:"#5a5870"}}>{wordSearchResults.length}개 결과</span>
              <div style={{display:"flex",gap:"6px"}}>
                <button onClick={()=>setWordSearchSelected(s=>s.size===wordSearchResults.length?new Set():new Set(wordSearchResults.map((_,i)=>i)))} style={S.scrollBtn}>{wordSearchSelected.size===wordSearchResults.length?"해제":"전체"}</button>
                {wordSearchSelected.size>0&&<button onClick={addWordSearchSelected} style={{...S.btnMerge,padding:"5px 12px",fontSize:"0.8rem"}}>✅ {wordSearchSelected.size}개 추가</button>}
              </div>
            </div>
            <div style={{maxHeight:"300px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"5px"}}>
              {wordSearchResults.map((r,i)=>{
                const sel=wordSearchSelected.has(i),exists=!!words.find(w=>stripNikkud(w.hebrew||"")===stripNikkud(r.hebrew||"")&&w.meaning===r.meaning);
                return(<div key={i} onClick={()=>{if(exists)return;setWordSearchSelected(s=>{const n=new Set(s);n.has(i)?n.delete(i):n.add(i);return n;});}} style={{display:"flex",gap:"8px",alignItems:"center",padding:"10px 12px",borderRadius:"12px",background:sel?"rgba(196,160,80,0.1)":"rgba(255,255,255,0.03)",border:`1px solid ${sel?"rgba(196,160,80,0.4)":"rgba(255,255,255,0.07)"}`,cursor:exists?"default":"pointer",opacity:exists?0.5:1}}>
                  <div style={{width:"18px",height:"18px",borderRadius:"6px",flexShrink:0,border:`2px solid ${sel?"#c4a050":"rgba(255,255,255,0.2)"}`,background:sel?"#c4a050":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>{sel&&<span style={{color:"#1a1820",fontSize:"0.65rem",fontWeight:700}}>✓</span>}</div>
                  <span style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.05rem",color:"#c4a050",minWidth:"80px"}}>{r.hebrew}</span>
                  <span style={{fontSize:"0.82rem",color:"#7a7890",flex:1}}>{r.meaning}</span>
                  {exists&&<span style={{fontSize:"0.65rem",color:"#50c898"}}>✓ 있음</span>}
                </div>);
              })}
            </div>
          </div>
        )}
        <div style={{marginTop:"14px"}}><button style={S.btnCancel2} onClick={()=>{setShowWordSearchModal(false);setWordSearchResults([]);setWordSearchInput("");}}>닫기</button></div>
      </ModalWrap>

      {/* ── 어근 검색 모달 */}
      <ModalWrap show={showRootModal} onClose={()=>{setShowRootModal(false);setRootSearchResults([]);setRootSearchInput("");}} maxW="480px">
        <h3 style={S.modalTitle}>🌿 어근으로 단어 검색</h3>
        <p style={S.modalSub}>히브리어 어근을 입력하면 파생 단어를 가져와요. 예: ד-ב-ר</p>
        <div style={{display:"flex",gap:"8px",marginBottom:"10px"}}>
          <input style={{...S.input,flex:1,direction:"rtl",fontFamily:"Arial",fontSize:"1.1rem"}} placeholder="ד-ב-ר" value={rootSearchInput} onChange={e=>setRootSearchInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchByRoot()}/>
          <button onClick={searchByRoot} disabled={rootSearchLoading} style={{...S.btnAdd,minWidth:"70px",opacity:rootSearchLoading?0.6:1}}>{rootSearchLoading?"...":"검색"}</button>
        </div>
        {rootSearchError&&<div style={{color:"#f07050",fontSize:"0.82rem",marginBottom:"8px",padding:"8px 12px",background:"rgba(200,60,60,0.1)",borderRadius:"10px"}}>{rootSearchError}</div>}
        {rootSearchResults.length>0&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
              <span style={{fontSize:"0.78rem",color:"#5a5870"}}>{rootSearchResults.length}개</span>
              <div style={{display:"flex",gap:"6px"}}>
                <button onClick={()=>setRootSelected(s=>s.size===rootSearchResults.length?new Set():new Set(rootSearchResults.map((_,i)=>i)))} style={S.scrollBtn}>{rootSelected.size===rootSearchResults.length?"해제":"전체"}</button>
                {rootSelected.size>0&&<button onClick={addRootSelected} style={{...S.btnMerge,padding:"5px 12px",fontSize:"0.8rem"}}>✅ {rootSelected.size}개 추가</button>}
              </div>
            </div>
            <div style={{maxHeight:"280px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"5px"}}>
              {rootSearchResults.map((r,i)=>{
                const sel=rootSelected.has(i),added=!!words.find(w=>stripNikkud(w.hebrew)===stripNikkud(r.hebrew));
                return(<div key={i} onClick={()=>{if(added)return;setRootSelected(s=>{const n=new Set(s);n.has(i)?n.delete(i):n.add(i);return n;});}} style={{display:"flex",gap:"8px",alignItems:"center",padding:"10px 12px",borderRadius:"12px",background:sel?"rgba(196,160,80,0.1)":"rgba(255,255,255,0.03)",border:`1px solid ${sel?"rgba(196,160,80,0.4)":"rgba(255,255,255,0.07)"}`,cursor:added?"default":"pointer",opacity:added?0.5:1}}>
                  <div style={{width:"18px",height:"18px",borderRadius:"6px",flexShrink:0,border:`2px solid ${sel?"#c4a050":"rgba(255,255,255,0.2)"}`,background:sel?"#c4a050":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>{sel&&<span style={{color:"#1a1820",fontSize:"0.65rem",fontWeight:700}}>✓</span>}</div>
                  <span style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.05rem",color:"#c4a050",minWidth:"70px"}}>{r.hebrew}</span>
                  <span style={{fontSize:"0.78rem",color:"#7a7890",flex:1}}>{r.meaning}</span>
                  {added&&<span style={{fontSize:"0.65rem",color:"#50c898"}}>✓ 있음</span>}
                </div>);
              })}
            </div>
          </div>
        )}
        <div style={{marginTop:"14px"}}><button style={S.btnCancel2} onClick={()=>{setShowRootModal(false);setRootSearchResults([]);setRootSearchInput("");}}>닫기</button></div>
      </ModalWrap>

      {/* ── Reverso 동사 변형 모달 */}
      <ModalWrap show={showPealimModal} onClose={()=>{setShowPealimModal(false);setPealimRoot("");setPealimPreview(null);setPealimError("");}} maxW="500px">
        <h3 style={S.modalTitle}>🔍 Reverso 동사 변형 불러오기</h3>
        <p style={S.modalSub}>히브리어 동사 원형(to부정사)을 입력하면 변형표를 가져와요</p>
        <div style={{display:"flex",gap:"8px",marginBottom:"12px"}}>
          <input style={{...S.input,flex:1,direction:"rtl",fontFamily:"Arial",fontSize:"1.1rem"}} placeholder="לָשִׁיר, לְדַבֵּר ..." value={pealimRoot} onChange={e=>setPealimRoot(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchPealim()} lang="he" spellCheck={false} autoCorrect="off"/>
          <button onClick={searchPealim} disabled={pealimLoading} style={{...S.btnAdd,minWidth:"70px",opacity:pealimLoading?0.6:1}}>{pealimLoading?"검색 중...":"검색"}</button>
        </div>
        <div style={{display:"flex",gap:"5px",flexWrap:"wrap",marginBottom:"12px"}}>
          {[["לְדַבֵּר","말하다"],["לָלֶכֶת","가다"],["לֶאֱכֹל","먹다"],["לִכְתּוֹב","쓰다"],["לָשִׁיר","노래하다"]].map(([v,h])=>(<button key={v} onClick={()=>setPealimRoot(v)} style={{padding:"5px 11px",borderRadius:"10px",background:"rgba(196,160,80,0.1)",border:"1px solid rgba(196,160,80,0.25)",color:"#c4a050",fontSize:"0.78rem",cursor:"pointer",fontFamily:"Arial",direction:"rtl"}}>{v} <span style={{color:"#5a5870",direction:"ltr"}}>{h}</span></button>))}
        </div>
        {pealimError&&<div style={{padding:"10px 14px",background:"rgba(200,60,60,0.1)",border:"1px solid rgba(200,60,60,0.25)",borderRadius:"10px",color:"#f07050",fontSize:"0.85rem",marginBottom:"10px"}}>{pealimError}</div>}
        {pealimPreview&&(
          <div>
            <div style={{background:"rgba(80,160,120,0.08)",border:"1px solid rgba(80,160,120,0.2)",borderRadius:"14px",padding:"16px",marginBottom:"14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px",flexWrap:"wrap"}}>
                <span style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.5rem",color:"#50c898",fontWeight:700}}>{pealimPreview.infinitive}</span>
                <span style={{fontSize:"0.72rem",background:"rgba(80,160,120,0.2)",padding:"3px 10px",borderRadius:"8px",color:"#50c898"}}>{Object.keys(pealimPreview.variants||{}).length}개 변형</span>
              </div>
              <input value={pealimPreview.meaning||""} onChange={e=>setPealimPreview(p=>({...p,meaning:e.target.value}))} style={{...S.input,marginBottom:"10px"}} placeholder="뜻 입력 (한국어/영어) *필수"/>
              <div style={{maxHeight:"200px",overflowY:"auto",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:"4px"}}>
                {Object.entries(pealimPreview.variants||{}).filter(([,f])=>f).map(([tid,form])=>{const vt=VARIANT_TYPES.find(t=>t.id===tid);return(<div key={tid} onClick={()=>speakOnDemand(form)} style={{padding:"6px 8px",background:"rgba(255,255,255,0.05)",borderRadius:"8px",cursor:"pointer",textAlign:"center"}}><div style={{fontSize:"0.6rem",color:"#7a7890",marginBottom:"3px"}}>{vt?.label[ko?"ko":"en"]||tid}</div><div style={{fontFamily:"Arial",direction:"rtl",color:"#f0ece0",fontSize:"0.9rem",fontWeight:600}}>{form}</div></div>);})}
              </div>
            </div>
            <button onClick={addFromPealim} style={{...S.btnStart}}>✅ 단어장에 추가</button>
            <button onClick={()=>setPealimPreview(null)} style={{...S.btnCancel2,marginTop:"8px",textAlign:"center"}}>← 다시 검색</button>
          </div>
        )}
        <div style={{marginTop:"14px"}}><button style={S.btnCancel2} onClick={()=>{setShowPealimModal(false);setPealimRoot("");setPealimPreview(null);setPealimError("");}}>닫기</button></div>
      </ModalWrap>

      {/* ── 변형 편집 모달 */}
      {expandedVariantWord&&!String(expandedVariantWord).startsWith("menu_")&&(()=>{
        const ew=words.find(w=>w.id===expandedVariantWord);if(!ew) return null;
        return(
          <div style={{...S.modalOverlay,alignItems:"flex-start",paddingTop:"20px",overflowY:"auto"}}>
            <div style={{...S.modal,maxWidth:"580px",maxHeight:"90vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
              <div style={{marginBottom:"16px"}}>
                <h3 style={{...S.modalTitle,marginBottom:"6px"}}>🔀 변형 편집</h3>
                <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                  <span style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.3rem",color:"#c4a050"}}>{ew.hebrew}</span>
                  <button onClick={()=>speakOnDemand(ew.hebrew)} style={{background:"rgba(196,160,80,0.1)",border:"1px solid rgba(196,160,80,0.3)",borderRadius:"8px",padding:"3px 8px",cursor:"pointer",fontSize:"0.9rem"}}>🔈</button>
                  <span style={{fontSize:"0.78rem",color:"#7a7890"}}>{ew.meaning}</span>
                </div>
              </div>
              <div style={{display:"flex",gap:"4px",marginBottom:"14px",background:"rgba(255,255,255,0.05)",borderRadius:"12px",padding:"4px"}}>
                <button onClick={()=>setVariantPasteMode(false)} style={{flex:1,padding:"8px",borderRadius:"8px",border:"none",cursor:"pointer",fontWeight:!variantPasteMode?600:400,background:!variantPasteMode?"rgba(196,160,80,0.2)":"transparent",color:!variantPasteMode?"#c4a050":"#5a5870",fontSize:"0.82rem"}}>✏️ 개별 입력</button>
                <button onClick={()=>setVariantPasteMode(true)} style={{flex:1,padding:"8px",borderRadius:"8px",border:"none",cursor:"pointer",fontWeight:variantPasteMode?600:400,background:variantPasteMode?"rgba(80,160,120,0.2)":"transparent",color:variantPasteMode?"#50c898":"#5a5870",fontSize:"0.82rem"}}>📋 붙여넣기</button>
              </div>
              {variantPasteMode?(
                <div>
                  <div style={{background:"rgba(80,160,120,0.06)",border:"1px solid rgba(80,160,120,0.15)",borderRadius:"12px",padding:"12px",marginBottom:"10px"}}>
                    <div style={{fontSize:"0.72rem",color:"#50c898",fontWeight:600,marginBottom:"6px"}}>붙여넣기 순서 (줄바꿈으로 구분)</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"2px 12px"}}>
                      {getAllowedPasteOrder(ew.wordType).map((tid,idx)=>{const vt=VARIANT_TYPES.find(t=>t.id===tid);return(<div key={tid} style={{display:"flex",gap:"5px",alignItems:"center"}}><span style={{color:"#3a3848",fontSize:"0.62rem",minWidth:"18px"}}>{idx+1}.</span><span style={{color:"#7a7890",fontSize:"0.7rem"}}>{vt?.label.ko||tid}</span>{variantDraft[tid]&&<span style={{color:"#50c898",fontSize:"0.72rem"}}>✓</span>}</div>);})}
                    </div>
                  </div>
                  <textarea style={{width:"100%",minHeight:"120px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(80,160,120,0.3)",borderRadius:"12px",color:"#e8e6f0",padding:"12px",fontSize:"1rem",direction:"rtl",fontFamily:"Arial",resize:"vertical",outline:"none",lineHeight:1.8}} lang="he" spellCheck={false} autoCorrect="off" value={variantPasteText} onChange={e=>setVariantPasteText(e.target.value)} placeholder="여성형&#10;남성형&#10;..."/>
                  <button style={{...S.btnMerge,width:"100%",marginTop:"8px"}} onClick={()=>applyVariantPaste(variantPasteText)}>📋 자동 매핑 적용</button>
                </div>
              ):(
                <div>
                  <div style={{marginBottom:"12px"}}>
                    <div style={{fontSize:"0.72rem",color:"#5a5870",marginBottom:"6px"}}>품사 선택</div>
                    <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                      <button onClick={()=>setWords(ws=>ws.map(w=>w.id===ew.id?{...w,wordType:null}:w))} style={{...smallPillBtn(!ew.wordType)}}>⚪ 전체</button>
                      {WORD_TYPES.map(wt=>(<button key={wt.id} onClick={()=>setWords(ws=>ws.map(w=>w.id===ew.id?{...w,wordType:wt.id}:w))} style={smallPillBtn(ew.wordType===wt.id)}>{wt.emoji} {wt.label.ko}</button>))}
                    </div>
                  </div>
                  {getAllowedCats(ew.wordType).map(cat=>(
                    <div key={cat.id} style={{marginBottom:"16px"}}>
                      <div style={{fontSize:"0.68rem",fontWeight:700,color:cat.color,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:"8px",borderBottom:`1px solid ${cat.color}30`,paddingBottom:"4px"}}>{cat.label.ko}</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(195px,1fr))",gap:"6px"}}>
                        {cat.types.map(tid=>{const vt=VARIANT_TYPES.find(t=>t.id===tid);return(
                          <div key={tid}>
                            <label style={{fontSize:"0.67rem",color:"#7a7890",display:"flex",justifyContent:"space-between",marginBottom:"3px"}}>
                              <span>{vt?.label.ko||tid}</span>
                              <div style={{display:"flex",gap:"3px"}}>
                                {variantDraft[tid]&&<button onClick={()=>speakOnDemand(variantDraft[tid])} style={{fontSize:"0.6rem",padding:"1px 5px",borderRadius:"4px",background:"rgba(196,160,80,0.1)",border:"1px solid rgba(196,160,80,0.25)",color:"#c4a050",cursor:"pointer",lineHeight:1.4}}>🔈</button>}
                                {variantDraft[tid]&&<button onClick={()=>setVariantDraft(d=>({...d,[tid]:""}))} style={{fontSize:"0.6rem",padding:"1px 5px",borderRadius:"4px",background:"rgba(200,60,60,0.1)",border:"1px solid rgba(200,60,60,0.3)",color:"#f07050",cursor:"pointer",lineHeight:1.4}}>삭제</button>}
                              </div>
                            </label>
                            <input value={variantDraft[tid]||""} onChange={e=>setVariantDraft(d=>({...d,[tid]:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();const next=e.target.closest("div").parentElement.nextElementSibling?.querySelector("input");if(next)next.focus();}}} lang="he" spellCheck={false} autoCorrect="off" placeholder="히브리어..." style={{...S.input,padding:"8px 12px",fontSize:"1rem",direction:"rtl",fontFamily:"Arial",borderColor:variantDraft[tid]?`${cat.color}70`:"rgba(255,255,255,0.1)"}}/>
                          </div>
                        );})}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{display:"flex",gap:"8px",marginTop:"10px",position:"sticky",bottom:0,background:"#18162c",paddingTop:"12px"}}>
                {!variantPasteMode&&<button style={{...S.btnMerge,flex:1}} onClick={()=>saveVariantDraft(ew.id)}>✅ 저장 ({Object.values(variantDraft).filter(v=>v.trim()).length}개)</button>}
                <button style={S.btnCancel2} onClick={()=>{setExpandedVariantWord(null);setVariantPasteMode(false);setVariantPasteText("");}}>취소</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══════════════ MAIN CONTENT ══════════════ */}
      <div style={S.container}>

        {/* ── 헤더 */}
        <header style={S.header}>
          <div style={S.headerLeft}>
            <div style={{...S.logo,fontSize:"0.9rem"}}>אב</div>
            <div>
              <h1 style={S.title}>히브리어 단어 퀴즈</h1>
              <p style={S.subtitle}>{words.length}개 단어 · {masteredCount}개 암기완료</p>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"6px"}}>
            <div style={S.statsRow}>
              <div style={{...S.statBadge,color:"#60c880",background:"rgba(60,180,100,0.1)",border:"1px solid rgba(60,180,100,0.25)"}}>✅ {masteredCount}</div>
              <div style={{...S.statBadge,color:"#f07050",background:"rgba(200,80,60,0.1)",border:"1px solid rgba(200,80,60,0.25)"}}>🔥 {hardCount}</div>
              <div style={{...S.statBadge,color:"#9090b8",background:"rgba(120,120,180,0.1)",border:"1px solid rgba(120,120,180,0.25)"}}>📖 {learningCount}</div>
            </div>
            {user?(
              <div style={{display:"flex",alignItems:"center",gap:"5px"}}>
                <img src={user.photoURL} alt="" style={{width:"24px",height:"24px",borderRadius:"50%",border:"2px solid rgba(196,160,80,0.4)"}}/>
                <button onClick={()=>setShowWalletModal(true)} style={{fontSize:"0.78rem",padding:"5px 12px",borderRadius:"10px",background:"rgba(196,160,80,0.1)",border:"1px solid rgba(196,160,80,0.3)",color:"#c4a050",cursor:"pointer",fontWeight:600}}>📚 {wallets.length>0?`${wallets.length}개`:"+"}</button>
                <button onClick={()=>{const nl=uiLang==="ko"?"en":"ko";setUiLang(nl);lsSet("uiLang",nl);}} style={{fontSize:"0.65rem",padding:"4px 9px",borderRadius:"8px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",color:"#c4a050",cursor:"pointer",fontWeight:700}}>{uiLang==="ko"?"EN":"KO"}</button>
                <button onClick={signOutUser} style={{fontSize:"0.65rem",padding:"4px 9px",borderRadius:"8px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"#5a5870",cursor:"pointer"}}>로그아웃</button>
                {syncing&&<span style={{fontSize:"0.6rem",color:"#5a5870"}}>💾</span>}
              </div>
            ):(
              <div style={{display:"flex",gap:"5px",alignItems:"center"}}>
                <button onClick={()=>setShowWalletModal(true)} style={{fontSize:"0.78rem",padding:"5px 10px",borderRadius:"10px",background:"rgba(196,160,80,0.07)",border:"1px solid rgba(196,160,80,0.2)",color:"#c4a050",cursor:"pointer"}}>📚</button>
                <button onClick={signInGoogle} style={{fontSize:"0.78rem",padding:"6px 14px",borderRadius:"10px",background:"linear-gradient(135deg,#c4a050,#e8c875)",border:"none",color:"#1a1620",fontWeight:700,cursor:"pointer"}}>Google 로그인</button>
                <button onClick={()=>{const nl=uiLang==="ko"?"en":"ko";setUiLang(nl);lsSet("uiLang",nl);}} style={{fontSize:"0.65rem",padding:"4px 9px",borderRadius:"8px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",color:"#c4a050",cursor:"pointer",fontWeight:700}}>{uiLang==="ko"?"EN":"KO"}</button>
              </div>
            )}
          </div>
        </header>

        {/* 자동저장 배너 */}
        <div style={S.autoSaveBanner}>{user?`☁️ ${user.displayName}의 단어장 — 모든 기기에서 자동 동기화`:"💾 이 기기에만 저장돼요. Google 로그인하면 모든 기기에서 동기화!"}</div>

        {/* ── 단어장 탭 — 캘린더 Day/Week/Month 스타일 */}
        <div style={{display:"flex",gap:"4px",marginBottom:"16px",background:"rgba(255,255,255,0.06)",borderRadius:"14px",padding:"4px"}}>
          {BOOKS.map(b=>(<button key={b.id} onClick={()=>switchBook(b.id)} style={{flex:1,padding:"9px 12px",borderRadius:"10px",border:"none",cursor:"pointer",fontSize:"0.85rem",fontWeight:currentBook===b.id?700:400,background:currentBook===b.id?"rgba(255,255,255,0.12)":"transparent",color:currentBook===b.id?"#ffffff":"#5a5870",transition:"all 0.15s"}}>{b.emoji} {b.label.ko}</button>))}
        </div>

        {/* 플로팅 버튼 */}
        {mode===MODES.LIST&&<>
          <button onClick={()=>window.scrollTo({top:0,behavior:"smooth"})} style={S.floatBtn}>↑</button>
          <button onClick={()=>window.scrollTo({top:document.body.scrollHeight,behavior:"smooth"})} style={{...S.floatBtn,bottom:"70px"}}>↓</button>
        </>}

        {/* ══ LIST MODE ══ */}
        {mode===MODES.LIST&&(
          <div>
            {/* 단어 추가 */}
            <div style={S.card}>
              <SectionHeader sectionKey="add" title={editId!==null?"✏️ 단어 수정":"➕ 단어 추가"} badge={editId!==null?"수정 중":null}/>
              {openSections.add&&<div style={{...S.formRow,marginTop:"14px"}}>
                <input style={{...S.input,direction:bookInfo.dir,fontFamily:"Arial,sans-serif",fontSize:"1.1rem"}} placeholder={bookInfo.pA.ko} value={newHebrew} onChange={e=>setNewHebrew(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addWord()}/>
                <input style={S.input} placeholder={bookInfo.pB.ko} value={newMeaning} onChange={e=>setNewMeaning(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addWord()}/>
                {currentBook==="hebrew"&&(<div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                  {WORD_TYPES.map(wt=>(<button key={wt.id} onClick={()=>setNewWordType(t=>t===wt.id?null:wt.id)} style={{...smallPillBtn(newWordType===wt.id)}}>{wt.emoji} {wt.label.ko}</button>))}
                </div>)}
                {wallets.length>0&&editId===null&&(<div>
                  <div style={{fontSize:"0.72rem",color:"#5a5870",marginBottom:"6px"}}>단어장 선택 (선택사항)</div>
                  <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                    {wallets.map(wl=>{const sel=newWordWallets.has(wl.id);return(<button key={wl.id} onClick={()=>setNewWordWallets(s=>{const n=new Set(s);sel?n.delete(wl.id):n.add(wl.id);return n;})} style={{...smallPillBtn(sel),display:"flex",alignItems:"center",gap:"5px"}}><span style={{width:"7px",height:"7px",borderRadius:"50%",background:wl.color,display:"inline-block"}}/>{wl.name}{sel?" ✓":""}</button>);})}
                  </div>
                </div>)}
                <div style={{display:"flex",gap:"8px"}}>
                  <button style={{...S.btnAdd,flex:1}} onClick={addWord}>{editId!==null?"수정 완료":"추가"}</button>
                  {newHebrew&&<SpeakBtn text={newHebrew} onSpeak={speakOnDemand} muted={muted}/>}
                  {editId!==null&&<button style={S.btnCancel} onClick={cancelEdit}>취소</button>}
                </div>
              </div>}
            </div>

            {/* 저장/불러오기 */}
            <div style={S.ioCard}>
              <SectionHeader sectionKey="io" title="💾 저장 / 불러오기" color="#a0a0c0"/>
              {openSections.io&&<div style={{marginTop:"12px"}}>
                <p style={S.ioSub}>텔레그램 등 파일 저장이 안 되면 📋 복사 사용</p>
                <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                  <button style={S.btnIO("#c4a050","rgba(196,160,80,0.1)","rgba(196,160,80,0.3)")} onClick={exportWords}>⬇️ 파일 저장</button>
                  <button style={S.btnIO("#c4a050","rgba(196,160,80,0.08)","rgba(196,160,80,0.2)")} onClick={copyToClipboard}>📋 복사</button>
                  <button style={S.btnIO("#a0a0c0","rgba(255,255,255,0.05)","rgba(255,255,255,0.12)")} onClick={()=>fileInputRef.current.click()}>⬆️ 파일 열기</button>
                  <button style={S.btnIO("#c0b0ff","rgba(100,80,200,0.12)","rgba(100,80,200,0.3)")} onClick={()=>setShowPasteModal(true)}>📋 붙여넣기</button>
                  <button style={S.btnIO("#60c880","rgba(60,180,100,0.12)","rgba(60,180,100,0.3)")} onClick={()=>setShowBatchModal(true)}>📝 텍스트</button>
                  <button style={S.btnIO("#80a0e0","rgba(60,120,200,0.12)","rgba(60,120,200,0.3)")} onClick={()=>csvInputRef.current.click()}>📊 CSV/엑셀</button>
                  <input ref={fileInputRef} type="file" accept=".json" style={{display:"none"}} onChange={handleFileChange}/>
                  <input ref={csvInputRef} type="file" accept=".xlsx,.xls,.csv,.tsv,.txt" style={{display:"none"}} onChange={handleCSVChange}/>
                </div>
              </div>}
            </div>

            {/* 가져오기 (히브리어만) */}
            {currentBook==="hebrew"&&<div style={{...S.ioCard,borderColor:"rgba(80,160,120,0.2)"}}>
              <SectionHeader sectionKey="import" title="📥 단어 가져오기" color="#50c898"/>
              {openSections.import&&<div style={{marginTop:"12px"}}>
                <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"12px"}}>
                  <button style={S.btnIO("#c4a050","rgba(196,160,80,0.1)","rgba(196,160,80,0.3)")} onClick={()=>setShowWordSearchModal(true)}>🔎 뜻으로 검색</button>
                  <button style={S.btnIO("#50c898","rgba(80,160,120,0.12)","rgba(80,160,120,0.3)")} onClick={()=>setShowPealimModal(true)}>🔍 Reverso 동사 변형</button>
                  <button style={S.btnIO("#c4a050","rgba(196,160,80,0.1)","rgba(196,160,80,0.3)")} onClick={()=>setShowRootModal(true)}>🌿 어근 검색</button>
                  <button style={S.btnIO("#9060f0","rgba(100,80,200,0.12)","rgba(100,80,200,0.3)")} onClick={()=>variantFileRef.current.click()}>📥 변형 엑셀</button>
                  <button style={{...S.btnIO("#50c898","rgba(80,160,120,0.12)","rgba(80,160,120,0.3)"),opacity:refreshingVariants?0.6:1}} onClick={refreshAllVariants} disabled={refreshingVariants}>{refreshingVariants?"🔄 업데이트 중...":"🔄 변형 다시 불러오기"}</button>
                  <input ref={variantFileRef} type="file" accept=".xlsx,.xls" style={{display:"none"}} onChange={handleVariantExcel}/>
                  <input ref={verbFormFileRef} type="file" accept=".xlsx,.xls" style={{display:"none"}}/>
                </div>
                {refreshLog.length>0&&<div>
                  <button onClick={()=>setShowRefreshLog(v=>!v)} style={{...S.scrollBtn,width:"100%",marginBottom:"5px"}}>
                    {showRefreshLog?"▲ 숨기기":"▼ 결과 보기"} ({refreshLog.filter(l=>l.status==="ok").length}개 성공 / {refreshLog.filter(l=>l.status==="fail").length}개 실패)
                  </button>
                  {showRefreshLog&&<div style={{maxHeight:"180px",overflowY:"auto",display:"flex",flexDirection:"column",gap:"3px"}}>
                    {refreshLog.map((l,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:"8px",padding:"6px 12px",borderRadius:"10px",background:l.status==="ok"?"rgba(80,160,120,0.08)":"rgba(200,60,60,0.06)"}}>
                      <span>{l.status==="ok"?"✅":"❌"}</span>
                      <span style={{fontFamily:"Arial",direction:"rtl",color:"#c4a050",fontSize:"0.88rem",minWidth:"70px"}}>{l.hebrew}</span>
                      <span style={{color:"#7a7890",fontSize:"0.75rem",flex:1}}>{l.meaning}</span>
                      {l.status==="ok"?<span style={{fontSize:"0.68rem",color:"#50c898"}}>변형 {l.variantCount}개</span>:<span style={{fontSize:"0.68rem",color:"#f07050"}}>{l.error}</span>}
                    </div>))}
                  </div>}
                </div>}
              </div>}
            </div>}

            {/* 검색 + 정렬 */}
            <div style={{display:"flex",gap:"8px",marginBottom:"12px",alignItems:"center",flexWrap:"wrap"}}>
              <input style={{...S.input,flex:1,minWidth:"160px",padding:"10px 16px"}} placeholder="히브리어 또는 뜻으로 검색..." value={searchQuery} onChange={e=>{setSearchQuery(e.target.value);setPage(0);}}/>
              <select value={sortBy} onChange={e=>{setSortBy(e.target.value);lsSet("sortBy",e.target.value);setPage(0);}} style={{padding:"10px 12px",borderRadius:"12px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",color:"#c4a050",fontSize:"0.78rem",cursor:"pointer",outline:"none"}}>
                <option value="default">기본순</option>
                <option value="hebrew_asc">히브리어 ↑</option>
                <option value="hebrew_desc">히브리어 ↓</option>
                <option value="meaning_asc">뜻 ↑</option>
                <option value="meaning_desc">뜻 ↓</option>
                <option value="hard_first">🔥 어려움 먼저</option>
                <option value="mastered_first">✅ 암기 먼저</option>
                <option value="wrong_desc">❌ 오답 많은 것 먼저</option>
              </select>
              <div style={{display:"flex",gap:"3px",background:"rgba(255,255,255,0.06)",borderRadius:"10px",padding:"3px"}}>
                {[10,20,9999].map(n=>(<button key={n} onClick={()=>{setPageSize(n);setPage(0);}} style={{padding:"6px 10px",borderRadius:"8px",fontSize:"0.78rem",c    ursor:"pointer",border:"none",background:pageSize===n?"rgba(255,255,255,0.12)":"transparent",color:pageSize===n?"#fff":"#5a5870",fontWeight:pageSize===n?600:400}}>{n===9999?"전체":`${n}개`}</button>))}
              </div>
            </div>

            {/* ── 필터 탭 — 캘린더 Day/Week/Month 스타일 ── */}
            <div style={S.filterTabs}>
              {[["all","전체",words.length],["learning","📖 학습중",learningCount],["hard","🔥 어려움",hardCount],["mastered","✅ 완료",masteredCount]].map(([val,label,cnt])=>(
                <button key={val} style={{...S.filterTab,...(listFilter===val&&!walletFilter?S.filterTabActive:{})}} onClick={()=>{setListFilter(val);lsSet("listFilter",val);setWalletFilter(null);setPage(0);setSelectedIds(new Set());}}>
                  {label}<span style={S.filterCnt}>{cnt}</span>
                </button>
              ))}
              {wallets.map(wl=>{const cnt=words.filter(w=>wl.wordIds.includes(w.id)).length,active=walletFilter===wl.id;return(
                <button key={wl.id} style={{...S.filterTab,...(active?{background:`${wl.color}20`,borderColor:`${wl.color}55`,color:wl.color,fontWeight:600}:{})}} onClick={()=>{setWalletFilter(active?null:wl.id);setPage(0);setSelectedIds(new Set());}}>
                  <span style={{width:"7px",height:"7px",borderRadius:"50%",background:active?wl.color:"rgba(255,255,255,0.25)",display:"inline-block",flexShrink:0}}/>{wl.name}<span style={S.filterCnt}>{cnt}</span>
                </button>
              );})}
            </div>

            {/* 단어 수 + 선택/삭제 */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px",flexWrap:"wrap",gap:"6px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
                <span style={{fontSize:"0.78rem",color:"#5a5870"}}>{searchedWords.length}개 단어</span>
                <button style={S.scrollBtn} onClick={()=>{if(selectedIds.size===filteredWords.length)setSelectedIds(new Set());else setSelectedIds(new Set(filteredWords.map(w=>w.id)));}}>
                  {selectedIds.size===filteredWords.length&&filteredWords.length>0?"선택 해제":"전체 선택"}
                </button>
                {selectedIds.size>0&&<button style={{...S.scrollBtn,background:"rgba(200,60,60,0.12)",borderColor:"rgba(200,60,60,0.3)",color:"#f08080"}} onClick={()=>{if(window.confirm(`선택한 ${selectedIds.size}개 삭제할까요?`)){setWords(ws=>ws.filter(w=>!selectedIds.has(w.id)));setSelectedIds(new Set());}}}>🗑️ {selectedIds.size}개 삭제</button>}
              </div>
              <div style={{display:"flex",gap:"4px"}}>
                {[["menu","메뉴"],["inline","인라인"]].map(([v,l])=>(<button key={v} onClick={()=>{setCardStyle(v);lsSet("cardStyle",v);}} style={{padding:"4px 10px",borderRadius:"8px",fontSize:"0.72rem",cursor:"pointer",border:"1px solid",background:cardStyle===v?"rgba(196,160,80,0.15)":"rgba(255,255,255,0.04)",borderColor:cardStyle===v?"rgba(196,160,80,0.4)":"rgba(255,255,255,0.1)",color:cardStyle===v?"#c4a050":"#5a5870"}}>{l}</button>))}
              </div>
            </div>

            {/* ── 단어 목록 — 캘린더 이벤트 스타일 ── */}
            <div style={S.wordList}>
              {filteredWords.length===0&&<div style={S.emptyMsg}>{searchQuery?"검색 결과가 없어요":"단어가 없어요"}</div>}
              {filteredWords.map((w,i)=>{
                const st=STATUS_CONFIG[w.status];
                const isFirst=i===0,isLast=i===filteredWords.length-1;
                const isMenuOpen=expandedVariantWord===`menu_${w.id}`;
                return(
                  <div key={w.id} style={{...S.wordItem(isFirst,isLast,w.status),...(selectedIds.has(w.id)?{background:"rgba(196,160,80,0.07)"}:{})}}>
                    <input type="checkbox" checked={selectedIds.has(w.id)} onChange={e=>{const s=new Set(selectedIds);e.target.checked?s.add(w.id):s.delete(w.id);setSelectedIds(s);}} style={{width:"16px",height:"16px",cursor:"pointer",accentColor:"#c4a050",flexShrink:0}}/>
                    <span style={{fontSize:"0.65rem",color:"#3a3858",minWidth:"18px",flexShrink:0,textAlign:"right"}}>{page*pageSize+i+1}</span>

                    {/* 단어 텍스트 */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:"5px",marginBottom:"2px",flexWrap:"wrap"}}>
                        <span style={{fontFamily:"Arial,sans-serif",fontSize:"1.1rem",color:"#f0ece0",direction:"rtl",fontWeight:500}}>{w.hebrew}</span>
                        {w.wordType&&(()=>{const wt=WORD_TYPES.find(t=>t.id===w.wordType);return wt?<span style={{fontSize:"0.6rem"}}>{wt.emoji}</span>:null;})()}
                        {w.root&&<span style={{fontSize:"0.6rem",background:"rgba(80,160,120,0.1)",border:"1px solid rgba(80,160,120,0.2)",borderRadius:"5px",padding:"1px 5px",color:"#50c898",fontFamily:"Arial",direction:"rtl"}}>{w.root}</span>}
                        {(w.variants||[]).length>0&&<span style={{fontSize:"0.6rem",color:"#50c898",background:"rgba(80,160,120,0.08)",borderRadius:"4px",padding:"1px 5px"}}>🔀{w.variants.length}</span>}
                      </div>
                      <span style={{fontSize:"0.82rem",color:"#7a7890",display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{w.meaning||<span style={{color:"#3a3848",fontStyle:"italic"}}>뜻 없음</span>}</span>

                      {/* 인라인 스타일 컨트롤 */}
                      {cardStyle==="inline"&&(<div style={{display:"flex",alignItems:"center",gap:"5px",marginTop:"7px",flexWrap:"wrap"}}>
                        <SpeakOnceBtn text={w.hebrew} onSpeak={speakOnDemand} muted={muted}/>
                        <StatusBadge status={w.status} size="sm"/>
                        {["hard","mastered","learning"].filter(s=>s!==w.status).map(s=>{const sc=STATUS_CONFIG[s];return<button key={s} onClick={()=>setManualStatus(w.id,s)} style={{padding:"3px 8px",borderRadius:"100px",border:`1px solid ${sc.border}`,background:sc.bg,color:sc.color,cursor:"pointer",fontSize:"0.65rem",fontWeight:600}}>{sc.emoji}</button>;})}
                        <button onClick={()=>startEdit(w)} style={{...S.btnEdit,padding:"3px 8px",fontSize:"0.72rem"}}>✏️</button>
                        <button onClick={()=>{openVariantModal(w);}} style={{...S.btnEdit,padding:"3px 8px",fontSize:"0.72rem"}}>🔀</button>
                        {wallets.length>0&&<button onClick={()=>setWalletPickWord(w.id)} style={{...S.btnEdit,padding:"3px 8px",fontSize:"0.72rem"}}>📚</button>}
                        <button onClick={()=>{if(window.confirm(walletFilter?"이 단어장에서 제거할까요?":"단어를 삭제할까요?"))deleteWord(w.id);}} style={{padding:"3px 8px",borderRadius:"8px",background:"rgba(200,60,60,0.1)",border:"1px solid rgba(200,60,60,0.25)",color:"#f07050",cursor:"pointer",fontSize:"0.72rem"}}>{walletFilter?"제거":"🗑️"}</button>
                      </div>)}
                    </div>

                    {/* 메뉴 스타일 오른쪽 컨트롤 */}
                    {cardStyle==="menu"&&(
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"5px",flexShrink:0}}>
                        <div style={{display:"flex",gap:"5px",alignItems:"center"}}>
                          <SpeakOnceBtn text={w.hebrew} onSpeak={speakOnDemand} muted={muted}/>
                          <button onClick={e=>{e.stopPropagation();setExpandedVariantWord(isMenuOpen?null:`menu_${w.id}`);}} style={{padding:"5px 10px",borderRadius:"10px",border:"1px solid rgba(255,255,255,0.1)",background:isMenuOpen?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:"0.88rem"}}>{isMenuOpen?"✕":"···"}</button>
                        </div>
                        {/* 드롭다운 메뉴 */}
                        {isMenuOpen&&(
                          <div onClick={e=>e.stopPropagation()} style={{background:"#1a1828",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"14px",padding:"10px",display:"flex",flexDirection:"column",gap:"7px",minWidth:"175px",boxShadow:"0 8px 30px rgba(0,0,0,0.6)",zIndex:10}}>
                            {/* 상태 선택 */}
                            <div style={{display:"flex",gap:"4px"}}>
                              {["learning","hard","mastered"].map(s=>{const sc=STATUS_CONFIG[s];return(
                                <button key={s} onClick={()=>{setManualStatus(w.id,s);setExpandedVariantWord(null);}} style={{flex:1,padding:"7px 3px",borderRadius:"9px",border:`1px solid ${w.status===s?sc.border:"rgba(255,255,255,0.07)"}`,background:w.status===s?sc.bg:"rgba(255,255,255,0.03)",color:w.status===s?sc.color:"rgba(255,255,255,0.35)",cursor:"pointer",fontSize:"0.9rem",textAlign:"center"}} title={sc.labelKo}>{sc.emoji}</button>
                              );})}
                            </div>
                            {/* 발음 횟수 */}
                            <div style={{display:"flex",gap:"4px",alignItems:"center"}}>
                              <span style={{fontSize:"0.62rem",color:"#5a5870",flexShrink:0}}>발음</span>
                              <SpeakOnceBtn text={w.hebrew} onSpeak={speakOnDemand} muted={muted} repeatN={w._repeatN||1}/>
                              <input type="number" min={1} max={20} value={w._repeatN||1} onClick={e=>e.stopPropagation()} onChange={e=>setWords(ws=>ws.map(x=>x.id===w.id?{...x,_repeatN:Math.max(1,Math.min(20,Number(e.target.value)||1))}:x))} style={{width:"36px",padding:"4px",borderRadius:"7px",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",color:"#e8e6f0",fontSize:"0.78rem",textAlign:"center",outline:"none"}}/>
                              <span style={{fontSize:"0.62rem",color:"#5a5870"}}>회</span>
                            </div>
                            {/* 편집 버튼 */}
                            <div style={{display:"flex",gap:"4px",borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:"7px"}}>
                              <button onClick={()=>{startEdit(w);setExpandedVariantWord(null);}} style={{flex:1,padding:"6px",borderRadius:"8px",background:"rgba(255,255,255,0.05)",border:"none",color:"rgba(255,255,255,0.55)",cursor:"pointer",fontSize:"0.72rem"}}>✏️ 편집</button>
                              <button onClick={()=>{openVariantModal(w);}} style={{flex:1,padding:"6px",borderRadius:"8px",background:"rgba(80,160,120,0.08)",border:"none",color:"#50c898",cursor:"pointer",fontSize:"0.72rem"}}>🔀 변형{(w.variants||[]).length>0?` ${w.variants.length}`:""}</button>
                              {wallets.length>0&&<button onClick={e=>{e.stopPropagation();setWalletPickWord(w.id);}} style={{flex:1,padding:"6px",borderRadius:"8px",background:"rgba(196,160,80,0.08)",border:"none",color:"#c4a050",cursor:"pointer",fontSize:"0.72rem"}}>📚</button>}
                              <button onClick={()=>{if(window.confirm(walletFilter?"이 단어장에서 제거할까요?":"단어를 삭제할까요?"))deleteWord(w.id);setExpandedVariantWord(null);}} style={{flex:1,padding:"6px",borderRadius:"8px",background:"rgba(200,60,60,0.1)",border:"none",color:"#f07050",cursor:"pointer",fontSize:"0.72rem"}}>{walletFilter?"제거":"🗑️"}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 페이지네이션 */}
            {pageSize!==9999&&totalPages>1&&(
              <div style={{display:"flex",justifyContent:"center",gap:"4px",marginBottom:"16px"}}>
                <button style={S.scrollBtn} onClick={()=>page>0&&setPage(p=>p-1)} disabled={page===0}>←</button>
                {Array.from({length:Math.min(totalPages,7)},(_,i)=>(<button key={i} style={{...S.scrollBtn,...(page===i?{background:"rgba(196,160,80,0.2)",borderColor:"rgba(196,160,80,0.4)",color:"#c4a050",fontWeight:700}:{})}} onClick={()=>setPage(i)}>{i+1}</button>))}
                <button style={S.scrollBtn} onClick={()=>page<totalPages-1&&setPage(p=>p+1)} disabled={page===totalPages-1}>→</button>
              </div>
            )}

            {/* ── 퀴즈 설정 섹션들 ── */}
            {/* 객관식 */}
            <div style={S.card}>
              <SectionHeader sectionKey="quiz_mcq" title="🎯 객관식 퀴즈" badge={`${poolSize}개 가능`}/>
              {openSections.quiz_mcq&&<div style={{marginTop:"14px"}}>
                <p style={S.settingLabel}>문제 방향</p>
                <div style={S.optionRow}>
                  {[[QT.HEB_TO_MEAN,`${bookInfo.termA.ko} → ${bookInfo.termB.ko}`],[QT.MEAN_TO_HEB,`${bookInfo.termB.ko} → ${bookInfo.termA.ko}`],[QT.MIXED,"랜덤 혼합"]].map(([v,l])=>(<button key={v} style={smallPillBtn(quizType===v)} onClick={()=>{setQuizType(v);lsSet("quizType",v);}}>{l}</button>))}
                </div>
                <p style={S.settingLabel}>단어 범위</p>
                <div style={S.optionRow}>
                  {[[QF.ALL,`전체 (${words.length})`],[QF.LEARNING_ONLY,`학습중 (${learningCount})`],[QF.EXCLUDE_MASTERED,`암기 제외 (${words.filter(w=>w.status!=="mastered").length})`],[QF.HARD_ONLY,`어려움 (${hardCount})`]].map(([v,l])=>(<button key={v} style={smallPillBtn(quizFilter===v)} onClick={()=>{setQuizFilter(v);lsSet("quizFilter",v);}}>{l}</button>))}
                </div>
                <p style={S.settingLabel}>문제 수</p>
                <div style={S.optionRow}>
                  {countOpts.map(({label,value})=>(<button key={value} style={{...smallPillBtn(quizCount===value),opacity:(value!==9999&&value>poolSize)?0.3:1}} onClick={()=>{if(value!==9999&&value>poolSize)return;setQuizCount(value);lsSet("quizCount",value);}} disabled={value!==9999&&value>poolSize}>{label}</button>))}
                </div>
                <p style={S.settingLabel}>발음</p>
                <div style={{...S.optionRow,marginBottom:"16px"}}>
                  {[["auto","자동 (히브리어 표시 시)"],["manual","수동만"],["mute","음소거"]].map(([v,l])=>(<button key={v} style={smallPillBtn(soundMode===v)} onClick={()=>setSoundMode(v)}>{l}</button>))}
                </div>
                <button style={{...S.btnStart,...(poolSize<4?S.btnDisabled:{})}} onClick={startQuiz} disabled={poolSize<4}>
                  {poolSize<4?`단어 최소 4개 필요 (현재 ${poolSize}개)`:`🚀 객관식 시작! (${quizCount===9999?poolSize:Math.min(quizCount,poolSize)}문제)`}
                </button>
              </div>}
            </div>

            {/* 서술형 */}
            <div style={S.card}>
              <SectionHeader sectionKey="quiz_essay" title="✍️ 서술형 시험" badge={`${essayPoolSize}개 가능`}/>
              {openSections.quiz_essay&&<div style={{marginTop:"14px"}}>
                <p style={{fontSize:"0.82rem",color:"#5a5870",marginBottom:"12px"}}>직접 타이핑해서 답하는 서술형! 부분 정답도 인정됩니다.</p>
                <p style={S.settingLabel}>문제 방향</p>
                <div style={S.optionRow}>
                  {[["heb_to_mean","히브리어 → 뜻 입력"],["mean_to_heb","뜻 → 히브리어 입력"],["mixed","랜덤 혼합"]].map(([v,l])=>(<button key={v} style={smallPillBtn(essayType===v)} onClick={()=>{setEssayType(v);lsSet("essayType",v);}}>{l}</button>))}
                </div>
                <p style={S.settingLabel}>단어 범위</p>
                <div style={S.optionRow}>
                  {[[QF.ALL,`전체 (${words.length})`],[QF.EXCLUDE_MASTERED,`암기 제외 (${words.filter(w=>w.status!=="mastered").length})`],[QF.HARD_ONLY,`어려움 (${hardCount})`]].map(([v,l])=>(<button key={v} style={smallPillBtn(essayFilter===v)} onClick={()=>{setEssayFilter(v);lsSet("essayFilter",v);}}>{l}</button>))}
                </div>
                <p style={S.settingLabel}>문제 수</p>
                <div style={{...S.optionRow,marginBottom:"16px"}}>
                  {countOpts.map(({label,value})=>(<button key={value} style={{...smallPillBtn(essayCount===value),opacity:(value!==9999&&value>essayPoolSize)?0.3:1}} onClick={()=>{if(value!==9999&&value>essayPoolSize)return;setEssayCount(value);lsSet("essayCount",value);}} disabled={value!==9999&&value>essayPoolSize}>{label}</button>))}
                </div>
                <button style={{...S.btnStart,...(!essayPoolSize?S.btnDisabled:{})}} onClick={startEssay} disabled={!essayPoolSize}>
                  ✍️ 서술형 시작! ({essayCount===9999?essayPoolSize:Math.min(essayCount,essayPoolSize)}문제)
                </button>
              </div>}
            </div>

            {/* 변형 퀴즈 (히브리어만) */}
            {currentBook==="hebrew"&&<div style={S.card}>
              <SectionHeader sectionKey="quiz_variant" title="🔀 변형 퀴즈" badge={`${variantPoolSize}개 가능`}/>
              {openSections.quiz_variant&&<div style={{marginTop:"14px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                  <p style={{...S.settingLabel,margin:0}}>변형 유형 선택</p>
                  <button onClick={()=>{const next=variantCats.length===VARIANT_CATS.length?[]:VARIANT_CATS.map(c=>c.id);setVariantCats(next);lsSet("variantCats",next);}} style={S.scrollBtn}>{variantCats.length===VARIANT_CATS.length?"전체 해제":"전체 선택"}</button>
                </div>
                <div style={S.optionRow}>
                  {VARIANT_CATS.map(cat=>(<button key={cat.id} style={smallPillBtn(variantCats.includes(cat.id),cat.color)} onClick={()=>{const next=variantCats.includes(cat.id)?variantCats.filter(x=>x!==cat.id):[...variantCats,cat.id];setVariantCats(next);lsSet("variantCats",next);}}>{cat.label.ko}</button>))}
                </div>
                <p style={S.settingLabel}>단어 범위 <span style={{color:"#3a3848",textTransform:"none",letterSpacing:0,fontWeight:400}}>(변형 있는 단어만)</span></p>
                <div style={S.optionRow}>
                  {[QF.ALL,QF.LEARNING_ONLY,QF.EXCLUDE_MASTERED,QF.HARD_ONLY].map(v=>{const st=new Set(VARIANT_CATS.filter(c=>variantCats.includes(c.id)).flatMap(c=>c.types));const pool=getPool(v).filter(w=>(w.variants||[]).some(vv=>st.has(vv.type)));const cnt=pool.flatMap(w=>(w.variants||[]).filter(vv=>st.has(vv.type))).length;const labels={[QF.ALL]:"전체",[QF.LEARNING_ONLY]:"학습중",[QF.EXCLUDE_MASTERED]:"암기 제외",[QF.HARD_ONLY]:"어려움"};return(<button key={v} style={smallPillBtn(variantFilter===v)} onClick={()=>{setVariantFilter(v);lsSet("variantFilter",v);}}>{labels[v]} ({cnt})</button>);})}
                </div>
                <div style={{...S.optionRow,marginBottom:"8px"}}>
                  {[["essay","서술형"],["mcq","객관식"]].map(([v,l])=>(<button key={v} style={{...smallPillBtn(variantQuizType===v),flex:1,padding:"10px",textAlign:"center"}} onClick={()=>setVariantQuizType(v)}>{l}</button>))}
                </div>
                <button style={{...S.btnStart,...(!variantPoolSize||!variantCats.length?S.btnDisabled:{})}} onClick={startVariantQuiz} disabled={!variantPoolSize||!variantCats.length}>
                  🔀 변형 퀴즈 시작! ({Math.min(variantCount===9999?variantPoolSize:variantCount,variantPoolSize)}문제)
                </button>
              </div>}
            </div>}
          </div>
        )}

        {/* ══ QUIZ MODE ══ */}
        {mode===MODES.QUIZ&&q&&(
          <div key={animKey}>
            <div style={S.progressBar}><div style={{...S.progressFill,width:`${((current+(confirmed?1:0))/questions.length)*100}%`}}/></div>
            <div style={S.progressLabel}><span style={{fontWeight:600}}>{current+1} / {questions.length}</span><span style={{color:"#c4a050",fontWeight:600}}>{score} 정답</span></div>
            <div style={S.questionCard}>
              <div style={S.questionTag}>{q.questionType===QT.HEB_TO_MEAN?`${bookInfo.termA.ko}의 ${bookInfo.termB.ko}는?`:`${bookInfo.termB.ko}에 해당하는 ${bookInfo.termA.ko}는?`}</div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"14px"}}>
                <div style={{...S.questionText,...(q.questionType===QT.HEB_TO_MEAN?{fontFamily:"Arial,sans-serif",fontSize:"clamp(2rem,8vw,3rem)",direction:"rtl",fontWeight:700}:{fontSize:"clamp(1.1rem,4vw,1.6rem)",fontWeight:600})}}>{q.question}</div>
                <div style={{display:"flex",gap:"8px",alignItems:"center",flexWrap:"wrap",justifyContent:"center"}}>
                  {q.questionType===QT.HEB_TO_MEAN?<RepeatSpeakBtn text={q.question} onSpeak={speakOnDemand} muted={muted}/>:confirmed?<><RepeatSpeakBtn text={q.answer} onSpeak={speakOnDemand} muted={muted}/><span style={{fontSize:"0.75rem",color:"#5a5870"}}>정답 발음</span></>:null}
                </div>
              </div>
              {(()=>{const w=words.find(x=>x.id===q.wordId);const st=w?STATUS_CONFIG[w.status]:null;return st?<div style={{marginTop:"12px"}}><StatusBadge status={w.status}/></div>:null;})()}
            </div>
            <div className="choices-grid" style={S.choicesGrid}>
              {q.choices.map((choice,idx)=>{
                let extra={};
                if(confirmed){if(choice===q.answer)extra=S.choiceCorrect;else if(choice===selected)extra=S.choiceWrong;}else if(choice===selected)extra=S.choiceSelected;
                return(
                  <button key={idx} style={{...S.choiceBtn,...extra}} onClick={()=>!confirmed&&setSelected(choice)}>
                    <span style={{...S.choiceAlpha,...(confirmed&&choice===q.answer?{background:"rgba(60,180,100,0.2)",color:"#60c880"}:{})}}>{["A","B","C","D"][idx]}</span>
                    <span style={q.questionType===QT.MEAN_TO_HEB?{fontFamily:"Arial,sans-serif",fontSize:"1.15rem",direction:"rtl",fontWeight:600}:{}}>{choice}</span>
                    {q.questionType===QT.MEAN_TO_HEB&&<span style={{marginLeft:"auto",opacity:0.5,fontSize:"0.9rem"}} onClick={e=>{e.stopPropagation();speakOnDemand(choice);}}>🔈</span>}
                  </button>
                );
              })}
            </div>
            {confirmed&&(
              <div style={{marginBottom:"14px"}}>
                <div style={{...(selected===q.answer?S.feedbackCorrect:S.feedbackWrong),marginBottom:"10px"}}>
                  {selected===q.answer?"✅ 정답!":"❌ 오답 — 정답: "+q.answer}
                </div>
                <StatusButtons wordId={q.wordId}/>
              </div>
            )}
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
              {!confirmed?(<button style={{...S.btnStart,opacity:selected?1:0.4}} onClick={handleConfirm} disabled={!selected}>확인</button>):(
                <>
                  <button style={{...S.btnStart,flex:1}} onClick={handleNext}>{current+1<questions.length?"다음 문제 →":"결과 보기 🏁"}</button>
                  <button style={S.btnCancel} onClick={()=>setMode(MODES.LIST)}>그만하기</button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ══ ESSAY MODE ══ */}
        {mode===MODES.ESSAY&&eq&&(
          <div key={animKey}>
            <div style={S.progressBar}><div style={{...S.progressFill,width:`${((essayCur+(essayConfirmed?1:0))/essayQs.length)*100}%`}}/></div>
            <div style={S.progressLabel}><span style={{fontWeight:600}}>{essayCur+1} / {essayQs.length}</span><span style={{color:"#c4a050",fontWeight:600}}>정답 {essayResults.filter(r=>r.result==="exact").length} / 부분 {essayResults.filter(r=>r.result==="partial").length}</span></div>
            <div style={S.questionCard}>
              <div style={S.questionTag}>{eq.questionType==="heb_to_mean"?`${bookInfo.termA.ko}의 ${bookInfo.termB.ko}는?`:`${bookInfo.termB.ko}에 해당하는 ${bookInfo.termA.ko}는?`}</div>
              <div style={{...S.questionText,...(eq.questionType==="heb_to_mean"?{fontFamily:"Arial,sans-serif",fontSize:"clamp(1.8rem,7vw,2.8rem)",direction:"rtl",fontWeight:700}:{fontSize:"clamp(1.1rem,4vw,1.6rem)",fontWeight:600})}}>{eq.question}</div>
              {!essayConfirmed&&eq.questionType==="heb_to_mean"&&<div style={{marginTop:"12px",display:"flex",justifyContent:"center"}}><RepeatSpeakBtn text={eq.question} onSpeak={speakOnDemand} muted={muted}/></div>}
              {essayConfirmed&&<div style={{marginTop:"10px",display:"flex",justifyContent:"center"}}><RepeatSpeakBtn text={eq.hebrewWord||eq.question} onSpeak={speakOnDemand} muted={muted}/></div>}
            </div>
            {!essayConfirmed&&(
              eq.questionType==="mean_to_heb"?(
                <input ref={essayHebRef} key={essayCur} style={{...S.essayInput,marginBottom:"12px",direction:"rtl",fontFamily:"Arial",fontSize:"1.2rem"}} placeholder="히브리어로 입력..." lang="he" spellCheck={false} autoCorrect="off" onKeyDown={e=>e.key==="Enter"&&handleEssayConfirm()}/>
              ):(
                <textarea ref={essayInputRef} style={{...S.essayInput,marginBottom:"12px"}} placeholder={`${bookInfo.termB.ko}을 입력하세요...`} value={essayInput} onChange={e=>setEssayInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),handleEssayConfirm())}/>
              )
            )}
            {essayConfirmed&&(()=>{
              const r=essayResults[essayResults.length-1];const val=r.userInput;const res=r.result;
              return(
                <div style={{marginBottom:"14px"}}>
                  <div style={{...(res==="exact"?S.feedbackCorrect:res==="partial"?{...S.feedbackCorrect,background:"rgba(196,160,80,0.12)",borderColor:"rgba(196,160,80,0.3)",color:"#c4a050"}:S.feedbackWrong),marginBottom:"10px"}}>
                    {res==="exact"?"✅ 정답!":res==="partial"?`🟡 부분 정답 — 정답: ${r.answer}`:`❌ 오답 — 정답: ${r.answer}`}
                  </div>
                  <div style={{fontSize:"0.82rem",color:"#5a5870",marginBottom:"8px"}}>입력: <span style={{color:"#e8e6f0"}}>{val}</span></div>
                  <StatusButtons wordId={eq.wordId}/>
                </div>
              );
            })()}
            <div style={{display:"flex",gap:"8px"}}>
              {!essayConfirmed?(<button style={{...S.btnStart,opacity:(eq.questionType==="mean_to_heb"||(essayInput?.trim()))?1:0.4}} onClick={handleEssayConfirm}>확인</button>):(
                <>
                  <button style={{...S.btnStart,flex:1}} onClick={handleEssayNext}>{essayCur+1<essayQs.length?"다음 문제 →":"결과 보기 🏁"}</button>
                  <button style={S.btnCancel} onClick={()=>setMode(MODES.LIST)}>그만하기</button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ══ VARIANT MODE ══ */}
        {mode===MODES.VARIANT&&vq&&(
          <div key={animKey}>
            <div style={S.progressBar}><div style={{...S.progressFill,width:`${((variantCur+(variantConfirmed?1:0))/variantQs.length)*100}%`}}/></div>
            <div style={S.progressLabel}><span style={{fontWeight:600}}>{variantCur+1} / {variantQs.length}</span><span style={{color:"#c4a050",fontWeight:600}}>정답 {variantResults.filter(r=>r.correct).length}</span></div>
            <div style={S.questionCard}>
              {(()=>{const cat=VARIANT_CATS.find(c=>c.types.includes(vq.variantType));const vt=VARIANT_TYPES.find(t=>t.id===vq.variantType);return(<>
                {cat&&<div style={{...S.questionTag,color:cat.color,borderColor:`${cat.color}50`,background:`${cat.color}15`,marginBottom:"10px"}}>{vt?.label.ko||vq.variantType}</div>}
                <div style={{fontFamily:"Arial",direction:"rtl",fontSize:"clamp(1.6rem,6vw,2.5rem)",color:"#f0ece0",fontWeight:700,marginBottom:"8px"}}>{vq.base}</div>
                <div style={{fontSize:"0.85rem",color:"#5a5870",marginBottom:"14px"}}>{vq.meaning}</div>
                {!variantConfirmed&&<div style={{display:"flex",justifyContent:"center"}}><RepeatSpeakBtn text={vq.base} onSpeak={speakOnDemand} muted={muted}/></div>}
                {variantConfirmed&&<div style={{display:"flex",justifyContent:"center"}}><RepeatSpeakBtn text={vq.answer} onSpeak={speakOnDemand} muted={muted}/></div>}
              </>);})()}
            </div>
            {variantQuizType==="essay"&&!variantConfirmed&&(
              <input ref={variantInputRef} key={variantCur} style={{...S.input,fontSize:"1.2rem",direction:"rtl",fontFamily:"Arial",padding:"14px 16px",marginBottom:"12px",textAlign:"center"}} placeholder="히브리어로 입력..." lang="he" spellCheck={false} autoCorrect="off" value={variantInput} onChange={e=>setVariantInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleVariantConfirm()}/>
            )}
            {variantQuizType==="mcq"&&!variantConfirmed&&(
              <div className="choices-grid" style={{...S.choicesGrid,marginBottom:"12px"}}>
                {vq.choices.map((choice,idx)=>(<button key={idx} style={{...S.choiceBtn,...(variantSelected===choice?S.choiceSelected:{})}} onClick={()=>setVariantSelected(choice)}>
                  <span style={S.choiceAlpha}>{["A","B","C","D"][idx]}</span>
                  <span style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.1rem",fontWeight:600}}>{choice}</span>
                </button>))}
              </div>
            )}
            {variantConfirmed&&(()=>{
              const r=variantResults[variantResults.length-1];
              return(<div style={{marginBottom:"14px"}}>
                <div style={{...(r.correct?S.feedbackCorrect:S.feedbackWrong),marginBottom:"10px"}}>
                  {r.correct?"✅ 정답!":"❌ 오답 — 정답: "+vq.answer}
                </div>
                {variantQuizType==="mcq"&&<div className="choices-grid" style={{...S.choicesGrid,marginBottom:"10px"}}>
                  {vq.choices.map((choice,idx)=>(<div key={idx} style={{...S.choiceBtn,...(choice===vq.answer?S.choiceCorrect:choice===r.userInput&&!r.correct?S.choiceWrong:{}),cursor:"default"}}>
                    <span style={S.choiceAlpha}>{["A","B","C","D"][idx]}</span>
                    <span style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.1rem",fontWeight:600}}>{choice}</span>
                  </div>))}
                </div>}
                <StatusButtons wordId={vq.wordId}/>
              </div>);
            })()}
            <div style={{display:"flex",gap:"8px"}}>
              {!variantConfirmed?(<button style={{...S.btnStart,opacity:(variantQuizType==="mcq"?!!variantSelected:!!variantInput.trim())?1:0.4}} onClick={handleVariantConfirm}>확인</button>):(
                <>
                  <button style={{...S.btnStart,flex:1}} onClick={handleVariantNext}>{variantCur+1<variantQs.length?"다음 문제 →":"결과 보기 🏁"}</button>
                  <button style={S.btnCancel} onClick={()=>setMode(MODES.LIST)}>그만하기</button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ══ RESULT MODE ══ */}
        {mode===MODES.RESULT&&(
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <div style={{fontSize:"4rem",marginBottom:"16px"}}>{score===questions.length?"🏆":score>=questions.length*0.7?"🎉":"📚"}</div>
            <h2 style={{fontSize:"2rem",color:"#c4a050",margin:"0 0 8px"}}>{score} / {questions.length}</h2>
            <p style={{color:"#7a7890",marginBottom:"24px"}}>{score===questions.length?"완벽해요! 모두 정답":score>=questions.length*0.7?"잘했어요! 계속 파이팅":"더 연습해봐요!"}</p>
            {wrongWords.length>0&&(<div style={{textAlign:"left",marginBottom:"24px"}}>
              <div style={{fontSize:"0.82rem",color:"#f07050",fontWeight:600,marginBottom:"10px"}}>🔥 틀린 단어 ({wrongWords.length}개)</div>
              <div style={S.wordList}>
                {wrongWords.map((q,i)=>(<div key={i} style={{...S.wordItem(i===0,i===wrongWords.length-1,"hard"),gap:"8px"}}>
                  <span style={{fontFamily:"Arial",direction:"rtl",color:"#c4a050",fontSize:"1.05rem"}}>{q.question}</span>
                  <span style={{color:"#5a5870",fontSize:"0.9rem"}}>→</span>
                  <span style={{color:"#e8e6f0",fontSize:"0.9rem"}}>{q.answer}</span>
                </div>))}
              </div>
            </div>)}
            <div style={{display:"flex",gap:"8px",justifyContent:"center",flexWrap:"wrap"}}>
              <button style={{...S.btnStart,flex:1,maxWidth:"200px"}} onClick={startQuiz}>🔄 다시 시작</button>
              <button style={{...S.btnCancel,flex:1,maxWidth:"160px"}} onClick={()=>setMode(MODES.LIST)}>← 단어장</button>
            </div>
          </div>
        )}

        {/* ══ ESSAY RESULT MODE ══ */}
        {mode===MODES.ESSAY_RESULT&&(
          <div style={{padding:"10px 0"}}>
            <div style={{textAlign:"center",marginBottom:"24px"}}>
              <div style={{fontSize:"3.5rem",marginBottom:"12px"}}>{essayScore===essayQs.length?"🏆":essayScore+essayPartial>=essayQs.length*0.7?"🎉":"📚"}</div>
              <div style={{display:"flex",justifyContent:"center",gap:"12px",flexWrap:"wrap",marginBottom:"8px"}}>
                <div style={{textAlign:"center"}}><div style={{fontSize:"2rem",fontWeight:700,color:"#60c880"}}>{essayScore}</div><div style={{fontSize:"0.75rem",color:"#5a5870"}}>정답</div></div>
                <div style={{textAlign:"center"}}><div style={{fontSize:"2rem",fontWeight:700,color:"#c4a050"}}>{essayPartial}</div><div style={{fontSize:"0.75rem",color:"#5a5870"}}>부분 정답</div></div>
                <div style={{textAlign:"center"}}><div style={{fontSize:"2rem",fontWeight:700,color:"#f07050"}}>{essayQs.length-essayScore-essayPartial}</div><div style={{fontSize:"0.75rem",color:"#5a5870"}}>오답</div></div>
              </div>
              <p style={{color:"#5a5870",fontSize:"0.85rem"}}>{essayQs.length}문제 완료</p>
            </div>
            <div style={{marginBottom:"24px"}}>
              <div style={{fontSize:"0.82rem",color:"#5a5870",fontWeight:600,marginBottom:"10px",textTransform:"uppercase",letterSpacing:"0.8px"}}>전체 결과</div>
              <div style={S.wordList}>
                {essayResults.map((r,i)=>(<div key={i} style={{...S.wordItem(i===0,i===essayResults.length-1,r.result==="exact"?"mastered":r.result==="partial"?"learning":"hard"),gap:"8px",flexWrap:"wrap"}}>
                  <span style={{width:"20px",fontSize:"1rem",flexShrink:0}}>{r.result==="exact"?"✅":r.result==="partial"?"🟡":"❌"}</span>
                  <span style={{fontFamily:"Arial",direction:"rtl",color:"#c4a050",fontSize:"1rem",minWidth:"70px"}}>{r.hebrewWord||r.question}</span>
                  <span style={{color:"#5a5870",fontSize:"0.82rem",flex:1,minWidth:"60px"}}>{r.result==="wrong"?<span style={{color:"#f07050"}}>{r.userInput||"(없음)"} → <span style={{color:"#60c880"}}>{r.answer}</span></span>:<span>{r.answer}</span>}</span>
                </div>))}
              </div>
            </div>
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
              <button style={{...S.btnStart,flex:1}} onClick={startEssay}>🔄 다시 시작</button>
              <button style={{...S.btnCancel,flex:1}} onClick={()=>setMode(MODES.LIST)}>← 단어장</button>
            </div>
          </div>
        )}

        {/* ══ VARIANT RESULT MODE ══ */}
        {mode===MODES.VARIANT_RESULT&&(
          <div style={{textAlign:"center",padding:"20px 0"}}>
            <div style={{fontSize:"3.5rem",marginBottom:"12px"}}>{variantResults.filter(r=>r.correct).length===variantQs.length?"🏆":"🎉"}</div>
            <h2 style={{fontSize:"2rem",color:"#c4a050",margin:"0 0 8px"}}>{variantResults.filter(r=>r.correct).length} / {variantQs.length}</h2>
            <p style={{color:"#5a5870",marginBottom:"24px"}}>변형 퀴즈 완료!</p>
            {variantResults.filter(r=>!r.correct).length>0&&(<div style={{textAlign:"left",marginBottom:"24px"}}>
              <div style={{fontSize:"0.82rem",color:"#f07050",fontWeight:600,marginBottom:"10px"}}>🔥 틀린 변형</div>
              <div style={S.wordList}>
                {variantResults.filter(r=>!r.correct).map((r,i)=>{const vt=VARIANT_TYPES.find(t=>t.id===r.variantType);return(
                  <div key={i} style={{...S.wordItem(i===0,i===variantResults.filter(x=>!x.correct).length-1,"hard"),gap:"8px",flexWrap:"wrap"}}>
                    <div style={{fontFamily:"Arial",direction:"rtl",color:"#c4a050",fontSize:"1rem",minWidth:"70px"}}>{r.base}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:"0.68rem",color:"#5a5870",marginBottom:"2px"}}>{vt?.label.ko||r.variantType}</div>
                      <div style={{fontSize:"0.85rem"}}><span style={{color:"#f07050",fontFamily:"Arial",direction:"rtl"}}>{r.userInput||"(없음)"}</span><span style={{color:"#5a5870",margin:"0 5px"}}>→</span><span style={{color:"#60c880",fontFamily:"Arial",direction:"rtl"}}>{r.answer}</span></div>
                    </div>
                  </div>
                );})}
              </div>
            </div>)}
            <div style={{display:"flex",gap:"8px",justifyContent:"center",flexWrap:"wrap"}}>
              <button style={{...S.btnStart,flex:1,maxWidth:"200px"}} onClick={startVariantQuiz}>🔄 다시 시작</button>
              <button style={{...S.btnCancel,flex:1,maxWidth:"160px"}} onClick={()=>setMode(MODES.LIST)}>← 단어장</button>
            </div>
          </div>
        )}

      </div>{/* /container */}
    </div>
  );
}
