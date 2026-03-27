// api/Reverso.js — Reverso Conjugator 기반 히브리어 동사 변형
const enc = s => encodeURIComponent(s);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { mode, verb, url } = req.query;
  try {
    if (mode === 'root_search') {
      if (!req.query.root) return res.status(400).json({ error: '어근을 입력해주세요' });
      const result = await searchPealimByRoot(req.query.root);
      return res.status(200).json(result);
    }
    if (mode !== 'conjugation') return res.status(400).json({ error: 'mode=conjugation 필요' });
    let targetUrl = url;
    if (!targetUrl && verb) {
      targetUrl = `https://conjugator.reverso.net/conjugation-hebrew-verb-${encodeURIComponent(verb.trim())}.html`;
    }
    if (!targetUrl) return res.status(400).json({ error: '동사를 입력해주세요' });
    let html;
    try { html = await fetchPage(targetUrl); }
    catch(e) { return res.status(200).json({ error: `페이지 로드 실패: ${e.message}`, variants:{}, variantCount:0 }); }
    if (!html || html.length < 500) return res.status(200).json({ error: '페이지 없음', variants:{}, variantCount:0 });
    const result = parseReverso(html, verb);
    return res.status(200).json(result);
  } catch(e) {
    return res.status(200).json({ error: e.message, variants:{}, variantCount:0 });
  }
}

async function fetchPage(url) {
  const r = await fetch(url, { headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://conjugator.reverso.net/',
  }});
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

// <li> 안의 히브리어 동사형 추출 (인칭대명사 제외)
const PRONOUNS = new Set([
  'אני','אתה','את','הוא','היא','אנחנו','אתם','אתן','הם','הן',
  'אני/אתה/הוא','אני/את/היא','אנחנו/אתם/הם','אנחנו/אתן/הן',
]);

function extractLiForm(liHtml) {
  // 히브리어 단어들 추출
  const words = liHtml.match(/[\u05D0-\u05EA\u05B0-\u05C7]{2,}/g) || [];
  // 인칭대명사 아닌 첫 번째 단어가 동사형
  const form = words.find(w => !PRONOUNS.has(w));
  if (!form) return null;
  return form.split('/')[0]; // 복수형태(a/b) 중 첫번째
}

function getUlForms(ulHtml) {
  const forms = [];
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = liRe.exec(ulHtml)) !== null) {
    const f = extractLiForm(m[1]);
    if (f) forms.push(f);
  }
  return forms;
}

function parseReverso(html, verbInput) {
  // 1. 인피니티브 추출
  let infinitive = (verbInput || '').trim();
  const h2a = html.match(/<h2[^>]*>\s*<a[^>]*>([\u05D0-\u05EA\u05B0-\u05C7\s]+)<\/a>/);
  if (h2a) infinitive = h2a[1].trim();

  // 2. Reverso HTML 핵심 구조:
  //
  //   <h4></h4>                 ← 빈 h4 (Present 구분자)
  //   <ul>Present 4개</ul>
  //   (h4 없음) Past 텍스트
  //   <ul>Past 10개</ul>
  //   (h4 없음) Future 텍스트
  //   <ul>Future 10개</ul>
  //   <h4>Imperative</h4>
  //   <ul>Imperative 4개</ul>
  //   <h4>Passive Participle</h4>
  //   <h4>Infinitive</h4>
  //   <ul>Infinitive 1개</ul>
  //
  // 핵심: 빈 h4부터 "Similar Hebrew verbs" 사이의 ul 순서로 파싱
  // ul[0]=Present, ul[1]=Past, ul[2]=Future
  // Imperative h4 다음 ul = Imperative
  // Infinitive h4 다음 ul = Infinitive

  // 3. 변형 영역 추출 (빈 h4부터 ~ Similar verbs 앞까지)
  const emptyH4Idx = html.search(/<h4[^>]*>\s*<\/h4>/i);
  const similarIdx = html.search(/Similar Hebrew verbs|Conjugate also/i);
  if (emptyH4Idx < 0) {
    return { infinitive, meaning:'', wordType:'verb', variants:{infinitive}, variantCount:1 };
  }
  const region = html.slice(emptyH4Idx, similarIdx > emptyH4Idx ? similarIdx : html.length);

  // 4. h4 레이블 → 위치 매핑
  const h4Positions = [];
  const h4Re = /<h4[^>]*>([\s\S]*?)<\/h4>/gi;
  let hm;
  while ((hm = h4Re.exec(region)) !== null) {
    const label = hm[1].replace(/<[^>]+>/g,'').trim().toLowerCase();
    h4Positions.push({ label, idx: hm.index, end: hm.index + hm[0].length });
  }

  // 5. ul → 위치 매핑
  const ulPositions = [];
  const ulRe = /<ul[^>]*>([\s\S]*?)<\/ul>/gi;
  let um;
  while ((um = ulRe.exec(region)) !== null) {
    ulPositions.push({ html: um[1], idx: um.index, end: um.index + um[0].length });
  }

  // 6. 순서 기반 파싱
  // 빈 h4 이후 첫 ul = Present, 두번째 ul = Past, 세번째 ul = Future
  // "imperative" h4 다음 ul = Imperative
  // "infinitive" h4 다음 ul = Infinitive
  const imperativeH4 = h4Positions.find(h => h.label === 'imperative');
  const infinitiveH4 = h4Positions.find(h => h.label === 'infinitive');

  // Present/Past/Future: Imperative h4 이전의 ul들
  const preImperativeUls = imperativeH4
    ? ulPositions.filter(u => u.idx < imperativeH4.idx)
    : ulPositions.filter(u => true);

  const presentUl    = preImperativeUls[0] || null;
  const pastUl       = preImperativeUls[1] || null;
  const futureUl     = preImperativeUls[2] || null;

  const imperativeUl = imperativeH4
    ? ulPositions.find(u => u.idx > imperativeH4.end && (!infinitiveH4 || u.idx < infinitiveH4.idx))
    : null;

  const infinitiveUl = infinitiveH4
    ? ulPositions.find(u => u.idx > infinitiveH4.end)
    : null;

  const variants = {};

  // Present (4개: ms, fs, mp, fp)
  if (presentUl) {
    const f = getUlForms(presentUl.html);
    ['pres_ms','pres_fs','pres_mp','pres_fp'].forEach((k,i) => { if(f[i]) variants[k]=f[i]; });
  }

  // Past (10개: 1s, 2ms, 2fs, 3ms, 3fs, 1p, 2mp, 2fp, 3mp, 3fp)
  if (pastUl) {
    const f = getUlForms(pastUl.html);
    ['past_1s','past_2ms','past_2fs','past_3ms','past_3fs','past_1p','past_2mp','past_2fp','past_3mp','past_3fp']
      .forEach((k,i) => { if(f[i]) variants[k]=f[i]; });
  }

  // Future (10개: 같은 순서)
  if (futureUl) {
    const f = getUlForms(futureUl.html);
    ['fut_1s','fut_2ms','fut_2fs','fut_3ms','fut_3fs','fut_1p','fut_2mp','fut_2fp','fut_3mp','fut_3fp']
      .forEach((k,i) => { if(f[i]) variants[k]=f[i]; });
  }

  // Imperative (4개)
  if (imperativeUl) {
    const f = getUlForms(imperativeUl.html);
    ['imp_2ms','imp_2fs','imp_2mp','imp_2fp'].forEach((k,i) => { if(f[i]) variants[k]=f[i]; });
  }

  // Infinitive
  if (infinitiveUl) {
    const f = getUlForms(infinitiveUl.html);
    if(f[0]) variants['infinitive'] = f[0];
  }
  if (!variants['infinitive'] && infinitive) variants['infinitive'] = infinitive;

  return {
    infinitive,
    meaning: '',
    wordType: 'verb',
    variants,
    variantCount: Object.keys(variants).length,
    debug: {
      ulCount: ulPositions.length,
      preImperativeUlCount: preImperativeUls.length,
      hasPresent: !!presentUl,
      hasPast: !!pastUl,
      hasFuture: !!futureUl,
      hasImperative: !!imperativeUl,
      hasInfinitive: !!infinitiveUl,
    }
  };
}


