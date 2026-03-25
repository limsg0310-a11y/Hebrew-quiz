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

const MODES = { LIST:"list", QUIZ:"quiz", ESSAY:"essay", RESULT:"result", ESSAY_RESULT:"essay_result" };
const QUIZ_TYPES = { HEB_TO_MEAN:"heb_to_mean", MEAN_TO_HEB:"mean_to_heb", MIXED:"mixed" };
const QUIZ_FILTERS = { ALL:"all", EXCLUDE_MASTERED:"exclude_mastered", HARD_ONLY:"hard_only" };
const BOOKS = [
  { id:"hebrew",  label:{ko:"히브리어", en:"Hebrew"},  emoji:"🇮🇱", color:"#c4a050", ttsLang:"he-IL", ttsName:"he-IL-Standard-A", ttsRate:0.85,
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
    autoPlay:"🔊 퀴즈 자동 발음", autoPlaySub:"문제 시 자동 재생", mute:"🔇 음소거", muteSub:"모든 발음을 끕니다",
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
    autoPlay:"🔊 Auto Pronunciation", autoPlaySub:"Auto play on question", mute:"🔇 Mute", muteSub:"Mute all sounds",
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
  const actualType = type===QUIZ_TYPES.MIXED?(Math.random()>0.5?QUIZ_TYPES.HEB_TO_MEAN:QUIZ_TYPES.MEAN_TO_HEB):type;
  const question = actualType===QUIZ_TYPES.HEB_TO_MEAN?word.hebrew:word.meaning;
  const answer   = actualType===QUIZ_TYPES.HEB_TO_MEAN?word.meaning:word.hebrew;
  const distractors = shuffle(allWords.filter(w=>w.id!==word.id)).slice(0,3).map(w=>actualType===QUIZ_TYPES.HEB_TO_MEAN?w.meaning:w.hebrew);
  return { question, answer, choices:shuffle([answer,...distractors]), questionType:actualType, wordId:word.id };
}

async function googleTTS(text, apiKey, lang="he-IL", name="he-IL-Standard-A", rate=0.85) {
  // 히브리어는 닉쿠드 제거, 다른 언어는 그대로
  const input = lang.startsWith("he") ? stripNikkud(text) : text;
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,{
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({input:{text:input}, voice:{languageCode:lang, name}, audioConfig:{audioEncoding:"MP3", speakingRate:rate}}),
  });
  if(!res.ok) throw new Error("TTS error");
  const data=await res.json();
  new Audio(`data:audio/mp3;base64,${data.audioContent}`).play();
}
function browserTTS(text, lang="he-IL", rate=0.85) {
  if(!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
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
    <div style={{display:"flex",alignItems:"center",gap:"6px",flexShrink:0}}>
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
  const speak=useCallback(async(text,forceMuted=false)=>{ 
    if(forceMuted) return;
    const book = BOOKS.find(b=>b.id===currentBook)||BOOKS[0];
    const {ttsLang,ttsName,ttsRate} = book;
    if(apiKey){ try{ await googleTTS(text,apiKey,ttsLang,ttsName,ttsRate); return; }catch{} }
    browserTTS(text,ttsLang,ttsRate);
  },[apiKey,currentBook]);

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

          if(snap.exists()){
            const cloud = snap.data().words;
            if(cloud&&cloud.length){
              if(hasLocal){
                // 로컬 단어 + 클라우드 단어 둘 다 있음 → 선택 모달
                setPendingCloudWords(cloud);
                setShowMergeModal(true);
              } else {
                // 로컬에 단어 없음 → 클라우드 단어로 교체
                setWordsRaw(cloud); saveWords(cloud);
                showToast("☁️ 클라우드 단어장을 불러왔어요!");
              }
            } else {
              // 클라우드 비어있음 → 로컬 단어를 클라우드에 업로드
              if(hasLocal){
                await setDoc(doc(fbDb,"users",u.uid),{words:localWords,updatedAt:new Date().toISOString()});
                showToast("☁️ 기존 단어장을 클라우드에 저장했어요!");
              }
            }
          } else {
            // 클라우드에 계정 없음(첫 로그인) → 로컬 단어 업로드
            if(hasLocal){
              await setDoc(doc(fbDb,"users",u.uid),{words:localWords,updatedAt:new Date().toISOString()});
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
  const [newMeaning,setNewMeaning]      =useState("");
  const [editId,setEditId]              =useState(null);
  const [quizType,setQuizType]          =useState(QUIZ_TYPES.HEB_TO_MEAN);
  const [quizFilter,setQuizFilter]      =useState(QUIZ_FILTERS.ALL);
  const [quizCount,setQuizCount]        =useState(10);
  const [listFilter,setListFilter]      =useState("all");
  const [searchQuery,setSearchQuery]    =useState("");
  const [pageSize,setPageSize]          =useState(20);
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
  const [autoPlay,setAutoPlay]          =useState(true);
  const [muted,setMuted]                 =useState(false);
  const [showPasteModal,setShowPasteModal]=useState(false);
  const [showBatchModal,setShowBatchModal]=useState(false);
  const [pasteText,setPasteText]        =useState("");
  const batchTextRef                    =useRef(null); // uncontrolled — fixes Hebrew IME input issue
  const [essayQuestions,setEssayQuestions]=useState([]);
  const [essayCurrent,setEssayCurrent]  =useState(0);
  const [essayInput,setEssayInput]      =useState("");
  const [essayConfirmed,setEssayConfirmed]=useState(false);
  const [essayResults,setEssayResults]  =useState([]);
  const [essayFilter,setEssayFilter]    =useState(QUIZ_FILTERS.ALL);
  const [essayCount,setEssayCount]      =useState(10);
  const [essayType,setEssayType]         =useState("heb_to_mean"); // heb_to_mean | mean_to_heb | mixed
  const essayInputRef=useRef(null); const essayHebrewRef=useRef(null); const fileInputRef=useRef(null); const csvInputRef=useRef(null);

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

  useEffect(()=>{ if(mode!==MODES.QUIZ||!autoPlay||muted) return; const q=questions[current]; if(!q||q.questionType!==QUIZ_TYPES.HEB_TO_MEAN) return; const t=setTimeout(()=>speak(q.question),500); return()=>clearTimeout(t); },[current,animKey,mode,muted]); // eslint-disable-line
  useEffect(()=>{ if(mode===MODES.ESSAY&&essayInputRef.current) essayInputRef.current.focus(); },[essayCurrent,mode]);

  const updateWordStats=(wordId,correct)=>{ setWords(ws=>ws.map(w=>{ if(w.id!==wordId) return w; const ns=correct?w.streak+1:0; const nw=correct?w.wrongCount:w.wrongCount+1; let st=w.status; if(correct&&ns>=3) st="mastered"; else if(!correct&&nw>=2) st="hard"; return{...w,streak:ns,wrongCount:nw,status:st}; })); };
  const setManualStatus=(id,status)=>{ setWords(ws=>ws.map(w=>w.id===id?{...w,status,streak:status==="mastered"?3:0,wrongCount:status==="hard"?2:0}:w)); };

  const exportWords=()=>{ const data={version:1,exportedAt:new Date().toISOString(),words}; const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`hebrew-vocab-${new Date().toISOString().slice(0,10)}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); showToast(`✅ ${words.length}개 단어를 내보냈어요!`); };
  const copyToClipboard=async()=>{ const text=JSON.stringify({version:1,exportedAt:new Date().toISOString(),words},null,2); try{await navigator.clipboard.writeText(text); showToast("📋 클립보드에 복사됐어요!");}catch{const ta=document.createElement("textarea"); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); showToast("📋 클립보드에 복사됐어요!");} };
  const importFromText=()=>{ try{ const parsed=JSON.parse(pasteText); const raw=Array.isArray(parsed)?parsed:(parsed.words||[]); const imported=raw.map(w=>({id:Date.now()+Math.random(),hebrew:(w.hebrew||"").trim(),meaning:(w.meaning||"").trim(),status:["learning","mastered","hard"].includes(w.status)?w.status:"learning",streak:w.streak||0,wrongCount:w.wrongCount||0})).filter(w=>w.hebrew&&w.meaning); if(!imported.length){showToast("불러올 단어가 없어요.","err");return;} setImportPreview({words:imported,fileName:"클립보드에서 붙여넣기"}); setShowPasteModal(false); setPasteText(""); }catch{showToast("올바른 형식이 아니에요.","err");} };
  const importFromBatchText=()=>{ const raw=batchTextRef.current?batchTextRef.current.value:""; const parsed=parseTextFormat(raw); if(!parsed.length){showToast("인식된 단어가 없어요. שלום=평화 형식으로 입력해주세요.","err");return;} setImportPreview({words:parsed.map(w=>({...w,id:Date.now()+Math.random(),status:"learning",streak:0,wrongCount:0})),fileName:`텍스트 형식 (${parsed.length}개)`}); setShowBatchModal(false); if(batchTextRef.current) batchTextRef.current.value=""; };
  const handleFileChange=(e)=>{ const file=e.target.files[0]; if(!file) return; const reader=new FileReader(); reader.onload=(ev)=>{ try{ const parsed=JSON.parse(ev.target.result); const raw=Array.isArray(parsed)?parsed:(parsed.words||[]); const imported=raw.map(w=>({id:Date.now()+Math.random(),hebrew:(w.hebrew||"").trim(),meaning:(w.meaning||"").trim(),status:["learning","mastered","hard"].includes(w.status)?w.status:"learning",streak:w.streak||0,wrongCount:w.wrongCount||0})).filter(w=>w.hebrew&&w.meaning); if(!imported.length){showToast("불러올 단어가 없어요.","err");return;} setImportPreview({words:imported,fileName:file.name}); }catch{showToast("파일을 읽을 수 없어요.","err");} }; reader.readAsText(file); e.target.value=""; };
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

  const getPool=(filter)=>{ const f=filter||quizFilter; if(f===QUIZ_FILTERS.EXCLUDE_MASTERED) return words.filter(w=>w.status!=="mastered"); if(f===QUIZ_FILTERS.HARD_ONLY) return words.filter(w=>w.status==="hard"); return words; };
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
    if(!muted) speak(q.hebrewWord||q.question);
  };
  const handleEssayNext=()=>{ if(essayCurrent+1>=essayQuestions.length){setMode(MODES.ESSAY_RESULT);return;} setEssayCurrent(c=>c+1); setEssayInput(""); setEssayConfirmed(false); setAnimKey(k=>k+1); if(essayHebrewRef.current) essayHebrewRef.current.value=""; };
  const handleSelect=choice=>{ if(!confirmed) setSelected(choice); };
  const handleConfirm=()=>{ if(!selected) return; const correct=selected===questions[current].answer; if(correct) setScore(s=>s+1); else setWrongWords(w=>[...w,questions[current]]); updateWordStats(questions[current].wordId,correct); setConfirmed(true); const q=questions[current]; if(!muted) setTimeout(()=>speak(q.questionType===QUIZ_TYPES.HEB_TO_MEAN?q.question:q.answer),300); };  // eslint-disable-line
  const handleNext=()=>{ if(current+1>=questions.length){setMode(MODES.RESULT);return;} setCurrent(c=>c+1); setSelected(null); setConfirmed(false); setAnimKey(k=>k+1); };
  const addWord=()=>{ if(!newHebrew.trim()||!newMeaning.trim()) return; if(editId!==null){setWords(ws=>ws.map(w=>w.id===editId?{...w,hebrew:newHebrew.trim(),meaning:newMeaning.trim()}:w)); setEditId(null);}else{setWords(ws=>[...ws,{id:Date.now(),hebrew:newHebrew.trim(),meaning:newMeaning.trim(),status:"learning",streak:0,wrongCount:0}]);} setNewHebrew(""); setNewMeaning(""); };
  const deleteWord=id=>setWords(ws=>ws.filter(w=>w.id!==id));
  const startEdit=word=>{ setEditId(word.id); setNewHebrew(word.hebrew); setNewMeaning(word.meaning); };
  const cancelEdit=()=>{ setEditId(null); setNewHebrew(""); setNewMeaning(""); };

  const searchedWords = words.filter(w => {
    const matchFilter = listFilter === "all" || w.status === listFilter;
    if (!matchFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return w.hebrew.includes(q) || w.meaning.toLowerCase().includes(q);
  });
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
      <style>{`*{box-sizing:border-box;}body{margin:0;}input,button,textarea{-webkit-tap-highlight-color:transparent;}input:focus,textarea:focus{outline:none;border-color:rgba(196,160,80,0.6)!important;}@media(max-width:480px){.choices-grid{grid-template-columns:1fr!important;}.form-row{flex-direction:column!important;}.quiz-btn-row{flex-direction:column!important;}.result-btn-row{flex-direction:column!important;}.modal-btn-row{flex-direction:column!important;}.io-btns{flex-wrap:wrap!important;}}`}</style>
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
                  <button onClick={()=>setUiLang(l=>l==="ko"?"en":"ko")} style={{fontSize:"0.65rem",padding:"3px 8px",borderRadius:"6px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",color:"#c4a050",cursor:"pointer",fontWeight:700}}>{uiLang==="ko"?"EN":"KO"}</button>
                  <button onClick={signOutUser} style={{fontSize:"0.65rem",padding:"3px 8px",borderRadius:"6px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",color:"#7a7890",cursor:"pointer"}}>{T.logout}</button>
                </div>
              : <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
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
              <h2 style={S.cardTitle}>{editId!==null?T.editWord:T.addWord}</h2>
              <div className="form-row" style={S.formRow}>
                <input style={{...S.input,direction:bookInfo.dir,fontFamily:"Arial,sans-serif",fontSize:"1.1rem"}}
                  placeholder={bookInfo.placeholderA[uiLang]||bookInfo.placeholderA.ko}
                  value={newHebrew} onChange={e=>setNewHebrew(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addWord()}/>
                <input style={S.input}
                  placeholder={bookInfo.placeholderB[uiLang]||bookInfo.placeholderB.ko}
                  value={newMeaning} onChange={e=>setNewMeaning(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addWord()}/>
                <div style={{display:"flex",gap:"8px"}}>
                  <button style={{...S.btnAdd,flex:1}} onClick={addWord}>{editId!==null?T.editBtn:T.addBtn}</button>
                  {newHebrew&&<SpeakBtn text={newHebrew} onSpeak={speak} muted={muted}/>}
                  {editId!==null&&<button style={S.btnCancel} onClick={cancelEdit}>{T.cancelBtn}</button>}
                </div>
              </div>
            </div>

            <div style={S.ioCard}>
              <div style={S.ioTitle}>{T.saveLoad}</div>
              <div style={{...S.ioSub,marginBottom:"10px"}}>{T.telegramTip}</div>
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
            </div>



            {/* 검색 + 보기 수 */}
            <div style={{display:"flex",gap:"8px",marginBottom:"10px",flexWrap:"wrap",alignItems:"center"}}>
              <input
                style={{...S.input,flex:1,minWidth:"160px",padding:"9px 14px",fontSize:"0.9rem"}}
                placeholder={T.searchPlaceholder}
                value={searchQuery}
                onChange={e=>{setSearchQuery(e.target.value);setPage(0);}}
              />
              <div style={{display:"flex",gap:"4px"}}>
                {[10,20,9999].map(n=>(
                  <button key={n} style={{...S.optBtn,padding:"8px 10px",fontSize:"0.78rem",...(pageSize===n?S.optBtnActive:{})}}
                    onClick={()=>{setPageSize(n);setPage(0);}}>
                    {n===9999?"전체":n+"개"}
                  </button>
                ))}
              </div>
            </div>

            {/* 필터 탭 */}
            <div style={S.filterTabs}>
              {[["all",T.all,words.length],["learning",T.learning,learningCount],["hard",T.hard,hardCount],["mastered",T.done,masteredCount]].map(([val,label,cnt])=>(
                <button key={val} style={{...S.filterTab,...(listFilter===val?S.filterTabActive:{})}} onClick={()=>{setListFilter(val);setPage(0);setSelectedIds(new Set());}}>
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
                  <div style={S.wordCenter}>
                    <div style={{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
                      <span style={S.wordHeb}>{w.hebrew}</span>
                      <RepeatSpeakBtn text={w.hebrew} onSpeak={speak} muted={muted} size="sm"/>
                    </div>
                    <span style={S.wordMean}>{w.meaning}</span>
                  </div>
                  <div style={S.wordRight}>
                    <div style={S.statusBtns}>{["learning","hard","mastered"].map(s=>{ const sc=STATUS_CONFIG[s]; return<button key={s} title={sc.label} style={{...S.statusBtn,...(w.status===s?{background:sc.bg,borderColor:sc.border,opacity:1}:{})}} onClick={()=>setManualStatus(w.id,s)}>{sc.emoji}</button>; })}</div>
                    <div style={S.wordActions}><button style={S.btnEdit} onClick={()=>startEdit(w)}>✏️</button><button style={S.btnDel} onClick={()=>deleteWord(w.id)}>🗑️</button></div>
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
              <h2 style={S.cardTitle}>{T.mcqTitle}</h2>
              <p style={S.settingLabel}>{T.direction}</p>
              <div style={S.optionRow}>{[[QUIZ_TYPES.HEB_TO_MEAN,T.dirAtoB(bookInfo)],[QUIZ_TYPES.MEAN_TO_HEB,T.dirBtoA(bookInfo)],[QUIZ_TYPES.MIXED,T.mixed]].map(([val,label])=><button key={val} style={{...S.optBtn,...(quizType===val?S.optBtnActive:{})}} onClick={()=>setQuizType(val)}>{label}</button>)}</div>
              <p style={S.settingLabel}>{T.wordRange}</p>
              <div style={S.optionRow}>{[[QUIZ_FILTERS.ALL,T.allRange(words.length)],[QUIZ_FILTERS.EXCLUDE_MASTERED,T.excludeMastered(words.filter(w=>w.status!=="mastered").length)],[QUIZ_FILTERS.HARD_ONLY,T.hardOnly(hardCount)]].map(([val,label])=><button key={val} style={{...S.optBtn,...(quizFilter===val?S.optBtnActive:{})}} onClick={()=>setQuizFilter(val)}>{label}</button>)}</div>
              <p style={S.settingLabel}>{T.questionCount}</p>
              <div style={S.optionRow}>{countOptions.map(({label,value})=>{ const d=value!==9999&&value>poolSize; return<button key={value} style={{...S.optBtn,...(quizCount===value?S.optBtnActive:{}),...(d?{opacity:0.3,cursor:"not-allowed"}:{})}} onClick={()=>!d&&setQuizCount(value)} disabled={d}>{label}</button>; })}</div>
              <div style={S.sliderWrap}>
                <span style={S.sliderLabel}>{T.directInput}</span>
                <input type="range" min={1} max={Math.max(4,poolSize)} value={Math.min(quizCount===9999?poolSize:quizCount,poolSize)} onChange={e=>setQuizCount(Number(e.target.value))} style={S.slider}/>
                <input type="number" min={1} max={poolSize} value={quizCount===9999?poolSize:Math.min(quizCount,poolSize)}
                  onChange={e=>{ const v=Math.max(1,Math.min(poolSize,Number(e.target.value)||1)); setQuizCount(v); }}
                  style={{width:"52px",padding:"4px 6px",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(196,160,80,0.4)",borderRadius:"6px",color:"#c4a050",fontSize:"0.9rem",fontWeight:700,textAlign:"center",outline:"none"}}/>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:"8px",marginBottom:"14px"}}>
                <div style={S.autoPlayRow}>
                  <div><div style={{fontSize:"0.85rem",color:"#c4a050",fontWeight:600}}>{T.autoPlay}</div><div style={{fontSize:"0.75rem",color:"#5a5870",marginTop:"2px"}}>{T.autoPlaySub}</div></div>
                  <button onClick={()=>setAutoPlay(v=>!v)} style={{...S.toggleBtn,...(autoPlay?S.toggleOn:S.toggleOff)}}>{autoPlay?"ON":"OFF"}</button>
                </div>
                <div style={S.autoPlayRow}>
                  <div><div style={{fontSize:"0.85rem",color:"#f07050",fontWeight:600}}>{T.mute}</div><div style={{fontSize:"0.75rem",color:"#5a5870",marginTop:"2px"}}>{T.muteSub}</div></div>
                  <button onClick={()=>setMuted(v=>!v)} style={{...S.toggleBtn,...(muted?{background:"rgba(200,60,60,0.3)",color:"#f08080"}:S.toggleOff)}}>{muted?"ON":"OFF"}</button>
                </div>
              </div>
              <button style={{...S.btnStart,...(poolSize<4?S.btnDisabled:{})}} onClick={startQuiz} disabled={poolSize<4}>{poolSize<4?T.needMore(poolSize):T.startMCQ(quizCount===9999?poolSize:Math.min(quizCount,poolSize))}</button>
            </div>

            {/* 서술형 */}
            <div style={{...S.card,border:"1px solid rgba(100,80,200,0.3)"}}>
              <h2 style={{...S.cardTitle,color:"#9060f0"}}>{T.essayTitle}</h2>
              <p style={{fontSize:"0.82rem",color:"#7a7890",marginBottom:"12px"}}>{T.essaySub}</p>
              <p style={S.settingLabel}>문제 방향</p>
              <div style={S.optionRow}>
                {[["heb_to_mean",T.dirAtoB_e(bookInfo)],["mean_to_heb",T.dirBtoA_e(bookInfo)],["mixed",T.mixed]].map(([val,label])=>(
                  <button key={val} style={{...S.optBtn,...(essayType===val?S.essayOptActive:{})}} onClick={()=>setEssayType(val)}>{label}</button>
                ))}
              </div>
              <p style={S.settingLabel}>단어 범위</p>
              <div style={S.optionRow}>{[[QUIZ_FILTERS.ALL,T.allRange(words.length)],[QUIZ_FILTERS.EXCLUDE_MASTERED,T.excludeMastered(words.filter(w=>w.status!=="mastered").length)],[QUIZ_FILTERS.HARD_ONLY,T.hardOnly(hardCount)]].map(([val,label])=><button key={val} style={{...S.optBtn,...(essayFilter===val?S.essayOptActive:{})}} onClick={()=>setEssayFilter(val)}>{label}</button>)}</div>
              <p style={S.settingLabel}>{T.questionCount}</p>
              <div style={S.optionRow}>{countOptions.map(({label,value})=>{ const d=value!==9999&&value>essayPoolSize; return<button key={value} style={{...S.optBtn,...(essayCount===value?S.essayOptActive:{}),...(d?{opacity:0.3,cursor:"not-allowed"}:{})}} onClick={()=>!d&&setEssayCount(value)} disabled={d}>{label}</button>; })}</div>
              <button style={{...S.btnEssayStart,...(!essayPoolSize?S.btnDisabled:{})}} onClick={startEssay} disabled={!essayPoolSize}>✍️ 서술형 시작! ({essayCount===9999?essayPoolSize:Math.min(essayCount,essayPoolSize)} {uiLang==="en"?"questions":"문제"})</button>
            </div>
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
                  {q.questionType===QUIZ_TYPES.HEB_TO_MEAN?(<RepeatSpeakBtn text={q.question} onSpeak={speak} muted={muted}/>)
                  :confirmed?(<><RepeatSpeakBtn text={q.answer} onSpeak={speak} muted={muted}/><span style={{fontSize:"0.75rem",color:"#5a5870"}}>{uiLang==="en"?"Answer pronunciation":"정답 발음"}</span></>):null}
                </div>
              </div>
              {(()=>{const w=words.find(x=>x.id===q.wordId);const st=w?STATUS_CONFIG[w.status]:null;return st?<div style={{...S.statusPill,color:st.color,background:st.bg,border:`1px solid ${st.border}`}}>{st.emoji} {st.label}</div>:null;})()}
            </div>
            <div className="choices-grid" style={S.choicesGrid}>
              {q.choices.map((choice,idx)=>{ let extra={}; if(confirmed){if(choice===q.answer)extra=S.choiceCorrect;else if(choice===selected)extra=S.choiceWrong;}else if(choice===selected)extra=S.choiceSelected; return(
                <button key={idx} style={{...S.choiceBtn,...extra}} onClick={()=>handleSelect(choice)}>
                  <span style={S.choiceAlpha}>{"ABCD"[idx]}</span>
                  <span style={q.questionType===QUIZ_TYPES.MEAN_TO_HEB?{fontFamily:"Arial,sans-serif",fontSize:"1.2rem",direction:"rtl"}:{}}>{choice}</span>
                  {q.questionType===QUIZ_TYPES.MEAN_TO_HEB&&<span style={{marginLeft:"auto"}} onClick={e=>{e.stopPropagation();if(!muted)speak(choice);}}>🔈</span>}
                </button>
              );})}
            </div>
            <div style={{minHeight:"52px",marginBottom:"8px"}}>
              {confirmed&&<div style={{...(selected===q.answer?S.feedbackCorrect:S.feedbackWrong),display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"8px"}}>
                <span>{selected===q.answer?T.correct:T.wrong(q.answer)}
                {(()=>{const w=words.find(x=>x.id===q.wordId);const st=w?STATUS_CONFIG[w.status]:null;return st?<span style={{marginLeft:8,fontSize:"0.78rem",opacity:0.8}}>{st.emoji} {st.label}</span>:null;})()}</span>
                {/* 퀴즈 중 어려움 표시 버튼 */}
                {(()=>{ const w=words.find(x=>x.id===q.wordId); return w&&w.status!=="hard"?(
                  <button onClick={()=>setManualStatus(q.wordId,"hard")}
                    style={{padding:"4px 10px",borderRadius:"6px",background:"rgba(200,80,60,0.2)",border:"1px solid rgba(200,80,60,0.5)",color:"#f07050",fontSize:"0.75rem",cursor:"pointer",fontWeight:600,flexShrink:0}}>
                    🔥 어려움으로 표시
                  </button>
                ):w&&w.status==="hard"?(
                  <span style={{fontSize:"0.75rem",color:"#f07050",opacity:0.7}}>🔥 어려움으로 분류됨</span>
                ):null; })()}
              </div>}
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
                <RepeatSpeakBtn text={eq.hebrewWord} onSpeak={speak} muted={muted}/>
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

            {essayConfirmed&&(()=>{ const last=essayResults[essayResults.length-1];
              if(last?.result==="exact") return<div style={{...S.feedbackCorrect,flexWrap:"wrap"}}>✅ 정답! <SpeakBtn text={eq.hebrewWord} onSpeak={speak} muted={muted}/></div>;
              if(last?.result==="partial") return<div style={{...S.feedbackCorrect,background:"rgba(196,160,80,0.15)",borderColor:"rgba(196,160,80,0.3)",color:"#e8c875",flexWrap:"wrap"}}>부분 정답! 정확한 답: <b style={{fontFamily:eq.questionType==="mean_to_heb"?"Arial,sans-serif":"inherit",direction:eq.questionType==="mean_to_heb"?"rtl":"ltr"}}>{eq.answer}</b> <SpeakBtn text={eq.hebrewWord} onSpeak={speak} muted={muted}/></div>;
              return<div style={{...S.feedbackWrong,flexWrap:"wrap"}}>❌ 오답 — 정답: <b style={{fontFamily:eq.questionType==="mean_to_heb"?"Arial,sans-serif":"inherit",direction:eq.questionType==="mean_to_heb"?"rtl":"ltr"}}>{eq.answer}</b> <SpeakBtn text={eq.hebrewWord} onSpeak={speak} muted={muted}/></div>;
            })()}

            <div className="quiz-btn-row" style={S.quizBtnRow}>
              {!essayConfirmed
                ?<button style={S.btnEssayConfirm} onClick={handleEssayConfirm}>{T.confirm}</button>
                :<button style={S.btnNext} onClick={handleEssayNext}>{essayCurrent+1>=essayQuestions.length?T.finish:T.next}</button>}
              <button style={S.btnQuit} onClick={()=>{window.speechSynthesis?.cancel();setMode(MODES.LIST);}}>{T.quit}</button>
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
            {wrongWords.length>0&&<div style={S.wrongList}><h3 style={S.wrongTitle}>❌ 틀린 단어</h3>{wrongWords.map((q,i)=>{const w=words.find(x=>x.id===q.wordId);return w?<div key={i} style={S.wrongItem}><span style={{fontFamily:"Arial,sans-serif",fontSize:"1.1rem",direction:"rtl",color:"#c4a050"}}>{w.hebrew}</span><SpeakBtn text={w.hebrew} onSpeak={speak} muted={muted}/><span style={{color:"#a0a0b0",margin:"0 4px"}}>→</span><span style={{fontSize:"0.9rem"}}>{w.meaning}</span></div>:null;})}</div>}
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
                    <SpeakBtn text={r.question} onSpeak={speak} muted={muted}/>
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
  filterTabs:{display:"flex",gap:"6px",marginBottom:"12px",flexWrap:"wrap"},
  filterTab:{padding:"8px 12px",borderRadius:"8px",border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"#7a7890",cursor:"pointer",fontSize:"0.8rem"},
  filterTabActive:{background:"rgba(196,160,80,0.15)",borderColor:"rgba(196,160,80,0.4)",color:"#c4a050"},
  filterCnt:{background:"rgba(255,255,255,0.1)",borderRadius:"4px",padding:"1px 5px",marginLeft:"4px",fontSize:"0.7rem"},
  wordList:{display:"flex",flexDirection:"column",gap:"8px",marginBottom:"12px"},
  emptyMsg:{textAlign:"center",color:"#4a4860",padding:"24px",fontSize:"0.9rem"},
  wordItem:{display:"flex",alignItems:"center",gap:"10px",background:"rgba(255,255,255,0.03)",borderRadius:"12px",border:"1px solid",padding:"12px 14px"},
  wordIndex:{fontSize:"0.7rem",color:"#4a4860",minWidth:"16px",flexShrink:0},
  wordCenter:{display:"flex",flexDirection:"column",gap:"4px",flex:1,minWidth:0},
  wordHeb:{fontFamily:"Arial,sans-serif",fontSize:"1.15rem",color:"#c4a050",direction:"rtl"},
  wordMean:{fontSize:"0.82rem",color:"#a0a0c0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},
  wordRight:{display:"flex",flexDirection:"column",gap:"6px",alignItems:"flex-end",flexShrink:0},
  statusBtns:{display:"flex",gap:"4px"},
  statusBtn:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"6px",padding:"4px 8px",cursor:"pointer",fontSize:"0.9rem",opacity:0.45},
  wordActions:{display:"flex",gap:"4px"},
  btnEdit:{background:"transparent",border:"none",cursor:"pointer",fontSize:"1rem",opacity:0.45,padding:"2px 5px"},
  btnDel:{background:"transparent",border:"none",cursor:"pointer",fontSize:"1rem",opacity:0.45,padding:"2px 5px"},
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
