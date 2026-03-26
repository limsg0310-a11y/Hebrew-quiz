// api/pealim.js — Vercel Serverless Function
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  const { mode, root, url } = req.query;
  try {
    if (mode === 'search') {
      if (!root) return res.status(400).json({ error: '어근을 입력해주세요' });

      const clean = root.replace(/[\u0591-\u05C7\s\-\u2013\u2014]/g, '');
      const parts = [...clean].filter(c => /[\u05D0-\u05EA]/.test(c));
      if (parts.length < 2) return res.status(400).json({ error: '히브리어 자음 2자 이상 입력해주세요' });

      const numR = Math.min(parts.length, 4);
      let searchUrl;
      if (numR === 2) searchUrl = `https://www.pealim.com/dict/?num-radicals=2&r1=${enc(parts[0])}&rf=${enc(parts[1])}`;
      else if (numR === 3) searchUrl = `https://www.pealim.com/dict/?num-radicals=3&r1=${enc(parts[0])}&r2=${enc(parts[1])}&rf=${enc(parts[2])}`;
      else searchUrl = `https://www.pealim.com/dict/?num-radicals=4&r1=${enc(parts[0])}&r2=${enc(parts[1])}&r3=${enc(parts[2])}&rf=${enc(parts[3])}`;

      const html = await fetchPage(searchUrl);
      const results = parseSearchResults(html);

      // 결과가 없으면 디버그 정보 반환
      if (!results.length) {
        const dictLinks = (html.match(/href="\/dict\/\d+[^"]+"/g) || []).length;
        const menukadCount = (html.match(/class="[^"]*menukad[^"]*"/g) || []).length;
        return res.status(200).json({
          results: [],
          debug: { searchUrl, dictLinks, menukadCount, htmlLength: html.length }
        });
      }

      return res.status(200).json({ results: results.slice(0, 15) });

    } else if (mode === 'conjugation') {
      if (!url || !url.includes('pealim.com')) return res.status(400).json({ error: '올바른 pealim URL이 필요해요' });
      const html = await fetchPage(url);
      const result = parseConjugation(html);
      return res.status(200).json(result);

    } else {
      return res.status(400).json({ error: 'mode 파라미터가 필요해요' });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

const enc = s => encodeURIComponent(s);

async function fetchPage(url) {
  const res = await fetch(url, { headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
  }});
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

// 🔊 이모티콘 뒤 히브리어 추출
function extractSpeakerForms(text) {
  const forms = [];
  const re = /\uD83D\uDD0A\s*([\u05D0-\u05EA\u05B0-\u05C7!‏\s]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const cleaned = m[1].replace(/[!\u200F\s]/g, '').trim();
    if (cleaned.length > 0 && /[\u05D0-\u05EA]/.test(cleaned)) forms.push(cleaned);
  }
  return forms;
}

// 섹션 텍스트 추출
function getSectionText(text, startKw, endKws) {
  const idx = text.indexOf(startKw);
  if (idx < 0) return '';
  let end = text.length;
  for (const kw of endKws) {
    const i = text.indexOf(kw, idx + startKw.length);
    if (i > idx && i < end) end = i;
  }
  return text.slice(idx, end);
}

// ── 검색 결과 파싱 ──
function parseSearchResults(html) {
  const results = [];

  // pealim 검색결과: /dict/숫자-이름/ 패턴 링크
  // 각 링크 주변에서 히브리어(menukad) + 뜻 추출
  const re = /href="(\/dict\/(\d+)-([^"\/]+)\/?)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const path = m[1].endsWith('/') ? m[1] : m[1] + '/';
    if (results.find(r => r.path === path)) continue;

    // 링크 주변 600자
    const around = html.slice(Math.max(0, m.index - 100), m.index + 600);

    // 히브리어 추출 (3가지 방법)
    let hebrew = '';

    // 1. menukad span
    const mnMatch = around.match(/<span[^>]*class="[^"]*menukad[^"]*"[^>]*>([\u05D0-\u05EA\u05B0-\u05C7 ]+)<\/span>/);
    if (mnMatch) hebrew = mnMatch[1].trim();

    // 2. 🔊 뒤 히브리어
    if (!hebrew) {
      const sf = extractSpeakerForms(around);
      if (sf[0]) hebrew = sf[0];
    }

    // 3. 링크 텍스트 자체에서 히브리어
    if (!hebrew) {
      const linkText = around.match(new RegExp(`href="${path.replace(/\//g,'\\/')}[^>]*>([\\s\\S]*?)<\\/a>`));
      if (linkText) {
        const heb = linkText[1].match(/[\u05D0-\u05EA\u05B0-\u05C7]+/);
        if (heb) hebrew = heb[0];
      }
    }

    if (!hebrew) continue;

    // 뜻 추출
    const plain = around.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    let meaning = '';
    const toM = plain.match(/\bto\s+[a-z][a-z\s,\/]{1,50}/i);
    if (toM) meaning = toM[0].trim();
    else {
      const engM = plain.match(/[a-zA-Z][a-zA-Z\s,\/\(\)]{3,50}/);
      if (engM && !/pealim|hebrew|dict|conjugation|learning|language|menu|class|style|nav|div|span|href|src/i.test(engM[0])) {
        meaning = engM[0].trim();
      }
    }

    results.push({ path, hebrew, meaning, url: `https://www.pealim.com${path}` });
  }

  return results;
}

