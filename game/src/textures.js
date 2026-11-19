// textures.js — procedural canvas textures for Solmar Bay.
// Everything is drawn at runtime on offscreen canvases, so the game ships
// no image files at all. All textures are original, made for this game.
import * as THREE from 'three';

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function seededRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// A building facade: warm plaster base, a grid of lit and dark windows,
// a darker ground floor with a shopfront band.
export function makeBuildingTexture(seed, baseColor, floors) {
  const rand = seededRandom(seed);
  const litColors = ['#ffd98a', '#ffe9b0', '#fff3cf', '#9fd8ff'];
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, w, h);
    // subtle vertical shading strips
    for (let x = 0; x < w; x += 32) {
      ctx.fillStyle = `rgba(0,0,0,${0.03 + rand() * 0.05})`;
      ctx.fillRect(x, 0, 32, h);
    }
    const cols = 6;
    const rows = Math.max(3, floors);
    const cellW = w / cols;
    const cellH = (h - 40) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cellW + cellW * 0.2;
        const y = 12 + r * cellH + cellH * 0.2;
        const ww = cellW * 0.6;
        const hh = cellH * 0.55;
        const lit = rand() < 0.45;
        ctx.fillStyle = lit ? litColors[Math.floor(rand() * litColors.length)] : '#2a3242';
        ctx.fillRect(x, y, ww, hh);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.strokeRect(x, y, ww, hh);
        if (lit && rand() < 0.5) {
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(x, y + hh * 0.45, ww, hh * 0.1);
        }
      }
    }
    // ground floor shopfront
    ctx.fillStyle = '#1d2431';
    ctx.fillRect(0, h - 34, w, 34);
    ctx.fillStyle = '#f7c948';
    ctx.fillRect(0, h - 38, w, 4);
  });
}

// Asphalt with a dashed centre line and worn edges.
export function makeRoadTexture() {
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#33373d';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    ctx.fillStyle = '#e8c93a';
    for (let y = 0; y < h; y += 64) ctx.fillRect(w / 2 - 3, y + 8, 6, 34);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(6, 0, 3, h);
    ctx.fillRect(w - 9, 0, 3, h);
  });
}

// Pale concrete sidewalk slabs.
export function makeSidewalkTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#b9b3a4';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo((i * w) / 4, 0); ctx.lineTo((i * w) / 4, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, (i * h) / 4); ctx.lineTo(w, (i * h) / 4); ctx.stroke();
    }
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

// Sand for the beach strip.
export function makeSandTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#e8d5a4';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = `rgba(120,90,40,${Math.random() * 0.15})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 1);
    }
  });
}

// A shop or street sign with text.
export function makeSignTexture(text, background, foreground) {
  return canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = foreground;
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.fillStyle = foreground;
    ctx.font = 'bold 56px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
}

// A simple gradient sky dome texture (sunset: warm horizon, blue top).
export function makeSkyTexture() {
  return canvasTexture(16, 256, (ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, '#2f6fb2');
    gradient.addColorStop(0.45, '#7fb2dd');
    gradient.addColorStop(0.72, '#ffc27a');
    gradient.addColorStop(1, '#ff9a52');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  });
}
