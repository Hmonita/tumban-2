'use strict';
/* ============================ CONFIG ============================ */
const CONFIG = {
  T: { AIR: 0, DIRT: 1, SAND: 2, GRASS: 3, STONE: 4, WATER: 5, LOG: 6, LEAVES: 7, GOLD: 8, CACTUS: 9, SPIKE: 10, DOOR: 11, DOOR_OPEN: 12, PLANK: 13, SAPLING: 14, BUSH: 15, FURNACE: 16, SAW: 17 },
  COLORS: { 1: '#8a5a33', 2: '#e6d198', 3: '#4caf50', 4: '#8d9196', 5: 'rgba(40,110,220,.55)', 6: '#7a4a22', 7: '#3fa34d', 8: '#f5c518', 13: '#c8935a', 16: '#6d6d73' },
  MOB_COLORS: ['#d9534f', '#9b59b6', '#e67e22'],
  OUTLINE: '#222', OUT_W: 1.5, SKY_TOP: [126, 200, 255], SKY_BOT: [207, 238, 255], NIGHT_TOP: [10, 14, 40], NIGHT_BOT: [30, 36, 80],
  CAM_SMOOTH: 6, INTERP: 18, SEND_HZ: 30, ZOOM_BASE: 1300, NIGHT_ALPHA: 0.62, SOUND: true,
  PART: { COUNT: 7, LIFE: 0.6, GRAV: 900 }, FLOAT_LIFE: 0.9, CHAT_LINES: 8,
  LABEL: { wood: 'Дерево', plank: 'Доски', stone: 'Камни', sand: 'Песок', dirt: 'Земля', gold: 'Золото', ore: 'Руда', food: 'Еда', sword: 'Меч', wsword: 'Дер. меч', pick: 'Кирка', furnace: 'Печь', door: 'Дверь', spike: 'Шипы' }
};
const T = CONFIG.T;
const $ = id => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d');
let dpr = 1, vw = 0, vh = 0, zoom = 1;
function resize() { dpr = window.devicePixelRatio || 1; vw = innerWidth; vh = innerHeight; cv.width = vw * dpr; cv.height = vh * dpr; zoom = Math.max(0.6, Math.min(1.25, vw / CONFIG.ZOOM_BASE)); }
addEventListener('resize', resize); resize();

