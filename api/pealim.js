// api/pealim.js — Vercel Serverless Function
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  const { mode, root, url } = req.query;
  try {
    if (mode === 'search') {
      if (!root) return res.status(400).json({ error: '어근을 입력해주세요' });
      const clean = root.replace(/[\u0591-\u05C7\s\-\u2013\u2014]/g, '');
      const parts = [...clean].filter(c => /[\u05D0-\u05EA]/.test(c));
      if (parts.length < 2) return res.status(400).json({ error: '히브리어 자음 2자 이상 입력해주세요' });
      const numR = Math.min(parts.length, 4);
      let searchUrl;
      if (numR === 2) searchUrl = `https://www.pealim.com/dict/?num-radicals=2&r1=${enc(parts[0])}&rf=${enc(parts[1])}`;
      else if (numR === 3) searchUrl = `https://www.pealim.com/dict/?num-radicals=3&r1=${enc(parts[0])}&r2=${enc(parts[1])}&rf=${enc(parts[2])}`;
      else searchUrl = `https://www.pealim.com/dict/?num-radicals=4&r1=${enc(parts[0])}&r2=${enc(parts[1])}&r3=${enc(parts[2])}&rf=${enc(parts[3])}`;
      const html = await fetchPage(searchUrl);
      const results = parseSearchResults(html);
      return res.status(200).json({ results: results.slice(0, 15) });

    } else if (mode === 'conjugation') {
      if (!url || !url.includes('pealim.com')) return res.status(400).json({ error: '올바른 pealim URL이 필요해요' });
      const html = await fetchPage(url);
      const result = parseConjugation(html);
      return res.status(200).json(result);

    } else {
      return res.status(400).json({ error: 'mode 파라미터가 필요해요' });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

const enc = s => encodeURIComponent(s);

async function fetchPage(url) {
  const res = await fetch(url, { headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9',
  }});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ── 검색 결과 파싱 ──
function parseSearchResults(html) {
  const results = [];
  const re = /href="(\/dict\/\d+[^"]+)"[\s\S]*?<span[^>]+class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7 ]+)<\/span>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const path = m[1].split('"')[0];
    const hebrew = m[2].trim();
    if (results.find(r => r.path === path)) continue;
    const snippet = html.slice(Math.max(0, m.index - 50), m.index + 500).replace(/<[^>]+>/g, ' ').replace(/\s+/g,' ');
    let meaning = '';
    const toMatch = snippet.match(/\bto\s+[a-z][a-z\s,\/]{1,50}/i);
    if (toMatch) meaning = toMatch[0].trim();
    else {
      const engMatch = snippet.match(/[a-zA-Z][a-zA-Z\s,\/\(\)]{3,50}/);
      if (engMatch && !/pealim|hebrew|dict|conjugation/i.test(engMatch[0])) meaning = engMatch[0].trim();
    }
    results.push({ path, hebrew, meaning, url: `https://www.pealim.com${path}` });
  }
  return results;
}

// ── 변형 파싱 ──
function parseConjugation(html) {
  // 1. 제목에서 기본형(인피니티브/사전형) + 뜻 추출
  let baseForm = '';
  let meaning = '';

  // title: "לדבר – to speak, to talk – Hebrew conjugation tables"
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
  if (titleMatch) {
    const dashParts = titleMatch[1].split(/\s*[\u2013\u2014\-]\s*/).map(p => p.trim()).filter(Boolean);
    const candidates = dashParts.filter(p =>
      !/conjugation|inflection|tables|pealim/i.test(p) &&
      !/^[\u05D0-\u05EA\u05B0-\u05C7\s]+$/.test(p)
    );
    if (candidates.length > 0) meaning = candidates[0].trim();
  }

  // h2에서 사전 기본형 추출 (pealim은 "Conjugation of לְדַבֵּר" 형태)
  // h2가 h1보다 신뢰도 높음 — 실제 페이지 제목
  const h2Match = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
  if (h2Match) {
    const hebSpans = h2Match[1].match(/<span[^>]+class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7]+)<\/span>/g);
    if (hebSpans && hebSpans.length > 0) {
      const firstSpan = hebSpans[0].match(/>([^<]+)</);
      if (firstSpan) baseForm = firstSpan[1].trim();
    }
  }
  // h1도 시도
  if (!baseForm) {
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    if (h1Match) {
      const hs = h1Match[1].match(/<span[^>]+class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7]+)<\/span>/);
      if (hs) baseForm = hs[1].trim();
    }
  }
  // 마지막 폴백: 첫 번째 menukad span
  if (!baseForm) {
    const fm = html.match(/<span[^>]+class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7]+)<\/span>/);
    if (fm) baseForm = fm[1].trim();
  }

  // 2. 품사 감지
  let wordType = 'verb';
  const posMatch = html.match(/Part of speech[:\s]*(verb|noun|adjective|adverb|preposition|pronoun)/i)
    || html.match(/\b(Verb|Noun|Adjective|Adverb|Preposition|Pronoun)\s*[\u2013\u2014\-]/i);
  if (posMatch) {
    const pos = (posMatch[1]||'').toLowerCase();
    if (pos === 'verb') wordType = 'verb';
    else if (pos === 'noun') wordType = 'noun';
    else if (pos === 'adjective') wordType = 'adj';
    else wordType = 'other';
  }

  // 3. Active 섹션만 사용 (Passive 제외)
  const activeHtml = html.split(/Passive forms|Binyan Pu.al|Binyan Huf.al/i)[0];

  // 4. 변형 추출 — 테이블 행 기반 위치 파싱
  const variants = {};

  if (wordType === 'verb') {
    // pealim 동사 테이블 구조:
    // "Present tense / Participle" → 4개 (ms, fs, mp, fp)
    // "Past tense" → 인칭별 행으로 구성
    // "Future tense" → 인칭별 행
    // "Imperative" → 4개
    // "Infinitive" → 1개

    parseVerbTable(activeHtml, variants);

    // 인피니티브가 없으면 baseForm 사용
    if (!variants['infinitive'] && baseForm) variants['infinitive'] = baseForm;

  } else if (wordType === 'noun') {
    parseNounTable(html, variants);
  } else if (wordType === 'adj') {
    parseAdjectiveTable(html, variants);
  }

  return {
    infinitive: baseForm || '',
    meaning: meaning || '',
    wordType,
    variants,
    variantCount: Object.keys(variants).length
  };
}

