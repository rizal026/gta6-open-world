// main.js — Solmar Bay: bootstrap, game loop, input, state machine.
// The city, traffic, player, cars, police, combat, missions, HUD, audio
// and effects each live in their own module; this file wires them together.
import * as THREE from 'three';
import { buildCity } from './city.js';
import { createTraffic } from './traffic.js';
import { createPlayer } from './player.js';
import { createVehicles } from './vehicles.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createEffects } from './effects.js';
import { loadSave, writeSave } from './save.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 8, -14);

const game = {
  scene,
  camera,
  renderer,
  time: 0,
  state: 'menu',
  keys: {},
  saveData: loadSave(),
  save() { writeSave(game); },
};
game.city = buildCity(game);
game.effects = createEffects(game);
game.audio = createAudio();
game.traffic = createTraffic(game);
game.player = createPlayer(game);
game.vehicles = createVehicles(game);
game.police = createPolice(game);
game.combat = createCombat(game);
game.missions = createMissions(game);
game.hud = createHud(game);

// restore a previous save
if (game.saveData) {
  game.player.money = game.saveData.money;
  game.player.totalEarned = game.saveData.totalEarned;
  game.player.bestWanted = game.saveData.bestWanted;
  game.missions.completed = game.saveData.missionsCompleted.slice();
  if (game.missions.completed.length >= 3) {
    game.missions.currentObjective = 'Story complete — free roam';
  }
}

function isPlaying() {
  return game.state === 'playing' || game.state === 'complete';
}

function startGame() {
  game.audio.unlock();
  game.audio.click();
  game.hud.hideMenu();
  game.hud.hideEnd();
  game.state = 'playing';
  game.missions.currentObjective = game.missions.completed.length >= 3
    ? 'Story complete — free roam'
    : 'Press M to start the next job';
  if (game.missions.completed.length === 0) game.missions.say([
    'MAMA ROSA: Jax. You are out. Solmar Bay missed you.',
    'MAMA ROSA: Press M when you want work. I always have work.',
  ]);
}

function restartGame() {
  window.location.reload();
}

// --- input ---
window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') event.preventDefault();
  game.keys[event.code] = true;
  if (event.code === 'KeyM' && isPlaying()) game.missions.nextJob();
  if (event.code === 'KeyR' && isPlaying()) game.combat.reload();
  if (event.code === 'KeyR' && (game.state === 'busted' || game.state === 'wasted')) restartGame();
  if (event.code === 'KeyE' && isPlaying()) {
    if (game.player.onFoot) {
      const target = game.vehicles.nearestCar();
      if (target) game.vehicles.enterCar(target);
    } else {
      game.vehicles.exitCar();
    }
  }
  if ((event.code === 'KeyP' || event.code === 'Escape') && isPlaying()) {
    game.state = 'paused';
    game.hud.showPause();
  } else if ((event.code === 'KeyP' || event.code === 'Escape') && game.state === 'paused') {
    game.state = 'playing';
    game.hud.hidePause();
  }
});
window.addEventListener('keyup', (event) => {
  game.keys[event.code] = false;
});

let dragging = false;
let lastX = 0;
let lastY = 0;
canvas.addEventListener('pointerdown', (event) => {
  dragging = true;
  lastX = event.clientX;
  lastY = event.clientY;
});
window.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  const dx = event.clientX - lastX;
  const dy = event.clientY - lastY;
  lastX = event.clientX;
  lastY = event.clientY;
  game.player.cameraYaw -= dx * 0.005;
  game.player.cameraPitch = Math.max(0.05, Math.min(1.1, game.player.cameraPitch + dy * 0.004));
});
window.addEventListener('pointerup', () => { dragging = false; });
canvas.addEventListener('click', () => {
  if (isPlaying() && game.player.onFoot) game.combat.fire();
});

// --- menu buttons ---
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('continue-btn').addEventListener('click', startGame);
document.getElementById('resume-btn').addEventListener('click', () => {
  game.state = 'playing';
  game.hud.hidePause();
});
document.getElementById('restart-btn').addEventListener('click', restartGame);
document.getElementById('end-restart-btn').addEventListener('click', restartGame);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- screenshot scene setups (?shot=...) ---
// These only pick a starting state; the game itself then runs normally.
function applyShotSetup(shot) {
  const player = game.player;
  if (shot === 'foot') {
    player.pos.set(0, 0, 40);
    player.cameraYaw = Math.PI;
    game.missions.startMission(0);
  } else if (shot === 'drive') {
    const car = game.vehicles.cars[0];
    player.pos.set(car.x + 3, 0, car.z);
    game.vehicles.enterCar(car);
  } else if (shot === 'chase') {
    const car = game.vehicles.cars[0];
    player.pos.set(car.x + 3, 0, car.z);
    game.vehicles.enterCar(car);
    car.x = -40;
    car.z = 40;
    car.heading = Math.PI / 2;
    game.police.setWanted(3);
    game.missions.startMission(1);
  } else if (shot === 'mission') {
    player.pos.set(-40, 0, -130);
    player.cameraYaw = Math.PI;
    game.missions.startMission(2);
    game.police.setWanted(1);
  }
}

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  startGame();
  applyShotSetup(shot);
} else {
  game.hud.showMenu(game.saveData);
}

// --- main loop ---
const clock = new THREE.Clock();
let framesRendered = 0;
let endShown = false;

function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  game.time += dt;
  if (isPlaying()) {
    game.player.update(dt);
    game.vehicles.update(dt);
    game.traffic.update(dt);
    game.police.update(dt);
    game.combat.update(dt);
    game.missions.update(dt);
    game.effects.update(dt);
    if (game.sea) game.sea.position.y = -0.4 + Math.sin(game.time * 0.5) * 0.15;
    // health end state
    if (game.player.health <= 0 && game.state === 'playing') {
      game.state = 'wasted';
    }
    game.player.updateCamera(dt);
    game.hud.update(dt);
  } else if (game.state === 'menu') {
    // slow cinematic orbit around the city behind the menu
    const t = game.time * 0.05;
    camera.position.set(Math.sin(t) * 180, 90, Math.cos(t) * 180);
    camera.lookAt(0, 0, 0);
    game.traffic.update(dt);
    game.effects.update(dt);
  } else if (game.state === 'paused') {
    // frozen frame; nothing updates
  }
  // end screens appear once, when the run ends
  if ((game.state === 'busted' || game.state === 'wasted') && !endShown) {
    endShown = true;
    game.hud.showEnd(
      game.state === 'busted' ? 'BUSTED' : 'WASTED',
      game.state === 'busted'
        ? 'The Solmar Bay PD caught you. Press R or click below to try again.'
        : 'Jax went down in Solmar Bay. Press R or click below to try again.',
    );
  }
  renderer.render(scene, camera);
  framesRendered += 1;
  if (framesRendered === 3) window.__solmarReady = true;
}
loop();

window.__solmar = game;
