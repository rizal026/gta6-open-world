// combat.js — the pistol: aim with the mouse, click to fire, R to reload.
// Raycast from the camera centre; pedestrians and police cars take hits.
// Ammo is limited and reloads take a moment.
import * as THREE from 'three';

const MAG_SIZE = 12;
const RELOAD_TIME = 1.4;

export function createCombat(game) {
  const raycaster = new THREE.Raycaster();
  const state = {
    ammo: MAG_SIZE,
    reloading: 0,
    cooldown: 0,
    kills: 0,
  };
  let flashLight = null;

  function muzzleWorldPosition() {
    const { player, camera } = game;
    const origin = player.onFoot
      ? new THREE.Vector3(player.pos.x, player.pos.y + 1.6, player.pos.z)
      : new THREE.Vector3(player.pos.x, player.pos.y + 1.6, player.pos.z);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    return origin.add(dir.multiplyScalar(1.2));
  }

  return {
    state,
    update(dt) {
      if (state.cooldown > 0) state.cooldown -= dt;
      if (state.reloading > 0) {
        state.reloading -= dt;
        if (state.reloading <= 0) {
          state.ammo = MAG_SIZE;
          game.hud.showToast('Reloaded.');
        }
      }
    },
    reload() {
      if (state.reloading <= 0 && state.ammo < MAG_SIZE) {
        state.reloading = RELOAD_TIME;
        game.audio.click();
      }
    },
    fire() {
      const { camera, traffic, police, player } = game;
      if (state.cooldown > 0 || state.reloading > 0) return;
      if (state.ammo <= 0) {
        this.reload();
        return;
      }
      state.ammo -= 1;
      state.cooldown = 0.22;
      game.audio.gunshot();
      const muzzle = muzzleWorldPosition();
      game.effects.muzzle(muzzle);
      if (!flashLight) {
        flashLight = new THREE.PointLight(0xffc860, 0, 14, 1.8);
        game.scene.add(flashLight);
      }
      flashLight.position.copy(muzzle);
      flashLight.intensity = 40;
      setTimeout(() => { if (flashLight) flashLight.intensity = 0; }, 60);

      // shoot from the centre of the screen
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const targets = [];
      for (const ped of traffic.peds) {
        if (ped.alive) targets.push({ object: ped.mesh, kind: 'ped', ref: ped });
      }
      for (const unit of police.units) targets.push({ object: unit.mesh, kind: 'police', ref: unit });
      const hits = raycaster.intersectObjects(targets.map((t) => t.object), true);
      if (hits.length > 0) {
        let hit = hits[0].object;
        while (hit.parent && hit.parent !== game.scene) hit = hit.parent;
        const target = targets.find((t) => t.object === hit);
        if (target) {
          const point = hits[0].point;
          if (target.kind === 'ped') {
            traffic.knockDownPed(target.ref);
            game.effects.blood(point);
            state.kills += 1;
            police.addHeat(2);
            game.hud.showToast('Pedestrian down. The cops saw that.');
          } else {
            game.effects.sparks(point);
            police.addHeat(1);
            game.hud.showToast('You shot a patrol car!');
          }
          return;
        }
      }
      // missed: the shot still counts as a crime if the cops are near
      if (police.wanted > 0) police.addHeat(0.5);
    },
  };
}
