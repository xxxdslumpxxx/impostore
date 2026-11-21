import { WORDS } from './words.js';
import {
  listProfiles,
  loginProfile,
  updateProfile,
  deleteProfile
} from './profiles.js';

// ==================== AVATAR PALETTE ====================
const AVATAR_COLORS = [
  '#6c63ff', '#ff4d6d', '#00b894', '#f39c12',
  '#0984e3', '#e84393', '#00cec9', '#fd79a8',
  '#a29bfe', '#e17055', '#2ecc71', '#9b59b6'
];

// ==================== STATE ====================
const state = {
  activeProfileKey: null,
  activeProfileName: '',
  players: [],
  impostorCount: 1,
  usedWordIndices: [],
  impostorBag: [],
  lastImpostors: [],
  lastStarter: '',
  currentWord: '',
  currentHint: '',
  assignments: [], // [{ name, isImpostor }]
  revealIndex: 0,
  hasPeekedCurrent: false,
  starterIndex: 0,
  timerSeconds: 0,
  timerRunning: false,
  timerInterval: null,
  confirmRevealTimeout: null,
  isConfirmingReveal: false
};

// ==================== DOM ELEMENTS ====================
const screens = {
  login: document.getElementById('screen-login'),
  setup: document.getElementById('screen-setup'),
  reveal: document.getElementById('screen-reveal'),
  ready: document.getElementById('screen-ready'),
  play: document.getElementById('screen-play')
};

const elLoginForm = document.getElementById('login-form');
const elProfileNameInput = document.getElementById('profile-name-input');
const elRecentProfilesPanel = document.getElementById('recent-profiles-panel');
const elProfileCountBadge = document.getElementById('profile-count-badge');
const elProfileList = document.getElementById('profile-list');

const elBtnSwitchProfile = document.getElementById('btn-switch-profile');
const elActiveProfileAvatar = document.getElementById('active-profile-avatar');
const elActiveProfileName = document.getElementById('active-profile-name');

const elWordPoolMeta = document.getElementById('word-pool-meta');
const elPlayerCountBadge = document.getElementById('player-count-badge');
const elAddPlayerForm = document.getElementById('add-player-form');
const elPlayerNameInput = document.getElementById('player-name-input');
const elPlayerList = document.getElementById('player-list');
const elSetupHint = document.getElementById('setup-hint');
const elBtnImpMinus = document.getElementById('btn-imp-minus');
const elBtnImpPlus = document.getElementById('btn-imp-plus');
const elImpDisplay = document.getElementById('impostor-count-display');
const elBtnStartDeal = document.getElementById('btn-start-deal');

const elBtnAbortReveal = document.getElementById('btn-abort-reveal');
const elRevealProgressText = document.getElementById('reveal-progress-text');
const elRevealProgressBar = document.getElementById('reveal-progress-bar');
const elRevealAvatar = document.getElementById('reveal-avatar');
const elRevealPlayerName = document.getElementById('reveal-player-name');
const elSecretCard = document.getElementById('secret-card');
const elCardRoleBadge = document.getElementById('card-role-badge');
const elCardContentLabel = document.getElementById('card-content-label');
const elCardSecretValue = document.getElementById('card-secret-value');
const elCardRoleTip = document.getElementById('card-role-tip');
const elBtnNextPlayer = document.getElementById('btn-next-player');
const elBtnNextPlayerLabel = document.getElementById('btn-next-player-label');

const elBtnInizio = document.getElementById('btn-inizio');

const elBtnTimerToggle = document.getElementById('btn-timer-toggle');
const elTimerDisplay = document.getElementById('timer-display');
const elTimerIcon = document.getElementById('timer-icon');
const elStarterAvatar = document.getElementById('starter-avatar');
const elStarterName = document.getElementById('starter-name');
const elStarterSub = document.getElementById('starter-sub');
const elSolutionCard = document.getElementById('solution-card');
const elSolutionImpostors = document.getElementById('solution-impostors');
const elSolutionWord = document.getElementById('solution-word');
const elSolutionHint = document.getElementById('solution-hint');
const elBtnRevealSolution = document.getElementById('btn-reveal-solution');
const elPostGameActions = document.getElementById('post-game-actions');
const elBtnEditPlayers = document.getElementById('btn-edit-players');
const elBtnNewRound = document.getElementById('btn-new-round');

