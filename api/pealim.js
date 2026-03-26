// api/pealim.js — Vercel Serverless Function
// pealim.com 페이지를 서버에서 가져와서 파싱 후 반환

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { mode, root, url } = req.query;

  try {
    if (mode === 'search') {
      // 어근으로 검색 — r1, r2, r3 (3자 어근) 또는 r1, r2 (2자 어근)
      const parts = root ? root.split(/[-–—\s]+/).filter(Boolean) : [];
      if (parts.length < 2) {
        return res.status(400).json({ error: '어근을 2자 이상 입력해주세요 (예: ד-ב-ר)' });
      }

      let searchUrl;
      if (parts.length === 2) {
        searchUrl = `https://www.pealim.com/dict/?num-radicals=2&r1=${encodeURIComponent(parts[0])}&rf=${encodeURIComponent(parts[1])}`;
      } else {
        searchUrl = `https://www.pealim.com/dict/?num-radicals=3&r1=${encodeURIComponent(parts[0])}&r2=${encodeURIComponent(parts[1])}&rf=${encodeURIComponent(parts[2])}`;
      }

      const response = await fetch(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Hebrew-Quiz-App/1.0)' }
      });
      const html = await response.text();

      // 검색 결과 파싱 — 동사 링크 추출
      const results = [];
      const linkRegex = /href="(\/dict\/[^"]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7]+)<\/span>[\s\S]*?<\/a>/g;
      let m;
      while ((m = linkRegex.exec(html)) !== null) {
        const path = m[1];
        const hebrew = m[2];
        if (!results.find(r => r.path === path)) {
          results.push({ path, hebrew, url: `https://www.pealim.com${path}` });
        }
      }

      // 대안 파싱 — 더 넓은 패턴
      if (results.length === 0) {
        const altRegex = /href="(\/dict\/\d+-[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
        while ((m = altRegex.exec(html)) !== null) {
          const path = m[1];
          const inner = m[2].replace(/<[^>]+>/g, '').trim();
          const hebrewMatch = inner.match(/[\u05D0-\u05EA\u05B0-\u05C7\s]+/);
          if (hebrewMatch && !results.find(r => r.path === path)) {
            results.push({ path, hebrew: hebrewMatch[0].trim(), url: `https://www.pealim.com${path}` });
          }
        }
      }

      return res.status(200).json({ results: results.slice(0, 10) });

    } else if (mode === 'conjugation') {
      // 특정 동사 변형 테이블 가져오기
      if (!url || !url.includes('pealim.com')) {
        return res.status(400).json({ error: '올바른 pealim URL이 필요해요' });
      }

      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Hebrew-Quiz-App/1.0)' }
      });
      const html = await response.text();

      // 기본 정보 추출
      const meaningMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
      const meaning = meaningMatch
        ? meaningMatch[1].replace(/<[^>]+>/g, '').trim()
        : '';

      // 인피니티브 추출
      const infMatch = html.match(/Infinitive[\s\S]*?<span[^>]*class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7]+)<\/span>/);
      const infinitive = infMatch ? infMatch[1] : '';

      // 변형 테이블 파싱
      // pealim의 HTML 구조: data-* 속성에 변형 정보가 있음
      const variants = {};

      // 패턴: 각 셀에서 히브리어 형태 추출
      // pealim은 <span class="menukad"> 안에 닉쿠드 포함 형태를 씀
      const cellRegex = /data-form="([^"]+)"[\s\S]*?<span[^>]*class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7]+)<\/span>/g;
      let cm;
      while ((cm = cellRegex.exec(html)) !== null) {
        const formAttr = cm[1]; // e.g. "PRES-M-S", "PAST-1-S", "FUTURE-2-M-S"
        const hebrewForm = cm[2];
        const mapped = mapPealimForm(formAttr);
        if (mapped) variants[mapped] = hebrewForm;
      }

      // data-form 없을 경우 위치 기반 파싱
      if (Object.keys(variants).length === 0) {
        parseByPosition(html, variants);
      }

      return res.status(200).json({ meaning, infinitive, variants });

    } else {
      return res.status(400).json({ error: 'mode=search 또는 mode=conjugation 필요' });
    }

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

