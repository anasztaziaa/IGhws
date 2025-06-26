import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Stork } from "./Stork.js";

let scene, camera, renderer, clock, controls;
let avatar, goal, truckTemplate, cars = [];
let sceneryObjs = [];
let storks = [];
let keys = {};

const BLOCK   = 10;
const STREETW = 4;
const SIDEW   = 1;
const EXT     = 2;
const STEP    = BLOCK + STREETW;
const COUNT   = EXT * 2 + 1;
const MAP_W   = COUNT * BLOCK + (COUNT - 1) * STREETW;
const HALF    = MAP_W / 2;
const PATH_D  = EXT * STEP;
const PAD     = STREETW / 2 + SIDEW / 2;
const START_POS = new THREE.Vector3(-31.92, 0.00, 12.24);

const loader = new GLTFLoader().setPath("./assets/");
const texLoader = new THREE.TextureLoader();

// Asphalt texture
const asphaltTexture = texLoader.load("./assets/asphalt.png");
asphaltTexture.wrapS = asphaltTexture.wrapT = THREE.RepeatWrapping;
asphaltTexture.anisotropy = 16;
asphaltTexture.minFilter = THREE.LinearMipMapLinearFilter;
asphaltTexture.magFilter = THREE.LinearFilter;
asphaltTexture.repeat.set(8, 1.7);

const lots = [];
for (let i = -EXT; i < EXT; i++) {
  for (let j = -EXT; j < EXT; j++) {
    lots.push(new THREE.Vector3(i * STEP + 7, 0, j * STEP + 7));
  }
}
const SCENERY = [
  ["japanese_tea_shop.glb",  0, 0.9],
  ["shop.glb",               1, 0.9],
  ["bakery_shop.glb",        2, 0.9],
  ["police1.glb",            3, 0.9],
  ["library.glb",            4, 0.9],
  ["building.glb",           5, 0.9],
  ["factory.glb",            6, 0.9],
  ["courtyard_building.glb", 7, 0.9],
  ["residents.glb",          8, 0.9],
  ["magic_house.glb",        9, 0.9],
  ["house_for_sale.glb",    10, 0.9],
  ["houses.glb",            11, 0.9],
  ["building2.glb",         12, 0.9],
  ["donut_shop.glb",        13, 0.9],
  ["mall.glb",              14, 0.9],
  ["shop.glb",              15, 0.9],
];
const path = [];

init();
animate();

function makeGoalTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = "#ffee00";
  ctx.fillRect(0, 0, size, size);

  ctx.font = "bold 70px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#222";
  ctx.fillText("GOAL", size/2, size/2);

  return new THREE.CanvasTexture(canvas);
}

