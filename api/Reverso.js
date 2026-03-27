// api/Reverso.js — Reverso Conjugator 기반 히브리어 동사 변형
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { mode, verb, url } = req.query;

  try {
    if (mode !== 'conjugation') {
      return res.status(400).json({ error: 'mode=conjugation 필요' });
    }

    let targetUrl = url;
    if (!targetUrl && verb) {
      targetUrl = `https://conjugator.reverso.net/conjugation-hebrew-verb-${encodeURIComponent(verb.trim())}.html`;
    }
    if (!targetUrl) return res.status(400).json({ error: '동사를 입력해주세요' });

    let html;
    try {
      html = await fetchPage(targetUrl);
    } catch(e) {
      return res.status(200).json({ error: `페이지 로드 실패: ${e.message}`, variants: {}, variantCount: 0 });
    }

    if (!html || html.length < 500) {
      return res.status(200).json({ error: '페이지를 불러오지 못했어요', variants: {}, variantCount: 0 });
    }

    const result = parseReverso(html, verb);
    return res.status(200).json(result);

  } catch(e) {
    return res.status(200).json({ error: e.message, variants: {}, variantCount: 0 });
  }
}

async function fetchPage(url) {
  const r = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://conjugator.reverso.net/',
    }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

function parseReverso(html, verbInput) {
  // ── 1. 인피니티브 추출 ──
  // Reverso HTML: <h2><a href="...">לָשִׁיר</a></h2>
  let infinitive = (verbInput || '').trim();
  const h2a = html.match(/<h2[^>]*>\s*<a[^>]*>([\u05D0-\u05EA\u05B0-\u05C7\s]+)<\/a>/);
  if (h2a) infinitive = h2a[1].trim();
  if (!infinitive) {
    // 제목에서 히브리어 추출
    const titleH = html.match(/<title[^>]*>Conjugation[^<]*([\u05D0-\u05EA\u05B0-\u05C7]+)/);
    if (titleH) infinitive = titleH[1].trim();
  }

  // ── 2. 뜻 추출 ──
  // Reverso는 자체적으로 영어 뜻을 제공하지 않으므로 빈 문자열
  const meaning = '';

  // ── 3. 섹션별 분리 ──
  // Reverso HTML 실제 구조:
  // <h4 class="...">Present</h4>
  // <ul class="wrap-three-col">
  //   <li><i>אני/אתה/הוא</i><b>שָׁר</b> shar</li>
  // </ul>
  const sections = {};
  const sectionNames = ['Present','Past','Future','Imperative','Infinitive'];

  // <h3>/<h4> 태그로 섹션 분리
  const hTagRe = /<h[34][^>]*>([\s\S]*?)<\/h[34]>/gi;
  let hm;
  const headerPositions = [];
  while ((hm = hTagRe.exec(html)) !== null) {
    const text = hm[1].replace(/<[^>]+>/g, '').trim();
    for (const name of sectionNames) {
      if (text.toLowerCase().includes(name.toLowerCase())) {
        headerPositions.push({ name: name.toLowerCase(), idx: hm.index + hm[0].length });
        break;
      }
    }
  }

  // 각 섹션 내용 추출 (헤더 다음 ~ 다음 헤더 전)
  for (let i = 0; i < headerPositions.length; i++) {
    const start = headerPositions[i].idx;
    const end = i + 1 < headerPositions.length ? headerPositions[i+1].idx : html.length;
    sections[headerPositions[i].name] = html.slice(start, end);
  }

  // h4 못 찾으면 텍스트 위치로 폴백
  if (!Object.keys(sections).length) {
    for (const name of sectionNames) {
      const re = new RegExp(name, 'i');
      const idx = html.search(re);
      if (idx >= 0) {
        const others = sectionNames
          .filter(n => n !== name)
          .map(n => html.search(new RegExp(n, 'i')))
          .filter(i => i > idx);
        const end = others.length ? Math.min(...others) : html.length;
        sections[name.toLowerCase()] = html.slice(idx, end);
      }
    }
  }

  // ── 4. 각 섹션에서 히브리어 형태 추출 ──
  const variants = {};

  if (sections.present) {
    const f = extractForms(sections.present);
    ['pres_ms','pres_fs','pres_mp','pres_fp'].forEach((k,i) => { if(f[i]) variants[k]=f[i]; });
  }
  if (sections.past) {
    const f = extractForms(sections.past);
    // Reverso 과거 순서: 1s, 2ms, 2fs, 3ms, 3fs, 1p, 2mp, 2fp, 3mp, 3fp
    ['past_1s','past_2ms','past_2fs','past_3ms','past_3fs','past_1p','past_2mp','past_2fp','past_3mp','past_3fp']
      .forEach((k,i) => { if(f[i]) variants[k]=f[i]; });
  }
  if (sections.future) {
    const f = extractForms(sections.future);
    ['fut_1s','fut_2ms','fut_2fs','fut_3ms','fut_3fs','fut_1p','fut_2mp','fut_2fp','fut_3mp','fut_3fp']
      .forEach((k,i) => { if(f[i]) variants[k]=f[i]; });
  }
  if (sections.imperative) {
    const f = extractForms(sections.imperative);
    ['imp_2ms','imp_2fs','imp_2mp','imp_2fp'].forEach((k,i) => { if(f[i]) variants[k]=f[i]; });
  }
  if (sections.infinitive) {
    const f = extractForms(sections.infinitive);
    if(f[0]) variants['infinitive'] = f[0];
  }
  if (!variants['infinitive'] && infinitive) variants['infinitive'] = infinitive;

  return { infinitive, meaning, wordType:'verb', variants, variantCount: Object.keys(variants).length };
}

