// api/pealim.js — Vercel Serverless Function (Reverso 기반)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  const { mode, verb, url } = req.query;
  try {
    if (mode === 'conjugation') {
      // 동사 직접 입력 또는 URL로 변형 가져오기
      let targetUrl = url;
      if (!targetUrl && verb) {
        const encoded = encodeURIComponent(verb.trim());
        targetUrl = `https://conjugator.reverso.net/conjugation-hebrew-verb-${encoded}.html`;
      }
      if (!targetUrl) return res.status(400).json({ error: '동사 또는 URL이 필요해요' });

      const html = await fetchPage(targetUrl);
      const result = parseReverso(html, verb);
      return res.status(200).json(result);

    } else {
      return res.status(400).json({ error: 'mode=conjugation 필요' });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

async function fetchPage(url) {
  const res = await fetch(url, { headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9',
  }});
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

function parseReverso(html, verbInput) {
  // 1. 인피니티브 추출 — h2 태그 안의 히브리어
  let infinitive = verbInput || '';
  const h2s = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/gi) || [];
  for (const h2 of h2s) {
    const heb = h2.replace(/<[^>]+>/g, '').match(/[\u05D0-\u05EA\u05B0-\u05C7]+/);
    if (heb && heb[0].length > 1) { infinitive = heb[0].trim(); break; }
  }

  // 2. 뜻 추출 — title에서
  let meaning = '';
  const titleM = html.match(/<title[^>]*>([^<]+)<\/title>/);
  if (titleM) {
    // "Conjugation verb לשיר in Hebrew | Reverso Conjugator"
    const t = titleM[1];
    const verbMatch = t.match(/Conjugation (?:verb\s+)?[\u05D0-\u05EA\u05B0-\u05C7\s]+(in\s+Hebrew)?/i);
    // Reverso는 뜻을 title에 포함하지 않으므로 별도 처리 생략
    meaning = '';
  }

  // 3. 변형 파싱 — 섹션별 bold 텍스트 추출
  // HTML에서 태그 제거 후 텍스트로 파싱
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  const variants = {};

  // Reverso는 각 섹션이 명확한 헤더로 구분됨
  // Present / Past / Future / Imperative / Infinitive
  const sections = splitReversoSections(text);

  // 현재형 (4개: 남단수/여단수/남복수/여복수)
  if (sections.present) {
    const forms = extractBoldForms(html, sections.presentRaw);
    const keys = ['pres_ms','pres_fs','pres_mp','pres_fp'];
    forms.slice(0,4).forEach((f,i) => { if(f) variants[keys[i]] = f; });
  }

  // 과거형 (10개)
  // Reverso 순서: 1s, 2ms, 2fs, 3ms, 3fs, 1p, 2mp, 2fp, 3mp, 3fp
  if (sections.past) {
    const forms = extractBoldForms(html, sections.pastRaw);
    ['past_1s','past_2ms','past_2fs','past_3ms','past_3fs','past_1p','past_2mp','past_2fp','past_3mp','past_3fp']
      .forEach((k,i) => { if(forms[i]) variants[k] = forms[i]; });
  }

  // 미래형 (10개)
  // Reverso 순서: 1s, 2ms, 2fs, 3ms, 3fs, 1p, 2mp, 2fp, 3mp, 3fp
  if (sections.future) {
    const forms = extractBoldForms(html, sections.futureRaw);
    ['fut_1s','fut_2ms','fut_2fs','fut_3ms','fut_3fs','fut_1p','fut_2mp','fut_2fp','fut_3mp','fut_3fp']
      .forEach((k,i) => { if(forms[i]) variants[k] = forms[i]; });
  }

  // 명령형 (4개)
  if (sections.imperative) {
    const forms = extractBoldForms(html, sections.imperativeRaw);
    ['imp_2ms','imp_2fs','imp_2mp','imp_2fp']
      .forEach((k,i) => { if(forms[i]) variants[k] = forms[i]; });
  }

  // 인피니티브
  if (sections.infinitive) {
    const forms = extractBoldForms(html, sections.infinitiveRaw);
    if(forms[0]) variants['infinitive'] = forms[0];
  }
  if(!variants['infinitive'] && infinitive) variants['infinitive'] = infinitive;

  return {
    infinitive: infinitive||'',
    meaning: meaning||'',
    wordType: 'verb',
    variants,
    variantCount: Object.keys(variants).length
  };
}

// Reverso HTML에서 섹션별 원본 HTML 추출
function splitReversoSections(text) {
  const result = {};
  // 섹션 헤더들
  const sectionNames = [
    { key:'present',    patterns:['Present'] },
    { key:'past',       patterns:['Past'] },
    { key:'future',     patterns:['Future'] },
    { key:'imperative', patterns:['Imperative'] },
    { key:'infinitive', patterns:['Infinitive'] },
  ];
  for (const s of sectionNames) {
    for (const pat of s.patterns) {
      if (text.includes(pat)) { result[s.key] = true; break; }
    }
  }
  return result;
}

// HTML에서 특정 섹션의 bold Hebrew forms 추출
function extractBoldForms(html, _unused) {
  // 이 함수는 각 섹션 호출 시 해당 섹션 HTML을 받아야 함
  // 실제로는 아래 extractFromSection에서 처리
  return [];
}

// Reverso HTML 구조에 맞는 실제 파싱
function parseReverso(html, verbInput) {
  let infinitive = verbInput || '';

  // h2에서 인피니티브
  const h2m = html.match(/<h2[^>]*>\s*<a[^>]*>([\u05D0-\u05EA\u05B0-\u05C7]+)<\/a>/);
  if (h2m) infinitive = h2m[1].trim();
  if (!infinitive) {
    const h2any = html.match(/<h2[^>]*>[^<]*<\/h2>/);
    if (h2any) {
      const heb = h2any[0].match(/[\u05D0-\u05EA\u05B0-\u05C7]{2,}/);
      if (heb) infinitive = heb[0];
    }
  }

  const variants = {};

  // Reverso 구조: <ul class="..."> 안에 <li>마다 인칭대명사 + 굵은 히브리어
  // 섹션은 <h3> 또는 <h4> 태그로 구분
  // li 안의 히브리어 bold: <b>שָׁר</b> 또는 **שָׁר** 텍스트
  const hebBold = /<b>([^<]*[\u05D0-\u05EA\u05B0-\u05C7][^<]*)<\/b>/g;
  const hebStrong = /<strong>([^<]*[\u05D0-\u05EA\u05B0-\u05C7][^<]*)<\/strong>/g;

  // 각 섹션 찾기
  const sectionRe = /<[hH][34][^>]*>\s*([^<]+)<\/[hH][34]>|####\s*([^\n]+)|####([^\n]+)/g;
  
  // 방법: li 태그에서 pronoun + bold form 쌍 추출
  // Reverso li 구조: <li><i>pronoun</i><b>form</b>...</li>
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  
  // 전체 li 목록 순서 수집
  const allForms = [];
  let liM;
  while ((liM = liRe.exec(html)) !== null) {
    const liHtml = liM[1];
    // 인칭 대명사 추출
    const pronM = liHtml.match(/<i[^>]*>([\u05D0-\u05EA\u05B0-\u05C7\/\s]+)<\/i>/);
    const pron = pronM ? pronM[1].trim() : '';
    // 히브리어 형태 (첫 번째 Hebrew text in bold or strong)
    const boldM = liHtml.match(/<b[^>]*>([\u05D0-\u05EA\u05B0-\u05C7\/\-\s]+)<\/b>/)
               || liHtml.match(/<strong[^>]*>([\u05D0-\u05EA\u05B0-\u05C7\/\-\s]+)<\/strong>/);
    if (boldM) {
      // 여러 형태가 / 로 구분된 경우 첫 번째만 사용
      const form = boldM[1].split('/')[0].trim();
      if (form && /[\u05D0-\u05EA]/.test(form)) {
        allForms.push({ pron, form });
      }
    }
  }

  // 인칭 대명사로 매핑
  const pronounMap = {
    // 현재형
    'אני/אתה/הוא': 'pres_ms',  'אני/את/היא': 'pres_fs',
    'אנחנו/אתם/הם': 'pres_mp', 'אנחנו/אתן/הן': 'pres_fp',
    // 과거형
    'אני': 'past_1s',    'אתה': 'past_2ms',  'את': 'past_2fs',
    'הוא': 'past_3ms',   'היא': 'past_3fs',   'אנחנו': 'past_1p',
    'אתם': 'past_2mp',   'אתן': 'past_2fp',
    'הם': 'past_3mp',    'הן': 'past_3fp',
    // 미래형 (같은 대명사지만 섹션으로 구분)
  };

  // 섹션별로 처리
  const sections = splitHtmlSections(html);
  
  if (sections.present) {
    const f = extractHebForms(sections.present);
    const keys = ['pres_ms','pres_fs','pres_mp','pres_fp'];
    f.slice(0,4).forEach((v,i) => { if(v) variants[keys[i]] = v; });
  }
  if (sections.past) {
    const f = extractHebForms(sections.past);
    // Reverso 과거 순서: 1s, 2ms, 2fs, 3ms, 3fs, 1p, 2mp, 2fp, 3mp, 3fp
    ['past_1s','past_2ms','past_2fs','past_3ms','past_3fs','past_1p','past_2mp','past_2fp','past_3mp','past_3fp']
      .forEach((k,i) => { if(f[i]) variants[k] = f[i]; });
  }
  if (sections.future) {
    const f = extractHebForms(sections.future);
    ['fut_1s','fut_2ms','fut_2fs','fut_3ms','fut_3fs','fut_1p','fut_2mp','fut_2fp','fut_3mp','fut_3fp']
      .forEach((k,i) => { if(f[i]) variants[k] = f[i]; });
  }
  if (sections.imperative) {
    const f = extractHebForms(sections.imperative);
    ['imp_2ms','imp_2fs','imp_2mp','imp_2fp'].forEach((k,i) => { if(f[i]) variants[k] = f[i]; });
  }
  if (sections.infinitive) {
    const f = extractHebForms(sections.infinitive);
    if(f[0]) variants['infinitive'] = f[0];
  }
  if(!variants['infinitive'] && infinitive) variants['infinitive'] = infinitive;

  return {
    infinitive: infinitive||'',
    meaning: '',
    wordType: 'verb',
    variants,
    variantCount: Object.keys(variants).length
  };
}

// HTML을 섹션별로 분리
function splitHtmlSections(html) {
  const result = {};
  const sectionPatterns = [
    { key:'present',    re:/Present/i },
    { key:'past',       re:/Past/i },
    { key:'future',     re:/Future/i },
    { key:'imperative', re:/Imperative/i },
    { key:'infinitive', re:/Infinitive/i },
  ];
  
  // 섹션 구분: #### 헤더 또는 <h3>/<h4> 태그
  // HTML을 섹션별로 나누기
  const parts = html.split(/(?=####\s|<h[34])/i);
  
  for (const part of parts) {
    for (const { key, re } of sectionPatterns) {
      if (re.test(part.slice(0, 200))) {
        result[key] = part;
        break;
      }
    }
  }
  
  // 섹션 못 찾으면 텍스트 위치로 시도
  if (!Object.keys(result).length) {
    for (const { key, re } of sectionPatterns) {
      const idx = html.search(re);
      if (idx < 0) continue;
      const nextIdx = sectionPatterns
        .filter(s => s.key !== key)
        .map(s => html.search(new RegExp(s.re.source + '[\\s\\S]*?(?=<li)', 'i')))
        .filter(i => i > idx)
        .reduce((a,b) => b < a ? b : a, html.length);
      result[key] = html.slice(idx, nextIdx);
    }
  }
  return result;
}

// 섹션 HTML에서 히브리어 형태 추출
function extractHebForms(sectionHtml) {
  const forms = [];
  // <li> 안의 bold/strong 히브리어
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = liRe.exec(sectionHtml)) !== null) {
    const liContent = m[1];
    const boldM = liContent.match(/<(?:b|strong)[^>]*>([\u05D0-\u05EA\u05B0-\u05C7\s\/\-]+)<\/(?:b|strong)>/);
    if (boldM) {
      const form = boldM[1].split('/')[0].trim();
      if (form && /[\u05D0-\u05EA]/.test(form)) forms.push(form);
    }
  }
  return forms;
}
