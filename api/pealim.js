// api/pealim.js — Vercel Serverless Function
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { mode, root, url } = req.query;

  try {
    if (mode === 'search') {
      if (!root) return res.status(400).json({ error: '어근을 입력해주세요' });

      // 어근에서 자음만 추출 (닉쿠드, 공백, 구분자 제거)
      const clean = root.replace(/[\u0591-\u05C7\s\-–—]/g, '');
      const parts = clean.split('').filter(c => /[\u05D0-\u05EA]/.test(c));

      if (parts.length < 2) return res.status(400).json({ error: '히브리어 자음을 2자 이상 입력해주세요' });

      // pealim 검색 URL
      let searchUrl;
      if (parts.length === 2) {
        searchUrl = `https://www.pealim.com/dict/?num-radicals=2&r1=${encodeURIComponent(parts[0])}&rf=${encodeURIComponent(parts[1])}`;
      } else if (parts.length === 3) {
        searchUrl = `https://www.pealim.com/dict/?num-radicals=3&r1=${encodeURIComponent(parts[0])}&r2=${encodeURIComponent(parts[1])}&rf=${encodeURIComponent(parts[2])}`;
      } else {
        searchUrl = `https://www.pealim.com/dict/?num-radicals=4&r1=${encodeURIComponent(parts[0])}&r2=${encodeURIComponent(parts[1])}&r3=${encodeURIComponent(parts[2])}&rf=${encodeURIComponent(parts[3])}`;
      }

      const response = await fetch(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      const html = await response.text();

      // 검색 결과 파싱
      const results = [];
      // pealim의 검색 결과 링크 패턴
      const linkRegex = /href="(\/dict\/[\w-]+\/)"[^>]*>\s*<span[^>]*class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7 ]+)<\/span>/g;
      let m;
      while ((m = linkRegex.exec(html)) !== null) {
        const path = m[1];
        const hebrew = m[2].trim();
        if (!results.find(r => r.path === path)) {
          results.push({ path, hebrew, url: `https://www.pealim.com${path}` });
        }
      }

      // 대안 패턴
      if (results.length === 0) {
        const alt = /href="(\/dict\/\d+-[^"\/]+\/)"[\s\S]*?<span[^>]*class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7 ]+)<\/span>/g;
        while ((m = alt.exec(html)) !== null) {
          const path = m[1];
          const hebrew = m[2].trim();
          if (!results.find(r => r.path === path)) {
            results.push({ path, hebrew, url: `https://www.pealim.com${path}` });
          }
        }
      }

      return res.status(200).json({ results: results.slice(0, 12), searchUrl });

    } else if (mode === 'conjugation') {
      if (!url || !url.includes('pealim.com')) {
        return res.status(400).json({ error: '올바른 pealim URL이 필요해요' });
      }

      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      const html = await response.text();

      // 인피니티브 추출 (h1 태그)
      const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
      const h1Text = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : '';
      // "לְדַבֵּר – to speak" 형태에서 히브리어 추출
      const infHebrew = (h1Text.match(/^([\u05D0-\u05EA\u05B0-\u05C7 ]+)/) || [])[1]?.trim() || '';

      // 의미 추출 (to speak, to talk 형태)
      const meaningSection = html.match(/###\s*Meaning[\s\S]*?\n(.*?)\n/);
      const meaningFromMeta = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/);
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
      let meaning = '';
      if (meaningSection) meaning = meaningSection[1].trim();
      else if (titleMatch) {
        // "לדבר – to speak, to talk – Hebrew conjugation tables"
        const m2 = titleMatch[1].match(/–\s*([^–]+)\s*–/);
        if (m2) meaning = m2[1].trim();
      }

      // 변형 파싱 — pealim의 실제 HTML 구조 기반
      const variants = {};

      // 방법 1: data-* 속성 방식 (최신 pealim)
      const dataFormRegex = /data-conjugation="([^"]+)"[\s\S]*?<span[^>]*class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7]+)<\/span>/g;
      let dm;
      while ((dm = dataFormRegex.exec(html)) !== null) {
        const form = dm[1].toUpperCase();
        const hebrew = dm[2];
        const mapped = mapForm(form);
        if (mapped) variants[mapped] = hebrew;
      }

      // 방법 2: 테이블 셀 기반 파싱 (pealim의 주요 방식)
      if (Object.keys(variants).length < 5) {
        parseTableBased(html, variants);
      }

      // 방법 3: 섹션 기반 파싱
      if (Object.keys(variants).length < 5) {
        parseSectionBased(html, variants);
      }

      return res.status(200).json({
        infinitive: infHebrew,
        meaning,
        variants,
        variantCount: Object.keys(variants).length
      });

    } else {
      return res.status(400).json({ error: 'mode=search 또는 mode=conjugation 필요' });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message, stack: e.stack });
  }
}

