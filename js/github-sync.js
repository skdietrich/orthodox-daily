/* Optional GitHub-backed personal data sync.
   GitHub Pages remains static; this module uses the GitHub Contents API from the browser.
   The access token is stored only in this browser and is never written into the site repository
   or included in Orthodox Daily data exports. Use a separate private repository for personal data. */
(() => {
  'use strict';

  const CONFIG_KEY = 'orthodoxDailyGithubSyncV1';
  const DEFAULT_REPO = 'skdietrich/-orthodox-daily-data';
  const PERSONAL_KEYS = [
    'orthodoxDailyJournal',
    'orthodoxDailyFavorites',
    'orthodoxDailySettings',
    'orthodoxDailyChurches',
    'orthodoxDailyChurchEvents'
  ];
  const store = window.OrthodoxStore;
  let suppressPush = false;
  let pushTimer = 0;
  let writeChain = Promise.resolve();
  let lastBundleJson = '';

  const $ = selector => document.querySelector(selector);

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function readConfig() {
    const raw = readJson(CONFIG_KEY, {});
    return {
      repo: typeof raw.repo === 'string' && raw.repo ? raw.repo : DEFAULT_REPO,
      token: typeof raw.token === 'string' ? raw.token : '',
      user: typeof raw.user === 'string' ? raw.user : '',
      active: raw.active === true
    };
  }

  function writeConfig(next) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(next));
  }

  function cleanUser(value) {
    return String(value || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
  }

  function validRepo(value) {
    return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(String(value || '').trim());
  }

  function accountPath(user) {
    return 'users/' + cleanUser(user) + '.json';
  }

  function status(message, kind) {
    const el = $('#githubSyncStatus');
    if (!el) return;
    el.textContent = message;
    el.dataset.kind = kind || 'neutral';
  }

  function setBusy(busy) {
    document.querySelectorAll('[data-github-sync-action]').forEach(button => {
      button.disabled = !!busy;
    });
  }

  function bundle() {
    return {
      version: 1,
      companion: store.snapshot(),
      journal: readJson('orthodoxDailyJournal', {}),
      favorites: readJson('orthodoxDailyFavorites', []),
      settings: readJson('orthodoxDailySettings', {}),
      churches: readJson('orthodoxDailyChurches', []),
      churchEvents: readJson('orthodoxDailyChurchEvents', [])
    };
  }

  function bundleJson() {
    return JSON.stringify(bundle());
  }

  function applyBundle(next) {
    if (!next || next.version !== 1) throw new Error('This server backup has an unsupported format.');
    store.validate(next.companion);
    suppressPush = true;
    try {
      store.replace(next.companion);
      localStorage.setItem('orthodoxDailyJournal', JSON.stringify(next.journal && typeof next.journal === 'object' ? next.journal : {}));
      localStorage.setItem('orthodoxDailyFavorites', JSON.stringify(Array.isArray(next.favorites) ? next.favorites : []));
      localStorage.setItem('orthodoxDailySettings', JSON.stringify(next.settings && typeof next.settings === 'object' ? next.settings : {}));
      localStorage.setItem('orthodoxDailyChurches', JSON.stringify(Array.isArray(next.churches) ? next.churches : []));
      localStorage.setItem('orthodoxDailyChurchEvents', JSON.stringify(Array.isArray(next.churchEvents) ? next.churchEvents : []));
      lastBundleJson = bundleJson();
    } finally {
      suppressPush = false;
    }
  }

  function toBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    const size = 0x8000;
    for (let i = 0; i < bytes.length; i += size) {
      binary += String.fromCharCode(...bytes.subarray(i, i + size));
    }
    return btoa(binary);
  }

  function fromBase64(value) {
    const binary = atob(String(value || '').replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  async function passwordHash(user, password) {
    if (!window.crypto?.subtle) throw new Error('This browser cannot create the account password hash.');
    const data = new TextEncoder().encode('orthodox-daily:' + cleanUser(user) + ':' + password);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function apiBase(repo) {
    return 'https://api.github.com/repos/' + repo;
  }

  async function api(url, options) {
    const cfg = readConfig();
    if (!cfg.token) throw new Error('Enter a GitHub access token first.');
    const response = await fetch(url, {
      ...(options || {}),
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + cfg.token,
        ...(options?.headers || {})
      }
    });
    const method = String(options?.method || 'GET').toUpperCase();
    if (response.status === 404 && method === 'GET') return {notFound: true};
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = payload?.message || ('GitHub returned HTTP ' + response.status + '.');
      throw new Error(message);
    }
    return payload;
  }

  async function verifyRepository(repo) {
    const payload = await api(apiBase(repo));
    if (payload.notFound) throw new Error('GitHub could not find that repository with this token.');
    if (payload.private !== true) throw new Error('Use a separate private GitHub repository for personal data.');
    const permission = payload.permissions || {};
    if (permission.push !== true && permission.admin !== true && permission.maintain !== true) {
      throw new Error('This token does not have write access to that private repository.');
    }
    return true;
  }

  async function readAccount(user) {
    const cfg = readConfig();
    const payload = await api(apiBase(cfg.repo) + '/contents/' + accountPath(user));
    if (payload.notFound) return null;
    if (payload.type !== 'file' || !payload.content || !payload.sha) throw new Error('The server account file is not readable.');
    const parsed = JSON.parse(fromBase64(payload.content));
    return {record: parsed, sha: payload.sha};
  }

  async function writeAccount(user, record, sha) {
    const cfg = readConfig();
    const body = {
      message: 'Save Orthodox Daily data for ' + cleanUser(user),
      content: toBase64(JSON.stringify(record, null, 2))
    };
    if (sha) body.sha = sha;
    const payload = await api(apiBase(cfg.repo) + '/contents/' + accountPath(user), {
      method: 'PUT',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    });
    return payload?.content?.sha || null;
  }

  function validateAccountInput(user, password) {
    if (user.length < 3 || user.length > 32) throw new Error('Username must be 3 to 32 letters, numbers, dots, dashes, or underscores.');
    if (!/^[a-z0-9._-]+$/.test(user)) throw new Error('Username contains unsupported characters.');
    if (String(password || '').length < 4) throw new Error('Use a password of at least 4 characters.');
  }

  async function saveConnection(event) {
    event.preventDefault();
    const current = readConfig();
    const repo = $('#githubDataRepo').value.trim();
    const enteredToken = $('#githubDataToken').value.trim();
    const token = enteredToken || current.token;
    if (!validRepo(repo)) {
      status('Enter the repository as owner/name.', 'error');
      return;
    }
    if (repo.toLowerCase() === 'skdietrich/orthodox-daily') {
      status('Do not use the public website repository for personal data. Create a separate private data repository.', 'error');
      return;
    }
    if (!token) {
      status('Enter a GitHub access token with Contents read/write access to the private data repository.', 'error');
      return;
    }
    const next = {repo, token, user:'', active:false};
    writeConfig(next);
    setBusy(true);
    status('Checking the private repository…');
    try {
      await verifyRepository(repo);
      $('#githubDataToken').value = '';
      status('GitHub server connection saved on this device.', 'ok');
      render();
    } catch (error) {
      writeConfig(current);
      status('Connection failed: ' + error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function createAccount() {
    const cfg = readConfig();
    const user = cleanUser($('#githubUsername').value);
    const password = $('#githubPassword').value;
    try {
      if (!cfg.repo || !cfg.token) throw new Error('Save the private GitHub connection first.');
      validateAccountInput(user, password);
      setBusy(true);
      status('Creating server account…');
      await verifyRepository(cfg.repo);
      const existing = await readAccount(user);
      if (existing) throw new Error('That username already exists in this data repository.');
      const record = {
        version: 1,
        username: user,
        passwordHash: await passwordHash(user, password),
        updatedAt: new Date().toISOString(),
        data: bundle()
      };
      await writeAccount(user, record);
      writeConfig({...cfg, user, active:true});
      $('#githubPassword').value = '';
      lastBundleJson = bundleJson();
      status('Account created. Reflections will now be backed up to GitHub.', 'ok');
      render();
    } catch (error) {
      status('Could not create account: ' + error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function login() {
    const cfg = readConfig();
    const user = cleanUser($('#githubUsername').value);
    const password = $('#githubPassword').value;
    try {
      if (!cfg.repo || !cfg.token) throw new Error('Save the private GitHub connection first.');
      validateAccountInput(user, password);
      setBusy(true);
      status('Opening server account…');
      const remote = await readAccount(user);
      if (!remote) throw new Error('No account with that username exists.');
      const expected = await passwordHash(user, password);
      if (remote.record?.passwordHash !== expected) throw new Error('Username or password did not match.');
      if (!remote.record?.data) throw new Error('The account does not contain an Orthodox Daily backup.');
      applyBundle(remote.record.data);
      writeConfig({...cfg, user, active:true});
      $('#githubPassword').value = '';
      status('Signed in. Server data loaded. Reloading the app…', 'ok');
      setTimeout(() => location.reload(), 350);
    } catch (error) {
      status('Could not sign in: ' + error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function pushNow(reason) {
    const cfg = readConfig();
    if (!cfg.active || !cfg.user || !cfg.repo || !cfg.token || suppressPush || !navigator.onLine) return;
    const nextBundleJson = bundleJson();
    if (nextBundleJson === lastBundleJson && reason !== 'manual') return;
    writeChain = writeChain.then(async () => {
      status('Saving personal data to GitHub…');
      const remote = await readAccount(cfg.user);
      if (!remote) throw new Error('The server account file no longer exists.');
      const record = {
        ...remote.record,
        version: 1,
        username: cfg.user,
        updatedAt: new Date().toISOString(),
        data: JSON.parse(nextBundleJson)
      };
      try {
        await writeAccount(cfg.user, record, remote.sha);
      } catch (error) {
        if (!/409|sha|conflict/i.test(error.message)) throw error;
        const retry = await readAccount(cfg.user);
        if (!retry) throw error;
        await writeAccount(cfg.user, record, retry.sha);
      }
      lastBundleJson = nextBundleJson;
      status('Saved on GitHub at ' + new Date().toLocaleTimeString([], {hour:'numeric', minute:'2-digit'}) + '.', 'ok');
    }).catch(error => {
      status('GitHub save failed: ' + error.message, 'error');
    });
    return writeChain;
  }

  function queuePush() {
    if (suppressPush) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => pushNow('automatic'), 1200);
  }

  async function pullNow() {
    const cfg = readConfig();
    if (!cfg.active || !cfg.user) {
      status('Sign in to a server account first.', 'error');
      return;
    }
    if (!confirm('Load the GitHub copy on this device? This replaces the personal data currently stored in this browser.')) return;
    setBusy(true);
    status('Loading the GitHub copy…');
    try {
      const remote = await readAccount(cfg.user);
      if (!remote?.record?.data) throw new Error('No server backup is available for this account.');
      applyBundle(remote.record.data);
      status('Server copy loaded. Reloading the app…', 'ok');
      setTimeout(() => location.reload(), 350);
    } catch (error) {
      status('Could not load server data: ' + error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    const cfg = readConfig();
    writeConfig({...cfg, user:'', active:false});
    lastBundleJson = '';
    $('#githubPassword').value = '';
    status('Signed out. Local data remains on this device.', 'ok');
    render();
  }

  function render() {
    const cfg = readConfig();
    const repo = $('#githubDataRepo');
    const token = $('#githubDataToken');
    const user = $('#githubUsername');
    const signedIn = $('#githubSignedInTools');
    const signedOut = $('#githubSignedOutTools');
    if (!repo || !token || !user) return;
    repo.value = cfg.repo;
    token.value = '';
    token.placeholder = cfg.token ? 'Token saved on this device' : 'github_pat_…';
    if (cfg.user) user.value = cfg.user;
    user.disabled = cfg.active;
    if (signedIn) signedIn.hidden = !cfg.active;
    if (signedOut) signedOut.hidden = cfg.active;
    if (cfg.active) {
      status('Signed in as ' + cfg.user + '. Local changes are backed up to GitHub.', 'ok');
      lastBundleJson = bundleJson();
    } else if (cfg.repo && cfg.token) {
      status('GitHub connection ready. Create an account or sign in.');
    } else {
      status('Local-only mode. Add a private GitHub data repository to enable server save.');
    }
  }

  function bind() {
    const form = $('#githubSyncConfig');
    if (!form) return;
    form.addEventListener('submit', saveConnection);
    $('#githubCreateAccount').addEventListener('click', createAccount);
    $('#githubLogin').addEventListener('click', login);
    $('#githubLogout').addEventListener('click', logout);
    $('#githubPushNow').addEventListener('click', () => pushNow('manual'));
    $('#githubPullNow').addEventListener('click', pullNow);

    window.addEventListener('orthodox:personal-change', queuePush);
    $('#saveJournal')?.addEventListener('click', queuePush);
    $('#deleteJournal')?.addEventListener('click', queuePush);
    $('#importData')?.addEventListener('change', () => setTimeout(queuePush, 250));
    window.addEventListener('online', () => {
      const cfg = readConfig();
      if (cfg.active) {
        status('Back online. Server save is available.', 'ok');
        queuePush();
      }
    });
    window.addEventListener('offline', () => {
      const cfg = readConfig();
      if (cfg.active) status('Offline. Changes stay local until the connection returns.');
    });
    render();
  }

  document.addEventListener('DOMContentLoaded', bind);
  window.OrthodoxGithubSync = {pushNow, pullNow};
})();
