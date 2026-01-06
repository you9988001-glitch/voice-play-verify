export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const { paymentId } = req.body || {};
  if (!paymentId) {
    return res.status(400).json({ error: "missing paymentId" });
  }

  const apiKey = process.env.PI_API_KEY;

  const r = await fetch(
    `https://api.minepi.com/v2/payments/${paymentId}/approve`,
    {
      method: "POST",
      headers: {
        "Authorization": `Key ${apiKey}`,
        "Content-Type": "application/json"
      }
    }
  );

  const data = await r.json().catch(() => ({}));
  return res.status(r.status).json(data);
}
