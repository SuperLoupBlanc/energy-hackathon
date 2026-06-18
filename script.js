const canvas = document.getElementById("game");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x020612, 0.032);

const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 130);
camera.position.set(0, 7, 15);

const clock = new THREE.Clock();
const keys = new Set();
const gamepadState = {
  connected: false,
  name: "",
  x: 0,
  z: 0,
  lift: false,
  dash: false,
  ultimate: false
};

let started = false;
let paused = false;
let energy = 0;
let inverse = 0;
let pressure = 1;
let yieldRate = 0;
let stability = 1;
let liftVelocity = 0;
let dashCooldown = 0;
let dashPulse = 0;
let dashX = 0;
let dashZ = -1;
let ultimateTime = 0;
let ultimateFadeTime = 0;
let ultimateCooldown = 0;
let ultimateHeld = false;
const ultimateCollapsePoint = new THREE.Vector3();
const ULTIMATE_ENERGY_COST = 2000;
const ULTIMATE_INVERSE_REMAINING_RATIO = 0.2;
const ULTIMATE_ACTIVE_DURATION = 4;
const ULTIMATE_FADE_DURATION = 3;
let gravityEventTimer = 18;
let gravityEventActive = false;
let gravityEventTime = 0;
let aiModel = null;
let audioContext = null;
let audioEnabled = false;
let musicStarted = false;
let musicTimer = null;
let youtubePlayer = null;
let youtubeReady = false;
let youtubeMusicOn = false;
let musicToggleHeld = false;
const DEFAULT_YOUTUBE_MUSIC = {
  videoId: "_qBI_K4Yp60",
  playlistId: "PLYBlFYdB237MbPsb0dTP4U_yfDDF35PPV",
  index: 0
};
let youtubeMusicId = localStorage.getItem("astrafluxYouTubeMusicId") || DEFAULT_YOUTUBE_MUSIC.videoId;
let youtubePlaylistId = localStorage.getItem("astrafluxYouTubePlaylistId") || DEFAULT_YOUTUBE_MUSIC.playlistId;
let youtubePlaylistIndex = parseInt(localStorage.getItem("astrafluxYouTubePlaylistIndex") || String(DEFAULT_YOUTUBE_MUSIC.index), 10) || DEFAULT_YOUTUBE_MUSIC.index;
let lastMusicTap = 0;
let musicTapTimer = null;
let modulePlayer = null;
let moduleBuffer = null;
let moduleMusicOn = false;
let moduleToggleHeld = false;
const AMIGA_MODULE_PATH = "assets/Dr_Awesome_Crusader_Now_what.mod";

const ui = {
  energy: document.getElementById("energyValue"),
  inverse: document.getElementById("inverseValue"),
  pressure: document.getElementById("pressureValue"),
  yield: document.getElementById("yieldValue"),
  balance: document.getElementById("balanceValue"),
  tech: document.getElementById("techText"),
  stability: document.getElementById("stabilityBar")
};

scene.add(new THREE.HemisphereLight(0x9bedff, 0x071027, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 2.1);
sun.position.set(4, 12, 7);
scene.add(sun);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(96, 96, 48, 48),
  new THREE.MeshStandardMaterial({
    color: 0x06162f,
    metalness: 0.25,
    roughness: 0.72,
    wireframe: true
  })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

function makeRing(radius, color, opacity = 0.5) {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.025, 8, 128),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity })
  );
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

const fieldRings = [];
for (let i = 0; i < 10; i += 1) {
  const ring = makeRing(2.6 + i * 1.75, i % 2 ? 0x70e4ff : 0xffd166, 0.42);
  ring.position.y = 0.04 + i * 0.025;
  ring.userData.speed = i % 2 ? 0.06 : -0.04;
  fieldRings.push(ring);
  scene.add(ring);
}

const core = new THREE.Group();
const coreMat = new THREE.MeshStandardMaterial({
  color: 0x0b2448,
  emissive: 0x06253b,
  metalness: 0.6,
  roughness: 0.26
});
const coreGlass = new THREE.MeshBasicMaterial({
  color: 0x70e4ff,
  transparent: true,
  opacity: 0.18,
  wireframe: true
});
core.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 2), coreMat));
core.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.28, 1), coreGlass));
core.position.set(0, 1.2, 0);
scene.add(core);

const gravityAstre = new THREE.Group();
const astreCore = new THREE.Mesh(
  new THREE.SphereGeometry(0.9, 20, 14),
  new THREE.MeshBasicMaterial({ color: 0x111827 })
);
const astreAura = new THREE.Mesh(
  new THREE.SphereGeometry(1.8, 20, 14),
  new THREE.MeshBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.18, wireframe: true })
);
gravityAstre.add(astreCore, astreAura);
gravityAstre.visible = false;
gravityAstre.position.set(-44, 6, -18);
scene.add(gravityAstre);

function capsule(radius, length, color, emissive = 0x000000) {
  return new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, length, 6, 12),
    new THREE.MeshStandardMaterial({
      color,
      emissive,
      metalness: 0.45,
      roughness: 0.28
    })
  );
}

const player = new THREE.Group();
const suitColor = 0x17335d;
const suitGlow = 0x06263c;
const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a286, roughness: 0.48 });
const hairMat = new THREE.MeshStandardMaterial({ color: 0x101022, roughness: 0.62 });

const torso = capsule(0.42, 1.05, suitColor, suitGlow);
torso.position.y = 1.45;
player.add(torso);

