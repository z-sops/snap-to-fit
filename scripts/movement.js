import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import humanData from "../assets/movement/human.glb.gz";
import clips from "../assets/movement/clips.json";
const motion = window.MOTION || "squat";
const scene = new THREE.Scene();
scene.background = new THREE.Color("#E9EDF6");
const camera = new THREE.PerspectiveCamera(
  35,
  innerWidth / innerHeight,
  0.05,
  30,
);
camera.position.set(2.5, 1.7, 3.5);
camera.lookAt(0, 0.88, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
document.body.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8593b6, 2));
const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(2, 5, 3);
light.castShadow = true;
light.shadow.mapSize.set(1024, 1024);
light.shadow.camera.left = -2;
light.shadow.camera.right = 2;
light.shadow.camera.top = 3;
light.shadow.camera.bottom = -2;
scene.add(light);
const rim = new THREE.DirectionalLight(0x759aff, 2);
rim.position.set(-3, 2, -2);
scene.add(rim);
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0xe9edf6, roughness: 1 }),
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const mat = new THREE.Mesh(
  new THREE.BoxGeometry(1.1, 0.025, 2.1),
  new THREE.MeshStandardMaterial({ color: 0x9cabc8, roughness: 0.9 }),
);
mat.position.y = 0.012;
scene.add(mat);
mat.visible = ["pushup", "plank", "bridge", "deadbug"].includes(motion);
const body = new THREE.Group();
scene.add(body);
body.position.y = 0.93;
const torso = new THREE.Group();
body.add(torso);
function weight() {
  const group = new THREE.Group(),
    m = new THREE.MeshStandardMaterial({
      color: 0x24324a,
      metalness: 0.5,
      roughness: 0.45,
    });
  const grip = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.18, 16),
    m,
  );
  grip.rotation.z = Math.PI / 2;
  group.add(grip);
  for (const x of [-0.1, 0.1]) {
    const disk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.045, 16),
      m,
    );
    disk.rotation.z = Math.PI / 2;
    disk.position.x = x;
    group.add(disk);
  }
  scene.add(group);
  return group;
}
function arm(side) {
  const shoulder = new THREE.Group();
  shoulder.position.set(side * 0.2, 0.45, 0);
  torso.add(shoulder);
  const elbow = new THREE.Group();
  elbow.position.y = -0.265;
  shoulder.add(elbow);
  const hand = new THREE.Group();
  hand.position.y = -0.255;
  elbow.add(hand);
  return { shoulder, elbow, hand, weight: weight() };
}
function leg(side) {
  const hip = new THREE.Group();
  hip.position.set(side * 0.11, 0, 0);
  body.add(hip);
  const knee = new THREE.Group();
  knee.position.y = -0.42;
  hip.add(knee);
  const foot = new THREE.Group();
  foot.position.y = -0.44;
  knee.add(foot);
  return { hip, knee, foot };
}
const arms = [arm(-1), arm(1)],
  legs = [leg(-1), leg(1)];
const bench = new THREE.Group();
scene.add(bench);
function block(x, y, z, px, py, pz, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(x, y, z),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
  );
  mesh.position.set(px, py, pz);
  mesh.castShadow = true;
  bench.add(mesh);
}
if (["press", "pulldown", "chestPress"].includes(motion)) {
  block(0.46, 0.1, motion === "chestPress" ? 1.5 : 0.45, 0, 0.48, 0, 0x263753);
  for (const z of [-0.18, 0.18]) block(0.35, 0.48, 0.05, 0, 0.24, z, 0x727f96);
  if (motion !== "chestPress") block(0.44, 0.6, 0.08, 0, 0.82, -0.2, 0x263753);
}
let model,
  mixer,
  bones,
  bind,
  ready = false;
let paused = matchMedia("(prefers-reduced-motion: reduce)").matches,
  angle = 0,
  phase = 0,
  speed = 1,
  then = performance.now();
