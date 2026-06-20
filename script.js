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
let idleTime = 0;
const ultimateCollapsePoint = new THREE.Vector3();
const collectionPoint = new THREE.Vector3();
const ULTIMATE_ENERGY_COST = 2000;
const ULTIMATE_INVERSE_REMAINING_RATIO = 0.2;
const ULTIMATE_ACTIVE_DURATION = 4;
const ULTIMATE_FADE_DURATION = 3;
let gravityEventTimer = 18;
let gravityEventActive = false;
let gravityEventTime = 0;
let coreMass = 0;
let coreCollapse = 0;
let coreBigBangTime = 0;
let bigBangElasticTime = 0;
const BIG_BANG_ELASTIC_DURATION = 1.8;
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
let modulePlayRequest = 0;
let moduleToggleHeld = false;
let hudToggleHeld = false;
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
const coreMat = new THREE.MeshBasicMaterial({ color: 0x39ff56, transparent: true, opacity: 0.18 });
const coreGlass = new THREE.MeshBasicMaterial({
  color: 0x39ff56,
  transparent: true,
  opacity: 0.86
});
const coreOuter = new THREE.Group();
const coreCross = new THREE.Group();

function addBrainLine(points, material) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points.map(([x, y, z = 0]) => new THREE.Vector3(x, y, z)));
  const line = new THREE.Line(geometry, material);
  coreOuter.add(line);
  return line;
}

function addBrainNode(x, y, z, color = 0x39ff56, size = 0.035) {
  const node = new THREE.Mesh(
    new THREE.SphereGeometry(size, 8, 6),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
  );
  node.position.set(x, y, z);
  coreCross.add(node);
  return node;
}

const brainLineMat = coreGlass;
const brainMidMat = new THREE.LineBasicMaterial({ color: 0xd4ff45, transparent: true, opacity: 0.82 });
const brainNodes = [];
const brainMeshModel = window.DEFEND_BRAIN_MESH_MODEL;
let coreBrainSurface = null;
let coreBrainWire = null;
if (brainMeshModel) {
  const positions = new Float32Array(brainMeshModel.vertices.flat());
  const indices = new Uint32Array(brainMeshModel.faces.flat());
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  coreBrainSurface = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: 0x39ff56,
      transparent: true,
      opacity: 0.055,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  const edgePositions = new Float32Array(brainMeshModel.edges.length * 6);
  brainMeshModel.edges.forEach(([a, b], index) => {
    const offset = index * 6;
    const pa = brainMeshModel.vertices[a];
    const pb = brainMeshModel.vertices[b];
    edgePositions.set([pa[0], pa[1], pa[2], pb[0], pb[1], pb[2]], offset);
  });
  const wireGeometry = new THREE.BufferGeometry();
  wireGeometry.setAttribute("position", new THREE.BufferAttribute(edgePositions, 3));
  coreBrainWire = new THREE.LineSegments(
    wireGeometry,
    new THREE.LineBasicMaterial({
      color: 0x39ff56,
      transparent: true,
      opacity: 0.82
    })
  );
  coreOuter.add(coreBrainSurface, coreBrainWire);

  for (const index of brainMeshModel.mid || []) {
    const [x, y, z] = brainMeshModel.vertices[index];
    brainNodes.push(addBrainNode(x, y, z, 0xd4ff45, 0.025));
  }
  for (const index of brainMeshModel.green || []) {
    const [x, y, z] = brainMeshModel.vertices[index];
    brainNodes.push(addBrainNode(x, y, z, 0x39ff56, 0.018));
  }
} else {
  const brainModel = window.DEFEND_BRAIN_CORE_MODEL || {
    nodes: [[-0.7, 0.7, 0.12], [0.7, 0.7, -0.12], [-0.9, 0, 0.18], [0.9, 0, -0.18], [-0.45, -0.72, 0.08], [0.45, -0.72, -0.08], [0, 0.88, 0], [0, -0.88, 0]],
    edges: [[0, 2], [2, 4], [4, 7], [7, 5], [5, 3], [3, 1], [1, 6], [6, 0], [0, 3], [1, 2], [4, 5], [6, 7]],
    mid: [6, 7]
  };
  for (const [a, b] of brainModel.edges) {
    const pa = brainModel.nodes[a];
    const pb = brainModel.nodes[b];
    const material = brainModel.mid.includes(a) && brainModel.mid.includes(b) ? brainMidMat : brainLineMat;
    addBrainLine([pa, pb], material);
  }
  for (let i = 0; i < brainModel.nodes.length; i += 1) {
    const [x, y, z] = brainModel.nodes[i];
    const isMid = brainModel.mid.includes(i);
    brainNodes.push(addBrainNode(x, y, z, isMid ? 0xd4ff45 : 0x39ff56, isMid ? 0.035 : 0.03));
  }
}
const coreInner = new THREE.Mesh(
  new THREE.SphereGeometry(1.02, 24, 12),
  new THREE.MeshBasicMaterial({ color: 0x39ff56, transparent: true, opacity: 0.035, wireframe: true })
);
core.add(coreInner, coreOuter, coreCross);
core.position.set(0, 1.2, 0);
core.rotation.y = -0.22;
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
const coreStableColor = new THREE.Color(0x39ff56);
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

