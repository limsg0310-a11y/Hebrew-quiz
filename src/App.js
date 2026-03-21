import { useState, useRef, useEffect, useCallback } from "react";

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

const MODES = { LIST: "list", QUIZ: "quiz", RESULT: "result" };
const QUIZ_TYPES = { HEB_TO_MEAN: "heb_to_mean", MEAN_TO_HEB: "mean_to_heb", MIXED: "mixed" };
const QUIZ_FILTERS = { ALL: "all", EXCLUDE_MASTERED: "exclude_mastered", HARD_ONLY: "hard_only" };
const LS_KEY = "hebrew_quiz_words";

const STATUS_CONFIG = {
  learning: { label: "학습중",   emoji: "📖", color: "#9090b0", bg: "rgba(120,120,160,0.15)", border: "rgba(120,120,160,0.3)" },
  mastered: { label: "암기완료", emoji: "✅", color: "#60c880", bg: "rgba(60,180,100,0.15)",  border: "rgba(60,180,100,0.35)" },
  hard:     { label: "어려움",   emoji: "🔥", color: "#f07050", bg: "rgba(200,80,60,0.15)",   border: "rgba(200,80,60,0.35)" },
};

function stripNikkud(text) {
  return text.replace(/[\u0591-\u05C7]/g, "");
}
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

function loadWords() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return DEFAULT_WORDS;
}

function saveWords(words) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(words)); } catch {}
}

function generateQuestion(word, allWords, type) {
  const actualType = type === QUIZ_TYPES.MIXED
    ? (Math.random() > 0.5 ? QUIZ_TYPES.HEB_TO_MEAN : QUIZ_TYPES.MEAN_TO_HEB)
    : type;
  const question = actualType === QUIZ_TYPES.HEB_TO_MEAN ? word.hebrew : word.meaning;
  const answer   = actualType === QUIZ_TYPES.HEB_TO_MEAN ? word.meaning : word.hebrew;
  const distractors = shuffle(allWords.filter(w => w.id !== word.id))
    .slice(0, 3)
    .map(w => actualType === QUIZ_TYPES.HEB_TO_MEAN ? w.meaning : w.hebrew);
  return { question, answer, choices: shuffle([answer, ...distractors]), questionType: actualType, wordId: word.id };
}

async function googleTTS(text, apiKey) {
  const clean = stripNikkud(text);
  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text: clean },
        voice: { languageCode: "he-IL", name: "he-IL-Standard-A" },
        audioConfig: { audioEncoding: "MP3", speakingRate: 0.85 },
      }),
    }
  );
  if (!res.ok) throw new Error("TTS API 오류");
  const data = await res.json();
  const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
  audio.play();
  return audio;
}

function browserTTS(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(stripNikkud(text));
  utt.lang = "he-IL"; utt.rate = 0.85;
  window.speechSynthesis.speak(utt);
}

function SpeakBtn({ text, onSpeak, size = "md" }) {
  const [playing, setPlaying] = useState(false);
  const handleClick = async (e) => {
    e.stopPropagation(); setPlaying(true);
    try { await onSpeak(text); } catch {}
    setTimeout(() => setPlaying(false), 1200);
  };
  return (
    <button onClick={handleClick} title="발음 듣기" style={{
      background: playing ? "rgba(196,160,80,0.3)" : "rgba(196,160,80,0.1)",
      border: "1px solid rgba(196,160,80,0.35)", borderRadius: "8px",
      cursor: "pointer", padding: size === "lg" ? "10px 16px" : "6px 10px",
      fontSize: size === "lg" ? "1.2rem" : "0.95rem", lineHeight: 1, flexShrink: 0,
    }}>
      {playing ? "🔊" : "🔈"}
    </button>
  );
}