function init() {
  //Render setup
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog        = new THREE.Fog(0x87ceeb, 30, HALF * 2);

  camera = new THREE.PerspectiveCamera(
    45, window.innerWidth / window.innerHeight, 0.1, 500
  );
  camera.position.set(0, HALF * 0.9, HALF * 0.6);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  window.addEventListener("resize", onWindowResize);

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(35, 40, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -80;
  sun.shadow.camera.near = 5;
  sun.shadow.camera.far = 150;
  sun.shadow.bias = -0.001;
  scene.add(sun);

  // Sun sphere
  const sunSphere = new THREE.Mesh(
    new THREE.SphereGeometry(2, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xffee88 })
  );
  sunSphere.position.copy(sun.position).multiplyScalar(1.15);
  scene.add(sunSphere);

  // Ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(MAP_W, MAP_W),
    new THREE.MeshPhongMaterial({ color: 0x87cefa })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  ground.castShadow = false;
  scene.add(ground);

  // Night-mode toggle
  const night = document.getElementById("night");
  if (night) night.addEventListener("change", e => {
    const on = e.target.checked;
    const bg = on ? 0x000011 : 0x87ceeb;
    scene.background.set(bg);
    scene.fog.color.set(bg);
    ground.material.color.set(on ? 0x000022 : 0x87cefa);
  });

  buildGrid();
  buildLights();

  // Goal with "GOAL" text
  const goalTexture = makeGoalTexture();
  goal = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 4),
    new THREE.MeshBasicMaterial({ map: goalTexture })
  );
  goal.rotation.x = -Math.PI / 2;
  goal.position.set(PATH_D, 0.1, PATH_D);
  goal.castShadow = true;
  goal.receiveShadow = true;
  scene.add(goal);

  // Avatar
  loader.load("avatar.glb", gltf => {
    avatar = gltf.scene;
    avatar.position.copy(START_POS);
    avatar.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    scene.add(avatar);
  });

  // Scenery
  SCENERY.forEach(([file, idx, pct]) => {
    if (lots[idx]) placeGLB(loader, file, lots[idx], pct);
  });

  // Truck path
  path.push(
    { A: new THREE.Vector3(-PATH_D,0.5, PATH_D), B: new THREE.Vector3(PATH_D,0.5, PATH_D) },
    { A: new THREE.Vector3(PATH_D,0.5, PATH_D),  B: new THREE.Vector3(PATH_D,0.5,-PATH_D) },
    { A: new THREE.Vector3(PATH_D,0.5,-PATH_D), B: new THREE.Vector3(-PATH_D,0.5,-PATH_D) },
    { A: new THREE.Vector3(-PATH_D,0.5,-PATH_D),B: new THREE.Vector3(-PATH_D,0.5, PATH_D) },
  );
  new GLTFLoader().load(
    "https://rawcdn.githack.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb",
    gltf => {
      truckTemplate = gltf.scene;
      for (let i = 0; i < 4; i++) spawnTruck(i);
    }
  );

  window.addEventListener("keydown", e => (keys[e.key] = true));
  window.addEventListener("keyup",   e => (keys[e.key] = false));

  // Play again button event
  const playAgainBtn = document.getElementById('playAgainBtn');
  if (playAgainBtn) playAgainBtn.onclick = playAgain;

  clock = new THREE.Clock();

  makeStorks();
}

function showGoalMsg() {
  const msg = document.getElementById('goalMsg');
  if (!msg) return;
  msg.style.display = "block";
}



function makeStorks() {
  const circle = [];
  const R = 18;
  const Y = 7.5;
  for (let i = 0; i < 80; i++) {
    const t = (i / 80) * Math.PI * 2;
    circle.push(new THREE.Vector3(Math.cos(t) * R, Y + Math.sin(t) * 1.2, Math.sin(t) * R));
  }
  storks.push(new Stork(scene, circle[0], circle, 4));

  const ellipse = [];
  const RX = 14, RZ = 10, Y2 = 6;
  for (let i = 0; i < 80; i++) {
    const t = (i / 80) * Math.PI * 2;
    ellipse.push(new THREE.Vector3(Math.cos(t) * RX, Y2 + Math.cos(t) * 1, Math.sin(t) * RZ - 6));
  }
  storks.push(new Stork(scene, ellipse[0], ellipse, 4.2));
}

function buildGrid() {
  const roadM = new THREE.MeshStandardMaterial({
    map: asphaltTexture,
    roughness: 0.72,
    metalness: 0.0
  });
  const sideM = new THREE.MeshStandardMaterial({ color: 0x888888 });

  for (let i = -EXT; i <= EXT; i++) {
    const p = i * STEP;
    // Horizontal street
    const h = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, STREETW), roadM);
    h.rotation.x = -Math.PI/2; h.position.z = p;
    h.receiveShadow = true; h.castShadow = false;
    scene.add(h);
    // Vertical street
    const v = new THREE.Mesh(new THREE.PlaneGeometry(STREETW, MAP_W), roadM);
    v.rotation.x = -Math.PI/2; v.position.x = p;
    v.receiveShadow = true; v.castShadow = false;
    scene.add(v);

    [-1,1].forEach(s => {
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, SIDEW), sideM);
      sh.rotation.x = -Math.PI/2;
      sh.position.set(0, 0.02, p + s*(STREETW/2+SIDEW/2));
      sh.receiveShadow = true; sh.castShadow = false;
      scene.add(sh);
      const sv = new THREE.Mesh(new THREE.PlaneGeometry(SIDEW, MAP_W), sideM);
      sv.rotation.x = -Math.PI/2;
      sv.position.set(p + s*(STREETW/2+SIDEW/2), 0.02, 0);
      sv.receiveShadow = true; sv.castShadow = false;
      scene.add(sv);
    });
  }
}

