// api/Reverso.js
const enc = s => encodeURIComponent(s);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { mode, verb, url, root, q } = req.query;
  try {
    if (mode === 'root_search') {
      if (!root) return res.status(400).json({ error: '어근을 입력해주세요' });
      const result = await searchPealimByRoot(root);
      return res.status(200).json(result);
    }
    if (mode === 'word_search') {
      if (!q) return res.status(400).json({ error: '검색어를 입력해주세요' });
      const result = await searchPealimByMeaning(q);
      return res.status(200).json(result);
    }
    if (mode !== 'conjugation') return res.status(400).json({ error: 'mode=conjugation 필요' });
    let targetUrl = url;
    if (!targetUrl && verb) {
      targetUrl = 'https://conjugator.reverso.net/conjugation-hebrew-verb-' + enc(verb.trim()) + '.html';
    }
    if (!targetUrl) return res.status(400).json({ error: '동사를 입력해주세요' });
    let html;
    try { html = await fetchPage(targetUrl); }
    catch(e) { return res.status(200).json({ error: '페이지 로드 실패: ' + e.message, variants: {}, variantCount: 0 }); }
    if (!html || html.length < 500) return res.status(200).json({ error: '페이지 없음', variants: {}, variantCount: 0 });
    const result = parseReverso(html, verb);
    return res.status(200).json(result);
  } catch(e) {
    return res.status(200).json({ error: e.message, variants: {}, variantCount: 0 });
  }
}

async function fetchPage(url) {
  const r = await fetch(url, { headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://conjugator.reverso.net/',
  }});
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}

// ── Pealim 어근 검색 ──
async function searchPealimByRoot(root) {
  try {
    // 히브리어 자음만 추출
    const parts = [];
    for (const c of root) {
      const code = c.codePointAt(0);
      if (code >= 0x05D0 && code <= 0x05EA) parts.push(c);
    }
    if (parts.length < 2) return { error: '히브리어 자음 2자 이상 입력해주세요', results: [] };

    const numR = Math.min(parts.length, 4);
    let searchUrl;
    if (numR === 2) searchUrl = 'https://www.pealim.com/dict/?num-radicals=2&r1=' + enc(parts[0]) + '&rf=' + enc(parts[1]);
    else if (numR === 3) searchUrl = 'https://www.pealim.com/dict/?num-radicals=3&r1=' + enc(parts[0]) + '&r2=' + enc(parts[1]) + '&rf=' + enc(parts[2]);
    else searchUrl = 'https://www.pealim.com/dict/?num-radicals=4&r1=' + enc(parts[0]) + '&r2=' + enc(parts[1]) + '&r3=' + enc(parts[2]) + '&rf=' + enc(parts[3]);

    const html = await fetchPage(searchUrl);
    const results = parsePealimSearchList(html);

    // 각 단어 페이지에서 뜻 + 품사 병렬로 가져오기
    await Promise.allSettled(results.map(async (r) => {
      try {
        const pageHtml = await fetchPage(r.url);
        // title에서 뜻 추출: "לכתוב – to write – Hebrew conjugation tables"
        const titleMatch = pageHtml.match(/<title[^>]*>([^<]+)<\/title>/);
        if (titleMatch) {
          const titleParts = titleMatch[1].split(/\s*[\u2013\u2014\-]\s*/);
          const meaning = titleParts.find(p =>
            !/conjugation|inflection|tables|pealim/i.test(p) &&
            !/^[\u05D0-\u05EA\u05B0-\u05C7\s]+$/.test(p)
          );
          if (meaning) r.meaning = meaning.trim();
        }
        // 품사 감지
        const posMatch = pageHtml.match(/Part of speech[:\s]*(verb|noun|adjective|adverb|preposition)/i);
        if (posMatch) {
          const p = posMatch[1].toLowerCase();
          r.pos = p === 'adjective' ? 'adj' : p === 'verb' ? 'verb' : p === 'noun' ? 'noun' : 'other';
        }
      } catch(e) { /* 개별 페이지 실패 무시 */ }
    }));

    return { results };
  } catch(e) {
    return { error: e.message, results: [] };
  }
}

function parsePealimSearchList(html) {
  const results = [];
  const linkRe = /href="(\/dict\/\d+[^"]+)"/g;
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    const path = m[1].split('?')[0].replace(/\/$/, '') + '/';
    if (results.find(r => r.path === path)) continue;

    // 히브리어 추출 (menukad span)
    const around = html.slice(Math.max(0, m.index - 50), m.index + 400);
    const hebRe = /<span[^>]*class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7 ]+)<\/span>/;
    const hebMatch = around.match(hebRe);
    if (!hebMatch) continue;

    const hebrew = hebMatch[1].trim();
    results.push({ path, hebrew, meaning: '', pos: null, url: 'https://www.pealim.com' + path });
  }
  return results.slice(0, 15);
}

