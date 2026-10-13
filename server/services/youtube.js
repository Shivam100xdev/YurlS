const axios = require('axios');

const API_BASE = 'https://www.googleapis.com/youtube/v3';
const ALLOWED_HOSTS = ['youtube.com', 'music.youtube.com', 'youtu.be'];

function maxItems() {
  return parseInt(process.env.MAX_PLAYLIST_ITEMS || '300', 10);
}

// Only ever pulled apart with the URL constructor, never fetched directly -
// we use the id it gives us to call Google's own API, so there's no path
// for a crafted link to make this server reach out to some other host.
function extractYouTubeIds(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, '').replace(/^m\./, '');
  if (!ALLOWED_HOSTS.includes(host)) return null;

  let videoId = parsed.searchParams.get('v');
  if (!videoId && host === 'youtu.be') {
    videoId = parsed.pathname.split('/').filter(Boolean)[0] || null;
  }

  const listId = parsed.searchParams.get('list');

  if (!videoId && !listId) return null;
  return { videoId, listId };
}

async function fetchPlaylistTitle(playlistId) {
  const res = await axios.get(`${API_BASE}/playlists`, {
    params: { part: 'snippet', id: playlistId, key: process.env.YOUTUBE_API_KEY },
  });
  return res.data.items?.[0]?.snippet?.title || null;
}

async function fetchPlaylistVideoTitles(playlistId) {
  const titles = [];
  let pageToken = '';
  const cap = maxItems();

  do {
    const res = await axios.get(`${API_BASE}/playlistItems`, {
      params: {
        part: 'snippet',
        playlistId,
        maxResults: 50,
        pageToken: pageToken || undefined,
        key: process.env.YOUTUBE_API_KEY,
      },
    });

    for (const item of res.data.items || []) {
      const title = item.snippet?.title;
      if (title && title !== 'Private video' && title !== 'Deleted video') {
        titles.push(title);
      }
    }

    pageToken = res.data.nextPageToken || '';
  } while (pageToken && titles.length < cap);

  return titles.slice(0, cap);
}

async function fetchVideoTitle(videoId) {
  const res = await axios.get(`${API_BASE}/videos`, {
    params: { part: 'snippet', id: videoId, key: process.env.YOUTUBE_API_KEY },
  });
  return res.data.items?.[0]?.snippet?.title || null;
}

module.exports = {
  extractYouTubeIds,
  fetchPlaylistTitle,
  fetchPlaylistVideoTitles,
  fetchVideoTitle,
};