/* ============================ ИКОНКИ И ЛИЦА (примитивы) ============================ */
function face(g, x, y, s, skin, ax = 0, ay = 0) {
  const ex = s * 0.26, ey = s * 0.36, er = s * 0.09; g.fillStyle = '#111';
  for (const sx of [-1, 1]) { g.beginPath(); g.arc(x + s / 2 + sx * ex + ax * er, y + ey + ay * er, er, 0, 7); g.fill(); }
  if (skin === 6) { g.fillStyle = '#fff'; g.fillRect(x + s / 2 + ex - er * 1.4, y + ey - er * 1.4, er * 2.8, er * 1.4); }
  g.strokeStyle = '#111'; g.lineWidth = Math.max(1.5, s * 0.05); g.lineCap = 'round'; g.beginPath();
  const cx = x + s / 2, my = y + s * 0.68;
  if (skin === 0) g.arc(cx, my - s * 0.08, s * 0.16, 0.15 * Math.PI, 0.85 * Math.PI);
  else if (skin === 1) { g.arc(cx, my - s * 0.1, s * 0.2, 0.05 * Math.PI, 0.95 * Math.PI); g.closePath(); g.fillStyle = '#fff'; g.fill(); }
  else if (skin === 2) { g.ellipse(cx, my, s * 0.08, s * 0.1, 0, 0, 7); g.fillStyle = '#511'; g.fill(); }
  else if (skin === 3) { g.moveTo(cx - s * 0.15, my); g.lineTo(cx + s * 0.15, my); }
  else if (skin === 4) g.arc(cx, my + s * 0.12, s * 0.15, 1.15 * Math.PI, 1.85 * Math.PI);
  else if (skin === 5) { g.arc(cx, my - s * 0.08, s * 0.16, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); g.fillStyle = '#f48'; g.fillRect(cx - s * 0.04, my + s * 0.02, s * 0.1, s * 0.12); g.beginPath(); }
  else if (skin === 6) g.arc(cx, my - s * 0.08, s * 0.16, 0.15 * Math.PI, 0.85 * Math.PI);
  else { g.moveTo(cx - s * 0.18, my - s * 0.04); g.quadraticCurveTo(cx - s * 0.09, my + s * 0.1, cx, my - s * 0.02); g.quadraticCurveTo(cx + s * 0.09, my + s * 0.1, cx + s * 0.18, my - s * 0.04); }
  g.stroke();
}
function box(g, x, y, w, h, fill) { g.fillStyle = fill; g.fillRect(x, y, w, h); g.strokeStyle = CONFIG.OUTLINE; g.lineWidth = 2; g.strokeRect(x, y, w, h); }
function icon(g, name, s) {
  g.clearRect(0, 0, s, s); g.save(); g.lineJoin = 'round'; g.lineCap = 'round'; const u = s / 40;
  const ln = (a, b, c, d, col, w) => { g.strokeStyle = col; g.lineWidth = w * u; g.beginPath(); g.moveTo(a * u, b * u); g.lineTo(c * u, d * u); g.stroke(); };
  const C = CONFIG.COLORS;
  switch (name) {
    case 'sword': ln(10, 30, 30, 10, '#222', 7); ln(10, 30, 30, 10, '#cfd8dc', 4); ln(9, 21, 19, 31, '#222', 6); ln(9, 21, 19, 31, '#8d6e63', 3); break;
    case 'wsword': ln(10, 30, 30, 10, '#222', 7); ln(10, 30, 30, 10, '#c8935a', 4); ln(9, 21, 19, 31, '#222', 6); ln(9, 21, 19, 31, '#8d6e63', 3); break;
    case 'stone': g.fillStyle = '#9aa0a6'; g.strokeStyle = '#222'; g.lineWidth = 2 * u; g.beginPath(); g.arc(20 * u, 21 * u, 10 * u, 0, 7); g.fill(); g.stroke(); break;
    case 'food': g.fillStyle = '#e53935'; g.strokeStyle = '#222'; g.lineWidth = 2 * u; g.beginPath(); g.arc(20 * u, 23 * u, 10 * u, 0, 7); g.fill(); g.stroke(); ln(20, 13, 23, 7, '#2e7d32', 3); break;
    case 'pick': ln(12, 30, 28, 12, '#222', 6); ln(12, 30, 28, 12, '#8d6e63', 3); g.strokeStyle = '#222'; g.lineWidth = 6 * u; g.beginPath(); g.arc(24 * u, 18 * u, 11 * u, 1.1 * Math.PI, 1.9 * Math.PI); g.stroke(); g.strokeStyle = '#cfd8dc'; g.lineWidth = 3 * u; g.stroke(); break;
    case 'door': box(g, 12 * u, 5 * u, 16 * u, 30 * u, '#a1673a'); g.fillStyle = '#ffd54f'; g.beginPath(); g.arc(24 * u, 21 * u, 2 * u, 0, 7); g.fill(); break;
    case 'spike': g.fillStyle = '#b0b4b8'; g.strokeStyle = '#222'; g.lineWidth = 2 * u; for (const x of [6, 17, 28]) { g.beginPath(); g.moveTo(x * u, 32 * u); g.lineTo((x + 5) * u, 10 * u); g.lineTo((x + 10) * u, 32 * u); g.closePath(); g.fill(); g.stroke(); } break;
    case 'furnace': box(g, 6 * u, 6 * u, 28 * u, 28 * u, C[16]); box(g, 12 * u, 17 * u, 16 * u, 13 * u, '#222'); g.fillStyle = '#ff9800'; g.fillRect(16 * u, 23 * u, 8 * u, 7 * u); break;
    case 'ore': box(g, 7 * u, 7 * u, 26 * u, 26 * u, '#8d9196'); g.fillStyle = '#ff8f00'; for (const [a, b] of [[12, 12], [22, 16], [15, 24], [24, 25]]) g.fillRect(a * u, b * u, 5 * u, 5 * u); break;
    case 'gold': box(g, 7 * u, 7 * u, 26 * u, 26 * u, C[8]); g.fillStyle = '#fff6b0'; g.fillRect(11 * u, 11 * u, 8 * u, 4 * u); break;
    case 'wood': box(g, 8 * u, 12 * u, 24 * u, 16 * u, C[6]); break;
    case 'plank': box(g, 7 * u, 7 * u, 26 * u, 26 * u, C[13]); ln(7, 20, 33, 20, '#222', 1.5); break;
    default: box(g, 7 * u, 7 * u, 26 * u, 26 * u, C[{ sand: 2, dirt: 1 }[name]] || '#ccc');
  }
  g.restore();
}

