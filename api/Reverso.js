// api/Reverso.js
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
    catch(e) { return res.status(200).json({ error: `로드 실패: ${e.message}`, variants:{}, variantCount:0 }); }
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

// <li> 안에서 동사 형태 추출 (인칭대명사 제외)
function extractForms(ulHtml) {
  const pronouns = new Set([
    'אני','אתה','את','הוא','היא','אנחנו','אתם','אתן','הם','הן',
    'אני/אתה/הוא','אני/את/היא','אנחנו/אתם/הם','אנחנו/אתן/הן'
  ]);
  const forms = [];
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = liRe.exec(ulHtml)) !== null) {
    const words = (m[1].match(/[\u05D0-\u05EA\u05B0-\u05C7]{2,}/g) || []);
    const verb = words.find(w => !pronouns.has(w));
    if (verb) forms.push(verb.split('/')[0]);
  }
  return forms;
}

function parseReverso(html, verbInput) {
  // 1. 인피니티브 추출
  let infinitive = (verbInput || '').trim();
  const h2a = html.match(/<h2[^>]*>\s*<a[^>]*>([\u05D0-\u05EA\u05B0-\u05C7\s]+)<\/a>/);
  if (h2a) infinitive = h2a[1].trim();

  // 2. 실제 Reverso HTML 구조:
  //
  // <h4></h4>          ← 빈 h4 (구분자)
  // <ul>...</ul>       ← 현재형 (Present) — ul #1
  // <ul>...</ul>       ← 과거형 (Past)    — ul #2
  // <ul>...</ul>       ← 미래형 (Future)  — ul #3
  // <h4>Imperative</h4>
  // <ul>...</ul>       ← 명령형
  // <h4>Passive Participle</h4>
  // <h4>Infinitive</h4>
  // <ul>...</ul>       ← 부정사
  //
  // Past/Future는 h4 없이 ul만 연속으로 나옴!

  // h4 목록
  const h4Re = /<h4[^>]*>([\s\S]*?)<\/h4>/gi;
  const h4list = [];
  let hm;
  while ((hm = h4Re.exec(html)) !== null) {
    const label = hm[1].replace(/<[^>]+>/g,'').trim().toLowerCase();
    h4list.push({ label, idx: hm.index, end: hm.index + hm[0].length });
  }

  // ul 목록
  const ulRe = /<ul[^>]*>([\s\S]*?)<\/ul>/gi;
  const ulList = [];
  let um;
  while ((um = ulRe.exec(html)) !== null) {
    ulList.push({ content: um[1], idx: um.index, end: um.index + um[0].length });
  }

  // 빈 h4 찾기 (변형 테이블 시작점)
  const emptyH4 = h4list.find(h => h.label === '');
  // Imperative h4 찾기
  const impH4 = h4list.find(h => h.label.includes('imperative'));
  // Passive h4 찾기
  const passH4 = h4list.find(h => h.label.includes('passive'));
  // Infinitive h4 찾기
  const infH4 = h4list.find(h => h.label.includes('infinitive'));

  const sectionUls = {};

  if (emptyH4 && impH4) {
    // 빈 h4 ~ Imperative h4 사이의 ul들 = Present, Past, Future 순서
    const mainUls = ulList.filter(u => u.idx > emptyH4.end && u.idx < impH4.idx);
    if (mainUls[0]) sectionUls.present = mainUls[0].content;
    if (mainUls[1]) sectionUls.past    = mainUls[1].content;
    if (mainUls[2]) sectionUls.future  = mainUls[2].content;
  }

  if (impH4) {
    const nextH4 = passH4 || infH4;
    const impEnd = nextH4 ? nextH4.idx : html.length;
    const impUls = ulList.filter(u => u.idx > impH4.end && u.idx < impEnd);
    if (impUls[0]) sectionUls.imperative = impUls[0].content;
  }

  if (infH4) {
    const infUls = ulList.filter(u => u.idx > infH4.end);
    if (infUls[0]) sectionUls.infinitive = infUls[0].content;
  }

  // 3. 변형 추출
  const variants = {};
  const MAP = {
    present:    ['pres_ms','pres_fs','pres_mp','pres_fp'],
    past:       ['past_1s','past_2ms','past_2fs','past_3ms','past_3fs','past_1p','past_2mp','past_2fp','past_3mp','past_3fp'],
    future:     ['fut_1s','fut_2ms','fut_2fs','fut_3ms','fut_3fs','fut_1p','fut_2mp','fut_2fp','fut_3mp','fut_3fp'],
    imperative: ['imp_2ms','imp_2fs','imp_2mp','imp_2fp'],
    infinitive: ['infinitive'],
  };

  for (const [sec, keys] of Object.entries(MAP)) {
    if (!sectionUls[sec]) continue;
    const f = extractForms(sectionUls[sec]);
    keys.forEach((k, i) => { if (f[i]) variants[k] = f[i]; });
  }
  if (!variants['infinitive'] && infinitive) variants['infinitive'] = infinitive;

  return {
    infinitive,
    meaning: '',
    wordType: 'verb',
    variants,
    variantCount: Object.keys(variants).length,
    debug: {
      sections: Object.keys(sectionUls),
      h4labels: h4list.map(h => h.label),
      mainUlCount: emptyH4 && impH4 ? ulList.filter(u => u.idx > emptyH4.end && u.idx < impH4.idx).length : 0
    }
  };
}
