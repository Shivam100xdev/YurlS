const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const router = express.Router();

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SCOPES = ['playlist-modify-public', 'playlist-modify-private', 'user-read-private'].join(' ');

router.get('/login', (req, res) => {
  // The state param goes into the session and back out on the callback -
  // that round trip is what stops someone else's OAuth code getting
  // dropped into your session (a classic CSRF flavor for OAuth flows).
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID,
    scope: SCOPES,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    state,
  });

  res.redirect(`${AUTHORIZE_URL}?${params.toString()}`);
});

router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`/?spotify_error=${encodeURIComponent(String(error))}`);
  }

  if (!state || state !== req.session.oauthState) {
    return res.status(400).send('State mismatch - please try connecting again from the home page.');
  }
  delete req.session.oauthState;

  try {
    const tokenRes = await axios.post(
      TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: 'Basic ' + Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
          ).toString('base64'),
        },
      }
    );

    const { access_token, refresh_token, expires_in } = tokenRes.data;

    const profileRes = await axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    req.session.spotify = {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + expires_in * 1000,
      userId: profileRes.data.id,
      displayName: profileRes.data.display_name || profileRes.data.id,
    };

    res.redirect('/?connected=1');
  } catch (err) {
    console.error('Spotify auth callback failed:', err.response?.data || err.message);
    res.redirect('/?spotify_error=auth_failed');
  }
});

router.get('/status', (req, res) => {
  if (req.session.spotify) {
    res.json({ loggedIn: true, displayName: req.session.spotify.displayName });
  } else {
    res.json({ loggedIn: false });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

module.exports = router;
