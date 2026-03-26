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

// ── 검색 결과 파싱 — 히브리어 + 뜻 포함 ──
function parseSearchResults(html) {
  const results = [];

  // pealim 검색결과: 각 단어 카드 블록 파싱
  // 패턴: 링크 → menukad span (히브리어) → 영어 뜻
  const cardRe = /href="(\/dict\/[\d]+[^"]+)"[^>]*>([\s\S]*?)(?=href="\/dict\/|$)/g;
  let m;
  while ((m = cardRe.exec(html)) !== null) {
    const path = m[1].split('"')[0];
    const block = m[2];

    // 히브리어 (menukad)
    const hebMatch = block.match(/<span[^>]+class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7 ]+)<\/span>/);
    if (!hebMatch) continue;
    const hebrew = hebMatch[1].trim();

    // 영어 뜻 — pealim은 카드에 "to speak, to talk" 형태로 표시
    let meaning = '';
    // 방법1: <em> 태그 안의 뜻
    const emMatch = block.match(/<em[^>]*>([^<]+)<\/em>/);
    if (emMatch) meaning = emMatch[1].trim();
    // 방법2: "to " 로 시작하는 텍스트
    if (!meaning) {
      const toMatch = block.match(/\bto\s+[a-z][^<,;]{1,40}/i);
      if (toMatch) meaning = toMatch[0].trim();
    }
    // 방법3: 링크 텍스트에서 영어 부분 추출
    if (!meaning) {
      const engMatch = block.replace(/<[^>]+>/g, ' ').match(/[a-zA-Z][a-zA-Z\s,\/]{4,50}/);
      if (engMatch) meaning = engMatch[0].trim().replace(/\s+/g,' ');
    }

    if (!results.find(r => r.path === path)) {
      results.push({ path, hebrew, meaning, url: `https://www.pealim.com${path}` });
    }
  }

  // 대안 파싱
  if (!results.length) {
    const re2 = /href="(\/dict\/\d+[^"]+)"[\s\S]*?<span[^>]+class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7 ]+)<\/span>/g;
    while ((m = re2.exec(html)) !== null) {
      const path = m[1];
      const hebrew = m[2].trim();
      if (!results.find(r => r.path === path)) {
        results.push({ path, hebrew, meaning: '', url: `https://www.pealim.com${path}` });
      }
    }
  }
  return results;
}

// ── 변형 파싱 ──
function parseConjugation(html) {
  // 제목에서 인피니티브 + 의미 추출
  let infinitive = '';
  let meaning = '';

  // title 태그: "לדבר – to speak, to talk – Hebrew conjugation tables"
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
  if (titleMatch) {
    const t = titleMatch[1];
    const dashParts = t.split(/\s*[\u2013\u2014-]\s*/);
    // 마지막 "Hebrew conjugation tables" 제거
    const filtered = dashParts.filter(p => !/conjugation|tables/i.test(p));
    // 영어 뜻 = "to ..." 형태
    const meaningPart = filtered.find(p => /\bto\b/i.test(p));
    if (meaningPart) meaning = meaningPart.trim();
  }

  // h1에서 닉쿠드 포함 인피니티브
  const h1Match = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/);
  if (h1Match) {
    const hebSpan = h1Match[0].match(/<span[^>]+class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7]+)<\/span>/);
    if (hebSpan) infinitive = hebSpan[1].trim();
  }

  // Active 섹션만 사용 (Passive 제외)
  const activeHtml = html.split(/Passive forms|Binyan Pu.al|Binyan Huf.al/i)[0];

  const variants = {};
  extractPresent(activeHtml, variants);
  extractPast(activeHtml, variants);
  extractFuture(activeHtml, variants);
  extractImperative(activeHtml, variants);
  extractInfinitive(activeHtml, variants, infinitive);

  return { infinitive, meaning, variants, variantCount: Object.keys(variants).length };
}

function getMenukad(html) {
  const forms = [];
  const re = /<span[^>]+class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7]+)<\/span>/g;
  let m;
  while ((m = re.exec(html)) !== null) forms.push(m[1]);
  return forms;
}

function extractSection(html, startPattern, endPatterns, keys, variants) {
  const endPat = endPatterns.map(p => p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
  const re = new RegExp(startPattern + '([\\s\\S]*?)(?=' + endPat + '|$)', 'i');
  const sec = html.match(re);
  if (!sec) return;
  const forms = [...new Set(getMenukad(sec[1]))];
  forms.slice(0, keys.length).forEach((f, i) => { if (f && !variants[keys[i]]) variants[keys[i]] = f; });
}

function extractPresent(html, variants) {
  extractSection(html, 'Present tense', ['Past tense','Future tense','Imperative','Infinitive'],
    ['pres_ms','pres_fs','pres_mp','pres_fp'], variants);
}

function extractPast(html, variants) {
  // pealim 과거형 순서: 1s, 1p, 2ms, 2fs, 2mp, 2fp, 3ms, 3fs, 3p
  extractSection(html, 'Past tense', ['Future tense','Imperative','Infinitive'],
    ['past_1s','past_1p','past_2ms','past_2fs','past_2mp','past_2fp','past_3ms','past_3fs','past_3mp','past_3fp'], variants);
}

function extractFuture(html, variants) {
  extractSection(html, 'Future tense', ['Imperative','Infinitive'],
    ['fut_1s','fut_2ms','fut_2fs','fut_3ms','fut_3fs','fut_1p','fut_2mp','fut_2fp','fut_3mp','fut_3fp'], variants);
}

function extractImperative(html, variants) {
  extractSection(html, 'Imperative', ['Infinitive'],
    ['imp_2ms','imp_2fs','imp_2mp','imp_2fp'], variants);
}

function extractInfinitive(html, variants, fallback) {
  const re = /Infinitive([\s\S]*?)(?=###|Active forms|Passive|<\/section>|$)/i;
  const sec = html.match(re);
  if (sec) {
    const forms = getMenukad(sec[1]);
    if (forms[0]) { variants['infinitive'] = forms[0]; return; }
  }
  if (fallback) variants['infinitive'] = fallback;
}
