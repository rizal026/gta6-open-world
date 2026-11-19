// missions.js — the story of Solmar Bay: three jobs for Mama Rosa.
// Each mission is a chain of steps with a target, dialogue and a reward.
// The current objective shows as a 3D beacon, a minimap blip and HUD text.
import * as THREE from 'three';
import { makeCarMesh } from './vehicles.js';

const MISSION_DEFS = [
  {
    id: 'pickup',
    title: 'Job 1 — The Pickup',
    reward: 500,
    briefing: [
      'MAMA ROSA: Jax, baby, you are out. Good. I have work.',
      'MAMA ROSA: A package is waiting at the marina. Pick it up, bring it to the Sunset Motel. No questions.',
      'MAMA ROSA: Walk or drive, I do not care. Just do not get the cops involved.',
    ],
    steps: [
      { text: 'Pick up the package at the marina', target: 'marina', radius: 4, kind: 'arrive' },
      { text: 'Deliver the package to the Sunset Motel', target: 'motel', radius: 5, kind: 'arrive' },
    ],
  },
  {
    id: 'hotwheels',
    title: 'Job 2 — Hot Wheels',
    reward: 1200,
    briefing: [
      'MAMA ROSA: The Vultures think they own Dockside. Prove them wrong.',
      'MAMA ROSA: Their Comet GT is parked at the docks. Take it. Bring it to the chop shop on Dockside.',
      'MAMA ROSA: It will be loud. It will be fast. Do not get caught.',
    ],
    steps: [
      { text: 'Steal the Vulture Comet GT at the docks', target: 'vultureCar', radius: 4, kind: 'steal' },
      { text: 'Deliver the Comet GT to the chop shop', target: 'chopShop', radius: 6, kind: 'deliverCar' },
    ],
  },
  {
    id: 'vault',
    title: 'Job 3 — The Vault Job',
    reward: 5000,
    briefing: [
      'MAMA ROSA: The big one, Jax. Solmar Savings keeps its cash in the back.',
      'MAMA ROSA: Three guards. Deal with them, grab the cash, and run. The safehouse is on Palm Row.',
      'MAMA ROSA: After this, we are rich — or we are done. Go.',
    ],
    steps: [
      { text: 'Deal with the three bank guards', target: 'bank', radius: 14, kind: 'guards', count: 3 },
      { text: 'Grab the cash inside the bank', target: 'bank', radius: 5, kind: 'arrive' },
      { text: 'Escape to the safehouse on Palm Row', target: 'hideout', radius: 6, kind: 'arrive' },
    ],
  },
];

