// Texturas generadas por código (canvas) para no depender de assets externos:
// ladrillo naranja para el subterráneo, cartel roto y siluetas de gente.
import * as THREE from 'three';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { c, ctx: c.getContext('2d')! };
}

const BW = 64, BH = 28, GAP = 5;  // rejilla de ladrillo (compartida color+normal)

function brickGrid(cb: (x: number, y: number, row: number) => void) {
  let row = 0;
  for (let y = -BH; y < 256; y += BH + GAP, row++) {
    const off = row % 2 ? (BW + GAP) / 2 : 0;
    for (let x = -BW; x < 512 + BW; x += BW + GAP) cb(x + off, y, row);
  }
}

/** Pared de ladrillo naranja, con junta y variación de tono. */
export function brickTexture(repeatX = 4, repeatY = 2): THREE.Texture {
  const { c, ctx } = canvas(512, 256);
  ctx.fillStyle = '#140d09';            // mortero oscuro
  ctx.fillRect(0, 0, 512, 256);
  brickGrid((x, y) => {
    const s = 70 + Math.floor(Math.random() * 50);
    const g = ctx.createLinearGradient(x, y, x, y + BH);
    g.addColorStop(0, `rgb(${s + 75},${Math.floor(s * 0.78)},${Math.floor(s * 0.5)})`);
    g.addColorStop(1, `rgb(${s + 30},${Math.floor(s * 0.6)},${Math.floor(s * 0.38)})`);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, BW, BH);
    ctx.fillStyle = `rgba(0,0,0,${0.12 + Math.random() * 0.2})`;  // sombra inferior
    ctx.fillRect(x, y + BH - 5, BW, 5);
    ctx.fillStyle = `rgba(255,235,210,0.06)`;                      // brillo superior
    ctx.fillRect(x, y, BW, 3);
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 8;
  return t;
}

/** Normal map del MISMO ladrillo: da relieve real con la luz (mata el look 2D). */
export function brickNormal(repeatX = 4, repeatY = 2): THREE.Texture {
  // 1) mapa de alturas: ladrillo alto, junta hundida
  const { c, ctx } = canvas(512, 256);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 512, 256);      // junta = bajo
  brickGrid((x, y) => {
    ctx.fillStyle = '#cdcdcd';
    ctx.fillRect(x + 2, y + 2, BW - 4, BH - 4);              // ladrillo = alto
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + 5, y + 5, BW - 10, BH - 10);            // centro plano
  });
  // 2) Sobel → normal
  const src = ctx.getImageData(0, 0, 512, 256).data;
  const out = ctx.createImageData(512, 256);
  const h = (px: number, py: number) => src[((py & 255) * 512 + (px & 511)) * 4] / 255;
  const strength = 2.2;
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 512; x++) {
      const dx = (h(x - 1, y) - h(x + 1, y)) * strength;
      const dy = (h(x, y - 1) - h(x, y + 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * 512 + x) * 4;
      out.data[i] = ((dx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = (1 / len) * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 8;
  return t;
}

/** Placa metálica gastada con el nombre (se ilumina con un foco externo). */
export function signTexture(text = 'CHUPITBEATS', accent = '#cfd8e0'): THREE.Texture {
  const { c, ctx } = canvas(1024, 256);
  // placa metálica oscura con vetas
  ctx.fillStyle = '#14181d';
  ctx.fillRect(0, 0, 1024, 256);
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = `rgba(${40 + Math.random() * 30},${44 + Math.random() * 30},${50 + Math.random() * 30},0.25)`;
    ctx.fillRect(Math.random() * 1024, Math.random() * 256, 60 + Math.random() * 120, 1.5);
  }
  // marco
  ctx.strokeStyle = 'rgba(180,190,200,0.25)'; ctx.lineWidth = 8;
  ctx.strokeRect(16, 16, 1024 - 32, 256 - 32);
  // texto limpio, claro
  ctx.font = '900 130px Arial Black, Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = accent;
  ctx.fillText(text, 512, 134);
  // ligero desgaste (manchas tenues, NADA de bloques negros)
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(10,12,15,${0.04 + Math.random() * 0.06})`;
    ctx.beginPath();
    ctx.arc(Math.random() * 1024, Math.random() * 256, 4 + Math.random() * 14, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

/** Silueta de persona (varias poses), negra sobre transparente, para el público. */
export function silhouetteTexture(pose: number): THREE.Texture {
  const { c, ctx } = canvas(128, 256);
  ctx.clearRect(0, 0, 128, 256);
  ctx.fillStyle = '#000';
  const cx = 64;
  const armsUp = pose % 2 === 0;
  // cabeza
  ctx.beginPath(); ctx.arc(cx, 50, 18, 0, Math.PI * 2); ctx.fill();
  // torso
  ctx.fillRect(cx - 16, 66, 32, 80);
  // piernas (ligera variación de salto)
  const jump = (pose % 3) * 6;
  ctx.save();
  ctx.translate(cx, 146);
  ctx.fillRect(-15, 0, 12, 80 - jump);
  ctx.fillRect(3, 0, 12, 80 - jump);
  ctx.restore();
  // brazos
  ctx.lineWidth = 14; ctx.strokeStyle = '#000'; ctx.lineCap = 'round';
  ctx.beginPath();
  if (armsUp) {
    ctx.moveTo(cx - 14, 78); ctx.lineTo(cx - 34, 30);
    ctx.moveTo(cx + 14, 78); ctx.lineTo(cx + 34, 30);
  } else {
    ctx.moveTo(cx - 14, 78); ctx.lineTo(cx - 40, 110);
    ctx.moveTo(cx + 14, 78); ctx.lineTo(cx + 40, 70);
  }
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 2;
  return t;
}