/* ============================ ЗВУК ============================ */
let ac = null;
function beep(f, d = 0.08, type = 'square', vol = 0.05, slide = 0) {
  if (!CONFIG.SOUND) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, ac.currentTime); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), ac.currentTime + d);
    g.gain.setValueAtTime(vol, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + d); o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + d);
  } catch (e) { }
}
const SND = { dmg: () => beep(180, .1, 'sawtooth', .06, -80), brk: () => beep(120, .12, 'square', .05, -40), get: () => beep(700, .09, 'sine', .05, 300), die: () => beep(300, .5, 'sawtooth', .07, -250), put: () => beep(240, .06, 'square', .04), eat: () => beep(500, .1, 'sine', .05, 100) };

/* ============================ СОСТОЯНИЕ ============================ */
let socket = null, myId = null, W = 0, H = 0, B = 40, blocks = null, rec = {}, hotbarDef = [], mats = [], price = {};
let inv = {}, me = { x: 0, y: 0, rx: 0, ry: 0, hp: 100, an: 0, sw: 0, skin: 0, name: '', al: null, pr: 0, mine: null, fu: null };
let players = new Map(), mobs = new Map(), items = new Map(), projs = new Map();
let parts = [], floats = [], cam = { x: 0, y: 0 }, ph = 0.1, playing = false, dead = false, slot = 0, matIdx = 0, mouse = { x: 0, y: 0, down: 0 }, keys = {};
let chosenSkin = 0, chosenServer = null, lbData = [], invOpen = false, timeNow = 0;
const getB = (x, y) => (x < 0 || x >= W || y < 0 || y >= H) ? (y < 0 ? 0 : 4) : blocks[y * W + x];

/* ============================ СТАРТОВЫЙ ЭКРАН ============================ */
const skinBox = $('skins');
for (let i = 0; i < 8; i++) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); box(g, 6, 6, 52, 52, '#fff'); face(g, 6, 6, 52, i);
  c.onclick = () => { chosenSkin = i; [...skinBox.children].forEach((e, j) => e.classList.toggle('sel', j === i)); }; skinBox.appendChild(c);
}
skinBox.children[0].classList.add('sel');
$('name').value = localStorage.getItem('cubee_name') || '';
async function loadServers() {
  try {
    const list = await (await fetch('/api/servers')).json(); const box_ = $('servers'); box_.innerHTML = '';
    list.forEach(s => {
      const b = document.createElement('button'); b.textContent = `${s.name} — [${s.players}/${s.max}]`; b.onclick = () => { chosenServer = s.id; [...box_.children].forEach(e => e.classList.remove('sel')); b.classList.add('sel'); };
      if (!chosenServer) { chosenServer = s.id; b.classList.add('sel'); } else if (chosenServer === s.id) b.classList.add('sel'); box_.appendChild(b);
    });
  } catch (e) { $('startErr').textContent = 'Не удалось получить список серверов'; }
}
loadServers(); setInterval(() => { if (!playing) loadServers(); }, 5000);
$('howBtn').onclick = () => $('how').classList.remove('hidden'); $('howClose').onclick = () => $('how').classList.add('hidden');
$('go').onclick = () => {
  const name = $('name').value.trim() || 'Cube'; localStorage.setItem('cubee_name', name); me.skin = chosenSkin; me.name = name;
  if (!socket) connect(); socket.emit('join', { name, skin: chosenSkin, room: chosenServer });
};
$('name').addEventListener('keydown', e => { if (e.key === 'Enter') $('go').click(); });

