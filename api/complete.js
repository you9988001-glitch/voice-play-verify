const crypto = require("crypto");

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwtHS256(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };

  const h = base64url(JSON.stringify(header));
  const p = base64url(JSON.stringify(payload));
  const data = `${h}.${p}`;

  const sig = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${data}.${sig}`;
}

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

    // ✅ proofToken 서명에 쓰는 시크릿 (Vercel env)
    const secret = process.env.PROOF_TOKEN_SECRET;
    if (!secret) {
      return res.status(500).json({ ok: false, error: "Missing PROOF_TOKEN_SECRET env var" });
    }

    const url = `https://api.minepi.com/v2/payments/${paymentId}/complete`;

    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Pi 문서: Authorization: Key <App Server API Key>
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify({ txid }),
    });

    const data = await r.json().catch(() => ({}));

    // Pi complete가 실패하면 그대로 반환
    if (!r.ok) {
      return res.status(r.status).json({ ok: false, error: "pi complete failed", pi: data });
    }

    // ✅ 여기서 proofToken 생성해서 프론트에 돌려준다
    const proofToken = signJwtHS256(
      {
        typ: "pi-payment-proof",
        paymentId,
        txid,
        // 10분 유효
        exp: Math.floor(Date.now() / 1000) + 60 * 10,
      },
      secret
    );

    // 프론트가 이 proofToken을 저장하고 /api/contact로 보냄
    return res.status(200).json({
      ok: true,
      proofToken,
      pi: data,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
};