function buildLights() {
  class TL {
    constructor(x,z) {
      this.state = 0; this.t = 0; this.group = new THREE.Group();
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1,0.1,2),
        new THREE.MeshStandardMaterial({color:0x000000})
      );
      pole.castShadow = true; pole.receiveShadow = true;
      this.group.add(pole);
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(0.6,1.6,0.3),
        new THREE.MeshStandardMaterial({color:0x333333})
      );
      box.position.set(0,1.2,0.15);
      box.castShadow = true; box.receiveShadow = true;
      this.group.add(box);
      this.redMat = new THREE.MeshStandardMaterial({color:0x550000,emissive:0x550000,emissiveIntensity:0.5});
      this.grnMat = new THREE.MeshStandardMaterial({color:0x005500,emissive:0x005500,emissiveIntensity:0.5});
      this.bulb = new THREE.Mesh(new THREE.SphereGeometry(0.25,16,16), this.redMat);
      this.bulb.position.set(0,1.9,0.31);
      this.bulb.castShadow = true; this.bulb.receiveShadow = true;
      this.group.add(this.bulb);
      this.pt = new THREE.PointLight(0xff0000,1,5);
      this.pt.position.copy(this.bulb.position);
      this.group.add(this.pt);
      this.group.position.set(x,0,z);
      scene.add(this.group);
    }
    update(dt) {
      this.t += dt;
      if (this.t > 3) {
        this.t = 0; this.state ^= 1;
        if (this.state) {
          this.bulb.material = this.grnMat;
          this.pt.color.setHex(0x00ff00);
        } else {
          this.bulb.material = this.redMat;
          this.pt.color.setHex(0xff0000);
        }
      }
    }
  }
  window.trafficLights = [];
  for (let ring=1; ring<=EXT; ring++) {
    const D = ring*STEP;
    [[D-PAD,D-PAD],[-D+PAD,D-PAD],[-D+PAD,-D+PAD],[D-PAD,-D+PAD]]
      .forEach(([x,z]) => trafficLights.push(new TL(x,z)));
  }
}

function placeGLB(loader, filename, target, fillPct) {
  loader.load(
    filename,
    gltf => {
      const obj = gltf.scene;
      // scale + ground align
      const bbox = new THREE.Box3().setFromObject(obj);
      const size = bbox.getSize(new THREE.Vector3());
      const s = (BLOCK*fillPct)/Math.max(size.x,size.z);
      obj.scale.setScalar(s);
      const sb = new THREE.Box3().setFromObject(obj);
      const c  = sb.getCenter(new THREE.Vector3());
      const off= new THREE.Vector3(c.x, sb.min.y, c.z);
      obj.position.sub(off).add(target);

      obj.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      scene.add(obj);
      sceneryObjs.push(obj);
    },
    null,
    err => console.error(err)
  );
}

