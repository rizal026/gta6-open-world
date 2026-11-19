// city.js — builds Solmar Bay: a sun-soaked coastal city on a grid.
// Streets run along X and Z; blocks between them hold procedural buildings.
// Returns the collision boxes, street list, landmarks and spawn points.
import * as THREE from 'three';
import {
  makeBuildingTexture,
  makeRoadTexture,
  makeSidewalkTexture,
  makeSandTexture,
  makeSignTexture,
  makeSkyTexture,
} from './textures.js';

export const CITY_HALF = 240; // city spans -240..240 on X and Z
export const STREET_AT = [-200, -120, -40, 40, 120, 200];
export const STREET_WIDTH = 16;

const BUILDING_COLORS = ['#e8a87c', '#d9c7a7', '#c98f7a', '#a7c4d9', '#e0b48f', '#c4a484', '#dba6a6', '#9fb8a4'];
const SHOP_NAMES = [
  ['Noodle Bar', '#e23b3b', '#fff3d6'],
  ['Sunset Motel', '#2f6fb2', '#ffe9b0'],
  ['Coral Cafe', '#1f8a70', '#ffffff'],
  ['Mango Market', '#e07b39', '#fff3d6'],
  ['Palm Gym', '#5b4a8a', '#ffffff'],
  ['Dockside Bait', '#2a6f7f', '#ffe9b0'],
  ['Solmar Savings', '#3a5a7c', '#ffd98a'],
  ['Vulture Ink', '#222222', '#ff5a5a'],
];

function seededRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildCity(game) {
  const { scene } = game;
  const rand = seededRandom(20261124);
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const lamps = [];
  const landmarks = {};

  // Sky dome: a big sphere with a sunset gradient, seen from inside.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 16),
    new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);

  // Sun disc low in the west, plus a warm directional light and sky fill.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false }),
  );
  sun.position.set(-620, 150, -300);
  sun.lookAt(0, 40, 0);
  scene.add(sun);
  const sunLight = new THREE.DirectionalLight(0xffd9a0, 2.6);
  sunLight.position.set(-180, 220, -120);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -260;
  sunLight.shadow.camera.right = 260;
  sunLight.shadow.camera.top = 260;
  sunLight.shadow.camera.bottom = -260;
  sunLight.shadow.camera.far = 700;
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight);
  scene.add(new THREE.HemisphereLight(0x9fc4e8, 0x8a7a5a, 0.9));
  scene.fog = new THREE.Fog(0xf2b98a, 320, 900);

  // Ground: grass-green city floor.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 260, CITY_HALF * 2 + 260),
    new THREE.MeshStandardMaterial({ color: 0x7fae62, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Beach strip and sea along the south edge (z > 240).
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 260, 46),
    new THREE.MeshStandardMaterial({ map: makeSandTexture(), roughness: 1 }),
  );
  sand.material.map.repeat.set(12, 1);
  sand.material.map.wrapS = THREE.RepeatWrapping;
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.05, CITY_HALF + 23);
  sand.receiveShadow = true;
  scene.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_HALF * 2 + 260, 260),
    new THREE.MeshStandardMaterial({ color: 0x1f7fae, roughness: 0.25, metalness: 0.1 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, CITY_HALF + 46 + 130);
  scene.add(sea);
  game.sea = sea;

  // Roads: dark strips along every street line, with sidewalks beside them.
  // A plane rotated only on X runs east-west (long axis = world X); adding
  // rotation.z = 90 deg turns its long axis to world Z, i.e. north-south.
  // So an east-west street sits at z = at and a north-south street at x = at.
  const roadTexture = makeRoadTexture();
  roadTexture.wrapS = THREE.RepeatWrapping;
  roadTexture.wrapT = THREE.RepeatWrapping;
  const sidewalkTexture = makeSidewalkTexture();
  sidewalkTexture.wrapS = THREE.RepeatWrapping;
  sidewalkTexture.wrapT = THREE.RepeatWrapping;
  const roadMaterial = new THREE.MeshStandardMaterial({ map: roadTexture, roughness: 0.95 });
  const sidewalkMaterial = new THREE.MeshStandardMaterial({ map: sidewalkTexture, roughness: 1 });
  for (const at of STREET_AT) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2, STREET_WIDTH), roadMaterial.clone());
      road.material.map = roadTexture.clone();
      road.material.map.needsUpdate = true;
      road.material.map.repeat.set(CITY_HALF * 2 / 32, 1);
      road.rotation.x = -Math.PI / 2;
      if (!horizontal) road.rotation.z = Math.PI / 2;
      road.position.set(horizontal ? 0 : at, 0.08, horizontal ? at : 0);
      road.receiveShadow = true;
      scene.add(road);
      for (const side of [-1, 1]) {
        const walk = new THREE.Mesh(new THREE.PlaneGeometry(CITY_HALF * 2, 6), sidewalkMaterial.clone());
        walk.material.map = sidewalkTexture.clone();
        walk.material.map.needsUpdate = true;
        walk.material.map.repeat.set(CITY_HALF * 2 / 16, 1);
        walk.rotation.x = -Math.PI / 2;
        if (!horizontal) walk.rotation.z = Math.PI / 2;
        walk.position.set(
          horizontal ? 0 : at + side * (STREET_WIDTH / 2 + 3),
          0.12,
          horizontal ? at + side * (STREET_WIDTH / 2 + 3) : 0,
        );
        walk.receiveShadow = true;
        scene.add(walk);
      }
    }
  }

  // Buildings: fill each block between streets with 1-4 boxes.
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  let shopIndex = 0;
  for (let bx = 0; bx < STREET_AT.length - 1; bx++) {
    for (let bz = 0; bz < STREET_AT.length - 1; bz++) {
      const x0 = STREET_AT[bx] + STREET_WIDTH / 2 + 4;
      const x1 = STREET_AT[bx + 1] - STREET_WIDTH / 2 - 4;
      const z0 = STREET_AT[bz] + STREET_WIDTH / 2 + 4;
      const z1 = STREET_AT[bz + 1] - STREET_WIDTH / 2 - 4;
      const count = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < count; i++) {
        const w = 14 + rand() * 22;
        const d = 14 + rand() * 22;
        const h = 12 + rand() * rand() * 52;
        const cx = x0 + w / 2 + rand() * Math.max(1, x1 - x0 - w);
        const cz = z0 + d / 2 + rand() * Math.max(1, z1 - z0 - d);
        const floors = Math.max(2, Math.round(h / 7));
        const color = BUILDING_COLORS[Math.floor(rand() * BUILDING_COLORS.length)];
        const material = new THREE.MeshStandardMaterial({
          map: makeBuildingTexture(Math.floor(rand() * 100000), color, floors),
          roughness: 0.9,
        });
        const building = new THREE.Mesh(boxGeometry, material);
        building.scale.set(w, h, d);
        building.position.set(cx, h / 2, cz);
        building.castShadow = true;
        building.receiveShadow = true;
        scene.add(building);
        colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
        // rooftop box
        if (rand() < 0.6) {
          const roof = new THREE.Mesh(boxGeometry, new THREE.MeshStandardMaterial({ color: 0x5a5f66, roughness: 1 }));
          roof.scale.set(4 + rand() * 4, 2, 4 + rand() * 4);
          roof.position.set(cx + (rand() - 0.5) * w * 0.4, h + 1, cz + (rand() - 0.5) * d * 0.4);
          scene.add(roof);
        }
        // a few ground-floor shops get a sign facing the nearest street
        if (h < 26 && shopIndex < SHOP_NAMES.length && rand() < 0.55) {
          const [name, bg, fg] = SHOP_NAMES[shopIndex++];
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(12, 3),
            new THREE.MeshBasicMaterial({ map: makeSignTexture(name, bg, fg) }),
          );
          const facingX = Math.abs(cx) > Math.abs(cz);
          sign.position.set(cx + (facingX ? (w / 2 + 0.15) * Math.sign(cx - 0) : 0), 5.5, cz + (!facingX ? (d / 2 + 0.15) * Math.sign(cz - 0) : 0));
          sign.rotation.y = facingX ? (Math.sign(cx) * Math.PI) / 2 + Math.PI / 2 : Math.sign(cz) * Math.PI;
          if (Math.sign(cx) < 0 && facingX) sign.rotation.y = -Math.PI / 2;
          if (Math.sign(cz) < 0 && !facingX) sign.rotation.y = Math.PI;
          scene.add(sign);
        }
      }
    }
  }

  // Landmark buildings (named, used by missions): the bank, the motel, the docks.
  function landmark(name, x, z, w, h, d, color, signBg) {
    const material = new THREE.MeshStandardMaterial({
      map: makeBuildingTexture(777, color, Math.max(2, Math.round(h / 7))),
      roughness: 0.85,
    });
    const mesh = new THREE.Mesh(boxGeometry, material);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 4),
      new THREE.MeshBasicMaterial({ map: makeSignTexture(name, signBg, '#ffffff') }),
    );
    sign.position.set(x, h * 0.72, z + d / 2 + 0.2);
    scene.add(sign);
    landmarks[name] = new THREE.Vector3(x, 0, z + d / 2 + 6);
    return mesh;
  }
  landmark('Solmar Savings', -40, -160, 34, 22, 26, '#3a5a7c', '#3a5a7c');
  landmark('Sunset Motel', 120, 40, 30, 16, 24, '#2f6fb2', '#2f6fb2');
  landmark('Dockside', -200, 120, 26, 14, 30, '#2a6f7f', '#2a6f7f');

  // Palm trees along the beach and the marina boulevard.
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8a6a42, roughness: 1 });
  const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x3f8f4f, roughness: 1 });
  for (let i = 0; i < 26; i++) {
    const x = -220 + i * 18 + rand() * 6;
    const z = 226 + rand() * 8;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 9, 6), trunkMaterial);
    trunk.position.set(x, 4.5, z);
    trunk.castShadow = true;
    scene.add(trunk);
    for (let l = 0; l < 5; l++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(2.6, 6, 4), leafMaterial);
      const angle = (l / 5) * Math.PI * 2;
      leaf.scale.set(1.6, 0.35, 0.8);
      leaf.position.set(x + Math.cos(angle) * 2.4, 9.4, z + Math.sin(angle) * 2.4);
      leaf.rotation.y = angle;
      scene.add(leaf);
    }
    colliders.push({ minX: x - 1, maxX: x + 1, minZ: z - 1, maxZ: z + 1 });
  }

  // Street lamps at intersections.
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: 0.6, metalness: 0.4 });
  const lampMaterial = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffd76a, emissiveIntensity: 0.7 });
  for (const x of [-120, 0, 120]) {
    for (const z of [-120, 0, 120]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 6), poleMaterial);
      pole.position.set(x + 9, 3.5, z + 9);
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lampMaterial);
      lamp.position.set(x + 9, 7.2, z + 9);
      scene.add(lamp);
      lamps.push(new THREE.PointLight(0xffd76a, 12, 26, 1.8));
      lamps[lamps.length - 1].position.set(x + 9, 7, z + 9);
      scene.add(lamps[lamps.length - 1]);
    }
  }

  return {
    colliders,
    lamps,
    landmarks,
    spawn: new THREE.Vector3(0, 0, 8),
    hideout: new THREE.Vector3(120, 0, 52),
    chopShop: new THREE.Vector3(-200, 0, 132),
    marina: new THREE.Vector3(-160, 0, 200),
  };
}

// Circle (player/car) vs building AABB collision. Returns the push-out offset.
export function collideCircle(pos, radius, colliders) {
  let px = pos.x;
  let pz = pos.z;
  for (const box of colliders) {
    const cx = Math.max(box.minX, Math.min(px, box.maxX));
    const cz = Math.max(box.minZ, Math.min(pz, box.maxZ));
    const dx = px - cx;
    const dz = pz - cz;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius) {
      if (distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        px = cx + (dx / dist) * radius;
        pz = cz + (dz / dist) * radius;
      } else {
        // centre inside the box: push out along the smallest penetration axis
        const left = px - box.minX;
        const right = box.maxX - px;
        const top = pz - box.minZ;
        const bottom = box.maxZ - pz;
        const min = Math.min(left, right, top, bottom);
        if (min === left) px = box.minX - radius;
        else if (min === right) px = box.maxX + radius;
        else if (min === top) pz = box.minZ - radius;
        else pz = box.maxZ + radius;
      }
    }
  }
  pos.x = px;
  pos.z = pz;
}
