// api/pealim.js — Vercel Serverless Function
// pealim.com의 실제 HTML 구조 기반 파서

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { mode, root, url } = req.query;

  try {
    // ── 어근 검색 ──
    if (mode === 'search') {
      if (!root) return res.status(400).json({ error: '어근을 입력해주세요' });

      // 닉쿠드·공백·구분자 제거 후 자음만 추출
      const clean  = root.replace(/[\u0591-\u05C7\s\-–—]/g, '');
      const parts  = [...clean].filter(c => /[\u05D0-\u05EA]/.test(c));

      if (parts.length < 2) return res.status(400).json({ error: '히브리어 자음을 2자 이상 입력해주세요' });

      const numR = Math.min(parts.length, 4);
      const params = new URLSearchParams({ 'num-radicals': numR });
      if (numR >= 1) params.set('r1', parts[0]);
      if (numR >= 2 && numR < 4) params.set('r2', numR === 2 ? '' : parts[1]);
      if (numR === 3) { params.set('r2', parts[1]); params.set('rf', parts[2]); }
      if (numR === 4) { params.set('r2', parts[1]); params.set('r3', parts[2]); params.set('rf', parts[3]); }
      if (numR === 2) { params.set('rf', parts[1]); params.delete('r2'); }

      const searchUrl = `https://www.pealim.com/dict/?${params.toString()}`;
      const html = await fetchPage(searchUrl);

      const results = parseSearchResults(html);
      return res.status(200).json({ results: results.slice(0, 15) });

    // ── 변형 가져오기 ──
    } else if (mode === 'conjugation') {
      if (!url || !url.includes('pealim.com')) {
        return res.status(400).json({ error: '올바른 pealim URL이 필요해요' });
      }

      const html = await fetchPage(url);
      const result = parseConjugation(html);
      return res.status(200).json(result);

    } else {
      return res.status(400).json({ error: 'mode=search 또는 mode=conjugation 필요' });
    }

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// ── HTTP 가져오기 ──
async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

// ── 검색 결과 파싱 ──
function parseSearchResults(html) {
  const results = [];
  // pealim 검색 결과: /dict/숫자-이름/ 패턴
  const re = /href="(\/dict\/\d+[^"]+)"[^>]*>[\s\S]*?<span[^>]+class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7 ]+)<\/span>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const path   = m[1];
    const hebrew = m[2].trim();
    if (!results.find(r => r.path === path)) {
      results.push({ path, hebrew, url: `https://www.pealim.com${path}` });
    }
  }
  return results;
}

// ── 변형 파싱 (pealim 실제 HTML 구조 기반) ──
function parseConjugation(html) {
  // 1. 제목에서 인피니티브 + 의미 추출
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
  let infinitive = '';
  let meaning = '';
  if (titleMatch) {
    // "לדבר – to speak, to talk – Hebrew conjugation tables"
    const parts = titleMatch[1].split('–').map(s => s.trim());
    if (parts.length >= 2) {
      // 히브리어 부분 (with nikud)
      const h1 = html.match(/<h1[^>]*>[\s\S]*?<\/h1>/);
      if (h1) {
        const hebMatch = h1[0].match(/<span[^>]+class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7 ]+)<\/span>/);
        if (hebMatch) infinitive = hebMatch[1].trim();
        else infinitive = parts[0];
      }
      meaning = parts.slice(1, -1).join('–').trim();
    }
  }

  // 2. 모든 <table> 에서 변형 추출
  const variants = {};

  // Active/Passive 섹션 분리
  const activeSection  = html.split(/Passive forms|Binyan Pu.al|Binyan Huf.al|Binyan Nif.al/i)[0];

  // 섹션별 추출
  extractPresent (activeSection, variants);
  extractPast    (activeSection, variants);
  extractFuture  (activeSection, variants);
  extractImperative(activeSection, variants);
  extractInfinitive(activeSection, variants, infinitive);

  return { infinitive, meaning, variants, variantCount: Object.keys(variants).length };
}

// 모든 menukad span에서 히브리어 추출
function getMenukad(html) {
  const forms = [];
  const re = /<span[^>]+class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7]+)<\/span>/g;
  let m;
  while ((m = re.exec(html)) !== null) forms.push(m[1]);
  return forms;
}

