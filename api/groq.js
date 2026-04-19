module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: '질문이 없어요' });

  const apiKey = process.env.GROQ_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_KEY 환경변수가 없어요. Vercel에서 GROQ_KEY를 추가해주세요.' });

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.7,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return res.status(response.status).json({ error: data.error?.message || JSON.stringify(data) });
  }

  const answer = data.choices?.[0]?.message?.content || '응답 없음';
  return res.status(200).json({ answer });
};
