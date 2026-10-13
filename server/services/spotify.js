const axios = require('axios');

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';

function basicAuthHeader() {
  const creds = `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`;
  return 'Basic ' + Buffer.from(creds).toString('base64');
}

// Refreshes the access token if it's expired (or about to be), otherwise
// just hands back what's already in the session. Keeps the token logic in
// one place instead of scattered through every route that calls Spotify.
async function ensureFreshToken(session) {
  if (!session.spotify) {
    const err = new Error('Not connected to Spotify');
    err.status = 401;
    throw err;
  }

  if (Date.now() < session.spotify.expiresAt - 30000) {
    return session.spotify.accessToken;
  }

  const res = await axios.post(
    TOKEN_URL,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: session.spotify.refreshToken,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basicAuthHeader() } }
  );

  session.spotify.accessToken = res.data.access_token;
  session.spotify.expiresAt = Date.now() + res.data.expires_in * 1000;
  if (res.data.refresh_token) session.spotify.refreshToken = res.data.refresh_token;

  return session.spotify.accessToken;
}

async function searchTrack(token, query) {
  const res = await axios.get(`${API_BASE}/search`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { q: query, type: 'track', limit: 3 },
  });
  const tracks = res.data.tracks?.items || [];
  return tracks[0] || null;
}

async function createPlaylist(token, userId, name, description) {
  const res = await axios.post(
    `${API_BASE}/users/${encodeURIComponent(userId)}/playlists`,
    { name, description, public: false },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return res.data;
}

async function addTracksToPlaylist(token, playlistId, uris) {
  // The endpoint only takes 100 URIs per call, so batch it.
  for (let i = 0; i < uris.length; i += 100) {
    const batch = uris.slice(i, i + 100);
    await axios.post(
      `${API_BASE}/playlists/${playlistId}/tracks`,
      { uris: batch },
      { headers: { Authorization: `Bearer ${token}` } }
    );
  }
}

module.exports = { ensureFreshToken, searchTrack, createPlaylist, addTracksToPlaylist };
