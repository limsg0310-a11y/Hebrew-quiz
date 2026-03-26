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

function parseSearchResults(html) {
  const results = [];
  const re = /href="(\/dict\/\d+[^"]+)"[\s\S]*?<span[^>]+class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7 ]+)<\/span>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const path = m[1].split('"')[0];
    const hebrew = m[2].trim();
    if (results.find(r => r.path === path)) continue;
    // 뜻 추출 — 링크 주변 블록에서
    const snippet = html.slice(Math.max(0, m.index - 50), m.index + 500).replace(/<[^>]+>/g, ' ').replace(/\s+/g,' ');
    // "to ..." 동사형 또는 일반 영어 단어
    let meaning = '';
    const toMatch = snippet.match(/\bto\s+[a-z][a-z\s,\/]{1,50}/i);
    if (toMatch) { meaning = toMatch[0].trim(); }
    else {
      // 명사/형용사 — 히브리어 뒤에 오는 영어 단어
      const engMatch = snippet.match(/[a-zA-Z][a-zA-Z\s,\/\(\)]{3,50}/);
      if (engMatch && !/pealim|hebrew|dict|conjugation/i.test(engMatch[0])) {
        meaning = engMatch[0].trim();
      }
    }
    results.push({ path, hebrew, meaning, url: `https://www.pealim.com${path}` });
  }
  return results;
}