export default function HebrewQuiz() {
  const envKey = process.env.REACT_APP_GOOGLE_TTS_KEY || "";
  const [apiKey] = useState(envKey);
  const ttsReady  = !!envKey;

  const speak = useCallback(async (text) => {
    if (apiKey) { try { await googleTTS(text, apiKey); return; } catch {} }
    browserTTS(text);
  }, [apiKey]);

  // ── localStorage 자동저장 ──
  const [words, setWordsRaw] = useState(loadWords);
  const setWords = (updater) => {
    setWordsRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveWords(next);
      return next;
    });
  };

  const [mode, setMode]                   = useState(MODES.LIST);
  const [newHebrew, setNewHebrew]         = useState("");
  const [newMeaning, setNewMeaning]       = useState("");
  const [editId, setEditId]               = useState(null);
  const [quizType, setQuizType]           = useState(QUIZ_TYPES.HEB_TO_MEAN);
  const [quizFilter, setQuizFilter]       = useState(QUIZ_FILTERS.ALL);
  const [quizCount, setQuizCount]         = useState(10);
  const [listFilter, setListFilter]       = useState("all");
  const [questions, setQuestions]         = useState([]);
  const [current, setCurrent]             = useState(0);
  const [selected, setSelected]           = useState(null);
  const [confirmed, setConfirmed]         = useState(false);
  const [score, setScore]                 = useState(0);
  const [wrongWords, setWrongWords]       = useState([]);
  const [animKey, setAnimKey]             = useState(0);
  const [importPreview, setImportPreview] = useState(null);
  const [toast, setToast]                 = useState(null);
  const [autoPlay, setAutoPlay]           = useState(true);
  const fileInputRef = useRef(null);

  const masteredCount = words.filter(w => w.status === "mastered").length;
  const hardCount     = words.filter(w => w.status === "hard").length;
  const learningCount = words.filter(w => w.status === "learning").length;

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => {
    if (mode !== MODES.QUIZ || !autoPlay) return;
    const q = questions[current];
    if (!q || q.questionType !== QUIZ_TYPES.HEB_TO_MEAN) return;
    const t = setTimeout(() => speak(q.question), 500);
    return () => clearTimeout(t);
  }, [current, animKey, mode]);

  const updateWordStats = (wordId, correct) => {
    setWords(ws => ws.map(w => {
      if (w.id !== wordId) return w;
      const newStreak     = correct ? w.streak + 1 : 0;
      const newWrongCount = correct ? w.wrongCount : w.wrongCount + 1;
      let newStatus = w.status;
      if (correct && newStreak >= 3)           newStatus = "mastered";
      else if (!correct && newWrongCount >= 2) newStatus = "hard";
      return { ...w, streak: newStreak, wrongCount: newWrongCount, status: newStatus };
    }));
  };

  const setManualStatus = (id, status) => {
    setWords(ws => ws.map(w =>
      w.id === id ? { ...w, status, streak: status==="mastered"?3:0, wrongCount: status==="hard"?2:0 } : w
    ));
  };

  const exportWords = () => {
    const data = { version: 1, exportedAt: new Date().toISOString(), words };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `hebrew-vocab-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`✅ ${words.length}개 단어를 내보냈어요!`);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const raw = Array.isArray(parsed) ? parsed : (parsed.words || []);
        const imported = raw.map(w => ({
          id: Date.now()+Math.random(), hebrew:(w.hebrew||"").trim(), meaning:(w.meaning||"").trim(),
          status:["learning","mastered","hard"].includes(w.status)?w.status:"learning",
          streak:w.streak||0, wrongCount:w.wrongCount||0,
        })).filter(w => w.hebrew && w.meaning);
        if (!imported.length) { showToast("불러올 단어가 없어요.","err"); return; }
        setImportPreview({ words: imported, fileName: file.name });
      } catch { showToast("파일을 읽을 수 없어요.","err"); }
    };
    reader.readAsText(file); e.target.value="";
  };

  const confirmImport = (merge) => {
    if (!importPreview) return;
    if (merge) {
      const ex = new Set(words.map(w => w.hebrew));
      const newOnes = importPreview.words.filter(w => !ex.has(w.hebrew));
      setWords(ws => [...ws, ...newOnes]);
      showToast(`📥 ${newOnes.length}개 추가! (중복 ${importPreview.words.length-newOnes.length}개 제외)`);
    } else {
      setWords(importPreview.words);
      showToast(`📥 ${importPreview.words.length}개 단어로 교체했어요!`);
    }
    setImportPreview(null); setListFilter("all");
  };

  const getPool = () => {
    if (quizFilter===QUIZ_FILTERS.EXCLUDE_MASTERED) return words.filter(w=>w.status!=="mastered");
    if (quizFilter===QUIZ_FILTERS.HARD_ONLY)        return words.filter(w=>w.status==="hard");
    return words;
  };

  const startQuiz = () => {
    const pool=getPool(); if(pool.length<4) return;
    const count=Math.min(quizCount===9999?pool.length:quizCount,pool.length);
    const qs=shuffle(pool).slice(0,count).map(w=>generateQuestion(w,words,quizType));
    setQuestions(qs); setCurrent(0); setSelected(null); setConfirmed(false);
    setScore(0); setWrongWords([]); setMode(MODES.QUIZ); setAnimKey(k=>k+1);
  };

  const handleSelect  = choice => { if(!confirmed) setSelected(choice); };
  const handleConfirm = () => {
    if(!selected) return;
    const correct=selected===questions[current].answer;
    if(correct) setScore(s=>s+1); else setWrongWords(w=>[...w,questions[current]]);
    updateWordStats(questions[current].wordId,correct);
    setConfirmed(true);
    const q=questions[current];
    const hebText=q.questionType===QUIZ_TYPES.HEB_TO_MEAN?q.question:q.answer;
    setTimeout(()=>speak(hebText),300);
  };
  const handleNext = () => {
    if(current+1>=questions.length){setMode(MODES.RESULT);return;}
    setCurrent(c=>c+1); setSelected(null); setConfirmed(false); setAnimKey(k=>k+1);
  };

  const addWord = () => {
    if(!newHebrew.trim()||!newMeaning.trim()) return;
    if(editId!==null){
      setWords(ws=>ws.map(w=>w.id===editId?{...w,hebrew:newHebrew.trim(),meaning:newMeaning.trim()}:w));
      setEditId(null);
    } else {
      setWords(ws=>[...ws,{id:Date.now(),hebrew:newHebrew.trim(),meaning:newMeaning.trim(),status:"learning",streak:0,wrongCount:0}]);
    }
    setNewHebrew(""); setNewMeaning("");
  };
  const deleteWord = id=>setWords(ws=>ws.filter(w=>w.id!==id));
  const startEdit  = word=>{setEditId(word.id);setNewHebrew(word.hebrew);setNewMeaning(word.meaning);};
  const cancelEdit = ()=>{setEditId(null);setNewHebrew("");setNewMeaning("");};

  const filteredWords=listFilter==="all"?words:words.filter(w=>w.status===listFilter);
  const q=questions[current];
  const progress=questions.length>0?((current+(confirmed?1:0))/questions.length)*100:0;
  const poolSize=getPool().length;
  const countOptions=[5,10,20,"전체"].map(v=>({label:v==="전체"?"전체":`${v}문제`,value:v==="전체"?9999:v}));

  return (
    <div style={S.root}>
      <style>{`
        *{box-sizing:border-box;}body{margin:0;}
        input,button{-webkit-tap-highlight-color:transparent;}
        input:focus{outline:none;border-color:rgba(196,160,80,0.6)!important;}
        @media(max-width:480px){
          .choices-grid{grid-template-columns:1fr!important;}
          .form-row{flex-direction:column!important;}
          .quiz-btn-row{flex-direction:column!important;}
          .result-btn-row{flex-direction:column!important;}
          .io-bar{flex-direction:column!important;align-items:flex-start!important;}
          .modal-btn-row{flex-direction:column!important;}
        }
      `}</style>
      <div style={S.bgDeco1}/><div style={S.bgDeco2}/>

      {toast&&<div style={{...S.toast,...(toast.type==="err"?S.toastErr:{})}}>{toast.msg}</div>}

      {importPreview&&(
        <div style={S.modalOverlay}>
          <div style={S.modal}>
            <h3 style={S.modalTitle}>📥 단어 불러오기</h3>
            <p style={S.modalSub}>파일: <span style={{color:"#c4a050"}}>{importPreview.fileName}</span></p>
            <p style={S.modalSub}><b style={{color:"#e8e6f0"}}>{importPreview.words.length}개</b> 단어 발견</p>
            <div style={S.modalPreview}>
              {importPreview.words.slice(0,5).map((w,i)=>(
                <div key={i} style={S.modalPreviewItem}>
                  <span style={{fontFamily:"'Frank Ruhl Libre',serif",color:"#c4a050",direction:"rtl"}}>{w.hebrew}</span>
                  <span style={{color:"#5a5870",margin:"0 6px"}}>→</span>
                  <span style={{color:"#a0a0c0",fontSize:"0.85rem"}}>{w.meaning}</span>
                </div>
              ))}
              {importPreview.words.length>5&&<p style={{color:"#5a5870",fontSize:"0.8rem",margin:"6px 0 0"}}>...외 {importPreview.words.length-5}개</p>}
            </div>
            <div className="modal-btn-row" style={S.modalBtnRow}>
              <button style={S.btnMerge}   onClick={()=>confirmImport(true)}>➕ 현재에 추가</button>
              <button style={S.btnReplace} onClick={()=>confirmImport(false)}>🔄 전체 교체</button>
              <button style={S.btnCancel2} onClick={()=>setImportPreview(null)}>취소</button>
            </div>
          </div>
        </div>
      )}

      <div style={S.container}>
        {/* Header */}
        <header style={S.header}>
          <div style={S.headerLeft}>
            <span style={S.logo}>אב</span>
            <div>
              <h1 style={S.title}>히브리어 단어 퀴즈</h1>
              <p style={S.subtitle}>Hebrew Vocabulary Trainer</p>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"6px"}}>
            <div style={S.statsRow}>
              <div style={{...S.statBadge,color:"#60c880",background:"rgba(60,180,100,0.12)",border:"1px solid rgba(60,180,100,0.3)"}}>✅ {masteredCount}</div>
              <div style={{...S.statBadge,color:"#f07050",background:"rgba(200,80,60,0.12)", border:"1px solid rgba(200,80,60,0.3)" }}>🔥 {hardCount}</div>
              <div style={{...S.statBadge,color:"#c4a050",background:"rgba(196,160,80,0.12)",border:"1px solid rgba(196,160,80,0.3)"}}>📖 {learningCount}</div>
            </div>
            <div style={{fontSize:"0.68rem",color:ttsReady?"#60c880":"#f07050"}}>
              {ttsReady?"🔊 Google TTS 연결됨":"⚠️ 브라우저 TTS 사용 중"}
            </div>
          </div>
        </header>

        {/* 자동저장 안내 */}
        <div style={S.autoSaveBanner}>
          💾 단어장이 이 기기에 자동저장돼요 — 앱을 닫아도 유지됩니다!
        </div>

        {/* ── LIST MODE ── */}
        {mode===MODES.LIST&&(
          <div>
            <div style={S.card}>
              <h2 style={S.cardTitle}>{editId!==null?"✏️ 단어 수정":"➕ 단어 추가"}</h2>
              <div className="form-row" style={S.formRow}>
                <input style={{...S.input,direction:"rtl",fontFamily:"'Frank Ruhl Libre',serif",fontSize:"1.15rem"}}
                  placeholder="עברית (히브리어)" value={newHebrew}
                  onChange={e=>setNewHebrew(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addWord()}/>
                <input style={S.input} placeholder="뜻 (한국어/영어)" value={newMeaning}
                  onChange={e=>setNewMeaning(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addWord()}/>
                <div style={{display:"flex",gap:"8px"}}>
                  <button style={{...S.btnAdd,flex:1}} onClick={addWord}>{editId!==null?"수정 완료":"추가"}</button>
                  {newHebrew&&<SpeakBtn text={newHebrew} onSpeak={speak}/>}
                  {editId!==null&&<button style={S.btnCancel} onClick={cancelEdit}>취소</button>}
                </div>
              </div>
            </div>

            <div className="io-bar" style={S.ioBar}>
              <div style={S.ioLeft}>
                <span style={S.ioTitle}>📤 다른 기기로 옮기기</span>
                <span style={S.ioSub}>파일로 내보내고 다른 기기에서 불러오세요</span>
              </div>
              <div style={S.ioBtns}>
                <button style={S.btnExport} onClick={exportWords}>⬇️ 내보내기</button>
                <button style={S.btnImportBtn} onClick={()=>fileInputRef.current.click()}>⬆️ 불러오기</button>
                <input ref={fileInputRef} type="file" accept=".json" style={{display:"none"}} onChange={handleFileChange}/>
              </div>
            </div>

            <div style={S.filterTabs}>
              {[["all","전체",words.length],["learning","📖 학습중",learningCount],["hard","🔥 어려움",hardCount],["mastered","✅ 완료",masteredCount]].map(([val,label,cnt])=>(
                <button key={val} style={{...S.filterTab,...(listFilter===val?S.filterTabActive:{})}} onClick={()=>setListFilter(val)}>
                  {label}<span style={S.filterCnt}>{cnt}</span>
                </button>
              ))}
            </div>

            <div style={S.wordList}>
              {filteredWords.length===0&&<div style={S.emptyMsg}>해당 상태의 단어가 없어요</div>}
              {filteredWords.map((w,i)=>{
                const st=STATUS_CONFIG[w.status];
                return(
                  <div key={w.id} style={{...S.wordItem,borderColor:st.border}}>
                    <span style={S.wordIndex}>{i+1}</span>
                    <div style={S.wordCenter}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                        <span style={S.wordHeb}>{w.hebrew}</span>
                        <SpeakBtn text={w.hebrew} onSpeak={speak}/>
                      </div>
                      <span style={S.wordMean}>{w.meaning}</span>
                    </div>
                    <div style={S.wordRight}>
                      <div style={S.statusBtns}>
                        {["learning","hard","mastered"].map(s=>{
                          const sc=STATUS_CONFIG[s];
                          return<button key={s} title={sc.label}
                            style={{...S.statusBtn,...(w.status===s?{background:sc.bg,borderColor:sc.border,opacity:1}:{})}}
                            onClick={()=>setManualStatus(w.id,s)}>{sc.emoji}</button>;
                        })}
                      </div>
                      <div style={S.wordActions}>
                        <button style={S.btnEdit} onClick={()=>startEdit(w)}>✏️</button>
                        <button style={S.btnDel}  onClick={()=>deleteWord(w.id)}>🗑️</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={S.card}>
              <h2 style={S.cardTitle}>🎯 퀴즈 설정</h2>
              <p style={S.settingLabel}>문제 방향</p>
              <div style={S.optionRow}>
                {[[QUIZ_TYPES.HEB_TO_MEAN,"히브리어 → 뜻"],[QUIZ_TYPES.MEAN_TO_HEB,"뜻 → 히브리어"],[QUIZ_TYPES.MIXED,"랜덤 혼합"]].map(([val,label])=>(
                  <button key={val} style={{...S.optBtn,...(quizType===val?S.optBtnActive:{})}} onClick={()=>setQuizType(val)}>{label}</button>
                ))}
              </div>
              <p style={S.settingLabel}>단어 범위</p>
              <div style={S.optionRow}>
                {[[QUIZ_FILTERS.ALL,`전체 (${words.length})`],[QUIZ_FILTERS.EXCLUDE_MASTERED,`암기 제외 (${words.filter(w=>w.status!=="mastered").length})`],[QUIZ_FILTERS.HARD_ONLY,`🔥 어려운 것만 (${hardCount})`]].map(([val,label])=>(
                  <button key={val} style={{...S.optBtn,...(quizFilter===val?S.optBtnActive:{})}} onClick={()=>setQuizFilter(val)}>{label}</button>
                ))}
              </div>
              <p style={S.settingLabel}>문제 수 <span style={{color:"#5a5870",fontWeight:400,textTransform:"none",letterSpacing:0}}>(가능: {poolSize}개)</span></p>
              <div style={S.optionRow}>
                {countOptions.map(({label,value})=>{
                  const isDisabled=value!==9999&&value>poolSize;
                  return<button key={value} style={{...S.optBtn,...(quizCount===value?S.optBtnActive:{}),...(isDisabled?{opacity:0.3,cursor:"not-allowed"}:{})}}
                    onClick={()=>!isDisabled&&setQuizCount(value)} disabled={isDisabled}>{label}</button>;
                })}
              </div>
              <div style={S.sliderWrap}>
                <span style={S.sliderLabel}>직접:</span>
                <input type="range" min={4} max={Math.max(4,poolSize)} value={Math.min(quizCount===9999?poolSize:quizCount,poolSize)}
                  onChange={e=>setQuizCount(Number(e.target.value))} style={S.slider}/>
                <span style={S.sliderVal}>{quizCount===9999?poolSize:Math.min(quizCount,poolSize)}문제</span>
              </div>
              <div style={S.autoPlayRow}>
                <div>
                  <div style={{fontSize:"0.85rem",color:"#c4a050",fontWeight:600}}>🔊 퀴즈 자동 발음</div>
                  <div style={{fontSize:"0.75rem",color:"#5a5870",marginTop:"2px"}}>히브리어 문제 시 자동 재생</div>
                </div>
                <button onClick={()=>setAutoPlay(v=>!v)} style={{...S.toggleBtn,...(autoPlay?S.toggleOn:S.toggleOff)}}>
                  {autoPlay?"ON":"OFF"}
                </button>
              </div>
              <button style={{...S.btnStart,...(poolSize<4?S.btnDisabled:{})}} onClick={startQuiz} disabled={poolSize<4}>
                {poolSize<4?`단어 최소 4개 필요 (현재 ${poolSize}개)`:`🚀 퀴즈 시작! (${quizCount===9999?poolSize:Math.min(quizCount,poolSize)}문제)`}
              </button>
            </div>
          </div>
        )}

        {/* ── QUIZ MODE ── */}
        {mode===MODES.QUIZ&&q&&(
          <div key={animKey}>
            <div style={S.progressBar}><div style={{...S.progressFill,width:`${progress}%`}}/></div>
            <div style={S.progressLabel}>
              <span>{current+1} / {questions.length}</span>
              <span style={S.scoreLabel}>점수: {score} / {current+(confirmed?1:0)}</span>
            </div>
            <div style={S.questionCard}>
              <div style={S.questionTag}>{q.questionType===QUIZ_TYPES.HEB_TO_MEAN?"히브리어의 뜻은?":"뜻에 해당하는 히브리어는?"}</div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"12px"}}>
                <div style={{...S.questionText,...(q.questionType===QUIZ_TYPES.HEB_TO_MEAN?{fontFamily:"'Frank Ruhl Libre',serif",fontSize:"clamp(2rem,8vw,3rem)",direction:"rtl"}:{fontSize:"clamp(1.1rem,4vw,1.5rem)"})}}>
                  {q.question}
                </div>
                <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
                  {q.questionType===QUIZ_TYPES.HEB_TO_MEAN?(
                    <><SpeakBtn text={q.question} onSpeak={speak} size="lg"/>
                    <span style={{fontSize:"0.75rem",color:"#5a5870"}}>탭하면 다시 들을 수 있어요</span></>
                  ):confirmed?(
                    <><SpeakBtn text={q.answer} onSpeak={speak} size="lg"/>
                    <span style={{fontSize:"0.75rem",color:"#5a5870"}}>정답 발음 듣기</span></>
                  ):null}
                </div>
              </div>
              {(()=>{const w=words.find(x=>x.id===q.wordId);const st=w?STATUS_CONFIG[w.status]:null;
                return st?<div style={{...S.statusPill,color:st.color,background:st.bg,border:`1px solid ${st.border}`}}>{st.emoji} {st.label}</div>:null;})()}
            </div>
            <div className="choices-grid" style={S.choicesGrid}>
              {q.choices.map((choice,idx)=>{
                let extra={};
                if(confirmed){if(choice===q.answer)extra=S.choiceCorrect;else if(choice===selected)extra=S.choiceWrong;}
                else if(choice===selected)extra=S.choiceSelected;
                return(
                  <button key={idx} style={{...S.choiceBtn,...extra}} onClick={()=>handleSelect(choice)}>
                    <span style={S.choiceAlpha}>{"ABCD"[idx]}</span>
                    <span style={q.questionType===QUIZ_TYPES.MEAN_TO_HEB?{fontFamily:"'Frank Ruhl Libre',serif",fontSize:"1.2rem",direction:"rtl"}:{}}>{choice}</span>
                    {q.questionType===QUIZ_TYPES.MEAN_TO_HEB&&(
                      <span style={{marginLeft:"auto"}} onClick={e=>{e.stopPropagation();speak(choice);}}>🔈</span>
                    )}
                  </button>
                );
              })}
            </div>
            {confirmed&&(
              <div style={selected===q.answer?S.feedbackCorrect:S.feedbackWrong}>
                {selected===q.answer?"✅ 정답!":`❌ 오답 — 정답: ${q.answer}`}
                {(()=>{const w=words.find(x=>x.id===q.wordId);const st=w?STATUS_CONFIG[w.status]:null;
                  return st?<span style={{marginLeft:8,fontSize:"0.78rem",opacity:0.8}}>{st.emoji} {st.label}로 업데이트됨</span>:null;})()}
              </div>
            )}
            <div className="quiz-btn-row" style={S.quizBtnRow}>
              {!confirmed
                ?<button style={{...S.btnConfirm,...(!selected?S.btnDisabled:{})}} onClick={handleConfirm} disabled={!selected}>확인</button>
                :<button style={S.btnNext} onClick={handleNext}>{current+1>=questions.length?"결과 보기 🏁":"다음 문제 →"}</button>
              }
              <button style={S.btnQuit} onClick={()=>{window.speechSynthesis?.cancel();setMode(MODES.LIST);}}>그만하기</button>
            </div>
          </div>
        )}

        {/* ── RESULT MODE ── */}
        {mode===MODES.RESULT&&(
          <div style={S.resultWrap}>
            <div style={S.resultCircle}>
              <span style={S.resultScore}>{score}</span>
              <span style={S.resultTotal}>/{questions.length}</span>
            </div>
            <p style={S.resultMsg}>
              {score===questions.length?"🎉 완벽해요! 모두 맞혔습니다!"
                :score>=questions.length*0.7?"👏 잘했어요! 거의 다 맞혔네요."
                :score>=questions.length*0.5?"💪 괜찮아요. 조금 더 연습해봐요!"
                :"📖 틀린 단어를 복습해봐요!"}
            </p>
            <p style={S.resultPct}>정답률: {Math.round(score/questions.length*100)}%</p>
            <div style={S.resultStats}>
              {[["mastered","✅ 암기완료","#60c880"],["hard","🔥 어려움","#f07050"],["learning","📖 학습중","#9090b0"]].map(([st,label,color])=>(
                <div key={st} style={{...S.resultStatItem,color}}>
                  <span style={S.resultStatNum}>{words.filter(w=>w.status===st).length}</span>
                  <span style={S.resultStatLabel}>{label}</span>
                </div>
              ))}
            </div>
            {wrongWords.length>0&&(
              <div style={S.wrongList}>
                <h3 style={S.wrongTitle}>❌ 틀린 단어 — 다시 들어보세요</h3>
                {wrongWords.map((q,i)=>{
                  const w=words.find(x=>x.id===q.wordId);
                  return w?(
                    <div key={i} style={S.wrongItem}>
                      <span style={{fontFamily:"'Frank Ruhl Libre',serif",fontSize:"1.1rem",direction:"rtl",color:"#c4a050"}}>{w.hebrew}</span>
                      <SpeakBtn text={w.hebrew} onSpeak={speak}/>
                      <span style={{color:"#a0a0b0",margin:"0 4px"}}>→</span>
                      <span style={{fontSize:"0.9rem"}}>{w.meaning}</span>
                    </div>
                  ):null;
                })}
              </div>
            )}
            <div className="result-btn-row" style={S.resultBtnRow}>
              <button style={{...S.btnStart,flex:1}} onClick={startQuiz}>🔄 다시 풀기</button>
              <button style={{...S.btnQuit,flex:1}} onClick={()=>setMode(MODES.LIST)}>📚 단어장으로</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const S={
  root:{minHeight:"100vh",background:"#0f0e17",color:"#e8e6f0",fontFamily:"'Noto Sans KR','Segoe UI',sans-serif",position:"relative",overflow:"hidden",padding:"16px 0 80px"},
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
  modalPreview:{background:"rgba(255,255,255,0.04)",borderRadius:"10px",padding:"10px",marginBottom:"14px",maxHeight:"150px",overflowY:"auto"},
  modalPreviewItem:{padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",alignItems:"center",fontSize:"0.88rem",gap:"4px"},
  modalBtnRow:{display:"flex",gap:"8px"},
  btnMerge:{flex:1,padding:"12px 10px",borderRadius:"10px",background:"linear-gradient(135deg,#c4a050,#e8c875)",border:"none",color:"#1a1820",fontWeight:700,cursor:"pointer",fontSize:"0.88rem"},
  btnReplace:{flex:1,padding:"12px 10px",borderRadius:"10px",background:"rgba(100,80,200,0.3)",border:"1px solid rgba(100,80,200,0.5)",color:"#c0b0ff",fontWeight:600,cursor:"pointer",fontSize:"0.88rem"},
  btnCancel2:{padding:"12px 14px",borderRadius:"10px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#7a7890",cursor:"pointer",fontSize:"0.88rem"},
  header:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px",padding:"14px 16px",background:"rgba(255,255,255,0.04)",borderRadius:"16px",border:"1px solid rgba(196,160,80,0.2)"},
  headerLeft:{display:"flex",alignItems:"center",gap:"12px"},
  logo:{fontSize:"1.6rem",fontFamily:"'Frank Ruhl Libre','Times New Roman',serif",color:"#c4a050",background:"rgba(196,160,80,0.15)",width:"44px",height:"44px",borderRadius:"10px",display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid rgba(196,160,80,0.3)",flexShrink:0},
  title:{margin:0,fontSize:"1rem",fontWeight:700,color:"#f0ece0"},
  subtitle:{margin:"2px 0 0",fontSize:"0.68rem",color:"#7a7890"},
  statsRow:{display:"flex",gap:"5px"},
  statBadge:{borderRadius:"8px",padding:"5px 9px",fontSize:"0.78rem",fontWeight:600},
  ioBar:{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(196,160,80,0.06)",border:"1px solid rgba(196,160,80,0.15)",borderRadius:"14px",padding:"14px 16px",marginBottom:"14px",gap:"12px"},
  ioLeft:{display:"flex",flexDirection:"column",gap:"3px"},
  ioTitle:{fontSize:"0.88rem",fontWeight:600,color:"#c4a050"},
  ioSub:{fontSize:"0.74rem",color:"#5a5870"},
  ioBtns:{display:"flex",gap:"8px",flexShrink:0},
  btnExport:{padding:"10px 14px",borderRadius:"9px",background:"linear-gradient(135deg,#c4a050,#e8c875)",border:"none",color:"#1a1820",fontWeight:700,cursor:"pointer",fontSize:"0.82rem"},
  btnImportBtn:{padding:"10px 14px",borderRadius:"9px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(196,160,80,0.3)",color:"#c4a050",fontWeight:600,cursor:"pointer",fontSize:"0.82rem"},
  card:{background:"rgba(255,255,255,0.04)",borderRadius:"16px",border:"1px solid rgba(255,255,255,0.08)",padding:"16px",marginBottom:"12px"},
  cardTitle:{margin:"0 0 12px",fontSize:"0.9rem",fontWeight:600,color:"#c4a050"},
  formRow:{display:"flex",gap:"8px",flexDirection:"column"},
  input:{width:"100%",padding:"12px 14px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"10px",color:"#e8e6f0",fontSize:"1rem",outline:"none",fontFamily:"inherit"},
  btnAdd:{padding:"12px 18px",borderRadius:"10px",background:"linear-gradient(135deg,#c4a050,#e8c875)",border:"none",color:"#1a1820",fontWeight:700,cursor:"pointer",fontSize:"0.95rem"},
  btnCancel:{padding:"12px 14px",borderRadius:"10px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",color:"#a0a0b0",cursor:"pointer",fontSize:"0.9rem"},
  filterTabs:{display:"flex",gap:"6px",marginBottom:"12px",flexWrap:"wrap"},
  filterTab:{padding:"8px 12px",borderRadius:"8px",border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"#7a7890",cursor:"pointer",fontSize:"0.8rem"},
  filterTabActive:{background:"rgba(196,160,80,0.15)",borderColor:"rgba(196,160,80,0.4)",color:"#c4a050"},
  filterCnt:{background:"rgba(255,255,255,0.1)",borderRadius:"4px",padding:"1px 5px",marginLeft:"4px",fontSize:"0.7rem"},
  wordList:{display:"flex",flexDirection:"column",gap:"8px",marginBottom:"12px"},
  emptyMsg:{textAlign:"center",color:"#4a4860",padding:"24px",fontSize:"0.9rem"},
  wordItem:{display:"flex",alignItems:"center",gap:"10px",background:"rgba(255,255,255,0.03)",borderRadius:"12px",border:"1px solid",padding:"12px 14px"},
  wordIndex:{fontSize:"0.7rem",color:"#4a4860",minWidth:"16px",flexShrink:0},
  wordCenter:{display:"flex",flexDirection:"column",gap:"4px",flex:1,minWidth:0},
  wordHeb:{fontFamily:"'Frank Ruhl Libre','Times New Roman',serif",fontSize:"1.15rem",color:"#c4a050",direction:"rtl"},
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
  sliderWrap:{display:"flex",alignItems:"center",gap:"10px",marginBottom:"14px",padding:"10px 14px",background:"rgba(255,255,255,0.03)",borderRadius:"10px",border:"1px solid rgba(255,255,255,0.06)"},
  sliderLabel:{fontSize:"0.8rem",color:"#5a5870",flexShrink:0},
  slider:{flex:1,accentColor:"#c4a050",cursor:"pointer"},
  sliderVal:{fontSize:"0.88rem",fontWeight:700,color:"#c4a050",minWidth:"44px",textAlign:"right",flexShrink:0},
  autoPlayRow:{display:"flex",alignItems:"center",justifyContent:"space-between",background:"rgba(196,160,80,0.06)",border:"1px solid rgba(196,160,80,0.15)",borderRadius:"12px",padding:"12px 14px",marginBottom:"14px"},
  toggleBtn:{padding:"7px 16px",borderRadius:"20px",border:"none",fontWeight:700,cursor:"pointer",fontSize:"0.85rem"},
  toggleOn:{background:"linear-gradient(135deg,#c4a050,#e8c875)",color:"#1a1820"},
  toggleOff:{background:"rgba(255,255,255,0.08)",color:"#7a7890"},
  btnStart:{width:"100%",padding:"14px",borderRadius:"12px",background:"linear-gradient(135deg,#c4a050,#e8c875)",border:"none",color:"#1a1820",fontWeight:800,cursor:"pointer",fontSize:"1rem"},
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
  feedbackCorrect:{textAlign:"center",padding:"12px",borderRadius:"10px",background:"rgba(60,180,100,0.15)",border:"1px solid rgba(60,180,100,0.3)",color:"#80e8a0",fontWeight:600,marginBottom:"14px",fontSize:"0.95rem"},
  feedbackWrong:{textAlign:"center",padding:"12px",borderRadius:"10px",background:"rgba(200,60,60,0.15)",border:"1px solid rgba(200,60,60,0.3)",color:"#f08080",fontWeight:600,marginBottom:"14px",fontSize:"0.95rem"},
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
