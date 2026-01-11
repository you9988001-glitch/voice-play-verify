module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "POST only" });
    }

    const { paymentId } = req.body || {};
    if (!paymentId) {
      return res.status(400).json({ ok: false, error: "Missing paymentId" });
    }

    const apiKey = process.env.PI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: "Missing PI_API_KEY env var" });
    }

    const url = `https://api.minepi.com/v2/payments/${paymentId}/approve`;

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Pi 문서: Authorization: Key <App Server API Key>
        "Authorization": `Key ${apiKey}`,
      },
    });

    const data = await r.json().catch(() => ({}));
    return res.status(r.status).json({ ok: r.ok, pi: data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
};