function parseConjugation(html) {
  let baseForm = '';
  let meaning = '';
  let wordType = 'verb'; // 기본값

  // title에서 의미 추출
  // 패턴: "לדבר – to speak, to talk – Hebrew conjugation tables"
  //       "בית – house, home – Hebrew inflection tables"
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
  if (titleMatch) {
    const title = titleMatch[1];
    // 대시로 분리 (en-dash, em-dash, hyphen 모두 처리)
    const dashParts = title.split(/\s*[\u2013\u2014\u002D]\s*/).map(p => p.trim()).filter(Boolean);
    // "Hebrew conjugation/inflection tables" 제거 후 영어 부분 찾기
    const candidates = dashParts.filter(p =>
      !/conjugation|inflection|tables|pealim/i.test(p) &&   // 불필요한 부분 제거
      !/^[\u05D0-\u05EA\u05B0-\u05C7]+$/.test(p)          // 히브리어만 있는 부분 제거
    );
    // 첫 번째 영어 후보 사용
    if (candidates.length > 0) meaning = candidates[0].trim();
  }

  // og:description에서도 시도 (더 자세한 뜻이 있을 수 있음)
  if (!meaning) {
    const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/);
    if (ogDesc) {
      const desc = ogDesc[1];
      // "to speak, to talk" 같은 뜻 부분만 추출
      const engMatch = desc.match(/[a-zA-Z][a-zA-Z\s,\/\(\)]{2,60}/);
      if (engMatch) meaning = engMatch[0].trim();
    }
  }

  // 품사 감지 — pealim HTML에서 "Part of speech:" 또는 "Verb –", "Noun –", "Adjective –" 패턴
  const posMatch = html.match(/Part of speech[:\s]+(verb|noun|adjective|adverb|preposition|pronoun|numeral|particle|conjunction)/i)
    || html.match(/(Verb|Noun|Adjective|Adverb|Preposition|Pronoun)\s*[–\-]/i);
  if (posMatch) {
    const pos = (posMatch[1]||'').toLowerCase();
    if (pos === 'verb') wordType = 'verb';
    else if (pos === 'noun') wordType = 'noun';
    else if (pos === 'adjective') wordType = 'adj';
    else if (pos === 'adverb' || pos === 'preposition' || pos === 'pronoun' || pos === 'conjunction') wordType = 'other';
    else wordType = 'other';
  }

  // h1/h2에서 기본형 추출
  const headMatch = html.match(/<h[12][^>]*>[\s\S]*?<\/h[12]>/);
  if (headMatch) {
    const hs = headMatch[0].match(/<span[^>]+class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7]+)<\/span>/);
    if (hs) baseForm = hs[1].trim();
  }
  if (!baseForm) {
    const fm = html.match(/<span[^>]+class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7]+)<\/span>/);
    if (fm) baseForm = fm[1].trim();
  }

  const variants = {};

  if (wordType === 'verb') {
    // 동사: 시제 변화 파싱
    const activeHtml = html.split(/Passive forms|Binyan Pu.al|Binyan Huf.al/i)[0];

    extractSection(activeHtml, /Present tense[^<]*/i,
      /Past tense|Future tense|Imperative|Infinitive/i,
      ['pres_ms','pres_fs','pres_mp','pres_fp'], variants);

    extractSectionAllowDup(activeHtml, /Past tense/i,
      /Future tense|Imperative|Infinitive/i,
      ['past_1s','past_1p','past_2ms','past_2fs','past_2mp','past_2fp','past_3ms','past_3fs','past_3mp'], variants);

    extractSectionAllowDup(activeHtml, /Future tense/i,
      /Imperative|Infinitive/i,
      ['fut_1s','fut_2ms','fut_2fs','fut_3ms','fut_3fs','fut_1p','fut_2mp','fut_2fp','fut_3mp','fut_3fp'], variants);

    extractSection(activeHtml, /Imperative/i,
      /Infinitive|Active forms|$^/i,
      ['imp_2ms','imp_2fs','imp_2mp','imp_2fp'], variants);

    const infSec = activeHtml.match(/Infinitive([\s\S]*?)(?=<\/table>|<\/section>|Active forms|$)/i);
    if (infSec) {
      const forms = getAllMenukad(infSec[1]);
      if (forms[0]) variants['infinitive'] = forms[0];
    }
    if (!variants['infinitive'] && baseForm) variants['infinitive'] = baseForm;

  } else if (wordType === 'noun') {
    // 명사: 단수/복수, 성별, 연계형 파싱
    extractSection(html, /Singular/i, /Plural|Dual|$^/i,
      ['gender_m'], variants); // 단수 기본형 (남성)
    extractSection(html, /Plural/i, /Dual|Construct|$^/i,
      ['plural_m','plural_f'], variants);

  } else if (wordType === 'adj') {
    // 형용사: 성별/복수 변형
    extractSection(html, /Masculine.*singular|M\.\s*sg/i, /Feminine|Plural|$^/i,
      ['gender_m'], variants);
    extractSection(html, /Feminine.*singular|F\.\s*sg/i, /Plural|$^/i,
      ['gender_f'], variants);
    extractSection(html, /Masculine.*plural|M\.\s*pl/i, /Feminine.*plural|$^/i,
      ['plural_m'], variants);
    extractSection(html, /Feminine.*plural|F\.\s*pl/i, /Construct|$^/i,
      ['plural_f'], variants);
  }

  return {
    infinitive: baseForm||'',
    meaning: meaning||'',
    wordType,
    variants,
    variantCount: Object.keys(variants).length
  };
}

function getAllMenukad(html) {
  const forms = [];
  const re = /<span[^>]+class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7]+)<\/span>/g;
  let m;
  while ((m = re.exec(html)) !== null) forms.push(m[1]);
  return forms;
}

// 중복 제거 버전 (현재형, 명령형용)
function extractSection(html, startRe, endRe, keys, variants) {
  const startMatch = html.search(startRe);
  if (startMatch < 0) return;
  const rest = html.slice(startMatch);
  const endMatch = rest.search(endRe);
  const sec = endMatch > 0 ? rest.slice(0, endMatch) : rest;
  const forms = [...new Set(getAllMenukad(sec))];
  forms.slice(0, keys.length).forEach((f, i) => { if (f) variants[keys[i]] = f; });
}

// 중복 허용 버전 (과거형, 미래형용 — 같은 단어가 다른 인칭에 반복됨)
function extractSectionAllowDup(html, startRe, endRe, keys, variants) {
  const startMatch = html.search(startRe);
  if (startMatch < 0) return;
  const rest = html.slice(startMatch);
  const endMatch = rest.search(endRe);
  const sec = endMatch > 0 ? rest.slice(0, endMatch) : rest;
  const forms = getAllMenukad(sec);
  forms.slice(0, keys.length).forEach((f, i) => { if (f) variants[keys[i]] = f; });
}
