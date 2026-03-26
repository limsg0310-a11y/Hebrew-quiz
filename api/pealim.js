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
  let baseForm = '';
  let meaning = '';

  // title에서 뜻 추출
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
  if (titleMatch) {
    const dashParts = titleMatch[1].split(/\s*[\u2013\u2014\-]\s*/).map(p => p.trim()).filter(Boolean);
    const candidates = dashParts.filter(p =>
      !/conjugation|inflection|tables|pealim/i.test(p) &&
      !/^[\u05D0-\u05EA\u05B0-\u05C7\s]+$/.test(p)
    );
    if (candidates.length > 0) meaning = candidates[0].trim();
  }

  // h2에서 사전 기본형 추출 ("Conjugation of לְדַבֵּר")
  const h2Match = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
  if (h2Match) {
    const hs = h2Match[1].match(/<span[^>]+class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7]+)<\/span>/);
    if (hs) baseForm = hs[1].trim();
  }
  if (!baseForm) {
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
    if (h1Match) {
      const hs = h1Match[1].match(/<span[^>]+class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7]+)<\/span>/);
      if (hs) baseForm = hs[1].trim();
    }
  }

  // 품사 감지
  let wordType = 'verb';
  const posMatch = html.match(/Part of speech[:\s]*(verb|noun|adjective|adverb|preposition|pronoun)/i)
    || html.match(/\b(Verb|Noun|Adjective)\s*[\u2013\u2014\-]/i);
  if (posMatch) {
    const pos = (posMatch[1]||'').toLowerCase();
    if (pos === 'verb') wordType = 'verb';
    else if (pos === 'noun') wordType = 'noun';
    else if (pos === 'adjective') wordType = 'adj';
    else wordType = 'other';
  }

  // Active 섹션만 사용
  const activeHtml = html.split(/Passive forms|Binyan Pu.al|Binyan Huf.al/i)[0];
  const variants = {};

  if (wordType === 'verb') {
    // 각 섹션 위치를 찾아서 정확히 분리
    const sectionMap = findSections(activeHtml);

    // 현재형 (4개: ms, fs, mp, fp)
    if (sectionMap.present !== undefined) {
      const sec = getSection(activeHtml, sectionMap, 'present');
      const forms = unique4(getMenukad(sec));
      ['pres_ms','pres_fs','pres_mp','pres_fp'].forEach((k,i) => { if (forms[i]) variants[k] = forms[i]; });
    }

    // 과거형 (중복 허용 — 같은 형태가 다른 인칭에 쓰임)
    if (sectionMap.past !== undefined) {
      const sec = getSection(activeHtml, sectionMap, 'past');
      const forms = getMenukad(sec);
      // pealim 과거 순서: 1s, 1p, 2ms, 2fs, 2mp, 2fp, 3ms, 3fs, 3mp (3fp는 3mp와 같은 경우 많음)
      ['past_1s','past_1p','past_2ms','past_2fs','past_2mp','past_2fp','past_3ms','past_3fs','past_3mp','past_3fp']
        .forEach((k,i) => { if (forms[i]) variants[k] = forms[i]; });
    }

    // 미래형 (중복 허용)
    if (sectionMap.future !== undefined) {
      const sec = getSection(activeHtml, sectionMap, 'future');
      const forms = getMenukad(sec);
      ['fut_1s','fut_2ms','fut_2fs','fut_3ms','fut_3fs','fut_1p','fut_2mp','fut_2fp','fut_3mp','fut_3fp']
        .forEach((k,i) => { if (forms[i]) variants[k] = forms[i]; });
    }

    // 명령형 (4개)
    if (sectionMap.imperative !== undefined) {
      const sec = getSection(activeHtml, sectionMap, 'imperative');
      const forms = unique4(getMenukad(sec));
      ['imp_2ms','imp_2fs','imp_2mp','imp_2fp'].forEach((k,i) => { if (forms[i]) variants[k] = forms[i]; });
    }

    // 인피니티브
    if (sectionMap.infinitive !== undefined) {
      const sec = getSection(activeHtml, sectionMap, 'infinitive');
      const forms = getMenukad(sec);
      if (forms[0]) variants['infinitive'] = forms[0];
    }
    if (!variants['infinitive'] && baseForm) variants['infinitive'] = baseForm;

  } else if (wordType === 'noun') {
    const singM = html.match(/Singular([\s\S]*?)(?=Plural|Dual|Construct|$)/i);
    if (singM) { const f = unique4(getMenukad(singM[1])); if(f[0]) variants['gender_m']=f[0]; if(f[1]) variants['gender_f']=f[1]; }
    const pl = html.match(/Plural([\s\S]*?)(?=Dual|Construct|$)/i);
    if (pl) { const f = unique4(getMenukad(pl[1])); if(f[0]) variants['plural_m']=f[0]; if(f[1]) variants['plural_f']=f[1]; }

  } else if (wordType === 'adj') {
    const f = unique4(getMenukad(html));
    ['gender_m','gender_f','plural_m','plural_f'].forEach((k,i) => { if(f[i]) variants[k]=f[i]; });
  }

  return { infinitive: baseForm||'', meaning: meaning||'', wordType, variants, variantCount: Object.keys(variants).length };
}

// HTML에서 각 섹션의 시작 인덱스 찾기
function findSections(html) {
  const SECTION_PATTERNS = {
    present:    /Present tense/i,
    past:       /Past tense/i,
    future:     /Future tense/i,
    imperative: /\bImperative\b/i,
    infinitive: /\bInfinitive\b/i,
  };
  const map = {};
  for (const [key, re] of Object.entries(SECTION_PATTERNS)) {
    const m = html.search(re);
    if (m >= 0) map[key] = m;
  }
  return map;
}

// 섹션 내용 추출 (다음 섹션 시작 전까지)
function getSection(html, sectionMap, key) {
  const start = sectionMap[key];
  if (start === undefined) return '';
  // 다음 섹션 찾기
  const otherStarts = Object.entries(sectionMap)
    .filter(([k]) => k !== key)
    .map(([, v]) => v)
    .filter(v => v > start);
  const end = otherStarts.length > 0 ? Math.min(...otherStarts) : html.length;
  return html.slice(start, end);
}

// menukad span 모두 추출
function getMenukad(html) {
  const forms = [];
  const re = /<span[^>]+class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7]+)<\/span>/g;
  let m;
  while ((m = re.exec(html)) !== null) forms.push(m[1]);
  return forms;
}

// 중복 제거 (순서 유지)
function unique4(arr) {
  const seen = new Set();
  const result = [];
  for (const x of arr) {
    if (!seen.has(x)) { seen.add(x); result.push(x); }
  }
  return result;
}