// ── 동사 테이블 파싱 (핵심) ──
function parseVerbTable(html, variants) {
  // 각 섹션을 명확하게 분리
  const sections = splitIntoSections(html);

  // 현재형
  if (sections.present) {
    const forms = getAllMenukad(sections.present);
    const keys = ['pres_ms', 'pres_fs', 'pres_mp', 'pres_fp'];
    // 중복 제거 (현재형은 4개 고유)
    const unique = [...new Set(forms)];
    unique.slice(0, 4).forEach((f, i) => { if (f) variants[keys[i]] = f; });
  }

  // 과거형 — 중복 허용 (같은 형태가 여러 인칭에 쓰임)
  if (sections.past) {
    const forms = getAllMenukad(sections.past);
    // pealim 과거 테이블 순서: 1s, 1p, 2ms, 2fs, 2mp, 2fp, 3ms, 3fs, 3p(mp), 3fp
    const keys = ['past_1s','past_1p','past_2ms','past_2fs','past_2mp','past_2fp','past_3ms','past_3fs','past_3mp','past_3fp'];
    forms.slice(0, keys.length).forEach((f, i) => { if (f) variants[keys[i]] = f; });
  }

  // 미래형 — 중복 허용
  if (sections.future) {
    const forms = getAllMenukad(sections.future);
    const keys = ['fut_1s','fut_2ms','fut_2fs','fut_3ms','fut_3fs','fut_1p','fut_2mp','fut_2fp','fut_3mp','fut_3fp'];
    forms.slice(0, keys.length).forEach((f, i) => { if (f) variants[keys[i]] = f; });
  }

  // 명령형
  if (sections.imperative) {
    const forms = [...new Set(getAllMenukad(sections.imperative))];
    const keys = ['imp_2ms', 'imp_2fs', 'imp_2mp', 'imp_2fp'];
    forms.slice(0, 4).forEach((f, i) => { if (f) variants[keys[i]] = f; });
  }

  // 인피니티브
  if (sections.infinitive) {
    const forms = getAllMenukad(sections.infinitive);
    if (forms[0]) variants['infinitive'] = forms[0];
  }
}

// HTML을 섹션별로 분리
function splitIntoSections(html) {
  const result = {};

  // pealim 섹션 헤더 패턴들
  const sectionPatterns = [
    { key: 'present',    re: /Present tense/i },
    { key: 'past',       re: /Past tense/i },
    { key: 'future',     re: /Future tense/i },
    { key: 'imperative', re: /Imperative/i },
    { key: 'infinitive', re: /\bInfinitive\b/i },
  ];

  // 각 섹션의 시작 위치 찾기
  const positions = [];
  for (const { key, re } of sectionPatterns) {
    const idx = html.search(re);
    if (idx >= 0) positions.push({ key, idx });
  }
  positions.sort((a, b) => a.idx - b.idx);

  // 각 섹션 내용 추출
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].idx;
    const end = i + 1 < positions.length ? positions[i + 1].idx : html.length;
    result[positions[i].key] = html.slice(start, end);
  }

  return result;
}

// ── 명사 테이블 파싱 ──
function parseNounTable(html, variants) {
  // 명사: Singular / Plural / Construct state
  const singularMatch = html.match(/Singular([\s\S]*?)(?=Plural|Dual|$)/i);
  if (singularMatch) {
    const forms = [...new Set(getAllMenukad(singularMatch[1]))];
    if (forms[0]) variants['gender_m'] = forms[0]; // 남성 단수
    if (forms[1]) variants['gender_f'] = forms[1]; // 여성 단수
  }
  const pluralMatch = html.match(/Plural([\s\S]*?)(?=Dual|Construct|$)/i);
  if (pluralMatch) {
    const forms = [...new Set(getAllMenukad(pluralMatch[1]))];
    if (forms[0]) variants['plural_m'] = forms[0];
    if (forms[1]) variants['plural_f'] = forms[1];
  }
}

// ── 형용사 테이블 파싱 ──
function parseAdjectiveTable(html, variants) {
  // 형용사: Masculine/Feminine × Singular/Plural
  const allForms = getAllMenukad(html);
  // pealim 형용사 순서: m.sg, f.sg, m.pl, f.pl
  const keys = ['gender_m', 'gender_f', 'plural_m', 'plural_f'];
  const unique = [...new Set(allForms)];
  unique.slice(0, 4).forEach((f, i) => { if (f) variants[keys[i]] = f; });
}

function getAllMenukad(html) {
  const forms = [];
  const re = /<span[^>]+class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7]+)<\/span>/g;
  let m;
  while ((m = re.exec(html)) !== null) forms.push(m[1]);
  return forms;
}
