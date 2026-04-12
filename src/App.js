/* eslint-disable */
import { useState, useRef, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, onSnapshot, query, orderBy, limit, where, getDocs, updateDoc, serverTimestamp, deleteDoc } from "firebase/firestore";

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
  { id:1, hebrew:"שָׁלוֹם", meaning:"평화 / 안녕", status:"learning", streak:0, wrongCount:0 },
  { id:2, hebrew:"תּוֹדָה", meaning:"감사합니다", status:"learning", streak:0, wrongCount:0 },
  { id:3, hebrew:"בְּרֵאשִׁית", meaning:"태초에", status:"learning", streak:0, wrongCount:0 },
  { id:4, hebrew:"אֱלֹהִים", meaning:"하나님", status:"learning", streak:0, wrongCount:0 },
  { id:5, hebrew:"אֶרֶץ", meaning:"땅 / 나라", status:"learning", streak:0, wrongCount:0 },
  { id:6, hebrew:"מַיִם", meaning:"물", status:"learning", streak:0, wrongCount:0 },
  { id:7, hebrew:"אוֹר", meaning:"빛", status:"learning", streak:0, wrongCount:0 },
  { id:8, hebrew:"לֵב", meaning:"마음 / 심장", status:"learning", streak:0, wrongCount:0 },
];

const MODES = { LIST:"list", QUIZ:"quiz", ESSAY:"essay", RESULT:"result", ESSAY_RESULT:"essay_result", VARIANT:"variant", VARIANT_RESULT:"variant_result" };
const QUIZ_TYPES = { HEB_TO_MEAN:"heb_to_mean", MEAN_TO_HEB:"mean_to_heb", MIXED:"mixed" };
const QUIZ_FILTERS = { ALL:"all", LEARNING_ONLY:"learning_only", EXCLUDE_MASTERED:"exclude_mastered", HARD_ONLY:"hard_only" };

