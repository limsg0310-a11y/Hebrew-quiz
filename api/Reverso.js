// api/pealim.js — Reverso Conjugator 기반
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { mode, verb, url } = req.query;

  try {
    if (mode === 'conjugation') {
      let targetUrl = url;
      if (!targetUrl && verb) {
        const v = verb.trim();
        targetUrl = `https://conjugator.reverso.net/conjugation-hebrew-verb-${encodeURIComponent(v)}.html`;
      }
      if (!targetUrl) return res.status(400).json({ error: '동사를 입력해주세요' });

      let html;
      try {
        html = await fetchPage(targetUrl);
      } catch(e) {
        return res.status(200).json({ error: `페이지를 가져올 수 없어요: ${e.message}`, variants: {}, variantCount: 0 });
      }

      // HTML 응답인지 확인 (에러 페이지 감지)
      if (!html || html.length < 500 || !html.includes('conjugat')) {
        return res.status(200).json({ error: '변형 페이지를 찾을 수 없어요. 동사 철자를 확인해주세요.', variants: {}, variantCount: 0 });
      }

      const result = parseReverso(html, verb);
      return res.status(200).json(result);

    } else {
      return res.status(400).json({ error: 'mode=conjugation 필요' });
    }
  } catch (e) {
    // 항상 JSON 반환 (HTML 에러 방지)
    return res.status(200).json({ error: e.message, variants: {}, variantCount: 0 });
  }
}

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://conjugator.reverso.net/',
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return text;
}

function parseReverso(html, verbInput) {
  // 1. 인피니티브 추출
  let infinitive = (verbInput||'').trim();
  // h2 안의 히브리어
  const h2m = html.match(/<h2[^>]*>[\s\S]*?<a[^>]*>([\u05D0-\u05EA\u05B0-\u05C7\s]+)<\/a>/);
  if (h2m) infinitive = h2m[1].trim();
  if (!infinitive || infinitive.length < 2) {
    const hm = html.match(/[\u05D0-\u05EA\u05B0-\u05C7]{2,}/);
    if (hm) infinitive = hm[0];
  }

  // 2. 섹션별로 HTML 분리
  // Reverso 구조: Present / Past / Future / Imperative / Infinitive 섹션
  const sections = extractReversoSections(html);

  const variants = {};

  // 현재형 (4개)
  if (sections.present) {
    const f = extractLiForms(sections.present);
    ['pres_ms','pres_fs','pres_mp','pres_fp'].forEach((k,i) => { if(f[i]) variants[k]=f[i]; });
  }
  // 과거형 (10개) — Reverso 순서: 1s,2ms,2fs,3ms,3fs,1p,2mp,2fp,3mp,3fp
  if (sections.past) {
    const f = extractLiForms(sections.past);
    ['past_1s','past_2ms','past_2fs','past_3ms','past_3fs','past_1p','past_2mp','past_2fp','past_3mp','past_3fp']
      .forEach((k,i) => { if(f[i]) variants[k]=f[i]; });
  }
  // 미래형 (10개) — 같은 순서
  if (sections.future) {
    const f = extractLiForms(sections.future);
    ['fut_1s','fut_2ms','fut_2fs','fut_3ms','fut_3fs','fut_1p','fut_2mp','fut_2fp','fut_3mp','fut_3fp']
      .forEach((k,i) => { if(f[i]) variants[k]=f[i]; });
  }
  // 명령형 (4개)
  if (sections.imperative) {
    const f = extractLiForms(sections.imperative);
    ['imp_2ms','imp_2fs','imp_2mp','imp_2fp'].forEach((k,i) => { if(f[i]) variants[k]=f[i]; });
  }
  // 인피니티브
  if (sections.infinitive) {
    const f = extractLiForms(sections.infinitive);
    if(f[0]) variants['infinitive'] = f[0];
  }
  if (!variants['infinitive'] && infinitive) variants['infinitive'] = infinitive;

  return {
    infinitive: infinitive||'',
    meaning: '',
    wordType: 'verb',
    variants,
    variantCount: Object.keys(variants).length
  };
}

// Reverso HTML을 섹션별로 분리
function extractReversoSections(html) {
  const result = {};

  // Reverso 섹션 구조:
  // <ul class="wrap-three-col"> 또는 <ul class="...">
  // 각 섹션 앞에 #### Present / #### Past 등 텍스트가 있음
  // 또는 <div> 안에 섹션 헤더가 있음

  // 방법 1: #### 기반 분리
  const parts = html.split(/####\s*/);
  if (parts.length > 1) {
    for (const part of parts) {
      if (/^Present/i.test(part)) result.present = part;
      else if (/^Past/i.test(part)) result.past = part;
      else if (/^Future/i.test(part)) result.future = part;
      else if (/^Imperative/i.test(part)) result.imperative = part;
      else if (/^Infinitive/i.test(part)) result.infinitive = part;
    }
  }

  // 방법 2: 텍스트 위치 기반 분리
  if (!Object.keys(result).length) {
    const keywords = [
      { key: 'present',    re: /\bPresent\b/i },
      { key: 'past',       re: /\bPast\b/i },
      { key: 'future',     re: /\bFuture\b/i },
      { key: 'imperative', re: /\bImperative\b/i },
      { key: 'infinitive', re: /\bInfinitive\b/i },
    ];

    const positions = keywords
      .map(({ key, re }) => ({ key, idx: html.search(re) }))
      .filter(({ idx }) => idx >= 0)
      .sort((a, b) => a.idx - b.idx);

    for (let i = 0; i < positions.length; i++) {
      const start = positions[i].idx;
      const end = i + 1 < positions.length ? positions[i + 1].idx : html.length;
      result[positions[i].key] = html.slice(start, end);
    }
  }

  return result;
}

// <li> 안의 히브리어 form 추출
function extractLiForms(sectionHtml) {
  const forms = [];
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = liRe.exec(sectionHtml)) !== null) {
    const li = m[1];
    // Reverso: <b>히브리어</b> 또는 <strong>히브리어</strong>
    const boldM = li.match(/<(?:b|strong)[^>]*>([\u05D0-\u05EA\u05B0-\u05C7\s\/\-]+)<\/(?:b|strong)>/);
    if (boldM) {
      // "/" 로 구분된 복수 형태 중 첫 번째 사용
      const form = boldM[1].split('/')[0].trim().replace(/[\s\u200F]/g, '');
      if (form && /[\u05D0-\u05EA]/.test(form)) forms.push(form);
    }
  }
  return forms;
}
