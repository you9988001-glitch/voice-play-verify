import crypto from "crypto";

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwtHS256(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encHeader = base64url(JSON.stringify(header));
  const encPayload = base64url(JSON.stringify(payload));
  const data = `${encHeader}.${encPayload}`;
  const sig = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${data}.${sig}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const { paymentId, txid } = req.body || {};
  if (!paymentId || !txid) {
    return res.status(400).json({ error: "missing params" });
  }

  const apiKey = process.env.PI_API_KEY;
  const proofSecret = process.env.PROOF_TOKEN_SECRET;

  if (!apiKey) return res.status(500).json({ error: "missing PI_API_KEY" });
  if (!proofSecret) return res.status(500).json({ error: "missing PROOF_TOKEN_SECRET" });

  const r = await fetch(
    `https://api.minepi.com/v2/payments/${paymentId}/complete`,
    {
      method: "POST",
      headers: {
        "Authorization": `Key ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ txid })
    }
  );

  const data = await r.json().catch(() => ({}));
  if (!r.ok) return res.status(r.status).json(data);

  const now = Math.floor(Date.now() / 1000);
  const proofToken = signJwtHS256(
    {
      iss: "code-arche",
      typ: "pi-payment-proof",
      paymentId,
      txid,
      iat: now,
      exp: now + 15 * 60
    },
    proofSecret
  );

  return res.status(200).json({ ...data, proofToken });
}