const notice = document.createElement("div");
notice.textContent = "Preparing human movement…";
notice.className = "notice";
document.body.appendChild(notice);
const hint = document.createElement("div");
hint.className = "badge";
hint.textContent = "HUMAN 3D · DRAG TO EXPLORE";
document.body.appendChild(hint);
const controls = document.createElement("div");
controls.className = "controls";
document.body.appendChild(controls);
function control(label, action) {
  const b = document.createElement("button");
  b.textContent = label;
  b.onclick = action;
  controls.appendChild(b);
  return b;
}
const play = control(paused ? "Play" : "Pause", () => {
  paused = !paused;
  play.textContent = paused ? "Play" : "Pause";
});
control("Front", () => (angle = -0.55));
control("Side", () => (angle = Math.PI / 2 - 0.55));
const slow = control("1×", () => {
  speed = speed === 1 ? 0.5 : 1;
  slow.textContent = speed === 1 ? "1×" : "0.5×";
});
control("Skin tone", () => {
  tone = (tone + 1) % tones.length;
  if (ready) colourHuman();
});
const tones = [0xb98462, 0x6c4435, 0xe1b797];
let tone = 0;
function colourHuman() {
  model.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const p = o.geometry.attributes.position,
      j = o.geometry.attributes.skinIndex,
      w = o.geometry.attributes.skinWeight;
    const colors = [];
    for (let i = 0; i < p.count; i++) {
      let fabric = false;
      for (let k = 0; k < 4; k++) {
        const name = o.skeleton.bones[j.array[i * 4 + k]]?.name || "";
        if (
          w.array[i * 4 + k] > 0.25 &&
          /spine|pelvis|upperleg|upperarm|shoulder|clavicle/.test(name)
        )
          fabric = true;
      }
      const y = p.getY(i);
      const c = new THREE.Color(
        fabric && y > 0.55 && y < 1.47
          ? y > 1.03
            ? 0x355af4
            : 0x18243c
          : tones[tone],
      );
      colors.push(c.r, c.g, c.b);
    }
    o.geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3),
    );
    o.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
    });
    o.castShadow = true;
    o.receiveShadow = true;
  });
}
const v = () => new THREE.Vector3();
function aim(boneName, endName, targetDirection) {
  const bone = bones[boneName],
    end = bones[endName];
  if (!bone || !end) return;
  model.updateMatrixWorld(true);
  const current = end
    .getWorldPosition(v())
    .sub(bone.getWorldPosition(v()))
    .normalize();
  const delta = new THREE.Quaternion().setFromUnitVectors(
    current,
    targetDirection.normalize(),
  );
  const world = delta.multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
  const parent = bone.parent
    .getWorldQuaternion(new THREE.Quaternion())
    .invert();
  bone.quaternion.copy(parent.multiply(world));
}
async function loadHuman() {
  try {
    const bytes = Uint8Array.from(atob(humanData), (c) => c.charCodeAt(0));
    const binary = await new Response(
      new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")),
    ).arrayBuffer();
    const gltf = await new GLTFLoader().parseAsync(binary, "");
    model = gltf.scene;
    model.traverse((o) => {
      if (o.isSkinnedMesh) o.skeleton.pose();
    });
    model.updateMatrixWorld(true);
    bones = {};
    bind = [];
    model.traverse((o) => {
      if (o.isBone) {
        bones[o.name] = o;
        bind.push([o, o.position.clone(), o.quaternion.clone()]);
      }
    });
    colourHuman();
    body.add(model);
    if (clips[motion]) {
      mixer = new THREE.AnimationMixer(model);
      mixer.clipAction(THREE.AnimationClip.parse(clips[motion])).play();
      mixer.update(0);
    }
    ready = true;
    notice.remove();
    window.__movementReady = true;
  } catch (e) {
    notice.textContent =
      "3D preview unavailable on this device. Follow the written movement cues below.";
    console.error(e);
    window.__movementError = String(e);
  }
}
loadHuman();
let px = null;
renderer.domElement.onpointerdown = (e) => {
  px = e.clientX;
  renderer.domElement.setPointerCapture(e.pointerId);
};
renderer.domElement.onpointermove = (e) => {
  if (px !== null) {
    angle += (e.clientX - px) * 0.01;
    px = e.clientX;
  }
};
renderer.domElement.onpointerup = renderer.domElement.onpointercancel = () =>
  (px = null);
