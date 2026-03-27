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

// <li> 안의 히브리어 형태 추출
// Reverso: <li><i>אני</i><b>שַׁרְתִּי</b> sharti<br>...</li>
function extractLiHebrewForms(html) {
  const pronouns = new Set(['אני','אתה','את','הוא','היא','אנחנו','אתם','אתן','הם','הן',
    'אני/אתה/הוא','אני/את/היא','אנחנו/אתם/הם','אנחנו/אתן/הן',
    'ani','ata','at','hu','hi','anakhnu','atem','aten','hem','hen']);
  const forms = [];
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = liRe.exec(html)) !== null) {
    const li = m[1];
    // 히브리어 단어들 모두 추출 (닉쿠드 포함)
    const hebrewWords = li.match(/[\u05D0-\u05EA\u05B0-\u05C7]{2,}/g) || [];
    // 인칭 대명사 제외하고 첫 번째 = 동사 형태
    const verbForm = hebrewWords.find(w => !pronouns.has(w));
    if (verbForm) forms.push(verbForm.split('/')[0]);
  }
  return forms;
}

function parseReverso(html, verbInput) {
  // 1. 인피니티브 추출
  let infinitive = (verbInput || '').trim();
  const h2a = html.match(/<h2[^>]*>\s*<a[^>]*>([\u05D0-\u05EA\u05B0-\u05C7\s]+)<\/a>/);
  if (h2a) infinitive = h2a[1].trim();

  // 2. 섹션별 HTML 분리
  // Reverso HTML 구조: <h4> 태그로 섹션 구분 + <ul> 안에 <li> 목록
  // Present는 빈 <h4></h4> 뒤에 별도 ul로 오거나,
  // <h4>Past</h4>, <h4>Future</h4> 등으로 구분됨

  // h4 태그 위치 찾기
  const h4Re = /<h4[^>]*>([\s\S]*?)<\/h4>/gi;
  const h4list = [];
  let hm;
  while ((hm = h4Re.exec(html)) !== null) {
    const label = hm[1].replace(/<[^>]+>/g, '').trim();
    h4list.push({ label, idx: hm.index, end: hm.index + hm[0].length });
  }

  // ul 태그 위치 찾기
  const ulRe = /<ul[^>]*>([\s\S]*?)<\/ul>/gi;
  const ulList = [];
  let um;
  while ((um = ulRe.exec(html)) !== null) {
    ulList.push({ html: um[1], idx: um.index });
  }

  // 각 섹션의 ul 매핑
  // h4 직후에 오는 ul이 해당 섹션의 데이터
  const SECTION_LABELS = {
    '': 'present',           // 빈 h4 = Present
    'present': 'present',
    'past': 'past',
    'future': 'future',
    'imperative': 'imperative',
    'passive participle': 'passive',
    'infinitive': 'infinitive',
  };

  const sectionUls = {};

  for (let i = 0; i < h4list.length; i++) {
    const h4 = h4list[i];
    const labelKey = h4.label.toLowerCase();
    const secName = SECTION_LABELS[labelKey];
    if (!secName || secName === 'passive') continue;

    // 이 h4 다음에 오는 ul 찾기
    const nextH4idx = i + 1 < h4list.length ? h4list[i+1].idx : html.length;
    const ul = ulList.find(u => u.idx > h4.end && u.idx < nextH4idx);
    if (ul) {
      if (!sectionUls[secName]) sectionUls[secName] = '';
      sectionUls[secName] += ul.html;
    }
  }

  // 변형 추출
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
    const f = extractLiHebrewForms('<ul>' + sectionUls[sec] + '</ul>');
    keys.forEach((k, i) => { if (f[i]) variants[k] = f[i]; });
  }
  if (!variants['infinitive'] && infinitive) variants['infinitive'] = infinitive;

  return {
    infinitive,
    meaning: '',
    wordType: 'verb',
    variants,
    variantCount: Object.keys(variants).length,
    debug: { sections: Object.keys(sectionUls), h4labels: h4list.map(h=>h.label) }
  };
}