// ── Pealim 어근 검색 ──
async function searchPealimByRoot(root) {
  try {
    // 닉쿠드·공백·구분자 제거 후 자음만 추출
    const clean = root.replace(/[֑-ׇ\s\-–—]/g, '');
    const parts = [...clean].filter(c => /[א-ת]/.test(c));
    if (parts.length < 2) return { error: '히브리어 자음 2자 이상 입력해주세요', results: [] };

    const numR = Math.min(parts.length, 4);
    let searchUrl;
    if (numR === 2) searchUrl = `https://www.pealim.com/dict/?num-radicals=2&r1=${enc(parts[0])}&rf=${enc(parts[1])}`;
    else if (numR === 3) searchUrl = `https://www.pealim.com/dict/?num-radicals=3&r1=${enc(parts[0])}&r2=${enc(parts[1])}&rf=${enc(parts[2])}`;
    else searchUrl = `https://www.pealim.com/dict/?num-radicals=4&r1=${enc(parts[0])}&r2=${enc(parts[1])}&r3=${enc(parts[2])}&rf=${enc(parts[3])}`;

    const html = await fetchPage(searchUrl);
    const results = parsePealimResults(html);
    return { results };
  } catch(e) {
    return { error: e.message, results: [] };
  }
}

function parsePealimResults(html) {
  const results = [];
  // pealim 검색결과: /dict/숫자-이름/ 패턴 링크
  const re = /href="(\/dict\/\d+[^"]+)"[\s\S]*?<span[^>]+class="[^"]*menukad[^"]*"[^>]*>([א-תְ-ׇ ]+)<\/span>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const path = m[1].split('?')[0];
    const hebrew = m[2].trim();
    if (results.find(r => r.path === path)) continue;

    // 뜻 추출 — 링크 주변 텍스트
    const snippet = html.slice(Math.max(0, m.index - 100), m.index + 500).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    let meaning = '';
    const toMatch = snippet.match(/\bto\s+[a-z][a-z\s,\/]{1,50}/i);
    if (toMatch) meaning = toMatch[0].trim();
    else {
      const engMatch = snippet.match(/[a-zA-Z][a-zA-Z\s,\/\(\)]{3,50}/);
      if (engMatch && !/pealim|hebrew|dict|conjugation|learning/i.test(engMatch[0])) {
        meaning = engMatch[0].trim();
      }
    }

    // 품사 감지
    let pos = null;
    if (/\bverb\b/i.test(snippet)) pos = 'verb';
    else if (/\bnoun\b/i.test(snippet)) pos = 'noun';
    else if (/\badjective\b/i.test(snippet)) pos = 'adj';
    // URL에서도 힌트
    if (!pos && path.match(/verb/i)) pos = 'verb';

    results.push({ path, hebrew, meaning, pos, url: `https://www.pealim.com${path}` });
  }
  return results.slice(0, 20);
}