function createBlenderNyraModel() {
  if (window.NYRA_MECHA_MODEL) {
    const model = window.NYRA_MECHA_MODEL;
    const group = new THREE.Group();
    group.name = "Nyra_AstraFlux_Mecha";
    const materialCache = {};
    const rig = {};
    const partMap = new Map(model.components.map((part) => [part.name, part]));

    function convertedPosition(name, fallback) {
      const part = partMap.get(name);
      return part
        ? [part.position[0], part.position[2], part.position[1]]
        : fallback;
    }

    function makePivot(name, position) {
      const pivot = new THREE.Group();
      pivot.name = `NyraMechaRig_${name}`;
      pivot.position.fromArray(position);
      pivot.userData.worldPosition = new THREE.Vector3().fromArray(position);
      rig[name] = pivot;
      group.add(pivot);
      return pivot;
    }

    function parentPivot(child, parent) {
      group.remove(child);
      parent.add(child);
      child.position.copy(child.userData.worldPosition).sub(parent.userData.worldPosition);
    }

    const rootPivot = makePivot("root", convertedPosition("pelvis_core", [0, 1.05, 0]));
    const torsoPivot = makePivot("torso", convertedPosition("torso_white_chest", [0, 1.9, 0]));
    const headPivot = makePivot("head", convertedPosition("head_helmet", [0, 2.55, 0]));
    const leftArmPivot = makePivot("leftArm", convertedPosition("L_shoulder_joint", [-0.6, 1.82, 0]));
    const rightArmPivot = makePivot("rightArm", convertedPosition("R_shoulder_joint", [0.6, 1.82, 0]));
    const leftForearmPivot = makePivot("leftForearm", convertedPosition("L_elbow_joint", [-0.72, 1.02, 0]));
    const rightForearmPivot = makePivot("rightForearm", convertedPosition("R_elbow_joint", [0.72, 1.02, 0]));
    const leftLegPivot = makePivot("leftLeg", convertedPosition("L_hip_joint", [-0.27, 0.88, 0]));
    const rightLegPivot = makePivot("rightLeg", convertedPosition("R_hip_joint", [0.27, 0.88, 0]));
    const leftShinPivot = makePivot("leftShin", convertedPosition("L_knee_joint", [-0.27, 0.1, -0.02]));
    const rightShinPivot = makePivot("rightShin", convertedPosition("R_knee_joint", [0.27, 0.1, -0.02]));

    parentPivot(torsoPivot, rootPivot);
    parentPivot(headPivot, torsoPivot);
    parentPivot(leftArmPivot, torsoPivot);
    parentPivot(rightArmPivot, torsoPivot);
    parentPivot(leftForearmPivot, leftArmPivot);
    parentPivot(rightForearmPivot, rightArmPivot);
    parentPivot(leftLegPivot, rootPivot);
    parentPivot(rightLegPivot, rootPivot);
    parentPivot(leftShinPivot, leftLegPivot);
    parentPivot(rightShinPivot, rightLegPivot);

    function getMaterial(name) {
      if (materialCache[name]) return materialCache[name];
      const color = new THREE.Color().fromArray((model.materials && model.materials[name]) || [0.8, 0.86, 0.9]);
      const emissiveBoost = name.includes("Visor") || name.includes("Beacon") || name.includes("Badge") ? 0.36 : 0.06;
      materialCache[name] = new THREE.MeshStandardMaterial({
        color,
        emissive: color.clone().multiplyScalar(emissiveBoost),
        metalness: name.includes("Frame") ? 0.62 : 0.42,
        roughness: name.includes("Armor") ? 0.22 : 0.34
      });
      return materialCache[name];
    }

    function getPivotForPart(name) {
      if (name.startsWith("L_forearm") || name.startsWith("L_elbow") || name.startsWith("L_black_wrist") || name.startsWith("L_hand")) return leftForearmPivot;
      if (name.startsWith("R_forearm") || name.startsWith("R_elbow") || name.startsWith("R_black_wrist") || name.startsWith("R_hand")) return rightForearmPivot;
      if (name.startsWith("L_shoulder") || name.startsWith("L_red_beacon") || name.startsWith("L_upper_arm")) return leftArmPivot;
      if (name.startsWith("R_shoulder") || name.startsWith("R_red_beacon") || name.startsWith("R_upper_arm")) return rightArmPivot;
      if (name.startsWith("L_knee") || name.startsWith("L_shin") || name.startsWith("L_ankle") || name.startsWith("L_foot")) return leftShinPivot;
      if (name.startsWith("R_knee") || name.startsWith("R_shin") || name.startsWith("R_ankle") || name.startsWith("R_foot")) return rightShinPivot;
      if (name.startsWith("L_hip") || name.startsWith("L_thigh")) return leftLegPivot;
      if (name.startsWith("R_hip") || name.startsWith("R_thigh")) return rightLegPivot;
      if (name.startsWith("head") || name.startsWith("jaw") || name.startsWith("green_visor") || name.includes("antenna")) return headPivot;
      if (name.includes("torso") || name.includes("abdomen") || name.includes("badge") || name.includes("energy") || name.includes("panel")) return torsoPivot;
      return rootPivot;
    }

    for (const part of model.components) {
      const geometry = part.type === "sphere"
        ? new THREE.SphereGeometry(0.5, 16, 8)
        : new THREE.BoxGeometry(1, 1, 1);
      const mesh = new THREE.Mesh(geometry, getMaterial(part.material));
      mesh.name = `NyraMecha_${part.name}`;
      const worldPosition = new THREE.Vector3(part.position[0], part.position[2], part.position[1]);
      const parentPivot = getPivotForPart(part.name);
      mesh.position.copy(worldPosition).sub(parentPivot.userData.worldPosition);
      mesh.rotation.set(part.rotation[0], part.rotation[2], part.rotation[1]);
      mesh.scale.set(part.scale[0], part.scale[2], part.scale[1]);
      parentPivot.add(mesh);
    }

    group.position.y = 0.72;
    group.scale.setScalar(0.74);
    group.userData.rig = rig;
    return group;
  }

  const data = window.NYRA_BLENDER_SPHERE_MESH;
  if (!data) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(data.normals, 3));
  geometry.setIndex(data.indices);
  geometry.computeBoundingSphere();

  const color = new THREE.Color().fromArray(data.color || [0.1, 0.95, 0.45]);
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color.clone().multiplyScalar(0.18),
    metalness: 0.55,
    roughness: 0.28
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "Nyra_Blender_MCP_Sphere";
  mesh.position.y = 1.45;
  mesh.scale.setScalar(0.56);
  return mesh;
}