export function createMissions(game) {
  const { scene, city } = game;
  const targets = {
    marina: city.marina,
    motel: city.landmarks['Sunset Motel'],
    bank: city.landmarks['Solmar Savings'],
    chopShop: city.chopShop,
    hideout: city.hideout,
  };

  // 3D objective beacon: a glowing pillar and a pulsing ring on the ground.
  const beacon = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 40, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 20;
  beacon.add(pillar);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.1, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  beacon.add(ring);
  beacon.visible = false;
  scene.add(beacon);

  let vultureCar = null;
  let guards = [];

  function spawnVultureCar() {
    if (vultureCar) return vultureCar;
    const { group, wheels } = makeCarMesh(0x111111, false);
    group.position.set(-196, 0, 108);
    group.rotation.y = Math.PI / 2;
    scene.add(group);
    vultureCar = {
      mesh: group,
      wheels,
      x: -196,
      z: 108,
      heading: Math.PI / 2,
      speed: 0,
      name: 'Vulture Comet',
      parked: true,
      damage: 0,
      smokeTimer: 0,
      stolen: false,
      trafficRef: null,
    };
    game.vehicles.cars.push(vultureCar);
    return vultureCar;
  }

  function spawnGuards() {
    if (guards.length > 0) return;
    const guardMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const bandMaterial = new THREE.MeshStandardMaterial({ color: 0xd92323, roughness: 0.6 });
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 0.95, 3, 10), guardMaterial);
      body.position.y = 1.15;
      body.castShadow = true;
      mesh.add(body);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.2, 10), bandMaterial);
      band.position.y = 1.5;
      mesh.add(band);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xe8b98a, roughness: 0.8 }),
      );
      head.position.y = 2.05;
      mesh.add(head);
      const gx = -52 + i * 9;
      const gz = -146;
      mesh.position.set(gx, 0, gz);
      scene.add(mesh);
      const ped = { mesh, x: gx, z: gz, heading: 0, speed: 0, horizontal: false, at: 0, side: 0, walkPhase: 0, alive: true, guard: true };
      game.traffic.peds.push(ped);
      guards.push(ped);
    }
  }

  const missions = {
    defs: MISSION_DEFS,
    completed: [],
    activeIndex: -1,
    stepIndex: 0,
    stepProgress: 0,
    beaconTarget: null,
    currentObjective: '',
    dialogueQueue: [],
    dialogueTimer: 0,
    say(lines) {
      missions.dialogueQueue.push(...lines);
    },
    startMission(index) {
      const def = MISSION_DEFS[index];
      missions.activeIndex = index;
      missions.stepIndex = 0;
      missions.stepProgress = 0;
      if (def.id === 'hotwheels') spawnVultureCar();
      if (def.id === 'vault') {
        spawnGuards();
        game.police.setWanted(0);
      }
      missions.say(def.briefing);
      missions.refreshObjective();
      game.hud.showBanner(def.title, `Reward: $${def.reward.toLocaleString()}`);
      game.audio.pickup();
    },
    refreshObjective() {
      const def = MISSION_DEFS[missions.activeIndex];
      if (!def) {
        missions.currentObjective = 'Free roam — press M for the next job';
        missions.beaconTarget = null;
        beacon.visible = false;
        return;
      }
      const step = def.steps[missions.stepIndex];
      missions.currentObjective = step.text;
      const target = step.target === 'vultureCar' && vultureCar
        ? new THREE.Vector3(vultureCar.x, 0, vultureCar.z)
        : targets[step.target];
      missions.beaconTarget = target;
      beacon.position.set(target.x, 0, target.z);
      beacon.visible = true;
    },
    objectivePosition() {
      return missions.beaconTarget;
    },
    completeStep() {
      const def = MISSION_DEFS[missions.activeIndex];
      missions.stepIndex += 1;
      missions.stepProgress = 0;
      game.audio.pickup();
      if (missions.stepIndex >= def.steps.length) {
        missions.completeMission();
      } else {
        missions.refreshObjective();
      }
    },
    completeMission() {
      const def = MISSION_DEFS[missions.activeIndex];
      const player = game.player;
      player.money += def.reward;
      player.totalEarned += def.reward;
      missions.completed.push(def.id);
      game.hud.showBanner('JOB DONE', `${def.title} — +$${def.reward.toLocaleString()}`);
      game.effects.cash(new THREE.Vector3(player.pos.x, 2, player.pos.z));
      game.save();
      missions.activeIndex = -1;
      missions.stepIndex = 0;
      beacon.visible = false;
      if (missions.completed.length >= MISSION_DEFS.length) {
        game.state = 'complete';
        game.hud.showBanner('SOLMAR IS YOURS', 'All three jobs done. Free roam — the city is yours, Jax.');
        missions.currentObjective = 'Story complete — free roam';
      } else {
        missions.currentObjective = 'Job done — press M for the next job';
      }
    },
    nextJob() {
      if (missions.activeIndex !== -1) return;
      const next = MISSION_DEFS.findIndex((d) => !missions.completed.includes(d.id));
      if (next !== -1) missions.startMission(next);
    },
    update(dt) {
      // dialogue typewriter queue
      if (missions.dialogueQueue.length > 0) {
        missions.dialogueTimer -= dt;
        if (missions.dialogueTimer <= 0) {
          game.hud.showDialogue(missions.dialogueQueue.shift());
          missions.dialogueTimer = 4.2;
        }
      }
      // beacon pulse
      if (beacon.visible) {
        const s = 1 + Math.sin(game.time * 3) * 0.12;
        ring.scale.set(s, s, 1);
        pillar.material.opacity = 0.16 + Math.sin(game.time * 3) * 0.06;
      }
      if (missions.activeIndex === -1) return;
      const def = MISSION_DEFS[missions.activeIndex];
      const step = def.steps[missions.stepIndex];
      const player = game.player;
      const px = player.onFoot ? player.pos.x : player.vehicle.x;
      const pz = player.onFoot ? player.pos.z : player.vehicle.z;
      const target = step.target === 'vultureCar' && vultureCar
        ? new THREE.Vector3(vultureCar.x, 0, vultureCar.z)
        : targets[step.target];
      const dist = Math.hypot(target.x - px, target.z - pz);
      if (step.kind === 'arrive' && dist < step.radius) {
        missions.completeStep();
      } else if (step.kind === 'steal') {
        if (player.vehicle === vultureCar) {
          game.police.addHeat(2);
          game.hud.showToast('The Vultures will want their car back. Go!');
          missions.completeStep();
        }
      } else if (step.kind === 'deliverCar') {
        if (player.vehicle === vultureCar && dist < step.radius) {
          missions.completeStep();
        }
      } else if (step.kind === 'guards') {
        const down = guards.filter((g) => !g.alive).length;
        missions.stepProgress = down;
        missions.currentObjective = `${step.text} (${down}/${step.count})`;
        if (down >= step.count) {
          game.police.addHeat(3);
          missions.completeStep();
        }
      }
    },
  };
  return missions;
}
