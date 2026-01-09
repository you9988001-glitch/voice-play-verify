import crypto from "crypto";

function base64urlToString(b64u) {
  const b64 = b64u.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
  return Buffer.from(b64 + pad, "base64").toString("utf8");
}

function verifyJwtHS256(token, secret) {
  const parts = (token || "").split(".");
  if (parts.length !== 3) return null;

  const [h, p, s] = parts;
  const data = `${h}.${p}`;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  if (expected !== s) return null;

  const payload = JSON.parse(base64urlToString(p));
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && now > payload.exp) return null;
  if (payload.typ !== "pi-payment-proof") return null;

  return payload;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { name, email, vision, proofToken } = req.body || {};
  if (!name || !email || !vision) return res.status(400).json({ error: "missing fields" });

  const secret = process.env.PROOF_TOKEN_SECRET;
  if (!secret) return res.status(500).json({ error: "missing PROOF_TOKEN_SECRET" });

  const proof = verifyJwtHS256(proofToken, secret);
  if (!proof) return res.status(401).json({ error: "payment verification required" });

  const resendKey = process.env.RESEND_API_KEY;
  const to = process.env.MAIL_TO;
  const from = process.env.MAIL_FROM;

  if (!resendKey) return res.status(500).json({ error: "missing RESEND_API_KEY" });
  if (!to || !from) return res.status(500).json({ error: "missing MAIL_TO or MAIL_FROM" });

  const subject = `[Code Arche] Guardian Application — ${name}`;

  const html = `
    <h2>Guardian Application (Payment Verified)</h2>
    <p><b>Name:</b> ${escapeHtml(name)}</p>
    <p><b>Email:</b> ${escapeHtml(email)}</p>
    <p><b>Vision:</b><br/>${escapeHtml(vision).replace(/\n/g, "<br/>")}</p>
    <hr/>
    <p><b>Payment Proof</b></p>
    <p>paymentId: ${escapeHtml(proof.paymentId)}</p>
    <p>txid: ${escapeHtml(proof.txid)}</p>
  `;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
    }),
  });

  const out = await r.json().catch(() => ({}));
  if (!r.ok) return res.status(502).json({ error: "mail send failed", detail: out });

  return res.status(200).json({ ok: true });
}