/* ============================ СЕТЬ ============================ */
function connect() {
  socket = io();
  socket.on('err', t => { $('startErr').textContent = t; loadServers(); });
  socket.on('init', d => {
    myId = d.id; W = d.W; H = d.H; B = d.B; rec = d.rec; hotbarDef = d.hotbar; mats = d.mats; price = d.price;
    blocks = Uint8Array.from(atob(d.blocks), c => c.charCodeAt(0)); playing = true; dead = false;
    $('start').classList.add('hidden'); $('hud').classList.remove('hidden'); buildHotbar(); buildCraft(); requestAnimationFrame(frame);
  });
  socket.on('b', list => { for (const [x, y, t] of list) blocks[y * W + x] = t; });
  socket.on('inv', v => { inv = v; updateHud(); });
  socket.on('lb', v => { lbData = v; drawLb(); });
  socket.on('chat', m => addChat(m));
  socket.on('toast', t => toast(t));
  socket.on('dead', d => { dead = true; $('deathInfo').textContent = `Вас убил: ${d.by}. Потеряно золота: ${d.lost}`; $('death').classList.remove('hidden'); closeWins(); });
  socket.on('respawned', () => { dead = false; $('death').classList.add('hidden'); });
  socket.on('s', onSnap);
  socket.on('disconnect', () => { playing = false; $('startErr').textContent = 'Соединение потеряно'; $('start').classList.remove('hidden'); $('hud').classList.add('hidden'); });
}
function onSnap(s) {
  ph = s.ph; const y = s.you; Object.assign(me, { x: y.x, y: y.y, hp: y.hp, an: y.an, sw: y.sw, al: y.al, pr: y.pr, mine: y.mine, fu: y.fu });
  if (!me.init) { me.rx = me.x; me.ry = me.y; cam.x = me.x; cam.y = me.y; me.init = true; }
  const sync = (map, arr, mk) => {
    const seen = new Set();
    for (const o of arr) { seen.add(o.i); let e = map.get(o.i); if (!e) { e = { rx: o.x, ry: o.y }; map.set(o.i, e); } if (mk && o.h < e.h) addFloat(o.x + 17, o.y - 8, o.h - e.h, true); Object.assign(e, o); }
    for (const k of map.keys()) if (!seen.has(k)) map.delete(k);
  };
  sync(players, s.p); sync(mobs, s.m); sync(items, s.i); sync(projs, s.j);
  for (const e of s.e) {
    if (e.k === 'dmg') addFloat(e.x, e.y, -e.v); if (e.k === 'brk') burst(e.x + 20, e.y + 20, e.b);
    if (SND[e.k] && Math.abs(e.x - me.x) < 700) SND[e.k]();
  }
  updateFurn(); updateHud(true);
}
let lastSent = '';
setInterval(() => {
  if (!playing || !socket) return;
  const w = toWorld(mouse.x, mouse.y), d = { l: keys.a || keys.arrowleft, r: keys.d || keys.arrowright, u: keys.w || keys.arrowup || keys[' '], mx: Math.round(w.x), my: Math.round(w.y), slot, mat: matIdx, down: mouse.down && !dead && !invOpen ? 1 : 0 };
  socket.emit('input', d);
}, 1000 / CONFIG.SEND_HZ);

/* ============================ ВВОД ============================ */
const typing = () => document.activeElement && document.activeElement.tagName === 'INPUT';
addEventListener('keydown', e => {
  if (!playing) return; const k = e.key.toLowerCase();
  if (typing()) { if (k === 'enter') { const t = e.target; if (t.id === 'chatInput') { if (t.value.trim()) socket.emit('chat', t.value); t.value = ''; } t.blur(); } if (k === 'escape') e.target.blur(); return; }
  if (k === 'enter') { $('chatInput').focus(); e.preventDefault(); return; }
  if (k === 'e') { toggleInv(); return; } if (k === 'escape') { closeWins(); return; }
  if (k === 'q') { cycleMat(); return; }
  if (k >= '1' && k <= '9') { selSlot(+k - 1); return; }
  keys[k] = 1; if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = 0; });
addEventListener('blur', () => { keys = {}; mouse.down = 0; });
cv.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
cv.addEventListener('mousedown', e => { mouse.x = e.clientX; mouse.y = e.clientY; if (e.button === 0) mouse.down = 1; if (typing()) document.activeElement.blur(); });
addEventListener('mouseup', e => { if (e.button === 0) mouse.down = 0; });
cv.addEventListener('contextmenu', e => { e.preventDefault(); if (!playing || dead) return; const w = toWorld(e.clientX, e.clientY); socket.emit('use', { x: Math.floor(w.x / B), y: Math.floor(w.y / B) }); });
cv.addEventListener('touchstart', e => { const t = e.touches[0]; mouse.x = t.clientX; mouse.y = t.clientY; mouse.down = 1; }, { passive: true });
cv.addEventListener('touchmove', e => { const t = e.touches[0]; mouse.x = t.clientX; mouse.y = t.clientY; }, { passive: true });
cv.addEventListener('touchend', () => { mouse.down = 0; });
function toWorld(sx, sy) { return { x: cam.x + (sx - vw / 2) / zoom, y: cam.y + (sy - vh / 2) / zoom }; }
function selSlot(i) { slot = i; [...$('hotbar').children].forEach((e, j) => e.classList.toggle('sel', j === i)); }
function cycleMat() { matIdx = (matIdx + 1) % mats.length; toast('Материал: ' + CONFIG.LABEL[mats[matIdx]]); selSlot(3); updateHud(); }

