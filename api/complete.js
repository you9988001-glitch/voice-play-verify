module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "POST only" });
    }

    const { paymentId, txid } = req.body || {};
    if (!paymentId || !txid) {
      return res.status(400).json({ ok: false, error: "Missing paymentId or txid" });
    }

    const apiKey = process.env.PI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: "Missing PI_API_KEY env var" });
    }

    const url = `https://api.minepi.com/v2/payments/${paymentId}/complete`;

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Key ${apiKey}`,
      },
      body: JSON.stringify({ txid }),
    });

    const data = await r.json().catch(() => ({}));
    return res.status(r.status).json({ ok: r.ok, pi: data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
};
