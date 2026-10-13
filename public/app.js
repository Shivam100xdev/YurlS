const els = {
  connectBtn: document.getElementById('connect-btn'),
  form: document.getElementById('convert-form'),
  urlInput: document.getElementById('yt-url'),
  nameInput: document.getElementById('playlist-name'),
  convertBtn: document.getElementById('convert-btn'),
  log: document.getElementById('log'),
  result: document.getElementById('result'),
};

init();

async function init() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('spotify_error')) {
    logLine(`could not connect to spotify (${params.get('spotify_error')})`, 'error');
  }
  if (window.history.replaceState) {
    window.history.replaceState({}, '', window.location.pathname);
  }

  let status = { loggedIn: false };
  try {
    status = await fetch('/auth/status').then((r) => r.json());
  } catch {
    logLine('could not reach the server - is it running?', 'error');
  }
  setConnected(status.loggedIn, status.displayName);
}

function setConnected(loggedIn, displayName) {
  if (loggedIn) {
    els.connectBtn.textContent = `connected as ${displayName}`;
    els.connectBtn.disabled = true;
    els.connectBtn.classList.add('is-connected');
  } else {
    els.connectBtn.textContent = 'connect spotify';
    els.connectBtn.disabled = false;
    els.connectBtn.classList.remove('is-connected');
  }
  els.convertBtn.disabled = !loggedIn;
}

els.connectBtn.addEventListener('click', () => {
  window.location.href = '/auth/login';
});

els.form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const url = els.urlInput.value.trim();
  if (!url) return;

  els.convertBtn.disabled = true;
  els.result.hidden = true;
  els.log.innerHTML = '';

  // These fire on a timer purely for readability while the one real
  // request is in flight - the backend does the actual work in a single
  // call. A future version could stream real progress over SSE instead.
  const steps = ['reading the youtube link', 'pulling video titles', 'searching spotify for matches', 'creating your playlist'];
  const stepTimers = steps.map((step, i) => setTimeout(() => logLine(step), i * 550));

  try {
    const res = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, playlistName: els.nameInput.value.trim() }),
    });
    const data = await res.json();

    if (!res.ok) {
      logLine(data.error || 'something went wrong', 'error');
      return;
    }

    logLine(`matched ${data.matchedCount} of ${data.totalFound} tracks`);
    if (data.notFoundCount) {
      logLine(`${data.notFoundCount} track(s) had no spotify match`, 'warn');
    }
    logLine('done');
    showResult(data);
  } catch {
    logLine('network error - is the server running?', 'error');
  } finally {
    stepTimers.forEach(clearTimeout);
    els.convertBtn.disabled = false;
  }
});

function logLine(text, type = 'info') {
  const line = document.createElement('div');
  line.className = `log-line log-line--${type}`;
  line.textContent = `> ${text}`;
  els.log.appendChild(line);
  els.log.scrollTop = els.log.scrollHeight;
}

function showResult(data) {
  els.result.hidden = false;

  const heading = document.createElement('p');
  heading.textContent = `"${data.playlistName}" is ready on Spotify.`;
  els.result.replaceChildren(heading);

  // Only trust a link that actually points at Spotify's own domain before
  // rendering it as something clickable.
  if (typeof data.playlistUrl === 'string' && /^https:\/\/open\.spotify\.com\//.test(data.playlistUrl)) {
    const link = document.createElement('a');
    link.href = data.playlistUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'open playlist';
    els.result.appendChild(link);
  }
}