// ==================== UTILS ====================
function randomInt(max) {
  if (max <= 1) return 0;
  if (window.crypto && window.crypto.getRandomValues) {
    const limit = Math.floor(0x100000000 / max) * max;
    const arr = new Uint32Array(1);
    let val;
    do {
      window.crypto.getRandomValues(arr);
      val = arr[0];
    } while (val >= limit);
    return val % max;
  }
  return Math.floor(Math.random() * max);
}

function shuffleArray(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function vibrate(pattern) {
  if (navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // ignore
    }
  }
}

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitial(name) {
  return (name.trim()[0] || '?').toUpperCase();
}

function persistActiveProfile() {
  if (!state.activeProfileKey) return;
  updateProfile(state.activeProfileKey, {
    players: state.players,
    impostorCount: state.impostorCount,
    usedWordIndices: state.usedWordIndices,
    impostorBag: state.impostorBag,
    lastImpostors: state.lastImpostors,
    lastStarter: state.lastStarter
  });
}

function pickRandomWordPair() {
  if (state.usedWordIndices.length >= WORDS.length) {
    state.usedWordIndices = [];
  }
  const usedSet = new Set(state.usedWordIndices);
  const available = [];
  for (let i = 0; i < WORDS.length; i++) {
    if (!usedSet.has(i)) available.push(i);
  }
  const chosenIdx = available[randomInt(available.length)];
  state.usedWordIndices.push(chosenIdx);
  persistActiveProfile();
  return WORDS[chosenIdx];
}

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove('active'));
  screens[name].classList.add('active');
}

function maxImpostorsFor(count) {
  if (count < 3) return 1;
  return Math.max(1, Math.floor((count - 1) / 2));
}

// ==================== LOGIN / PROFILE SCREEN ====================
function enterProfile(rawName) {
  const profile = loginProfile(rawName);
  if (!profile) return;

  state.activeProfileKey = profile.key;
  state.activeProfileName = profile.name;
  state.players = [...(profile.players || [])];
  state.impostorCount = profile.impostorCount || 1;
  state.usedWordIndices = [...(profile.usedWordIndices || [])];
  state.impostorBag = [...(profile.impostorBag || [])];
  state.lastImpostors = [...(profile.lastImpostors || [])];
  state.lastStarter = profile.lastStarter || '';

  elActiveProfileAvatar.textContent = getInitial(profile.name);
  elActiveProfileAvatar.style.background = getAvatarColor(profile.name);
  elActiveProfileName.textContent = profile.name;

  renderSetup();
  showScreen('setup');
  vibrate(15);
}

