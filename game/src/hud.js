// hud.js — the 2D interface: money, health, wanted stars, ammo, speed,
// mission objective, dialogue, banners, toasts, and the minimap canvas.
// All DOM lives in index.html; this module only fills it in.
import { STREET_AT, CITY_HALF } from './city.js';

export function createHud(game) {
  const $ = (id) => document.getElementById(id);
  const elements = {
    money: $('money'),
    healthFill: $('health-fill'),
    healthText: $('health-text'),
    stars: $('stars'),
    ammo: $('ammo'),
    objective: $('objective'),
    objectiveDist: $('objective-dist'),
    speed: $('speed'),
    speedLabel: $('speed-label'),
    minimap: $('minimap'),
    dialogue: $('dialogue'),
    dialogueText: $('dialogue-text'),
    banner: $('banner'),
    bannerTitle: $('banner-title'),
    bannerSub: $('banner-sub'),
    toast: $('toast'),
    crosshair: $('crosshair'),
    menu: $('menu'),
    startBtn: $('start-btn'),
    continueBtn: $('continue-btn'),
    menuSave: $('menu-save'),
    pauseScreen: $('pause-screen'),
    endScreen: $('end-screen'),
    endTitle: $('end-title'),
    endSub: $('end-sub'),
  };
  const minimapCtx = elements.minimap.getContext('2d');
  let bannerTimer = 0;
  let toastTimer = 0;
  let dialogueTimer = 0;
  let frameCount = 0;

  function drawMinimap() {
    const ctx = minimapCtx;
    const size = 180;
    const scale = size / (CITY_HALF * 2 + 60);
    const toMap = (x, z) => [(x + CITY_HALF + 30) * scale, (z + CITY_HALF + 30) * scale];
    ctx.clearRect(0, 0, size, size);
    // land
    ctx.fillStyle = '#5d7a48';
    ctx.fillRect(0, 0, size, size);
    // sea along the bottom (south)
    const [, sy] = toMap(0, CITY_HALF);
    ctx.fillStyle = '#1f7fae';
    ctx.fillRect(0, sy, size, size - sy);
    // roads
    ctx.strokeStyle = '#3a3f45';
    ctx.lineWidth = 4;
    for (const at of STREET_AT) {
      const [x1, y1] = toMap(at, -CITY_HALF);
      const [x2, y2] = toMap(at, CITY_HALF);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      const [x3, y3] = toMap(-CITY_HALF, at);
      const [x4, y4] = toMap(CITY_HALF, at);
      ctx.beginPath(); ctx.moveTo(x3, y3); ctx.lineTo(x4, y4); ctx.stroke();
    }
    // mission beacon
    const target = game.missions.objectivePosition();
    if (target) {
      const [mx, my] = toMap(target.x, target.z);
      const pulse = 5 + Math.sin(game.time * 4) * 2;
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath(); ctx.arc(mx, my, pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7a5c00';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(mx, my, pulse + 3, 0, Math.PI * 2); ctx.stroke();
    }
    // traffic cars
    ctx.fillStyle = '#ffffff';
    for (const car of game.traffic.cars) {
      const [mx, my] = toMap(car.x, car.z);
      ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
    }
    // police units flash red/blue
    for (const unit of game.police.units) {
      const [mx, my] = toMap(unit.x, unit.z);
      ctx.fillStyle = Math.sin(game.time * 8) > 0 ? '#ff2222' : '#2244ff';
      ctx.beginPath(); ctx.arc(mx, my, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    // player arrow
    const player = game.player;
    const [px, py] = toMap(player.pos.x, player.pos.z);
    const heading = player.onFoot ? player.heading : (player.vehicle ? player.vehicle.heading : player.heading);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI - heading);
    ctx.fillStyle = '#ffd23e';
    ctx.strokeStyle = '#7a5c00';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  return {
    setSpeed(kmh) {
      elements.speed.textContent = Math.round(kmh);
      elements.speedLabel.textContent = 'km/h';
    },
    showToast(text) {
      elements.toast.textContent = text;
      elements.toast.classList.add('visible');
      toastTimer = 3;
    },
    showDialogue(text) {
      elements.dialogueText.textContent = text;
      elements.dialogue.classList.add('visible');
      dialogueTimer = 4.2;
    },
    showBanner(title, sub) {
      elements.bannerTitle.textContent = title;
      elements.bannerSub.textContent = sub || '';
      elements.banner.classList.add('visible');
      bannerTimer = 3.2;
    },
    showMenu(save) {
      elements.menu.classList.remove('hidden');
      if (save && save.missionsCompleted.length > 0) {
        elements.continueBtn.classList.remove('hidden');
        elements.menuSave.textContent = `Save found — $${save.money.toLocaleString()}, ${save.missionsCompleted.length}/3 jobs done.`;
      } else {
        elements.continueBtn.classList.add('hidden');
        elements.menuSave.textContent = 'No save yet — a fresh start in Solmar Bay.';
      }
    },
    hideMenu() {
      elements.menu.classList.add('hidden');
    },
    showPause() {
      elements.pauseScreen.classList.remove('hidden');
    },
    hidePause() {
      elements.pauseScreen.classList.add('hidden');
    },
    showEnd(title, sub) {
      elements.endTitle.textContent = title;
      elements.endSub.textContent = sub;
      elements.endScreen.classList.remove('hidden');
    },
    hideEnd() {
      elements.endScreen.classList.add('hidden');
    },
    update(dt) {
      const player = game.player;
      elements.money.textContent = `$${Math.round(player.money).toLocaleString()}`;
      elements.healthFill.style.width = `${Math.max(0, player.health)}%`;
      elements.healthText.textContent = `${Math.max(0, Math.round(player.health))}`;
      const wanted = game.police.wanted;
      elements.stars.textContent = '★'.repeat(wanted) + '☆'.repeat(5 - wanted);
      elements.stars.classList.toggle('hot', wanted > 0);
      elements.ammo.textContent = game.combat.state.reloading > 0
        ? 'RELOADING…'
        : `${game.combat.state.ammo} / ${12}`;
      elements.objective.textContent = game.missions.currentObjective;
      const target = game.missions.objectivePosition();
      if (target) {
        const px = player.onFoot ? player.pos.x : player.vehicle.x;
        const pz = player.onFoot ? player.pos.z : player.vehicle.z;
        const dist = Math.hypot(target.x - px, target.z - pz);
        elements.objectiveDist.textContent = `${Math.round(dist)}m`;
      } else {
        elements.objectiveDist.textContent = '';
      }
      const driving = !player.onFoot;
      elements.speed.style.display = driving ? 'block' : 'none';
      elements.speedLabel.style.display = driving ? 'block' : 'none';
      elements.crosshair.style.display = player.onFoot && game.state === 'playing' ? 'block' : 'none';
      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) elements.banner.classList.remove('visible');
      }
      if (toastTimer > 0) {
        toastTimer -= dt;
        if (toastTimer <= 0) elements.toast.classList.remove('visible');
      }
      if (dialogueTimer > 0) {
        dialogueTimer -= dt;
        if (dialogueTimer <= 0) elements.dialogue.classList.remove('visible');
      }
      frameCount += 1;
      if (frameCount % 4 === 0) drawMinimap();
    },
  };
}
