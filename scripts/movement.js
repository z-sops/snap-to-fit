import * as THREE from "three";
const scene = new THREE.Scene();
scene.background = new THREE.Color("#EAF0E9");
const camera = new THREE.PerspectiveCamera(
  36,
  innerWidth / innerHeight,
  0.1,
  100,
);
camera.position.set(3.5, 2.4, 5);
camera.lookAt(0, 1.3, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff, 0x526856, 2));
const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(3, 6, 4);
scene.add(light);
const mat = new THREE.MeshStandardMaterial({
  color: 0x226e54,
  roughness: 0.65,
});
const skin = new THREE.MeshStandardMaterial({
  color: 0xe9c5a4,
  roughness: 0.8,
});
const dark = new THREE.MeshStandardMaterial({
  color: 0x21342b,
  roughness: 0.75,
});
function ball(radius, material) {
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), material);
}
function segment(length, radius, material) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 16),
    material,
  );
  mesh.position.y = -length / 2;
  return mesh;
}
const body = new THREE.Group();
scene.add(body);
body.position.y = 1.14;
const torso = new THREE.Group();
body.add(torso);
const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.39, 6, 16), mat);
chest.position.y = 0.35;
torso.add(chest);
const head = ball(0.17, skin);
head.position.y = 0.9;
torso.add(head);
function arm(side) {
  const shoulder = new THREE.Group();
  shoulder.position.set(side * 0.34, 0.62, 0);
  torso.add(shoulder);
  shoulder.add(ball(0.095, skin), segment(0.34, 0.065, skin));
  const elbow = new THREE.Group();
  elbow.position.y = -0.34;
  shoulder.add(elbow);
  elbow.add(ball(0.07, skin), segment(0.32, 0.055, skin));
  const hand = ball(0.065, skin);
  hand.position.y = -0.34;
  elbow.add(hand);
  const weight = new THREE.Group();
  weight.position.y = -0.36;
  elbow.add(weight);
  const bar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, 0.24, 12),
    dark,
  );
  bar.rotation.z = Math.PI / 2;
  weight.add(bar);
  for (const x of [-0.13, 0.13]) {
    const disk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.06, 12),
      dark,
    );
    disk.rotation.z = Math.PI / 2;
    disk.position.x = x;
    weight.add(disk);
  }
  return { shoulder, elbow, weight };
}
function leg(side) {
  const hip = new THREE.Group();
  hip.position.set(side * 0.14, 0, 0);
  body.add(hip);
  hip.add(segment(0.5, 0.09, dark));
  const knee = new THREE.Group();
  knee.position.y = -0.5;
  hip.add(knee);
  knee.add(ball(0.08, dark), segment(0.5, 0.075, dark));
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.28), dark);
  foot.position.set(0, -0.51, 0.065);
  knee.add(foot);
  return { hip, knee };
}
const arms = [arm(-1), arm(1)],
  legs = [leg(-1), leg(1)];
const plane = new THREE.Mesh(
  new THREE.CircleGeometry(2, 48),
  new THREE.MeshStandardMaterial({ color: 0xd7e2d4 }),
);
plane.rotation.x = -Math.PI / 2;
plane.position.y = 0.025;
scene.add(plane);
const motion = window.MOTION || "squat";
let paused = false,
  angle = 0,
  phase = 0,
  then = performance.now();
const button = document.createElement("button");
button.textContent = "Pause";
button.style.cssText =
  "position:fixed;bottom:14px;left:14px;border:0;border-radius:18px;padding:10px 18px;background:#152D28;color:white";
button.onclick = () => {
  paused = !paused;
  button.textContent = paused ? "Play" : "Pause";
};
document.body.appendChild(button);
const hint = document.createElement("span");
hint.textContent = "Drag to rotate · illustrative model";
hint.style.cssText =
  "position:fixed;top:12px;left:14px;color:#526856;font:12px system-ui";
document.body.appendChild(hint);
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
renderer.domElement.onpointerup = () => (px = null);
function frame(now) {
  requestAnimationFrame(frame);
  const delta = Math.min(0.1, (now - then) / 1000);
  then = now;
  if (!paused) phase += delta * 1.4;
  const u = (1 - Math.cos(phase)) / 2;
  torso.rotation.set(0, 0, 0);
  body.position.y = 1.14;
  body.rotation.x=0;
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
    body.position.y = 0.9;
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

  if (motion === 'raise') arms.forEach((a,i)=>{a.weight.visible=true;a.shoulder.rotation.z=(i===0?-1:1)*(0.1+u*1.3);});
  if (motion === 'lunge') {body.position.y-=u*0.25;legs[0].hip.rotation.x=-u*0.65;legs[0].knee.rotation.x=u*1.1;legs[1].hip.rotation.x=u*0.5;legs[1].knee.rotation.x=u*1.3;}
  if (motion === 'calf') body.position.y+=u*0.12;
  if (motion === 'pushup'||motion === 'plank') {body.rotation.x=Math.PI/2;body.position.y=motion==='pushup'?0.75-u*0.25:0.65;arms.forEach(a=>{a.weight.visible=false;a.shoulder.rotation.x=motion==='pushup'?-1.57+u*0.45:-1.3;a.elbow.rotation.x=motion==='pushup'?-u*0.9:-1.25;});}
  if (motion === 'bridge') {body.rotation.x=-Math.PI/2;body.position.y=0.25+u*0.20;legs.forEach(l=>{l.hip.rotation.x=-0.8;l.knee.rotation.x=1.5;});}
  if (motion === 'chestPress') {body.rotation.x=-Math.PI/2;body.position.y=0.55;arms.forEach((a,i)=>{a.weight.visible=true;a.shoulder.rotation.x=1.25+u*0.3;a.shoulder.rotation.z=(i===0?-1:1)*(0.6*(1-u));a.elbow.rotation.x=1.2*(1-u);});}
  if (motion === 'pulldown') {body.position.y=0.9;legs.forEach(l=>{l.hip.rotation.x=-1.4;l.knee.rotation.x=1.4;});arms.forEach((a,i)=>{a.shoulder.rotation.z=(i===0?-1:1)*(2.8-u*1.1);a.elbow.rotation.z=(i===0?1:-1)*u*1.4;});}
  if (motion === 'triceps') arms.forEach(a=>{a.elbow.rotation.x=-1.5*(1-u);});
  if (motion === 'deadbug') {body.rotation.x=-Math.PI/2;body.position.y=0.25;arms.forEach((a,i)=>{a.shoulder.rotation.x=1.5+(i===0?u:1-u)*0.7;});legs.forEach((l,i)=>{l.hip.rotation.x=-1.5+(i===0?1-u:u)*0.9;l.knee.rotation.x=1.3-(i===0?1-u:u)*0.7;});}
  if (motion === 'cycle') {body.position.y=0.9;torso.rotation.x=0.25;legs.forEach((l,i)=>{l.hip.rotation.x=-0.9+Math.sin(phase+i*Math.PI)*0.4;l.knee.rotation.x=1+Math.cos(phase+i*Math.PI)*0.5;});arms.forEach(a=>a.shoulder.rotation.x=-0.8);}
  body.rotation.y = angle;
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
onresize = () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
};