function renderLogin() {
  const profiles = listProfiles();
  elProfileCountBadge.textContent = String(profiles.length);
  elRecentProfilesPanel.classList.toggle('hidden', profiles.length === 0);

  elProfileList.innerHTML = '';
  profiles.forEach((prof) => {
    const li = document.createElement('li');
    li.className = 'profile-item';

    const btnOpen = document.createElement('button');
    btnOpen.type = 'button';
    btnOpen.className = 'profile-item-btn';

    const avatar = document.createElement('span');
    avatar.className = 'avatar-sm';
    avatar.style.background = getAvatarColor(prof.name);
    avatar.textContent = getInitial(prof.name);

    const meta = document.createElement('div');
    meta.className = 'profile-meta';

    const nameEl = document.createElement('span');
    nameEl.className = 'profile-meta-name';
    nameEl.textContent = prof.name;

    const pCount = (prof.players || []).length;
    const wCount = (prof.usedWordIndices || []).length;
    const subEl = document.createElement('span');
    subEl.className = 'profile-meta-sub';
    subEl.textContent = `${pCount} giocator${pCount === 1 ? 'e' : 'i'} • ${wCount} parol${wCount === 1 ? 'a' : 'e'} usate`;

    meta.append(nameEl, subEl);
    btnOpen.append(avatar, meta);
    btnOpen.addEventListener('click', () => enterProfile(prof.name));

    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'btn-remove';
    btnDel.setAttribute('aria-label', `Elimina profilo ${prof.name}`);
    btnDel.textContent = '×';
    btnDel.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Vuoi eliminare il profilo "${prof.name}" e il suo storico parole?`)) {
        deleteProfile(prof.key);
        renderLogin();
      }
    });

    li.append(btnOpen, btnDel);
    elProfileList.appendChild(li);
  });
}

elLoginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const raw = elProfileNameInput.value.trim();
  if (!raw) return;
  elProfileNameInput.value = '';
  enterProfile(raw);
});

elBtnSwitchProfile.addEventListener('click', () => {
  renderLogin();
  showScreen('login');
  vibrate(10);
});

// ==================== SETUP RENDERING ====================
function renderSetup() {
  const used = state.usedWordIndices.length;
  elWordPoolMeta.textContent =
    used > 0
      ? `${WORDS.length.toLocaleString('it-IT')} parole • ${used} giocate`
      : `${WORDS.length.toLocaleString('it-IT')} parole • Tutto generico`;

  elPlayerCountBadge.textContent = String(state.players.length);

  const maxImp = maxImpostorsFor(state.players.length);
  if (state.impostorCount > maxImp) state.impostorCount = maxImp;
  if (state.impostorCount < 1) state.impostorCount = 1;

  elImpDisplay.textContent = String(state.impostorCount);
  elBtnImpMinus.disabled = state.impostorCount <= 1;
  elBtnImpPlus.disabled = state.impostorCount >= maxImp || state.players.length < 3;

  elPlayerList.innerHTML = '';
  state.players.forEach((name, idx) => {
    const li = document.createElement('li');
    li.className = 'player-item';

    const info = document.createElement('div');
    info.className = 'player-info';

    const avatar = document.createElement('span');
    avatar.className = 'avatar-sm';
    avatar.style.background = getAvatarColor(name);
    avatar.textContent = getInitial(name);

    const spanName = document.createElement('span');
    spanName.className = 'player-name';
    spanName.textContent = name;

    info.append(avatar, spanName);

    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'btn-remove';
    btnDel.setAttribute('aria-label', `Rimuovi ${name}`);
    btnDel.textContent = '×';
    btnDel.addEventListener('click', () => {
      state.players.splice(idx, 1);
      persistActiveProfile();
      renderSetup();
    });

    li.append(info, btnDel);
    elPlayerList.appendChild(li);
  });

  const canStart = state.players.length >= 3;
  elBtnStartDeal.disabled = !canStart;
  elSetupHint.classList.toggle('hidden', canStart);
}

elAddPlayerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const raw = elPlayerNameInput.value.trim();
  if (!raw) return;

  const exists = state.players.some((p) => p.toLowerCase() === raw.toLowerCase());
  if (exists) {
    elPlayerNameInput.value = '';
    elPlayerNameInput.placeholder = 'Nome già inserito!';
    setTimeout(() => {
      elPlayerNameInput.placeholder = 'Nome giocatore...';
    }, 1500);
    return;
  }

  state.players.push(raw);
  persistActiveProfile();
  elPlayerNameInput.value = '';
  renderSetup();
  vibrate(12);
});

elBtnImpMinus.addEventListener('click', () => {
  if (state.impostorCount > 1) {
    state.impostorCount--;
    persistActiveProfile();
    renderSetup();
    vibrate(10);
  }
});

elBtnImpPlus.addEventListener('click', () => {
  const maxImp = maxImpostorsFor(state.players.length);
  if (state.impostorCount < maxImp) {
    state.impostorCount++;
    persistActiveProfile();
    renderSetup();
    vibrate(10);
  }
});

// ==================== GAME DEALING & REVEAL ====================
function pickImpostorSet(players, count) {
  const playerSet = new Set(players);
  const lastSet = new Set(state.lastImpostors);
  const chosen = new Set();

  // Keep only current players in the fair-rotation bag
  let bag = state.impostorBag.filter((name) => playerSet.has(name));

  // Helper to refill bag with all current players (shuffled)
  function refillBag() {
    bag = shuffleArray(players);
  }

  while (chosen.size < count) {
    if (bag.length === 0) {
      refillBag();
    }

    // Prefer someone from the bag who wasn't impostor in the previous round
    let candidateIdx = bag.findIndex((name) => !chosen.has(name) && !lastSet.has(name));

    // If the bag only contains previous impostors, check if we can refill first
    if (candidateIdx === -1) {
      const othersAvailable = players.filter((name) => !chosen.has(name) && !lastSet.has(name));
      if (othersAvailable.length > 0) {
        refillBag();
        candidateIdx = bag.findIndex((name) => !chosen.has(name) && !lastSet.has(name));
      } else {
        candidateIdx = bag.findIndex((name) => !chosen.has(name));
      }
    }

    if (candidateIdx === -1) break;
    const [picked] = bag.splice(candidateIdx, 1);
    chosen.add(picked);
  }

  state.impostorBag = bag;
  state.lastImpostors = [...chosen];
  persistActiveProfile();
  return chosen;
}

function startNewRound() {
  stopTimer();
  clearConfirmReveal();

  const [word, hint] = pickRandomWordPair();
  state.currentWord = word;
  state.currentHint = hint;

  const impostorNames = pickImpostorSet(state.players, state.impostorCount);

  state.assignments = state.players.map((name) => ({
    name,
    isImpostor: impostorNames.has(name)
  }));

  state.revealIndex = 0;
  state.hasPeekedCurrent = false;
  renderRevealStep();
  showScreen('reveal');
  vibrate(18);
}

function renderRevealStep() {
  const total = state.assignments.length;
  const current = state.assignments[state.revealIndex];

  elRevealProgressText.textContent = `${state.revealIndex + 1} / ${total}`;
  elRevealProgressBar.style.width = `${((state.revealIndex + 1) / total) * 100}%`;

  elRevealAvatar.textContent = getInitial(current.name);
  elRevealAvatar.style.background = getAvatarColor(current.name);
  elRevealPlayerName.textContent = current.name;

  elSecretCard.classList.remove('is-holding', 'is-civilian', 'is-impostor');
  elSecretCard.classList.add(current.isImpostor ? 'is-impostor' : 'is-civilian');

  if (current.isImpostor) {
    elCardRoleBadge.textContent = 'IMPOSTORE';
    elCardContentLabel.textContent = 'Il tuo indizio';
    elCardSecretValue.textContent = state.currentHint;
    elCardRoleTip.textContent = 'Non conosci la parola esatta: bluffa e mimetizzati!';
  } else {
    elCardRoleBadge.textContent = 'CIVILE';
    elCardContentLabel.textContent = 'La parola segreta è';
    elCardSecretValue.textContent = state.currentWord;
    elCardRoleTip.textContent = 'Dai un indizio collegato senza essere troppo ovvio.';
  }

  state.hasPeekedCurrent = false;
  elBtnNextPlayer.disabled = true;
  elBtnNextPlayerLabel.textContent =
    state.revealIndex === total - 1 ? 'Tutti pronti!' : 'Fatto, passa al prossimo';
}

function beginHold(e) {
  if (e && e.cancelable) e.preventDefault();
  elSecretCard.classList.add('is-holding');
  if (!state.hasPeekedCurrent) {
    state.hasPeekedCurrent = true;
    elBtnNextPlayer.disabled = false;
    vibrate(25);
  }
}

function endHold() {
  elSecretCard.classList.remove('is-holding');
}

elSecretCard.addEventListener('pointerdown', beginHold);
elSecretCard.addEventListener('pointerup', endHold);
elSecretCard.addEventListener('pointerleave', endHold);
elSecretCard.addEventListener('pointercancel', endHold);
elSecretCard.addEventListener('contextmenu', (e) => e.preventDefault());

elSecretCard.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') beginHold(e);
});
elSecretCard.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') endHold();
});

elBtnStartDeal.addEventListener('click', startNewRound);

elBtnNextPlayer.addEventListener('click', () => {
  endHold();
  if (state.revealIndex < state.assignments.length - 1) {
    state.revealIndex++;
    renderRevealStep();
    vibrate(14);
  } else {
    showScreen('ready');
    vibrate([20, 40, 20]);
  }
});

elBtnAbortReveal.addEventListener('click', () => {
  renderSetup();
  showScreen('setup');
});

// ==================== INIZIO -> STARTER ROULETTE ====================
elBtnInizio.addEventListener('click', () => {
  const candidates = state.assignments
    .map((a, i) => ({ name: a.name, i }))
    .filter((x) => x.name !== state.lastStarter);
  const pool = candidates.length > 0 ? candidates : state.assignments.map((a, i) => ({ name: a.name, i }));
  const picked = pool[randomInt(pool.length)];
  state.starterIndex = picked.i;
  state.lastStarter = picked.name;
  persistActiveProfile();

  elSolutionCard.classList.add('hidden');
  elPostGameActions.classList.add('hidden');
  elBtnRevealSolution.classList.remove('hidden');
  clearConfirmReveal();

  showScreen('play');
  runStarterRoulette(state.starterIndex);
});

function runStarterRoulette(finalIndex) {
  const names = state.assignments.map((a) => a.name);
  let step = 0;
  const totalSteps = 14;
  elStarterSub.textContent = 'Estrazione di chi inizia...';

  function tick() {
    const idx = step < totalSteps ? step % names.length : finalIndex;
    const name = names[idx];
    elStarterName.textContent = name;
    elStarterAvatar.textContent = getInitial(name);
    elStarterAvatar.style.background = getAvatarColor(name);

    if (step < totalSteps) {
      vibrate(8);
      step++;
      const delay = 55 + step * 10;
      setTimeout(tick, delay);
    } else {
      elStarterSub.textContent = 'Dice la prima parola, poi si prosegue a turno!';
      vibrate([30, 50, 40]);
      startTimer();
    }
  }

  tick();
}

// ==================== TIMER ====================
function formatTime(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function startTimer() {
  stopTimer();
  state.timerSeconds = 0;
  state.timerRunning = true;
  elTimerDisplay.textContent = '00:00';
  elTimerIcon.textContent = '⏸';
  state.timerInterval = setInterval(() => {
    if (state.timerRunning) {
      state.timerSeconds++;
      elTimerDisplay.textContent = formatTime(state.timerSeconds);
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
  state.timerRunning = false;
}

elBtnTimerToggle.addEventListener('click', () => {
  state.timerRunning = !state.timerRunning;
  elTimerIcon.textContent = state.timerRunning ? '⏸' : '▶';
  vibrate(10);
});

// ==================== SOLUTION REVEAL ====================
function clearConfirmReveal() {
  state.isConfirmingReveal = false;
  if (state.confirmRevealTimeout) {
    clearTimeout(state.confirmRevealTimeout);
    state.confirmRevealTimeout = null;
  }
  elBtnRevealSolution.classList.remove('confirming');
  elBtnRevealSolution.textContent = 'Svela Impostore e Parola';
}

elBtnRevealSolution.addEventListener('click', () => {
  if (!state.isConfirmingReveal) {
    state.isConfirmingReveal = true;
    elBtnRevealSolution.classList.add('confirming');
    elBtnRevealSolution.textContent = 'Tocca ancora per confermare';
    vibrate(15);
    state.confirmRevealTimeout = setTimeout(clearConfirmReveal, 3800);
    return;
  }

  clearConfirmReveal();
  stopTimer();
  vibrate([30, 40, 60]);

  const impostors = state.assignments.filter((a) => a.isImpostor);
  elSolutionImpostors.innerHTML = '';
  impostors.forEach((imp) => {
    const chip = document.createElement('span');
    chip.className = 'impostor-chip';
    chip.textContent = `🕵️ ${imp.name}`;
    elSolutionImpostors.appendChild(chip);
  });

  elSolutionWord.textContent = state.currentWord;
  elSolutionHint.textContent = state.currentHint;

  elSolutionCard.classList.remove('hidden');
  elBtnRevealSolution.classList.add('hidden');
  elPostGameActions.classList.remove('hidden');
});

elBtnNewRound.addEventListener('click', startNewRound);

elBtnEditPlayers.addEventListener('click', () => {
  stopTimer();
  renderSetup();
  showScreen('setup');
});

// ==================== INIT & SERVICE WORKER ====================
renderLogin();
showScreen('login');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // ignore if opened via file://
    });
  });
}
