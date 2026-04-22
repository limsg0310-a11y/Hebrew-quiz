// api/groq.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, prompt } = req.body || {};

  // messages 배열이 있으면 그대로 사용, 없으면 기존 prompt 방식 호환
  let chatMessages;
  if (messages && Array.isArray(messages)) {
    chatMessages = messages;
  } else if (prompt) {
    chatMessages = [{ role: 'user', content: prompt }];
  } else {
    return res.status(400).json({ error: '질문이 없어요' });
  }

  const apiKey = process.env.GROQ_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_KEY 환경변수가 없어요' });

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: chatMessages,
      max_tokens: 800,
      temperature: 0.7,
    }),
  });

  const data = await response.json();
  if (!response.ok) return res.status(response.status).json({ error: data.error?.message || JSON.stringify(data) });

  const answer = data.choices?.[0]?.message?.content || '응답 없음';
  return res.status(200).json({ answer });
}