// 현재형 파싱
// pealim 구조: Present tense 테이블 — M-sg, F-sg, M-pl, F-pl (4개)
function extractPresent(html, variants) {
  const sectionRe = /Present tense[^<]*<\/[^>]+>([\s\S]*?)(?=Past tense|<\/table>)/i;
  const sec = html.match(sectionRe);
  if (!sec) return;
  const forms = getMenukad(sec[1]);
  const keys = ['pres_ms','pres_fs','pres_mp','pres_fp'];
  // 중복 없애기
  const unique = [...new Set(forms)];
  unique.slice(0,4).forEach((f,i) => { if(f) variants[keys[i]] = f; });
}

// 과거형 파싱
// pealim 구조 (행 순서): 1sg | 1pl, 2msg | 2fsg | 2mpl | 2fpl, 3msg | 3fsg | 3pl
// 실제 순서: 1sg, 2msg, 2fsg, 3msg, 3fsg, 1pl, 2mpl, 2fpl, 3pl
function extractPast(html, variants) {
  const sectionRe = /Past tense([\s\S]*?)(?=Future tense|Infinitive|<\/section>)/i;
  const sec = html.match(sectionRe);
  if (!sec) return;
  const forms = getMenukad(sec[1]);
  // pealim 과거형 테이블 셀 순서 (실제 HTML 기준)
  // Row 1st: [sg], [pl]
  // Row 2nd: [m-sg], [f-sg], [m-pl], [f-pl]
  // Row 3rd: [m-sg], [f-sg], [pl] (또는 [m-pl, f-pl])
  const unique = [...new Set(forms)];
  const keys = ['past_1s','past_2ms','past_2fs','past_3ms','past_3fs','past_1p','past_2mp','past_2fp','past_3mp','past_3fp'];
  // pealim의 실제 출력 순서 맞추기
  // 1s, 1p, 2ms, 2fs, 2mp, 2fp, 3ms, 3fs, 3p (pealim 테이블 순서)
  const pealimOrder = ['past_1s','past_1p','past_2ms','past_2fs','past_2mp','past_2fp','past_3ms','past_3fs','past_3mp','past_3fp'];
  unique.slice(0, pealimOrder.length).forEach((f,i) => { if(f) variants[pealimOrder[i]] = f; });
}

// 미래형 파싱 — 과거형과 유사 구조
function extractFuture(html, variants) {
  const sectionRe = /Future tense([\s\S]*?)(?=Imperative|Infinitive|<\/section>)/i;
  const sec = html.match(sectionRe);
  if (!sec) return;
  const forms = getMenukad(sec[1]);
  const unique = [...new Set(forms)];
  // pealim 미래형 순서: 1s, 2ms, 2fs, 3ms, 3fs, 1p, 2mp, 2fp, 3mp, 3fp
  const pealimOrder = ['fut_1s','fut_2ms','fut_2fs','fut_3ms','fut_3fs','fut_1p','fut_2mp','fut_2fp','fut_3mp','fut_3fp'];
  unique.slice(0, pealimOrder.length).forEach((f,i) => { if(f) variants[pealimOrder[i]] = f; });
}

// 명령형 파싱
function extractImperative(html, variants) {
  const sectionRe = /Imperative([\s\S]*?)(?=Infinitive|<\/section>|<\/table>)/i;
  const sec = html.match(sectionRe);
  if (!sec) return;
  const forms = getMenukad(sec[1]);
  const unique = [...new Set(forms)];
  // pealim 명령형 순서: m-sg, f-sg, m-pl, f-pl
  const keys = ['imp_2ms','imp_2fs','imp_2mp','imp_2fp'];
  unique.slice(0,4).forEach((f,i) => { if(f) variants[keys[i]] = f; });
}

// 인피니티브 파싱
function extractInfinitive(html, variants, fallback) {
  const sectionRe = /Infinitive([\s\S]*?)(?=###|<\/section>|<\/table>|Active forms|Passive)/i;
  const sec = html.match(sectionRe);
  if (sec) {
    const forms = getMenukad(sec[1]);
    if (forms[0]) { variants['infinitive'] = forms[0]; return; }
  }
  if (fallback) variants['infinitive'] = fallback;
}
