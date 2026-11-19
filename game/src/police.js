// police.js — the wanted level and the Solmar Bay PD.
// Crimes add heat; heat sets the star level; police cars spawn and chase
// the player, ramming to stop them. Lay low and the heat cools off.
import * as THREE from 'three';
import { makeCarMesh } from './vehicles.js';

const MAX_WANTED = 5;

export function createPolice(game) {
  const { scene } = game;
  const units = [];
  let heat = 0; // 0..100, stars = ceil(heat / 20)
  let wanted = 0;
  let calmTimer = 0;
  let spawnTimer = 0;

  function wantedLevel() {
    return Math.min(MAX_WANTED, Math.ceil(heat / 20));
  }

  function spawnUnit() {
    const { group } = makeCarMesh(0x1a1a1a, false);
    // white doors + light bar mark a patrol car
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.22, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.4 }),
    );
    bar.position.set(0, 1.72, -0.2);
    group.add(bar);
    const beacon = new THREE.PointLight(0xff2222, 0, 22, 1.6);
    beacon.position.set(0, 2.2, 0);
    group.add(beacon);
    // spawn on a street edge near the player
    const angle = Math.random() * Math.PI * 2;
    const px = game.player.pos.x + Math.cos(angle) * 90;
    const pz = game.player.pos.z + Math.sin(angle) * 90;
    const x = Math.max(-230, Math.min(230, px));
    const z = Math.max(-230, Math.min(230, pz));
    group.position.set(x, 0, z);
    scene.add(group);
    units.push({
      mesh: group,
      beacon,
      x,
      z,
      heading: Math.atan2(game.player.pos.x - x, game.player.pos.z - z),
      speed: 0,
      flashPhase: Math.random() * 10,
      caughtTimer: 0,
    });
  }

  function removeUnit(unit) {
    scene.remove(unit.mesh);
    const index = units.indexOf(unit);
    if (index !== -1) units.splice(index, 1);
  }

  return {
    units,
    get wanted() { return wanted; },
    get heat() { return heat; },
    addHeat(amount) {
      heat = Math.min(100, heat + amount);
      const level = wantedLevel();
      if (level > wanted) {
        wanted = level;
        game.player.bestWanted = Math.max(game.player.bestWanted, wanted);
        game.hud.showToast(wanted >= 3 ? `WANTED LEVEL ${wanted} — the whole PD is after you!` : `Wanted level ${wanted}`);
        game.audio.setSiren(true);
      }
      calmTimer = 0;
    },
    setWanted(level) {
      heat = Math.max(0, Math.min(100, level * 20));
      wanted = wantedLevel();
      game.audio.setSiren(wanted > 0);
    },
    update(dt) {
      const player = game.player;
      // desired number of units tracks the wanted level
      spawnTimer -= dt;
      if (units.length < wanted && spawnTimer <= 0) {
        spawnUnit();
        spawnTimer = 1.2;
      }
      while (units.length > wanted) removeUnit(units[units.length - 1]);
      if (wanted === 0) {
        game.audio.setSiren(false);
        return;
      }
      const target = player.onFoot ? player.pos : player.vehicle;
      for (const unit of [...units]) {
        const tx = player.onFoot ? player.pos.x : player.vehicle.x;
        const tz = player.onFoot ? player.pos.z : player.vehicle.z;
        const dx = tx - unit.x;
        const dz = tz - unit.z;
        const dist = Math.hypot(dx, dz);
        const desired = Math.atan2(dx, dz);
        let diff = desired - unit.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        unit.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
        const topSpeed = 26 + wanted * 1.5;
        unit.speed = Math.min(topSpeed, unit.speed + 14 * dt);
        unit.x += Math.sin(unit.heading) * unit.speed * dt;
        unit.z += Math.cos(unit.heading) * unit.speed * dt;
        unit.x = Math.max(-236, Math.min(236, unit.x));
        unit.z = Math.max(-236, Math.min(258, unit.z));
        unit.mesh.position.set(unit.x, 0, unit.z);
        unit.mesh.rotation.y = unit.heading;
        // flashing light bar: red then blue
        unit.flashPhase += dt * 6;
        const red = Math.sin(unit.flashPhase) > 0;
        unit.beacon.color.setHex(red ? 0xff2222 : 0x2244ff);
        unit.beacon.intensity = 26;
        // ramming the player
        if (dist < 3.2) {
          if (player.onFoot) {
            player.health -= 22 * dt;
            game.effects.sparks(new THREE.Vector3(player.pos.x, 1, player.pos.z));
            if (Math.random() < 0.3) game.audio.crash();
            unit.caughtTimer += dt;
            if (unit.caughtTimer > 2.5) {
              game.state = 'busted';
              game.hud.showBanner('BUSTED', 'The Solmar Bay PD caught you. Press R to try again.');
              return;
            }
          } else {
            const car = player.vehicle;
            car.damage += 18 * dt;
            car.speed *= 1 - 0.5 * dt;
            game.effects.sparks(new THREE.Vector3(unit.x, 1, unit.z));
            if (Math.random() < 0.2) game.audio.crash();
          }
        } else {
          unit.caughtTimer = 0;
        }
      }
      // cool off when no unit is close and no crime is happening
      const nearest = units.reduce((min, u) => Math.min(min, Math.hypot(u.x - player.pos.x, u.z - player.pos.z)), Infinity);
      if (nearest > 60) {
        calmTimer += dt;
        if (calmTimer > 8) {
          heat = Math.max(0, heat - 6 * dt);
          const level = wantedLevel();
          if (level < wanted) {
            wanted = level;
            if (wanted === 0) game.audio.setSiren(false);
          }
        }
      } else {
        calmTimer = 0;
      }
    },
  };
}
