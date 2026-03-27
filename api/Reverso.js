// api/Reverso.js — Reverso Conjugator 기반
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { mode, verb, url } = req.query;
  try {
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

function parseReverso(html, verbInput) {
  // 1. 인피니티브 추출
  let infinitive = (verbInput || '').trim();
  const h2a = html.match(/<h2[^>]*>\s*<a[^>]*>([\u05D0-\u05EA\u05B0-\u05C7\s]+)<\/a>/);
  if (h2a) infinitive = h2a[1].trim();

  // 2. HTML → 텍스트 변환 (히브리어 bold는 ** 로 보존)
  const text = html
    .replace(/<(?:b|strong)[^>]*>([\u05D0-\u05EA\u05B0-\u05C7\/\-\s]+)<\/(?:b|strong)>/gi,
      (_, m) => `**${m.trim()}**`)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ');

  // 3. 섹션 분리
  // Reverso 구조:
  //   #### \n\n Present  (Present/Past/Future는 #### 뒤 새 줄에 위치)
  //   Past               (#### 없이 그냥 텍스트)
  //   Future
  //   #### Imperative    (#### 바로 뒤에 단어)
  //   #### Infinitive
  const MARKERS = [
    { key:'present',    re:/(?:####\s*\n+\s*|^|\n\s*)Present(?:\s|\/)/im },
    { key:'past',       re:/(?:^|\n\s*)Past(?:\s|$)/im },
    { key:'future',     re:/(?:^|\n\s*)Future(?:\s|$)/im },
    { key:'imperative', re:/(?:####\s*)Imperative(?:\s|$)/im },
    { key:'infinitive', re:/(?:####\s*)Infinitive(?:\s|$)/im },
  ];

  const positions = [];
  for (const { key, re } of MARKERS) {
    const m = text.search(re);
    if (m >= 0) positions.push({ key, idx: m });
  }
  positions.sort((a, b) => a.idx - b.idx);

  const sections = {};
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].idx;
    const end = i + 1 < positions.length ? positions[i+1].idx : text.length;
    sections[positions[i].key] = text.slice(start, end);
  }

  // 4. ** 패턴으로 히브리어 형태 추출
  function extractBold(t) {
    const forms = [];
    const re = /\*\*([\u05D0-\u05EA\u05B0-\u05C7\/\-\s]+)\*\*/g;
    let m;
    while ((m = re.exec(t)) !== null) {
      const form = m[1].split('/')[0].replace(/\s/g,'').trim();
      if (form && form.length > 1 && /[\u05D0-\u05EA]/.test(form)) forms.push(form);
    }
    return forms;
  }

  const variants = {};
  const SECTION_KEYS = {
    present:    ['pres_ms','pres_fs','pres_mp','pres_fp'],
    past:       ['past_1s','past_2ms','past_2fs','past_3ms','past_3fs','past_1p','past_2mp','past_2fp','past_3mp','past_3fp'],
    future:     ['fut_1s','fut_2ms','fut_2fs','fut_3ms','fut_3fs','fut_1p','fut_2mp','fut_2fp','fut_3mp','fut_3fp'],
    imperative: ['imp_2ms','imp_2fs','imp_2mp','imp_2fp'],
    infinitive: ['infinitive'],
  };

  for (const [sec, keys] of Object.entries(SECTION_KEYS)) {
    if (!sections[sec]) continue;
    const f = extractBold(sections[sec]);
    keys.forEach((k, i) => { if (f[i]) variants[k] = f[i]; });
  }
  if (!variants['infinitive'] && infinitive) variants['infinitive'] = infinitive;

  return { infinitive, meaning:'', wordType:'verb', variants, variantCount: Object.keys(variants).length };
}
