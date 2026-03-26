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
    // 뜻 추출 — 링크 주변 텍스트에서
    const snippet = html.slice(Math.max(0, m.index - 100), m.index + 300).replace(/<[^>]+>/g, ' ');
    const toMatch = snippet.match(/\bto\s+[a-z][a-z\s,\/]{1,40}/i);
    const meaning = toMatch ? toMatch[0].trim() : '';
    results.push({ path, hebrew, meaning, url: `https://www.pealim.com${path}` });
  }
  return results;
}

function parseConjugation(html) {
  // 인피니티브
  let infinitive = '';
  let meaning = '';
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
  if (titleMatch) {
    const dashParts = titleMatch[1].split(/\s*[\u2013\u2014\-]\s*/);
    const meaningPart = dashParts.find(p => /\bto\b/i.test(p));
    if (meaningPart) meaning = meaningPart.trim();
  }
  const headMatch = html.match(/<h[12][^>]*>[\s\S]*?<\/h[12]>/);
  if (headMatch) {
    const hs = headMatch[0].match(/<span[^>]+class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7]+)<\/span>/);
    if (hs) infinitive = hs[1].trim();
  }
  if (!infinitive) {
    const fm = html.match(/<span[^>]+class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7]+)<\/span>/);
    if (fm) infinitive = fm[1].trim();
  }

  // Active 섹션만 사용
  const activeHtml = html.split(/Passive forms|Binyan Pu.al|Binyan Huf.al/i)[0];

  const variants = {};

  // 현재형 — "Present tense / Participle" 혹은 "Present tense"
  extractSection(activeHtml, /Present tense[^<]*/i,
    /Past tense|Future tense|Imperative|Infinitive/i,
    ['pres_ms','pres_fs','pres_mp','pres_fp'], variants);

  // 과거형 — 중복 허용 (같은 형태가 다른 인칭에 올 수 있음)
  // pealim 테이블 행 순서: 1sg|1pl, 2msg|2fsg|2mpl|2fpl, 3msg|3fsg|3pl
  extractSectionAllowDup(activeHtml, /Past tense/i,
    /Future tense|Imperative|Infinitive/i,
    ['past_1s','past_1p','past_2ms','past_2fs','past_2mp','past_2fp','past_3ms','past_3fs','past_3mp'], variants);

  // 미래형 — 반드시 중복 허용 (테이블에 같은 형태 반복)
  extractSectionAllowDup(activeHtml, /Future tense/i,
    /Imperative|Infinitive/i,
    ['fut_1s','fut_2ms','fut_2fs','fut_3ms','fut_3fs','fut_1p','fut_2mp','fut_2fp','fut_3mp','fut_3fp'], variants);

  // 명령형
  extractSection(activeHtml, /Imperative/i,
    /Infinitive|Active forms|$^/i,
    ['imp_2ms','imp_2fs','imp_2mp','imp_2fp'], variants);

  // 인피니티브
  const infSec = activeHtml.match(/Infinitive([\s\S]*?)(?=<\/table>|<\/section>|Active forms|$)/i);
  if (infSec) {
    const forms = getAllMenukad(infSec[1]);
    if (forms[0]) variants['infinitive'] = forms[0];
  }
  if (!variants['infinitive'] && infinitive) variants['infinitive'] = infinitive;

  return { infinitive: infinitive||'', meaning: meaning||'', variants, variantCount: Object.keys(variants).length };
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
