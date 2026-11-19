// effects.js — small particle bursts: crash sparks, tyre smoke, muzzle flash.
// One shared Points pool per burst; bursts fade and recycle themselves.
import * as THREE from 'three';

const MAX_PARTICLES = 400;

export function createEffects(game) {
  const { scene } = game;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const colors = new Float32Array(MAX_PARTICLES * 3);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 1.6,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  const particles = [];
  for (let i = 0; i < MAX_PARTICLES; i++) {
    particles.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1 });
  }
  let cursor = 0;

  function spawn(x, y, z, vx, vy, vz, life, r, g, b) {
    const p = particles[cursor];
    cursor = (cursor + 1) % MAX_PARTICLES;
    p.alive = true;
    p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = life;
    p.maxLife = life;
    positions[cursor * 3] = x;
    positions[cursor * 3 + 1] = y;
    positions[cursor * 3 + 2] = z;
    colors[cursor * 3] = r;
    colors[cursor * 3 + 1] = g;
    colors[cursor * 3 + 2] = b;
  }

  function burst(position, count, color, speed, life, up) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spread = Math.random() * speed;
      spawn(
        position.x, position.y + Math.random() * 0.5, position.z,
        Math.cos(angle) * spread, (Math.random() * up) + 1, Math.sin(angle) * spread,
        life * (0.5 + Math.random() * 0.5),
        color.r, color.g, color.b,
      );
    }
  }

  return {
    sparks(position) {
      burst(position, 26, new THREE.Color(1, 0.75, 0.2), 9, 0.6, 5);
    },
    smoke(position) {
      burst(position, 10, new THREE.Color(0.45, 0.45, 0.45), 2.5, 1.1, 2.5);
    },
    muzzle(position) {
      burst(position, 8, new THREE.Color(1, 0.9, 0.4), 6, 0.18, 2);
    },
    blood(position) {
      burst(position, 14, new THREE.Color(0.7, 0.05, 0.05), 4, 0.7, 3);
    },
    cash(position) {
      burst(position, 20, new THREE.Color(0.3, 0.9, 0.3), 5, 0.9, 6);
    },
    update(dt) {
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = particles[i];
        if (!p.alive) {
          positions[i * 3 + 1] = -100;
          continue;
        }
        p.life -= dt;
        if (p.life <= 0) {
          p.alive = false;
          positions[i * 3 + 1] = -100;
          continue;
        }
        p.vy -= 9 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.y < 0.1) { p.y = 0.1; p.vy = 0; }
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;
        const fade = p.life / p.maxLife;
        colors[i * 3] *= 0.92 + 0.08 * fade;
      }
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
    },
  };
}
