## OneID Lightweight Backend

Express server that exchanges OneID authorization code for tokens and returns normalized user info. Suitable for Vercel/Render/any Node hosting.

### Endpoints
- `POST /api/oneid/token` – exchange `code` for tokens (server-side with client_secret). Body:
  ```json
  { "code": "...", "redirectUri": "...", "codeVerifier": "optional (PKCE)" }
  ```
  Response:
  ```json
  { "accessToken": "...", "idToken": "...", "expiresIn": 3600, "user": { ... } }
  ```

- `GET /auth/oneid/callback` – optional helper callback. Redirects to app scheme for mobile:
  - `?code=...&state=...&target=app` → `APP_SCHEME://auth/oneid/callback?code=...&state=...`

### Env (.env)
Copy `.env.example` to `.env` and fill values:

- `ONEID_CLIENT_ID=odo_uz`
- `ONEID_CLIENT_SECRET=***` (from OneID)
- `ONEID_AUTH_URL`, `ONEID_TOKEN_URL`, `ONEID_USERINFO_URL` (from OneID)
- `ONEID_REDIRECT_WEB=https://your-domain/auth/oneid/callback`
- `ONEID_REDIRECT_MOBILE=odo.app://auth/oneid/callback`
- `APP_SCHEME=odo.app`
- `ALLOWED_ORIGINS=http://localhost:8124,https://your-domain`

### Local run
```
cd server-oneid
npm i
cp .env.example .env
npm run dev
```

### Deploy (Vercel)
1. `vercel` in this folder (or import Git repo in Vercel Dashboard).
2. Add env vars from `.env` to Vercel project.
3. Set build & run as “Node.js” (no build step). Entry: `src/index.js`.
4. After deploy, backend URL will be like `https://odo-oneid.vercel.app`.

### Flutter integration
Client should call:
```
POST {BACKEND_URL}/api/oneid/token
{ code, redirectUri, codeVerifier? }
```
Use the returned `user` to log in/register in your app.