const collector = new THREE.Group();
collector.position.set(0, 1.6, 0.43);
const collectorPositiveColor = new THREE.Color(0x70e4ff);
const collectorInverseColor = new THREE.Color(0xff5f8f);
const collectorBalancedColor = new THREE.Color(0x86efac);
const collectorCore = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.19, 1),
  new THREE.MeshBasicMaterial({ color: 0x70e4ff })
);
const collectorShell = new THREE.Mesh(
  new THREE.IcosahedronGeometry(0.28, 1),
  new THREE.MeshBasicMaterial({ color: 0x70e4ff, transparent: true, opacity: 0.16, wireframe: true })
);
const collectorUltimateAura = new THREE.Mesh(
  new THREE.SphereGeometry(0.42, 16, 10),
  new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.0, wireframe: true })
);
const collectorRingA = new THREE.Mesh(
  new THREE.TorusGeometry(0.36, 0.014, 8, 48),
  new THREE.MeshBasicMaterial({ color: 0x70e4ff, transparent: true, opacity: 0.86 })
);
const collectorRingB = collectorRingA.clone();
collectorRingA.rotation.x = Math.PI / 2;
collectorRingB.rotation.y = Math.PI / 2;
collector.add(collectorCore, collectorShell, collectorRingA, collectorRingB, collectorUltimateAura);
for (const x of [-0.34, 0.34]) {
  const fin = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.34, 0.045),
    new THREE.MeshStandardMaterial({ color: 0x1c4a78, emissive: 0x08243a, metalness: 0.7, roughness: 0.22 })
  );
  fin.position.set(x, -0.02, -0.03);
  fin.rotation.z = x > 0 ? -0.32 : 0.32;
  collector.add(fin);
}
for (const x of [-0.18, 0.18]) {
  const coil = new THREE.Mesh(
    new THREE.TorusGeometry(0.07, 0.012, 6, 20),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.8 })
  );
  coil.position.set(x, -0.24, 0);
  coil.rotation.x = Math.PI / 2;
  collector.add(coil);
}
const chest = collector;
player.add(chest);

const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 16, 12), skinMat);
head.position.y = 2.3;
player.add(head);

const hair = new THREE.Mesh(
  new THREE.SphereGeometry(0.36, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.72),
  hairMat
);
hair.position.y = 2.42;
player.add(hair);

const limbs = [];
for (const x of [-0.62, 0.62]) {
  const arm = capsule(0.11, 0.9, suitColor, suitGlow);
  arm.position.set(x, 1.45, 0);
  arm.rotation.z = x > 0 ? -0.38 : 0.38;
  limbs.push(arm);
  player.add(arm);
}
for (const x of [-0.22, 0.22]) {
  const leg = capsule(0.12, 0.98, suitColor, suitGlow);
  leg.position.set(x, 0.55, 0);
  limbs.push(leg);
  player.add(leg);
}

const halo = makeRing(0.74, 0x70e4ff, 0.8);
halo.position.y = 1.55;
player.add(halo);
const ultimateRing = makeRing(1.25, 0xff5f8f, 0.0);
ultimateRing.position.y = 1.45;
player.add(ultimateRing);
scene.add(player);

const itemGeo = {
  positive: new THREE.OctahedronGeometry(0.28),
  inverse: new THREE.IcosahedronGeometry(0.34)
};
const itemMat = {
  positive: new THREE.MeshBasicMaterial({ color: 0x70e4ff, transparent: true, opacity: 0.95 }),
  inverse: new THREE.MeshBasicMaterial({ color: 0xff5f8f, transparent: true, opacity: 0.95 })
};
const items = [];

function placeItem(mesh, nearPlayer = false) {
  const a = Math.random() * Math.PI * 2;
  const d = (nearPlayer ? 8 : 5) + Math.random() * 24;
  mesh.position.set(
    player.position.x + Math.cos(a) * d,
    0.7 + Math.random() * 3.1,
    player.position.z + Math.sin(a) * d
  );
}

function spawnItem(type) {
  const mesh = new THREE.Mesh(itemGeo[type], itemMat[type]);
  mesh.userData = {
    type,
    spin: 0.5 + Math.random() * 2.2,
    phase: Math.random() * Math.PI * 2
  };
  placeItem(mesh);
  scene.add(mesh);
  items.push(mesh);
}

for (let i = 0; i < 120; i += 1) {
  spawnItem(i % 4 === 0 ? "inverse" : "positive");
}

const particles = new THREE.Points(
  new THREE.BufferGeometry(),
  new THREE.PointsMaterial({
    color: 0x70e4ff,
    size: 0.035,
    transparent: true,
    opacity: 0.62
  })
);
const particlePositions = new Float32Array(1500 * 3);
for (let i = 0; i < particlePositions.length; i += 3) {
  particlePositions[i] = (Math.random() - 0.5) * 76;
  particlePositions[i + 1] = Math.random() * 20;
  particlePositions[i + 2] = (Math.random() - 0.5) * 76;
}
particles.geometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
scene.add(particles);

const chart = new Chart(document.getElementById("chart"), {
  type: "line",
  data: {
    labels: Array.from({ length: 30 }, (_, i) => i),
    datasets: [
      {
        label: "rendement",
        data: Array(30).fill(0),
        borderColor: "#70e4ff",
        backgroundColor: "rgba(112,228,255,.12)",
        fill: true,
        tension: 0.35,
        pointRadius: 0
      },
      {
        label: "pression",
        data: Array(30).fill(0),
        borderColor: "#ffd166",
        backgroundColor: "rgba(255,209,102,.08)",
        tension: 0.35,
        pointRadius: 0
      }
    ]
  },
  options: {
    responsive: true,
    animation: false,
    plugins: { legend: { labels: { color: "#ecf8ff" } } },
    scales: {
      x: { ticks: { color: "#9cb5c6" }, grid: { color: "rgba(255,255,255,.05)" } },
      y: { min: 0, max: 100, ticks: { color: "#9cb5c6" }, grid: { color: "rgba(255,255,255,.05)" } }
    }
  }
});

