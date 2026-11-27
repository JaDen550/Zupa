/* ZUPA mailer — sends email through a provider's web API (works on free hosts that block SMTP).
   Pick ONE provider by setting its key in .env (local) or in Render's Environment settings:
     RESEND_API_KEY   (+ MAIL_FROM)   https://resend.com   — needs a verified domain to email customers
     BREVO_API_KEY    (+ MAIL_FROM)   https://brevo.com    — lets you verify a single sender address instead
   MAIL_FROM looks like:  ZUPA <orders@yourdomain.com>   (for Brevo: the sender address you verified)
   With no key set, nothing is sent and the caller falls back to printing in the server log. */
const configured = () => !!(process.env.RESEND_API_KEY || process.env.BREVO_API_KEY);

function parseFrom(from) {
  const m = /^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/.exec(from || '');
  return m ? { name: (m[1] || 'ZUPA').trim() || 'ZUPA', email: m[2].trim() } : { name: 'ZUPA', email: String(from || '').trim() };
}

async function sendMail({ to, subject, text, html }) {
  const from = process.env.MAIL_FROM;
  if (!from) throw new Error('MAIL_FROM is not set');
  let res;
  if (process.env.RESEND_API_KEY) {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject, text, html })
    });
  } else if (process.env.BREVO_API_KEY) {
    res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': process.env.BREVO_API_KEY, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ sender: parseFrom(from), to: [{ email: to }], subject, textContent: text, htmlContent: html })
    });
  } else throw new Error('No email provider key is set');
  if (!res.ok) {
    let detail = ''; try { detail = (await res.text()).slice(0, 200); } catch { /* ignore */ }
    throw new Error('Email provider answered ' + res.status + ' ' + detail);
  }
  return true;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function resetEmail(name, code) {
  const text = `Hi ${name || 'there'},\n\nYour ZUPA password reset code is ${code}.\nIt works for 15 minutes. If you did not ask for it, ignore this email: your password has not changed.\n\nZUPA - Your everyday shopping destination.`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#2b2b2b">
  <h2 style="color:#e8590c;margin:0 0 12px">ZUPA</h2>
  <p>Hi ${esc(name || 'there')},</p>
  <p>Your password reset code is:</p>
  <p style="font-size:32px;letter-spacing:6px;font-weight:700;background:#fff4e6;padding:14px 18px;border-radius:10px;display:inline-block;margin:6px 0">${esc(code)}</p>
  <p>It works for <b>15 minutes</b>. If you did not ask for this, ignore this email: your password has not changed.</p>
  <p style="color:#888;font-size:12px">ZUPA - Your everyday shopping destination.</p></div>`;
  return { subject: 'Your ZUPA password reset code', text, html };
}

module.exports = { configured, sendMail, resetEmail, parseFrom };
