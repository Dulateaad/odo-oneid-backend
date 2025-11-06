const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8787;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

app.use(express.json());
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(rateLimit({ windowMs: 60 * 1000, max: 60 }));

app.get('/health', (_req, res) => res.json({ ok: true }));

// Optional: helper callback to bridge web/mobile
app.get('/auth/oneid/callback', (req, res) => {
  const { code, state, target } = req.query || {};
  if (target === 'app') {
    const scheme = process.env.APP_SCHEME || 'odo.app';
    const redirectUrl = `${scheme}://auth/oneid/callback?code=${encodeURIComponent(code || '')}&state=${encodeURIComponent(state || '')}`;
    return res.redirect(302, redirectUrl);
  }
  return res.status(200).send('Code received. You can close this page.');
});

// Exchange authorization code for tokens and return userinfo
app.post('/api/oneid/token', async (req, res) => {
  try {
    const { code, redirectUri, codeVerifier } = req.body || {};
    if (!code || !redirectUri) {
      return res.status(400).json({ error: 'code and redirectUri are required' });
    }

    const tokenUrl = process.env.ONEID_TOKEN_URL;
    const clientId = process.env.ONEID_CLIENT_ID;
    const clientSecret = process.env.ONEID_CLIENT_SECRET;

    if (!tokenUrl || !clientId || !clientSecret) {
      return res.status(500).json({ error: 'Server misconfigured: check env vars' });
    }

    const params = new URLSearchParams();
    params.set('grant_type', 'authorization_code');
    params.set('code', code);
    params.set('redirect_uri', redirectUri);
    params.set('client_id', clientId);
    params.set('client_secret', clientSecret);
    if (codeVerifier) params.set('code_verifier', codeVerifier);

    const tokenResp = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!tokenResp.ok) {
      const text = await tokenResp.text();
      return res.status(502).json({ error: 'Token exchange failed', details: text });
    }

    const tokenJson = await tokenResp.json();
    const accessToken = tokenJson.access_token;
    const idToken = tokenJson.id_token;
    const expiresIn = tokenJson.expires_in;

    if (!accessToken) {
      return res.status(502).json({ error: 'No access_token in response' });
    }

    let user = null;
    const userInfoUrl = process.env.ONEID_USERINFO_URL;
    if (userInfoUrl) {
      const uiResp = await fetch(userInfoUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (uiResp.ok) {
        const ui = await uiResp.json();
        user = normalizeUser(ui);
      }
    }

    return res.json({ accessToken, idToken, expiresIn, user });
  } catch (e) {
    console.error('oneid/token error', e);
    return res.status(500).json({ error: 'Internal error' });
  }
});

function normalizeUser(ui) {
  // attempt to map common OIDC claims; adjust to OneID schema
  return {
    sub: ui.sub || ui.id,
    name: ui.name || [ui.given_name, ui.family_name].filter(Boolean).join(' '),
    givenName: ui.given_name,
    familyName: ui.family_name,
    phoneNumber: ui.phone || ui.phone_number,
    email: ui.email,
    picture: ui.picture,
    locale: ui.locale,
    raw: ui,
  };
}

app.listen(PORT, () => {
  console.log(`OneID backend listening on :${PORT}`);
});