const blenderNyra = createBlenderNyraModel();
if (blenderNyra) {
  torso.visible = false;
  head.visible = false;
  hair.visible = false;
  for (const limb of limbs) limb.visible = false;
  collector.position.set(0, 2.48, -0.08);
  player.add(blenderNyra);
}

const halo = makeRing(0.74, 0x70e4ff, 0.8);
halo.position.y = blenderNyra ? 2.4 : 1.55;
player.add(halo);
const ultimateRing = makeRing(1.25, 0xff5f8f, 0.0);
ultimateRing.position.y = blenderNyra ? 2.45 : 1.45;
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

function burstItemFromCore(mesh, power = 1) {
  const a = Math.random() * Math.PI * 2;
  const d = 9 + Math.random() * 26 * power;
  mesh.position.set(
    Math.cos(a) * d,
    0.8 + Math.random() * 4.8,
    Math.sin(a) * d
  );
}

function triggerElasticBigBang() {
  bigBangElasticTime = BIG_BANG_ELASTIC_DURATION;
  coreBigBangTime = 1.1;
  coreMass = 0;
  coreCollapse = 0;

  for (const item of items) {
    const origin = item.position.clone();
    const direction = origin.clone().sub(core.position);
    if (direction.lengthSq() < 0.01) {
      direction.set(Math.random() - 0.5, Math.random() * 0.5, Math.random() - 0.5);
    }
    direction.normalize();
    const blastDistance = 9 + Math.random() * 12;
    item.userData.bigBangOrigin = origin;
    item.userData.bigBangTarget = origin.clone().addScaledVector(direction, blastDistance);
    item.userData.bigBangReturn = origin.clone().lerp(item.userData.bigBangTarget, 0.4);
    item.userData.bigBangPhase = Math.random() * 0.18;
  }

  ui.tech.textContent = "Big bang du noyau : explosion elastique, les flux rebondissent puis reviennent.";
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
    updateIntroMusicButton();
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
  const requestId = ++modulePlayRequest;

  if (moduleBuffer) {
    modulePlayer.play(moduleBuffer);
    moduleMusicOn = true;
    updateIntroMusicButton();
    ui.tech.textContent = "Module Amiga: Dr Awesome - Crusader Now What.";
    return;
  }

  ui.tech.textContent = "Chargement du module Amiga...";
  modulePlayer.load(AMIGA_MODULE_PATH, (buffer) => {
    if (requestId !== modulePlayRequest) return;
    moduleBuffer = buffer;
    modulePlayer.play(moduleBuffer);
    moduleMusicOn = true;
    updateIntroMusicButton();
    ui.tech.textContent = "Module Amiga: Dr Awesome - Crusader Now What.";
  });
}

