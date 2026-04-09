export default function handler(req, res) {
  // Only return the key — never log it
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({
    openaiKey: process.env.OPENAI_API_KEY || null,
  });
}
