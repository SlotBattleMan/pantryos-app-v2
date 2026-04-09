// PantryOS — Vercel serverless function for decision engine
// OpenAI key stays server-side, never sent to browser

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI engine not configured', mock: true });
  }

  const { items, household } = req.body || {};
  if (!items || !household) {
    return res.status(400).json({ error: 'Missing items or household' });
  }

  const itemList = items
    .map(i => `- ${i.name} (qty: ${i.quantity || 1}${i.category ? ', ' + i.category : ''})`)
    .join('\n');

  const prompt = `
Household: ${household.name}
People: ${household.people} (${household.kids || 0} kids under 12)
Dietary needs: ${(household.dietary || ['None']).join(', ')}
Weekly budget: ${household.budget || 'Not specified'}
Default mode: ${household.default_mode || 'balanced'}

Items needed:
${itemList}

Return three basket options optimized for: cheapest total cost, best quality-value balance, and easiest/most convenient purchase method.
  `.trim();

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are PantryOS, a household buying intelligence engine. Given a list of grocery/household items and a household profile, return a JSON object with three basket options: cheapest, balanced, and easiest. Each option has: total (dollar amount as string), store (store name), highlights (array of 3 short benefit strings), items (array of objects with name and price as strings), and confidence (0-100 integer). Also include a top-level reasoning string (1 sentence). Return only valid JSON, no markdown.`,
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      }),
    });

    const data = await openaiRes.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content from OpenAI');
    return res.status(200).json(JSON.parse(content));
  } catch (err) {
    console.error('Decision engine error:', err.message);
    return res.status(500).json({ error: 'Engine error', mock: true });
  }
}