// ── 변형 파싱 ──
function parseConjugation(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ');

  // 기본형 추출 — "Conjugation of לְדַבֵּר"
  let baseForm = '';
  // "Conjugation of לְדַבֵּר" 또는 "Inflection of בַּיִת" 패턴
  const conjMatch = text.match(/(?:Conjugation|Inflection|Forms) of\s+([\u05D0-\u05EA\u05B0-\u05C7]+)/);
  if (conjMatch) baseForm = conjMatch[1].trim();
  // h2 태그에서 직접 추출
  if (!baseForm) {
    const h2Match = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    if (h2Match) {
      const hebM = h2Match[1].match(/[\u05D0-\u05EA\u05B0-\u05C7]{2,}/);
      if (hebM) baseForm = hebM[0].trim();
    }
  }
  if (!baseForm) {
    const firstForms = extractSpeakerForms(text);
    if (firstForms[0]) baseForm = firstForms[0];
  }

  // 뜻 추출
  let meaning = '';
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/);
  if (titleMatch) {
    const dashParts = titleMatch[1].split(/\s*[\u2013\u2014\-]\s*/).map(p => p.trim()).filter(Boolean);
    const candidates = dashParts.filter(p =>
      !/conjugation|inflection|tables|pealim/i.test(p) &&
      !/^[\u05D0-\u05EA\u05B0-\u05C7\s]+$/.test(p)
    );
    if (candidates.length > 0) meaning = candidates[0].trim();
  }

  // 품사 감지
  let wordType = 'verb';
  const posM = text.match(/Part of speech[:\s]*(verb|noun|adjective|adverb|preposition|pronoun)/i)
    || text.match(/\b(Verb|Noun|Adjective)\s*[\u2013\u2014\-]/i);
  if (posM) {
    const pos = (posM[1]||'').toLowerCase();
    if (pos === 'noun') wordType = 'noun';
    else if (pos === 'adjective') wordType = 'adj';
    else if (!['verb'].includes(pos)) wordType = 'other';
  }

  // Active 섹션만 (Passive 제외)
  const passIdx = text.search(/Passive forms|Binyan Pu.al|Binyan Huf.al/i);
  const activeText = passIdx > 0 ? text.slice(0, passIdx) : text;

  const variants = {};

  if (wordType === 'verb') {
    // "Present tense / Participle" 또는 "Present tense" 둘 다 처리
    const presStart = ['Present tense / Participle', 'Present tense'].find(k => activeText.includes(k)) || 'Present tense';
    const presText = getSectionText(activeText, presStart, ['Past tense','Future tense','Imperative','Infinitive']);
    if (presText) {
      const f = [...new Set(extractSpeakerForms(presText))];
      ['pres_ms','pres_fs','pres_mp','pres_fp'].forEach((k,i) => { if (f[i]) variants[k] = f[i]; });
    }

    const pastText = getSectionText(activeText, 'Past tense', ['Future tense','Imperative','Infinitive']);
    if (pastText) {
      const f = extractSpeakerForms(pastText);
      ['past_1s','past_1p','past_2ms','past_2fs','past_2mp','past_2fp','past_3ms','past_3fs','past_3mp','past_3fp']
        .forEach((k,i) => { if (f[i]) variants[k] = f[i]; });
    }

    const futText = getSectionText(activeText, 'Future tense', ['Imperative','Infinitive']);
    if (futText) {
      const f = extractSpeakerForms(futText);
      ['fut_1s','fut_2ms','fut_2fs','fut_3ms','fut_3fs','fut_1p','fut_2mp','fut_2fp','fut_3mp','fut_3fp']
        .forEach((k,i) => { if (f[i]) variants[k] = f[i]; });
    }

    const impText = getSectionText(activeText, 'Imperative', ['Infinitive','See also']);
    if (impText) {
      const f = [...new Set(extractSpeakerForms(impText))];
      ['imp_2ms','imp_2fs','imp_2mp','imp_2fp'].forEach((k,i) => { if (f[i]) variants[k] = f[i]; });
    }

    const infText = getSectionText(activeText, 'Infinitive', ['See also','Passive']);
    if (infText) {
      const f = extractSpeakerForms(infText);
      if (f[0]) variants['infinitive'] = f[0];
    }
    if (!variants['infinitive'] && baseForm) variants['infinitive'] = baseForm;

  } else if (wordType === 'noun') {
    const singText = getSectionText(text, 'Singular', ['Plural','Dual','See also']);
    if (singText) {
      const f = [...new Set(extractSpeakerForms(singText))];
      if (f[0]) variants['gender_m'] = f[0];
      if (f[1]) variants['gender_f'] = f[1];
    }
    const plText = getSectionText(text, 'Plural', ['Dual','Construct','See also']);
    if (plText) {
      const f = [...new Set(extractSpeakerForms(plText))];
      if (f[0]) variants['plural_m'] = f[0];
      if (f[1]) variants['plural_f'] = f[1];
    }

  } else if (wordType === 'adj') {
    const f = [...new Set(extractSpeakerForms(activeText))];
    ['gender_m','gender_f','plural_m','plural_f'].forEach((k,i) => { if (f[i]) variants[k] = f[i]; });
  }

  // 디버그: 섹션 감지 여부
  const sectionDebug = {
    present: activeText.includes('Present tense'),
    past: activeText.includes('Past tense'),
    future: activeText.includes('Future tense'),
    imperative: activeText.includes('Imperative'),
    infinitive: activeText.includes('Infinitive'),
    speakerCount: extractSpeakerForms(activeText).length,
    activeLen: activeText.length,
  };

  return {
    infinitive: baseForm||'',
    meaning: meaning||'',
    wordType,
    variants,
    variantCount: Object.keys(variants).length,
    debug: sectionDebug
  };
}