async function initAI() {
  aiModel = tf.sequential();
  aiModel.add(tf.layers.dense({ inputShape: [4], units: 8, activation: "relu" }));
  aiModel.add(tf.layers.dense({ units: 1, activation: "sigmoid" }));
  aiModel.compile({ optimizer: "sgd", loss: "meanSquaredError" });

  const xs = tf.tensor2d([
    [0.0, 0.33, 0.0, 1.0],
    [0.2, 0.55, 0.1, 0.9],
    [0.5, 0.8, 0.4, 0.6],
    [0.8, 1.0, 0.8, 0.3],
    [1.0, 0.35, 1.0, 0.2]
  ]);
  const ys = tf.tensor2d([[0.78], [0.82], [0.58], [0.3], [0.12]]);
  await aiModel.fit(xs, ys, { epochs: 12, verbose: 0 });
  xs.dispose();
  ys.dispose();
}
initAI();

function ensureAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  audioEnabled = true;
}

function playTone({ frequency, endFrequency, duration, type, gain, pan = 0 }) {
  if (!audioEnabled || !audioContext) return;

  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const amp = audioContext.createGain();
  const stereo = audioContext.createStereoPanner ? audioContext.createStereoPanner() : null;

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);

  amp.gain.setValueAtTime(0.0001, now);
  amp.gain.exponentialRampToValueAtTime(gain, now + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  if (stereo) {
    stereo.pan.setValueAtTime(pan, now);
    osc.connect(amp).connect(stereo).connect(audioContext.destination);
  } else {
    osc.connect(amp).connect(audioContext.destination);
  }

  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function startAIMusic() {
  if (musicStarted || !audioEnabled || !audioContext) return;
  musicStarted = true;

  const master = audioContext.createGain();
  master.gain.value = 0.055;
  master.connect(audioContext.destination);

  const delay = audioContext.createDelay(1.2);
  const feedback = audioContext.createGain();
  const wet = audioContext.createGain();
  delay.delayTime.value = 0.42;
  feedback.gain.value = 0.28;
  wet.gain.value = 0.16;
  delay.connect(feedback).connect(delay);
  delay.connect(wet).connect(master);

  const scale = [110, 146.83, 164.81, 220, 293.66, 329.63, 440];
  let step = 0;

  function note(freq, when, length, gain, type = "sine") {
    const osc = audioContext.createOscillator();
    const amp = audioContext.createGain();
    const filter = audioContext.createBiquadFilter();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.006, when + length);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900 + pressure * 180, when);
    filter.Q.value = 0.7;
    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.exponentialRampToValueAtTime(gain, when + 0.05);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + length);

    osc.connect(filter).connect(amp).connect(master);
    amp.connect(delay);
    osc.start(when);
    osc.stop(when + length + 0.05);
  }

  function pulse() {
    if (!audioEnabled || !audioContext) return;

    const now = audioContext.currentTime;
    const balance = Math.abs(energy - inverse);
    const tension = THREE.MathUtils.clamp(balance / 220, 0, 1);
    const root = scale[step % scale.length];
    const fifth = root * 1.5;
    const high = scale[(step + 3) % scale.length] * 2;

    note(root * 0.5, now, 1.8, 0.035 + tension * 0.015, "sine");
    if (step % 2 === 0) note(fifth, now + 0.08, 0.9, 0.018, "triangle");
    if (step % 4 === 1) note(high, now + 0.22, 0.45, 0.012, "sine");

    step += pressure > 2.2 ? 2 : 1;
  }

  pulse();
  musicTimer = setInterval(pulse, 900);
}