// ── Reverso 동사 변형 파싱 ──
function parseReverso(html, verbInput) {
  let infinitive = (verbInput || '').trim();
  const h2a = html.match(/<h2[^>]*>\s*<a[^>]*>([\u05D0-\u05EA\u05B0-\u05C7\s]+)<\/a>/);
  if (h2a) infinitive = h2a[1].trim();

  const emptyH4Idx = html.search(/<h4[^>]*>\s*<\/h4>/i);
  const similarIdx = html.search(/Similar Hebrew verbs|Conjugate also/i);
  if (emptyH4Idx < 0) {
    return { infinitive, meaning: '', wordType: 'verb', variants: { infinitive }, variantCount: 1 };
  }
  const region = html.slice(emptyH4Idx, similarIdx > emptyH4Idx ? similarIdx : html.length);

  const h4Positions = [];
  const h4Re = /<h4[^>]*>([\s\S]*?)<\/h4>/gi;
  let hm;
  while ((hm = h4Re.exec(region)) !== null) {
    const label = hm[1].replace(/<[^>]+>/g, '').trim().toLowerCase();
    h4Positions.push({ label, idx: hm.index, end: hm.index + hm[0].length });
  }

  const ulPositions = [];
  const ulRe = /<ul[^>]*>([\s\S]*?)<\/ul>/gi;
  let um;
  while ((um = ulRe.exec(region)) !== null) {
    ulPositions.push({ html: um[1], idx: um.index, end: um.index + um[0].length });
  }

  const imperativeH4 = h4Positions.find(h => h.label === 'imperative');
  const infinitiveH4 = h4Positions.find(h => h.label === 'infinitive');

  const preImperativeUls = imperativeH4
    ? ulPositions.filter(u => u.idx < imperativeH4.idx)
    : ulPositions;

  const presentUl  = preImperativeUls[0] || null;
  const pastUl     = preImperativeUls[1] || null;
  const futureUl   = preImperativeUls[2] || null;
  const imperativeUl = imperativeH4
    ? ulPositions.find(u => u.idx > imperativeH4.end && (!infinitiveH4 || u.idx < infinitiveH4.idx))
    : null;
  const infinitiveUl = infinitiveH4
    ? ulPositions.find(u => u.idx > infinitiveH4.end)
    : null;

  const variants = {};

  if (presentUl) {
    const f = getUlForms(presentUl.html);
    ['pres_ms','pres_fs','pres_mp','pres_fp'].forEach((k,i) => { if(f[i]) variants[k]=f[i]; });
  }
  if (pastUl) {
    const f = getUlForms(pastUl.html);
    ['past_1s','past_2ms','past_2fs','past_3ms','past_3fs','past_1p','past_2mp','past_2fp','past_3mp','past_3fp']
      .forEach((k,i) => { if(f[i]) variants[k]=f[i]; });
  }
  if (futureUl) {
    const f = getUlForms(futureUl.html);
    ['fut_1s','fut_2ms','fut_2fs','fut_3ms','fut_3fs','fut_1p','fut_2mp','fut_2fp','fut_3mp','fut_3fp']
      .forEach((k,i) => { if(f[i]) variants[k]=f[i]; });
  }
  if (imperativeUl) {
    const f = getUlForms(imperativeUl.html);
    ['imp_2ms','imp_2fs','imp_2mp','imp_2fp'].forEach((k,i) => { if(f[i]) variants[k]=f[i]; });
  }
  if (infinitiveUl) {
    const f = getUlForms(infinitiveUl.html);
    if(f[0]) variants['infinitive'] = f[0];
  }
  if (!variants['infinitive'] && infinitive) variants['infinitive'] = infinitive;

  return { infinitive, meaning: '', wordType: 'verb', variants, variantCount: Object.keys(variants).length };
}

const PRONOUNS = new Set([
  'אני','אתה','את','הוא','היא','אנחנו','אתם','אתן','הם','הן',
  'אני/אתה/הוא','אני/את/היא','אנחנו/אתם/הם','אנחנו/אתן/הן',
]);

function extractLiForm(liHtml) {
  const words = liHtml.match(/[\u05D0-\u05EA\u05B0-\u05C7]{2,}/g) || [];
  const form = words.find(w => !PRONOUNS.has(w));
  if (!form) return null;
  return form.split('/')[0];
}

function getUlForms(html) {
  const forms = [];
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = liRe.exec(html)) !== null) {
    const f = extractLiForm(m[1]);
    if (f) forms.push(f);
  }
  return forms;
}


// ── 뜻(한국어/영어)으로 Pealim 검색 ──
async function searchPealimByMeaning(query) {
  try {
    const searchUrl = 'https://www.pealim.com/search/?q=' + enc(query.trim());
    const html = await fetchPage(searchUrl);
    const results = parsePealimSearchList(html);
    if (!results.length) return { results: [] };

    // 각 단어 페이지에서 뜻 병렬 fetch
    await Promise.allSettled(results.map(async (r) => {
      try {
        const pageHtml = await fetchPage(r.url);
        const titleMatch = pageHtml.match(/<title[^>]*>([^<]+)<\/title>/);
        if (titleMatch) {
          const parts = titleMatch[1].split(/\s*[–—\-]\s*/);
          const meaning = parts.find(p =>
            !/conjugation|inflection|tables|pealim/i.test(p) &&
            !/^[א-תְ-ׇ\s]+$/.test(p)
          );
          if (meaning) r.meaning = meaning.trim();
        }
        const binyanMatch = pageHtml.match(/Binyan\s+([\w']+)/i);
        if (binyanMatch) r.pos = 'verb';
        const nounMatch = pageHtml.match(/class="[^"]*noun[^"]*"/i);
        if (nounMatch && !r.pos) r.pos = 'noun';
      } catch(e) {}
    }));

    return { results };
  } catch(e) {
    return { error: e.message, results: [] };
  }
}
