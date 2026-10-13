# YouTube → Spotify Playlist Converter

Paste a YouTube playlist (or single video) link, connect your Spotify account,
and it pulls the track titles, searches for them on Spotify, and builds you a
new playlist. Full-stack: Node/Express backend, a small vanilla JS frontend,
no frameworks or build step needed.

## What you need first

1. **A YouTube Data API key**
   - Go to the [Google Cloud Console](https://console.cloud.google.com/), create a project (or use one you have).
   - Under *APIs & Services → Library*, enable **YouTube Data API v3**.
   - Under *APIs & Services → Credentials*, create an **API key**. Optionally restrict it to the YouTube Data API v3 for safety.

2. **A Spotify app**
   - Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), create an app.
   - Copy the **Client ID** and **Client Secret**.
   - In the app's settings, add this exact Redirect URI: `http://localhost:3000/auth/callback`

## Setup

```bash
npm install
cp .env.example .env
```

Open `.env` and fill in:

```
SESSION_SECRET=<a long random string>
YOUTUBE_API_KEY=<your key>
SPOTIFY_CLIENT_ID=<your client id>
SPOTIFY_CLIENT_SECRET=<your client secret>
SPOTIFY_REDIRECT_URI=http://localhost:3000/auth/callback
```

Generate a session secret if you need one:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then run it:

```bash
npm start
```

Open `http://localhost:3000`, click **connect spotify**, log in, then paste a
playlist or video URL and hit **convert**.

## How it works

1. Frontend sends the YouTube URL to the backend over a plain REST call.
2. Backend calls the **YouTube Data API** to pull the playlist's video titles
   (or a single video's title).
3. Each title gets cleaned up (`server/services/parser.js`) - strips things
   like "(Official Video)", "[Lyrics]", hashtags, HD/4K tags - and split into
   an artist/track guess where the title uses the common "Artist - Track"
   format.
4. Each cleaned title is searched against the **Spotify Web API**.
5. A new private playlist is created under your Spotify account and the
   matched tracks are added to it.
6. The backend returns a summary (matched count, anything it couldn't find,
   and a link to the playlist) and the frontend shows it.

Spotify auth uses the standard OAuth 2.0 authorization code flow. Your
Spotify tokens live only in your server-side session (an httpOnly cookie
points at it) - they're never sent to or stored in the browser, and nothing
gets written to disk.

## Security notes

This is set up to be reasonably safe to run, not bulletproof for a public
deployment:

- Session cookies are httpOnly, sameSite, and marked secure automatically
  once `NODE_ENV=production`.
- The OAuth flow uses a `state` value to prevent CSRF on the callback.
- The YouTube URL is parsed with the `URL` constructor and checked against
  an allow-list of YouTube hostnames before anything happens with it - the
  server never fetches a user-supplied URL directly, it only ever calls
  Google's and Spotify's own APIs.
- `/api/convert` is rate-limited per IP.
- Errors are logged server-side only; the client just gets a generic
  message, never a stack trace or raw API error.
- Sessions are kept in memory (Express's default store), which is fine for
  trying this out locally but will lose everyone's login on a restart and
  won't scale past one process. Swap in `connect-redis` or similar before
  deploying this anywhere real, and put it behind HTTPS.

## Limits worth knowing

- YouTube Data API has a daily quota; `MAX_PLAYLIST_ITEMS` in `.env` caps how
  many videos get pulled from one playlist so a single huge playlist can't
  eat your whole quota.
- Matching is done with Spotify's search endpoint and takes the top result -
  it's good but not perfect, especially for covers, remixes, or less common
  tracks. Anything unmatched is listed in the result instead of silently
  dropped.
- Progress lines in the UI are a rough approximation (the backend currently
  processes everything in one request-response cycle). Streaming real
  progress would mean moving `/api/convert` to Server-Sent Events or a
  WebSocket - noted below as a possible next step.

## Possible next steps

- Real-time progress via SSE instead of the timed placeholder log lines.
- A manual "pick the right match" step for anything Spotify couldn't match
  automatically.
- Support for converting more than one playlist in a batch.
- Persist a history of past conversions per user.

## Project layout

```
server/
  index.js              Express app, security middleware, sessions
  routes/
    auth.js             Spotify OAuth login/callback/status/logout
    convert.js          Main YouTube -> Spotify conversion endpoint
  services/
    youtube.js           YouTube Data API calls
    spotify.js            Spotify Web API calls + token refresh
    parser.js             Title cleanup / artist-track splitting
public/
  index.html, style.css, app.js   Frontend, served statically by Express
```