function frame(now) {
  requestAnimationFrame(frame);
  const delta = Math.min(0.1, (now - then) / 1000);
  then = now;
  if (!paused) phase += delta * 1.4 * speed;
  const u = (1 - Math.cos(phase)) / 2;
  torso.rotation.set(0, 0, 0);
  body.position.y = 0.93;
  body.rotation.x = 0;
  for (const l of legs) {
    l.hip.rotation.x = 0;
    l.knee.rotation.x = 0;
  }
  arms.forEach((a, i) => {
    a.shoulder.rotation.set(0, 0, (i === 0 ? -1 : 1) * 0.1);
    a.elbow.rotation.x = 0;
    a.weight.visible = ["press", "curl"].includes(motion);
  });
  if (motion === "squat") {
    body.position.y -= u * 0.32;
    torso.rotation.x = u * 0.25;
    legs.forEach((l) => {
      l.hip.rotation.x = -u * 0.75;
      l.knee.rotation.x = u * 1.2;
    });
    arms.forEach((a) => (a.shoulder.rotation.x = -0.7));
  }
  if (motion === "press") {
    body.position.y = 0.95;
    legs.forEach((l) => {
      l.hip.rotation.x = -1.4;
      l.knee.rotation.x = 1.4;
    });
    arms.forEach((a, i) => {
      a.shoulder.rotation.z = (i === 0 ? -1 : 1) * (1.6 + u * 1.35);
      a.elbow.rotation.z = (i === 0 ? 1 : -1) * (1.4 * (1 - u));
    });
  }
  if (motion === "curl") arms.forEach((a) => (a.elbow.rotation.x = -u * 1.9));
  if (motion === "row")
    arms.forEach((a) => {
      a.shoulder.rotation.x = -1.4 + u * 1.6;
      a.elbow.rotation.x = -u * 1.4;
    });
  if (motion === "hinge") {
    torso.rotation.x = u * 0.8;
    legs.forEach((l) => {
      l.hip.rotation.x = -u * 0.2;
      l.knee.rotation.x = u * 0.25;
    });
  }
  if (motion === "walk") {
    legs.forEach((l, i) => {
      l.hip.rotation.x = Math.sin(phase + i * Math.PI) * 0.45;
      l.knee.rotation.x = Math.max(0, Math.sin(phase + i * Math.PI)) * 0.5;
    });
    arms.forEach(
      (a, i) =>
        (a.shoulder.rotation.x = Math.sin(phase + (i + 1) * Math.PI) * 0.4),
    );
  }

  if (motion === "raise")
    arms.forEach((a, i) => {
      a.weight.visible = true;
      a.shoulder.rotation.z = (i === 0 ? -1 : 1) * (0.1 + u * 1.3);
    });
  if (motion === "lunge") {
    body.position.y -= u * 0.25;
    legs[0].hip.rotation.x = -u * 0.65;
    legs[0].knee.rotation.x = u * 1.1;
    legs[1].hip.rotation.x = u * 0.5;
    legs[1].knee.rotation.x = u * 1.3;
  }
  if (motion === "calf") body.position.y += u * 0.12;
  if (motion === "pushup" || motion === "plank") {
    body.rotation.x = Math.PI / 2;
    body.position.y = motion === "pushup" ? 0.75 - u * 0.25 : 0.65;
    arms.forEach((a) => {
      a.weight.visible = false;
      a.shoulder.rotation.x = motion === "pushup" ? -1.57 + u * 0.45 : -1.3;
      a.elbow.rotation.x = motion === "pushup" ? -u * 0.9 : -1.25;
    });
  }
  if (motion === "bridge") {
    body.rotation.x = -Math.PI / 2;
    body.position.y = 0.25 + u * 0.2;
    legs.forEach((l) => {
      l.hip.rotation.x = -0.8;
      l.knee.rotation.x = 1.5;
    });
  }
  if (motion === "chestPress") {
    body.rotation.x = -Math.PI / 2;
    body.position.y = 0.55;
    arms.forEach((a, i) => {
      a.weight.visible = true;
      a.shoulder.rotation.x = -1.25 - u * 0.3;
      a.shoulder.rotation.z = (i === 0 ? -1 : 1) * (0.6 * (1 - u));
      a.elbow.rotation.x = -1.2 * (1 - u);
    });
  }
  if (motion === "pulldown") {
    body.position.y = 0.95;
    legs.forEach((l) => {
      l.hip.rotation.x = -1.4;
      l.knee.rotation.x = 1.4;
    });
    arms.forEach((a, i) => {
      a.shoulder.rotation.z = (i === 0 ? -1 : 1) * (2.8 - u * 1.1);
      a.elbow.rotation.z = (i === 0 ? 1 : -1) * u * 1.4;
    });
  }
  if (motion === "triceps")
    arms.forEach((a) => {
      a.elbow.rotation.x = -1.5 * (1 - u);
    });
  if (motion === "deadbug") {
    body.rotation.x = -Math.PI / 2;
    body.position.y = 0.25;
    arms.forEach((a, i) => {
      a.shoulder.rotation.x = -1.5 - (i === 0 ? u : 1 - u) * 0.7;
    });
    legs.forEach((l, i) => {
      l.hip.rotation.x = -1.5 + (i === 0 ? 1 - u : u) * 0.9;
      l.knee.rotation.x = 1.3 - (i === 0 ? 1 - u : u) * 0.7;
    });
  }
  if (motion === "cycle") {
    body.position.y = 0.95;
    torso.rotation.x = 0.25;
    legs.forEach((l, i) => {
      l.hip.rotation.x = -0.9 + Math.sin(phase + i * Math.PI) * 0.4;
      l.knee.rotation.x = 1 + Math.cos(phase + i * Math.PI) * 0.5;
    });
    arms.forEach((a) => (a.shoulder.rotation.x = -0.8));
  }
  body.rotation.y = 0;
  if (ready) {
    if (mixer) {
      body.position.set(0, 0, 0);
      body.rotation.x = 0;
      model.position.set(0, 0, 0);
      if (!paused) mixer.update(delta * speed);
    } else {
      model.position.set(0, -0.93, 0);
      bind.forEach(([bone, pos, quat]) => {
        bone.position.copy(pos);
        bone.quaternion.copy(quat);
      });
      model.updateMatrixWorld(true);
      const spine = bones.spine05;
      const parent = spine.parent.getWorldQuaternion(new THREE.Quaternion());
      const axis = new THREE.Vector3(1, 0, 0)
        .applyQuaternion(body.quaternion)
        .applyQuaternion(parent.clone().invert());
      spine.quaternion.premultiply(
        new THREE.Quaternion().setFromAxisAngle(axis, torso.rotation.x),
      );
      body.updateMatrixWorld(true);
      ["R", "L"].forEach((side, i) => {
        aim(
          "upperleg01" + side,
          "lowerleg01" + side,
          legs[i].knee
            .getWorldPosition(v())
            .sub(legs[i].hip.getWorldPosition(v())),
        );
        aim(
          "lowerleg01" + side,
          "foot" + side,
          legs[i].foot
            .getWorldPosition(v())
            .sub(legs[i].knee.getWorldPosition(v())),
        );
        aim(
          "upperarm01" + side,
          "lowerarm01" + side,
          arms[i].elbow
            .getWorldPosition(v())
            .sub(arms[i].shoulder.getWorldPosition(v())),
        );
        aim(
          "lowerarm01" + side,
          "wrist" + side,
          arms[i].hand
            .getWorldPosition(v())
            .sub(arms[i].elbow.getWorldPosition(v())),
        );
      });
      if (
        ![
          "bridge",
          "deadbug",
          "plank",
          "pushup",
          "chestPress",
          "press",
          "pulldown",
          "cycle",
        ].includes(motion)
      ) {
        model.updateMatrixWorld(true);
        const footY = Math.min(
          bones.footL.getWorldPosition(v()).y,
          bones.footR.getWorldPosition(v()).y,
        );
        body.position.y += 0.07 - footY + (motion === "calf" ? u * 0.1 : 0);
      }
    }
    model.updateMatrixWorld(true);
    arms.forEach((a, i) => {
      a.weight.visible = a.weight.visible && !mixer;
      const wrist = bones["wrist" + (i === 0 ? "R" : "L")];
      a.weight.position.copy(wrist.getWorldPosition(v()));
      a.weight.rotation.set(0, angle, 0);
    });
    camera.position.set(
      Math.sin(0.55 + angle) * 4.4,
      1.65,
      Math.cos(0.55 + angle) * 4.4,
    );
    camera.lookAt(0, 0.88, 0);
    body.rotation.y = 0;
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
onresize = () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
};
