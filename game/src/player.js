// player.js — Jax Marlowe on foot: WASD movement relative to the camera,
// mouse-drag orbit camera that follows behind, jump, and a simple
// third-person camera with collision-free framing.
import * as THREE from 'three';
import { collideCircle } from './city.js';

const WALK_SPEED = 6;
const RUN_SPEED = 10.5;

export function createPlayer(game) {
  const { scene } = game;
  const group = new THREE.Group();

  const jacket = new THREE.MeshStandardMaterial({ color: 0x2f6fb2, roughness: 0.85 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x2b3a55, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe8b98a, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.85, 3, 10), jacket);
  body.position.y = 1.15;
  body.castShadow = true;
  group.add(body);
  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.7, 3, 10), jeans);
  legs.position.y = 0.45;
  legs.castShadow = true;
  group.add(legs);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), skin);
  head.position.y = 2.05;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.34, 0.12, 12),
    new THREE.MeshStandardMaterial({ color: 0xe8c93a, roughness: 0.8 }),
  );
  cap.position.y = 2.28;
  group.add(cap);
  scene.add(group);

  const player = {
    mesh: group,
    pos: new THREE.Vector3(0, 0, 8),
    heading: 0,
    speed: 0,
    onFoot: true,
    vehicle: null,
    health: 100,
    money: 250,
    totalEarned: 0,
    bestWanted: 0,
    vy: 0,
    grounded: true,
    moving: false,
    cameraYaw: Math.PI,
    cameraPitch: 0.32,
    cameraDistance: 8.5,
  };
  group.position.copy(player.pos);

  player.update = function update(dt) {
    const { keys, city } = game;
    if (!player.onFoot) return;
      const run = keys['ShiftLeft'] || keys['ShiftRight'];
      const maxSpeed = run ? RUN_SPEED : WALK_SPEED;
      let forward = 0;
      let strafe = 0;
      if (keys['KeyW'] || keys['ArrowUp']) forward += 1;
      if (keys['KeyS'] || keys['ArrowDown']) forward -= 1;
      if (keys['KeyA'] || keys['ArrowLeft']) strafe -= 1;
      if (keys['KeyD'] || keys['ArrowRight']) strafe += 1;
      const moving = forward !== 0 || strafe !== 0;
      player.moving = moving;
      // movement is relative to the camera yaw: W walks away from the
      // camera (view direction is (-sin yaw, -cos yaw)), D strafes right.
      const sin = Math.sin(player.cameraYaw);
      const cos = Math.cos(player.cameraYaw);
      const mx = -sin * forward + cos * strafe;
      const mz = -cos * forward - sin * strafe;
      const len = Math.hypot(mx, mz);
      if (len > 0.001) {
        const nx = mx / len;
        const nz = mz / len;
        player.pos.x += nx * maxSpeed * dt;
        player.pos.z += nz * maxSpeed * dt;
        player.heading = Math.atan2(nx, nz);
        player.speed = maxSpeed;
      } else {
        player.speed = 0;
      }
      // jump + gravity
      if (keys['Space'] && player.grounded) {
        player.vy = 7;
        player.grounded = false;
      }
      if (!player.grounded) {
        player.vy -= 22 * dt;
        player.pos.y += player.vy * dt;
        if (player.pos.y <= 0) {
          player.pos.y = 0;
          player.vy = 0;
          player.grounded = true;
        }
      }
      // keep inside the city and out of buildings
      player.pos.x = Math.max(-236, Math.min(236, player.pos.x));
      player.pos.z = Math.max(-236, Math.min(258, player.pos.z));
      collideCircle(player.pos, 0.7, city.colliders);
      group.position.copy(player.pos);
      group.rotation.y = player.heading;
      // walk bob
      const bob = moving && player.grounded ? Math.sin(game.time * 11) * 0.06 : 0;
      body.position.y = 1.15 + bob;
  };

  player.updateCamera = function updateCamera(dt) {
    const { camera } = game;
    const target = player.onFoot
      ? new THREE.Vector3(player.pos.x, player.pos.y + 2.2, player.pos.z)
      : player.vehicle
        ? new THREE.Vector3(player.vehicle.x, 2.2, player.vehicle.z)
        : new THREE.Vector3(player.pos.x, player.pos.y + 2.2, player.pos.z);
    const yaw = player.onFoot ? player.cameraYaw : (game.vehicles?.driveCameraYaw ?? player.cameraYaw);
    const dist = player.onFoot ? player.cameraDistance : 11;
    const pitch = player.onFoot ? player.cameraPitch : 0.3;
    const cx = target.x + Math.sin(yaw) * Math.cos(pitch) * dist;
    const cy = target.y + Math.sin(pitch) * dist;
    const cz = target.z + Math.cos(yaw) * Math.cos(pitch) * dist;
    camera.position.lerp(new THREE.Vector3(cx, Math.max(1.2, cy), cz), 1 - Math.pow(0.0001, dt));
    camera.lookAt(target);
  };

  return player;
}
