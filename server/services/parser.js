// YouTube video titles are messy - "Artist - Song (Official Music Video) [HD]"
// This strips the junk so the Spotify search has an actual chance of matching.

const NOISE_PATTERNS = [
  /\(\s*official[^)]*\)/gi,
  /\[\s*official[^\]]*\]/gi,
  /\(\s*lyrics?[^)]*\)/gi,
  /\[\s*lyrics?[^\]]*\]/gi,
  /\(\s*audio[^)]*\)/gi,
  /\[\s*audio[^\]]*\]/gi,
  /\(\s*(hd|hq|4k)\s*\)/gi,
  /\(\s*visuali[sz]er[^)]*\)/gi,
  /\(\s*full\s*(song|video|album)?[^)]*\)/gi,
  /\[\s*full\s*(song|video|album)?[^\]]*\]/gi,
  /\bofficial\s+(music\s+)?video\b/gi,
  /\bofficial\s+audio\b/gi,
  /\blyric\s+video\b/gi,
  /\bvideo\s*song\b/gi,
  /\b(hd|hq|4k)\b/gi,
  /#\w+/g,
];

function cleanTitle(rawTitle) {
  let title = rawTitle;

  for (const pattern of NOISE_PATTERNS) {
    title = title.replace(pattern, ' ');
  }

  return title
    .replace(/\s{2,}/g, ' ')
    .replace(/[-|]{2,}/g, '-')
    .trim()
    .replace(/^[-|:\s]+|[-|:\s]+$/g, '')
    .trim();
}

// "Artist - Track" is the most common YouTube convention, so try that split
// first. If there's no separator, just hand the whole cleaned string over -
// Spotify's search is fuzzy enough to usually still find it.
function splitArtistTrack(cleanedTitle) {
  const separators = [' - ', ' – ', ' — ', ' | '];
  for (const sep of separators) {
    if (cleanedTitle.includes(sep)) {
      const [first, ...rest] = cleanedTitle.split(sep);
      return { artist: first.trim(), track: rest.join(sep).trim() };
    }
  }
  return { artist: null, track: cleanedTitle };
}

function buildSearchQuery(rawTitle) {
  const cleaned = cleanTitle(rawTitle);
  const { artist, track } = splitArtistTrack(cleaned);

  if (artist && track) {
    return { query: `track:${track} artist:${artist}`, display: `${artist} - ${track}` };
  }
  return { query: track, display: track };
}

module.exports = { cleanTitle, splitArtistTrack, buildSearchQuery };