/* ============================ HUD ============================ */
const HB_ICON = ['sword', 'stone', 'food', null, 'door', 'gold', 'pick', 'spike', 'furnace'];
function buildHotbar() {
  const hb = $('hotbar'); hb.innerHTML = '';
  for (let i = 0; i < 9; i++) {
    const d = document.createElement('div'); d.className = 'slot' + (i === slot ? ' sel' : ''); d.innerHTML = '<i>' + (i + 1) + '</i><canvas width="64" height="64"></canvas><b></b>';
    d.onclick = () => selSlot(i); hb.appendChild(d);
  }
}
function updateHud() {
  if (!playing) return;
  const hb = $('hotbar').children; if (!hb.length) return;
  const cnt = [inv.wsword ? 'W' : '', inv.stone, inv.food, inv[mats[matIdx]], inv.door, (inv.gold >= price.goldblock ? '✓' : price.goldblock + 'g'), inv.pick ? '' : '✗', inv.spike, inv.furnace];
  for (let i = 0; i < 9; i++) {
    const nm = i === 3 ? mats[matIdx] : HB_ICON[i], el = hb[i]; el.querySelector('b').textContent = cnt[i] || (cnt[i] === 0 ? '0' : '');
    const c = el.querySelector('canvas'); if (c.dataset.n !== nm) { c.dataset.n = nm; icon(c.getContext('2d'), i === 0 && inv.wsword ? 'wsword' : nm, 64); }
    el.classList.toggle('dim', (i === 6 && !inv.pick) || ([1, 2, 4, 7, 8].includes(i) && !cnt[i]) || (i === 3 && !inv[mats[matIdx]]));
  }
  $('res').innerHTML = `<div class="g">GOLD ${inv.gold || 0}</div><div>WOOD ${inv.wood || 0}</div><div>STONES ${inv.stone || 0}</div>`;
  if (invOpen) buildInv();
}
function drawLb() {
  $('lb').innerHTML = '<b>TOP 10</b>' + lbData.map(r => `<div class="${r.i === myId ? 'me' : ''}"><span>${esc(r.n)}</span><span>${r.g}</span></div>`).join('');
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function addChat(m) {
  const log = $('chatLog'), d = document.createElement('div'); d.innerHTML = m.n === '*' ? `<i>${esc(m.t)}</i>` : `<b>${m.a ? '[' + esc(m.a) + '] ' : ''}${esc(m.n)}:</b> ${esc(m.t)}`; log.appendChild(d);
  while (log.children.length > CONFIG.CHAT_LINES) log.removeChild(log.firstChild);
}
$('hideChat').onclick = () => { const l = $('chatLog'), h = l.classList.toggle('hidden'); $('chatInput').classList.toggle('hidden', h); $('hideChat').textContent = h ? 'SHOW CHAT' : 'HIDE CHAT'; };
function toast(t) { const d = document.createElement('div'); d.textContent = t; $('toasts').appendChild(d); setTimeout(() => d.remove(), 2500); }

/* окна: инвентарь, крафт, печь, альянс */
function closeWins() { invOpen = false; for (const id of ['inv', 'ally']) $(id).classList.add('hidden'); if (me.fu) socket.emit('furn:close'); $('furn').classList.add('hidden'); }
function toggleInv() { if (dead) return; const o = !invOpen; closeWins(); invOpen = o; $('inv').classList.toggle('hidden', !o); if (o) buildInv(); }
$('invBtn').onclick = toggleInv;
function buildInv() {
  const g = $('invGrid'); g.innerHTML = '';
  for (const k in inv) if (inv[k] > 0) {
    const d = document.createElement('div'); d.className = 'slot'; d.draggable = true; d.title = CONFIG.LABEL[k] || k; d.innerHTML = '<canvas width="64" height="64"></canvas><b>' + inv[k] + '</b>';
    icon(d.firstChild.getContext('2d'), k, 64); d.ondragstart = e => { e.dataTransfer.setData('text/plain', k); e.dataTransfer.setData('shift', e.shiftKey ? '1' : ''); dragShift = e.shiftKey; }; g.appendChild(d);
  }
  const cr = $('craft'); for (const b of cr.children) { const r = rec[b.dataset.id]; b.disabled = !Object.keys(r.cost).every(k => (inv[k] || 0) >= r.cost[k]); }
}
let dragShift = false;
function buildCraft() {
  const cr = $('craft'); cr.innerHTML = '';
  for (const id in rec) {
    const r = rec[id], b = document.createElement('button'); b.dataset.id = id;
    b.textContent = `${CONFIG.LABEL[r.out[0]]} ×${r.out[1]} ← ` + Object.entries(r.cost).map(([k, n]) => `${CONFIG.LABEL[k]} ${n}`).join(', '); b.onclick = () => socket.emit('craft', id); cr.appendChild(b);
  }
}
cv.addEventListener('dragover', e => e.preventDefault());
cv.addEventListener('drop', e => {
  e.preventDefault(); const item = e.dataTransfer.getData('text/plain'); if (!item) return; const w = toWorld(e.clientX, e.clientY); let best = null, bd = 70;
  for (const [id, p] of players) { const d = Math.hypot(p.rx + 17 - w.x, p.ry + 17 - w.y); if (d < bd) { bd = d; best = id; } }
  if (best) socket.emit('give', { to: best, item, n: dragShift ? 10 : 1 }); else toast('Перетащите на игрока рядом');
});
$('fPutOre').onclick = () => socket.emit('furn', { op: 'put', what: 'ore', n: 1 }); $('fPutWood').onclick = () => socket.emit('furn', { op: 'put', what: 'wood', n: 1 });
$('fTake').onclick = () => socket.emit('furn', { op: 'take' }); $('fClose').onclick = () => { socket.emit('furn:close'); $('furn').classList.add('hidden'); };
function updateFurn() {
  const f = me.fu, w = $('furn'); if (!f) { w.classList.add('hidden'); return; } w.classList.remove('hidden');
  $('fOre').textContent = f.ore; $('fFuel').textContent = f.fuel; $('fOut').textContent = f.out; $('fBar').style.width = (f.pg * 100) + '%';
}
$('allyBtn').onclick = () => { const o = $('ally').classList.contains('hidden'); closeWins(); $('ally').classList.toggle('hidden', !o); $('allyCur').textContent = me.al ? 'Ваш альянс: ' + me.al : 'Вы не в альянсе'; };
$('allyClose').onclick = () => $('ally').classList.add('hidden');
$('allyCreate').onclick = () => { socket.emit('ally:create', $('allyName').value); setTimeout(() => $('allyCur').textContent = me.al ? 'Ваш альянс: ' + me.al : 'Вы не в альянсе', 300); };
$('allyJoin').onclick = () => { socket.emit('ally:join', $('allyName').value); setTimeout(() => $('allyCur').textContent = me.al ? 'Ваш альянс: ' + me.al : 'Вы не в альянсе', 300); };
$('allyLeave').onclick = () => { socket.emit('ally:leave'); setTimeout(() => $('allyCur').textContent = 'Вы не в альянсе', 300); };
$('respawn').onclick = () => socket.emit('respawn');

/* ============================ ЭФФЕКТЫ ============================ */
function burst(x, y, t) { const col = CONFIG.COLORS[t] || '#7cb342'; for (let i = 0; i < CONFIG.PART.COUNT; i++) parts.push({ x, y, vx: (Math.random() - .5) * 300, vy: -Math.random() * 300, life: CONFIG.PART.LIFE, col }); }
function addFloat(x, y, v, mob) { floats.push({ x, y, t: CONFIG.FLOAT_LIFE, v }); }

/* ============================ РЕНДЕР ============================ */
function drawBlock(t, x, y) {
  const g = ctx, s = B, C = CONFIG.COLORS; g.lineWidth = CONFIG.OUT_W; g.strokeStyle = CONFIG.OUTLINE;
  const solid = col => { g.fillStyle = col; g.fillRect(x, y, s, s); g.strokeRect(x + .5, y + .5, s - 1, s - 1); };
  switch (t) {
    case T.WATER: g.fillStyle = C[5]; g.fillRect(x, y, s, s); return;
    case T.GRASS: solid(C[1]); g.fillStyle = C[3]; g.fillRect(x + 1, y + 1, s - 2, 11); return;
    case T.GOLD: solid(C[8]); g.fillStyle = '#fff6b0'; g.fillRect(x + 7, y + 7, 9, 5); return;
    case T.CACTUS: g.fillStyle = '#2e6b34'; g.fillRect(x + 6, y + 2, s - 12, s - 2); g.strokeRect(x + 6.5, y + 2.5, s - 13, s - 3); g.strokeStyle = '#d8f0c8'; g.lineWidth = 1.5; g.beginPath(); for (let i = 0; i < 3; i++) { g.moveTo(x + 6, y + 9 + i * 11); g.lineTo(x + 1, y + 7 + i * 11); g.moveTo(x + s - 6, y + 9 + i * 11); g.lineTo(x + s - 1, y + 7 + i * 11); } g.stroke(); return;
    case T.SPIKE: g.fillStyle = '#b0b4b8'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x + i * 13.3, y + s); g.lineTo(x + i * 13.3 + 6.6, y + 8); g.lineTo(x + i * 13.3 + 13.3, y + s); g.closePath(); g.fill(); g.stroke(); } return;
    case T.SAW: { g.save(); g.translate(x + s / 2, y + s / 2); g.rotate(timeNow * 8); g.fillStyle = '#c9ced2'; g.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? 13 : 19; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#555'; g.beginPath(); g.arc(0, 0, 4, 0, 7); g.fill(); g.restore(); return; }
    case T.LEAVES: solid(C[7]); g.fillStyle = '#58bd64'; g.fillRect(x + 6, y + 6, 8, 8); g.fillRect(x + 22, y + 20, 8, 8); return;
    case T.DOOR: solid('#a1673a'); g.fillStyle = '#ffd54f'; g.beginPath(); g.arc(x + s - 10, y + s / 2, 3, 0, 7); g.fill(); return;
    case T.DOOR_OPEN: g.fillStyle = '#a1673a'; g.fillRect(x, y, 7, s); g.strokeRect(x + .5, y + .5, 6, s - 1); return;
    case T.SAPLING: case T.BUSH: g.strokeStyle = '#2e7d32'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + s / 2, y + s); g.lineTo(x + s / 2, y + 22); g.stroke(); g.fillStyle = '#4caf50'; g.beginPath(); g.arc(x + s / 2 - 6, y + 22, 6, 0, 7); g.arc(x + s / 2 + 6, y + 22, 6, 0, 7); g.fill(); if (t === T.BUSH) { g.fillStyle = '#e53935'; for (const [a, b] of [[10, 20], [26, 22], [18, 14]]) { g.beginPath(); g.arc(x + a, y + b, 3.5, 0, 7); g.fill(); } } return;
    case T.FURNACE: solid(C[16]); g.fillStyle = '#222'; g.fillRect(x + 8, y + 18, s - 16, 16); g.fillStyle = '#ff9800'; g.fillRect(x + 13, y + 26, s - 26, 8); return;
    default: solid(C[t] || '#f0f');
  }
}
function drawCube(x, y, s, skin, an, name, hp, ally, sw, prot, isMe, al) {
  const g = ctx, ax = Math.cos(an), ay = Math.sin(an);
  if (sw > 0) { g.save(); g.translate(x + s / 2, y + s / 2); g.rotate(an + (sw / .25 - .5) * 1.4); g.fillStyle = '#cfd8dc'; g.strokeStyle = '#222'; g.lineWidth = 2; g.fillRect(14, -3, 30, 6); g.strokeRect(14, -3, 30, 6); g.restore(); }
  g.globalAlpha = prot ? .55 : 1; g.fillStyle = '#fff'; g.fillRect(x, y, s, s); g.strokeStyle = CONFIG.OUTLINE; g.lineWidth = 2; g.strokeRect(x, y, s, s); face(g, x, y, s, skin, ax, ay); g.globalAlpha = 1;
  g.fillStyle = '#222'; g.fillRect(x - 3, y - 12, s + 6, 7); g.fillStyle = hp > 50 ? '#4caf50' : hp > 25 ? '#ffb300' : '#e53935'; g.fillRect(x - 2, y - 11, (s + 4) * Math.max(0, hp) / 100, 5);
  g.font = 'bold 13px "Trebuchet MS",sans-serif'; g.textAlign = 'center'; g.lineWidth = 3; g.strokeStyle = '#000'; g.fillStyle = ally ? '#8dff8d' : '#fff';
  const label = (al ? '[' + al + '] ' : '') + name; g.strokeText(label, x + s / 2, y - 17); g.fillText(label, x + s / 2, y - 17);
}
let lastT = 0;
function frame(t) {
  if (!playing) return; requestAnimationFrame(frame); const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016); lastT = t; timeNow = t / 1000;
  const k = 1 - Math.exp(-CONFIG.INTERP * dt);
  me.rx += (me.x - me.rx) * k; me.ry += (me.y - me.ry) * k;
  for (const m of [players, mobs, items, projs]) for (const e of m.values()) { e.rx += (e.x - e.rx) * k; e.ry += (e.y - e.ry) * k; }
  const kc = 1 - Math.exp(-CONFIG.CAM_SMOOTH * dt); cam.x += (me.rx + 17 - cam.x) * kc; cam.y += (me.ry + 17 - cam.y) * kc;
  cam.x = Math.max(vw / 2 / zoom - 200, Math.min(W * B - vw / 2 / zoom + 200, cam.x));
  // darkness: 0 day .. 1 night
  const night = ph < .5 ? 0 : ph < .6 ? (ph - .5) / .1 : ph < .9 ? 1 : (1 - ph) / .1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sky = ctx.createLinearGradient(0, 0, 0, vh), mix = (a, b) => a.map((v, i) => Math.round(v + (b[i] - v) * night)), top = mix(CONFIG.SKY_TOP, CONFIG.NIGHT_TOP), bot = mix(CONFIG.SKY_BOT, CONFIG.NIGHT_BOT);
  sky.addColorStop(0, `rgb(${top})`); sky.addColorStop(1, `rgb(${bot})`); ctx.fillStyle = sky; ctx.fillRect(0, 0, vw, vh);
  ctx.setTransform(dpr * zoom, 0, 0, dpr * zoom, 0, 0); ctx.translate(vw / 2 / zoom - cam.x, vh / 2 / zoom - cam.y);
  const x0 = Math.max(0, Math.floor((cam.x - vw / 2 / zoom) / B)), x1 = Math.min(W - 1, Math.ceil((cam.x + vw / 2 / zoom) / B)), y0 = Math.max(0, Math.floor((cam.y - vh / 2 / zoom) / B)), y1 = Math.min(H - 1, Math.ceil((cam.y + vh / 2 / zoom) / B));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const b = blocks[y * W + x]; if (b) drawBlock(b, x * B, y * B); }
  if (me.mine) { const mx = me.mine.x * B, my = me.mine.y * B; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 2; ctx.beginPath(); const n = Math.ceil(me.mine.f * 6); for (let i = 0; i < n; i++) { ctx.moveTo(mx + 6 + i * 5, my + 4); ctx.lineTo(mx + 14 + i * 4, my + 36 - i * 3); } ctx.stroke(); }
  const wp = toWorld(mouse.x, mouse.y); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2; ctx.strokeRect(Math.floor(wp.x / B) * B + 1, Math.floor(wp.y / B) * B + 1, B - 2, B - 2);
  for (const it of items.values()) { ctx.fillStyle = it.k === 'gold' ? '#f5c518' : '#e53935'; ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(it.rx + 10, it.ry + 10 + Math.sin(timeNow * 4 + it.i) * 2, 8, 0, 7); ctx.fill(); ctx.stroke(); }
  for (const m of mobs.values()) { ctx.fillStyle = CONFIG.MOB_COLORS[m.k % 3]; ctx.fillRect(m.rx, m.ry, 32, 32); ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.strokeRect(m.rx, m.ry, 32, 32); ctx.fillStyle = '#fff'; ctx.fillRect(m.rx + 6, m.ry + 9, 7, 7); ctx.fillRect(m.rx + 19, m.ry + 9, 7, 7); ctx.fillStyle = '#111'; ctx.fillRect(m.rx + 9, m.ry + 12, 3, 4); ctx.fillRect(m.rx + 22, m.ry + 12, 3, 4); ctx.fillRect(m.rx + 8, m.ry + 23, 16, 3); }
  for (const j of projs.values()) { ctx.fillStyle = '#9aa0a6'; ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(j.rx, j.ry, 6, 0, 7); ctx.fill(); ctx.stroke(); }
  for (const p of players.values()) drawCube(p.rx, p.ry, 34, p.s, p.an, p.n, p.h, me.al && p.a === me.al, p.sw, p.pr, false, p.a);
  if (!dead) { const wpos = toWorld(mouse.x, mouse.y); drawCube(me.rx, me.ry, 34, me.skin, Math.atan2(wpos.y - (me.ry + 17), wpos.x - (me.rx + 17)), me.name, me.hp, true, me.sw, me.pr, true, me.al); }
  for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; } p.vy += CONFIG.PART.GRAV * dt; p.x += p.vx * dt; p.y += p.vy * dt; ctx.fillStyle = p.col; ctx.fillRect(p.x, p.y, 6, 6); }
  ctx.font = 'bold 18px "Trebuchet MS",sans-serif'; ctx.textAlign = 'center';
  for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.t -= dt; if (f.t <= 0) { floats.splice(i, 1); continue; } f.y -= 40 * dt; ctx.globalAlpha = Math.min(1, f.t * 2); ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.fillStyle = f.v < 0 ? '#ff5252' : '#69f0ae'; ctx.strokeText(f.v, f.x, f.y); ctx.fillText(f.v, f.x, f.y); ctx.globalAlpha = 1; }
  // ночь + виньетка
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (night > 0) { const gr = ctx.createRadialGradient(vw / 2, vh / 2, 90, vw / 2, vh / 2, Math.max(vw, vh) * .7); gr.addColorStop(0, `rgba(5,8,30,${CONFIG.NIGHT_ALPHA * night * .55})`); gr.addColorStop(1, `rgba(5,8,30,${CONFIG.NIGHT_ALPHA * night * 1.25})`); ctx.fillStyle = gr; ctx.fillRect(0, 0, vw, vh); }
  if (me.hp < 30 && !dead) { ctx.fillStyle = `rgba(200,0,0,${.15 + .1 * Math.sin(timeNow * 6)})`; ctx.fillRect(0, 0, vw, vh); }
}
