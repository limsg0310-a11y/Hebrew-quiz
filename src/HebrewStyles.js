// ── HebrewQuiz — 디자인 스타일 (캘린더 앱 참고 개선)
export const S = {
  // ── 루트
  root: { minHeight:"100vh", background:"#0e0c18", color:"#e8e6f0", fontFamily:"-apple-system,'Helvetica Neue','Noto Sans KR',sans-serif", position:"relative" },
  container: { maxWidth:"600px", margin:"0 auto", padding:"16px 16px 80px" },

  // ── 헤더
  header: { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"10px", gap:"10px" },
  headerLeft: { display:"flex", alignItems:"center", gap:"12px" },
  logo: { width:"44px", height:"44px", borderRadius:"14px", background:"linear-gradient(135deg,#c4a050,#e8c875)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.1rem", fontWeight:800, color:"#1a1620", flexShrink:0, fontFamily:"Arial,sans-serif" },
  title: { margin:0, fontSize:"1.25rem", fontWeight:700, color:"#f0ece0", letterSpacing:"-0.3px" },
  subtitle: { margin:0, fontSize:"0.72rem", color:"#5a5870", marginTop:"2px" },
  statsRow: { display:"flex", gap:"6px", flexWrap:"wrap", justifyContent:"flex-end" },
  statBadge: { fontSize:"0.75rem", fontWeight:600, padding:"4px 10px", borderRadius:"100px" },

  // ── 자동저장 배너
  autoSaveBanner: { fontSize:"0.73rem", padding:"8px 12px", borderRadius:"10px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(196,160,80,0.12)", color:"#c4a050", marginBottom:"14px", textAlign:"center" },

  // ── 카드
  card: { background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"18px", padding:"16px", marginBottom:"10px" },
  ioCard: { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"18px", padding:"14px 16px", marginBottom:"10px" },
  ioSub: { fontSize:"0.72rem", color:"#5a5870" },

  // ── 필터 탭 — 캘린더 Day/Week/Month 스타일
  filterTabs: {
    display:"flex", gap:"4px", marginBottom:"12px",
    background:"rgba(255,255,255,0.06)", borderRadius:"14px", padding:"4px",
    overflowX:"auto", WebkitOverflowScrolling:"touch",
    scrollbarWidth:"none",
  },
  filterTab: {
    display:"flex", alignItems:"center", gap:"5px",
    padding:"8px 14px", borderRadius:"10px",
    border:"1px solid transparent", cursor:"pointer",
    fontSize:"0.82rem", fontWeight:400, whiteSpace:"nowrap",
    background:"transparent", color:"#5a5870",
    transition:"all 0.15s", flexShrink:0,
  },
  filterTabActive: {
    background:"rgba(196,160,80,0.18)", borderColor:"rgba(196,160,80,0.45)",
    color:"#c4a050", fontWeight:700,
  },
  filterCnt: {
    fontSize:"0.68rem", background:"rgba(255,255,255,0.07)",
    borderRadius:"100px", padding:"1px 6px", color:"#7a7890",
  },

  // ── 단어 목록 — 캘린더 이벤트 리스트 스타일
  wordList: {
    borderRadius:"16px", overflow:"hidden",
    border:"1px solid rgba(255,255,255,0.07)",
    marginBottom:"14px",
  },
  wordItem: (isFirst, isLast, status) => {
    const ST = {
      learning: "rgba(120,120,180,0.5)",
      mastered: "rgba(60,180,100,0.6)",
      hard:     "rgba(200,80,60,0.6)",
    };
    return {
      display:"flex", alignItems:"center", gap:"10px",
      background:"rgba(255,255,255,0.025)",
      borderTop: isFirst ? "none" : "1px solid rgba(255,255,255,0.05)",
      borderLeft: `3px solid ${ST[status]||"rgba(120,120,180,0.4)"}`,
      padding:"13px 14px",
      borderRadius: isFirst&&isLast?"16px" : isFirst?"16px 16px 0 0" : isLast?"0 0 16px 16px":"0",
    };
  },
  wordItemSelected: { background:"rgba(200,60,60,0.07)" },

  // ── 입력
  input: { width:"100%", padding:"10px 14px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"12px", color:"#e8e6f0", fontSize:"0.9rem", outline:"none" },

  // ── 버튼들
  btnAdd: { padding:"11px 20px", borderRadius:"12px", background:"linear-gradient(135deg,#c4a050,#e8c875)", border:"none", color:"#1a1620", fontWeight:700, cursor:"pointer", fontSize:"0.9rem" },
  btnEdit: { padding:"4px 10px", borderRadius:"8px", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)", color:"rgba(255,255,255,0.55)", cursor:"pointer", fontSize:"0.78rem" },
  btnCancel: { padding:"11px 16px", borderRadius:"12px", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:"0.88rem" },
  btnMerge: { padding:"11px 20px", borderRadius:"12px", background:"rgba(196,160,80,0.2)", border:"1px solid rgba(196,160,80,0.4)", color:"#c4a050", cursor:"pointer", fontWeight:700, fontSize:"0.9rem" },
  btnReplace: { padding:"11px 20px", borderRadius:"12px", background:"rgba(200,60,60,0.15)", border:"1px solid rgba(200,60,60,0.35)", color:"#f08080", cursor:"pointer", fontWeight:700, fontSize:"0.9rem" },
  btnCancel2: { padding:"11px 20px", borderRadius:"12px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"#7a7890", cursor:"pointer", fontSize:"0.88rem", width:"100%" },
  btnIO: (color="#c4a050", bg="rgba(196,160,80,0.1)", border="rgba(196,160,80,0.25)") => ({
    padding:"8px 14px", borderRadius:"10px", background:bg,
    border:`1px solid ${border}`, color, cursor:"pointer",
    fontSize:"0.8rem", fontWeight:600, flexShrink:0,
  }),
  btnStart: { width:"100%", padding:"15px", borderRadius:"14px", background:"linear-gradient(135deg,#c4a050,#e8c875)", border:"none", color:"#1a1620", fontWeight:800, cursor:"pointer", fontSize:"1.05rem" },
  btnDisabled: { opacity:0.35, cursor:"not-allowed", background:"rgba(255,255,255,0.07)", color:"#7a7890" },
  scrollBtn: { padding:"5px 12px", borderRadius:"8px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"#8a8a9a", cursor:"pointer", fontSize:"0.75rem" },
  floatBtn: { position:"fixed", bottom:"24px", right:"16px", zIndex:20, width:"40px", height:"40px", borderRadius:"50%", background:"rgba(196,160,80,0.2)", border:"1px solid rgba(196,160,80,0.4)", color:"#c4a050", cursor:"pointer", fontSize:"1rem", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700 },

  // ── 세팅 레이블
  settingLabel: { fontSize:"0.75rem", fontWeight:600, color:"#5a5870", textTransform:"uppercase", letterSpacing:"0.8px", margin:"0 0 8px" },
  optionRow: { display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"14px" },

  // ── 퀴즈 카드
  progressBar: { height:"3px", background:"rgba(255,255,255,0.07)", borderRadius:"2px", marginBottom:"8px", overflow:"hidden" },
  progressFill: { height:"100%", background:"linear-gradient(90deg,#c4a050,#e8c875)", borderRadius:"2px", transition:"width 0.3s ease" },
  progressLabel: { display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:"0.8rem", color:"#7a7890", marginBottom:"16px" },
  questionCard: { background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"20px", padding:"28px 24px", marginBottom:"18px", textAlign:"center" },
  questionTag: { fontSize:"0.72rem", color:"#c4a050", fontWeight:600, background:"rgba(196,160,80,0.1)", border:"1px solid rgba(196,160,80,0.25)", padding:"4px 12px", borderRadius:"100px", display:"inline-block", marginBottom:"16px", textTransform:"uppercase", letterSpacing:"0.5px" },
  questionText: { color:"#f0ece0", lineHeight:1.4 },
  choicesGrid: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"14px" },
  choiceBtn: { padding:"14px 16px", borderRadius:"14px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", color:"#e8e6f0", cursor:"pointer", fontSize:"0.9rem", textAlign:"left", display:"flex", alignItems:"center", gap:"10px", transition:"all 0.15s" },
  choiceSelected: { background:"rgba(196,160,80,0.15)", borderColor:"rgba(196,160,80,0.5)", color:"#c4a050" },
  choiceCorrect: { background:"rgba(60,180,100,0.15)", borderColor:"rgba(60,180,100,0.5)", color:"#60c880" },
  choiceWrong: { background:"rgba(200,60,60,0.15)", borderColor:"rgba(200,60,60,0.5)", color:"#f07050" },
  choiceAlpha: { width:"26px", height:"26px", borderRadius:"8px", background:"rgba(255,255,255,0.07)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.75rem", fontWeight:700, color:"#7a7890", flexShrink:0 },
  feedbackCorrect: { background:"rgba(60,180,100,0.12)", border:"1px solid rgba(60,180,100,0.3)", borderRadius:"12px", padding:"12px 16px", color:"#60c880", fontSize:"0.95rem", fontWeight:600, textAlign:"center" },
  feedbackWrong: { background:"rgba(200,60,60,0.12)", border:"1px solid rgba(200,60,60,0.3)", borderRadius:"12px", padding:"12px 16px", color:"#f07050", fontSize:"0.95rem", fontWeight:600, textAlign:"center" },

  // ── 서술형 퀴즈
  essayInput: { width:"100%", padding:"16px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:"14px", color:"#e8e6f0", fontSize:"1rem", outline:"none", resize:"none", minHeight:"80px" },

  // ── 모달
  modalOverlay: { position:"fixed", inset:0, background:"rgba(10,8,20,0.88)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:"20px", backdropFilter:"blur(6px)" },
  modal: { background:"#18162c", border:"1px solid rgba(255,255,255,0.12)", borderRadius:"20px", padding:"24px", width:"100%", maxWidth:"460px", maxHeight:"88vh", overflowY:"auto" },
  modalTitle: { margin:"0 0 8px", fontSize:"1.1rem", fontWeight:700, color:"#f0ece0" },
  modalSub: { margin:"0 0 14px", fontSize:"0.82rem", color:"#7a7890" },
  modalTA: { width:"100%", minHeight:"110px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"12px", color:"#e8e6f0", padding:"12px 14px", fontSize:"0.88rem", outline:"none", resize:"vertical" },
  modalBtnRow: { display:"flex", gap:"8px", marginTop:"14px" },
  modalPreview: { background:"rgba(255,255,255,0.03)", borderRadius:"12px", padding:"12px 14px", marginBottom:"14px", maxHeight:"150px", overflowY:"auto" },
  modalPreviewItem: { padding:"6px 0", borderBottom:"1px solid rgba(255,255,255,0.05)", display:"flex", alignItems:"center", fontSize:"0.88rem", gap:"8px" },

  // ── 빈 상태
  emptyMsg: { textAlign:"center", padding:"36px 16px", color:"#5a5870", fontSize:"0.88rem" },

  // ── 폼
  formRow: { display:"flex", flexDirection:"column", gap:"8px" },
};

// ── 인라인 필 버튼 헬퍼
export const pillBtn = (active) => ({
  padding:"8px 16px", borderRadius:"100px", border:"none",
  cursor:"pointer", fontSize:"0.82rem",
  fontWeight:active?700:400,
  background:active?"rgba(255,255,255,0.13)":"transparent",
  color:active?"#ffffff":"#5a5870",
  transition:"all 0.15s",
});

export const smallPillBtn = (active, color="#c4a050") => ({
  padding:"6px 13px", borderRadius:"100px",
  border:`1px solid ${active?"rgba(196,160,80,0.45)":"rgba(255,255,255,0.1)"}`,
  cursor:"pointer", fontSize:"0.78rem",
  fontWeight:active?600:400,
  background:active?"rgba(196,160,80,0.15)":"rgba(255,255,255,0.04)",
  color:active?color:"#5a5870",
  transition:"all 0.15s",
});

export const STATUS_CONFIG = {
  learning: { labelKo:"학습중",   labelEn:"Learning", emoji:"📖", color:"#9090b8", bg:"rgba(120,120,180,0.12)", border:"rgba(120,120,180,0.35)" },
  mastered: { labelKo:"암기완료", labelEn:"Mastered", emoji:"✅", color:"#60c880", bg:"rgba(60,180,100,0.12)",  border:"rgba(60,180,100,0.4)" },
  hard:     { labelKo:"어려움",   labelEn:"Hard",     emoji:"🔥", color:"#f07050", bg:"rgba(200,80,60,0.12)",   border:"rgba(200,80,60,0.4)" },
};
