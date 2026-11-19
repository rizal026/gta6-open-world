// vehicles.js — drivable cars: parked cars around the city plus any
// traffic car you steal. Arcade driving: accelerate, brake, reverse,
// steering that tightens with speed, skids, crash damage and smoke.
import * as THREE from 'three';
import { collideCircle } from './city.js';

const PARKED_SPOTS = [
  { x: -36, z: 44, heading: Math.PI / 2, color: 0xd94f3d, name: 'Comet GT' },
  { x: 44, z: -36, heading: 0, color: 0x3d7bd9, name: 'Dune Runner' },
  { x: -116, z: 124, heading: -Math.PI / 2, color: 0xe8c93a, name: 'Bay Taxi' },
  { x: 124, z: -116, heading: Math.PI, color: 0x7fb069, name: 'Mule' },
  { x: 36, z: 164, heading: Math.PI / 2, color: 0x8a5fb0, name: 'Comet GT' },
  { x: -164, z: -36, heading: 0, color: 0xd9d9d9, name: 'Dune Runner' },
  { x: 164, z: 84, heading: -Math.PI / 2, color: 0xe07b39, name: 'Bay Taxi' },
  { x: -84, z: -164, heading: Math.PI, color: 0x2b2b2e, name: 'Mule' },
];

export function makeCarMesh(color, isTaxi) {
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
  const wheels = [];
  for (const [x, z] of [[-1.0, 1.4], [1.0, 1.4], [-1.0, -1.4], [1.0, -1.4]]) {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.42, z);
    group.add(wheel);
    wheels.push(wheel);
  }
  if (isTaxi) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.28, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xffd23e, emissive: 0x8a6d00, emissiveIntensity: 0.4 }),
    );
    sign.position.set(0, 1.75, -0.2);
    group.add(sign);
  }
  return { group, wheels };
}