const VARIANT_TYPES = [
  { id:"gender_f",  label:{ko:"여성형 단수",en:"Feminine sg."},    prompt:{ko:"여성형 단수는?",en:"Feminine singular?"} },
  { id:"gender_m",  label:{ko:"남성형 단수",en:"Masculine sg."},   prompt:{ko:"남성형 단수는?",en:"Masculine singular?"} },
  { id:"plural_m",  label:{ko:"남성형 복수",en:"Masculine pl."},   prompt:{ko:"남성형 복수는?",en:"Masculine plural?"} },
  { id:"plural_f",  label:{ko:"여성형 복수",en:"Feminine pl."},    prompt:{ko:"여성형 복수는?",en:"Feminine plural?"} },
  { id:"past_1s",   label:{ko:"과거 — 나",en:"Past — I"},          prompt:{ko:"אני 과거",en:"אני (past)"} },
  { id:"past_2ms",  label:{ko:"과거 — 너M",en:"Past — You M"},     prompt:{ko:"אתה 과거",en:"אתה (past)"} },
  { id:"past_2fs",  label:{ko:"과거 — 너F",en:"Past — You F"},     prompt:{ko:"את 과거",en:"את (past)"} },
  { id:"past_3ms",  label:{ko:"과거 — 그",en:"Past — He"},         prompt:{ko:"הוא 과거",en:"הוא (past)"} },
  { id:"past_3fs",  label:{ko:"과거 — 그녀",en:"Past — She"},      prompt:{ko:"היא 과거",en:"היא (past)"} },
  { id:"past_1p",   label:{ko:"과거 — 우리",en:"Past — We"},       prompt:{ko:"אנחנו 과거",en:"אנחנו (past)"} },
  { id:"past_2mp",  label:{ko:"과거 — 너희M",en:"Past — You pl.M"},prompt:{ko:"אתם 과거",en:"אתם (past)"} },
  { id:"past_2fp",  label:{ko:"과거 — 너희F",en:"Past — You pl.F"},prompt:{ko:"אתן 과거",en:"אתן (past)"} },
  { id:"past_3mp",  label:{ko:"과거 — 그들M",en:"Past — They M"},  prompt:{ko:"הם 과거",en:"הם (past)"} },
  { id:"past_3fp",  label:{ko:"과거 — 그들F",en:"Past — They F"},  prompt:{ko:"הן 과거",en:"הן (past)"} },
  { id:"pres_ms",   label:{ko:"현재 — 남단수",en:"Present — M sg."},prompt:{ko:"현재 남단?",en:"M sg. (present)"} },
  { id:"pres_fs",   label:{ko:"현재 — 여단수",en:"Present — F sg."},prompt:{ko:"현재 여단?",en:"F sg. (present)"} },
  { id:"pres_mp",   label:{ko:"현재 — 남복수",en:"Present — M pl."},prompt:{ko:"현재 남복?",en:"M pl. (present)"} },
  { id:"pres_fp",   label:{ko:"현재 — 여복수",en:"Present — F pl."},prompt:{ko:"현재 여복?",en:"F pl. (present)"} },
  { id:"fut_1s",    label:{ko:"미래 — 나",en:"Future — I"},         prompt:{ko:"אני 미래",en:"אני (future)"} },
  { id:"fut_2ms",   label:{ko:"미래 — 너M",en:"Future — You M"},    prompt:{ko:"אתה 미래",en:"אתה (future)"} },
  { id:"fut_2fs",   label:{ko:"미래 — 너F",en:"Future — You F"},    prompt:{ko:"את 미래",en:"את (future)"} },
  { id:"fut_3ms",   label:{ko:"미래 — 그",en:"Future — He"},        prompt:{ko:"הוא 미래",en:"הוא (future)"} },
  { id:"fut_3fs",   label:{ko:"미래 — 그녀",en:"Future — She"},     prompt:{ko:"היא 미래",en:"היא (future)"} },
  { id:"fut_1p",    label:{ko:"미래 — 우리",en:"Future — We"},      prompt:{ko:"אנחנו 미래",en:"אנחנו (future)"} },
  { id:"fut_2mp",   label:{ko:"미래 — 너희M",en:"Future — You pl.M"},prompt:{ko:"אתם 미래",en:"אתם (future)"} },
  { id:"fut_2fp",   label:{ko:"미래 — 너희F",en:"Future — You pl.F"},prompt:{ko:"אתן 미래",en:"אתן (future)"} },
  { id:"fut_3mp",   label:{ko:"미래 — 그들M",en:"Future — They M"}, prompt:{ko:"הם 미래",en:"הם (future)"} },
  { id:"fut_3fp",   label:{ko:"미래 — 그들F",en:"Future — They F"}, prompt:{ko:"הן 미래",en:"הן (future)"} },
  { id:"imp_2ms",   label:{ko:"명령 — 너M",en:"Imp. — You M"},      prompt:{ko:"אתה 해라!",en:"אתה Do!"} },
  { id:"imp_2fs",   label:{ko:"명령 — 너F",en:"Imp. — You F"},      prompt:{ko:"את 해라!",en:"את Do!"} },
  { id:"imp_2mp",   label:{ko:"명령 — 너희M",en:"Imp. — pl.M"},     prompt:{ko:"אתם 해라!",en:"אתם Do!"} },
  { id:"imp_2fp",   label:{ko:"명령 — 너희F",en:"Imp. — pl.F"},     prompt:{ko:"אתן 해라!",en:"אתן Do!"} },
  { id:"poss_1s",   label:{ko:"소유 — 나의",en:"Poss. — My"},       prompt:{ko:"나의 ~?",en:"My ~?"} },
  { id:"poss_2ms",  label:{ko:"소유 — 너의M",en:"Poss. — Your M"},  prompt:{ko:"너의(남)~?",en:"Your M ~?"} },
  { id:"poss_2fs",  label:{ko:"소유 — 너의F",en:"Poss. — Your F"},  prompt:{ko:"너의(여)~?",en:"Your F ~?"} },
  { id:"poss_3ms",  label:{ko:"소유 — 그의",en:"Poss. — His"},      prompt:{ko:"그의 ~?",en:"His ~?"} },
  { id:"poss_3fs",  label:{ko:"소유 — 그녀의",en:"Poss. — Her"},    prompt:{ko:"그녀의 ~?",en:"Her ~?"} },
  { id:"poss_1p",   label:{ko:"소유 — 우리의",en:"Poss. — Our"},    prompt:{ko:"우리의 ~?",en:"Our ~?"} },
  { id:"poss_2mp",  label:{ko:"소유 — 너희M",en:"Poss. — pl.M"},    prompt:{ko:"너희(남)~?",en:"Your pl.M ~?"} },
  { id:"poss_2fp",  label:{ko:"소유 — 너희F",en:"Poss. — pl.F"},    prompt:{ko:"너희(여)~?",en:"Your pl.F ~?"} },
  { id:"poss_3mp",  label:{ko:"소유 — 그들M",en:"Poss. — Their M"}, prompt:{ko:"그들(남)~?",en:"Their M ~?"} },
  { id:"poss_3fp",  label:{ko:"소유 — 그들F",en:"Poss. — Their F"}, prompt:{ko:"그들(여)~?",en:"Their F ~?"} },
  { id:"infinitive",label:{ko:"to부정사",en:"Infinitive"},           prompt:{ko:"동사 원형은?",en:"Infinitive?"} },
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

const WORD_TYPES = [
  { id:"verb",    label:{ko:"동사",en:"Verb"},      emoji:"🔵", cats:["infinitive","past","present","future","imperative"] },
  { id:"noun",    label:{ko:"명사",en:"Noun"},      emoji:"🟡", cats:["gender","plural","poss"] },
  { id:"adj",     label:{ko:"형용사",en:"Adjective"},emoji:"🟠", cats:["gender","plural"] },
  { id:"pronoun", label:{ko:"대명사",en:"Pronoun"}, emoji:"🟣", cats:["gender","plural"] },
  { id:"other",   label:{ko:"기타",en:"Other"},     emoji:"⚪", cats:["gender","plural","poss"] },
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
  { id:"hebrew",  label:{ko:"히브리어",en:"Hebrew"},  emoji:"🇮🇱", color:"#c4a050", ttsLang:"he-IL", ttsName:"he-IL-Neural2-A", ttsRate:0.9, termA:{ko:"히브리어",en:"Word"}, termB:{ko:"뜻",en:"Meaning"}, placeholderA:{ko:"עברית (히브리어)",en:"Hebrew word"}, placeholderB:{ko:"뜻 (한국어/영어)",en:"Meaning"}, dir:"rtl" },
  { id:"english", label:{ko:"영어",en:"English"},    emoji:"🇺🇸", color:"#60a0e0", ttsLang:"en-US", ttsName:"en-US-Standard-C", ttsRate:0.9, termA:{ko:"영어 단어",en:"English word"}, termB:{ko:"뜻 (한국어)",en:"Korean meaning"}, placeholderA:{ko:"English word",en:"English word"}, placeholderB:{ko:"뜻 (한국어)",en:"Korean meaning"}, dir:"ltr" },
  { id:"korean",  label:{ko:"한국어",en:"Korean"},   emoji:"🇰🇷", color:"#e06080", ttsLang:"ko-KR", ttsName:"ko-KR-Standard-A", ttsRate:0.9, termA:{ko:"한국어 단어",en:"Korean word"}, termB:{ko:"뜻 (영어)",en:"English meaning"}, placeholderA:{ko:"한국어 단어",en:"Korean word"}, placeholderB:{ko:"뜻 (영어)",en:"English meaning"}, dir:"ltr" },
];

const UI_TEXT = {
  ko: {
    tab_list:"단어장", tab_add:"추가", tab_quiz:"퀴즈", tab_wallets:"단어장", tab_settings:"설정",
    addWord:"단어 추가", editWord:"단어 수정", addBtn:"추가", editBtn:"수정 완료", cancelBtn:"취소",
    searchPlaceholder:"단어 검색...", all:"전체", learning:"학습중", hard:"어려움", done:"완료",
    selectAll:"전체 선택", deselect:"선택 해제", deleteN:(n)=>`${n}개 삭제`, wordCount:(n)=>`${n}개 단어`,
    mcqTitle:"🎯 객관식", direction:"문제 방향", wordRange:"단어 범위", questionCount:"문제 수",
    dirAtoB:(b)=>`${b.termA.ko} → ${b.termB.ko}`, dirBtoA:(b)=>`${b.termB.ko} → ${b.termA.ko}`, mixed:"랜덤",
    allRange:(n)=>`전체 (${n})`, excludeMastered:(n)=>`암기 제외 (${n})`, hardOnly:(n)=>`어려운 것 (${n})`, learningOnly:(n)=>`학습중 (${n})`,
    startMCQ:(n)=>`🚀 객관식 시작! (${n}문제)`, needMore:(n)=>`단어 최소 4개 필요 (현재 ${n}개)`,
    essayTitle:"✍️ 서술형", essaySub:"직접 타이핑! , 또는 /로 구분된 뜻 중 하나만 맞춰도 정답이에요.",
    dirAtoB_e:(b)=>`${b.termA.ko} → ${b.termB.ko} 입력`, dirBtoA_e:(b)=>`${b.termB.ko} → ${b.termA.ko} 입력`,
    startEssay:(n)=>`✍️ 서술형 시작! (${n}문제)`,
    questionTagAtoB:(b)=>`${b.termA.ko}의 ${b.termB.ko}는?`, questionTagBtoA:(b)=>`${b.termB.ko}에 해당하는 ${b.termA.ko}는?`,
    inputPlaceholderA:(b)=>`${b.termB.ko}을 입력하세요...`, inputPlaceholderB:(b)=>`${b.termA.ko}로 입력하세요...`,
    correct:"✅ 정답!", wrong:(a)=>`❌ 오답 — 정답: ${a}`,
    confirm:"확인", next:"다음 문제 →", finish:"결과 보기 🏁", quit:"그만하기",
    login:"Google 로그인", logout:"로그아웃", saving:"저장중...",
    autoSaveLocal:"💾 이 기기에만 저장됩니다. Google 로그인하면 모든 기기에서 동기화!", autoSaveCloud:(name)=>`☁️ ${name}의 단어장 — 자동 동기화됩니다!`,
    sortDefault:"기본순", sortHardFirst:"어려운 먼저", sortMasteredFirst:"암기 먼저", sortWrongFirst:"오답 많은 먼저",
    variantQuizTitle:"🔀 변형 퀴즈", variantUnavailable:"변형 없음",
    variantTypeSelect:"변형 유형", allDeselect:"전체 해제", allSelectAll:"전체 선택",
    rootGroupView:"🌿 어근별 단어 보기",
    cardStyle:"카드 스타일:", menuStyle:"🪄 메뉴", inlineStyle:"📋 인라인",
    soundAuto:"🔊 자동", soundManual:"🔈 수동", soundMute:"🔇 음소거",
    saveLoad:"저장 / 불러오기", fileSave:"⬇️ 파일 저장", copy:"📋 복사", fileOpen:"⬆️ 불러오기", paste:"📋 붙여넣기", textAdd:"📝 텍스트", csvExcel:"📊 CSV/엑셀",
    addToWordbook:"추가할 단어장",
    reversoImport:"🔍 Reverso 동사변형", rootSearch:"🌿 어근으로 검색", importSearch:"🔎 뜻으로 검색", refreshVariants:"🔄 변형 새로고침",
    deleteConfirm:"삭제할까요?", deleteNConfirm:(n)=>`${n}개를 삭제할까요?`, deleteWalletConfirm:(n)=>`"${n}"을 삭제할까요?`,
    playBtn:"🔈 발음 듣기", deleteBtn:"🗑️ 삭제", editBtn2:"✏️ 편집",
    listenAllBtn:"🔈 전체 반복 듣기", listenStopBtn:"⏹ 듣기 중단",
    pauseBtn:"⏸ 일시정지", resumeBtn:"▶ 재개",
    hardBtn:"🔥 어려움", masteredBtn:"✅ 암기완료", learningBtn:"📖 학습중",
    noMeaning:"뜻 없음", editingLabel:"✏️ 수정 중",
    wordTypeLabel:"품사 선택 (선택사항)", noSelect:"⚪ 선택 안함",
    addToWordbookBtn:"✅ 단어장에 추가", searchAgain:"← 다시 검색",
    walletDeleteBtn:"삭제", addNToWallet:(n)=>`✅ ${n}개 단어장에 추가`,
    noVariants:"변형 없음", updating:"업데이트 중...",
    repeatPerWord:"단어당 반복", timesUnit:"회", repeatInputPlaceholder:"횟수",
    partial:"부분 정답!", partialAnswer:"정답",
    prevPage:"← 이전", nextPage:"다음 →",
    addSubDirect:"직접 입력", addSubRoot:"어근 검색", addSubMeaning:"뜻 검색", addSubBatch:"일괄 추가",
    newWalletTitle:"📚 새 단어장 만들기", walletNamePlaceholder:"단어장 이름...", createWalletBtn:"만들기", viewBtn:"보기",
    accountTitle:"👤 계정", syncActiveMsg:"● 모든 기기 자동 동기화 활성화", loginPrompt:"Google 계정으로 로그인하면 모든 기기에서 단어장을 동기화해요.",
    langTitle:"🌐 언어", soundTitle:"🔊 발음 설정",
    ttsConnected:"● Google TTS 연결됨", ttsBrowser:"○ 브라우저 TTS 사용 중",
    ttsHeader:(ok)=>ok?"🔊 Google TTS":"⚠️ Browser TTS",
    variantTabEdit:"편집", variantTabView:"보기", variantTabPaste:"붙여넣기",
    batchTitle:"📝 텍스트 일괄 추가",
    searchNoResult:"검색 결과가 없어요", noWords:"단어가 없어요",
    quizWordsAvail:(n)=>`${n}개 단어 가능`,
    quizDirection:"문제 방향", quizWordRange:"단어 범위", quizQuestionCount:"문항 수", quizSound:"발음",
    quizEssayStart:(n)=>`✍️ 서술형 시작! (${n}문제)`,
    quizVariantStart:(n)=>`🔀 변형 퀴즈 시작! (${n}문제)`,
    quizVariantType:"변형 유형", quizMCQType:(ko)=>ko?"✍️ 서술형":"🎯 객관식",
    quizNeedMCQ:"객관식은 4개 이상 필요해요", quizNoVariant:"선택한 변형 유형의 단어가 없어요.",
    quizVariantDone:"🔀 변형 퀴즈 완료!", quizPerfect:"🎉 완벽!",
    tab_chat:"💬 채팅",
    chatGlobal:"전체 채팅", chatFriends:"친구", chatDM:"DM",
    chatPlaceholder:"메시지 입력...", chatSend:"전송",
    chatLoginRequired:"채팅을 사용하려면 Google 로그인이 필요해요.",
    friendAdd:"친구 추가", friendSearch:"이메일로 검색...", friendSearchBtn:"검색",
    friendRequest:"친구 요청", friendAccept:"수락", friendDecline:"거절",
    friendPending:"요청 중", friendNone:"친구가 없어요",
    dmStart:"메시지 보내기", dmBack:"← 뒤로",
    onlineNow:"지금 온라인",
    reversoTitle:"🔍 Reverso 동사변형 가져오기",
    searchBtn:"검색", loadingBtn:"…",
    meaningSearchDesc:"한국어 또는 영어로 입력하면 히브리어 단어를 찾아줘요. 예: 사랑, love",
    meaningSearchPlaceholder:"사랑, love...",
    batchExample:"שָׁלוֹם=평화\nתּוֹדָה=감사합니다",
    addWordsBtn:"단어 추가하기",
    removeFromWallet:"제거",
    verbExamples:[["לְדַבֵּר","speak"],["לָלֶכֶת","go"],["לֶאֱכֹל","eat"],["לִכְתּוֹב","write"]],
    verbInputRequired:"동사를 입력해주세요", rootInputRequired:"어근을 입력해주세요",
    searchInputRequired:"검색어를 입력해주세요", selectWordsRequired:"단어를 선택해주세요",
    searchNoResultQ:(q)=>`"${q}" 검색 결과가 없어요.`, errorPrefix:"오류: ", searchErrorPrefix:"검색 오류: ",
    variantsSaved:(n)=>`✅ 변형 ${n}개 저장됐어요!`,
    wordAndVariantsAdded:(n)=>`✅ 단어와 변형 ${n}개 추가!`,
    wordsAdded:(n)=>`✅ ${n}개 단어를 추가했어요!`,
    exported:(n)=>`✅ ${n}개 단어를 내보냈어요!`,
    copied:"📋 클립보드에 복사됐어요!", copiedShort:"📋 복사됐어요!",
    noWordsToImport:"불러올 단어가 없어요.", fileReadError:"파일을 읽을 수 없어요.",
    noWordsRecognized:"인식된 단어가 없어요.", excelReadError:"엑셀 파일을 읽을 수 없어요.",
    invalidFormat:"올바른 형식이 아니에요.", fromClipboard:"클립보드에서",
    importAdded:(n)=>`📥 ${n}개 추가!`, importReplaced:(n)=>`📥 ${n}개로 교체!`,
    noVerbWords:"동사 단어가 없어요.", refreshResult:(ok,fail)=>`✅ ${ok}개 성공 / ${fail}개 실패`,
    loginSuccess:"로그인 성공!", loginFail:"로그인 실패: ", loggedOut:"로그아웃 됐어요.",
    friendRequestSent:"친구 요청을 보냈어요!", friendBecame:"친구가 됐어요! 🎉",
    cloudReplaced:"☁️ 클라우드 단어장으로 교체했어요!", localKept:"💾 기기 단어장을 유지했어요!",
    mergedTotal:(n)=>`☁️ 병합 완료! 총 ${n}개 단어`,
    addedToWallet:(n)=>`✅ ${n}개 추가!`, resultCount:(n)=>`${n}개 결과`, addNSelected:(n)=>`✅ ${n}개 추가`,
    syncTitle:"☁️ 단어장 동기화", syncQuestion:"기기와 클라우드 단어장이 모두 있어요. 어떻게 할까요?",
    mergeBtn:"🔀 합치기", useCloudBtn:(n)=>`☁️ 클라우드 사용 (${n}개)`, keepLocalBtn:"💾 기기 단어 유지",
    noVariantData:"변형 데이터가 없어요.", noRootWords:"어근 정보가 있는 단어가 없어요.",
    walletNoWords:"단어가 없어요.\n단어 목록에서 📚 버튼을 눌러 추가하세요.",
    noWalletsYet:"아직 단어장이 없어요.\n위에서 새 단어장을 만들어보세요!",
    friendNotFound:"찾을 수 없어요.", alreadyInDb:"✓ 있음",
    navCollapse:"▼ 접기", navExpand:"▲ 펼치기",
  },
  en: {
    tab_list:"Words", tab_add:"Add", tab_quiz:"Quiz", tab_wallets:"Books", tab_settings:"Settings",
    addWord:"Add Word", editWord:"Edit Word", addBtn:"Add", editBtn:"Save", cancelBtn:"Cancel",
    searchPlaceholder:"Search...", all:"All", learning:"Learning", hard:"Hard", done:"Done",
    selectAll:"Select All", deselect:"Deselect", deleteN:(n)=>`Delete ${n}`, wordCount:(n)=>`${n} words`,
    mcqTitle:"🎯 Multiple Choice", direction:"Direction", wordRange:"Word Range", questionCount:"Questions",
    dirAtoB:(b)=>`${b.termA.en} → ${b.termB.en}`, dirBtoA:(b)=>`${b.termB.en} → ${b.termA.en}`, mixed:"Random",
    allRange:(n)=>`All (${n})`, excludeMastered:(n)=>`Excl. Mastered (${n})`, hardOnly:(n)=>`Hard Only (${n})`, learningOnly:(n)=>`Learning (${n})`,
    startMCQ:(n)=>`🚀 Start MCQ! (${n} questions)`, needMore:(n)=>`Need at least 4 words (now ${n})`,
    essayTitle:"✍️ Written Test", essaySub:"Type your answer! Matching any part separated by , or / counts!",
    dirAtoB_e:(b)=>`${b.termA.en} → type ${b.termB.en}`, dirBtoA_e:(b)=>`${b.termB.en} → type ${b.termA.en}`,
    startEssay:(n)=>`✍️ Start! (${n} questions)`,
    questionTagAtoB:(b)=>`What is the ${b.termB.en}?`, questionTagBtoA:(b)=>`What is the ${b.termA.en}?`,
    inputPlaceholderA:(b)=>`Type the ${b.termB.en}...`, inputPlaceholderB:(b)=>`Type the ${b.termA.en}...`,
    correct:"✅ Correct!", wrong:(a)=>`❌ Wrong — Answer: ${a}`,
    confirm:"Check", next:"Next →", finish:"See Results 🏁", quit:"Quit",
    login:"Sign in with Google", logout:"Sign out", saving:"Saving...",
    autoSaveLocal:"💾 Saved on this device. Login to sync across devices!", autoSaveCloud:(name)=>`☁️ ${name}'s words — Synced!`,
    sortDefault:"Default", sortHardFirst:"Hard first", sortMasteredFirst:"Mastered first", sortWrongFirst:"Most wrong first",
    variantQuizTitle:"🔀 Variant Quiz", variantUnavailable:"No variants",
    variantTypeSelect:"Variant types", allDeselect:"Deselect All", allSelectAll:"Select All",
    rootGroupView:"🌿 Group by Root",
    cardStyle:"Card style:", menuStyle:"🪄 Menu", inlineStyle:"📋 Inline",
    soundAuto:"🔊 Auto", soundManual:"🔈 Manual", soundMute:"🔇 Mute",
    saveLoad:"Save / Load", fileSave:"⬇️ Export", copy:"📋 Copy", fileOpen:"⬆️ Import", paste:"📋 Paste", textAdd:"📝 Text", csvExcel:"📊 CSV/Excel",
    addToWordbook:"Add to wordbook",
    reversoImport:"🔍 Reverso Conjugation", rootSearch:"🌿 Root Search", importSearch:"🔎 Search by meaning", refreshVariants:"🔄 Refresh Variants",
    deleteConfirm:"Delete?", deleteNConfirm:(n)=>`Delete ${n} words?`, deleteWalletConfirm:(n)=>`Delete "${n}"?`,
    playBtn:"🔈 Play", deleteBtn:"🗑️ Delete", editBtn2:"✏️ Edit",
    listenAllBtn:"🔈 Listen All", listenStopBtn:"⏹ Stop",
    pauseBtn:"⏸ Pause", resumeBtn:"▶ Resume",
    hardBtn:"🔥 Hard", masteredBtn:"✅ Mastered", learningBtn:"📖 Learning",
    noMeaning:"No meaning", editingLabel:"✏️ Editing",
    wordTypeLabel:"Word type (optional)", noSelect:"⚪ None",
    addToWordbookBtn:"✅ Add to wordbook", searchAgain:"← Back",
    walletDeleteBtn:"Delete", addNToWallet:(n)=>`✅ Add ${n} to wordbook`,
    noVariants:"No variants", updating:"Updating...",
    repeatPerWord:"Repeat per word", timesUnit:"x", repeatInputPlaceholder:"count",
    partial:"Partial!", partialAnswer:"Answer",
    prevPage:"← Prev", nextPage:"Next →",
    addSubDirect:"Direct", addSubRoot:"Root Search", addSubMeaning:"By Meaning", addSubBatch:"Bulk Add",
    newWalletTitle:"📚 New Wordbook", walletNamePlaceholder:"Wordbook name...", createWalletBtn:"Create", viewBtn:"View",
    accountTitle:"👤 Account", syncActiveMsg:"● Syncing across all devices", loginPrompt:"Sign in with Google to sync your words across all devices.",
    langTitle:"🌐 Language", soundTitle:"🔊 Pronunciation",
    ttsConnected:"● Google TTS connected", ttsBrowser:"○ Using browser TTS",
    ttsHeader:(ok)=>ok?"🔊 Google TTS":"⚠️ Browser TTS",
    variantTabEdit:"Edit", variantTabView:"View", variantTabPaste:"Paste",
    batchTitle:"📝 Bulk Text Add",
    searchNoResult:"No results found", noWords:"No words yet",
    quizWordsAvail:(n)=>`${n} words available`,
    quizDirection:"Direction", quizWordRange:"Word Range", quizQuestionCount:"Questions", quizSound:"Sound",
    quizEssayStart:(n)=>`✍️ Start Essay! (${n} questions)`,
    quizVariantStart:(n)=>`🔀 Variant Quiz! (${n} questions)`,
    quizVariantType:"Variant types", quizMCQType:(ko)=>ko?"✍️ Essay":"🎯 MCQ",
    quizNeedMCQ:"Need at least 4 words for MCQ", quizNoVariant:"No words with the selected variant types.",
    quizVariantDone:"🔀 Variant Quiz done!", quizPerfect:"🎉 Perfect!",
    tab_chat:"💬 Chat",
    chatGlobal:"Global", chatFriends:"Friends", chatDM:"DM",
    chatPlaceholder:"Type a message...", chatSend:"Send",
    chatLoginRequired:"Please sign in with Google to use chat.",
    friendAdd:"Add Friend", friendSearch:"Search by email...", friendSearchBtn:"Search",
    friendRequest:"Friend Request", friendAccept:"Accept", friendDecline:"Decline",
    friendPending:"Pending", friendNone:"No friends yet",
    dmStart:"Send Message", dmBack:"← Back",
    onlineNow:"Online now",
    reversoTitle:"🔍 Reverso Conjugation Import",
    searchBtn:"Search", loadingBtn:"…",
    meaningSearchDesc:"Enter Korean or English to find Hebrew words. e.g. love, peace",
    meaningSearchPlaceholder:"love, peace...",
    batchExample:"שָׁלוֹם=peace\nתּוֹדָה=thank you",
    addWordsBtn:"Add Words",
    removeFromWallet:"Remove",
    verbExamples:[["לְדַבֵּר","speak"],["לָלֶכֶת","go"],["לֶאֱכֹל","eat"],["לִכְתּוֹב","write"]],
    verbInputRequired:"Please enter a verb", rootInputRequired:"Please enter a root",
    searchInputRequired:"Please enter a search term", selectWordsRequired:"Please select words",
    searchNoResultQ:(q)=>`No results for "${q}".`, errorPrefix:"Error: ", searchErrorPrefix:"Search error: ",
    variantsSaved:(n)=>`✅ ${n} variants saved!`,
    wordAndVariantsAdded:(n)=>`✅ Word + ${n} variants added!`,
    wordsAdded:(n)=>`✅ ${n} words added!`,
    exported:(n)=>`✅ Exported ${n} words!`,
    copied:"📋 Copied to clipboard!", copiedShort:"📋 Copied!",
    noWordsToImport:"No words to import.", fileReadError:"Could not read file.",
    noWordsRecognized:"No words recognized.", excelReadError:"Could not read Excel file.",
    invalidFormat:"Invalid format.", fromClipboard:"from clipboard",
    importAdded:(n)=>`📥 Added ${n}!`, importReplaced:(n)=>`📥 Replaced with ${n}!`,
    noVerbWords:"No verb words found.", refreshResult:(ok,fail)=>`✅ ${ok} ok / ${fail} failed`,
    loginSuccess:"Signed in!", loginFail:"Sign in failed: ", loggedOut:"Signed out.",
    friendRequestSent:"Friend request sent!", friendBecame:"You're now friends! 🎉",
    cloudReplaced:"☁️ Replaced with cloud data!", localKept:"💾 Kept local data!",
    mergedTotal:(n)=>`☁️ Merged! Total ${n} words`,
    addedToWallet:(n)=>`✅ Added ${n}!`, resultCount:(n)=>`${n} results`, addNSelected:(n)=>`✅ Add ${n}`,
    syncTitle:"☁️ Sync Wordbook", syncQuestion:"Both local and cloud data found. What would you like to do?",
    mergeBtn:"🔀 Merge", useCloudBtn:(n)=>`☁️ Use Cloud (${n})`, keepLocalBtn:"💾 Keep Local",
    noVariantData:"No variant data.", noRootWords:"No words with root info.",
    walletNoWords:"No words yet.\nAdd words from the word list using 📚.",
    noWalletsYet:"No wordbooks yet.\nCreate one above!",
    friendNotFound:"Not found.", alreadyInDb:"✓ Added",
    navCollapse:"▼ Collapse", navExpand:"▲ Expand",
  }
};

function getLSKey(book) { return `hebrew_quiz_words_${book||"hebrew"}`; }
const LS_KEY = "hebrew_quiz_words";

const STATUS_CONFIG = {
  learning: { labelKo:"학습중",   labelEn:"Learning", emoji:"📖", color:"#9090b0", bg:"rgba(120,120,160,0.15)", border:"rgba(120,120,160,0.3)" },
  mastered: { labelKo:"암기완료", labelEn:"Mastered", emoji:"✅", color:"#60c880", bg:"rgba(60,180,100,0.15)",  border:"rgba(60,180,100,0.35)" },
  hard:     { labelKo:"어려움",   labelEn:"Hard",     emoji:"🔥", color:"#f07050", bg:"rgba(200,80,60,0.15)",   border:"rgba(200,80,60,0.35)" },
};

function stripNikkud(text) { return text.replace(/[\u0591-\u05C7]/g,""); }
function shuffle(arr) { return [...arr].sort(()=>Math.random()-0.5); }
function loadWords(book) {
  try {
    const key = book && book !== "hebrew" ? getLSKey(book) : LS_KEY;
    const s = localStorage.getItem(key);
    if (s) return JSON.parse(s);
  } catch {}
  return book && book !== "hebrew" ? [] : DEFAULT_WORDS;
}
function saveWords(words, book) {
  try {
    const key = book && book !== "hebrew" ? getLSKey(book) : LS_KEY;
    localStorage.setItem(key, JSON.stringify(words));
  } catch {}
}

// ── 서술형 답안 채점 — , / · 로 구분된 뜻 중 하나만 맞아도 정답 ──
function checkEssayAnswer(userInput, correctAnswer) {
  const norm = s => s.trim().toLowerCase().replace(/[\/\-,\.·]/g," ").replace(/\s+/g," ").trim();
  const userN = norm(userInput);
  const correctN = norm(correctAnswer);

  // 완전 일치
  if (userN === correctN) return "exact";

  // , / · 로 구분된 각 파트 개별 비교
  const parts = correctAnswer.split(/[\/,·]/).map(p=>p.trim()).filter(Boolean);
  for (const part of parts) {
    const partN = norm(part);
    if (userN === partN) return "exact";
    // 파트 내 단어 부분 일치
    const pWords = partN.split(" ").filter(w=>w.length>0);
    const uWords = userN.split(" ").filter(w=>w.length>0);
    if (pWords.length > 0) {
      const matches = pWords.filter(w=>uWords.some(u=>u.includes(w)||w.includes(u)));
      if (matches.length >= Math.ceil(pWords.length*0.6)) return "partial";
    }
  }

  // 전체 답 기준 부분 일치
  const cWords = correctN.split(" ").filter(w=>w.length>1);
  const uWords = userN.split(" ").filter(w=>w.length>1);
  const matches = cWords.filter(w=>uWords.some(u=>u.includes(w)||w.includes(u)));
  if (cWords.length > 0 && matches.length >= Math.ceil(cWords.length*0.6)) return "partial";
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

let _currentAudio=null;
async function googleTTS(text, apiKey, lang="he-IL", name="he-IL-Neural2-A", rate=0.9) {
  const voiceNames = lang.startsWith("he") ? ["he-IL-Neural2-A","he-IL-Wavenet-A","he-IL-Standard-A"] : [name];
  for(const voiceName of voiceNames){
    try{
      const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ input:{text}, voice:{languageCode:lang,name:voiceName}, audioConfig:{audioEncoding:"MP3",speakingRate:rate,pitch:0} }),
      });
      if(!res.ok) continue;
      const data=await res.json();
      if(data.audioContent){
        const audio=new Audio(`data:audio/mp3;base64,${data.audioContent}`);
        _currentAudio=audio; audio.play(); return;
      }
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

function SpeakBtn({text,onSpeak,size="md",muted=false}) {
  const [playing,setPlaying]=useState(false);
  const handleClick=async(e)=>{
    e.stopPropagation(); if(muted) return;
    setPlaying(true); try{await onSpeak(text);}catch{} setTimeout(()=>setPlaying(false),1200);
  };
  return <button onClick={handleClick} style={{background:muted?"rgba(100,100,100,0.1)":playing?"rgba(196,160,80,0.3)":"rgba(196,160,80,0.1)",border:muted?"1px solid rgba(150,150,150,0.2)":"1px solid rgba(196,160,80,0.35)",borderRadius:"8px",cursor:muted?"default":"pointer",padding:size==="lg"?"10px 16px":"6px 10px",fontSize:size==="lg"?"1.2rem":"0.95rem",lineHeight:1,flexShrink:0,opacity:muted?0.4:1}}>{muted?"🔇":playing?"🔊":"🔈"}</button>;
}

function SpeakOnceBtn({text,onSpeak,muted=false,repeatN=1}){
  const [playing,setPlaying]=useState(false);
  const [count,setCount]=useState(0);
  const stopRef=useRef(false);
  const handle=async(e)=>{
    e.stopPropagation(); if(muted) return;
    if(playing){stopRef.current=true;window.speechSynthesis?.cancel();if(_currentAudio){_currentAudio.pause();_currentAudio=null;}setPlaying(false);setCount(0);return;}
    stopRef.current=false; setPlaying(true);
    for(let i=0;i<repeatN;i++){
      if(stopRef.current) break; setCount(i+1);
      try{await onSpeak(text);}catch{}
      if(i<repeatN-1) await new Promise(r=>setTimeout(r,1400));
    }
    setPlaying(false); setCount(0);
  };
  return <button onClick={handle} style={{background:playing?"rgba(200,60,60,0.25)":"rgba(196,160,80,0.1)",border:playing?"2px solid rgba(200,60,60,0.6)":"1px solid rgba(196,160,80,0.3)",borderRadius:"7px",cursor:muted?"default":"pointer",padding:"5px 10px",fontSize:playing?"0.85rem":"0.9rem",lineHeight:1,opacity:muted?0.3:1,fontWeight:playing?700:400,transition:"all 0.1s"}}>{playing?`⏹ ${count}`:"🔈"}</button>;
}

function RepeatSpeakBtn({text,onSpeak,muted=false}) {
  const [playing,setPlaying]=useState(false);
  const [count,setCount]=useState(0);
  const [repeatMode,setRepeatMode]=useState(1);
  const stopRef=useRef(false);
  const handleSpeak=async(e)=>{
    e.stopPropagation(); if(muted||playing) return;
    stopRef.current=false; setPlaying(true);
    for(let i=0;i<repeatMode;i++){
      if(stopRef.current) break; setCount(i+1);
      try{await onSpeak(text);}catch{}
      if(i<repeatMode-1) await new Promise(r=>setTimeout(r,1400));
    }
    setPlaying(false); setCount(0);
  };
  const handleStop=(e)=>{e.stopPropagation();stopRef.current=true;window.speechSynthesis?.cancel();setPlaying(false);setCount(0);};
  return(
    <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
      {[1,5,10].map(m=>(
        <button key={m} onClick={e=>{e.stopPropagation();if(!playing)setRepeatMode(m);}}
          style={{padding:"4px 8px",borderRadius:"6px",border:"1px solid",fontSize:"0.72rem",fontWeight:700,cursor:playing?"not-allowed":"pointer",
            background:repeatMode===m?"rgba(196,160,80,0.3)":"rgba(255,255,255,0.05)",
            borderColor:repeatMode===m?"rgba(196,160,80,0.6)":"rgba(255,255,255,0.1)",
            color:repeatMode===m?"#c4a050":"rgba(255,255,255,0.35)"}}>
          {m}x
        </button>
      ))}
      <button onClick={playing?handleStop:handleSpeak}
        style={{background:muted?"rgba(100,100,100,0.1)":playing?"rgba(200,60,60,0.2)":"rgba(196,160,80,0.1)",
          border:muted?"1px solid rgba(150,150,150,0.2)":playing?"1px solid rgba(200,60,60,0.4)":"1px solid rgba(196,160,80,0.35)",
          borderRadius:"8px",cursor:muted?"default":"pointer",padding:"10px 16px",fontSize:"1.2rem",lineHeight:1,flexShrink:0,opacity:muted?0.4:1}}>
        {muted?"🔇":playing?`⏹ ${count}/${repeatMode}`:"🔈"}
      </button>
    </div>
  );
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l=>l.trim()); const results = [];
  for (const line of lines) {
    let cols = [];
    if (/\t|;/.test(line)) { cols = line.split(/[\t;]/).map(c=>c.trim().replace(/^["']|["']$/g,"")); }
    else { const re=/("([^"]*)")|([^,]+)/g; let m; while((m=re.exec(line))!==null) cols.push((m[2]!==undefined?m[2]:m[3]).trim()); }
    if (cols.length >= 2 && cols[0] && cols[1]) results.push({ hebrew:cols[0], meaning:cols[1] });
  }
  return results;
}
function parseTextFormat(text) {
  const lines = text.split(/\r?\n/).filter(l=>l.trim()); const results = [];
  for (const line of lines) {
    const idx = line.search(/[=:]/);
    if (idx > 0) { const a=line.slice(0,idx).trim(); const b=line.slice(idx+1).trim(); if(a&&b) results.push({hebrew:a,meaning:b}); }
  }
  return results;
}

export default function HebrewQuiz() {
  const envKey=process.env.REACT_APP_GOOGLE_TTS_KEY||"";
  const [apiKey]=useState(envKey); const ttsReady=!!envKey;

  // ── 탭 상태 ──
  const [activeTab,setActiveTab]=useState("list"); // list | add | quiz | wallets | settings

  // ── Firebase ──
  const [user,setUser]=useState(null);
  const [syncing,setSyncing]=useState(false);
  const [showMergeModal,setShowMergeModal]=useState(false);
  const [pendingCloudWords,setPendingCloudWords]=useState(null);

  const [currentBook,setCurrentBook]=useState("hebrew");
  const [uiLang,setUiLang]=useState(()=>{try{return localStorage.getItem("uiLang")||"ko";}catch{return "ko";}});
  const T = UI_TEXT[uiLang] || UI_TEXT.ko;
  const bookInfo = BOOKS.find(b=>b.id===currentBook)||BOOKS[0];

  const [words,setWordsRaw]=useState(()=>loadWords("hebrew"));
  const [mode,setMode]=useState(MODES.LIST);
  const [soundMode,setSoundMode]=useState("auto");
  const muted = soundMode==="mute";

  // ── 단어 추가 ──
  const [newHebrew,setNewHebrew]=useState("");
  const [newMeaning,setNewMeaning]=useState("");
  const [newWordType,setNewWordType]=useState(null);
  const [newWordWallets,setNewWordWallets]=useState(new Set());
  const [editId,setEditId]=useState(null);

  // ── 목록 ──
  const [listFilter,setListFilter]=useState("all");
  const [walletFilter,setWalletFilter]=useState(null);
  const [searchQuery,setSearchQuery]=useState("");
  const [sortBy,setSortBy]=useState("default");
  const [pageSize,setPageSize]=useState(20);
  const [page,setPage]=useState(0);
  const [selectedIds,setSelectedIds]=useState(new Set());
  const [bulkWalletOpen,setBulkWalletOpen]=useState(false);
  const [rootGroupView,setRootGroupView]=useState(false);
  const [expandedVariantWord,setExpandedVariantWord]=useState(null);

  // ── 단어장(Wallet) ──
  const [wallets,setWallets]=useState(()=>{try{const s=localStorage.getItem("wordWallets");return s?JSON.parse(s):[];}catch{return [];}});
  const [walletPickWord,setWalletPickWord]=useState(null);
  const [walletName,setWalletName]=useState("");
  const [walletColor,setWalletColor]=useState("#c4a050");
  const [walletDetailId,setWalletDetailId]=useState(null);

  // ── 추가 서브뷰 ──
  const [addSubView,setAddSubView]=useState("form"); // form|reverso|root|meaning|batch

  // ── Reverso/Pealim ──
  const [pealimRoot,setPealimRoot]=useState("");
  const [pealimLoading,setPealimLoading]=useState(false);
  const [pealimError,setPealimError]=useState("");
  const [pealimPreview,setPealimPreview]=useState(null);

  // ── 어근 검색 ──
  const [rootSearchInput,setRootSearchInput]=useState("");
  const [rootSearchResults,setRootSearchResults]=useState([]);
  const [rootSearchLoading,setRootSearchLoading]=useState(false);
  const [rootSearchError,setRootSearchError]=useState("");
  const [rootSelected,setRootSelected]=useState(new Set());
  const [rootGroupName,setRootGroupName]=useState("");

  // ── 뜻 검색 ──
  const [wordSearchInput,setWordSearchInput]=useState("");
  const [wordSearchResults,setWordSearchResults]=useState([]);
  const [wordSearchLoading,setWordSearchLoading]=useState(false);
  const [wordSearchError,setWordSearchError]=useState("");
  const [wordSearchSelected,setWordSearchSelected]=useState(new Set());

  // ── 일괄 추가 ──
  const batchTextRef=useRef(null);
  const [pasteText,setPasteText]=useState("");
  const [showPasteImport,setShowPasteImport]=useState(false);

  // ── 변형 편집 ──
  const [variantDraft,setVariantDraft]=useState({});
  const [variantPasteMode,setVariantPasteMode]=useState(false);
  const [variantPasteText,setVariantPasteText]=useState("");

  // ── 가져오기 미리보기 ──
  const [importPreview,setImportPreview]=useState(null);
  const [importTargetWallets,setImportTargetWallets]=useState(new Set());

  // ── 변형 새로고침 로그 ──
  const [refreshingVariants,setRefreshingVariants]=useState(false);
  const [refreshLog,setRefreshLog]=useState([]);
  const [showRefreshLog,setShowRefreshLog]=useState(false);

  // ── 퀴즈 ──
  const [quizType,setQuizType]=useState(QUIZ_TYPES.HEB_TO_MEAN);
  const [openQuizSection,setOpenQuizSection]=useState(null); // null | "mcq" | "essay" | "variant"
  const [quizFilter,setQuizFilter]=useState(QUIZ_FILTERS.ALL);
  const [quizCount,setQuizCount]=useState(10);
  const [questions,setQuestions]=useState([]);
  const [current,setCurrent]=useState(0);
  const [selected,setSelected]=useState(null);
  const [confirmed,setConfirmed]=useState(false);
  const [score,setScore]=useState(0);
  const [wrongWords,setWrongWords]=useState([]);
  const [animKey,setAnimKey]=useState(0);

  // ── 서술형 ──
  const [essayFilter,setEssayFilter]=useState(QUIZ_FILTERS.ALL);
  const [essayCount,setEssayCount]=useState(10);
  const [essayType,setEssayType]=useState("heb_to_mean");
  const [essayQuestions,setEssayQuestions]=useState([]);
  const [essayCurrent,setEssayCurrent]=useState(0);
  const [essayInput,setEssayInput]=useState("");
  const [essayConfirmed,setEssayConfirmed]=useState(false);
  const [essayResults,setEssayResults]=useState([]);
  const essayInputRef=useRef(null);
  const essayHebrewRef=useRef(null);

  // ── 변형 퀴즈 ──
  const [variantFilter,setVariantFilter]=useState(QUIZ_FILTERS.ALL);
  const [variantCount,setVariantCount]=useState(10);
  const [variantCats,setVariantCats]=useState(VARIANT_CATS.map(c=>c.id));
  const [variantQuizType,setVariantQuizType]=useState("essay");
  const [variantQuestions,setVariantQuestions]=useState([]);
  const [variantCur,setVariantCur]=useState(0);
  const [variantInput,setVariantInput]=useState("");
  const [variantSelected,setVariantSelected]=useState(null);
  const [variantConfirmed,setVariantConfirmed]=useState(false);
  const [variantResults,setVariantResults]=useState([]);
  const variantInputRef=useRef(null);

  // ── 바텀시트 메뉴 ──
  const [bottomMenuWord,setBottomMenuWord]=useState(null);

  // ── 전체 반복 듣기 ──
  const [listenRepeat,setListenRepeat]=useState(1);
  const [listenAll,setListenAll]=useState({active:false,paused:false,index:0,rep:0,words:[],walletId:null});
  const listenAllRef=useRef(null);
  const listenAllStopFn=()=>{clearTimeout(listenAllRef.current);setListenAll({active:false,paused:false,index:0,rep:0,words:[],walletId:null});window.speechSynthesis?.cancel();};
  const listenAllStart=(targetWords,walletId=null,repeatN=listenRepeat)=>{if(!targetWords.length)return;listenAllStopFn();setListenAll({active:true,paused:false,index:0,rep:0,words:targetWords,walletId,repeatN});};
  const listenAllPauseFn=()=>{clearTimeout(listenAllRef.current);window.speechSynthesis?.cancel();setListenAll(l=>({...l,paused:true}));};
  const listenAllResumeFn=()=>setListenAll(l=>({...l,paused:false}));

  // ── 채팅 ──
  const [chatTab,setChatTab]=useState("global"); // global | friends | dm
  const [globalMessages,setGlobalMessages]=useState([]);
  const [chatInput,setChatInput]=useState("");
  const [friends,setFriends]=useState([]);
  const [friendRequests,setFriendRequests]=useState([]);
  const [friendSearchInput,setFriendSearchInput]=useState("");
  const [friendSearchResult,setFriendSearchResult]=useState(null);
  const [friendSearchLoading,setFriendSearchLoading]=useState(false);
  const [dmTarget,setDmTarget]=useState(null);
  const [dmMessages,setDmMessages]=useState([]);
  const [unreadChat,setUnreadChat]=useState(0);
  const [navCollapsed,setNavCollapsed]=useState(false);
  const lastReadChatCountRef=useRef(0);
  const chatBottomRef=useRef(null);
  const dmBottomRef=useRef(null);
  const chatUnsubRef=useRef(null);
  const dmUnsubRef=useRef(null);

  const [toast,setToast]=useState(null);
  const showToast=(msg,type="ok")=>{setToast({msg,type});setTimeout(()=>setToast(null),3000);};

  const fileInputRef=useRef(null);
  const csvInputRef=useRef(null);

  // ── 계산 ──
  const masteredCount=words.filter(w=>w.status==="mastered").length;
  const hardCount=words.filter(w=>w.status==="hard").length;
  const learningCount=words.filter(w=>w.status==="learning").length;
  const q=questions[current];
  const eq=essayQuestions[essayCurrent];
  const progress=questions.length>0?((current+(confirmed?1:0))/questions.length)*100:0;
  const essayProgress=essayQuestions.length>0?((essayCurrent+(essayConfirmed?1:0))/essayQuestions.length)*100:0;
  const essayScore=essayResults.filter(r=>r.result==="exact").length;
  const essayPartial=essayResults.filter(r=>r.result==="partial").length;

  const getPool=(filter)=>{const f=filter||quizFilter;if(f===QUIZ_FILTERS.LEARNING_ONLY)return words.filter(w=>w.status==="learning");if(f===QUIZ_FILTERS.EXCLUDE_MASTERED)return words.filter(w=>w.status!=="mastered");if(f===QUIZ_FILTERS.HARD_ONLY)return words.filter(w=>w.status==="hard");return words;};
  const poolSize=getPool().length;
  const essayPoolSize=getPool(essayFilter).length;
  const variantPoolSize=(()=>{
    const st=new Set(VARIANT_CATS.filter(c=>variantCats.includes(c.id)).flatMap(c=>c.types));
    return getPool(variantFilter).filter(w=>(w.variants||[]).some(v=>st.has(v.type))).flatMap(w=>(w.variants||[]).filter(v=>st.has(v.type))).length;
  })();

  const countOptions=[5,10,20,"전체"].map(v=>({label:v==="전체"?(uiLang==="en"?"All":"전체"):`${v}`,value:v==="전체"?9999:v}));

  const isQuizActive=[MODES.QUIZ,MODES.ESSAY,MODES.VARIANT,MODES.RESULT,MODES.ESSAY_RESULT,MODES.VARIANT_RESULT].includes(mode);

  // ── 단어 저장 ──
  const syncToCloud=async(wordsToSync)=>{
    if(!user) return;
    setSyncing(true);
    try{ await setDoc(doc(fbDb,"users",user.uid),{words:wordsToSync,updatedAt:new Date().toISOString()}); }
    catch(e){ console.error(e); }
    finally{ setSyncing(false); }
  };
  const setWords=(updater)=>{
    setWordsRaw(prev=>{
      const next=typeof updater==="function"?updater(prev):updater;
      saveWords(next,currentBook); syncToCloud(next); return next;
    });
  };

  const saveWallets=(w)=>{
    setWallets(w);
    try{localStorage.setItem("wordWallets",JSON.stringify(w));}catch{}
    if(user){ setDoc(doc(fbDb,"users",user.uid),{wallets:w,walletsUpdatedAt:new Date().toISOString()},{merge:true}).catch(e=>console.error(e)); }
  };
  const createWallet=()=>{ if(!walletName.trim()) return; saveWallets([{id:Date.now(),name:walletName.trim(),color:walletColor,wordIds:[]},...wallets]); setWalletName(""); setWalletColor("#c4a050"); };
  const deleteWallet=(id)=>saveWallets(wallets.filter(w=>w.id!==id));
  const toggleWordInWallet=(walletId,wordId)=>saveWallets(wallets.map(w=>w.id===walletId?{...w,wordIds:w.wordIds.includes(wordId)?w.wordIds.filter(i=>i!==wordId):[...w.wordIds,wordId]}:w));
  const getWalletWords=(walletId)=>{const w=wallets.find(w=>w.id===walletId);return w?words.filter(wd=>w.wordIds.includes(wd.id)):[];};

  // ── Firebase auth ──
  useEffect(()=>{
    const unsub=onAuthStateChanged(fbAuth,async(u)=>{
      setUser(u);
      if(u){
        try{
          const snap=await getDoc(doc(fbDb,"users",u.uid));
          const localWords=loadWords();
          const syncKey=`synced_${u.uid}`;
          const alreadySynced=localStorage.getItem(syncKey);
          if(snap.exists()){
            const sd=snap.data(); const cloud=sd.words;
            if(sd.wallets&&sd.wallets.length){
              const localWallets=(()=>{try{const s=localStorage.getItem("wordWallets");return s?JSON.parse(s):[];}catch{return [];}})();
              if(!localWallets.length){setWallets(sd.wallets);try{localStorage.setItem("wordWallets",JSON.stringify(sd.wallets));}catch{}}
            }
            if(cloud&&cloud.length){
              if(!alreadySynced){
                const ls=new Set(localWords.map(w=>w.hebrew)); const cs=new Set(cloud.map(w=>w.hebrew));
                const isSame=localWords.length===cloud.length&&[...ls].every(h=>cs.has(h));
                if(isSame){setWordsRaw(cloud);saveWords(cloud);localStorage.setItem(syncKey,"1");}
                else{setPendingCloudWords(cloud);setShowMergeModal(true);}
              } else {setWordsRaw(cloud);saveWords(cloud);}
            }
          }
        }catch(e){console.error(e);}
      }
    });
    return()=>unsub();
  },[]);

  const handleMerge=(choice)=>{
    if(!pendingCloudWords) return;
    if(choice==="cloud"){setWordsRaw(pendingCloudWords);saveWords(pendingCloudWords);showToast(T.cloudReplaced);}
    else if(choice==="local"){const local=loadWords();if(user)setDoc(doc(fbDb,"users",user.uid),{words:local,updatedAt:new Date().toISOString()});showToast(T.localKept);}
    else{const local=loadWords();const hs=new Set(pendingCloudWords.map(w=>w.hebrew));const merged=[...pendingCloudWords,...local.filter(w=>!hs.has(w.hebrew))];setWordsRaw(merged);saveWords(merged);if(user)setDoc(doc(fbDb,"users",user.uid),{words:merged,updatedAt:new Date().toISOString()});showToast(T.mergedTotal(merged.length));}
    setPendingCloudWords(null);setShowMergeModal(false);
    if(user) localStorage.setItem(`synced_${user.uid}`,"1");
  };
  const signInGoogle=async()=>{try{await signInWithPopup(fbAuth,new GoogleAuthProvider());showToast(T.loginSuccess);}catch(e){showToast(T.loginFail+e.message,"err");}};
  const signOutUser=async()=>{await signOut(fbAuth);showToast(T.loggedOut);};

  // ── 단어 조작 ──
  const updateWordStats=(wordId,correct)=>{setWords(ws=>ws.map(w=>{if(w.id!==wordId)return w;const ns=correct?w.streak+1:0;const nw=correct?w.wrongCount:w.wrongCount+1;let st=w.status;if(correct&&ns>=3)st="mastered";else if(!correct&&nw>=2)st="hard";return{...w,streak:ns,wrongCount:nw,status:st};}));};
  const setManualStatus=(id,status)=>{setWords(ws=>ws.map(w=>w.id===id?{...w,status,streak:status==="mastered"?3:0,wrongCount:status==="hard"?2:0}:w));};
  const addWord=()=>{
    if(!newHebrew.trim()||!newMeaning.trim()) return;
    if(editId!==null){
      setWords(ws=>ws.map(w=>w.id===editId?{...w,hebrew:newHebrew.trim(),meaning:newMeaning.trim(),...(newWordType?{wordType:newWordType}:{})}:w));
      setEditId(null);
    } else {
      const newId=Date.now();
      setWords(ws=>[{id:newId,hebrew:newHebrew.trim(),meaning:newMeaning.trim(),status:"learning",streak:0,wrongCount:0,...(newWordType?{wordType:newWordType}:{})}, ...ws]);
      setPage(0);
      if(newWordWallets.size>0) saveWallets(wallets.map(wl=>newWordWallets.has(wl.id)?{...wl,wordIds:[...wl.wordIds,newId]}:wl));
    }
    setNewHebrew(""); setNewMeaning(""); setNewWordType(null);
  };
  const deleteWord=(id)=>{
    if(walletFilter){saveWallets(wallets.map(wl=>wl.id===walletFilter?{...wl,wordIds:wl.wordIds.filter(i=>i!==id)}:wl));}
    else{setWords(ws=>ws.filter(w=>w.id!==id));saveWallets(wallets.map(wl=>({...wl,wordIds:wl.wordIds.filter(i=>i!==id)})));}
  };
  const startEdit=(word)=>{setEditId(word.id);setNewHebrew(word.hebrew);setNewMeaning(word.meaning);setNewWordType(word.wordType||null);setActiveTab("add");setAddSubView("form");};
  const cancelEdit=()=>{setEditId(null);setNewHebrew("");setNewMeaning("");setNewWordType(null);};

  // ── 변형 편집 ──
  const openVariantModal=(word)=>{
    const draft={};(word.variants||[]).forEach(v=>{draft[v.type]=v.form;});
    setVariantDraft(draft);setVariantPasteMode((word.variants||[]).length>0?"view":false);setExpandedVariantWord(word.id);
  };
  const saveVariantDraft=(wordId)=>{
    const variants=Object.entries(variantDraft).filter(([,form])=>form.trim()).map(([type,form])=>({type,form:form.trim()}));
    setWords(ws=>ws.map(w=>w.id===wordId?{...w,variants}:w));
    setExpandedVariantWord(null);
    showToast(T.variantsSaved(variants.length));
  };
  const applyVariantPaste=(text)=>{
    const lines=text.split(/[\n\t]/).map(l=>l.trim());
    const draft={...variantDraft};
    const editWord=words.find(w=>w.id===expandedVariantWord);
    const order=getAllowedPasteOrder(editWord?.wordType);
    let oi=0;
    lines.forEach(form=>{if(oi>=order.length)return;if(form){draft[order[oi]]=form;oi++;}else{oi++;}});
    setVariantDraft(draft);setVariantPasteText("");setVariantPasteMode(false);
    showToast(`📋 ${Math.min(lines.length,order.length)}개 변형을 입력했어요!`);
  };

  // ── 단어장 전환 ──
  const switchBook=(bookId)=>{
    setCurrentBook(bookId);setWordsRaw(loadWords(bookId));
    setListFilter("all");setSearchQuery("");setPage(0);setSelectedIds(new Set());setMode(MODES.LIST);
  };

  // ── Reverso ──
  const translateText=async(text,from,to)=>{
    const res=await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`);
    const data=await res.json(); return data?.[0]?.[0]?.[0]||"";
  };
  const searchPealim=async()=>{
    if(!pealimRoot.trim()){setPealimError(T.verbInputRequired);return;}
    setPealimLoading(true);setPealimError("");setPealimPreview(null);
    try{
      const res=await fetch(`/api/Reverso?mode=conjugation&verb=${encodeURIComponent(pealimRoot.trim())}`);
      const data=await res.json();
      if(data.error){setPealimError(data.error);return;}
      if(!data.variantCount){setPealimError(T.noVariants);return;}
      const existingWord=words.find(w=>stripNikkud(w.hebrew)===stripNikkud(data.infinitive));
      setPealimPreview({...data,meaning:existingWord?.meaning||data.meaning||"",root:pealimRoot.trim()});
    }catch(e){setPealimError(T.errorPrefix+e.message);}
    finally{setPealimLoading(false);}
  };
  const addFromPealim=()=>{
    if(!pealimPreview?.infinitive) return;
    const variants=Object.entries(pealimPreview.variants).filter(([,f])=>f).map(([type,form])=>({type,form}));
    const exists=words.find(w=>stripNikkud(w.hebrew)===stripNikkud(pealimPreview.infinitive));
    if(exists){setWords(ws=>ws.map(w=>w.id===exists.id?{...w,variants}:w));showToast(`✅ 변형 ${variants.length}개 업데이트!`);}
    else{const newId=Date.now();setWords(ws=>[{id:newId,hebrew:pealimPreview.infinitive,meaning:pealimPreview.meaning||"",status:"learning",streak:0,wrongCount:0,wordType:null,variants,root:pealimPreview.root},...ws]);setPage(0);showToast(T.wordAndVariantsAdded(variants.length));}
    setPealimPreview(null);setPealimRoot("");
  };

  // ── 어근 검색 ──
  const searchByRoot=async()=>{
    if(!rootSearchInput.trim()){setRootSearchError(T.rootInputRequired);return;}
    setRootSearchLoading(true);setRootSearchError("");setRootSearchResults([]);setRootSelected(new Set());
    try{
      const res=await fetch(`/api/Reverso?mode=root_search&root=${encodeURIComponent(rootSearchInput.trim())}`);
      const data=await res.json();
      if(data.error){setRootSearchError(data.error);return;}
      if(!data.results?.length){setRootSearchError(T.searchNoResult);return;}
      setRootSearchResults(data.results);setRootGroupName(rootSearchInput.trim());
    }catch(e){setRootSearchError(T.errorPrefix+e.message);}
    finally{setRootSearchLoading(false);}
  };
  const addSelectedRootWords=()=>{
    if(!rootSelected.size){setRootSearchError(T.selectWordsRequired);return;}
    const toAdd=[...rootSelected].map(i=>rootSearchResults[i]).filter(Boolean);
    const newWords=toAdd.map(r=>({id:Date.now()+Math.random(),hebrew:r.hebrew,meaning:r.meaning||"",status:"learning",streak:0,wrongCount:0,wordType:r.pos||null,root:rootGroupName,variants:[]}));
    setWords(ws=>[...newWords,...ws]);setPage(0);
    if(importTargetWallets.size>0){const ids=newWords.map(w=>w.id);saveWallets(wallets.map(wl=>importTargetWallets.has(wl.id)?{...wl,wordIds:[...wl.wordIds,...ids]}:wl));}
    showToast(T.wordsAdded(newWords.length));setRootSelected(new Set());setRootSearchResults([]);setRootSearchInput("");
  };

  // ── 뜻 검색 ──
  const searchWordByMeaning=async()=>{
    if(!wordSearchInput.trim()){setWordSearchError(T.searchInputRequired);return;}
    setWordSearchLoading(true);setWordSearchError("");setWordSearchResults([]);setWordSearchSelected(new Set());
    try{
      const q2=wordSearchInput.trim();
      const hasKorean=/[ㄱ-ㅎ가-힣]/.test(q2);
      let searchQ=q2;
      if(hasKorean){try{const t=await translateText(q2,"ko","en");if(t)searchQ=t;}catch{}}
      const res=await fetch(`/api/Reverso?mode=word_search&q=${encodeURIComponent(searchQ)}`);
      const data=await res.json();
      if(data.error){setWordSearchError(data.error);return;}
      if(!data.results?.length){setWordSearchError(T.searchNoResultQ(q2));return;}
      setWordSearchResults(data.results);
    }catch(e){setWordSearchError(T.errorPrefix+e.message);}
    finally{setWordSearchLoading(false);}
  };
  const addSelectedWordSearch=()=>{
    if(!wordSearchSelected.size){setWordSearchError(T.selectWordsRequired);return;}
    const toAdd=[...wordSearchSelected].map(i=>wordSearchResults[i]).filter(Boolean);
    const newWords=toAdd.map(r=>({id:Date.now()+Math.random(),hebrew:r.hebrew,meaning:r.meaning||"",status:"learning",streak:0,wrongCount:0,wordType:r.pos||null,variants:[]}));
    setWords(ws=>[...newWords,...ws]);setPage(0);
    if(importTargetWallets.size>0){const ids=newWords.map(w=>w.id);saveWallets(wallets.map(wl=>importTargetWallets.has(wl.id)?{...wl,wordIds:[...wl.wordIds,...ids]}:wl));}
    showToast(T.wordsAdded(newWords.length));setWordSearchSelected(new Set());setWordSearchResults([]);setWordSearchInput("");
  };

  // ── 파일 IO ──
  const exportWords=()=>{
    const data={version:1,exportedAt:new Date().toISOString(),words};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");
    a.href=url;a.download=`hebrew-vocab-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
    showToast(T.exported(words.length));
  };
  const copyToClipboard=async()=>{
    const text=JSON.stringify({version:1,exportedAt:new Date().toISOString(),words},null,2);
    try{await navigator.clipboard.writeText(text);showToast(T.copied);}
    catch{const ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);showToast(T.copiedShort);}
  };
  const handleFileChange=(e)=>{
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=(ev)=>{
      try{
        const parsed=JSON.parse(ev.target.result);const raw=Array.isArray(parsed)?parsed:(parsed.words||[]);
        const imported=raw.map(w=>({id:Date.now()+Math.random(),hebrew:(w.hebrew||"").trim(),meaning:(w.meaning||"").trim(),status:["learning","mastered","hard"].includes(w.status)?w.status:"learning",streak:w.streak||0,wrongCount:w.wrongCount||0})).filter(w=>w.hebrew&&w.meaning);
        if(!imported.length){showToast(T.noWordsToImport,"err");return;}
        setImportPreview({words:imported,fileName:file.name});
      }catch{showToast(T.fileReadError,"err");}
    };
    reader.readAsText(file);e.target.value="";
  };
  const handleCSVChange=async(e)=>{
    const file=e.target.files[0];if(!file)return;
    const isXlsx=/\.xlsx?$/i.test(file.name);
    if(isXlsx){
      try{
        const XLSX=await getXLSX();const buf=await file.arrayBuffer();const wb=XLSX.read(buf,{type:"array"});
        const ws=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
        const parsed=rows.filter(r=>r[0]&&r[1]).map(r=>({hebrew:String(r[0]).trim(),meaning:String(r[1]).trim()})).filter(w=>w.hebrew&&w.meaning);
        if(!parsed.length){showToast(T.noWordsRecognized,"err");return;}
        setImportPreview({words:parsed.map(w=>({...w,id:Date.now()+Math.random(),status:"learning",streak:0,wrongCount:0})),fileName:file.name});
      }catch{showToast(T.excelReadError,"err");}
    } else {
      const reader=new FileReader();
      reader.onload=(ev)=>{
        const parsed=parseCSV(ev.target.result);
        if(!parsed.length){showToast(T.noWordsRecognized,"err");return;}
        setImportPreview({words:parsed.map(w=>({...w,id:Date.now()+Math.random(),status:"learning",streak:0,wrongCount:0})),fileName:file.name});
      };
      reader.readAsText(file,"UTF-8");
    }
    e.target.value="";
  };
  const importFromText=()=>{
    try{
      const parsed=JSON.parse(pasteText);const raw=Array.isArray(parsed)?parsed:(parsed.words||[]);
      const imported=raw.map(w=>({id:Date.now()+Math.random(),hebrew:(w.hebrew||"").trim(),meaning:(w.meaning||"").trim(),status:["learning","mastered","hard"].includes(w.status)?w.status:"learning",streak:w.streak||0,wrongCount:w.wrongCount||0})).filter(w=>w.hebrew&&w.meaning);
      if(!imported.length){showToast(T.noWordsToImport,"err");return;}
      setImportPreview({words:imported,fileName:T.fromClipboard});setShowPasteImport(false);setPasteText("");
    }catch{showToast(T.invalidFormat,"err");}
  };
  const importFromBatch=()=>{
    const raw=batchTextRef.current?batchTextRef.current.value:"";
    const parsed=parseTextFormat(raw);
    if(!parsed.length){showToast(T.noWordsRecognized,"err");return;}
    setImportPreview({words:parsed.map(w=>({...w,id:Date.now()+Math.random(),status:"learning",streak:0,wrongCount:0})),fileName:`텍스트 (${parsed.length}개)`});
    if(batchTextRef.current) batchTextRef.current.value="";
  };
  const confirmImport=(merge)=>{
    if(!importPreview)return;
    if(merge){const ex=new Set(words.map(w=>w.hebrew));const newOnes=importPreview.words.filter(w=>!ex.has(w.hebrew));setWords(ws=>[...newOnes,...ws]);setPage(0);showToast(T.importAdded(newOnes.length));}
    else{setWords(importPreview.words);showToast(T.importReplaced(importPreview.words.length));}
    setImportPreview(null);
  };

  // ── 변형 새로고침 ──
  const refreshAllVariants=async()=>{
    const verbWords=words.filter(w=>w.wordType==="verb"||(w.variants||[]).length>0);
    if(!verbWords.length){showToast(T.noVerbWords,"err");return;}
    setRefreshingVariants(true);setRefreshLog([]);
    const log=[];const done=new Set();
    for(const w of verbWords){
      const key=stripNikkud(w.hebrew);if(done.has(key))continue;done.add(key);
      try{
        const res=await fetch(`/api/Reverso?mode=conjugation&verb=${encodeURIComponent(w.hebrew)}`);
        const cd=await res.json();
        if(cd.error||!cd.variantCount){log.push({hebrew:w.hebrew,meaning:w.meaning,status:"fail",error:cd.error||"변형 없음"});continue;}
        const variants=Object.entries(cd.variants).filter(([,f])=>f).map(([type,form])=>({type,form}));
        setWords(ws=>ws.map(ww=>stripNikkud(ww.hebrew)===key?{...ww,variants,meaning:ww.meaning||cd.meaning||""}:ww));
        log.push({hebrew:w.hebrew,meaning:w.meaning,status:"ok",variantCount:variants.length});
      }catch(e){log.push({hebrew:w.hebrew,meaning:w.meaning,status:"fail",error:e.message});}
    }
    setRefreshLog(log);setShowRefreshLog(true);setRefreshingVariants(false);
    showToast(T.refreshResult(log.filter(l=>l.status==="ok").length,log.filter(l=>l.status==="fail").length));
  };

  // ── 퀴즈 ──
  const startQuiz=()=>{
    const pool=getPool();if(pool.length<4)return;
    const count=Math.min(quizCount===9999?pool.length:quizCount,pool.length);
    const qs=shuffle(pool).slice(0,count).map(w=>generateQuestion(w,words,quizType));
    setQuestions(qs);setCurrent(0);setSelected(null);setConfirmed(false);setScore(0);setWrongWords([]);setMode(MODES.QUIZ);setAnimKey(k=>k+1);
  };
  const startEssay=()=>{
    const pool=getPool(essayFilter);if(!pool.length)return;
    const count=Math.min(essayCount===9999?pool.length:essayCount,pool.length);
    const qs=shuffle(pool).slice(0,count).map(w=>{
      let type=essayType;if(type==="mixed")type=Math.random()>0.5?"heb_to_mean":"mean_to_heb";
      return type==="heb_to_mean"?{wordId:w.id,question:w.hebrew,answer:w.meaning,questionType:"heb_to_mean",hebrewWord:w.hebrew}:{wordId:w.id,question:w.meaning,answer:w.hebrew,questionType:"mean_to_heb",hebrewWord:w.hebrew};
    });
    setEssayQuestions(qs);setEssayCurrent(0);setEssayInput("");setEssayConfirmed(false);setEssayResults([]);setMode(MODES.ESSAY);setAnimKey(k=>k+1);
  };
  const startVariantQuiz=()=>{
    const st=new Set(VARIANT_CATS.filter(c=>variantCats.includes(c.id)).flatMap(c=>c.types));
    const pool=getPool(variantFilter).filter(w=>(w.variants||[]).some(v=>st.has(v.type)));
    if(!pool.length){showToast(T.quizNoVariant,"err");return;}
    const allForms=[...new Set(pool.flatMap(w=>(w.variants||[]).filter(v=>st.has(v.type)).map(v=>v.form)))];
    const pairs=[];
    for(const w of pool){
      for(const v of (w.variants||[])){
        if(!st.has(v.type))continue;
        const dist=shuffle(allForms.filter(f=>f!==v.form)).slice(0,3);
        while(dist.length<3)dist.push("—");
        pairs.push({wordId:w.id,base:w.hebrew,meaning:w.meaning,variantType:v.type,answer:v.form,choices:shuffle([v.form,...dist])});
      }
    }
    const count=Math.min(variantCount===9999?pairs.length:variantCount,pairs.length);
    setVariantQuestions(shuffle(pairs).slice(0,count));setVariantCur(0);setVariantInput("");setVariantConfirmed(false);setVariantResults([]);setVariantSelected(null);setMode(MODES.VARIANT);setAnimKey(k=>k+1);
  };

  const handleConfirm=()=>{
    if(!selected)return;const correct=selected===q.answer;
    if(correct)setScore(s=>s+1);else setWrongWords(w=>[...w,q]);
    updateWordStats(q.wordId,correct);setConfirmed(true);
  };
  const handleNext=()=>{
    if(current+1>=questions.length){setMode(MODES.RESULT);return;}
    setCurrent(c=>c+1);setSelected(null);setConfirmed(false);setAnimKey(k=>k+1);
  };
  const handleEssayConfirm=()=>{
    const inputVal=eq.questionType==="mean_to_heb"?(essayHebrewRef.current?.value||""):essayInput;
    if(!inputVal.trim())return;
    const cv=eq.questionType==="mean_to_heb"?stripNikkud(inputVal):inputVal;
    const ca=eq.questionType==="mean_to_heb"?stripNikkud(eq.answer):eq.answer;
    const result=checkEssayAnswer(cv,ca);
    updateWordStats(eq.wordId,result!=="wrong");
    setEssayResults(r=>[...r,{...eq,userInput:inputVal,result}]);
    setEssayConfirmed(true);
    speak(eq.hebrewWord||eq.question);
  };
  const handleEssayNext=()=>{
    if(essayCurrent+1>=essayQuestions.length){setMode(MODES.ESSAY_RESULT);return;}
    setEssayCurrent(c=>c+1);setEssayInput("");setEssayConfirmed(false);setAnimKey(k=>k+1);
    if(essayHebrewRef.current)essayHebrewRef.current.value="";
  };
  const handleVariantConfirm=()=>{
    const vq=variantQuestions[variantCur];
    if(variantQuizType==="mcq"){
      if(!variantSelected)return;
      const correct=variantSelected===vq.answer;
      updateWordStats(vq.wordId,correct);setVariantResults(r=>[...r,{...vq,userInput:variantSelected,correct}]);setVariantConfirmed(true);speak(vq.answer);
    } else {
      if(!variantInput.trim())return;
      const correct=stripNikkud(variantInput.trim())===stripNikkud(vq.answer)||variantInput.trim()===vq.answer;
      updateWordStats(vq.wordId,correct);setVariantResults(r=>[...r,{...vq,userInput:variantInput,correct}]);setVariantConfirmed(true);speak(vq.answer);
    }
  };
  const handleVariantNext=()=>{
    if(variantCur+1>=variantQuestions.length){setMode(MODES.VARIANT_RESULT);return;}
    setVariantCur(c=>c+1);setVariantInput("");setVariantConfirmed(false);setVariantSelected(null);
    if(variantQuizType==="essay"&&variantInputRef.current)variantInputRef.current.focus();
  };

  const speak=useCallback(async(text,forcePlay=false)=>{
    if(!forcePlay&&soundMode!=="auto")return;
    const book=BOOKS.find(b=>b.id===currentBook)||BOOKS[0];
    if(apiKey){try{await googleTTS(text,apiKey,book.ttsLang,book.ttsName,book.ttsRate);return;}catch{}}
    browserTTS(text,book.ttsLang,book.ttsRate);
  },[apiKey,currentBook,soundMode]);
  const speakOnDemand=useCallback(async(text)=>{
    if(soundMode==="mute")return;
    const book=BOOKS.find(b=>b.id===currentBook)||BOOKS[0];
    if(apiKey){try{await googleTTS(text,apiKey,book.ttsLang,book.ttsName,book.ttsRate);return;}catch{}}
    browserTTS(text,book.ttsLang,book.ttsRate);
  },[apiKey,currentBook,soundMode]);

  // ── 전역 채팅 구독 (항상 활성 — 알림용) ──
  useEffect(()=>{
    if(!user) return;
    if(chatUnsubRef.current) chatUnsubRef.current();
    const q2=query(collection(fbDb,"globalChat"),orderBy("createdAt","asc"),limit(80));
    chatUnsubRef.current=onSnapshot(q2,snap=>{
      const msgs=snap.docs.map(d=>({id:d.id,...d.data()}));
      setGlobalMessages(msgs);
      // 채팅 탭이 아닐 때 본인 외 메시지 카운트
      if(activeTab!=="chat"){
        const newCount=msgs.filter(m=>m.uid!==user.uid).length;
        if(newCount>lastReadChatCountRef.current) setUnreadChat(newCount-lastReadChatCountRef.current);
      } else {
        lastReadChatCountRef.current=msgs.filter(m=>m.uid!==user.uid).length;
        setUnreadChat(0);
        setTimeout(()=>chatBottomRef.current?.scrollIntoView({behavior:"smooth"}),100);
      }
    });
    return()=>chatUnsubRef.current?.();
  },[user]);

  useEffect(()=>{
    if(activeTab==="chat"){
      lastReadChatCountRef.current=globalMessages.filter(m=>m.uid!==user?.uid).length;
      setUnreadChat(0);
    }
  },[activeTab]);
  useEffect(()=>{
    if(!dmTarget||!user) return;
    if(dmUnsubRef.current) dmUnsubRef.current();
    const chatId=[user.uid,dmTarget.uid].sort().join("_");
    const q2=query(collection(fbDb,`dms/${chatId}/messages`),orderBy("createdAt","asc"),limit(80));
    dmUnsubRef.current=onSnapshot(q2,snap=>{
      setDmMessages(snap.docs.map(d=>({id:d.id,...d.data()})));
      setTimeout(()=>dmBottomRef.current?.scrollIntoView({behavior:"smooth"}),100);
    });
    return()=>dmUnsubRef.current?.();
  },[dmTarget,user]);

  // ── 친구 목록 구독 ──
  useEffect(()=>{
    if(!user||activeTab!=="chat") return;
    const unsub=onSnapshot(collection(fbDb,`users/${user.uid}/friends`),snap=>{
      setFriends(snap.docs.map(d=>({id:d.id,...d.data()})).filter(f=>f.status==="accepted"));
      setFriendRequests(snap.docs.map(d=>({id:d.id,...d.data()})).filter(f=>f.status==="received"));
    });
    return()=>unsub();
  },[user,activeTab]);

  const sendGlobalMessage=async()=>{
    if(!chatInput.trim()||!user) return;
    const text=chatInput.trim(); setChatInput("");
    await addDoc(collection(fbDb,"globalChat"),{uid:user.uid,displayName:user.displayName,photoURL:user.photoURL,text,createdAt:serverTimestamp()});
  };
  const sendDM=async()=>{
    if(!chatInput.trim()||!user||!dmTarget) return;
    const text=chatInput.trim(); setChatInput("");
    const chatId=[user.uid,dmTarget.uid].sort().join("_");
    await addDoc(collection(fbDb,`dms/${chatId}/messages`),{uid:user.uid,displayName:user.displayName,photoURL:user.photoURL,text,createdAt:serverTimestamp()});
  };
  const searchFriend=async()=>{
    if(!friendSearchInput.trim()||!user) return;
    setFriendSearchLoading(true); setFriendSearchResult(null);
    try{
      const q2=query(collection(fbDb,"userProfiles"),where("email","==",friendSearchInput.trim().toLowerCase()));
      const snap=await getDocs(q2);
      if(snap.empty){setFriendSearchResult({notFound:true});}
      else{const d=snap.docs[0].data();setFriendSearchResult({...d,uid:snap.docs[0].id});}
    }catch(e){showToast("검색 오류: "+e.message,"err");}
    setFriendSearchLoading(false);
  };
  const sendFriendRequest=async(target)=>{
    if(!user) return;
    const batch=[
      setDoc(doc(fbDb,`users/${user.uid}/friends`,target.uid),{uid:target.uid,displayName:target.displayName,photoURL:target.photoURL||"",email:target.email,status:"sent"}),
      setDoc(doc(fbDb,`users/${target.uid}/friends`,user.uid),{uid:user.uid,displayName:user.displayName,photoURL:user.photoURL||"",email:user.email,status:"received"}),
    ];
    await Promise.all(batch);
    showToast(T.friendRequestSent);
    setFriendSearchResult(null); setFriendSearchInput("");
  };
  const acceptFriend=async(req)=>{
    if(!user) return;
    await Promise.all([
      updateDoc(doc(fbDb,`users/${user.uid}/friends`,req.uid),{status:"accepted"}),
      updateDoc(doc(fbDb,`users/${req.uid}/friends`,user.uid),{status:"accepted"}),
    ]);
    showToast(T.friendBecame);
  };
  const declineFriend=async(req)=>{
    if(!user) return;
    await Promise.all([
      deleteDoc(doc(fbDb,`users/${user.uid}/friends`,req.uid)),
      deleteDoc(doc(fbDb,`users/${req.uid}/friends`,user.uid)),
    ]);
  };

  // ── 로그인 시 프로필 등록 ──
  useEffect(()=>{
    if(!user) return;
    setDoc(doc(fbDb,"userProfiles",user.uid),{uid:user.uid,displayName:user.displayName,photoURL:user.photoURL||"",email:user.email},{merge:true}).catch(()=>{});
  },[user]);

  const spokenKey=useRef(-1);
  useEffect(()=>{
    if(mode!==MODES.QUIZ||soundMode!=="auto")return;
    if(!q||q.questionType!==QUIZ_TYPES.HEB_TO_MEAN)return;
    if(spokenKey.current===animKey)return;
    spokenKey.current=animKey;
    const t=setTimeout(()=>speak(q.question),500);
    return()=>clearTimeout(t);
  },[current,animKey,mode,soundMode]);
  useEffect(()=>{if(mode===MODES.ESSAY&&essayInputRef.current)essayInputRef.current.focus();},[essayCurrent,mode]);

  // ── 전체 반복 듣기 effect ──
  useEffect(()=>{
    if(!listenAll.active||listenAll.paused)return;
    const {words:lw,index,rep,repeatN=1}=listenAll;
    if(index>=lw.length){setListenAll(l=>({...l,active:false}));return;}
    const w=lw[index];
    const play=async()=>{
      try{await speakOnDemand(w.hebrew||w);}catch{}
      listenAllRef.current=setTimeout(()=>{
        setListenAll(l=>{
          if(!l.active||l.paused) return l;
          const nextRep=l.rep+1;
          if(nextRep<(l.repeatN||1)) return {...l,rep:nextRep};
          return {...l,index:l.index+1,rep:0};
        });
      },2000);
    };
    play();
    return()=>clearTimeout(listenAllRef.current);
  },[listenAll.active,listenAll.paused,listenAll.index,listenAll.rep]);

  // ── 단어 목록 필터/정렬 ──
  const searchedWords=(()=>{
    let result=words.filter(w=>{
      const mf=listFilter==="all"||w.status===listFilter;if(!mf)return false;
      if(walletFilter){const wl=wallets.find(x=>x.id===walletFilter);if(!wl||!wl.wordIds.includes(w.id))return false;}
      if(!searchQuery.trim())return true;
      const q2=searchQuery.toLowerCase();
      return w.hebrew.includes(searchQuery.trim())||w.meaning.toLowerCase().includes(q2)||(w.hebrew&&stripNikkud(w.hebrew).includes(searchQuery.trim()));
    });
    if(sortBy==="hard_first")result=[...result].sort((a,b)=>{const o={hard:0,learning:1,mastered:2};return(o[a.status]??1)-(o[b.status]??1);});
    else if(sortBy==="mastered_first")result=[...result].sort((a,b)=>{const o={mastered:0,learning:1,hard:2};return(o[a.status]??1)-(o[b.status]??1);});
    else if(sortBy==="wrong_desc")result=[...result].sort((a,b)=>(b.wrongCount||0)-(a.wrongCount||0));
    return result;
  })();
  const totalPages=Math.ceil(searchedWords.length/pageSize);
  const filteredWords=pageSize===9999?searchedWords:searchedWords.slice(page*pageSize,(page+1)*pageSize);

  return (
    <div style={S.root}>
      <style>{`
  *{box-sizing:border-box;} body{margin:0;}
  input,button,textarea{-webkit-tap-highlight-color:transparent;font-family:Arial,'Noto Sans KR',sans-serif;}
  input:focus,textarea:focus{outline:none;border-color:rgba(196,160,80,0.7)!important;background:rgba(255,255,255,0.08)!important;}
  button{line-height:1.3;word-break:keep-all;} span,div{word-break:break-word;}
  @media(max-width:480px){.choices-grid{grid-template-columns:1fr!important;}.quiz-btn-row{flex-direction:column!important;}}
`}</style>
      <div style={S.bgDeco1}/><div style={S.bgDeco2}/>
      {toast&&<div style={{...S.toast,...(toast.type==="err"?S.toastErr:{})}}>{toast.msg}</div>}

      {/* ── 병합 모달 ── */}
      {showMergeModal&&pendingCloudWords&&(
        <div style={S.modalOverlay}><div style={S.modal}>
          <h3 style={S.modalTitle}>{T.syncTitle}</h3>
          <p style={S.modalSub}>{T.syncQuestion}</p>
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            <button style={{...S.btnMerge,padding:"12px"}} onClick={()=>handleMerge("merge")}>{T.mergeBtn}</button>
            <button style={{...S.btnReplace,padding:"12px"}} onClick={()=>handleMerge("cloud")}>{T.useCloudBtn(pendingCloudWords.length)}</button>
            <button style={{...S.btnCancel2,padding:"12px"}} onClick={()=>handleMerge("local")}>{T.keepLocalBtn}</button>
          </div>
        </div></div>
      )}

      {/* ── 가져오기 미리보기 모달 ── */}
      {importPreview&&(
        <div style={S.modalOverlay}><div style={S.modal}>
          <h3 style={S.modalTitle}>📥 단어 불러오기</h3>
          <p style={S.modalSub}>{importPreview.fileName} — <b style={{color:"#e8e6f0"}}>{importPreview.words.length}</b>개 단어</p>
          <div style={{background:"rgba(255,255,255,0.04)",borderRadius:"10px",padding:"10px",marginBottom:"14px",maxHeight:"150px",overflowY:"auto"}}>
            {importPreview.words.slice(0,5).map((w,i)=>(
              <div key={i} style={{padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"center",fontSize:"0.88rem",gap:"4px"}}>
                <span style={{fontFamily:"Arial",color:"#c4a050",direction:"rtl"}}>{w.hebrew}</span>
                <span style={{color:"rgba(255,255,255,0.35)",margin:"0 6px"}}>→</span>
                <span style={{color:"rgba(255,255,255,0.75)"}}>{w.meaning}</span>
              </div>
            ))}
            {importPreview.words.length>5&&<p style={{color:"rgba(255,255,255,0.35)",fontSize:"0.8rem",margin:"6px 0 0"}}>...외 {importPreview.words.length-5}개</p>}
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <button style={S.btnMerge} onClick={()=>confirmImport(true)}>➕ 추가</button>
            <button style={S.btnReplace} onClick={()=>confirmImport(false)}>🔄 전체 교체</button>
            <button style={S.btnCancel2} onClick={()=>setImportPreview(null)}>취소</button>
          </div>
        </div></div>
      )}

      {/* ── 단어장 선택 팝업 ── */}
      {walletPickWord&&(
        <div style={{...S.modalOverlay,zIndex:9999}} onClick={()=>setWalletPickWord(null)}>
          <div style={{...S.modal,maxWidth:"320px",padding:"16px"}} onClick={e=>e.stopPropagation()}>
            <h3 style={{...S.modalTitle,marginBottom:"12px"}}>📚 단어장 선택</h3>
            <div style={{display:"flex",flexDirection:"column",gap:"6px",marginBottom:"12px"}}>
              {wallets.map(wl=>{
                const inWallet=wl.wordIds.includes(walletPickWord);
                return(
                  <button key={wl.id} onClick={()=>toggleWordInWallet(wl.id,walletPickWord)}
                    style={{display:"flex",alignItems:"center",gap:"10px",padding:"10px 14px",borderRadius:"10px",
                      background:inWallet?wl.color+"20":"rgba(255,255,255,0.04)",
                      border:`1px solid ${inWallet?wl.color+"60":wl.color+"25"}`,cursor:"pointer",textAlign:"left"}}>
                    <div style={{width:"16px",height:"16px",borderRadius:"4px",flexShrink:0,background:inWallet?wl.color:"transparent",border:`2px solid ${inWallet?wl.color:"rgba(255,255,255,0.2)"}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {inWallet&&<span style={{color:"#1a1820",fontSize:"0.65rem",fontWeight:700}}>✓</span>}
                    </div>
                    <span style={{color:"#e8e6f0",flex:1,fontWeight:inWallet?600:400}}>{wl.name}</span>
                    <span style={{fontSize:"0.72rem",color:"rgba(255,255,255,0.35)"}}>{words.filter(w=>wl.wordIds.includes(w.id)).length}개</span>
                  </button>
                );
              })}
            </div>
            <button style={{...S.btnMerge,width:"100%"}} onClick={()=>setWalletPickWord(null)}>완료</button>
          </div>
        </div>
      )}

      {/* ── 변형 편집 모달 ── */}
      {expandedVariantWord&&(()=>{
        const ew=words.find(w=>w.id===expandedVariantWord); if(!ew) return null;
        return(
          <div style={{...S.modalOverlay,alignItems:"flex-start",paddingTop:"20px",overflowY:"auto"}}>
            <div style={{...S.modal,maxWidth:"600px",maxHeight:"90vh",overflowY:"auto"}}>
              <h3 style={S.modalTitle}>🔀 변형 편집</h3>
              <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"14px",flexWrap:"wrap"}}>
                <div style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.3rem",color:"#c4a050"}}>{ew.hebrew}</div>
                <button onClick={()=>speakOnDemand(ew.hebrew)} style={{background:"rgba(196,160,80,0.1)",border:"1px solid rgba(196,160,80,0.3)",borderRadius:"6px",padding:"3px 8px",cursor:"pointer",fontSize:"0.9rem"}}>🔈</button>
                <div style={{fontSize:"0.8rem",color:"rgba(255,255,255,0.5)"}}>{ew.meaning}</div>
              </div>
              <div style={{display:"flex",gap:"6px",marginBottom:"14px"}}>
                {[[T.variantTabEdit,false],[T.variantTabView,"view"],[T.variantTabPaste,"paste"]].map(([lbl,val])=>(
                  <button key={lbl} onClick={()=>setVariantPasteMode(val)}
                    style={{...S.optBtn,flex:1,...(variantPasteMode===val?S.optBtnActive:{})}}>
                    {lbl}
                  </button>
                ))}
              </div>
              {variantPasteMode==="paste"&&(
                <div>
                  <textarea style={{width:"100%",minHeight:"140px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(80,160,120,0.3)",borderRadius:"10px",color:"#e8e6f0",padding:"12px",fontSize:"1rem",direction:"rtl",fontFamily:"Arial",resize:"vertical",outline:"none",lineHeight:1.8}} placeholder="여성형&#10;남성형&#10;..." lang="he" spellCheck={false} autoCorrect="off" value={variantPasteText} onChange={e=>setVariantPasteText(e.target.value)}/>
                  <button style={{...S.btnMerge,width:"100%",marginTop:"8px",background:"linear-gradient(135deg,#50c898,#70e8b8)",color:"#0f1a14"}} onClick={()=>applyVariantPaste(variantPasteText)}>📋 자동 매핑 적용</button>
                </div>
              )}
              {variantPasteMode===false&&(
                <div>
                  <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"12px"}}>
                    <button onClick={()=>setWords(ws=>ws.map(w=>w.id===ew.id?{...w,wordType:null}:w))} style={{...S.optBtn,padding:"5px 10px",fontSize:"0.78rem",...(!ew.wordType?S.optBtnActive:{})}}>⚪ 전체</button>
                    {WORD_TYPES.map(wt=>(
                      <button key={wt.id} onClick={()=>setWords(ws=>ws.map(w=>w.id===ew.id?{...w,wordType:wt.id}:w))} style={{...S.optBtn,padding:"5px 10px",fontSize:"0.78rem",...(ew.wordType===wt.id?S.optBtnActive:{})}}>
                        {wt.emoji} {wt.label[uiLang]||wt.label.ko}
                      </button>
                    ))}
                  </div>
                  {getAllowedCats(ew.wordType).map(cat=>(
                    <div key={cat.id} style={{marginBottom:"16px"}}>
                      <div style={{fontSize:"0.72rem",fontWeight:700,color:cat.color,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:"8px",borderBottom:`1px solid ${cat.color}40`,paddingBottom:"4px"}}>{cat.label[uiLang]||cat.label.ko}</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"6px"}}>
                        {cat.types.map(tid=>{
                          const vt=VARIANT_TYPES.find(t=>t.id===tid);
                          return(
                            <div key={tid} style={{display:"flex",flexDirection:"column",gap:"3px"}}>
                              <label style={{fontSize:"0.68rem",color:"rgba(255,255,255,0.5)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                                <span>{vt?vt.label[uiLang]||vt.label.ko:tid}</span>
                                {variantDraft[tid]&&<button onClick={()=>speakOnDemand(variantDraft[tid])} style={{fontSize:"0.7rem",padding:"1px 6px",borderRadius:"4px",background:"rgba(196,160,80,0.1)",border:"1px solid rgba(196,160,80,0.3)",color:"#c4a050",cursor:"pointer"}}>🔈</button>}
                              </label>
                              <input value={variantDraft[tid]||""} onChange={e=>setVariantDraft(d=>({...d,[tid]:e.target.value}))} placeholder="히브리어 입력..." lang="he" spellCheck={false} autoCorrect="off" style={{...S.input,padding:"7px 10px",fontSize:"1rem",direction:"rtl",fontFamily:"Arial",borderColor:variantDraft[tid]?`${cat.color}80`:"rgba(255,255,255,0.1)"}}/>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {variantPasteMode==="view"&&(()=>{
                const v={...Object.fromEntries((ew.variants||[]).map(x=>[x.type,x.form])),...Object.fromEntries(Object.entries(variantDraft).filter(([,f])=>f.trim()))};
                if(!Object.keys(v).length) return <div style={{textAlign:"center",color:"rgba(255,255,255,0.35)",padding:"30px 0"}}>{T.noVariantData}</div>;
                return(
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:"6px",maxHeight:"360px",overflowY:"auto"}}>
                    {Object.entries(v).map(([tid,form])=>{
                      const vt=VARIANT_TYPES.find(t=>t.id===tid);
                      return(
                        <div key={tid} onClick={()=>speakOnDemand(form)} style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"8px",background:"rgba(255,255,255,0.04)",borderRadius:"8px",cursor:"pointer",border:"1px solid rgba(255,255,255,0.08)"}}>
                          <span style={{color:"rgba(255,255,255,0.5)",fontSize:"0.62rem",marginBottom:"4px"}}>{vt?vt.label[uiLang]||vt.label.ko:tid}</span>
                          <span style={{fontFamily:"Arial",direction:"rtl",color:"#f0ece0",fontSize:"1rem",fontWeight:700}}>{form}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              <div style={{display:"flex",gap:"8px",marginTop:"14px",position:"sticky",bottom:0,background:"#1E1D24",paddingTop:"12px"}}>
                {variantPasteMode===false&&<button style={{...S.btnMerge,flex:1}} onClick={()=>saveVariantDraft(ew.id)}>✅ 저장 ({Object.values(variantDraft).filter(v=>v.trim()).length}개)</button>}
                <button style={S.btnCancel2} onClick={()=>{setExpandedVariantWord(null);setVariantPasteMode(false);setVariantPasteText("");}}>취소</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 바텀시트 메뉴 ── */}
      {bottomMenuWord&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:800,display:"flex",alignItems:"flex-end"}} onClick={()=>setBottomMenuWord(null)}>
          <div onClick={e=>e.stopPropagation()} style={{width:"100%",background:"#1E1D24",borderRadius:"20px 20px 0 0",border:"1px solid rgba(255,255,255,0.1)",padding:"20px 16px 32px",boxShadow:"0 -8px 40px rgba(0,0,0,0.6)"}}>
            {/* 핸들 */}
            <div style={{width:"40px",height:"4px",borderRadius:"2px",background:"rgba(255,255,255,0.15)",margin:"0 auto 16px"}}/>
            {/* 단어 정보 */}
            <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"16px",padding:"12px 14px",background:"rgba(255,255,255,0.04)",borderRadius:"12px"}}>
              <div style={{flex:1}}>
                <div style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.3rem",color:"#c4a050",marginBottom:"3px"}}>{bottomMenuWord.hebrew}</div>
                <div style={{fontSize:"0.82rem",color:"rgba(255,255,255,0.5)"}}>{bottomMenuWord.meaning}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"4px"}}>
                <span style={{fontSize:"0.65rem",color:STATUS_CONFIG[bottomMenuWord.status].color,background:STATUS_CONFIG[bottomMenuWord.status].bg,border:`1px solid ${STATUS_CONFIG[bottomMenuWord.status].border}`,borderRadius:"5px",padding:"2px 7px"}}>{STATUS_CONFIG[bottomMenuWord.status].emoji} {STATUS_CONFIG[bottomMenuWord.status].labelKo}</span>
                {(bottomMenuWord.wrongCount||0)>0&&<span style={{fontSize:"0.62rem",color:"#f07050"}}>❌ {bottomMenuWord.wrongCount}회 오답</span>}
              </div>
            </div>
            {/* 상태 변경 */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"6px",marginBottom:"10px"}}>
              {["learning","hard","mastered"].map(s=>{const sc=STATUS_CONFIG[s];return(
                <button key={s} onClick={()=>{setManualStatus(bottomMenuWord.id,s);setBottomMenuWord(null);}} style={{padding:"10px 4px",borderRadius:"10px",border:`1px solid ${bottomMenuWord.status===s?sc.border:"rgba(255,255,255,0.1)"}`,background:bottomMenuWord.status===s?sc.bg:"rgba(255,255,255,0.04)",color:bottomMenuWord.status===s?sc.color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:"0.82rem",fontWeight:600}}>
                  {sc.emoji} {sc.labelKo}
                </button>
              );})}
            </div>
            {/* 액션 버튼들 */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px"}}>
              <button onClick={()=>{speakOnDemand(bottomMenuWord.hebrew);}} style={{padding:"11px",borderRadius:"10px",border:"1px solid rgba(196,160,80,0.3)",background:"rgba(196,160,80,0.1)",color:"#c4a050",cursor:"pointer",fontSize:"0.85rem",fontWeight:600}}>{T.playBtn}</button>
              <button onClick={()=>{startEdit(bottomMenuWord);setBottomMenuWord(null);}} style={{padding:"11px",borderRadius:"10px",border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.8)",cursor:"pointer",fontSize:"0.85rem",fontWeight:600}}>✏️ 편집</button>
              <button onClick={()=>{openVariantModal(bottomMenuWord);setBottomMenuWord(null);}} style={{padding:"11px",borderRadius:"10px",border:"1px solid rgba(100,80,200,0.3)",background:"rgba(100,80,200,0.1)",color:"#9060f0",cursor:"pointer",fontSize:"0.85rem",fontWeight:600}}>🔀 변형 편집</button>
              {wallets.length>0&&<button onClick={()=>{setWalletPickWord(bottomMenuWord.id);setBottomMenuWord(null);}} style={{padding:"11px",borderRadius:"10px",border:"1px solid rgba(196,160,80,0.25)",background:"rgba(196,160,80,0.08)",color:"#c4a050",cursor:"pointer",fontSize:"0.85rem",fontWeight:600}}>📚 단어장 추가</button>}
              <button onClick={()=>{if(window.confirm(T.deleteConfirm))deleteWord(bottomMenuWord.id);setBottomMenuWord(null);}} style={{padding:"11px",borderRadius:"10px",border:"1px solid rgba(200,60,60,0.3)",background:"rgba(200,60,60,0.1)",color:"#f07070",cursor:"pointer",fontSize:"0.85rem",fontWeight:600,gridColumn:wallets.length>0?"auto":"1/-1"}}>🗑️ 삭제</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 반복 듣기 플레이어 바 ── */}
      {listenAll.active&&(
        <div style={{position:"fixed",bottom:isQuizActive?0:60,left:0,right:0,zIndex:190,background:"linear-gradient(135deg,#1a1820,#22202e)",borderTop:"1px solid rgba(196,160,80,0.3)",padding:"8px 16px",display:"flex",alignItems:"center",gap:"10px",boxShadow:"0 -4px 20px rgba(0,0,0,0.4)"}}>
          <span style={{fontSize:"0.7rem",color:"#c4a050",fontWeight:700,flexShrink:0}}>🔈 듣기</span>
          <div style={{flex:1,background:"rgba(255,255,255,0.08)",borderRadius:"4px",height:"4px",overflow:"hidden"}}>
            <div style={{height:"100%",background:"#c4a050",borderRadius:"4px",width:`${(listenAll.index/Math.max(listenAll.words.length,1))*100}%`,transition:"width 0.3s"}}/>
          </div>
          <span style={{fontSize:"0.7rem",color:"rgba(255,255,255,0.5)",flexShrink:0}}>{listenAll.index+1}/{listenAll.words.length} {listenAll.repeatN>1&&<span style={{color:"#c4a050"}}>×{listenAll.rep+1}/{listenAll.repeatN}</span>}</span>
          {listenAll.index<listenAll.words.length&&<span style={{fontSize:"0.72rem",color:"#c4a050",fontFamily:"Arial",direction:"rtl",maxWidth:"80px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{(listenAll.words[listenAll.index]?.hebrew||"")}</span>}
          <button onClick={listenAll.paused?listenAllResumeFn:listenAllPauseFn} style={{padding:"5px 10px",borderRadius:"7px",border:"1px solid rgba(196,160,80,0.4)",background:"rgba(196,160,80,0.15)",color:"#c4a050",cursor:"pointer",fontSize:"0.8rem",flexShrink:0}}>
            {listenAll.paused?"▶":"⏸"}
          </button>
          <button onClick={listenAllStopFn} style={{padding:"5px 10px",borderRadius:"7px",border:"1px solid rgba(200,60,60,0.3)",background:"rgba(200,60,60,0.1)",color:"#f07050",cursor:"pointer",fontSize:"0.8rem",flexShrink:0}}>⏹</button>
        </div>
      )}

      <div style={S.container}>
        {/* ── 헤더 ── */}
        <header style={S.header}>
          <div style={S.headerLeft}>
            <span style={S.logo}>אב</span>
            <div>
              <h1 style={S.title}>{T.tab_list==="단어장"?"히브리어 단어 퀴즈":"Hebrew Quiz"}</h1>
              <div style={{fontSize:"0.65rem",color:ttsReady?"#60c880":"#f07050"}}>{ttsReady?T.ttsHeader(true):T.ttsHeader(false)}</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap",justifyContent:"flex-end"}}>
            <div style={S.statsRow}>
              <div style={{...S.statBadge,color:"#60c880",background:"rgba(60,180,100,0.12)",border:"1px solid rgba(60,180,100,0.3)"}}>✅{masteredCount}</div>
              <div style={{...S.statBadge,color:"#f07050",background:"rgba(200,80,60,0.12)",border:"1px solid rgba(200,80,60,0.3)"}}>🔥{hardCount}</div>
              <div style={{...S.statBadge,color:"#c4a050",background:"rgba(196,160,80,0.12)",border:"1px solid rgba(196,160,80,0.3)"}}>📖{learningCount}</div>
            </div>
            {user?(
              <div style={{display:"flex",alignItems:"center",gap:"5px"}}>
                <img src={user.photoURL} alt="" style={{width:"22px",height:"22px",borderRadius:"50%"}}/>
                {syncing&&<span style={{fontSize:"0.65rem",color:"rgba(255,255,255,0.35)"}}>{T.saving}</span>}
              </div>
            ):(
              <button onClick={signInGoogle} style={{fontSize:"0.72rem",padding:"5px 10px",borderRadius:"8px",background:"linear-gradient(135deg,#c4a050,#e8c875)",border:"none",color:"#1a1820",fontWeight:700,cursor:"pointer"}}>{T.login}</button>
            )}
            <button onClick={()=>{const nl=uiLang==="ko"?"en":"ko";setUiLang(nl);try{localStorage.setItem("uiLang",nl);}catch{}}} style={{fontSize:"0.65rem",padding:"3px 8px",borderRadius:"6px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",color:"#c4a050",cursor:"pointer",fontWeight:700}}>{uiLang==="ko"?"EN":"KO"}</button>
          </div>
        </header>

        {/* ── 퀴즈 진행 중 (탭 숨김) ── */}
        {isQuizActive&&(
          <div>
            {/* MCQ */}
            {mode===MODES.QUIZ&&q&&(
              <div key={animKey}>
                <div style={S.progressBar}><div style={{...S.progressFill,width:`${progress}%`}}/></div>
                <div style={S.progressLabel}><span>{current+1} / {questions.length}</span><span style={S.scoreLabel}>점수: {score}/{current+(confirmed?1:0)}</span></div>
                <div style={S.questionCard}>
                  <div style={S.questionTag}>{q.questionType===QUIZ_TYPES.HEB_TO_MEAN?T.questionTagAtoB(bookInfo):T.questionTagBtoA(bookInfo)}</div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"12px"}}>
                    <div style={{...S.questionText,...(q.questionType===QUIZ_TYPES.HEB_TO_MEAN?{fontFamily:"Arial,sans-serif",fontSize:"clamp(2rem,8vw,3rem)",direction:"rtl"}:{fontSize:"clamp(1.1rem,4vw,1.5rem)"})}}>{q.question}</div>
                    {q.questionType===QUIZ_TYPES.HEB_TO_MEAN?<RepeatSpeakBtn text={q.question} onSpeak={speakOnDemand} muted={muted}/>:confirmed?<RepeatSpeakBtn text={q.answer} onSpeak={speakOnDemand} muted={muted}/>:null}
                  </div>
                </div>
                <div className="choices-grid" style={S.choicesGrid}>
                  {q.choices.map((choice,idx)=>{
                    let extra={};
                    if(confirmed){if(choice===q.answer)extra=S.choiceCorrect;else if(choice===selected)extra=S.choiceWrong;}
                    else if(choice===selected)extra=S.choiceSelected;
                    return(
                      <button key={idx} style={{...S.choiceBtn,...extra}} onClick={()=>!confirmed&&setSelected(choice)}>
                        <span style={S.choiceAlpha}>{"ABCD"[idx]}</span>
                        <span style={q.questionType===QUIZ_TYPES.MEAN_TO_HEB?{fontFamily:"Arial,sans-serif",fontSize:"1.2rem",direction:"rtl"}:{}}>{choice}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{height:"80px",marginBottom:"8px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
                  {confirmed&&(
                    <>
                      <div style={{...(selected===q.answer?S.feedbackCorrect:S.feedbackWrong),marginBottom:"6px",padding:"8px 12px",fontSize:"0.88rem"}}>
                        {selected===q.answer?T.correct:T.wrong(q.answer)}
                      </div>
                      <div style={{display:"flex",gap:"6px",justifyContent:"center",flexWrap:"wrap"}}>
                        {(()=>{const w=words.find(x=>x.id===q.wordId);if(!w)return null;return(<>
                          {w.status!=="hard"&&<button onClick={()=>setManualStatus(q.wordId,"hard")} style={{padding:"3px 10px",borderRadius:"6px",background:"rgba(200,80,60,0.15)",border:"1px solid rgba(200,80,60,0.4)",color:"#f07050",fontSize:"0.72rem",cursor:"pointer"}}>{T.hardBtn}</button>}
                          {w.status!=="mastered"&&<button onClick={()=>setManualStatus(q.wordId,"mastered")} style={{padding:"3px 10px",borderRadius:"6px",background:"rgba(60,180,100,0.15)",border:"1px solid rgba(60,180,100,0.4)",color:"#60c880",fontSize:"0.72rem",cursor:"pointer"}}>{T.masteredBtn}</button>}
                          {w.status!=="learning"&&<button onClick={()=>setManualStatus(q.wordId,"learning")} style={{padding:"3px 10px",borderRadius:"6px",background:"rgba(120,120,160,0.15)",border:"1px solid rgba(120,120,160,0.3)",color:"#9090b0",fontSize:"0.72rem",cursor:"pointer"}}>{T.learningBtn}</button>}
                        </>);})()}
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

            {/* Essay */}
            {mode===MODES.ESSAY&&eq&&(
              <div key={animKey}>
                <div style={{...S.progressBar,background:"rgba(100,80,200,0.15)"}}><div style={{...S.progressFill,width:`${essayProgress}%`,background:"linear-gradient(90deg,#6040c8,#9060f0)"}}/></div>
                <div style={S.progressLabel}><span>✍️ {essayCurrent+1} / {essayQuestions.length}</span><span style={{color:"#9060f0",fontWeight:600}}>정답 {essayResults.filter(r=>r.result!=="wrong").length}/{essayCurrent+(essayConfirmed?1:0)}</span></div>
                <div style={{...S.questionCard,border:"1px solid rgba(100,80,200,0.3)"}}>
                  <div style={{...S.questionTag,color:"#9060f0"}}>{eq.questionType==="heb_to_mean"?T.questionTagAtoB(bookInfo):T.questionTagBtoA(bookInfo)}</div>
                  {eq.questionType==="heb_to_mean"?<div style={{fontFamily:"Arial,sans-serif",fontSize:"clamp(2rem,8vw,3rem)",direction:"rtl",color:"#f0ece0",marginBottom:"14px"}}>{eq.question}</div>:<div style={{fontSize:"clamp(1.1rem,4vw,1.5rem)",color:"#f0ece0",marginBottom:"14px",lineHeight:1.4}}>{eq.question}</div>}
                  <RepeatSpeakBtn text={eq.hebrewWord} onSpeak={speakOnDemand} muted={muted}/>
                </div>
                {eq.questionType==="heb_to_mean"&&(
                  <input ref={essayInputRef} style={{...S.input,fontSize:"1.1rem",marginBottom:"12px"}} placeholder={T.inputPlaceholderA(bookInfo)} value={essayInput} onChange={e=>!essayConfirmed&&setEssayInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){if(!essayConfirmed)handleEssayConfirm();else handleEssayNext();}}} readOnly={essayConfirmed}/>
                )}
                {eq.questionType==="mean_to_heb"&&(
                  <input ref={essayHebrewRef} style={{...S.input,fontSize:"1.3rem",fontFamily:"Arial,sans-serif",direction:"rtl",marginBottom:"12px"}} placeholder={T.inputPlaceholderB(bookInfo)} lang="he" spellCheck={false} autoCorrect="off" defaultValue="" readOnly={essayConfirmed} onKeyDown={e=>{if(e.key==="Enter"){if(!essayConfirmed)handleEssayConfirm();else handleEssayNext();}}}/>
                )}
                {essayConfirmed&&(()=>{
                  const last=essayResults[essayResults.length-1]; const w=words.find(x=>x.id===eq.wordId);
                  return(<>
                    {last?.result==="exact"?<div style={{...S.feedbackCorrect,flexWrap:"wrap",marginBottom:"6px"}}>{T.correct} <SpeakBtn text={eq.hebrewWord} onSpeak={speakOnDemand} muted={muted}/></div>
                    :last?.result==="partial"?<div style={{...S.feedbackCorrect,background:"rgba(196,160,80,0.15)",borderColor:"rgba(196,160,80,0.3)",color:"#e8c875",flexWrap:"wrap",marginBottom:"6px"}}>{T.partial} {T.partialAnswer}: <b>{eq.answer}</b> <SpeakBtn text={eq.hebrewWord} onSpeak={speakOnDemand} muted={muted}/></div>
                    :<div style={{...S.feedbackWrong,flexWrap:"wrap",marginBottom:"6px"}}>{T.wrong(eq.answer)} <SpeakBtn text={eq.hebrewWord} onSpeak={speakOnDemand} muted={muted}/></div>}
                    {w&&<div style={{display:"flex",gap:"6px",justifyContent:"center",flexWrap:"wrap",marginBottom:"8px"}}>
                      {w.status!=="mastered"&&<button onClick={()=>setManualStatus(eq.wordId,"mastered")} style={{padding:"3px 10px",borderRadius:"6px",background:"rgba(60,180,100,0.15)",border:"1px solid rgba(60,180,100,0.4)",color:"#60c880",fontSize:"0.72rem",cursor:"pointer"}}>{T.masteredBtn}</button>}
                      {w.status!=="hard"&&<button onClick={()=>setManualStatus(eq.wordId,"hard")} style={{padding:"3px 10px",borderRadius:"6px",background:"rgba(200,80,60,0.15)",border:"1px solid rgba(200,80,60,0.4)",color:"#f07050",fontSize:"0.72rem",cursor:"pointer"}}>{T.hardBtn}</button>}
                    </div>}
                  </>);
                })()}
                <div className="quiz-btn-row" style={S.quizBtnRow}>
                  {!essayConfirmed?<button style={S.btnEssayConfirm} onClick={handleEssayConfirm}>{T.confirm}</button>:<button style={S.btnNext} onClick={handleEssayNext}>{essayCurrent+1>=essayQuestions.length?T.finish:T.next}</button>}
                  <button style={S.btnQuit} onClick={()=>{window.speechSynthesis?.cancel();setMode(MODES.LIST);}}>{T.quit}</button>
                </div>
              </div>
            )}

            {/* Variant Quiz */}
            {mode===MODES.VARIANT&&variantQuestions[variantCur]&&(()=>{
              const vq=variantQuestions[variantCur];
              const vt=VARIANT_TYPES.find(t=>t.id===vq.variantType);
              const prog=((variantCur+(variantConfirmed?1:0))/variantQuestions.length)*100;
              const lastResult=variantResults[variantResults.length-1];
              return(
                <div>
                  <div style={{...S.progressBar,background:"rgba(80,160,120,0.15)"}}><div style={{...S.progressFill,width:`${prog}%`,background:"linear-gradient(90deg,#50c898,#70e8b8)"}}/></div>
                  <div style={S.progressLabel}><span>🔀 {variantCur+1}/{variantQuestions.length}</span><span style={{color:"#50c898",fontWeight:600}}>정답 {variantResults.filter(r=>r.correct).length}/{variantCur+(variantConfirmed?1:0)}</span></div>
                  <div style={{...S.questionCard,border:"1px solid rgba(80,160,120,0.3)"}}>
                    <div style={{...S.questionTag,color:"#50c898"}}>{vt?vt.prompt[uiLang]||vt.prompt.ko:vq.variantType}</div>
                    <div style={{fontFamily:"Arial",fontSize:"clamp(2.5rem,9vw,4rem)",direction:"rtl",color:"#f0ece0",marginBottom:"6px",lineHeight:1.2}}>{vq.base}</div>
                    <div style={{fontSize:"1rem",color:"rgba(255,255,255,0.75)",marginBottom:"16px"}}>{vq.meaning}</div>
                    <SpeakBtn text={vq.base} onSpeak={speakOnDemand} muted={muted} size="lg"/>
                  </div>
                  {variantQuizType==="essay"&&(
                    <>
                      <input ref={variantInputRef} style={{...S.input,fontSize:"1.3rem",fontFamily:"Arial",direction:"rtl",marginBottom:"12px"}} placeholder="변형을 히브리어로 입력..." value={variantInput} onChange={e=>!variantConfirmed&&setVariantInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){if(!variantConfirmed)handleVariantConfirm();else handleVariantNext();}}} readOnly={variantConfirmed} lang="he" spellCheck={false} autoCorrect="off"/>
                      {variantConfirmed&&<div style={{marginBottom:"10px",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px"}}>
                        {lastResult?.correct?<div style={{...S.feedbackCorrect,padding:"8px 16px"}}>✅ 정답!</div>:<div style={{...S.feedbackWrong,padding:"8px 16px",display:"flex",alignItems:"center",gap:"8px"}}>❌ 정답: <b style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.2rem"}}>{vq.answer}</b><SpeakBtn text={vq.answer} onSpeak={speakOnDemand} muted={muted}/></div>}
                      </div>}
                    </>
                  )}
                  {variantQuizType==="mcq"&&(
                    <>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"12px"}}>
                        {(vq.choices||[]).map((choice,ci)=>{
                          const isSelected=variantSelected===choice;
                          const isCorrect=variantConfirmed&&choice===vq.answer;
                          const isWrong=variantConfirmed&&isSelected&&choice!==vq.answer;
                          return(
                            <button key={ci} onClick={()=>!variantConfirmed&&setVariantSelected(choice)} style={{padding:"14px 10px",borderRadius:"12px",fontFamily:"Arial",direction:"rtl",fontSize:"clamp(1rem,4vw,1.4rem)",fontWeight:600,cursor:variantConfirmed?"default":"pointer",border:`2px solid ${isCorrect?"rgba(60,180,100,0.8)":isWrong?"rgba(200,60,60,0.8)":isSelected?"rgba(80,160,120,0.6)":"rgba(255,255,255,0.1)"}`,background:isCorrect?"rgba(60,180,100,0.2)":isWrong?"rgba(200,60,60,0.15)":isSelected?"rgba(80,160,120,0.15)":"rgba(255,255,255,0.04)",color:isCorrect?"#60e898":isWrong?"#f07070":isSelected?"#50c898":"#e8e6f0"}}>
                              {choice}
                            </button>
                          );
                        })}
                      </div>
                      {variantConfirmed&&<div style={{marginBottom:"10px",display:"flex",alignItems:"center",justifyContent:"center",gap:"8px"}}>
                        {lastResult?.correct?<div style={{...S.feedbackCorrect,padding:"8px 16px"}}>✅ 정답!</div>:<div style={{...S.feedbackWrong,padding:"8px 16px",display:"flex",alignItems:"center",gap:"8px"}}>❌ 정답: <b style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.2rem"}}>{vq.answer}</b><SpeakBtn text={vq.answer} onSpeak={speakOnDemand} muted={muted}/></div>}
                      </div>}
                    </>
                  )}
                  <div className="quiz-btn-row" style={S.quizBtnRow}>
                    {!variantConfirmed?<button style={{...S.btnConfirm,background:"linear-gradient(135deg,#50c898,#70e8b8)",color:"#0f1a14",...(variantQuizType==="essay"?(!variantInput.trim()?S.btnDisabled:{}):(variantSelected===null?S.btnDisabled:{}))}} onClick={handleVariantConfirm} disabled={variantQuizType==="essay"?!variantInput.trim():variantSelected===null}>{T.confirm}</button>:<button style={{...S.btnNext,background:"linear-gradient(135deg,#50c898,#70e8b8)",color:"#0f1a14"}} onClick={handleVariantNext}>{variantCur+1>=variantQuestions.length?T.finish:T.next}</button>}
                    <button style={S.btnQuit} onClick={()=>{window.speechSynthesis?.cancel();setMode(MODES.LIST);}}>{T.quit}</button>
                  </div>
                </div>
              );
            })()}

            {/* Results */}
            {mode===MODES.RESULT&&(
              <div style={S.resultWrap}>
                <div style={S.resultCircle}><span style={S.resultScore}>{score}</span><span style={S.resultTotal}>/{questions.length}</span></div>
                <p style={S.resultMsg}>{score===questions.length?T.quizPerfect:score>=questions.length*0.7?"👏 잘했어요!":"📖 다시 도전!"}</p>
                <p style={S.resultPct}>{Math.round(score/questions.length*100)}%</p>
                {wrongWords.length>0&&<div style={S.wrongList}><h3 style={S.wrongTitle}>❌ 틀린 단어</h3>{wrongWords.map((q2,i)=>{const w=words.find(x=>x.id===q2.wordId);return w?<div key={i} style={S.wrongItem}><span style={{fontFamily:"Arial,sans-serif",fontSize:"1.1rem",direction:"rtl",color:"#c4a050"}}>{w.hebrew}</span><SpeakBtn text={w.hebrew} onSpeak={speakOnDemand} muted={muted}/><span style={{color:"rgba(255,255,255,0.35)",margin:"0 4px"}}>→</span><span style={{fontSize:"0.9rem"}}>{w.meaning}</span></div>:null;})}</div>}
                <div style={{display:"flex",gap:"10px"}}><button style={{...S.btnStart,flex:1}} onClick={startQuiz}>🔄 다시 풀기</button><button style={{...S.btnQuit,flex:1}} onClick={()=>setMode(MODES.LIST)}>📚 단어장으로</button></div>
              </div>
            )}
            {mode===MODES.ESSAY_RESULT&&(
              <div style={S.resultWrap}>
                <div style={{...S.resultCircle,border:"3px solid rgba(100,80,200,0.5)",background:"rgba(100,80,200,0.1)"}}><span style={{...S.resultScore,color:"#9060f0"}}>{essayScore+essayPartial}</span><span style={S.resultTotal}>/{essayQuestions.length}</span></div>
                <div style={{display:"flex",justifyContent:"center",gap:"20px",marginBottom:"16px"}}>
                  <div style={{textAlign:"center",color:"#60c880"}}><div style={{fontSize:"1.4rem",fontWeight:800}}>{essayScore}</div><div style={{fontSize:"0.72rem",opacity:0.7}}>✅ 정답</div></div>
                  <div style={{textAlign:"center",color:"#e8c875"}}><div style={{fontSize:"1.4rem",fontWeight:800}}>{essayPartial}</div><div style={{fontSize:"0.72rem",opacity:0.7}}>🟡 부분</div></div>
                  <div style={{textAlign:"center",color:"#f08080"}}><div style={{fontSize:"1.4rem",fontWeight:800}}>{essayQuestions.length-essayScore-essayPartial}</div><div style={{fontSize:"0.72rem",opacity:0.7}}>❌ 오답</div></div>
                </div>
                <div style={S.wrongList}>
                  {essayResults.map((r,i)=>(
                    <div key={i} style={{...S.wrongItem,flexDirection:"column",alignItems:"flex-start",gap:"3px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",width:"100%"}}>
                        <span style={{fontFamily:r.questionType==="mean_to_heb"?"inherit":"Arial,sans-serif",fontSize:r.questionType==="mean_to_heb"?"0.9rem":"1.05rem",direction:r.questionType==="mean_to_heb"?"ltr":"rtl",color:"#c4a050"}}>{r.question}</span>
                        <SpeakBtn text={r.question} onSpeak={speakOnDemand} muted={muted}/>
                        <span style={{marginLeft:"auto"}}>{r.result==="exact"?"✅":r.result==="partial"?"🟡":"❌"}</span>
                      </div>
                      <div style={{fontSize:"0.82rem",color:"rgba(255,255,255,0.5)"}}>내 답: <span style={{color:r.result==="exact"?"#60c880":r.result==="partial"?"#e8c875":"#f08080"}}>{r.userInput}</span></div>
                      {r.result!=="exact"&&<div style={{fontSize:"0.82rem"}}>정답: <span style={{color:"#60c880"}}>{r.answer}</span></div>}
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:"10px"}}><button style={{...S.btnEssayStart,flex:1}} onClick={startEssay}>🔄 다시 풀기</button><button style={{...S.btnQuit,flex:1}} onClick={()=>setMode(MODES.LIST)}>📚 단어장으로</button></div>
              </div>
            )}
            {mode===MODES.VARIANT_RESULT&&(
              <div style={S.resultWrap}>
                <div style={{...S.resultCircle,border:"3px solid rgba(80,160,120,0.5)",background:"rgba(80,160,120,0.1)"}}><span style={{...S.resultScore,color:"#50c898"}}>{variantResults.filter(r=>r.correct).length}</span><span style={S.resultTotal}>/{variantQuestions.length}</span></div>
                <p style={S.resultMsg}>{variantResults.filter(r=>r.correct).length===variantQuestions.length?T.quizPerfect:T.quizVariantDone}</p>
                <div style={S.wrongList}>
                  {variantResults.map((r,i)=>{
                    const vt=VARIANT_TYPES.find(t=>t.id===r.variantType);
                    return(
                      <div key={i} style={{...S.wrongItem,flexDirection:"column",alignItems:"flex-start",gap:"3px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:"8px",width:"100%"}}>
                          <span style={{fontFamily:"Arial",direction:"rtl",color:"#c4a050",fontSize:"1rem"}}>{r.base}</span>
                          <span style={{fontSize:"0.7rem",color:"#50c898",background:"rgba(80,160,120,0.15)",padding:"2px 6px",borderRadius:"4px"}}>{vt?vt.label[uiLang]||vt.label.ko:r.variantType}</span>
                          <SpeakBtn text={r.answer} onSpeak={speakOnDemand} muted={muted}/>
                          <span style={{marginLeft:"auto"}}>{r.correct?"✅":"❌"}</span>
                        </div>
                        <div style={{fontSize:"0.82rem",color:"rgba(255,255,255,0.5)"}}>입력: <span style={{color:r.correct?"#80e8a0":"#f08080",fontFamily:"Arial",direction:"rtl"}}>{r.userInput}</span>{!r.correct&&<><span style={{marginLeft:"8px"}}>정답: </span><span style={{color:"#50c898",fontFamily:"Arial",direction:"rtl"}}>{r.answer}</span></>}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{display:"flex",gap:"10px"}}><button style={{...S.btnStart,flex:1,background:"linear-gradient(135deg,#50c898,#70e8b8)",color:"#0f1a14"}} onClick={startVariantQuiz}>🔄 다시 풀기</button><button style={{...S.btnQuit,flex:1}} onClick={()=>setMode(MODES.LIST)}>📚 단어장으로</button></div>
              </div>
            )}
          </div>
        )}

        {/* ── 탭 콘텐츠 (퀴즈 중엔 숨김) ── */}
        {!isQuizActive&&(
          <div style={{paddingBottom:"80px"}}>

            {/* ── 📚 단어장 탭 ── */}
            {activeTab==="list"&&(
              <div>
                {/* 책 선택 */}
                <div style={{display:"flex",gap:"6px",marginBottom:"12px"}}>
                  {BOOKS.map(b=>(
                    <button key={b.id} onClick={()=>switchBook(b.id)} style={{padding:"8px 14px",borderRadius:"10px",border:"1px solid",fontSize:"0.82rem",fontWeight:600,cursor:"pointer",background:currentBook===b.id?`rgba(${b.id==="hebrew"?"196,160,80":b.id==="english"?"60,100,200":"200,60,100"},0.2)`:"rgba(255,255,255,0.04)",borderColor:currentBook===b.id?b.color:"rgba(255,255,255,0.1)",color:currentBook===b.id?b.color:"rgba(255,255,255,0.35)"}}>
                      {b.emoji} {b.label[uiLang]||b.label.ko}
                    </button>
                  ))}
                </div>

                {/* 검색 + 정렬 */}
                <div style={{display:"flex",gap:"8px",marginBottom:"10px",flexWrap:"wrap",alignItems:"center"}}>
                  <input style={{...S.input,flex:1,minWidth:"160px",padding:"9px 14px",fontSize:"0.9rem"}} placeholder={T.searchPlaceholder} value={searchQuery} onChange={e=>{setSearchQuery(e.target.value);setPage(0);}}/>
                  <select value={sortBy} onChange={e=>{setSortBy(e.target.value);setPage(0);}} style={{padding:"8px 10px",borderRadius:"8px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",color:"#c4a050",fontSize:"0.78rem",cursor:"pointer",outline:"none"}}>
                    <option value="default">{T.sortDefault}</option>
                    <option value="hard_first">{T.sortHardFirst}</option>
                    <option value="mastered_first">{T.sortMasteredFirst}</option>
                    <option value="wrong_desc">{T.sortWrongFirst}</option>
                  </select>
                  <div style={{display:"flex",gap:"4px"}}>
                    {[10,20,9999].map(n=>(
                      <button key={n} onClick={()=>{setPageSize(n);setPage(0);}} style={{...S.optBtn,padding:"8px 10px",fontSize:"0.78rem",...(pageSize===n?S.optBtnActive:{})}}>
                        {n===9999?(uiLang==="en"?"All":"전체"):n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 전체 반복 듣기 */}
                <div style={{marginBottom:"10px"}}>
                  <div style={{display:"flex",gap:"6px",alignItems:"center",marginBottom:"6px"}}>
                    <span style={{fontSize:"0.72rem",color:"rgba(255,255,255,0.45)",flexShrink:0}}>{T.repeatPerWord}</span>
                    <div style={{display:"flex",gap:"4px",flex:1,flexWrap:"wrap"}}>
                      {[1,3,5,10].map(n=>(
                        <button key={n} onClick={()=>setListenRepeat(n)} style={{padding:"4px 10px",borderRadius:"6px",fontSize:"0.75rem",fontWeight:700,cursor:"pointer",border:"1px solid",background:listenRepeat===n?"rgba(196,160,80,0.25)":"rgba(255,255,255,0.04)",borderColor:listenRepeat===n?"rgba(196,160,80,0.6)":"rgba(255,255,255,0.1)",color:listenRepeat===n?"#c4a050":"rgba(255,255,255,0.4)"}}>
                          {n}{T.timesUnit}
                        </button>
                      ))}
                      <input type="number" min={1} max={50} value={listenRepeat} onChange={e=>setListenRepeat(Math.max(1,Math.min(50,Number(e.target.value)||1)))} style={{width:"54px",padding:"3px 8px",borderRadius:"6px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",color:"#c4a050",fontSize:"0.8rem",textAlign:"center",outline:"none",fontWeight:700}}/>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:"6px"}}>
                    <button onClick={()=>{if(listenAll.active)listenAllStopFn();else listenAllStart(walletFilter?words.filter(w=>wallets.find(x=>x.id===walletFilter)?.wordIds.includes(w.id)):searchedWords);}} style={{...S.optBtn,flex:1,padding:"9px",...(listenAll.active?{background:"rgba(200,60,60,0.15)",borderColor:"rgba(200,60,60,0.4)",color:"#f07050"}:{background:"rgba(196,160,80,0.1)",borderColor:"rgba(196,160,80,0.3)",color:"#c4a050"})}}>
                      {listenAll.active?T.listenStopBtn:T.listenAllBtn}
                    </button>
                    {listenAll.active&&(
                      <button onClick={listenAll.paused?listenAllResumeFn:listenAllPauseFn} style={{...S.optBtn,padding:"9px 14px"}}>
                        {listenAll.paused?T.resumeBtn:T.pauseBtn}
                      </button>
                    )}
                  </div>
                </div>

                {/* 어근 그룹 토글 */}
                {currentBook==="hebrew"&&words.some(w=>w.root)&&(
                  <button onClick={()=>setRootGroupView(v=>!v)} style={{...S.optBtn,width:"100%",marginBottom:"10px",padding:"9px",...(rootGroupView?{background:"rgba(80,160,120,0.2)",borderColor:"rgba(80,160,120,0.5)",color:"#50c898"}:{})}}>
                    {T.rootGroupView}
                  </button>
                )}

                {/* 어근 그룹 뷰 */}
                {rootGroupView&&(()=>{
                  const grouped={};
                  words.filter(w=>w.root).forEach(w=>{if(!grouped[w.root])grouped[w.root]=[];grouped[w.root].push(w);});
                  const roots=Object.entries(grouped).sort((a,b)=>b[1].length-a[1].length);
                  if(!roots.length) return <div style={S.emptyMsg}>{T.noRootWords}</div>;
                  return(
                    <div style={{marginBottom:"14px"}}>
                      {roots.map(([root,ws])=>(
                        <div key={root} style={{marginBottom:"10px",background:"rgba(255,255,255,0.03)",borderRadius:"14px",border:"1px solid rgba(80,160,120,0.2)",overflow:"hidden"}}>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"rgba(80,160,120,0.08)",flexWrap:"wrap",gap:"8px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                              <span style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.2rem",color:"#50c898",fontWeight:700}}>{root}</span>
                              <span style={{fontSize:"0.75rem",color:"rgba(255,255,255,0.35)"}}>{ws.length}개 단어</span>
                            </div>
                          </div>
                          <div style={{padding:"10px 14px",display:"flex",flexWrap:"wrap",gap:"8px"}}>
                            {ws.map(w=>{const st=STATUS_CONFIG[w.status];return(
                              <div key={w.id} style={{display:"flex",alignItems:"center",gap:"6px",padding:"6px 10px",background:"rgba(255,255,255,0.04)",borderRadius:"9px",border:`1px solid ${st.border}`}}>
                                <span style={{fontFamily:"Arial",direction:"rtl",color:"#c4a050",fontSize:"1rem"}}>{w.hebrew}</span>
                                <span style={{color:"rgba(255,255,255,0.5)",fontSize:"0.78rem"}}>{w.meaning||"—"}</span>
                                <span style={{fontSize:"0.7rem"}}>{st.emoji}</span>
                                <button onClick={()=>startEdit(w)} style={{background:"transparent",border:"none",cursor:"pointer",fontSize:"0.9rem",opacity:0.5}}>✏️</button>
                              </div>
                            );})}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* 필터 탭 */}
                <div style={{display:"flex",gap:"6px",marginBottom:"12px",overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",paddingBottom:"2px"}}>
                  {[["all",T.all,words.length],["learning",T.learning,learningCount],["hard",T.hard,hardCount],["mastered",T.done,masteredCount]].map(([val,label,cnt])=>(
                    <button key={val} style={{...S.filterTab,...(listFilter===val&&!walletFilter?S.filterTabActive:{})}} onClick={()=>{setListFilter(val);setWalletFilter(null);setPage(0);setSelectedIds(new Set());}}>
                      {label}<span style={S.filterCnt}>{cnt}</span>
                    </button>
                  ))}
                  {wallets.map(wl=>{
                    const cnt=words.filter(w=>wl.wordIds.includes(w.id)).length;
                    const isActive=walletFilter===wl.id;
                    return(
                      <button key={wl.id} style={{...S.filterTab,...(isActive?{background:wl.color+"25",borderColor:wl.color+"60",color:wl.color}:{})}} onClick={()=>{setWalletFilter(isActive?null:wl.id);setPage(0);setSelectedIds(new Set());}}>
                        <span style={{width:"8px",height:"8px",borderRadius:"50%",background:wl.color,display:"inline-block",flexShrink:0}}/>{wl.name}<span style={S.filterCnt}>{cnt}</span>
                      </button>
                    );
                  })}
                </div>

                {/* 선택 + 일괄 작업 */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px",flexWrap:"wrap",gap:"6px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                    <span style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.35)"}}>{T.wordCount(searchedWords.length)}</span>
                    <button style={{...S.scrollBtn,fontSize:"0.75rem"}} onClick={()=>{if(selectedIds.size===filteredWords.length)setSelectedIds(new Set());else setSelectedIds(new Set(filteredWords.map(w=>w.id)));}}>
                      {selectedIds.size===filteredWords.length&&filteredWords.length>0?T.deselect:T.selectAll}
                    </button>
                    {selectedIds.size>0&&(<>
                      {wallets.length>0&&(
                        <div style={{position:"relative",display:"inline-block"}}>
                          <button style={{...S.scrollBtn,background:"rgba(196,160,80,0.15)",borderColor:"rgba(196,160,80,0.4)",color:"#c4a050",fontSize:"0.75rem"}} onClick={()=>setBulkWalletOpen(v=>!v)}>
                            📚 {selectedIds.size}개 → 단어장 ▾
                          </button>
                          {bulkWalletOpen&&(
                            <div style={{position:"absolute",top:"100%",left:0,zIndex:50,marginTop:"4px",background:"rgba(26,24,40,0.98)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"10px",padding:"10px",minWidth:"180px",boxShadow:"0 4px 20px rgba(0,0,0,0.5)"}}>
                              {(()=>{
                                const sel=bulkWalletOpen instanceof Set?bulkWalletOpen:new Set();
                                return(<>
                                  {wallets.map(wl=>{
                                    const checked=sel.has(wl.id);
                                    return(
                                      <button key={wl.id} onClick={()=>{const ns=new Set(sel);checked?ns.delete(wl.id):ns.add(wl.id);setBulkWalletOpen(ns);}} style={{display:"flex",alignItems:"center",gap:"8px",padding:"7px 10px",width:"100%",background:checked?wl.color+"15":"rgba(255,255,255,0.03)",border:"none",borderRadius:"6px",cursor:"pointer",color:checked?wl.color:"#e8e6f0",fontSize:"0.82rem",marginBottom:"3px"}}>
                                        <div style={{width:"14px",height:"14px",borderRadius:"3px",flexShrink:0,background:checked?wl.color:"transparent",border:`2px solid ${checked?wl.color:"rgba(255,255,255,0.25)"}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                                          {checked&&<span style={{color:"#1a1820",fontSize:"0.6rem",fontWeight:700}}>✓</span>}
                                        </div>
                                        <span style={{width:"8px",height:"8px",borderRadius:"50%",background:wl.color,flexShrink:0}}/>{wl.name}
                                      </button>
                                    );
                                  })}
                                  {sel.size>0&&(
                                    <button onClick={()=>{saveWallets(wallets.map(wl=>sel.has(wl.id)?{...wl,wordIds:[...new Set([...wl.wordIds,...selectedIds])]}:wl));setBulkWalletOpen(false);setSelectedIds(new Set());showToast(T.addedToWallet(selectedIds.size));}} style={{width:"100%",marginTop:"6px",padding:"7px",borderRadius:"7px",background:"linear-gradient(135deg,#c4a050,#e8c875)",border:"none",color:"#1a1820",fontWeight:700,cursor:"pointer",fontSize:"0.82rem"}}>
                                      {T.addNToWallet(sel.size)}
                                    </button>
                                  )}
                                </>);
                              })()}
                            </div>
                          )}
                        </div>
                      )}
                      <button style={{...S.scrollBtn,background:"rgba(200,60,60,0.15)",borderColor:"rgba(200,60,60,0.4)",color:"#f08080",fontSize:"0.75rem"}} onClick={()=>{if(window.confirm(T.deleteNConfirm(selectedIds.size))){setWords(ws=>ws.filter(w=>!selectedIds.has(w.id)));setSelectedIds(new Set());}}}>
                        {T.deleteN(selectedIds.size)}
                      </button>
                    </>)}
                  </div>
                </div>

                {/* 단어 목록 */}
                <div style={{display:"flex",flexDirection:"column",gap:"6px",marginBottom:"12px"}}>
                  {filteredWords.length===0&&<div style={S.emptyMsg}>{searchQuery?T.searchNoResult:T.noWords}</div>}
                  {filteredWords.map((w,i)=>{
                    const st=STATUS_CONFIG[w.status];
                    return(
                      <div key={w.id} style={{...S.wordItem,borderColor:selectedIds.has(w.id)?"rgba(200,60,60,0.5)":st.border,background:selectedIds.has(w.id)?"rgba(200,60,60,0.08)":undefined}}>
                        <input type="checkbox" checked={selectedIds.has(w.id)} onChange={e=>{const s=new Set(selectedIds);e.target.checked?s.add(w.id):s.delete(w.id);setSelectedIds(s);}} style={{width:"16px",height:"16px",cursor:"pointer",accentColor:"#f08080",flexShrink:0}}/>
                        <span style={{fontSize:"0.7rem",color:"rgba(255,255,255,0.25)",minWidth:"16px",flexShrink:0}}>{i+1}</span>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                            <span style={S.wordHeb}>{w.hebrew}</span>
                            <span style={{fontSize:"0.65rem",color:st.color,background:st.bg,border:`1px solid ${st.border}`,borderRadius:"4px",padding:"1px 5px",flexShrink:0}}>{st.emoji}</span>
                            {(w.wrongCount||0)>0&&<span style={{fontSize:"0.6rem",color:"#f07050",background:"rgba(200,60,60,0.12)",border:"1px solid rgba(200,60,60,0.25)",borderRadius:"4px",padding:"1px 5px",flexShrink:0}}>❌{w.wrongCount}</span>}
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:"5px",flexWrap:"wrap",marginTop:"2px"}}>
                            <span style={S.wordMean}>{w.meaning||<span style={{color:"rgba(255,255,255,0.18)",fontStyle:"italic"}}>{T.noMeaning}</span>}</span>
                            {w.root&&<span style={{fontSize:"0.6rem",background:"rgba(80,160,120,0.12)",border:"1px solid rgba(80,160,120,0.25)",borderRadius:"4px",padding:"1px 5px",color:"#50c898",fontFamily:"Arial",direction:"rtl"}}>{w.root}</span>}
                            {(w.variants||[]).length>0&&<span style={{fontSize:"0.6rem",color:"#9060f0",background:"rgba(100,80,200,0.12)",border:"1px solid rgba(100,80,200,0.2)",borderRadius:"4px",padding:"1px 4px"}}>🔀{w.variants.length}</span>}
                          </div>
                        </div>
                        <div style={{display:"flex",gap:"5px",alignItems:"center",flexShrink:0}}>
                          <SpeakOnceBtn text={w.hebrew} onSpeak={speakOnDemand} muted={muted} repeatN={1}/>
                          <button onClick={e=>{e.stopPropagation();setBottomMenuWord(w);}} style={{padding:"5px 9px",borderRadius:"7px",border:"1px solid rgba(255,255,255,0.12)",background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.75)",cursor:"pointer",fontSize:"1rem",lineHeight:1}}>···</button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 페이지네이션 */}
                {pageSize!==9999&&totalPages>1&&(
                  <div style={{display:"flex",justifyContent:"center",gap:"6px",marginBottom:"14px",flexWrap:"wrap"}}>
                    <button style={{...S.scrollBtn,...(page===0?{opacity:0.3}:{})}} onClick={()=>page>0&&setPage(p=>p-1)} disabled={page===0}>{T.prevPage}</button>
                    {Array.from({length:totalPages},(_,i)=>(
                      <button key={i} style={{...S.scrollBtn,...(page===i?{background:"rgba(196,160,80,0.3)",borderColor:"rgba(196,160,80,0.6)",color:"#c4a050"}:{})}} onClick={()=>setPage(i)}>{i+1}</button>
                    ))}
                    <button style={{...S.scrollBtn,...(page===totalPages-1?{opacity:0.3}:{})}} onClick={()=>page<totalPages-1&&setPage(p=>p+1)} disabled={page===totalPages-1}>{T.nextPage}</button>
                  </div>
                )}
              </div>
            )}

            {/* ── ➕ 추가 탭 ── */}
            {activeTab==="add"&&(
              <div>
                {/* 서브뷰 선택 — 히브리어만 Reverso/어근검색 표시 */}
                <div style={{display:"flex",gap:"4px",background:"rgba(255,255,255,0.04)",borderRadius:"10px",padding:"4px",marginBottom:"16px",overflowX:"auto",scrollbarWidth:"none"}}>
                  {(currentBook==="hebrew"
                    ?[["form",T.addSubDirect],["reverso","Reverso"],["root",T.addSubRoot],["meaning",T.addSubMeaning],["batch",T.addSubBatch]]
                    :[["form",T.addSubDirect],["meaning",T.addSubMeaning],["batch",T.addSubBatch]]
                  ).map(([v,l])=>(
                    <button key={v} onClick={()=>setAddSubView(v)} style={{padding:"7px 12px",borderRadius:"7px",border:"none",fontSize:"0.78rem",fontWeight:600,cursor:"pointer",flexShrink:0,background:addSubView===v?"#c4a050":"transparent",color:addSubView===v?"#17161C":"rgba(255,255,255,0.5)",transition:"all 0.15s"}}>
                      {l}
                    </button>
                  ))}
                </div>

                {/* 직접 입력 */}
                {addSubView==="form"&&(
                  <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                    <div style={S.card}>
                      {editId!==null&&<div style={{fontSize:"0.68rem",color:"#c4a050",letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:"10px",fontWeight:700}}>{T.editingLabel}</div>}
                      <div style={{display:"flex",gap:"8px",marginBottom:"8px"}}>
                        <input style={{...S.input,flex:1,direction:bookInfo.dir,fontFamily:"Arial,sans-serif",fontSize:"1.1rem"}} placeholder={bookInfo.placeholderA[uiLang]||bookInfo.placeholderA.ko} value={newHebrew} onChange={e=>setNewHebrew(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addWord()}/>
                        <input style={{...S.input,flex:1}} placeholder={bookInfo.placeholderB[uiLang]||bookInfo.placeholderB.ko} value={newMeaning} onChange={e=>setNewMeaning(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addWord()}/>
                      </div>
                      {currentBook==="hebrew"&&(
                        <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"8px"}}>
                          {WORD_TYPES.map(wt=>(
                            <button key={wt.id} onClick={()=>setNewWordType(t=>t===wt.id?null:wt.id)} style={{...S.optBtn,padding:"6px 10px",fontSize:"0.78rem",...(newWordType===wt.id?S.optBtnActive:{})}}>
                              {wt.emoji} {wt.label[uiLang]||wt.label.ko}
                            </button>
                          ))}
                        </div>
                      )}
                      {wallets.length>0&&editId===null&&(
                        <div style={{marginBottom:"8px"}}>
                          <div style={{fontSize:"0.72rem",color:"rgba(255,255,255,0.5)",marginBottom:"5px"}}>{T.addToWordbook}</div>
                          <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                            {wallets.map(wl=>{
                              const sel=newWordWallets.has(wl.id);
                              return(
                                <button key={wl.id} onClick={()=>setNewWordWallets(s=>{const n=new Set(s);sel?n.delete(wl.id):n.add(wl.id);return n;})} style={{padding:"4px 10px",borderRadius:"7px",fontSize:"0.75rem",cursor:"pointer",border:"1px solid",background:sel?wl.color+"25":"rgba(255,255,255,0.04)",borderColor:sel?wl.color+"60":"rgba(255,255,255,0.1)",color:sel?wl.color:"rgba(255,255,255,0.35)"}}>
                                  <span style={{width:"8px",height:"8px",borderRadius:"50%",background:wl.color,display:"inline-block",marginRight:"5px"}}/>{wl.name}{sel?" ✓":""}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div style={{display:"flex",gap:"8px"}}>
                        <button style={{...S.btnAdd,flex:1}} onClick={addWord}>{editId!==null?"수정 완료":"추가"}</button>
                        {newHebrew&&<SpeakBtn text={newHebrew} onSpeak={speakOnDemand} muted={muted}/>}
                        {editId!==null&&<button style={S.btnCancel} onClick={cancelEdit}>취소</button>}
                      </div>
                    </div>

                    {/* 파일 저장/불러오기 */}
                    <div style={{...S.ioCard,borderColor:"rgba(196,160,80,0.15)"}}>
                      <div style={{fontSize:"0.82rem",fontWeight:600,color:"rgba(255,255,255,0.75)",marginBottom:"8px"}}>💾 {T.saveLoad}</div>
                      <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                        <button style={S.btnIO("#c4a050","rgba(196,160,80,0.15)","rgba(196,160,80,0.4)")} onClick={exportWords}>{T.fileSave}</button>
                        <button style={S.btnIO("#c4a050","rgba(196,160,80,0.1)","rgba(196,160,80,0.3)")} onClick={copyToClipboard}>{T.copy}</button>
                        <button style={S.btnIO("rgba(255,255,255,0.75)","rgba(255,255,255,0.06)","rgba(255,255,255,0.15)")} onClick={()=>fileInputRef.current.click()}>{T.fileOpen}</button>
                        <button style={S.btnIO("#c0b0ff","rgba(100,80,200,0.15)","rgba(100,80,200,0.4)")} onClick={()=>setShowPasteImport(v=>!v)}>{T.paste}</button>
                        <button style={S.btnIO("#80a0e0","rgba(60,120,200,0.15)","rgba(60,120,200,0.4)")} onClick={()=>csvInputRef.current.click()}>{T.csvExcel}</button>
                      </div>
                      {showPasteImport&&(
                        <div style={{marginTop:"10px"}}>
                          <textarea style={{width:"100%",height:"120px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"10px",color:"#ffffff",padding:"12px",fontSize:"0.82rem",resize:"vertical",outline:"none",fontFamily:"monospace",marginBottom:"8px"}} placeholder='{"version":1,"words":[...]}' value={pasteText} onChange={e=>setPasteText(e.target.value)}/>
                          <div style={{display:"flex",gap:"8px"}}>
                            <button style={S.btnMerge} onClick={importFromText}>✅ 불러오기</button>
                            <button style={S.btnCancel2} onClick={()=>{setShowPasteImport(false);setPasteText("");}}>취소</button>
                          </div>
                        </div>
                      )}
                      <input ref={fileInputRef} type="file" accept=".json" style={{display:"none"}} onChange={handleFileChange}/>
                      <input ref={csvInputRef} type="file" accept=".xlsx,.xls,.csv,.tsv,.txt" style={{display:"none"}} onChange={handleCSVChange}/>
                    </div>
                  </div>
                )}

                {/* Reverso */}
                {addSubView==="reverso"&&(
                  <div style={S.card}>
                    <div style={{fontSize:"0.82rem",fontWeight:600,color:"#50c898",marginBottom:"12px"}}>{T.reversoTitle}</div>
                    <div style={{display:"flex",gap:"8px",marginBottom:"12px"}}>
                      <input style={{...S.input,flex:1,direction:"rtl",fontFamily:"Arial",fontSize:"1.1rem"}} placeholder="לָשִׁיר, לְדַבֵּר..." value={pealimRoot} onChange={e=>setPealimRoot(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchPealim()} lang="he" spellCheck={false} autoCorrect="off"/>
                      <button onClick={searchPealim} disabled={pealimLoading} style={{...S.btnAdd,minWidth:"60px",opacity:pealimLoading?0.6:1}}>{pealimLoading?T.loadingBtn:T.searchBtn}</button>
                    </div>
                    <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"12px"}}>
                      {T.verbExamples.map(([verb,hint])=>(
                        <button key={verb} onClick={()=>setPealimRoot(verb)} style={{padding:"4px 10px",borderRadius:"6px",background:"rgba(196,160,80,0.1)",border:"1px solid rgba(196,160,80,0.3)",color:"#c4a050",fontSize:"0.78rem",cursor:"pointer",fontFamily:"Arial",direction:"rtl"}}>
                          {verb} <span style={{color:"rgba(255,255,255,0.35)",direction:"ltr"}}>{hint}</span>
                        </button>
                      ))}
                    </div>
                    {pealimError&&<div style={{padding:"10px",background:"rgba(200,60,60,0.15)",border:"1px solid rgba(200,60,60,0.3)",borderRadius:"8px",color:"#f08080",fontSize:"0.85rem",marginBottom:"10px"}}>{pealimError}</div>}
                    {pealimPreview&&(
                      <div>
                        <div style={{background:"rgba(80,160,120,0.08)",border:"1px solid rgba(80,160,120,0.2)",borderRadius:"10px",padding:"14px",marginBottom:"10px"}}>
                          {/* 헤더 */}
                          <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px",flexWrap:"wrap"}}>
                            <span style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.5rem",color:"#50c898"}}>{pealimPreview.infinitive}</span>
                            <span style={{fontSize:"0.72rem",background:"rgba(80,160,120,0.2)",padding:"3px 10px",borderRadius:"6px",color:"#50c898",fontWeight:600}}>
                              {Object.keys(pealimPreview.variants||{}).length}개 변형
                            </span>
                          </div>
                          {/* 뜻 입력 */}
                          <input value={pealimPreview.meaning||""} onChange={e=>setPealimPreview(p=>({...p,meaning:e.target.value}))} style={{...S.input,padding:"7px 12px",fontSize:"0.9rem",marginBottom:"10px"}} placeholder="뜻 입력 (한국어/영어) *필수"/>
                          {/* 품사 선택 */}
                          <div style={{marginBottom:"10px"}}>
                            <div style={{fontSize:"0.72rem",color:"rgba(255,255,255,0.5)",marginBottom:"5px"}}>{T.wordTypeLabel}</div>
                            <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                              <button onClick={()=>setPealimPreview(p=>({...p,wordType:null}))} style={{padding:"4px 10px",borderRadius:"7px",fontSize:"0.75rem",cursor:"pointer",border:"1px solid",background:!pealimPreview.wordType?"rgba(255,255,255,0.12)":"rgba(255,255,255,0.04)",borderColor:!pealimPreview.wordType?"rgba(255,255,255,0.3)":"rgba(255,255,255,0.1)",color:!pealimPreview.wordType?"#e8e6f0":"rgba(255,255,255,0.35)"}}>{T.noSelect}</button>
                              {WORD_TYPES.map(wt=>(
                                <button key={wt.id} onClick={()=>setPealimPreview(p=>({...p,wordType:p.wordType===wt.id?null:wt.id}))} style={{padding:"4px 10px",borderRadius:"7px",fontSize:"0.75rem",cursor:"pointer",border:"1px solid",background:pealimPreview.wordType===wt.id?"rgba(196,160,80,0.2)":"rgba(255,255,255,0.04)",borderColor:pealimPreview.wordType===wt.id?"rgba(196,160,80,0.5)":"rgba(255,255,255,0.1)",color:pealimPreview.wordType===wt.id?"#c4a050":"rgba(255,255,255,0.35)"}}>
                                  {wt.emoji} {wt.label[uiLang]||wt.label.ko}
                                </button>
                              ))}
                            </div>
                          </div>
                          {/* 변형표 — 인칭별 구조화 레이아웃 */}
                          <div style={{maxHeight:"340px",overflowY:"auto"}}>
                            {(()=>{
                              const v=pealimPreview.variants||{};
                              const Cell=({tid,label})=>{
                                const form=v[tid]; if(!form) return null;
                                const fs=form.length>9?"0.78rem":form.length>6?"0.9rem":"1rem";
                                return(
                                  <div onClick={()=>speakOnDemand(form)} title={form} style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"5px 4px",background:"rgba(255,255,255,0.04)",borderRadius:"6px",gap:"3px",cursor:"pointer",minWidth:0}}>
                                    <span style={{color:"rgba(255,255,255,0.5)",fontSize:"0.62rem",lineHeight:1.1,textAlign:"center",whiteSpace:"nowrap"}}>{label}</span>
                                    <span style={{fontFamily:"Arial",direction:"rtl",color:"#f0ece0",fontSize:fs,fontWeight:700}}>{form}</span>
                                    <span style={{fontSize:"0.52rem",color:"rgba(196,160,80,0.5)"}}>🔈</span>
                                  </div>
                                );
                              };
                              const Row=({cells})=>(
                                <div style={{display:"grid",gridTemplateColumns:`repeat(${cells.length},1fr)`,gap:"3px",marginBottom:"3px"}}>
                                  {cells.map(([tid,lbl],i)=><Cell key={i} tid={tid} label={lbl}/>)}
                                </div>
                              );
                              const SecTitle=({catId})=>{
                                const c=VARIANT_CATS.find(x=>x.id===catId);
                                return c?<div style={{fontSize:"0.65rem",fontWeight:700,color:c.color,marginTop:"8px",marginBottom:"4px",borderBottom:`1px solid ${c.color}30`,paddingBottom:"2px",letterSpacing:"0.4px"}}>{c.label[uiLang]||c.label.ko}</div>:null;
                              };
                              const sections=[];
                              if(v["infinitive"]) sections.push(<div key="inf"><SecTitle catId="infinitive"/><Row cells={[["infinitive","לְ..."]]} /></div>);
                              if(v["pres_ms"]||v["pres_fs"]||v["pres_mp"]||v["pres_fp"]) sections.push(<div key="pres"><SecTitle catId="present"/><Row cells={[["pres_ms","אני/הוא"],["pres_fs","אני/היא"],["pres_mp","אנחנו/הם"],["pres_fp","אנחנו/הן"]]}/></div>);
                              if(v["past_1s"]||v["past_3ms"]) sections.push(<div key="past"><SecTitle catId="past"/><Row cells={[["past_1s","אני"],["past_1p","אנחנו"]]}/><Row cells={[["past_2ms","אתה"],["past_2fs","את"],["past_2mp","אתם"],["past_2fp","אתן"]]}/><Row cells={[["past_3ms","הוא"],["past_3fs","היא"],["past_3mp","הם"],["past_3fp","הן"]]}/></div>);
                              if(v["fut_1s"]||v["fut_3ms"]) sections.push(<div key="fut"><SecTitle catId="future"/><Row cells={[["fut_1s","אני"],["fut_1p","אנחנו"]]}/><Row cells={[["fut_2ms","אתה"],["fut_2fs","את"],["fut_2mp","אתם"],["fut_2fp","אתן"]]}/><Row cells={[["fut_3ms","הוא"],["fut_3fs","היא"],["fut_3mp","הם"],["fut_3fp","הן"]]}/></div>);
                              if(v["imp_2ms"]||v["imp_2fs"]) sections.push(<div key="imp"><SecTitle catId="imperative"/><Row cells={[["imp_2ms","אתה"],["imp_2fs","את"],["imp_2mp","אתם"],["imp_2fp","אתן"]]}/></div>);
                              ["gender","plural","poss"].forEach(catId=>{
                                const cat=VARIANT_CATS.find(c=>c.id===catId); if(!cat) return;
                                const avail=cat.types.filter(t=>v[t]); if(!avail.length) return;
                                sections.push(<div key={catId}><SecTitle catId={catId}/><Row cells={avail.map(t=>{const vt=VARIANT_TYPES.find(x=>x.id===t);return[t,vt?vt.label[uiLang]||vt.label.ko:t];})}/></div>);
                              });
                              return sections.length?sections:<div style={{color:"rgba(255,255,255,0.3)",fontSize:"0.8rem",textAlign:"center",padding:"20px 0"}}>변형 데이터가 없어요</div>;
                            })()}
                          </div>
                        </div>
                        <button onClick={addFromPealim} style={{...S.btnMerge,width:"100%",background:"linear-gradient(135deg,#50c898,#70e8b8)",color:"#0f1a14",padding:"12px",marginBottom:"6px"}}>{T.addToWordbookBtn}</button>
                        <button onClick={()=>setPealimPreview(null)} style={{...S.btnCancel2,width:"100%"}}>{T.searchAgain}</button>
                      </div>
                    )}

                    {/* 변형 새로고침 */}
                    <div style={{marginTop:"14px",paddingTop:"12px",borderTop:"1px solid rgba(255,255,255,0.07)"}}>
                      <button onClick={refreshAllVariants} disabled={refreshingVariants} style={{...S.optBtn,width:"100%",color:"#50c898",borderColor:"rgba(80,160,120,0.25)",fontSize:"0.75rem",padding:"9px",opacity:refreshingVariants?0.6:1}}>
                        {refreshingVariants?T.updating:T.refreshVariants}
                      </button>
                      {showRefreshLog&&refreshLog.length>0&&(
                        <div style={{maxHeight:"140px",overflowY:"auto",marginTop:"6px"}}>
                          {refreshLog.map((l,i)=>(
                            <div key={i} style={{display:"flex",gap:"8px",alignItems:"center",padding:"5px 10px",borderRadius:"7px",background:l.status==="ok"?"rgba(80,160,120,0.08)":"rgba(200,60,60,0.06)",marginBottom:"3px",fontSize:"0.78rem"}}>
                              <span>{l.status==="ok"?"✅":"❌"}</span>
                              <span style={{fontFamily:"Arial",direction:"rtl",color:"#c4a050",minWidth:"60px"}}>{l.hebrew}</span>
                              <span style={{color:"rgba(255,255,255,0.5)",flex:1}}>{l.meaning}</span>
                              {l.status==="ok"?<span style={{color:"#50c898"}}>변형 {l.variantCount}개</span>:<span style={{color:"#f07050"}}>{l.error}</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 어근 검색 */}
                {addSubView==="root"&&(
                  <div style={S.card}>
                    <div style={{fontSize:"0.82rem",fontWeight:600,color:"#c4a050",marginBottom:"12px"}}>{T.rootSearch}</div>
                    <div style={{display:"flex",gap:"8px",marginBottom:"10px"}}>
                      <input style={{...S.input,flex:1,direction:"rtl",fontFamily:"Arial",fontSize:"1.05rem"}} placeholder="ד-ב-ר" value={rootSearchInput} onChange={e=>setRootSearchInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchByRoot()}/>
                      <button onClick={searchByRoot} disabled={rootSearchLoading} style={{...S.btnAdd,minWidth:"56px",opacity:rootSearchLoading?0.6:1}}>{rootSearchLoading?"…":"검색"}</button>
                    </div>
                    {rootSearchError&&<div style={{color:"#f07050",fontSize:"0.82rem",marginBottom:"8px",padding:"8px",background:"rgba(200,60,60,0.1)",borderRadius:"8px"}}>{rootSearchError}</div>}
                    {rootSearchResults.length>0&&(
                      <div>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                          <span style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.5)"}}>{T.resultCount(rootSearchResults.length)}</span>
                          <div style={{display:"flex",gap:"6px"}}>
                            <button onClick={()=>setRootSelected(s=>s.size===rootSearchResults.length?new Set():new Set(rootSearchResults.map((_,i)=>i)))} style={{...S.scrollBtn,fontSize:"0.72rem",padding:"3px 8px"}}>전체선택</button>
                            {rootSelected.size>0&&<button onClick={addSelectedRootWords} style={{padding:"5px 12px",borderRadius:"8px",background:"linear-gradient(135deg,#c4a050,#e8c875)",border:"none",color:"#1a1820",fontWeight:700,cursor:"pointer",fontSize:"0.8rem"}}>{T.addNSelected(rootSelected.size)}</button>}
                          </div>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:"5px",maxHeight:"320px",overflowY:"auto"}}>
                          {rootSearchResults.map((r,i)=>{
                            const isSel=rootSelected.has(i);
                            const already=!!words.find(w=>stripNikkud(w.hebrew)===stripNikkud(r.hebrew));
                            return(
                              <div key={i} onClick={()=>{if(already)return;setRootSelected(s=>{const n=new Set(s);n.has(i)?n.delete(i):n.add(i);return n;});}} style={{display:"flex",gap:"8px",alignItems:"center",padding:"8px 12px",borderRadius:"10px",background:isSel?"rgba(196,160,80,0.1)":"rgba(255,255,255,0.03)",border:`1px solid ${isSel?"rgba(196,160,80,0.4)":already?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.08)"}`,cursor:already?"default":"pointer",opacity:already?0.5:1}}>
                                <div style={{width:"16px",height:"16px",borderRadius:"4px",flexShrink:0,border:`2px solid ${isSel?"#c4a050":"rgba(255,255,255,0.2)"}`,background:isSel?"#c4a050":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  {isSel&&<span style={{color:"#1a1820",fontSize:"0.65rem",fontWeight:700}}>✓</span>}
                                </div>
                                {r.pos&&<span style={{fontSize:"0.62rem",padding:"1px 6px",borderRadius:"4px",background:"rgba(196,160,80,0.1)",color:"#c4a050",flexShrink:0}}>{r.pos}</span>}
                                <span style={{fontFamily:"Arial",direction:"rtl",fontSize:"1.05rem",color:"#c4a050",minWidth:"70px"}}>{r.hebrew}</span>
                                <span style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.5)",flex:1}}>{r.meaning||""}</span>
                                {already&&<span style={{fontSize:"0.65rem",color:"#50c898"}}>{T.alreadyInDb}</span>}
                              </div>
                            );
                          })}
                        </div>
                        {/* 단어장 대상 선택 */}
                        {wallets.length>0&&(
                          <div style={{marginTop:"10px",padding:"10px 12px",borderRadius:"10px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)"}}>
                            <div style={{fontSize:"0.72rem",color:"rgba(255,255,255,0.5)",marginBottom:"6px"}}>{T.addToWordbook}</div>
                            <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                              {wallets.map(wl=>{const sel=importTargetWallets.has(wl.id);return(
                                <button key={wl.id} onClick={()=>setImportTargetWallets(s=>{const n=new Set(s);sel?n.delete(wl.id):n.add(wl.id);return n;})} style={{padding:"4px 10px",borderRadius:"7px",fontSize:"0.75rem",cursor:"pointer",border:"1px solid",background:sel?wl.color+"25":"rgba(255,255,255,0.04)",borderColor:sel?wl.color+"60":"rgba(255,255,255,0.1)",color:sel?wl.color:"rgba(255,255,255,0.35)"}}>
                                  <span style={{width:"8px",height:"8px",borderRadius:"50%",background:wl.color,display:"inline-block",marginRight:"5px"}}/>{wl.name}{sel?" ✓":""}
                                </button>
                              );})}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 뜻 검색 */}
                {addSubView==="meaning"&&(
                  <div style={S.card}>
                    <div style={{fontSize:"0.82rem",fontWeight:600,color:"#c4a050",marginBottom:"12px"}}>{T.importSearch}</div>
                    <p style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.4)",marginBottom:"10px"}}>{T.meaningSearchDesc}</p>
                    <div style={{display:"flex",gap:"8px",marginBottom:"10px"}}>
                      <input style={{...S.input,flex:1}} {...{placeholder:T.meaningSearchPlaceholder}} value={wordSearchInput} onChange={e=>setWordSearchInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchWordByMeaning()}/>
                      <button onClick={searchWordByMeaning} disabled={wordSearchLoading} style={{...S.btnAdd,minWidth:"56px",opacity:wordSearchLoading?0.6:1}}>{wordSearchLoading?"…":"검색"}</button>
                    </div>
                    {wordSearchError&&<div style={{color:"#f07050",fontSize:"0.82rem",marginBottom:"8px",padding:"8px",background:"rgba(200,60,60,0.1)",borderRadius:"8px"}}>{wordSearchError}</div>}
                    {wordSearchResults.length>0&&(
                      <div>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                          <span style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.5)"}}>{T.resultCount(wordSearchResults.length)}</span>
                          <div style={{display:"flex",gap:"6px"}}>
                            <button onClick={()=>setWordSearchSelected(s=>s.size===wordSearchResults.length?new Set():new Set(wordSearchResults.map((_,i)=>i)))} style={{...S.scrollBtn,fontSize:"0.72rem",padding:"3px 8px"}}>전체선택</button>
                            {wordSearchSelected.size>0&&<button onClick={addSelectedWordSearch} style={{padding:"5px 12px",borderRadius:"8px",background:"linear-gradient(135deg,#c4a050,#e8c875)",border:"none",color:"#1a1820",fontWeight:700,cursor:"pointer",fontSize:"0.8rem"}}>{T.addNSelected(wordSearchSelected.size)}</button>}
                          </div>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:"5px",maxHeight:"320px",overflowY:"auto"}}>
                          {wordSearchResults.map((r,i)=>{
                            const sel=wordSearchSelected.has(i);
                            const exists=!!words.find(w=>stripNikkud(w.hebrew||"")===stripNikkud(r.hebrew||"")&&w.meaning===r.meaning);
                            return(
                              <div key={i} onClick={()=>{if(exists)return;setWordSearchSelected(s=>{const n=new Set(s);n.has(i)?n.delete(i):n.add(i);return n;});}} style={{display:"flex",gap:"8px",alignItems:"center",padding:"8px 12px",borderRadius:"10px",background:sel?"rgba(196,160,80,0.1)":"rgba(255,255,255,0.03)",border:`1px solid ${sel?"rgba(196,160,80,0.4)":exists?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.08)"}`,cursor:exists?"default":"pointer",opacity:exists?0.5:1}}>
                                <div style={{width:"16px",height:"16px",borderRadius:"4px",flexShrink:0,border:`2px solid ${sel?"#c4a050":"rgba(255,255,255,0.2)"}`,background:sel?"#c4a050":"transparent",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                  {sel&&<span style={{color:"#1a1820",fontSize:"0.65rem",fontWeight:700}}>✓</span>}
                                </div>
                                {r.pos!=="translation"&&<span style={{fontFamily:"Arial",direction:"rtl",fontSize:"1rem",color:"#c4a050",minWidth:"70px"}}>{r.hebrew}</span>}
                                <span style={{fontSize:"0.8rem",color:r.pos==="translation"?"#c4a050":"rgba(255,255,255,0.75)",flex:1}}>{r.meaning}</span>
                                {exists&&<span style={{fontSize:"0.65rem",color:"#50c898"}}>{T.alreadyInDb}</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 일괄 추가 */}
                {addSubView==="batch"&&(
                  <div style={S.card}>
                    <div style={{fontSize:"0.82rem",fontWeight:600,color:"#60c880",marginBottom:"8px"}}>{T.batchTitle}</div>
                    <div style={{background:"rgba(196,160,80,0.08)",border:"1px solid rgba(196,160,80,0.2)",borderRadius:"10px",padding:"10px 12px",marginBottom:"10px",fontSize:"0.82rem",color:"#c4a050",lineHeight:1.8,fontFamily:"monospace"}}>
                      {T.batchExample.split("\n").map((l,i)=><span key={i}>{l}<br/></span>)}
                    </div>
                    <textarea ref={batchTextRef} style={{width:"100%",minHeight:"200px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"10px",color:"#ffffff",padding:"12px",fontSize:"1rem",direction:"rtl",fontFamily:"Arial",resize:"vertical",outline:"none",lineHeight:1.8,marginBottom:"10px"}} lang="he" spellCheck={false} autoCorrect="off" defaultValue=""/>
                    <button onClick={importFromBatch} style={{...S.btnAdd,width:"100%",padding:"12px"}}>{T.addWordsBtn}</button>
                  </div>
                )}
              </div>
            )}

            {/* ── 🎯 퀴즈 탭 ── */}
            {activeTab==="quiz"&&(
              <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                {/* 퀴즈 섹션 아코디언 헬퍼 */}
                {[
                  {key:"mcq",  icon:"🎯", title:T.mcqTitle,   color:"#c4a050", cnt:poolSize},
                  {key:"essay",icon:"✍️", title:T.essayTitle,   color:"#9060f0", cnt:essayPoolSize},
                  ...(currentBook==="hebrew"?[{key:"variant",icon:"🔀",title:T.variantQuizTitle,color:"#50c898",cnt:variantPoolSize}]:[]),
                ].map(qt=>{
                  const isOpen=openQuizSection===qt.key;
                  return(
                    <div key={qt.key} style={{background:"#1E1D24",border:`1px solid ${isOpen?qt.color+"50":"rgba(255,255,255,0.08)"}`,borderRadius:"14px",overflow:"hidden",transition:"border-color 0.2s"}}>
                      {/* 헤더 */}
                      <button onClick={()=>setOpenQuizSection(isOpen?null:qt.key)} style={{width:"100%",display:"flex",alignItems:"center",gap:"12px",padding:"14px 16px",background:"transparent",border:"none",cursor:"pointer",textAlign:"left"}}>
                        <span style={{fontSize:"1.2rem"}}>{qt.icon}</span>
                        <div style={{flex:1}}>
                          <div style={{fontSize:"0.9rem",fontWeight:700,color:isOpen?qt.color:"#e8e6f0"}}>{qt.title}</div>
                          <div style={{fontSize:"0.68rem",color:"rgba(255,255,255,0.35)",marginTop:"1px"}}>{T.quizWordsAvail(qt.cnt)}</div>
                        </div>
                        <span style={{color:isOpen?qt.color:"rgba(255,255,255,0.25)",fontSize:"0.9rem",transition:"transform 0.2s",transform:isOpen?"rotate(180deg)":"none"}}>▼</span>
                      </button>

                      {/* 펼쳐진 설정 */}
                      {isOpen&&(
                        <div style={{padding:"0 16px 16px",borderTop:`1px solid ${qt.color}20`}}>
                          {qt.key==="mcq"&&(<>
                            <p style={{...S.settingLabel,marginTop:"14px"}}>{T.quizDirection}</p>
                            <div style={S.optionRow}>
                              {[[QUIZ_TYPES.HEB_TO_MEAN,T.dirAtoB(bookInfo)],[QUIZ_TYPES.MEAN_TO_HEB,T.dirBtoA(bookInfo)],[QUIZ_TYPES.MIXED,"랜덤"]].map(([val,label])=>(
                                <button key={val} style={{...S.optBtn,...(quizType===val?S.optBtnActive:{})}} onClick={()=>setQuizType(val)}>{label}</button>
                              ))}
                            </div>
                            <p style={S.settingLabel}>{T.quizWordRange}</p>
                            <div style={S.optionRow}>
                              {[[QUIZ_FILTERS.ALL,T.allRange(words.length)],[QUIZ_FILTERS.LEARNING_ONLY,T.learningOnly(learningCount)],[QUIZ_FILTERS.EXCLUDE_MASTERED,T.excludeMastered(words.filter(w=>w.status!=="mastered").length)],[QUIZ_FILTERS.HARD_ONLY,T.hardOnly(hardCount)]].map(([val,label])=>(
                                <button key={val} style={{...S.optBtn,...(quizFilter===val?S.optBtnActive:{})}} onClick={()=>setQuizFilter(val)}>{label}</button>
                              ))}
                            </div>
                            <p style={S.settingLabel}>{T.quizQuestionCount}</p>
                            <div style={S.optionRow}>
                              {countOptions.map(({label,value})=>{const d=value!==9999&&value>poolSize;return<button key={value} style={{...S.optBtn,...(quizCount===value?S.optBtnActive:{}),...(d?{opacity:0.3,cursor:"not-allowed"}:{})}} onClick={()=>!d&&setQuizCount(value)} disabled={d}>{label}</button>;})}
                            </div>
                            <p style={S.settingLabel}>{T.quizSound}</p>
                            <div style={{display:"flex",gap:"6px",marginBottom:"14px"}}>
                              {[{m:"auto",l:T.soundAuto,c:"#c4a050"},{m:"manual",l:T.soundManual,c:"#60c880"},{m:"mute",l:T.soundMute,c:"#9090b0"}].map(({m,l,c})=>(
                                <button key={m} onClick={()=>setSoundMode(m)} style={{flex:1,padding:"9px 5px",borderRadius:"10px",border:`1px solid ${soundMode===m?c+"50":"rgba(255,255,255,0.1)"}`,background:soundMode===m?c+"20":"rgba(255,255,255,0.04)",color:soundMode===m?c:"rgba(255,255,255,0.35)",cursor:"pointer",fontSize:"0.75rem",fontWeight:soundMode===m?700:400}}>{l}</button>
                              ))}
                            </div>
                            <button style={{...S.btnStart,...(poolSize<4?S.btnDisabled:{})}} onClick={startQuiz} disabled={poolSize<4}>{poolSize<4?T.needMore(poolSize):T.startMCQ(quizCount===9999?poolSize:Math.min(quizCount,poolSize))}</button>
                          </>)}

                          {qt.key==="essay"&&(<>
                            <p style={{fontSize:"0.75rem",color:"rgba(255,255,255,0.4)",marginTop:"14px",marginBottom:"12px"}}>{T.essaySub}</p>
                            <p style={S.settingLabel}>문제 방향</p>
                            <div style={S.optionRow}>
                              {[["heb_to_mean",T.dirAtoB_e(bookInfo)],["mean_to_heb",T.dirBtoA_e(bookInfo)],["mixed","랜덤"]].map(([val,label])=>(
                                <button key={val} style={{...S.optBtn,...(essayType===val?{background:"rgba(129,140,248,0.15)",borderColor:"rgba(129,140,248,0.4)",color:"#a5b4fc"}:{})}} onClick={()=>setEssayType(val)}>{label}</button>
                              ))}
                            </div>
                            <p style={S.settingLabel}>{T.quizWordRange}</p>
                            <div style={S.optionRow}>
                              {[[QUIZ_FILTERS.ALL,T.allRange(words.length)],[QUIZ_FILTERS.EXCLUDE_MASTERED,T.excludeMastered(words.filter(w=>w.status!=="mastered").length)],[QUIZ_FILTERS.HARD_ONLY,T.hardOnly(hardCount)]].map(([val,label])=>(
                                <button key={val} style={{...S.optBtn,...(essayFilter===val?{background:"rgba(129,140,248,0.15)",borderColor:"rgba(129,140,248,0.4)",color:"#a5b4fc"}:{})}} onClick={()=>setEssayFilter(val)}>{label}</button>
                              ))}
                            </div>
                            <p style={S.settingLabel}>{T.quizQuestionCount}</p>
                            <div style={S.optionRow}>
                              {countOptions.map(({label,value})=>{const d=value!==9999&&value>essayPoolSize;return<button key={value} style={{...S.optBtn,...(essayCount===value?{background:"rgba(129,140,248,0.15)",borderColor:"rgba(129,140,248,0.4)",color:"#a5b4fc"}:{}),...(d?{opacity:0.3,cursor:"not-allowed"}:{})}} onClick={()=>!d&&setEssayCount(value)} disabled={d}>{label}</button>;})}
                            </div>
                            <button style={{...S.btnEssayStart,...(!essayPoolSize?S.btnDisabled:{})}} onClick={startEssay} disabled={!essayPoolSize}>{T.quizEssayStart(essayCount===9999?essayPoolSize:Math.min(essayCount,essayPoolSize))}</button>
                          </>)}

                          {qt.key==="variant"&&(<>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:"14px",marginBottom:"6px"}}>
                              <p style={{...S.settingLabel,margin:0}}>{ T.quizVariantType}</p>
                              <button onClick={()=>setVariantCats(variantCats.length===VARIANT_CATS.length?[]:VARIANT_CATS.map(c=>c.id))} style={{...S.scrollBtn,padding:"3px 10px",fontSize:"0.72rem"}}>{variantCats.length===VARIANT_CATS.length?T.allDeselect:T.allSelectAll}</button>
                            </div>
                            <div style={{display:"flex",gap:"4px",marginBottom:"12px",flexWrap:"wrap"}}>
                              {VARIANT_CATS.map(cat=>(
                                <button key={cat.id} style={{...S.optBtn,...(variantCats.includes(cat.id)?{background:"rgba(80,160,120,0.2)",borderColor:"rgba(80,160,120,0.5)",color:"#50c898"}:{})}} onClick={()=>setVariantCats(v=>v.includes(cat.id)?v.filter(x=>x!==cat.id):[...v,cat.id])}>
                                  {cat.label[uiLang]||cat.label.ko}
                                </button>
                              ))}
                            </div>
                            <div style={{display:"flex",gap:"5px",marginBottom:"10px"}}>
                              {[["essay",T.quizMCQType(true)],["mcq",T.quizMCQType(false)]].map(([t,l])=>(
                                <button key={t} onClick={()=>setVariantQuizType(t)} style={{...S.optBtn,flex:1,...(variantQuizType===t?{background:"rgba(80,160,120,0.2)",borderColor:"rgba(80,160,120,0.5)",color:"#50c898"}:{})}}>
                                  {l}
                                </button>
                              ))}
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:"9px",marginBottom:"14px",padding:"9px 12px",background:"rgba(255,255,255,0.02)",borderRadius:"10px",border:"1px solid rgba(255,255,255,0.07)"}}>
                              <input type="range" min={1} max={Math.max(1,variantPoolSize)} value={Math.min(variantCount===9999?variantPoolSize:variantCount,Math.max(1,variantPoolSize))} onChange={e=>setVariantCount(Number(e.target.value))} style={{flex:1,accentColor:"#50c898",cursor:"pointer"}}/>
                              <span style={{fontSize:"0.82rem",color:"#50c898",fontWeight:700,minWidth:"30px",textAlign:"right"}}>{variantCount===9999?variantPoolSize:Math.min(variantCount,variantPoolSize)}</span>
                            </div>
                            <button style={{...S.btnStart,background:"linear-gradient(135deg,#50c898,#70e8b8)",color:"#0f1a14",...(!variantPoolSize||!variantCats.length?S.btnDisabled:{})}} onClick={startVariantQuiz} disabled={!variantPoolSize||!variantCats.length}>
                              {T.quizVariantStart(variantCount===9999?variantPoolSize:Math.min(variantCount,variantPoolSize))}
                            </button>
                          </>)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── 🗂️ 단어장 탭 ── */}
            {activeTab==="wallets"&&(
              <div>
                {walletDetailId!==null?(()=>{
                  const wl=wallets.find(w=>w.id===walletDetailId); if(!wl) return null;
                  const wlWords=getWalletWords(walletDetailId);
                  return(
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"14px"}}>
                        <button onClick={()=>setWalletDetailId(null)} style={{...S.scrollBtn,padding:"5px 10px",fontSize:"0.75rem"}}>← 목록</button>
                        <div style={{width:"8px",height:"8px",borderRadius:"2px",background:wl.color,flexShrink:0}}/>
                        <span style={{fontWeight:700,color:wl.color,fontSize:"0.95rem"}}>{wl.name}</span>
                        <span style={{fontSize:"0.7rem",color:"rgba(255,255,255,0.35)"}}>{wlWords.length}개 단어</span>
                      </div>
                      {wlWords.length>0?(
                        <div>
                          <div style={{marginBottom:"10px"}}>
                            {wlWords.map(w=>(
                              <div key={w.id} style={{display:"flex",alignItems:"center",gap:"8px",padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                                <span style={{fontFamily:"Arial",direction:"rtl",color:"#c4a050",fontSize:"1rem",minWidth:"70px"}}>{w.hebrew}</span>
                                <span style={{color:"rgba(255,255,255,0.5)",fontSize:"0.78rem",flex:1}}>{w.meaning}</span>
                                <SpeakBtn text={w.hebrew} onSpeak={speakOnDemand} muted={muted}/>
                                <button onClick={()=>toggleWordInWallet(wl.id,w.id)} style={{padding:"2px 7px",borderRadius:"6px",background:"rgba(200,60,60,0.1)",border:"1px solid rgba(200,60,60,0.3)",color:"#f07050",cursor:"pointer",fontSize:"0.7rem"}}>{T.removeFromWallet}</button>
                              </div>
                            ))}
                          </div>
                          <div style={{display:"flex",gap:"6px"}}>
                            <button onClick={()=>{if(wlWords.length<4){showToast(T.quizNeedMCQ,"err");return;}const qs=wlWords.map(w=>generateQuestion(w,wlWords.length>=4?wlWords:words,quizType));setQuestions(qs);setCurrent(0);setSelected(null);setConfirmed(false);setScore(0);setWrongWords([]);setMode(MODES.QUIZ);setAnimKey(k=>k+1);}} style={{flex:1,...S.btnStart,padding:"10px",fontSize:"0.85rem"}}>🎯 MCQ</button>
                            <button onClick={()=>{const qs=wlWords.map(w=>({wordId:w.id,question:w.hebrew,answer:w.meaning,hebrewWord:w.hebrew,questionType:"heb_to_mean"}));setEssayQuestions(qs);setEssayCurrent(0);setEssayInput("");setEssayConfirmed(false);setEssayResults([]);setMode(MODES.ESSAY);setAnimKey(k=>k+1);}} style={{flex:1,...S.btnEssayStart,padding:"10px",fontSize:"0.85rem"}}>✍️ 서술형</button>
                            <button onClick={()=>listenAllStart(wlWords,wl.id,listenRepeat)} style={{padding:"10px 12px",borderRadius:"12px",border:"1px solid rgba(196,160,80,0.35)",background:"rgba(196,160,80,0.1)",color:"#c4a050",cursor:"pointer",fontSize:"0.85rem",fontWeight:600}}>🔈</button>
                          </div>
                        </div>
                      ):(
                        <div style={S.emptyMsg}>{T.walletNoWords.split("\n")[0]}<br/>{T.walletNoWords.split("\n")[1]}</div>
                      )}
                    </div>
                  );
                })():(
                  <div>
                    {/* 새 단어장 만들기 */}
                    <div style={{...S.card,marginBottom:"12px"}}>
                      <div style={{fontSize:"0.82rem",fontWeight:600,color:"rgba(255,255,255,0.75)",marginBottom:"10px"}}>{T.newWalletTitle}</div>
                      <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
                        <input value={walletName} onChange={e=>setWalletName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createWallet()} style={{...S.input,flex:1}} {...{placeholder:T.walletNamePlaceholder}}/>
                        <div style={{display:"flex",gap:"4px"}}>
                          {["#c4a050","#50c898","#9060f0","#f07050","#60a0e0","#e06080"].map(c=>(
                            <button key={c} onClick={()=>setWalletColor(c)} style={{width:"20px",height:"20px",borderRadius:"50%",background:c,border:walletColor===c?"2px solid #fff":"2px solid transparent",cursor:"pointer",flexShrink:0}}/>
                          ))}
                        </div>
                        <button onClick={createWallet} disabled={!walletName.trim()} style={{...S.btnAdd,padding:"9px 14px",opacity:walletName.trim()?1:0.4,fontSize:"0.82rem"}}>{T.createWalletBtn}</button>
                      </div>
                    </div>

                    {wallets.length===0?(
                      <div style={S.emptyMsg}>{T.noWalletsYet.split("\n")[0]}<br/>{T.noWalletsYet.split("\n")[1]}</div>
                    ):(
                      <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                        {wallets.map(wl=>{
                          const cnt=words.filter(w=>wl.wordIds.includes(w.id)).length;
                          return(
                            <div key={wl.id} style={{display:"flex",alignItems:"center",gap:"10px",padding:"12px 14px",borderRadius:"12px",background:"#1E1D24",border:`1px solid ${wl.color}30`}}>
                              <div style={{width:"10px",height:"10px",borderRadius:"2px",background:wl.color,flexShrink:0}}/>
                              <button onClick={()=>setWalletDetailId(wl.id)} style={{flex:1,background:"none",border:"none",color:"#e8e6f0",cursor:"pointer",textAlign:"left",fontSize:"0.9rem",fontWeight:600}}>{wl.name}</button>
                              <span style={{fontSize:"0.7rem",color:"rgba(255,255,255,0.35)"}}>{cnt}개</span>
                              <button onClick={()=>setWalletDetailId(wl.id)} style={{padding:"4px 10px",borderRadius:"7px",background:`${wl.color}20`,border:`1px solid ${wl.color}40`,color:wl.color,cursor:"pointer",fontSize:"0.72rem"}}>{T.viewBtn}</button>
                              <button onClick={()=>{if(window.confirm(T.deleteWalletConfirm(wl.name)))deleteWallet(wl.id);}} style={{padding:"4px 9px",borderRadius:"7px",background:"rgba(200,60,60,0.1)",border:"1px solid rgba(200,60,60,0.3)",color:"#f07050",cursor:"pointer",fontSize:"0.72rem"}}>삭제</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── ⚙️ 설정 탭 ── */}
            {activeTab==="settings"&&(
              <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                {/* 계정 */}
                <div style={S.card}>
                  <div style={{fontSize:"0.82rem",fontWeight:600,color:"rgba(255,255,255,0.75)",marginBottom:"12px"}}>{T.accountTitle}</div>
                  {user?(
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"12px"}}>
                        <img src={user.photoURL} alt="" style={{width:"36px",height:"36px",borderRadius:"50%"}}/>
                        <div>
                          <div style={{fontWeight:600,fontSize:"0.9rem"}}>{user.displayName}</div>
                          <div style={{fontSize:"0.7rem",color:"rgba(255,255,255,0.35)"}}>{user.email}{syncing?" · 동기화 중...":""}</div>
                        </div>
                      </div>
                      <div style={{fontSize:"0.72rem",color:"#60c880",marginBottom:"10px"}}>{T.syncActiveMsg}</div>
                      <button onClick={signOutUser} style={{...S.btnCancel2,width:"100%",color:"#f07050",borderColor:"rgba(200,60,60,0.3)"}}>{T.logout}</button>
                    </div>
                  ):(
                    <div>
                      <p style={{fontSize:"0.82rem",color:"rgba(255,255,255,0.5)",marginBottom:"12px",lineHeight:1.5}}>{T.loginPrompt}</p>
                      <button onClick={signInGoogle} style={{...S.btnAdd,width:"100%",padding:"12px",fontSize:"0.88rem"}}>{T.login}</button>
                    </div>
                  )}
                </div>

                {/* 언어 */}
                <div style={S.card}>
                  <div style={{fontSize:"0.82rem",fontWeight:600,color:"rgba(255,255,255,0.75)",marginBottom:"12px"}}>{T.langTitle}</div>
                  <div style={{display:"flex",gap:"6px"}}>
                    {[["ko","한국어 🇰🇷"],["en","English 🇺🇸"]].map(([v,l])=>(
                      <button key={v} onClick={()=>{setUiLang(v);try{localStorage.setItem("uiLang",v);}catch{}}} style={{flex:1,padding:"10px",borderRadius:"10px",border:`1px solid ${uiLang===v?"#c4a050":"rgba(255,255,255,0.1)"}`,background:uiLang===v?"rgba(196,160,80,0.15)":"transparent",color:uiLang===v?"#c4a050":"rgba(255,255,255,0.5)",cursor:"pointer",fontWeight:uiLang===v?700:400}}>{l}</button>
                    ))}
                  </div>
                </div>

                {/* 발음 */}
                <div style={S.card}>
                  <div style={{fontSize:"0.82rem",fontWeight:600,color:"rgba(255,255,255,0.75)",marginBottom:"6px"}}>{T.soundTitle}</div>
                  <div style={{fontSize:"0.72rem",color:ttsReady?"#60c880":"#f07050",marginBottom:"10px"}}>{ttsReady?T.ttsConnected:T.ttsBrowser}</div>
                  <div style={{display:"flex",gap:"6px"}}>
                    {[{m:"auto",l:T.soundAuto,c:"#c4a050"},{m:"manual",l:T.soundManual,c:"#60c880"},{m:"mute",l:T.soundMute,c:"#9090b0"}].map(({m,l,c})=>(
                      <button key={m} onClick={()=>setSoundMode(m)} style={{flex:1,padding:"10px 5px",borderRadius:"10px",border:`1px solid ${soundMode===m?c+"50":"rgba(255,255,255,0.1)"}`,background:soundMode===m?c+"20":"rgba(255,255,255,0.04)",color:soundMode===m?c:"rgba(255,255,255,0.35)",cursor:"pointer",fontSize:"0.78rem",fontWeight:soundMode===m?700:400}}>{l}</button>
                    ))}
                  </div>
                </div>

                {/* 저장/불러오기 */}
                <div style={S.card}>
                  <div style={{fontSize:"0.82rem",fontWeight:600,color:"rgba(255,255,255,0.75)",marginBottom:"12px"}}>💾 {T.saveLoad}</div>
                  <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                    <button onClick={exportWords} style={S.btnIO("#c4a050","rgba(196,160,80,0.15)","rgba(196,160,80,0.4)")}>{T.fileSave}</button>
                    <button onClick={copyToClipboard} style={S.btnIO("#c4a050","rgba(196,160,80,0.1)","rgba(196,160,80,0.3)")}>{T.copy}</button>
                    <button onClick={()=>fileInputRef.current.click()} style={S.btnIO("rgba(255,255,255,0.75)","rgba(255,255,255,0.06)","rgba(255,255,255,0.15)")}>{T.fileOpen}</button>
                    <input ref={fileInputRef} type="file" accept=".json" style={{display:"none"}} onChange={handleFileChange}/>
                  </div>
                </div>
              </div>
            )}

            {/* ── 💬 채팅 탭 ── */}
            {activeTab==="chat"&&(
              <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 200px)",minHeight:"400px"}}>
                {!user?(
                  <div style={{...S.emptyMsg,padding:"40px 20px"}}>
                    <div style={{fontSize:"2rem",marginBottom:"12px"}}>💬</div>
                    <p>{T.chatLoginRequired}</p>
                    <button onClick={signInGoogle} style={{...S.btnAdd,marginTop:"16px",padding:"12px 24px"}}>{T.login}</button>
                  </div>
                ):(
                  <>
                    {/* 서브탭 */}
                    <div style={{display:"flex",gap:"4px",background:"rgba(255,255,255,0.04)",borderRadius:"10px",padding:"4px",marginBottom:"12px"}}>
                      {[["global",T.chatGlobal],["friends",T.chatFriends],dmTarget?["dm",`💬 ${dmTarget.displayName}`]:null].filter(Boolean).map(([v,l])=>(
                        <button key={v} onClick={()=>setChatTab(v)} style={{flex:1,padding:"7px 10px",borderRadius:"7px",border:"none",fontSize:"0.78rem",fontWeight:600,cursor:"pointer",background:chatTab===v?"#c4a050":"transparent",color:chatTab===v?"#17161C":"rgba(255,255,255,0.5)"}}>
                          {l}{v==="friends"&&friendRequests.length>0&&<span style={{marginLeft:"4px",background:"#f07050",color:"#fff",borderRadius:"50%",width:"16px",height:"16px",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:"0.6rem",fontWeight:700}}>{friendRequests.length}</span>}
                        </button>
                      ))}
                    </div>

                    {/* 전체 채팅 */}
                    {chatTab==="global"&&(
                      <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
                        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:"8px",paddingBottom:"8px"}}>
                          {globalMessages.map(msg=>{
                            const isMe=msg.uid===user.uid;
                            return(
                              <div key={msg.id} style={{display:"flex",gap:"8px",alignItems:"flex-end",flexDirection:isMe?"row-reverse":"row"}}>
                                {!isMe&&<img src={msg.photoURL||"https://ui-avatars.com/api/?name="+encodeURIComponent(msg.displayName||"?")} alt="" style={{width:"28px",height:"28px",borderRadius:"50%",flexShrink:0}}/>}
                                <div style={{maxWidth:"72%"}}>
                                  {!isMe&&<div style={{fontSize:"0.65rem",color:"rgba(255,255,255,0.4)",marginBottom:"3px",paddingLeft:"4px"}}>{msg.displayName}</div>}
                                  <div style={{padding:"9px 13px",borderRadius:isMe?"14px 14px 4px 14px":"14px 14px 14px 4px",background:isMe?"#c4a050":"rgba(255,255,255,0.08)",color:isMe?"#17161C":"#e8e6f0",fontSize:"0.88rem",lineHeight:1.4,wordBreak:"break-word"}}>
                                    {msg.text}
                                  </div>
                                  <div style={{fontSize:"0.6rem",color:"rgba(255,255,255,0.25)",marginTop:"3px",textAlign:isMe?"right":"left",paddingLeft:"4px",paddingRight:"4px"}}>
                                    {msg.createdAt?.toDate?msg.createdAt.toDate().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):""}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          <div ref={chatBottomRef}/>
                        </div>
                        <div style={{display:"flex",gap:"8px",paddingTop:"8px",borderTop:"1px solid rgba(255,255,255,0.08)"}}>
                          <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendGlobalMessage()} placeholder={T.chatPlaceholder} style={{...S.input,flex:1,padding:"10px 14px",fontSize:"0.9rem"}}/>
                          <button onClick={sendGlobalMessage} disabled={!chatInput.trim()} style={{...S.btnAdd,padding:"10px 16px",opacity:chatInput.trim()?1:0.4}}>{T.chatSend}</button>
                        </div>
                      </div>
                    )}

                    {/* 친구 탭 */}
                    {chatTab==="friends"&&(
                      <div style={{flex:1,overflowY:"auto"}}>
                        {/* 친구 요청 */}
                        {friendRequests.length>0&&(
                          <div style={{marginBottom:"14px"}}>
                            <div style={{fontSize:"0.72rem",color:"#f07050",fontWeight:700,letterSpacing:"0.8px",marginBottom:"8px"}}>{T.friendRequest}</div>
                            {friendRequests.map(req=>(
                              <div key={req.uid} style={{display:"flex",alignItems:"center",gap:"10px",padding:"10px 12px",background:"rgba(200,80,60,0.08)",border:"1px solid rgba(200,80,60,0.2)",borderRadius:"12px",marginBottom:"6px"}}>
                                <img src={req.photoURL||"https://ui-avatars.com/api/?name="+encodeURIComponent(req.displayName||"?")} alt="" style={{width:"36px",height:"36px",borderRadius:"50%",flexShrink:0}}/>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontWeight:600,fontSize:"0.88rem",color:"#e8e6f0"}}>{req.displayName}</div>
                                  <div style={{fontSize:"0.7rem",color:"rgba(255,255,255,0.35)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{req.email}</div>
                                </div>
                                <button onClick={()=>acceptFriend(req)} style={{padding:"5px 10px",borderRadius:"7px",background:"rgba(60,180,100,0.2)",border:"1px solid rgba(60,180,100,0.4)",color:"#60c880",cursor:"pointer",fontSize:"0.75rem",fontWeight:700}}>{T.friendAccept}</button>
                                <button onClick={()=>declineFriend(req)} style={{padding:"5px 10px",borderRadius:"7px",background:"rgba(200,60,60,0.1)",border:"1px solid rgba(200,60,60,0.3)",color:"#f07050",cursor:"pointer",fontSize:"0.75rem"}}>{T.friendDecline}</button>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* 친구 검색 */}
                        <div style={{...S.card,marginBottom:"12px"}}>
                          <div style={{fontSize:"0.78rem",fontWeight:600,color:"rgba(255,255,255,0.6)",marginBottom:"8px"}}>{T.friendAdd}</div>
                          <div style={{display:"flex",gap:"8px",marginBottom:"8px"}}>
                            <input value={friendSearchInput} onChange={e=>setFriendSearchInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchFriend()} placeholder={T.friendSearch} style={{...S.input,flex:1,padding:"9px 12px",fontSize:"0.88rem"}}/>
                            <button onClick={searchFriend} disabled={friendSearchLoading} style={{...S.btnAdd,padding:"9px 14px",fontSize:"0.82rem",opacity:friendSearchLoading?0.6:1}}>{T.friendSearchBtn}</button>
                          </div>
                          {friendSearchResult&&(friendSearchResult.notFound?(
                            <div style={{fontSize:"0.8rem",color:"#f07050",textAlign:"center",padding:"8px"}}>{T.friendNotFound}</div>
                          ):(
                            <div style={{display:"flex",alignItems:"center",gap:"10px",padding:"10px 12px",background:"rgba(255,255,255,0.04)",borderRadius:"10px"}}>
                              <img src={friendSearchResult.photoURL||"https://ui-avatars.com/api/?name="+encodeURIComponent(friendSearchResult.displayName||"?")} alt="" style={{width:"36px",height:"36px",borderRadius:"50%"}}/>
                              <div style={{flex:1}}>
                                <div style={{fontWeight:600,color:"#e8e6f0",fontSize:"0.88rem"}}>{friendSearchResult.displayName}</div>
                                <div style={{fontSize:"0.7rem",color:"rgba(255,255,255,0.35)"}}>{friendSearchResult.email}</div>
                              </div>
                              {friendSearchResult.uid===user.uid?(
                                <span style={{fontSize:"0.72rem",color:"rgba(255,255,255,0.3)"}}>나</span>
                              ):friends.find(f=>f.uid===friendSearchResult.uid)?(
                                <span style={{fontSize:"0.72rem",color:"#60c880"}}>✓ 친구</span>
                              ):(
                                <button onClick={()=>sendFriendRequest(friendSearchResult)} style={{padding:"5px 12px",borderRadius:"7px",background:"linear-gradient(135deg,#c4a050,#e8c875)",border:"none",color:"#17161C",fontWeight:700,cursor:"pointer",fontSize:"0.78rem"}}>{T.friendRequest}</button>
                              )}
                            </div>
                          ))}
                        </div>
                        {/* 친구 목록 */}
                        {friends.length===0?(
                          <div style={S.emptyMsg}>{T.friendNone}</div>
                        ):(
                          <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                            {friends.map(f=>(
                              <div key={f.uid} style={{display:"flex",alignItems:"center",gap:"10px",padding:"12px 14px",background:"#1E1D24",borderRadius:"12px",border:"1px solid rgba(255,255,255,0.08)"}}>
                                <img src={f.photoURL||"https://ui-avatars.com/api/?name="+encodeURIComponent(f.displayName||"?")} alt="" style={{width:"38px",height:"38px",borderRadius:"50%",flexShrink:0}}/>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontWeight:600,color:"#e8e6f0",fontSize:"0.9rem"}}>{f.displayName}</div>
                                  <div style={{fontSize:"0.68rem",color:"rgba(255,255,255,0.35)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.email}</div>
                                </div>
                                <button onClick={()=>{setDmTarget(f);setChatTab("dm");setChatInput("");}} style={{padding:"6px 12px",borderRadius:"8px",background:"rgba(196,160,80,0.15)",border:"1px solid rgba(196,160,80,0.35)",color:"#c4a050",cursor:"pointer",fontSize:"0.78rem",fontWeight:600}}>💬 DM</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* DM */}
                    {chatTab==="dm"&&dmTarget&&(
                      <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px",padding:"8px 12px",background:"rgba(255,255,255,0.04)",borderRadius:"10px"}}>
                          <button onClick={()=>{setChatTab("friends");setDmTarget(null);setDmMessages([]);}} style={{...S.scrollBtn,padding:"4px 10px",fontSize:"0.75rem"}}>{T.dmBack}</button>
                          <img src={dmTarget.photoURL||"https://ui-avatars.com/api/?name="+encodeURIComponent(dmTarget.displayName||"?")} alt="" style={{width:"28px",height:"28px",borderRadius:"50%"}}/>
                          <span style={{fontWeight:600,fontSize:"0.88rem",color:"#e8e6f0"}}>{dmTarget.displayName}</span>
                        </div>
                        <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:"8px",paddingBottom:"8px"}}>
                          {dmMessages.map(msg=>{
                            const isMe=msg.uid===user.uid;
                            return(
                              <div key={msg.id} style={{display:"flex",justifyContent:isMe?"flex-end":"flex-start"}}>
                                <div style={{maxWidth:"75%",padding:"9px 13px",borderRadius:isMe?"14px 14px 4px 14px":"14px 14px 14px 4px",background:isMe?"#c4a050":"rgba(255,255,255,0.08)",color:isMe?"#17161C":"#e8e6f0",fontSize:"0.88rem",lineHeight:1.4,wordBreak:"break-word"}}>
                                  {msg.text}
                                  <div style={{fontSize:"0.6rem",color:isMe?"rgba(0,0,0,0.4)":"rgba(255,255,255,0.3)",marginTop:"4px",textAlign:"right"}}>
                                    {msg.createdAt?.toDate?msg.createdAt.toDate().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):""}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          <div ref={dmBottomRef}/>
                        </div>
                        <div style={{display:"flex",gap:"8px",paddingTop:"8px",borderTop:"1px solid rgba(255,255,255,0.08)"}}>
                          <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendDM()} placeholder={T.chatPlaceholder} style={{...S.input,flex:1,padding:"10px 14px",fontSize:"0.9rem"}}/>
                          <button onClick={sendDM} disabled={!chatInput.trim()} style={{...S.btnAdd,padding:"10px 16px",opacity:chatInput.trim()?1:0.4}}>{T.chatSend}</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── 하단 탭바 ── */}
        {!isQuizActive&&(
          <nav style={{position:"fixed",bottom:0,left:0,right:0,background:"#17161C",borderTop:"1px solid rgba(255,255,255,0.1)",zIndex:200,paddingBottom:"env(safe-area-inset-bottom)"}}>

            {/* 접기/펼치기 핸들 */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:navCollapsed?"4px 12px":"2px 12px 0",borderBottom:navCollapsed?"none":"1px solid rgba(255,255,255,0.05)"}}>
              {navCollapsed?(
                // 접혔을 때: 현재 탭 + 채팅 알림 + 펼치기 버튼
                <div style={{display:"flex",alignItems:"center",gap:"8px",flex:1}}>
                  <span style={{fontSize:"1rem"}}>{[{id:"list",emoji:"📚"},{id:"add",emoji:"➕"},{id:"quiz",emoji:"🎯"},{id:"wallets",emoji:"🗂️"},{id:"settings",emoji:"⚙️"},{id:"chat",emoji:"💬"}].find(t=>t.id===activeTab)?.emoji}</span>
                  <span style={{fontSize:"0.75rem",color:"#c4a050",fontWeight:600}}>{T[`tab_${activeTab}`]||activeTab}</span>
                  {(unreadChat>0||(user&&friendRequests.length>0))&&(
                    <button onClick={()=>setActiveTab("chat")} style={{display:"flex",alignItems:"center",gap:"4px",padding:"3px 8px",borderRadius:"10px",background:"rgba(240,80,80,0.2)",border:"1px solid rgba(240,80,80,0.4)",color:"#f07070",cursor:"pointer",fontSize:"0.72rem",fontWeight:700}}>
                      💬 {unreadChat+(user?friendRequests.length:0)}
                    </button>
                  )}
                </div>
              ):(
                <div style={{flex:1}}/>
              )}
              <button onClick={()=>setNavCollapsed(v=>!v)} style={{padding:"4px 8px",borderRadius:"6px",background:"rgba(255,255,255,0.06)",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:"0.7rem"}}>
                {navCollapsed?T.navExpand:T.navCollapse}
              </button>
            </div>

            {/* 탭 버튼들 (접혔을 때 숨김) */}
            {!navCollapsed&&(
              <div style={{display:"flex"}}>
                {[
                  {id:"list",   emoji:"📚", label:T.tab_list},
                  {id:"add",    emoji:"➕", label:T.tab_add},
                  {id:"quiz",   emoji:"🎯", label:T.tab_quiz},
                  {id:"wallets",emoji:"🗂️", label:T.tab_wallets, badge:wallets.length||null},
                  {id:"settings",emoji:"⚙️",label:T.tab_settings, badge:user?"●":null},
                  {id:"chat",emoji:"💬",label:T.tab_chat, badge:(unreadChat>0||(user&&friendRequests.length>0))?(unreadChat+(user?friendRequests.length:0)):null},
                ].map(tab=>(
                  <button key={tab.id} onClick={()=>setActiveTab(tab.id)} style={{flex:1,padding:"10px 4px 8px",border:"none",background:"transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:"3px",position:"relative"}}>
                    {tab.badge&&(
                      <span style={{position:"absolute",top:"7px",right:"calc(50% - 14px)",minWidth:"14px",height:"14px",borderRadius:"7px",padding:"0 3px",background:tab.id==="chat"?"#f07050":tab.id==="settings"?"#60c880":"#c4a050",fontSize:"0.52rem",fontWeight:700,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>
                        {typeof tab.badge==="number"?tab.badge:"●"}
                      </span>
                    )}
                    <span style={{fontSize:"1.2rem",lineHeight:1}}>{tab.emoji}</span>
                    <span style={{fontSize:"0.58rem",color:activeTab===tab.id?"#c4a050":"rgba(255,255,255,0.35)",fontWeight:activeTab===tab.id?700:400,letterSpacing:"0.3px",transition:"color 0.15s"}}>{tab.label}</span>
                    {activeTab===tab.id&&<span style={{position:"absolute",bottom:0,left:"20%",right:"20%",height:"2px",background:"#c4a050",borderRadius:"1px 1px 0 0"}}/>}
                  </button>
                ))}
              </div>
            )}
          </nav>
        )}

      </div>
    </div>
  );
}

const S={
  root:{minHeight:"100vh",background:"#17161C",color:"#ffffff",fontFamily:"'Noto Sans KR','Apple SD Gothic Neo',sans-serif",position:"relative",overflow:"hidden",padding:"16px 0 0"},
  bgDeco1:{position:"fixed",top:"-180px",right:"-180px",width:"420px",height:"420px",borderRadius:"50%",background:"radial-gradient(circle,rgba(196,160,80,0.07) 0%,transparent 65%)",pointerEvents:"none"},
  bgDeco2:{position:"fixed",bottom:"-120px",left:"-120px",width:"360px",height:"360px",borderRadius:"50%",background:"radial-gradient(circle,rgba(90,70,160,0.10) 0%,transparent 65%)",pointerEvents:"none"},
  container:{maxWidth:"700px",margin:"0 auto",padding:"0 12px",position:"relative",zIndex:1},
  toast:{position:"fixed",top:"16px",left:"50%",transform:"translateX(-50%)",background:"#22C55E",color:"#fff",padding:"11px 20px",borderRadius:"10px",fontSize:"0.86rem",fontWeight:600,zIndex:1000,boxShadow:"0 4px 24px rgba(0,0,0,0.5)",whiteSpace:"nowrap",maxWidth:"90vw",textAlign:"center"},
  toastErr:{background:"#EF4444"},
  modalOverlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:900,padding:"16px"},
  modal:{background:"#1E1D24",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"18px",padding:"24px",maxWidth:"440px",width:"100%",boxShadow:"0 24px 60px rgba(0,0,0,0.6)"},
  modalTitle:{margin:"0 0 6px",color:"#ffffff",fontSize:"1.05rem",fontWeight:700},
  modalSub:{margin:"0 0 10px",color:"rgba(255,255,255,0.45)",fontSize:"0.85rem"},
  header:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px",padding:"14px 16px",background:"#1E1D24",borderRadius:"14px",border:"1px solid rgba(255,255,255,0.08)"},
  headerLeft:{display:"flex",alignItems:"center",gap:"12px"},
  logo:{fontSize:"1.5rem",fontFamily:"Arial,sans-serif",color:"#c4a050",background:"rgba(196,160,80,0.12)",width:"42px",height:"42px",borderRadius:"10px",display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid rgba(196,160,80,0.25)",flexShrink:0},
  title:{margin:0,fontSize:"1rem",fontWeight:700,color:"#ffffff"},
  statsRow:{display:"flex",gap:"5px"},
  statBadge:{borderRadius:"8px",padding:"5px 9px",fontSize:"0.78rem",fontWeight:700},
  ioCard:{background:"#1E1D24",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"14px",padding:"14px 16px",marginBottom:"12px"},
  btnIO:(color,bg,border)=>({padding:"9px 12px",borderRadius:"9px",background:bg,border:`1px solid ${border}`,color,fontWeight:600,cursor:"pointer",fontSize:"0.8rem"}),
  card:{background:"#1E1D24",borderRadius:"14px",border:"1px solid rgba(255,255,255,0.08)",padding:"16px",marginBottom:"12px"},
  input:{width:"100%",padding:"12px 14px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"10px",color:"#ffffff",fontSize:"1rem",outline:"none",fontFamily:"inherit"},
  btnAdd:{padding:"12px 18px",borderRadius:"10px",background:"#c4a050",border:"none",color:"#17161C",fontWeight:700,cursor:"pointer",fontSize:"0.95rem"},
  btnCancel:{padding:"12px 14px",borderRadius:"10px",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.80)",cursor:"pointer",fontSize:"0.9rem"},
  btnMerge:{flex:1,padding:"12px 10px",borderRadius:"10px",background:"#c4a050",border:"none",color:"#17161C",fontWeight:700,cursor:"pointer",fontSize:"0.88rem"},
  btnReplace:{flex:1,padding:"12px 10px",borderRadius:"10px",background:"rgba(129,140,248,0.2)",border:"1px solid rgba(129,140,248,0.4)",color:"#a5b4fc",fontWeight:600,cursor:"pointer",fontSize:"0.88rem"},
  btnCancel2:{padding:"12px 14px",borderRadius:"10px",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.80)",cursor:"pointer",fontSize:"0.88rem"},
  scrollBtn:{padding:"6px 12px",borderRadius:"8px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.82)",cursor:"pointer",fontSize:"0.78rem"},
  filterTabs:{display:"flex",gap:"6px",marginBottom:"12px",overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",paddingBottom:"2px"},
  filterTab:{padding:"7px 12px",borderRadius:"8px",border:"1px solid rgba(255,255,255,0.08)",background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.40)",cursor:"pointer",fontSize:"0.78rem",display:"flex",alignItems:"center",gap:"4px",whiteSpace:"nowrap",flexShrink:0},
  filterTabActive:{background:"rgba(196,160,80,0.15)",borderColor:"rgba(196,160,80,0.5)",color:"#c4a050"},
  filterCnt:{background:"rgba(255,255,255,0.1)",borderRadius:"4px",padding:"1px 5px",marginLeft:"4px",fontSize:"0.7rem"},
  wordItem:{display:"flex",alignItems:"center",gap:"10px",background:"#1E1D24",borderRadius:"12px",border:"1px solid",padding:"12px 14px"},
  wordHeb:{fontFamily:"Arial,sans-serif",fontSize:"1.15rem",color:"#c4a050",direction:"rtl"},
  wordMean:{fontSize:"0.82rem",color:"rgba(255,255,255,0.88)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},
  emptyMsg:{textAlign:"center",color:"rgba(255,255,255,0.25)",padding:"24px",fontSize:"0.9rem"},
  settingLabel:{margin:"0 0 8px",fontSize:"0.72rem",color:"rgba(255,255,255,0.35)",textTransform:"uppercase",letterSpacing:"0.8px",fontWeight:600},
  optionRow:{display:"flex",gap:"6px",marginBottom:"12px",flexWrap:"wrap"},
  optBtn:{padding:"9px 13px",borderRadius:"9px",border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.92)",cursor:"pointer",fontSize:"0.82rem"},
  optBtnActive:{background:"rgba(196,160,80,0.15)",borderColor:"rgba(196,160,80,0.5)",color:"#c4a050"},
  progressBar:{height:"4px",background:"rgba(255,255,255,0.08)",borderRadius:"2px",marginBottom:"12px",overflow:"hidden"},
  progressFill:{height:"100%",background:"#c4a050",borderRadius:"2px",transition:"width 0.35s ease"},
  progressLabel:{display:"flex",justifyContent:"space-between",fontSize:"0.82rem",color:"rgba(255,255,255,0.35)",marginBottom:"16px"},
  scoreLabel:{color:"#c4a050",fontWeight:700},
  questionCard:{background:"#1E1D24",borderRadius:"20px",border:"1px solid rgba(255,255,255,0.1)",padding:"28px 20px",textAlign:"center",marginBottom:"16px"},
  questionTag:{fontSize:"0.7rem",color:"rgba(196,160,80,0.8)",letterSpacing:"1.2px",textTransform:"uppercase",marginBottom:"14px"},
  questionText:{color:"#ffffff",lineHeight:1.3,wordBreak:"break-word"},
  choicesGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"14px"},
  choiceBtn:{padding:"14px 12px",borderRadius:"12px",background:"#1E1D24",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.92)",cursor:"pointer",fontSize:"0.88rem",textAlign:"left",display:"flex",alignItems:"center",gap:"10px",fontFamily:"inherit",minHeight:"56px",width:"100%"},
  choiceSelected:{background:"rgba(129,140,248,0.15)",borderColor:"rgba(129,140,248,0.5)",color:"#c7d2fe"},
  choiceCorrect:{background:"rgba(74,222,128,0.15)",borderColor:"rgba(74,222,128,0.5)",color:"#86efac"},
  choiceWrong:{background:"rgba(239,68,68,0.15)",borderColor:"rgba(239,68,68,0.4)",color:"#fca5a5"},
  choiceAlpha:{width:"26px",height:"26px",borderRadius:"6px",background:"rgba(255,255,255,0.07)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.72rem",fontWeight:700,flexShrink:0},
  feedbackCorrect:{display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",textAlign:"center",padding:"12px",borderRadius:"10px",background:"rgba(74,222,128,0.12)",border:"1px solid rgba(74,222,128,0.3)",color:"#86efac",fontWeight:600,marginBottom:"14px",fontSize:"0.95rem"},
  feedbackWrong:{display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",textAlign:"center",padding:"12px",borderRadius:"10px",background:"rgba(239,68,68,0.12)",border:"1px solid rgba(239,68,68,0.3)",color:"#fca5a5",fontWeight:600,marginBottom:"14px",fontSize:"0.95rem"},
  quizBtnRow:{display:"flex",gap:"10px"},
  btnConfirm:{flex:1,padding:"15px",borderRadius:"12px",background:"#c4a050",border:"none",color:"#17161C",fontWeight:700,cursor:"pointer",fontSize:"1rem"},
  btnNext:{flex:1,padding:"15px",borderRadius:"12px",background:"#818cf8",border:"none",color:"#17161C",fontWeight:700,cursor:"pointer",fontSize:"1rem"},
  btnQuit:{padding:"15px 16px",borderRadius:"12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.70)",cursor:"pointer",fontSize:"0.9rem"},
  btnEssayConfirm:{flex:1,padding:"15px",borderRadius:"12px",background:"#818cf8",border:"none",color:"#17161C",fontWeight:700,cursor:"pointer",fontSize:"1rem"},
  btnStart:{width:"100%",padding:"14px",borderRadius:"12px",background:"#c4a050",border:"none",color:"#17161C",fontWeight:800,cursor:"pointer",fontSize:"1rem"},
  btnEssayStart:{width:"100%",padding:"14px",borderRadius:"12px",background:"#818cf8",border:"none",color:"#17161C",fontWeight:800,cursor:"pointer",fontSize:"1rem"},
  btnDisabled:{opacity:0.3,cursor:"not-allowed"},
  resultWrap:{textAlign:"center",padding:"16px 0"},
  resultCircle:{width:"120px",height:"120px",borderRadius:"50%",background:"rgba(196,160,80,0.08)",border:"2px solid rgba(196,160,80,0.4)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px"},
  resultScore:{fontSize:"2.4rem",fontWeight:800,color:"#c4a050"},
  resultTotal:{fontSize:"1.1rem",color:"rgba(255,255,255,0.35)",alignSelf:"flex-end",marginBottom:"8px"},
  resultMsg:{fontSize:"1.05rem",color:"#ffffff",marginBottom:"4px"},
  resultPct:{fontSize:"0.88rem",color:"rgba(255,255,255,0.40)",marginBottom:"20px"},
  wrongList:{background:"#1E1D24",borderRadius:"14px",border:"1px solid rgba(239,68,68,0.2)",padding:"14px",marginBottom:"16px",textAlign:"left"},
  wrongTitle:{margin:"0 0 10px",fontSize:"0.88rem",color:"#fca5a5"},
  wrongItem:{padding:"8px 0",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",alignItems:"center",gap:"8px"},
};