function parseYouTubeMusic(value) {
  const empty = { videoId: "", playlistId: "", index: 0 };
  if (!value) return empty;
  const text = value.trim();

  try {
    const url = new URL(text);
    const playlistId = url.searchParams.get("list") || "";
    const rawIndex = parseInt(url.searchParams.get("index") || "1", 10);
    const index = Math.max(0, (Number.isFinite(rawIndex) ? rawIndex : 1) - 1);
    let videoId = "";

    if (url.hostname.includes("youtu.be")) videoId = url.pathname.replace("/", "");
    if (url.searchParams.get("v")) videoId = url.searchParams.get("v") || "";

    const embed = url.pathname.match(/\/(?:embed|shorts|live)\/([^/?#]+)/);
    if (embed) videoId = embed[1];

    return { videoId, playlistId, index };
  } catch (error) {
    if (/^[a-zA-Z0-9_-]{8,}$/.test(text)) return { videoId: text, playlistId: "", index: 0 };
  }

  return empty;
}

function storeYouTubeMusic(parsed) {
  youtubeMusicId = parsed.videoId || "";
  youtubePlaylistId = parsed.playlistId || "";
  youtubePlaylistIndex = parsed.index || 0;
  localStorage.setItem("astrafluxYouTubeMusicId", youtubeMusicId);
  localStorage.setItem("astrafluxYouTubePlaylistId", youtubePlaylistId);
  localStorage.setItem("astrafluxYouTubePlaylistIndex", String(youtubePlaylistIndex));
}

function getStoredYouTubeMusic() {
  if (!youtubeMusicId && !youtubePlaylistId) return null;
  return {
    videoId: youtubeMusicId,
    playlistId: youtubePlaylistId,
    index: youtubePlaylistIndex
  };
}

function getYouTubeMusicId() {
  const stored = getStoredYouTubeMusic();
  if (stored) return stored;

  const url = prompt("Colle un lien YouTube vidéo ou playlist pour la musique AstraFlux :");
  const parsed = parseYouTubeMusic(url || "");
  if (parsed.videoId || parsed.playlistId) {
    storeYouTubeMusic(parsed);
    ui.tech.textContent = parsed.playlistId
      ? `Playlist YouTube chargée à partir de l'index ${parsed.index + 1}.`
      : "Vidéo YouTube chargée pour la musique.";
    return parsed;
  }
  return null;
}

function promptYouTubeMusicId() {
  const currentUrl = youtubePlaylistId
    ? `https://www.youtube.com/watch?list=${youtubePlaylistId}&index=${youtubePlaylistIndex + 1}${youtubeMusicId ? `&v=${youtubeMusicId}` : ""}`
    : youtubeMusicId ? `https://www.youtube.com/watch?v=${youtubeMusicId}` : "";
  const url = prompt("Nouveau lien YouTube vidéo ou playlist :", currentUrl);
  const parsed = parseYouTubeMusic(url || "");
  if (!parsed.videoId && !parsed.playlistId) return false;

  storeYouTubeMusic(parsed);
  youtubeMusicOn = true;

  if (youtubePlayer) {
    youtubeReady = true;
    loadYouTubeMusic();
    youtubePlayer.playVideo();
  } else {
    youtubeReady = false;
    createYouTubePlayer();
  }

  ui.tech.textContent = youtubePlaylistId
    ? `Musique YouTube mise à jour : playlist index ${youtubePlaylistIndex + 1}.`
    : "Musique YouTube mise à jour : vidéo.";
  return true;
}

function loadYouTubeMusic() {
  if (!youtubePlayer) return;
  if (youtubePlaylistId && youtubePlayer.loadPlaylist) {
    youtubePlayer.loadPlaylist({
      list: youtubePlaylistId,
      listType: "playlist",
      index: youtubePlaylistIndex,
      startSeconds: 0
    });
    if (youtubeMusicOn && youtubePlayer.playVideo) {
      setTimeout(() => youtubePlayer.playVideo(), 120);
    }
    return;
  }
  if (youtubeMusicId && youtubePlayer.loadVideoById) {
    youtubePlayer.loadVideoById(youtubeMusicId);
    if (youtubeMusicOn && youtubePlayer.playVideo) {
      setTimeout(() => youtubePlayer.playVideo(), 120);
    }
  }
}

function createYouTubePlayer() {
  if (youtubePlayer || !window.YT || !YT.Player) return;

  const holder = document.createElement("div");
  holder.id = "youtubeMusic";
  holder.style.position = "fixed";
  holder.style.left = "-9999px";
  holder.style.top = "0";
  holder.style.width = "1px";
  holder.style.height = "1px";
  document.body.appendChild(holder);

  youtubePlayer = new YT.Player("youtubeMusic", {
    width: 1,
    height: 1,
    videoId: youtubeMusicId || undefined,
    playerVars: {
      autoplay: 0,
      controls: 0,
      loop: 1,
      playlist: youtubePlaylistId || youtubeMusicId || undefined,
      list: youtubePlaylistId || undefined,
      listType: youtubePlaylistId ? "playlist" : undefined,
      index: youtubePlaylistIndex || undefined,
      modestbranding: 1,
      playsinline: 1
    },
    events: {
      onReady: () => {
        youtubeReady = true;
        youtubePlayer.setVolume(38);
        if (youtubePlaylistId) loadYouTubeMusic();
        if (youtubeMusicOn) youtubePlayer.playVideo();
      }
    }
  });
}

window.onYouTubeIframeAPIReady = () => {
  youtubeReady = false;
};

function toggleYouTubeMusic() {
  const music = getYouTubeMusicId();
  if (!music) return;

  youtubeMusicOn = !youtubeMusicOn;
  if (youtubeMusicOn && modulePlayer && moduleMusicOn) {
    modulePlayer.togglePause();
    moduleMusicOn = false;
  }
  if (!youtubePlayer) createYouTubePlayer();

  if (!youtubeReady || !youtubePlayer) {
    ui.tech.textContent = youtubeMusicOn
      ? "Musique YouTube en chargement. Appuie sur M après quelques secondes pour pause/play."
      : "Musique YouTube en pause.";
    return;
  }

  if (youtubeMusicOn) {
    youtubePlayer.playVideo();
  } else {
    youtubePlayer.pauseVideo();
  }
}

function handleMusicKey() {
  const now = performance.now();

  if (now - lastMusicTap < 360) {
    clearTimeout(musicTapTimer);
    musicTapTimer = null;
    lastMusicTap = 0;
    promptYouTubeMusicId();
    return;
  }

  lastMusicTap = now;
  clearTimeout(musicTapTimer);
  musicTapTimer = setTimeout(() => {
    toggleYouTubeMusic();
    musicTapTimer = null;
  }, 240);
}

function stopYouTubeMusic() {
  youtubeMusicOn = false;
  if (youtubePlayer && youtubePlayer.pauseVideo) {
    youtubePlayer.pauseVideo();
  }
}

function ensureOpenMptRuntime() {
  if (typeof libopenmpt !== "undefined" && libopenmpt._openmpt_module_create_from_memory) return true;

  if (window.libopenmpt && window.libopenmpt._openmpt_module_create_from_memory) {
    return true;
  }

  if (window.Module) {
    window.libopenmpt = window.Module;
    if (window.libopenmpt._openmpt_module_create_from_memory) return true;
  }

  ui.tech.textContent = "Runtime OpenMPT en chargement. Réappuie sur P dans quelques secondes.";
  return false;
}

function ensureModulePlayer() {
  if (modulePlayer) return true;
  if (!ensureOpenMptRuntime()) return false;
  if (!window.ChiptuneJsPlayer || !window.ChiptuneJsConfig) {
    ui.tech.textContent = "Lecteur module Amiga indisponible : chiptune2.js n'est pas encore chargé.";
    return false;
  }

  modulePlayer = new ChiptuneJsPlayer(new ChiptuneJsConfig(-1));
  modulePlayer.onError(() => {
    moduleMusicOn = false;
    ui.tech.textContent = "Erreur de lecture du module Amiga.";
  });
  return true;
}

function playAmigaModule() {
  if (!ensureModulePlayer()) return;
  stopYouTubeMusic();

  if (moduleBuffer) {
    modulePlayer.play(moduleBuffer);
    moduleMusicOn = true;
    ui.tech.textContent = "Module Amiga: Dr Awesome - Crusader Now What.";
    return;
  }

  ui.tech.textContent = "Chargement du module Amiga...";
  modulePlayer.load(AMIGA_MODULE_PATH, (buffer) => {
    moduleBuffer = buffer;
    modulePlayer.play(moduleBuffer);
    moduleMusicOn = true;
    ui.tech.textContent = "Module Amiga: Dr Awesome - Crusader Now What.";
  });
}

function toggleAmigaModule() {
  if (!moduleMusicOn) {
    playAmigaModule();
    return;
  }

  if (modulePlayer) {
    modulePlayer.togglePause();
    moduleMusicOn = false;
    ui.tech.textContent = "Module Amiga en pause.";
  }
}

function playCollectSound(type, xPosition) {
  const pan = THREE.MathUtils.clamp(xPosition / 18, -0.8, 0.8);

  if (type === "positive") {
    playTone({ frequency: 520, endFrequency: 980, duration: 0.11, type: "sine", gain: 0.075, pan });
    setTimeout(() => playTone({ frequency: 780, endFrequency: 1320, duration: 0.09, type: "triangle", gain: 0.045, pan }), 28);
    return;
  }

  playTone({ frequency: 150, endFrequency: 92, duration: 0.16, type: "sine", gain: 0.07, pan });
  setTimeout(() => playTone({ frequency: 220, endFrequency: 138, duration: 0.13, type: "triangle", gain: 0.045, pan }), 22);
  setTimeout(() => playTone({ frequency: 74, endFrequency: 58, duration: 0.2, type: "sine", gain: 0.035, pan }), 48);
}

function triggerUltimate() {
  if (ultimateCooldown > 0 || ultimateTime > 0) return;

  if (energy < ULTIMATE_ENERGY_COST || inverse <= 0) {
    ui.tech.textContent = `Ultimate indisponible : il faut ${ULTIMATE_ENERGY_COST} Énergie+ et de l'énergie inverse à condenser.`;
    return;
  }

  energy -= ULTIMATE_ENERGY_COST;
  inverse *= ULTIMATE_INVERSE_REMAINING_RATIO;
  ultimateTime = ULTIMATE_ACTIVE_DURATION;
  ultimateFadeTime = ULTIMATE_FADE_DURATION;
  ultimateCooldown = 10;
  ultimateCollapsePoint.copy(player.position);
  ui.tech.textContent = `Ultimate : ${ULTIMATE_ENERGY_COST} Énergie+ consommée, 80% du flux inverse neutralisé.`;
}

function predictYield(distance, pressureValue, balance, stabilityValue) {
  const base = Math.max(0, Math.min(1, pressureValue / (1.15 + distance * 0.05) - Math.abs(balance) * 0.002));
  if (!aiModel) return base;

  const input = tf.tensor2d([[
    Math.min(1, distance / 30),
    Math.min(1, pressureValue / 3),
    Math.min(1, Math.abs(balance) / 180),
    stabilityValue
  ]]);
  const prediction = aiModel.predict(input);
  const value = prediction.dataSync()[0];
  input.dispose();
  prediction.dispose();
  return Math.max(0, Math.min(1, value * 0.72 + base * 0.28));
}

function readGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = [...pads].find(Boolean);

  if (!pad) {
    gamepadState.connected = false;
    gamepadState.x = 0;
    gamepadState.z = 0;
    gamepadState.lift = false;
    gamepadState.dash = false;
    gamepadState.ultimate = false;
    return;
  }

  const deadzone = 0.16;
  const rawX = pad.axes[0] || 0;
  const rawZ = pad.axes[1] || 0;
  const magnitude = Math.hypot(rawX, rawZ);
  const scale = magnitude > deadzone ? Math.min(1, (magnitude - deadzone) / (1 - deadzone)) / magnitude : 0;

  gamepadState.connected = true;
  gamepadState.name = pad.id || "Gamepad";
  gamepadState.x = rawX * scale;
  gamepadState.z = rawZ * scale;
  gamepadState.lift = Boolean(
    pad.buttons[0]?.pressed ||
    pad.buttons[7]?.pressed
  );
  gamepadState.dash = Boolean(pad.buttons[1]?.pressed);
  gamepadState.ultimate = Boolean(pad.buttons[2]?.pressed);
}

addEventListener("keydown", (event) => keys.add(event.key.toLowerCase()));
addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
addEventListener("gamepadconnected", (event) => {
  gamepadState.connected = true;
  gamepadState.name = event.gamepad.id || "Gamepad";
});
addEventListener("gamepaddisconnected", () => {
  gamepadState.connected = false;
  gamepadState.name = "";
});

document.getElementById("startBtn").onclick = () => {
  ensureAudio();
  started = true;
  document.getElementById("startScreen").classList.add("hidden");
};
document.getElementById("pauseBtn").onclick = () => {
  paused = !paused;
  document.getElementById("pauseBtn").textContent = paused ? "Reprendre" : "Pause";
};
document.getElementById("fullscreenBtn").onclick = () => document.documentElement.requestFullscreen?.();

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
addEventListener("resize", resize);

let chartTimer = 0;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.033);
  const t = clock.elapsedTime;

  if (!started || paused) {
    core.rotation.y += dt * 0.25;
    renderer.render(scene, camera);
    return;
  }

  readGamepad();

  if (keys.has("m")) {
    if (!musicToggleHeld) {
      handleMusicKey();
      musicToggleHeld = true;
    }
  } else {
    musicToggleHeld = false;
  }

  if (keys.has("p")) {
    if (!moduleToggleHeld) {
      toggleAmigaModule();
      moduleToggleHeld = true;
    }
  } else {
    moduleToggleHeld = false;
  }

  let dx = 0;
  let dz = 0;
  if (keys.has("z") || keys.has("arrowup")) dz -= 1;
  if (keys.has("s") || keys.has("arrowdown")) dz += 1;
  if (keys.has("q") || keys.has("arrowleft")) dx -= 1;
  if (keys.has("d") || keys.has("arrowright")) dx += 1;
  dx += gamepadState.x;
  dz += gamepadState.z;

  const moving = dx !== 0 || dz !== 0;
  const length = Math.hypot(dx, dz) || 1;
  dx /= length;
  dz /= length;

  dashCooldown = Math.max(0, dashCooldown - dt);
  dashPulse = Math.max(0, dashPulse - dt * 5.4);
  ultimateCooldown = Math.max(0, ultimateCooldown - dt);
  if (ultimateTime > 0) {
    ultimateTime = Math.max(0, ultimateTime - dt);
  } else {
    ultimateFadeTime = Math.max(0, ultimateFadeTime - dt);
  }
  const dashPressed = keys.has("shift") || gamepadState.dash;
  if (dashPressed && dashCooldown <= 0) {
    dashCooldown = 0.72;
    dashPulse = 1;
    dashX = moving ? dx : Math.sin(player.rotation.y);
    dashZ = moving ? dz : Math.cos(player.rotation.y);
  }

  const ultimatePressed = keys.has("u") || gamepadState.ultimate;
  if (ultimatePressed) {
    if (!ultimateHeld) {
      triggerUltimate();
      ultimateHeld = true;
    }
  } else {
    ultimateHeld = false;
  }

  const levitating = keys.has(" ") || gamepadState.lift;
  const speed = levitating ? 10.5 : 6.2;
  player.position.x += dx * speed * dt;
  player.position.z += dz * speed * dt;
  if (dashPulse > 0) {
    const dashPower = 30 * dashPulse * dashPulse;
    player.position.x += dashX * dashPower * dt;
    player.position.z += dashZ * dashPower * dt;
  }

  if (moving || dashPulse > 0 || levitating) {
    const moveCost = (moving ? 1.35 : 0) + (levitating ? 1.1 : 0) + dashPulse * 5.2;
    energy = Math.max(0, energy - moveCost * dt);
  } else {
    inverse = Math.max(0, inverse - 1.05 * dt);
  }

  player.position.x = THREE.MathUtils.clamp(player.position.x, -30, 30);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -30, 30);

  if (levitating) {
    liftVelocity += 18 * dt;
  } else {
    liftVelocity -= 10 * dt;
  }
  liftVelocity = THREE.MathUtils.clamp(liftVelocity, 0, 2.45);
  player.position.y = Math.sin(t * 3.1) * 0.08 + liftVelocity;

  if (moving) {
    player.rotation.y = Math.atan2(dx, dz);
  }

  const distanceToCore = Math.hypot(player.position.x, player.position.z);
  pressure = 1 + Math.max(0, 28 - distanceToCore) / 13 + Math.sin(t * 0.7) * 0.08;
  const balance = energy - inverse;
  stability = Math.max(0, Math.min(1, 1 - Math.abs(balance) / 260));
  yieldRate = predictYield(distanceToCore, pressure, balance, stability);

  const walk = moving ? Math.sin(t * 9) : 0;
  limbs[0].rotation.x = walk * 0.35;
  limbs[1].rotation.x = -walk * 0.35;
  limbs[2].rotation.x = -walk * 0.45;
  limbs[3].rotation.x = walk * 0.45;
  halo.rotation.z += dt * 3.4;
  chest.scale.setScalar(1 + Math.sin(t * 6) * 0.16);
  const imbalanceAmount = THREE.MathUtils.clamp(Math.abs(balance) / 180, 0, 1);
  const targetCollectorColor = balance < -45
    ? collectorPositiveColor
    : balance > 45
      ? collectorInverseColor
      : collectorBalancedColor;
  collectorCore.material.color.lerp(targetCollectorColor, 0.12);
  collectorShell.material.color.lerp(targetCollectorColor, 0.08);
  collectorRingA.material.color.lerp(targetCollectorColor, 0.08);
  collectorRingB.material.color.lerp(targetCollectorColor, 0.08);
  collectorShell.material.opacity = 0.14 + imbalanceAmount * 0.22;
  collectorRingA.material.opacity = 0.62 + imbalanceAmount * 0.32;
  collectorRingB.material.opacity = 0.62 + imbalanceAmount * 0.32;
  const ultimateReady = energy >= ULTIMATE_ENERGY_COST && inverse > 0 && ultimateCooldown <= 0 && ultimateTime <= 0;
  const ultimatePulse = ultimateReady ? 0.5 + Math.sin(t * 7) * 0.5 : 0;
  collectorUltimateAura.material.opacity = ultimateReady ? 0.18 + ultimatePulse * 0.34 : Math.max(0, collectorUltimateAura.material.opacity - dt * 2.5);
  collectorUltimateAura.scale.setScalar(1.05 + ultimatePulse * 0.45);
  collectorRingA.scale.setScalar(1 + ultimatePulse * 0.12);
  collectorRingB.scale.setScalar(1 + ultimatePulse * 0.12);
  collectorCore.rotation.y += dt * (2.2 + yieldRate * 2);
  collectorShell.rotation.x -= dt * 0.8;
  collectorRingA.rotation.z += dt * (2.5 + pressure * 0.4);
  collectorRingB.rotation.x -= dt * (2.1 + yieldRate);
  halo.scale.setScalar(1 + dashPulse * 0.55);
  ultimateRing.rotation.z -= dt * 8;
  const ultimateFadePower = ultimateTime > 0 ? 1 : ultimateFadeTime / ULTIMATE_FADE_DURATION;
  ultimateRing.material.opacity = ultimateFadePower > 0 ? 0.18 + ultimateFadePower * 0.6 : 0;
  ultimateRing.scale.setScalar(
    ultimateFadePower > 0
      ? 1 + (ULTIMATE_ACTIVE_DURATION - ultimateTime + (1 - ultimateFadePower)) * 2.2
      : 1
  );

  floor.position.x = player.position.x;
  floor.position.z = player.position.z;

  gravityEventTimer -= dt;
  if (!gravityEventActive && gravityEventTimer <= 0) {
    gravityEventActive = true;
    gravityEventTime = 0;
    gravityAstre.visible = true;
  }

  if (gravityEventActive) {
    gravityEventTime += dt;
    const pass = gravityEventTime / 9;
    gravityAstre.position.set(
      THREE.MathUtils.lerp(-44, 44, pass),
      5.6 + Math.sin(pass * Math.PI) * 2.2,
      Math.sin(pass * Math.PI * 2) * 18
    );
    gravityAstre.rotation.y += dt * 1.4;
    gravityAstre.rotation.x += dt * 0.8;

    if (pass >= 1) {
      gravityEventActive = false;
      gravityAstre.visible = false;
      gravityEventTimer = 24 + Math.random() * 16;
    }
  }

  core.rotation.x += dt * (0.18 + pressure * 0.03);
  core.rotation.y += dt * (0.34 + yieldRate * 0.18);
  core.scale.setScalar(1 + (1 - stability) * 0.18 + Math.sin(t * 4) * 0.015);

  for (const ring of fieldRings) {
    ring.rotation.z += ring.userData.speed * pressure;
    ring.position.y = 0.04 + Math.sin(t + ring.geometry.parameters.radius) * 0.035;
  }

  const gravityRadius = 1.4 + Math.min(5.2, Math.sqrt(Math.max(0, energy)) * 0.17);
  const gravityStrength = 2.6 + Math.min(9.5, Math.sqrt(Math.max(0, energy)) * 0.22);
  const correctionType = balance < -70 ? "positive" : balance > 70 ? "inverse" : "";
  const correctionPower = correctionType ? THREE.MathUtils.clamp((Math.abs(balance) - 70) / 430, 0, 1) : 0;
  const correctionRadius = 10 + correctionPower * 24;
  const correctionStrength = 1.8 + correctionPower * 10;

  for (const item of items) {
    item.rotation.x += dt * item.userData.spin;
    item.rotation.y += dt * item.userData.spin * 1.35;
    item.position.y += Math.sin(t * 2 + item.userData.phase) * dt * 0.18;

    const centerDistance = Math.hypot(item.position.x, item.position.z);
    if (centerDistance > 8) {
      const centerPull = new THREE.Vector3(-item.position.x, 0, -item.position.z).normalize();
      const passivePull = Math.min(0.45, (centerDistance - 8) * 0.006);
      item.position.addScaledVector(centerPull, passivePull * dt);
    }

    if (correctionType && item.userData.type === correctionType) {
      const correctionDistance = item.position.distanceTo(player.position);
      if (correctionDistance < correctionRadius && correctionDistance > 0.05) {
        const pullToPlayer = player.position.clone().sub(item.position).normalize();
        const falloff = 1 - correctionDistance / correctionRadius;
        item.position.addScaledVector(pullToPlayer, correctionStrength * falloff * falloff * dt);
        item.scale.setScalar(Math.max(item.scale.x, 1 + correctionPower * falloff * 0.8));
      }
    }

    if (gravityEventActive && centerDistance > 14) {
      const astreDistance = item.position.distanceTo(gravityAstre.position);
      const astreRange = 28;
      if (astreDistance < astreRange) {
        const pullToAstre = gravityAstre.position.clone().sub(item.position).normalize();
        const astrePull = (1 - astreDistance / astreRange) * 7.5;
        item.position.addScaledVector(pullToAstre, astrePull * dt);
      }

      const returnPull = new THREE.Vector3(-item.position.x, 0, -item.position.z).normalize();
      item.position.addScaledVector(returnPull, Math.min(3.2, centerDistance * 0.035) * dt);
    }

    if ((ultimateTime > 0 || ultimateFadeTime > 0) && item.userData.type === "inverse") {
      const collapseTarget = ultimateTime > 0 ? player.position : ultimateCollapsePoint;
      const ultimateDistance = item.position.distanceTo(collapseTarget);
      const ultimateRange = 34;
      if (ultimateDistance < ultimateRange && ultimateDistance > 0.05) {
        const pullToPlayer = collapseTarget.clone().sub(item.position).normalize();
        const liftBias = new THREE.Vector3(0, 0.32, 0);
        const falloff = 1 - ultimateDistance / ultimateRange;
        const phasePower = ultimateTime > 0 ? 1 : ultimateFadeTime / ULTIMATE_FADE_DURATION;
        item.position.addScaledVector(
          pullToPlayer.add(liftBias).normalize(),
          (12 + pressure * 4) * phasePower * falloff * falloff * dt
        );
        item.scale.setScalar(1.2 + falloff * 0.7);
      }
    }

    const dist = item.position.distanceTo(player.position);
    if (dist < gravityRadius && dist > 0.04) {
      const pull = player.position.clone().sub(item.position).normalize();
      const falloff = 1 - dist / gravityRadius;
      item.position.addScaledVector(pull, gravityStrength * falloff * falloff * dt);
      item.scale.setScalar(1 + falloff * 0.35);
    } else {
      item.scale.setScalar(1);
    }

    const collectDist = item.position.distanceTo(player.position);
    if (collectDist < 1.25) {
      if (item.userData.type === "positive") {
        energy += 6 + yieldRate * 10;
      } else {
        inverse += 5 + pressure * 2.4;
      }
      playCollectSound(item.userData.type, item.position.x - player.position.x);
      placeItem(item, true);
    }
  }

  const pos = particles.geometry.attributes.position.array;
  for (let i = 0; i < pos.length; i += 3) {
    pos[i + 1] -= dt * (0.75 + pressure * 0.22);
    if (pos[i + 1] < 0) pos[i + 1] = 20;
  }
  particles.geometry.attributes.position.needsUpdate = true;
  particles.rotation.y += dt * 0.035;

  camera.position.x += (player.position.x - camera.position.x) * 0.055;
  camera.position.y += (6.8 + player.position.y - camera.position.y) * 0.04;
  camera.position.z += (player.position.z + 14.5 - camera.position.z) * 0.055;
  camera.lookAt(player.position.x, 1.25, player.position.z);

  ui.energy.textContent = Math.floor(energy).toString();
  ui.inverse.textContent = Math.floor(inverse).toString();
  ui.pressure.textContent = `${pressure.toFixed(2)} atm`;
  ui.yield.textContent = `${Math.round(yieldRate * 100)} %`;
  ui.balance.textContent = Math.floor(balance).toString();
  ui.balance.style.color = Math.abs(balance) < 45 ? "#70e4ff" : "#ff5f8f";
  ui.stability.style.width = `${Math.round(stability * 100)}%`;

  if (ultimateTime > 0) {
    ui.tech.textContent = `Ultimate actif : flux inverses attirés vers Nyra (${ultimateTime.toFixed(1)}s).`;
  } else if (ultimateFadeTime > 0) {
    ui.tech.textContent = `Décélération gravitationnelle : les flux inverses glissent vers le point d'effondrement (${ultimateFadeTime.toFixed(1)}s).`;
  } else if (correctionType) {
    ui.tech.textContent = correctionType === "positive"
      ? "Correction du noyau : déficit positif détecté. Le collecteur ouvre ses lignes de champ vers les flux Énergie+."
      : "Correction du noyau : surplus positif détecté. Le noyau froid augmente sa capture de flux inverse.";
  } else if (gravityEventActive) {
    ui.tech.textContent = "Événement gravitationnel : un astre dense traverse le champ et replie les flux dispersés vers la zone de pression.";
  } else if (stability < 0.35) {
    ui.tech.textContent = "Alerte : le noyau froid perd son ordre hexagonal. Restaure l'équilibre des polarités avant saturation.";
  } else if (pressure > 2.4) {
    ui.tech.textContent = "Haute pression : le réseau silicium-verre se compacte, l'effet barocalorique fictif augmente le rendement.";
  } else if (gamepadState.connected) {
    ui.tech.textContent = `Manette active : ${gamepadState.name}. Stick gauche pour naviguer, A/Croix pour amplifier la lévitation.`;
  } else {
    ui.tech.textContent = "Hypothèse AstraFlux : pression, ordre hexagonal et couplage magnétocalorique rendent l'extraction passive plus efficace.";
  }

  chartTimer += dt;
  if (chartTimer > 0.5) {
    chartTimer = 0;
    chart.data.datasets[0].data.push(Math.round(yieldRate * 100));
    chart.data.datasets[0].data.shift();
    chart.data.datasets[1].data.push(Math.round(Math.min(100, pressure * 30)));
    chart.data.datasets[1].data.shift();
    chart.update();
  }

  renderer.render(scene, camera);
}

animate();