export function createVehicles(game) {
  const { scene } = game;
  const cars = [];

  for (const spot of PARKED_SPOTS) {
    const { group, wheels } = makeCarMesh(spot.color, spot.name === 'Bay Taxi');
    group.position.set(spot.x, 0, spot.z);
    group.rotation.y = spot.heading;
    scene.add(group);
    cars.push({
      mesh: group,
      wheels,
      x: spot.x,
      z: spot.z,
      heading: spot.heading,
      speed: 0,
      name: spot.name,
      parked: true,
      damage: 0,
      smokeTimer: 0,
      stolen: false,
      trafficRef: null,
    });
  }

  function addTrafficCarAsDrivable(trafficCar) {
    // A stolen traffic car keeps its mesh; the traffic system lets go of it.
    const car = {
      mesh: trafficCar.mesh,
      wheels: [],
      x: trafficCar.x,
      z: trafficCar.z,
      heading: trafficCar.heading,
      speed: 0,
      name: trafficCar.isTaxi ? 'Bay Taxi' : 'Street Car',
      parked: false,
      damage: 0,
      smokeTimer: 0,
      stolen: true,
      trafficRef: trafficCar,
    };
    cars.push(car);
    return car;
  }

  const vehicles = {
    cars,
    driveCameraYaw: Math.PI,
    current: null,
    nearestCar() {
      const player = game.player;
      let best = null;
      let bestDist = 4.2;
      for (const car of cars) {
        if (car === vehicles.current) continue;
        const d = Math.hypot(car.x - player.pos.x, car.z - player.pos.z);
        if (d < bestDist) { bestDist = d; best = car; }
      }
      // traffic cars can be stolen too
      for (const tcar of game.traffic.cars) {
        const d = Math.hypot(tcar.x - player.pos.x, tcar.z - player.pos.z);
        if (d < bestDist) { bestDist = d; best = { trafficCar: tcar }; }
      }
      return best;
    },
    enterCar(target) {
      const player = game.player;
      let car = target;
      if (target.trafficCar) {
        const tcar = target.trafficCar;
        const index = game.traffic.cars.indexOf(tcar);
        if (index !== -1) game.traffic.cars.splice(index, 1);
        car = addTrafficCarAsDrivable(tcar);
        game.police.addHeat(2);
        game.hud.showToast('Car stolen! The cops noticed.');
      } else if (!car.stolen) {
        car.stolen = true;
        game.police.addHeat(1);
        game.hud.showToast(`Stole a ${car.name}.`);
      }
      car.parked = false;
      vehicles.current = car;
      player.onFoot = false;
      player.vehicle = car;
      player.mesh.visible = false;
      vehicles.driveCameraYaw = car.heading + Math.PI;
      game.audio.startEngine();
      game.audio.click();
    },
    exitCar() {
      const player = game.player;
      const car = vehicles.current;
      if (!car) return;
      vehicles.current = null;
      player.onFoot = true;
      player.vehicle = null;
      player.mesh.visible = true;
      player.pos.set(car.x + Math.cos(car.heading) * 2.5, 0, car.z - Math.sin(car.heading) * 2.5);
      player.mesh.position.copy(player.pos);
      player.cameraYaw = car.heading + Math.PI;
      game.audio.setEngine(0, false);
    },
    update(dt) {
      const car = vehicles.current;
      if (!car) return;
      const { keys } = game;
      const forward = (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
      const steer = (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0) - (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0);
      const topSpeed = 34;
      if (forward > 0) car.speed += 22 * dt;
      else if (forward < 0) car.speed -= car.speed > 0.5 ? 30 * dt : 10 * dt;
      else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
      car.speed = Math.max(-12, Math.min(topSpeed, car.speed));
      const speedFactor = Math.min(1, Math.abs(car.speed) / 12);
      const turn = steer * 1.9 * speedFactor * dt * Math.sign(car.speed || 1);
      const skidding = Math.abs(steer) > 0 && Math.abs(car.speed) > 18;
      if (skidding && Math.random() < 0.35) {
        game.effects.smoke(new THREE.Vector3(car.x, 0.4, car.z));
        if (Math.random() < 0.2) game.audio.skid();
      }
      car.heading += turn;
      const nx = car.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.z + Math.cos(car.heading) * car.speed * dt;
      const before = { x: car.x, z: car.z };
      car.x = Math.max(-236, Math.min(236, nx));
      car.z = Math.max(-236, Math.min(258, nz));
      const probe = new THREE.Vector3(car.x, 0, car.z);
      collideCircle(probe, 2.2, game.city.colliders);
      car.x = probe.x;
      car.z = probe.z;
      const hitWall = Math.abs(car.x - before.x - Math.sin(car.heading) * car.speed * dt) > 0.05
        || Math.abs(car.z - before.z - Math.cos(car.heading) * car.speed * dt) > 0.05;
      if (hitWall && Math.abs(car.speed) > 6) {
        car.damage += Math.abs(car.speed) * 0.4;
        game.effects.sparks(new THREE.Vector3(car.x, 1, car.z));
        game.audio.crash();
        game.police.addHeat(0.5);
        car.speed *= 0.3;
      }
      // bump traffic cars
      for (const tcar of game.traffic.cars) {
        const d = Math.hypot(tcar.x - car.x, tcar.z - car.z);
        if (d < 3.4) {
          tcar.stopped = 0.8;
          if (Math.abs(car.speed) > 8) {
            car.damage += 4;
            game.effects.sparks(new THREE.Vector3(car.x, 1, car.z));
            game.audio.crash();
            car.speed *= 0.55;
          }
        }
      }
      // run over pedestrians
      for (const ped of game.traffic.peds) {
        if (!ped.alive) continue;
        const d = Math.hypot(ped.x - car.x, ped.z - car.z);
        if (d < 2.4 && Math.abs(car.speed) > 2) {
          game.traffic.knockDownPed(ped);
          game.effects.blood(new THREE.Vector3(ped.x, 1, ped.z));
          game.police.addHeat(2);
          game.hud.showToast('Pedestrian hit! Wanted level up.');
        }
      }
      // damage smoke
      if (car.damage > 55) {
        car.smokeTimer -= dt;
        if (car.smokeTimer <= 0) {
          car.smokeTimer = 0.12;
          game.effects.smoke(new THREE.Vector3(car.x, 1.4, car.z));
        }
      }
      if (car.damage > 110) {
        // wrecked: the car dies and Jax gets out
        game.effects.sparks(new THREE.Vector3(car.x, 1, car.z));
        game.audio.crash();
        vehicles.exitCar();
        car.speed = 0;
        return;
      }
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      car.mesh.rotation.z = -steer * 0.04 * speedFactor;
      for (const wheel of car.wheels) wheel.rotation.x += (car.speed * dt) / 0.42;
      // chase camera follows behind the car
      const targetYaw = car.heading + Math.PI;
      let diff = targetYaw - vehicles.driveCameraYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      vehicles.driveCameraYaw += diff * Math.min(1, dt * 2.2);
      game.audio.setEngine(Math.abs(car.speed) / topSpeed, true);
      game.hud.setSpeed(Math.abs(car.speed) * 3.2);
    },
  };
  return vehicles;
}