// pealim data-form 속성 → 앱 variant type 매핑
function mapPealimForm(form) {
  const f = form.toUpperCase();
  const map = {
    'INFINITIVE':    'infinitive',
    'PRES-M-S':      'pres_ms',
    'PRES-F-S':      'pres_fs',
    'PRES-M-P':      'pres_mp',
    'PRES-F-P':      'pres_fp',
    'PAST-1-S':      'past_1s',
    'PAST-2-M-S':    'past_2ms',
    'PAST-2-F-S':    'past_2fs',
    'PAST-3-M-S':    'past_3ms',
    'PAST-3-F-S':    'past_3fs',
    'PAST-1-P':      'past_1p',
    'PAST-2-M-P':    'past_2mp',
    'PAST-2-F-P':    'past_2fp',
    'PAST-3-P':      'past_3mp',
    'PAST-3-M-P':    'past_3mp',
    'PAST-3-F-P':    'past_3fp',
    'FUTURE-1-S':    'fut_1s',
    'FUTURE-2-M-S':  'fut_2ms',
    'FUTURE-2-F-S':  'fut_2fs',
    'FUTURE-3-M-S':  'fut_3ms',
    'FUTURE-3-F-S':  'fut_3fs',
    'FUTURE-1-P':    'fut_1p',
    'FUTURE-2-M-P':  'fut_2mp',
    'FUTURE-2-F-P':  'fut_2fp',
    'FUTURE-3-M-P':  'fut_3mp',
    'FUTURE-3-F-P':  'fut_3fp',
    'IMPER-2-M-S':   'imp_2ms',
    'IMPER-2-F-S':   'imp_2fs',
    'IMPER-2-M-P':   'imp_2mp',
    'IMPER-2-F-P':   'imp_2fp',
  };
  return map[f] || null;
}

// 위치 기반 파싱 (data-form 없을 때 fallback)
function parseByPosition(html, variants) {
  // 현재형 섹션
  const presSection = html.match(/Present tense[\s\S]*?(?=Past tense|$)/i);
  if (presSection) {
    const forms = extractForms(presSection[0]);
    const presKeys = ['pres_ms','pres_fs','pres_mp','pres_fp'];
    forms.slice(0,4).forEach((f,i) => { if(f && presKeys[i]) variants[presKeys[i]] = f; });
  }
  // 과거형
  const pastSection = html.match(/Past tense[\s\S]*?(?=Future tense|$)/i);
  if (pastSection) {
    const forms = extractForms(pastSection[0]);
    const pastKeys = ['past_1s','past_2ms','past_2fs','past_3ms','past_3fs','past_1p','past_2mp','past_2fp','past_3mp','past_3fp'];
    forms.slice(0,10).forEach((f,i) => { if(f && pastKeys[i]) variants[pastKeys[i]] = f; });
  }
  // 미래형
  const futSection = html.match(/Future tense[\s\S]*?(?=Imperative|$)/i);
  if (futSection) {
    const forms = extractForms(futSection[0]);
    const futKeys = ['fut_1s','fut_2ms','fut_2fs','fut_3ms','fut_3fs','fut_1p','fut_2mp','fut_2fp','fut_3mp','fut_3fp'];
    forms.slice(0,10).forEach((f,i) => { if(f && futKeys[i]) variants[futKeys[i]] = f; });
  }
  // 명령형
  const impSection = html.match(/Imperative[\s\S]*?(?=Infinitive|$)/i);
  if (impSection) {
    const forms = extractForms(impSection[0]);
    const impKeys = ['imp_2ms','imp_2fs','imp_2mp','imp_2fp'];
    forms.slice(0,4).forEach((f,i) => { if(f && impKeys[i]) variants[impKeys[i]] = f; });
  }
  // 인피니티브
  const infSection = html.match(/Infinitive[\s\S]*?(?=<\/table>|$)/i);
  if (infSection) {
    const forms = extractForms(infSection[0]);
    if (forms[0]) variants['infinitive'] = forms[0];
  }
}

function extractForms(html) {
  const forms = [];
  const re = /<span[^>]*class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7]+)<\/span>/g;
  let m;
  while ((m = re.exec(html)) !== null) forms.push(m[1]);
  return forms;
}