function spawnTruck(i) {
  const seg = path[i];
  const m = truckTemplate.clone(true);
  m.scale.set(1.5,1.5,1.5);
  m.position.copy(seg.A);
  const dir = new THREE.Vector3().subVectors(seg.B,seg.A).normalize();
  m.rotation.y = Math.atan2(dir.x, dir.z);
  m.traverse(child => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  scene.add(m);
  cars.push({ mesh:m, idx:i, t:0, speed:1/8 });
}

function animate() {
  const dt = clock.getDelta();

  // Stop game if goal message is up
  if (document.getElementById('goalMsg').style.display === "block") {
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
    return;
  }

  storks.forEach(s => s.update(dt));
  controls.update();
  trafficLights.forEach(l => l.update(dt));
  cars.forEach(c => {
    const light = trafficLights[[5,4,7,6][c.idx]];
    const pos = new THREE.Vector3().lerpVectors(path[c.idx].A, path[c.idx].B, c.t);
    if (!(light.state === 0 && pos.distanceTo(light.group.position) < 3)) {
      c.t += c.speed * dt;
      if (c.t >= 1) {
        c.idx = (c.idx + 1) % 4;
        c.t -= 1;
        const nxt = path[c.idx];
        const nd = new THREE.Vector3().subVectors(nxt.B, nxt.A).normalize();
        c.mesh.rotation.y = Math.atan2(nd.x, nd.z);
      }
    }
    c.mesh.position.lerpVectors(path[c.idx].A, path[c.idx].B, c.t);
  });

  if (avatar) {
    //MOVEMENT (classic grid: up/down/left/right, not camera-relative)
    const v = new THREE.Vector3();
    if (keys.ArrowUp || keys['w']) v.z -= 1;
    else if (keys.ArrowDown || keys['s']) v.z += 1;
    if (keys.ArrowLeft || keys['a']) v.x -= 1;
    else if (keys.ArrowRight || keys['d']) v.x += 1;

    if (v.lengthSq()) {
      v.normalize().multiplyScalar(dt * 5);
      const nxt = avatar.position.clone().add(v);
      const lim = HALF - SIDEW / 2;
      nxt.x = THREE.MathUtils.clamp(nxt.x, -lim, lim);
      nxt.z = THREE.MathUtils.clamp(nxt.z, -lim, lim);

      let blocked = false;
      //SCENERY COLLISION
      if (sceneryObjs.length) {
        avatar.position.copy(nxt);
        const testBox = new THREE.Box3().setFromObject(avatar);
        for (let obj of sceneryObjs) {
          const objBox = new THREE.Box3().setFromObject(obj);
          if (testBox.intersectsBox(objBox)) {
            blocked = true;
            break;
          }
        }
        if (blocked) {
          avatar.position.sub(v);
        }
      }

      // Only move if not blocked and on a road
      if (!blocked && isOnRoad(avatar.position)) {
        trafficLights.forEach(L => {
          if (L.state === 0) {
            const toL = L.group.position.clone().sub(avatar.position);
            if (toL.dot(v) > 0 && avatar.position.distanceTo(L.group.position) < 3) {
              avatar.position.sub(v);
            }
          }
        });
        avatar.lookAt(avatar.position.clone().add(v));
      }
    }

    // TRUCK COLLISION
    const avatarBox = new THREE.Box3().setFromObject(avatar);
    for (let c of cars) {
      const truckBox = new THREE.Box3().setFromObject(c.mesh);
      if (avatarBox.intersectsBox(truckBox)) {
        avatar.position.copy(START_POS);
        break;
      }
    }

    // GOAL DETECTION
    if (avatar.position.distanceTo(goal.position) < 2) {
      showGoalMsg();
    }

    // CAMERA LOGIC
    // Base: classic bird's-eye isometric
    // Camera looks down from above and behind, following avatar

    let camX = avatar.position.x;
    let camZ = avatar.position.z + HALF * 0.6;
    let camY = HALF * 0.9;

    // LIFT CAMERA IF BEHIND HIGH BUILDING
    // Raycast from camera to avatar, if hits a building, raise camera.y
    let raiseY = 0;
    const raycaster = new THREE.Raycaster();
    const dir = new THREE.Vector3().subVectors(avatar.position, new THREE.Vector3(camX, camY, camZ)).normalize();
    raycaster.set(new THREE.Vector3(camX, camY, camZ), dir);

    // Find all mesh children from sceneryObjs
    const allMeshes = [];
    for (const obj of sceneryObjs) {
      obj.traverse(child => {
        if (child.isMesh) allMeshes.push(child);
      });
    }

    const intersects = raycaster.intersectObjects(allMeshes, true);
    if (intersects.length) {
      // There's a building between camera and avatar, so raise camera up more
      raiseY = 18; // or whatever value feels right (try 16-24)
    }

    // Smoothly lerp camera position (avoids earthquake, no sudden jumps)
    camera.position.lerp(
      new THREE.Vector3(camX, camY + raiseY, camZ),
      0.12
    );
    camera.lookAt(avatar.position);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

function isOnRoad(pos) {
  for (let i = -EXT; i <= EXT; i++) {
    const center = i * STEP;
    if (Math.abs(pos.z - center) <= STREETW/2 + 0.01) return true;
    if (Math.abs(pos.x - center) <= STREETW/2 + 0.01) return true;
  }
  return false;
}

function onWindowResize(){
  renderer.setSize(window.innerWidth,window.innerHeight);
  camera.aspect=window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
}
