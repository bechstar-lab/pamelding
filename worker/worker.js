// Tar imot påmeldinger fra skjemaet og legger dem som ny rad i Google Sheet.
// Secrets: SA_EMAIL, SA_KEY (service account med skrivetilgang til arket).
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64urlTekst = s => b64url(new TextEncoder().encode(s));

async function token(env) {
  const pem = env.SA_KEY.replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const nokkel = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const na = Math.floor(Date.now() / 1000);
  const del = b64urlTekst(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64urlTekst(JSON.stringify({
    iss: env.SA_EMAIL, scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token', iat: na, exp: na + 3600,
  }));
  const sign = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', nokkel, new TextEncoder().encode(del));
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + del + '.' + b64url(sign),
  });
  return (await r.json()).access_token;
}

const svar = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (req.method !== 'POST') return svar({ ok: false }, 405);

    let d;
    try { d = await req.json(); } catch { return svar({ ok: false, feil: 'ugyldig' }, 400); }
    const kort = v => String(v || '').slice(0, 500);
    if (!kort(d.navn).trim() || !/^\S+@\S+\.\S+$/.test(kort(d.epost))) return svar({ ok: false, feil: 'mangler' }, 400);

    const tid = new Date().toLocaleString('no-NO', { timeZone: 'Europe/Oslo' });
    const rad = [tid, kort(d.navn), kort(d.epost), kort(d.antall), kort(d.kommentar)];
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${env.SHEET_ID}/values/A1:append?valueInputOption=RAW`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + await token(env), 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [rad] }),
    });
    return r.ok ? svar({ ok: true }) : svar({ ok: false, feil: 'sheet' }, 502);
  },
};
