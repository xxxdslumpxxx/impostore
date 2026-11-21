// Gestione profili locali su localStorage (generato con FreeLLMAPI e integrato)
const STORAGE_KEY = 'impostore_profiles_v1';
const LEGACY_PLAYERS_KEY = 'impostore_players_v1';
const LEGACY_WORDS_KEY = 'impostore_used_words_v1';

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage errors (e.g. private browsing quota)
  }
}

function consumeLegacyData() {
  try {
    const rawPlayers = localStorage.getItem(LEGACY_PLAYERS_KEY);
    const rawWords = localStorage.getItem(LEGACY_WORDS_KEY);
    if (!rawPlayers && !rawWords) return null;

    const players = rawPlayers ? JSON.parse(rawPlayers) : [];
    const usedWordIndices = rawWords ? JSON.parse(rawWords) : [];

    localStorage.removeItem(LEGACY_PLAYERS_KEY);
    localStorage.removeItem(LEGACY_WORDS_KEY);

    return {
      players: Array.isArray(players) ? players.filter((p) => typeof p === 'string' && p.trim()) : [],
      usedWordIndices: Array.isArray(usedWordIndices) ? usedWordIndices : []
    };
  } catch {
    return null;
  }
}

export function listProfiles() {
  const store = readStore();
  return Object.values(store).sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0));
}

export function getProfile(nameOrKey) {
  if (!nameOrKey || typeof nameOrKey !== 'string') return null;
  const key = nameOrKey.trim().toLowerCase();
  const store = readStore();
  return store[key] || null;
}

export function loginProfile(rawName) {
  if (!rawName || typeof rawName !== 'string') return null;
  const name = rawName.trim().slice(0, 24);
  if (!name) return null;

  const key = name.toLowerCase();
  const store = readStore();
  const now = Date.now();

  if (store[key]) {
    store[key].lastUsedAt = now;
    writeStore(store);
    return store[key];
  }

  const isFirstProfile = Object.keys(store).length === 0;
  const legacy = isFirstProfile ? consumeLegacyData() : null;

  const profile = {
    key,
    name,
    players: legacy ? legacy.players : [],
    impostorCount: 1,
    usedWordIndices: legacy ? legacy.usedWordIndices : [],
    lastUsedAt: now
  };

  store[key] = profile;
  writeStore(store);
  return profile;
}

export function updateProfile(key, partial) {
  if (!key) return null;
  const store = readStore();
  if (!store[key]) return null;

  const allowed = {};
  if (Array.isArray(partial.players)) allowed.players = partial.players;
  if (typeof partial.impostorCount === 'number') allowed.impostorCount = partial.impostorCount;
  if (Array.isArray(partial.usedWordIndices)) allowed.usedWordIndices = partial.usedWordIndices;

  store[key] = {
    ...store[key],
    ...allowed,
    lastUsedAt: Date.now()
  };
  writeStore(store);
  return store[key];
}

export function deleteProfile(key) {
  if (!key) return;
  const store = readStore();
  if (store[key]) {
    delete store[key];
    writeStore(store);
  }
}

export function resetProfileWords(key) {
  return updateProfile(key, { usedWordIndices: [] });
}