function updateIntroMusicButton() {
  const button = document.getElementById("introMusicBtn");
  if (button) button.textContent = moduleMusicOn ? "Stop Music" : "Intro Music";
}

function stopAmigaModule(message = "") {
  modulePlayRequest += 1;
  if (modulePlayer && moduleMusicOn) {
    modulePlayer.togglePause();
  }
  moduleMusicOn = false;
  updateIntroMusicButton();
  if (message) ui.tech.textContent = message;
}

function toggleAmigaModule() {
  if (!moduleMusicOn) {
    playAmigaModule();
    return;
  }

  stopAmigaModule("Module Amiga en pause.");
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
  const distanceToCore = player.position.distanceTo(core.position);
  const purgeRatio = THREE.MathUtils.lerp(0.9, 0.6, THREE.MathUtils.clamp(distanceToCore / 24, 0, 1));
  coreMass *= 1 - purgeRatio;
  coreCollapse = THREE.MathUtils.clamp(coreMass / 180, 0, 1);
  ultimateTime = ULTIMATE_ACTIVE_DURATION;
  ultimateFadeTime = ULTIMATE_FADE_DURATION;
  ultimateCooldown = 10;
  ultimateCollapsePoint.copy(player.position);
  ui.tech.textContent = `Ultimate : ${ULTIMATE_ENERGY_COST} Énergie+ consommée, noyau purgé à ${Math.round(purgeRatio * 100)}%.`;
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
  stopAmigaModule();
  started = true;
  document.getElementById("startScreen").classList.add("hidden");
};
document.getElementById("introMusicBtn").onclick = () => {
  ensureAudio();
  toggleAmigaModule();
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
    core.rotation.x = Math.sin(t * 0.7) * 0.08;
    core.rotation.y = -0.22 + Math.sin(t * 0.5) * 0.24;
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

  if (keys.has("h")) {
    if (!hudToggleHeld) {
      document.body.classList.toggle("hide-hud");
      hudToggleHeld = true;
    }
  } else {
    hudToggleHeld = false;
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
  const activeInput = moving || keys.has(" ") || keys.has("shift") || keys.has("u") || gamepadState.lift || gamepadState.dash || gamepadState.ultimate;
  idleTime = activeInput ? 0 : idleTime + dt;

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
  const dancing = idleTime > 4;
  const idleMood = balance < -45 ? "needPositive" : balance > 45 ? "needInverse" : "balanced";
  if (dancing) {
    const groove = Math.sin(t * 6);
    const bounce = Math.abs(Math.sin(t * 6)) * 0.11;
    player.position.y += bounce;
    head.rotation.z = -groove * 0.1;

    if (idleMood === "balanced") {
      torso.rotation.z = groove * 0.12;
      limbs[0].rotation.x = Math.sin(t * 7) * 0.55;
      limbs[1].rotation.x = Math.sin(t * 7 + Math.PI) * 0.55;
      limbs[0].rotation.z = 0.55 + Math.sin(t * 5) * 0.18;
      limbs[1].rotation.z = -0.55 + Math.sin(t * 5 + Math.PI) * 0.18;
      limbs[2].rotation.x = Math.sin(t * 8) * 0.32;
      limbs[3].rotation.x = Math.sin(t * 8 + Math.PI) * 0.32;
      player.rotation.y += Math.sin(t * 4) * dt * 0.55;
    } else if (idleMood === "needPositive") {
      torso.rotation.z = -0.1 + Math.sin(t * 4) * 0.08;
      limbs[0].rotation.x = -0.2 + Math.sin(t * 5) * 0.16;
      limbs[0].rotation.z = 0.36;
      limbs[1].rotation.x = -0.92 + Math.sin(t * 10) * 0.18;
      limbs[1].rotation.z = -1.18 + Math.sin(t * 12) * 0.18;
      limbs[2].rotation.x = Math.sin(t * 5) * 0.18;
      limbs[3].rotation.x = -Math.sin(t * 5) * 0.18;
      player.rotation.y += Math.sin(t * 2) * dt * 0.25;
    } else {
      torso.rotation.z = 0.1 + Math.sin(t * 9) * 0.06;
      head.rotation.z = Math.sin(t * 10) * 0.12;
      limbs[0].rotation.x = -0.78 + Math.sin(t * 12) * 0.12;
      limbs[1].rotation.x = -0.78 + Math.sin(t * 12 + Math.PI) * 0.12;
      limbs[0].rotation.z = 0.92 + Math.sin(t * 8) * 0.1;
      limbs[1].rotation.z = -0.92 + Math.sin(t * 8 + Math.PI) * 0.1;
      limbs[2].rotation.x = -0.18 + Math.sin(t * 12) * 0.22;
      limbs[3].rotation.x = 0.18 + Math.sin(t * 12 + Math.PI) * 0.22;
      player.rotation.y += Math.sin(t * 8) * dt * 0.16;
    }
  } else {
    torso.rotation.z = 0;
    head.rotation.z = 0;
    limbs[0].rotation.x = walk * 0.35;
    limbs[1].rotation.x = -walk * 0.35;
    limbs[0].rotation.z = 0.38;
    limbs[1].rotation.z = -0.38;
    limbs[2].rotation.x = -walk * 0.45;
    limbs[3].rotation.x = walk * 0.45;
  }
  halo.rotation.z += dt * (dancing ? 6.8 : 3.4);
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
  const ultimateFadePower = ultimateTime > 0 ? 1 : ultimateFadeTime / ULTIMATE_FADE_DURATION;
  if (blenderNyra) {
    if (blenderNyra.name === "Nyra_AstraFlux_Mecha") {
      const rig = blenderNyra.userData.rig;
      const stride = Math.sin(t * (moving ? 9.2 : 2.4));
      const idleWave = Math.sin(t * 3.8);
      const hoverPose = levitating ? 1 : 0;
      const ultimatePose = ultimateFadePower > 0 ? ultimateFadePower : 0;

      blenderNyra.rotation.z = THREE.MathUtils.lerp(blenderNyra.rotation.z, -dx * 0.12, 0.12);
      blenderNyra.rotation.x = THREE.MathUtils.lerp(blenderNyra.rotation.x, -0.08 + dz * 0.08, 0.12);
      blenderNyra.scale.setScalar(0.74 + dashPulse * 0.05 + ultimateFadePower * 0.08);

      if (rig) {
        rig.torso.rotation.set(-0.06 * ultimatePose - dashPulse * 0.16, Math.sin(t * 2.8) * (dancing ? 0.12 : 0.02), Math.sin(t * 3.2) * (moving ? 0.035 : 0.018));
        rig.head.rotation.set(-dz * 0.05 - 0.08 * ultimatePose, Math.sin(t * 2.1) * 0.08 + dx * 0.12, 0);
        rig.leftArm.rotation.set(0, 0, 0);
        rig.rightArm.rotation.set(0, 0, 0);
        rig.leftForearm.rotation.set(0, 0, 0);
        rig.rightForearm.rotation.set(0, 0, 0);
        const legSwing = moving ? stride * 0.24 : 0;
        rig.leftLeg.rotation.set(legSwing, 0, 0);
        rig.rightLeg.rotation.set(-legSwing, 0, 0);
        rig.leftShin.rotation.set(-Math.max(0, legSwing) * 0.42, 0, 0);
        rig.rightShin.rotation.set(-Math.max(0, -legSwing) * 0.42, 0, 0);

        if (dancing && !moving) {
          const moodLean = idleMood === "balanced" ? 0 : idleMood === "needPositive" ? -0.18 : 0.18;
          const dancePulse = Math.sin(t * 6.4);
          const softBounce = Math.abs(Math.sin(t * 3.2));
          const sideStep = Math.sin(t * 4.1);
          const shoulderPop = Math.sin(t * 8.2);
          const waveCycle = (t + (idleMood === "balanced" ? 0 : idleMood === "needPositive" ? 1.4 : 2.8)) % 9;
          const waving = waveCycle > 5.7 && waveCycle < 7.4;
          const wave = waving ? Math.sin(t * 13) : 0;

          rig.leftLeg.rotation.x = sideStep * 0.08;
          rig.rightLeg.rotation.x = -sideStep * 0.08;
          rig.leftShin.rotation.x = Math.max(0, -sideStep) * 0.08;
          rig.rightShin.rotation.x = Math.max(0, sideStep) * 0.08;
          rig.head.rotation.y = moodLean + idleWave * 0.1;
          rig.head.rotation.x = -0.04 + softBounce * 0.06;
          rig.torso.rotation.y = moodLean * 0.42 + Math.sin(t * 2.8) * 0.16;
          rig.torso.rotation.z = Math.sin(t * 4.2) * 0.08;

          if (idleMood === "balanced") {
            rig.leftArm.rotation.set(0.12 + dancePulse * 0.14, 0, 0.5 + idleWave * 0.16 + shoulderPop * 0.05);
            rig.rightArm.rotation.set(-0.12 - dancePulse * 0.14, 0, -0.5 - idleWave * 0.16 - shoulderPop * 0.05);
            rig.leftForearm.rotation.set(0.38 + softBounce * 0.14, 0, -0.08 + dancePulse * 0.05);
            rig.rightForearm.rotation.set(0.36 + softBounce * 0.14, 0, 0.08 - dancePulse * 0.05);
          } else if (idleMood === "needPositive") {
            rig.leftArm.rotation.set(-0.16 + dancePulse * 0.1, 0, 0.32 + shoulderPop * 0.04);
            rig.rightArm.rotation.set(-0.62 + Math.sin(t * 5.4) * 0.12, 0, -0.82);
            rig.leftForearm.rotation.set(0.18 + softBounce * 0.08, 0, 0);
            rig.rightForearm.rotation.set(0.78 + Math.sin(t * 7.4) * 0.12, 0, -0.16);
          } else {
            rig.leftArm.rotation.set(-0.62 + Math.sin(t * 5.6) * 0.12, 0, 0.82);
            rig.rightArm.rotation.set(-0.16 - dancePulse * 0.1, 0, -0.32 - shoulderPop * 0.04);
            rig.leftForearm.rotation.set(0.78 + Math.sin(t * 7.2) * 0.12, 0, 0.16);
            rig.rightForearm.rotation.set(0.18 + softBounce * 0.08, 0, 0);
          }

          if (waving) {
            rig.rightArm.rotation.set(-0.92, 0, -1.02 + wave * 0.08);
            rig.rightForearm.rotation.set(1.0 + wave * 0.22, 0, -0.42 + wave * 0.16);
            rig.head.rotation.y = Math.sin(t * 3) * 0.08;
          }
        }
      }
    } else {
      blenderNyra.rotation.y += dt * (0.45 + dashPulse * 3.5);
      blenderNyra.scale.setScalar(0.56 + dashPulse * 0.08 + ultimateFadePower * 0.12);
    }
  }
  ultimateRing.rotation.z -= dt * 8;
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

  core.rotation.x = Math.sin(t * 0.7) * 0.08;
  core.rotation.y = -0.22 + Math.sin(t * 0.5) * 0.24 + yieldRate * 0.08;
  const ultimateGravityPower = ultimateTime > 0 ? 1 : ultimateFadeTime / ULTIMATE_FADE_DURATION;
  if (ultimateGravityPower > 0) {
    coreMass = Math.max(0, coreMass - dt * (18 + coreMass * 0.9));
  } else {
    coreMass = Math.max(0, coreMass - dt * 0.18);
  }
  coreCollapse = THREE.MathUtils.clamp(coreMass / 180, 0, 1);
  coreBigBangTime = Math.max(0, coreBigBangTime - dt);
  const corePulse = coreBigBangTime > 0 ? coreBigBangTime / 1.1 : 0;
  const collapseScale = 1 - coreCollapse * 0.58;
  coreMat.opacity = 0.035 + corePulse * 0.08;
  coreInner.material.opacity = 0.03 + coreCollapse * 0.04 + corePulse * 0.1;
  coreGlass.opacity = 0.68 + coreCollapse * 0.22 + corePulse * 0.1;
  coreGlass.color.lerp(coreCollapse > 0.66 ? collectorInverseColor : coreStableColor, 0.04);
  if (coreBrainSurface && coreBrainWire) {
    const targetCoreColor = coreCollapse > 0.66 ? collectorInverseColor : coreStableColor;
    coreBrainSurface.material.opacity = 0.035 + coreCollapse * 0.06 + corePulse * 0.08;
    coreBrainWire.material.opacity = 0.62 + coreCollapse * 0.24 + corePulse * 0.12;
    coreBrainSurface.material.color.lerp(targetCoreColor, 0.04);
    coreBrainWire.material.color.lerp(targetCoreColor, 0.04);
  }
  coreCross.rotation.z = Math.sin(t * 1.6) * 0.03;
  core.scale.setScalar(
    collapseScale +
    corePulse * 1.8 +
    (1 - stability) * 0.12 +
    Math.sin(t * (4 + coreCollapse * 10)) * (0.015 + coreCollapse * 0.025)
  );

  if (coreCollapse >= 1 && coreBigBangTime <= 0) {
    triggerElasticBigBang();
  }

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
  bigBangElasticTime = Math.max(0, bigBangElasticTime - dt);
  collector.getWorldPosition(collectionPoint);

  for (const item of items) {
    item.rotation.x += dt * item.userData.spin;
    item.rotation.y += dt * item.userData.spin * 1.35;
    item.position.y += Math.sin(t * 2 + item.userData.phase) * dt * 0.18;

    if (bigBangElasticTime > 0 && item.userData.bigBangOrigin && item.userData.bigBangTarget) {
      const elapsed = BIG_BANG_ELASTIC_DURATION - bigBangElasticTime;
      const raw = THREE.MathUtils.clamp((elapsed - item.userData.bigBangPhase) / (BIG_BANG_ELASTIC_DURATION - 0.18), 0, 1);
      const outT = THREE.MathUtils.clamp(raw / 0.36, 0, 1);
      const returnT = THREE.MathUtils.clamp((raw - 0.36) / 0.64, 0, 1);
      const outEase = 1 - Math.pow(1 - outT, 3);
      const returnEase = 1 - Math.pow(1 - returnT, 3);
      const wobble = Math.sin(raw * Math.PI * 6) * (1 - raw) * 0.08;
      if (raw < 0.36) {
        item.position.lerpVectors(item.userData.bigBangOrigin, item.userData.bigBangTarget, outEase);
      } else {
        item.position.lerpVectors(item.userData.bigBangTarget, item.userData.bigBangReturn, returnEase + wobble);
      }
      item.scale.setScalar(1 + Math.sin(raw * Math.PI) * 0.9);
      if (raw >= 1) {
        item.position.copy(item.userData.bigBangReturn);
        item.scale.setScalar(1);
        delete item.userData.bigBangOrigin;
        delete item.userData.bigBangTarget;
        delete item.userData.bigBangReturn;
        delete item.userData.bigBangPhase;
      }
      continue;
    }

    const centerDistance = Math.hypot(item.position.x, item.position.z);
    if (centerDistance > 8) {
      const centerPull = new THREE.Vector3(-item.position.x, 0, -item.position.z).normalize();
      const passivePull = Math.min(0.45, (centerDistance - 8) * 0.006);
      item.position.addScaledVector(centerPull, passivePull * dt);
    }

    const coreDistance = item.position.distanceTo(core.position);
    const coreGravityRange = 30 + coreCollapse * 18;
    if (ultimateGravityPower <= 0 && coreDistance < coreGravityRange && coreDistance > 0.08) {
      const pullToCore = core.position.clone().sub(item.position).normalize();
      const coreFalloff = 1 - coreDistance / coreGravityRange;
      const corePull = (0.55 + coreCollapse * 3.8 + coreMass * 0.006) * coreFalloff * coreFalloff;
      item.position.addScaledVector(pullToCore, corePull * dt);
    }

    if (ultimateGravityPower <= 0 && coreDistance < 1.05 + coreCollapse * 0.5) {
      coreMass += item.userData.type === "positive" ? 2.2 : 3.2;
      burstItemFromCore(item, 0.65);
      item.scale.setScalar(0.65);
      continue;
    }

    if (correctionType && item.userData.type === correctionType) {
      const correctionDistance = item.position.distanceTo(collectionPoint);
      if (correctionDistance < correctionRadius && correctionDistance > 0.05) {
        const pullToCollector = collectionPoint.clone().sub(item.position).normalize();
        const falloff = 1 - correctionDistance / correctionRadius;
        item.position.addScaledVector(pullToCollector, correctionStrength * falloff * falloff * dt);
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
      const collapseTarget = collectionPoint;
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

    const dist = item.position.distanceTo(collectionPoint);
    if (dist < gravityRadius && dist > 0.04) {
      const pull = collectionPoint.clone().sub(item.position).normalize();
      const falloff = 1 - dist / gravityRadius;
      item.position.addScaledVector(pull, gravityStrength * falloff * falloff * dt);
      item.scale.setScalar(1 + falloff * 0.35);
    } else {
      item.scale.setScalar(1);
    }

    const collectDist = item.position.distanceTo(collectionPoint);
    if (collectDist < 1.25) {
      if (item.userData.type === "positive") {
        energy += 6 + yieldRate * 10;
      } else {
        inverse += 5 + pressure * 2.4;
      }
      playCollectSound(item.userData.type, item.position.x - collectionPoint.x);
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
    ui.tech.textContent = `Décélération gravitationnelle : les flux inverses glissent encore vers Nyra (${ultimateFadeTime.toFixed(1)}s).`;
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
