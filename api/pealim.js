// api/pealim.js — Vercel Serverless Function
// 🔊 이모티콘 기반 파싱 (pealim의 실제 HTML 구조)

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
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.9',
  }});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// 🔊 이모티콘 뒤 히브리어 추출 (핵심 파싱)
function extractSpeakerForms(text) {
  const forms = [];
  // 🔊 바로 뒤에 오는 히브리어 (닉쿠드 포함)
  const re = /\uD83D\uDD0A\s*([\u05D0-\u05EA\u05B0-\u05C7!‏\s]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    // ! 및 공백 제거, 히브리어만 추출
    const cleaned = m[1].replace(/[!\u200F\s]/g, '').trim();
    if (cleaned.length > 0 && /[\u05D0-\u05EA]/.test(cleaned)) {
      forms.push(cleaned);
    }
  }
  return forms;
}

// 섹션 분리 — 텍스트에서 키워드 찾기
function getSectionText(text, startKeyword, endKeywords) {
  const startIdx = text.indexOf(startKeyword);
  if (startIdx < 0) return '';
  let endIdx = text.length;
  for (const kw of endKeywords) {
    const idx = text.indexOf(kw, startIdx + startKeyword.length);
    if (idx > startIdx && idx < endIdx) endIdx = idx;
  }
  return text.slice(startIdx, endIdx);
}

// ── 검색 결과 파싱 ──
function parseSearchResults(html) {
  // HTML을 텍스트로 변환
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const results = [];
  // 링크 패턴에서 path 추출
  const linkRe = /href="(\/dict\/\d+[^"]+)"/g;
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    const path = m[1];
    if (results.find(r => r.path === path)) continue;
    // 해당 링크 주변의 텍스트에서 히브리어와 뜻 추출
    const around = html.slice(Math.max(0, m.index - 20), m.index + 400);
    const forms = extractSpeakerForms(around);
    const hebrew = forms[0] || '';
    if (!hebrew) continue;
    // 영어 뜻 추출
    const plainAround = around.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    let meaning = '';
    const toMatch = plainAround.match(/\bto\s+[a-z][a-z\s,\/]{1,50}/i);
    if (toMatch) meaning = toMatch[0].trim();
    else {
      const engMatch = plainAround.match(/[a-zA-Z][a-zA-Z\s,\/\(\)]{3,50}/);
      if (engMatch && !/pealim|hebrew|dict|conjugation|learning/i.test(engMatch[0])) {
        meaning = engMatch[0].trim();
      }
    }
    results.push({ path, hebrew, meaning, url: `https://www.pealim.com${path}` });
  }
  return results;
}

// ── 변형 파싱 ──
function parseConjugation(html) {
  // HTML → 텍스트 (태그 제거, 공백 정리)
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ');

  // 1. 사전 기본형 추출 — "Conjugation of לְדַבֵּר" 패턴
  let baseForm = '';
  const conjMatch = text.match(/Conjugation of\s+([\u05D0-\u05EA\u05B0-\u05C7]+)/);
  if (conjMatch) baseForm = conjMatch[1].trim();
  // 폴백: 첫 번째 🔊 형태
  if (!baseForm) {
    const firstForms = extractSpeakerForms(text);
    if (firstForms[0]) baseForm = firstForms[0];
  }

  // 2. 뜻 추출 (title)
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

  // 3. 품사 감지
  let wordType = 'verb';
  const posMatch = text.match(/Part of speech[:\s]*(verb|noun|adjective|adverb|preposition|pronoun)/i)
    || text.match(/\b(Verb|Noun|Adjective)\s*[\u2013\u2014\-]/i);
  if (posMatch) {
    const pos = (posMatch[1]||'').toLowerCase();
    if (pos === 'verb') wordType = 'verb';
    else if (pos === 'noun') wordType = 'noun';
    else if (pos === 'adjective') wordType = 'adj';
    else wordType = 'other';
  }

  // 4. Active 섹션만 사용 (Passive 제외)
  const passiveIdx = text.search(/Passive forms|Binyan Pu.al|Binyan Huf.al/i);
  const activeText = passiveIdx > 0 ? text.slice(0, passiveIdx) : text;

  const variants = {};

  if (wordType === 'verb') {
    // 현재형
    const presText = getSectionText(activeText, 'Present tense', ['Past tense','Future tense','Imperative','Infinitive']);
    if (presText) {
      const forms = extractSpeakerForms(presText);
      const uniq = [...new Set(forms)];
      ['pres_ms','pres_fs','pres_mp','pres_fp'].forEach((k,i) => { if (uniq[i]) variants[k] = uniq[i]; });
    }

    // 과거형 (중복 허용 — 같은 형태가 다른 인칭에 쓰임)
    const pastText = getSectionText(activeText, 'Past tense', ['Future tense','Imperative','Infinitive']);
    if (pastText) {
      const forms = extractSpeakerForms(pastText);
      // pealim 과거 순서: 1s, 1p, 2ms, 2fs, 2mp, 2fp, 3ms, 3fs, 3mp
      ['past_1s','past_1p','past_2ms','past_2fs','past_2mp','past_2fp','past_3ms','past_3fs','past_3mp','past_3fp']
        .forEach((k,i) => { if (forms[i]) variants[k] = forms[i]; });
    }

    // 미래형 (중복 허용)
    const futText = getSectionText(activeText, 'Future tense', ['Imperative','Infinitive']);
    if (futText) {
      const forms = extractSpeakerForms(futText);
      ['fut_1s','fut_2ms','fut_2fs','fut_3ms','fut_3fs','fut_1p','fut_2mp','fut_2fp','fut_3mp','fut_3fp']
        .forEach((k,i) => { if (forms[i]) variants[k] = forms[i]; });
    }

    // 명령형
    const impText = getSectionText(activeText, 'Imperative', ['Infinitive','See also']);
    if (impText) {
      const forms = extractSpeakerForms(impText);
      const uniq = [...new Set(forms)];
      ['imp_2ms','imp_2fs','imp_2mp','imp_2fp'].forEach((k,i) => { if (uniq[i]) variants[k] = uniq[i]; });
    }

    // 인피니티브
    const infText = getSectionText(activeText, 'Infinitive', ['See also','Passive']);
    if (infText) {
      const forms = extractSpeakerForms(infText);
      if (forms[0]) variants['infinitive'] = forms[0];
    }
    if (!variants['infinitive'] && baseForm) variants['infinitive'] = baseForm;

  } else if (wordType === 'noun') {
    const singText = getSectionText(text, 'Singular', ['Plural','Dual','See also']);
    if (singText) {
      const forms = [...new Set(extractSpeakerForms(singText))];
      if (forms[0]) variants['gender_m'] = forms[0];
      if (forms[1]) variants['gender_f'] = forms[1];
    }
    const plText = getSectionText(text, 'Plural', ['Dual','Construct','See also']);
    if (plText) {
      const forms = [...new Set(extractSpeakerForms(plText))];
      if (forms[0]) variants['plural_m'] = forms[0];
      if (forms[1]) variants['plural_f'] = forms[1];
    }

  } else if (wordType === 'adj') {
    const forms = [...new Set(extractSpeakerForms(activeText))];
    ['gender_m','gender_f','plural_m','plural_f'].forEach((k,i) => { if (forms[i]) variants[k] = forms[i]; });
  }

  return {
    infinitive: baseForm || '',
    meaning: meaning || '',
    wordType,
    variants,
    variantCount: Object.keys(variants).length
  };
}
