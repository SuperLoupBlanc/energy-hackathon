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
  lift: false
};

let started = false;
let paused = false;
let energy = 0;
let inverse = 0;
let pressure = 1;
let yieldRate = 0;
let stability = 1;
let liftVelocity = 0;
let aiModel = null;

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

const chest = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), new THREE.MeshBasicMaterial({ color: 0x70e4ff }));
chest.position.set(0, 1.62, 0.39);
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
    pad.buttons[1]?.pressed ||
    pad.buttons[7]?.pressed
  );
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

  const levitating = keys.has(" ") || gamepadState.lift;
  const speed = levitating ? 10.5 : 6.2;
  player.position.x += dx * speed * dt;
  player.position.z += dz * speed * dt;
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

  const walk = moving ? Math.sin(t * 9) : 0;
  limbs[0].rotation.x = walk * 0.35;
  limbs[1].rotation.x = -walk * 0.35;
  limbs[2].rotation.x = -walk * 0.45;
  limbs[3].rotation.x = walk * 0.45;
  halo.rotation.z += dt * 3.4;
  chest.scale.setScalar(1 + Math.sin(t * 6) * 0.16);

  floor.position.x = player.position.x;
  floor.position.z = player.position.z;

  const distanceToCore = Math.hypot(player.position.x, player.position.z);
  pressure = 1 + Math.max(0, 28 - distanceToCore) / 13 + Math.sin(t * 0.7) * 0.08;
  const balance = energy - inverse;
  stability = Math.max(0, Math.min(1, 1 - Math.abs(balance) / 260));
  yieldRate = predictYield(distanceToCore, pressure, balance, stability);

  core.rotation.x += dt * (0.18 + pressure * 0.03);
  core.rotation.y += dt * (0.34 + yieldRate * 0.18);
  core.scale.setScalar(1 + (1 - stability) * 0.18 + Math.sin(t * 4) * 0.015);

  for (const ring of fieldRings) {
    ring.rotation.z += ring.userData.speed * pressure;
    ring.position.y = 0.04 + Math.sin(t + ring.geometry.parameters.radius) * 0.035;
  }

  const gravityRadius = 1.4 + Math.min(5.2, Math.sqrt(Math.max(0, energy)) * 0.17);
  const gravityStrength = 2.6 + Math.min(9.5, Math.sqrt(Math.max(0, energy)) * 0.22);

  for (const item of items) {
    item.rotation.x += dt * item.userData.spin;
    item.rotation.y += dt * item.userData.spin * 1.35;
    item.position.y += Math.sin(t * 2 + item.userData.phase) * dt * 0.18;

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

  if (stability < 0.35) {
    ui.tech.textContent = "Alerte: le flux inverse sature le noyau. Reviens pres du centre et collecte du flux oppose pour restaurer l'equilibre.";
  } else if (pressure > 2.4) {
    ui.tech.textContent = "Haute pression: le reseau silicium-verre hexagonal augmente l'absorption barocalorique et stabilise le froid inverse.";
  } else if (gamepadState.connected) {
    ui.tech.textContent = `Manette active: ${gamepadState.name}. Stick gauche pour naviguer, A/Croix pour amplifier la levitation.`;
  } else {
    ui.tech.textContent = "Correlation fictive: pression locale, ordre cristallin hexagonal et couplage magnetocalorique augmentent l'absorption passive du flux.";
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