// pealim 변형 코드 → 앱 type 매핑
function mapForm(form) {
  const MAP = {
    // 현재형
    'PRES-M-S': 'pres_ms', 'PRES-F-S': 'pres_fs',
    'PRES-M-P': 'pres_mp', 'PRES-F-P': 'pres_fp',
    'PRESENT-M-S': 'pres_ms', 'PRESENT-F-S': 'pres_fs',
    'PRESENT-M-P': 'pres_mp', 'PRESENT-F-P': 'pres_fp',
    // 과거형
    'PAST-1-S': 'past_1s', 'PAST-2-M-S': 'past_2ms', 'PAST-2-F-S': 'past_2fs',
    'PAST-3-M-S': 'past_3ms', 'PAST-3-F-S': 'past_3fs',
    'PAST-1-P': 'past_1p', 'PAST-2-M-P': 'past_2mp', 'PAST-2-F-P': 'past_2fp',
    'PAST-3-P': 'past_3mp', 'PAST-3-M-P': 'past_3mp', 'PAST-3-F-P': 'past_3fp',
    // 미래형
    'FUTURE-1-S': 'fut_1s', 'FUT-1-S': 'fut_1s',
    'FUTURE-2-M-S': 'fut_2ms', 'FUT-2-M-S': 'fut_2ms',
    'FUTURE-2-F-S': 'fut_2fs', 'FUT-2-F-S': 'fut_2fs',
    'FUTURE-3-M-S': 'fut_3ms', 'FUT-3-M-S': 'fut_3ms',
    'FUTURE-3-F-S': 'fut_3fs', 'FUT-3-F-S': 'fut_3fs',
    'FUTURE-1-P': 'fut_1p', 'FUT-1-P': 'fut_1p',
    'FUTURE-2-M-P': 'fut_2mp', 'FUT-2-M-P': 'fut_2mp',
    'FUTURE-2-F-P': 'fut_2fp', 'FUT-2-F-P': 'fut_2fp',
    'FUTURE-3-M-P': 'fut_3mp', 'FUT-3-M-P': 'fut_3mp',
    'FUTURE-3-F-P': 'fut_3fp', 'FUT-3-F-P': 'fut_3fp',
    // 명령형
    'IMPER-2-M-S': 'imp_2ms', 'IMP-2-M-S': 'imp_2ms',
    'IMPER-2-F-S': 'imp_2fs', 'IMP-2-F-S': 'imp_2fs',
    'IMPER-2-M-P': 'imp_2mp', 'IMP-2-M-P': 'imp_2mp',
    'IMPER-2-F-P': 'imp_2fp', 'IMP-2-F-P': 'imp_2fp',
    'IMPERATIVE-M-S': 'imp_2ms', 'IMPERATIVE-F-S': 'imp_2fs',
    'IMPERATIVE-M-P': 'imp_2mp', 'IMPERATIVE-F-P': 'imp_2fp',
    // 인피니티브
    'INF': 'infinitive', 'INFINITIVE': 'infinitive',
  };
  return MAP[form] || null;
}

// 테이블 기반 파싱 — pealim의 실제 구조
function parseTableBased(html, variants) {
  // pealim 현재형 테이블 패턴
  extractSection(html, 'Present tense', ['pres_ms','pres_fs','pres_mp','pres_fp'], variants);
  // 과거형
  extractSection(html, 'Past tense', [
    'past_1s','past_2ms','past_2fs','past_3ms','past_3fs',
    'past_1p','past_2mp','past_2fp','past_3mp','past_3fp'
  ], variants);
  // 미래형
  extractSection(html, 'Future tense', [
    'fut_1s','fut_2ms','fut_2fs','fut_3ms','fut_3fs',
    'fut_1p','fut_2mp','fut_2fp','fut_3mp','fut_3fp'
  ], variants);
  // 명령형
  extractSection(html, 'Imperative', ['imp_2ms','imp_2fs','imp_2mp','imp_2fp'], variants);
  // 인피니티브
  extractSection(html, 'Infinitive', ['infinitive'], variants);
}

function extractSection(html, sectionName, keys, variants) {
  const escapedName = sectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sectionRegex = new RegExp(escapedName + '[\\s\\S]*?(?=' +
    ['Present tense','Past tense','Future tense','Imperative','Infinitive','Passive']
      .filter(s=>s!==sectionName).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|') +
    '|<\\/table>|$)', 'i');
  const section = html.match(sectionRegex);
  if (!section) return;

  const forms = extractHebrewForms(section[0]);
  // 중복 제거 후 순서대로 매핑
  const unique = [...new Set(forms)];
  unique.forEach((form, i) => {
    if (i < keys.length && form && !variants[keys[i]]) {
      variants[keys[i]] = form;
    }
  });
}

function extractHebrewForms(html) {
  const forms = [];
  // menukad span에서 추출
  const re = /<span[^>]*class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7]+)<\/span>/g;
  let m;
  while ((m = re.exec(html)) !== null) forms.push(m[1]);
  // ~ 로 구분된 두 번째 형태(without nikud) 제거
  return forms;
}

function parseSectionBased(html, variants) {
  // 전체 HTML에서 모든 menukad span 순서대로 추출
  const allForms = extractHebrewForms(html);
  // pealim의 일반적인 순서: 현재(4) → 과거(10~14) → 미래(10) → 명령(4) → 인피(1)
  const ORDER = [
    'pres_ms','pres_fs','pres_mp','pres_fp',
    'past_1s','past_2ms','past_2fs','past_3ms','past_3fs','past_1p','past_2mp','past_2fp','past_3mp','past_3fp',
    'fut_1s','fut_2ms','fut_2fs','fut_3ms','fut_3fs','fut_1p','fut_2mp','fut_2fp','fut_3mp','fut_3fp',
    'imp_2ms','imp_2fs','imp_2mp','imp_2fp',
    'infinitive'
  ];
  allForms.forEach((form, i) => {
    if (i < ORDER.length && !variants[ORDER[i]]) {
      variants[ORDER[i]] = form;
    }
  });
}