// 섹션 HTML에서 히브리어 활용형 추출
function extractForms(html) {
  const forms = [];

  // 방법 1: <li> 안의 <b> 또는 <strong>
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = liRe.exec(html)) !== null) {
    const li = m[1];
    // <b>히브리어</b>
    const bm = li.match(/<(?:b|strong)[^>]*>([\u05D0-\u05EA\u05B0-\u05C7\/\-\s]+)<\/(?:b|strong)>/);
    if (bm) {
      const form = bm[1].split('/')[0].replace(/\s/g,'').trim();
      if (form && /[\u05D0-\u05EA]/.test(form)) { forms.push(form); continue; }
    }
    // <b> 없으면 li 내 히브리어 패턴
    const hebs = li.match(/[\u05D0-\u05EA\u05B0-\u05C7]{2,}/g);
    if (hebs) {
      // 인칭대명사 제외 후 마지막 히브리어가 활용형
      const pronouns = new Set(['אני','אתה','את','הוא','היא','אנחנו','אתם','אתן','הם','הן']);
      const verbForms = hebs.filter(h => !pronouns.has(h));
      if (verbForms.length) forms.push(verbForms[0]);
    }
  }

  // 방법 2: li 없으면 ** markdown ** 패턴
  if (!forms.length) {
    const boldRe = /\*\*([\u05D0-\u05EA\u05B0-\u05C7\/\-\s]+)\*\*/g;
    while ((m = boldRe.exec(html)) !== null) {
      const form = m[1].split('/')[0].replace(/\s/g,'').trim();
      if (form && /[\u05D0-\u05EA]/.test(form)) forms.push(form);
    }
  }

  // 방법 3: 모든 히브리어 단어 순서대로 (인칭대명사 제외)
  if (!forms.length) {
    const pronouns = new Set(['אני','אתה','את','הוא','היא','אנחנו','אתם','אתן','הם','הן']);
    const all = html.match(/[\u05D0-\u05EA\u05B0-\u05C7]{2,}/g) || [];
    all.filter(h => !pronouns.has(h)).forEach(h => forms.push(h));
  }

  return forms;
}
