// traffic.js — traffic cars that drive the street grid and pedestrians
// who stroll the sidewalks. Simple waypoint driving: straight along a
// street, turn at a random intersection, never leave the road.
import * as THREE from 'three';
import { STREET_AT, STREET_WIDTH, collideCircle } from './city.js';

const CAR_COLORS = [0xd94f3d, 0x3d7bd9, 0xe8c93a, 0x7fb069, 0xd9d9d9, 0x2b2b2e, 0xe07b39, 0x8a5fb0];

function makeCarMesh(color, isTaxi) {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.4), bodyMaterial);
  body.position.y = 0.65;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.65, 2.2),
    new THREE.MeshStandardMaterial({ color: 0x1a2733, roughness: 0.15, metalness: 0.7 }),
  );
  cabin.position.set(0, 1.3, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeometry = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.9 });
  for (const [x, z] of [[-1.0, 1.4], [1.0, 1.4], [-1.0, -1.4], [1.0, -1.4]]) {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.42, z);
    group.add(wheel);
  }
  if (isTaxi) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.28, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xffd23e, emissive: 0x8a6d00, emissiveIntensity: 0.4 }),
    );
    sign.position.set(0, 1.75, -0.2);
    group.add(sign);
  }
  return group;
}

export function createTraffic(game) {
  const { scene, city } = game;
  const cars = [];
  const peds = [];

  function randomStreetPoint() {
    const horizontal = Math.random() < 0.5;
    const at = STREET_AT[Math.floor(Math.random() * STREET_AT.length)];
    const along = -220 + Math.random() * 440;
    const lane = (Math.random() < 0.5 ? -1 : 1) * (STREET_WIDTH / 4);
    return {
      x: horizontal ? along : at + lane,
      z: horizontal ? at + lane : along,
      // forward is (sin heading, 0, cos heading): horizontal streets run
      // along X so heading is +/-PI/2, vertical streets run along Z so 0/PI.
      heading: horizontal ? (lane > 0 ? Math.PI / 2 : -Math.PI / 2) : (lane > 0 ? 0 : Math.PI),
      horizontal,
    };
  }

  for (let i = 0; i < 14; i++) {
    const start = randomStreetPoint();
    const isTaxi = i === 3 || i === 9;
    const mesh = makeCarMesh(CAR_COLORS[i % CAR_COLORS.length], isTaxi);
    mesh.position.set(start.x, 0, start.z);
    mesh.rotation.y = start.heading;
    scene.add(mesh);
    cars.push({
      mesh,
      x: start.x,
      z: start.z,
      heading: start.heading,
      speed: 9 + Math.random() * 5,
      horizontal: start.horizontal,
      isTaxi,
      stopped: 0,
    });
  }

  const pedColors = [0xe8b4b8, 0x7fb069, 0x4a6fa5, 0xd9a441, 0x9b7bb8, 0x3d3d3d];
  for (let i = 0; i < 22; i++) {
    const at = STREET_AT[Math.floor(Math.random() * STREET_AT.length)];
    const along = -220 + Math.random() * 440;
    const horizontal = Math.random() < 0.5;
    const side = (Math.random() < 0.5 ? -1 : 1) * (STREET_WIDTH / 2 + 3);
    const mesh = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.42, 0.9, 3, 8),
      new THREE.MeshStandardMaterial({ color: pedColors[i % pedColors.length], roughness: 0.9 }),
    );
    body.position.y = 1.05;
    body.castShadow = true;
    mesh.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xe8b98a, roughness: 0.8 }),
    );
    head.position.y = 2.0;
    head.castShadow = true;
    mesh.add(head);
    mesh.position.set(horizontal ? along : at + side, 0, horizontal ? at + side : along);
    scene.add(mesh);
    peds.push({
      mesh,
      x: mesh.position.x,
      z: mesh.position.z,
      heading: Math.random() * Math.PI * 2,
      speed: 1.2 + Math.random() * 1.1,
      horizontal,
      at,
      side,
      walkPhase: Math.random() * 10,
      alive: true,
    });
  }

  function nearestStreet(value) {
    let best = STREET_AT[0];
    let bestDist = Infinity;
    for (const at of STREET_AT) {
      const d = Math.abs(value - at);
      if (d < bestDist) { bestDist = d; best = at; }
    }
    return best;
  }

  return {
    cars,
    peds,
    update(dt) {
      // Traffic cars: drive along their street, turn at intersections.
      for (const car of cars) {
        if (car.stopped > 0) { car.stopped -= dt; continue; }
        const step = car.speed * dt;
        let nx = car.x;
        let nz = car.z;
        if (car.horizontal) nx += Math.sin(car.heading) * step;
        else nz += Math.cos(car.heading) * step;
        // reached an intersection? maybe turn onto the cross street
        const along = car.horizontal ? nx : nz;
        const cross = nearestStreet(along);
        if (Math.abs(along - cross) < 1.5 && Math.random() < 0.35) {
          car.horizontal = !car.horizontal;
          const lane = (Math.random() < 0.5 ? -1 : 1) * (STREET_WIDTH / 4);
          if (car.horizontal) {
            nz = cross + lane;
            car.heading = lane > 0 ? Math.PI / 2 : -Math.PI / 2;
          } else {
            nx = cross + lane;
            car.heading = lane > 0 ? 0 : Math.PI;
          }
        }
        // wrap around the city edge
        if (nx > 232) nx = -232;
        if (nx < -232) nx = 232;
        if (nz > 232) nz = -232;
        if (nz < -232) nz = 232;
        car.x = nx;
        car.z = nz;
        car.mesh.position.set(nx, 0, nz);
        car.mesh.rotation.y = car.heading;
        // brake for the car ahead on the same street
        for (const other of cars) {
          if (other === car || other.horizontal !== car.horizontal) continue;
          const dx = other.x - car.x;
          const dz = other.z - car.z;
          const ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
          const dist = Math.hypot(dx, dz);
          if (dist < 9 && ahead > 0 && ahead < 9) car.stopped = 0.4;
        }
      }
      // Pedestrians: stroll along their sidewalk, turn around at the ends.
      for (const ped of peds) {
        if (!ped.alive) continue;
        ped.walkPhase += dt * 6;
        const step = ped.speed * dt;
        if (ped.horizontal) ped.x += Math.sin(ped.heading) * step;
        else ped.z += Math.cos(ped.heading) * step;
        const along = ped.horizontal ? ped.x : ped.z;
        if (along > 228 || along < -228) ped.heading += Math.PI;
        ped.mesh.position.set(ped.x, Math.abs(Math.sin(ped.walkPhase)) * 0.06, ped.z);
        ped.mesh.rotation.y = ped.heading;
      }
    },
    // A pedestrian hit by a car or a bullet: falls over and stays down.
    knockDownPed(ped) {
      if (!ped.alive) return;
      ped.alive = false;
      ped.mesh.rotation.z = Math.PI / 2;
      ped.mesh.position.y = 0.4;
    },
  };
}
