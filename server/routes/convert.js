const express = require('express');
const youtube = require('../services/youtube');
const spotify = require('../services/spotify');
const { buildSearchQuery } = require('../services/parser');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    if (!req.session.spotify) {
      return res.status(401).json({ error: 'Connect your Spotify account first.' });
    }

    const { url, playlistName } = req.body || {};
    if (typeof url !== 'string' || url.length === 0 || url.length > 2000) {
      return res.status(400).json({ error: 'Give me a valid YouTube URL.' });
    }

    const ids = youtube.extractYouTubeIds(url);
    if (!ids) {
      return res.status(400).json({ error: "That doesn't look like a YouTube video or playlist link." });
    }

    let sourceTitle = 'YouTube import';
    let rawTitles = [];

    if (ids.listId) {
      const [title, titles] = await Promise.all([
        youtube.fetchPlaylistTitle(ids.listId),
        youtube.fetchPlaylistVideoTitles(ids.listId),
      ]);
      sourceTitle = title || sourceTitle;
      rawTitles = titles;
    } else if (ids.videoId) {
      const title = await youtube.fetchVideoTitle(ids.videoId);
      if (!title) {
        return res.status(404).json({ error: "Couldn't find that video - it might be private or deleted." });
      }
      rawTitles = [title];
      sourceTitle = title;
    }

    if (rawTitles.length === 0) {
      return res.status(404).json({ error: 'No playable videos found in that playlist.' });
    }

    const token = await spotify.ensureFreshToken(req.session);

    const matched = [];
    const notFound = [];

    for (const rawTitle of rawTitles) {
      const { query, display } = buildSearchQuery(rawTitle);
      try {
        const track = await spotify.searchTrack(token, query);
        if (track) {
          matched.push({ uri: track.uri });
        } else {
          notFound.push(display);
        }
      } catch (err) {
        console.error(`Spotify search failed for "${display}":`, err.response?.data || err.message);
        notFound.push(display);
      }
    }

    if (matched.length === 0) {
      return res.status(422).json({ error: "Couldn't match any of these songs on Spotify.", notFound });
    }

    const name = (playlistName && String(playlistName).trim()) || `${sourceTitle} (from YouTube)`;
    const playlist = await spotify.createPlaylist(
      token,
      req.session.spotify.userId,
      name.slice(0, 100),
      'Converted from a YouTube playlist.'
    );

    await spotify.addTracksToPlaylist(token, playlist.id, matched.map((m) => m.uri));

    res.json({
      playlistUrl: playlist.external_urls?.spotify || null,
      playlistName: name.slice(0, 100),
      totalFound: rawTitles.length,
      matchedCount: matched.length,
      notFoundCount: notFound.length,
      notFound,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
