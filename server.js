'use strict';
const express = require('express'), http = require('http'), { Server } = require('socket.io');

/* ============================ CONFIG ============================ */
const CONFIG = {
  PORT: process.env.PORT || 3000,
  B: 40, W: 220, H: 72, WATER_Y: 52,              // размер блока, размер мира (блоки), уровень воды
  TICK_HZ: 60, SNAP_HZ: 20, MAX_PLAYERS: 24,
  VIEW_X: 1300, VIEW_Y: 800, REACH: 200,           // зона видимости (px) и дальность действий
  SERVERS: [{ id: 'ams', name: 'Amsterdam 1' }, { id: 'fra', name: 'Frankfurt 1' }, { id: 'osl', name: 'Oslo 1' }],
  P: { SIZE: 34, HP: 100, SPEED: 250, ACC: 3200, GRAV: 2300, JUMP: 780, WGRAV: 600, SWIM: 230, MAXFALL: 1200,
       REGEN_DELAY: 4, REGEN_RATE: 2, HURT_CD: 0.7, SPAWN_PROT: 2 },
  COMBAT: { SWORD: 12, WSWORD: 18, RANGE: 85, CD: 0.4, STONE_DMG: 12, STONE_SPEED: 700, STONE_GRAV: 900,
            THROW_CD: 0.45, FOOD_HEAL: 30, EAT_CD: 0.6 },
  DEATH: { LOSS: 0.5, KILLER_SHARE: 0.5, ITEM_TTL: 120 },
  DAY: { LEN: 300, NIGHT_FROM: 0.55, NIGHT_TO: 0.95, NIGHT_DMG: 1.5, NIGHT_SPIKES: 24 },
  MOB: { DAY_MAX: 8, NIGHT_MAX: 20, HP: 20, DMG: 12, SPEED_DAY: 35, SPEED_NIGHT: 70, SIZE: 32, SPAWN_MIN_DIST: 350 },
  GROW: { SAPLING: 90, FOOD: 2 },
  FURNACE: { SMELT: 4, FUEL_PER_WOOD: 2, INGOT_GOLD: 8, ORE_CHANCE: 0.2, PUT_MAX: 5 },
  PRICES: { goldblock: 5 },
  PLACE_CD: 0.18, ALLY_MAX: 8, GIVE_RANGE: 150, CHAT_CD: 0.7,
  START: { sword: 1, stone: 6, food: 3 },
  HOTBAR: ['sword', 'throw', 'eat', 'block', 'door', 'goldblock', 'pick', 'spike', 'furnace'],
  MATS: ['wood', 'plank', 'stone', 'sand', 'dirt'],
  T: { AIR: 0, DIRT: 1, SAND: 2, GRASS: 3, STONE: 4, WATER: 5, LOG: 6, LEAVES: 7, GOLD: 8, CACTUS: 9, SPIKE: 10,
       DOOR: 11, DOOR_OPEN: 12, PLANK: 13, SAPLING: 14, BUSH: 15, FURNACE: 16, SAW: 17 },
  // h — время разрушения (сек), s — твёрдый, d — дроп, tool — нужна кирка, dmg — урон при касании
  BLOCKS: {
    0: {}, 1: { h: .6, s: 1, d: ['dirt', 1] }, 2: { h: .4, s: 1, d: ['sand', 1] }, 3: { h: .6, s: 1, d: ['dirt', 1] },
    4: { h: 1.6, s: 1, d: ['stone', 1], tool: 1 }, 5: { h: Infinity }, 6: { h: 1.2, s: 1, d: ['wood', 2] },
    7: { h: .3, d: ['wood', 1] }, 8: { h: 2.5, s: 1, d: ['gold', 5], tool: 1 }, 9: { h: .5, dmg: 8 },
    10: { h: 1, dmg: 15, d: ['spike', 1] }, 11: { h: .8, s: 1, d: ['door', 1] }, 12: { h: .8, d: ['door', 1] },
    13: { h: 1, s: 1, d: ['plank', 1] }, 14: { h: .2 }, 15: { h: .2 }, 16: { h: 1.5, s: 1, d: ['furnace', 1] },
    17: { h: 1.5, dmg: 20 }
  },
  MAT_BLOCK: { wood: 6, plank: 13, stone: 4, sand: 2, dirt: 1 },
  RECIPES: {
    plank:   { out: ['plank', 2],   cost: { wood: 1 } },
    pick:    { out: ['pick', 1],    cost: { plank: 3, stone: 2 } },
    wsword:  { out: ['wsword', 1],  cost: { plank: 3 } },
    furnace: { out: ['furnace', 1], cost: { stone: 8 } },
    door:    { out: ['door', 1],    cost: { plank: 2 } },
    spike:   { out: ['spike', 1],   cost: { stone: 2, plank: 1 } }
  }
};

const { B, W, H, T, P } = CONFIG, S = P.SIZE, INFO = CONFIG.BLOCKS, C = CONFIG.COMBAT, MOB = CONFIG.MOB, DAY = CONFIG.DAY;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const R1 = Math.round, FL = Math.floor;
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const SOLID = new Uint8Array(32); for (const k in INFO) SOLID[k] = INFO[k].s ? 1 : 0;
const overlap = (ax, ay, aw, ah, bx, by, bw, bh) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
const sanitize = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

/* ============================ ROOM ============================ */
class Room {
  constructor(def, idx) {
    Object.assign(this, { id: def.id, name: def.name, seed: 1234 + idx * 777 });
    this.players = new Map(); this.mobs = []; this.items = []; this.projs = []; this.furn = new Map(); this.grow = new Map();
    this.allies = new Map(); this.changes = []; this.ev = []; this.nid = 1; this.time = DAY.LEN * 0.1;
    this.night = false; this.nightSpikes = []; this.snapAcc = 0; this.snapN = 0; this.growAcc = 0; this.mobAcc = 0;
    this.blocks = new Uint8Array(W * H); this.timer = null; this.rand = Math.random;
    this.gen();
  }
  get(x, y) { if (x < 0 || x >= W || y >= H) return T.STONE; if (y < 0) return 0; return this.blocks[y * W + x]; }
  set(x, y, t) { if (x < 0 || x >= W || y < 0 || y >= H) return; this.blocks[y * W + x] = t; this.changes.push([x, y, t]); }
  solid(x, y) { return !!SOLID[this.get(x, y)]; }
  boxSolid(x, y, w, h) {
    for (let ty = FL(y / B); ty <= FL((y + h - 0.01) / B); ty++) for (let tx = FL(x / B); tx <= FL((x + w - 0.01) / B); tx++) if (this.solid(tx, ty)) return true;
    return false;
  }
  moveBody(e, w, h, dt) {
    e.on = false; e.hitX = false;
    let nx = e.x + e.vx * dt;
    if (this.boxSolid(nx, e.y, w, h)) { nx = e.vx > 0 ? FL((nx + w) / B) * B - w - 0.01 : (FL(nx / B) + 1) * B + 0.01; e.vx = 0; e.hitX = true; }
    e.x = nx;
    let ny = e.y + e.vy * dt;
    if (this.boxSolid(e.x, ny, w, h)) { if (e.vy > 0) { ny = FL((ny + h) / B) * B - h - 0.01; e.on = true; } else ny = (FL(ny / B) + 1) * B + 0.01; e.vy = 0; }
    e.y = ny;
  }
  surfaceY(tx) { for (let y = 0; y < H; y++) if (this.get(tx, y) !== 0) return y; return H; }

  /* ---------- генерация мира ---------- */
  gen() {
    const R = mulberry32(this.seed), b = this.blocks;
    const island = (cx, hw, top, depth, type) => {
      for (let x = cx - hw; x <= cx + hw; x++) {
        if (x < 1 || x >= W - 1) continue;
        const k = (x - cx) / hw, d = Math.max(1, Math.round(depth * Math.sqrt(1 - k * k)));
        for (let i = 0; i < d; i++) {
          let t = type === 'sand' ? (i < 4 ? T.SAND : T.STONE) : (i === 0 ? T.GRASS : i < 3 ? T.DIRT : T.STONE);
          if (t === T.STONE && R() < 0.025) t = T.GOLD;
          b[(top + i) * W + x] = t;
        }
      }
    };
    island(W >> 1, 22, 34, 10, 'grass');
    for (let n = 0; n < 18; n++) {
      const hw = 7 + R() * 12, cx = FL(8 + R() * (W - 16));
      if (Math.abs(cx - W / 2) < hw + 26) continue;
      island(cx, FL(hw), 24 + FL(R() * 14), 5 + FL(R() * 7), R() < 0.35 ? 'sand' : 'grass');
    }
    for (let y = CONFIG.WATER_Y; y < H; y++) for (let x = 0; x < W; x++) if (!b[y * W + x]) b[y * W + x] = T.WATER;
    let lastTree = -9;
    for (let x = 2; x < W - 2; x++) {
      const sy = this.surfaceY(x), t = this.get(x, sy), safe = Math.abs(x - W / 2) < 8, nearSp = Math.abs(x - W / 2) < 5;
      if (sy >= CONFIG.WATER_Y || sy < 3) continue;
      if (t === T.GRASS) {
        if (!nearSp && R() < 0.09 && x - lastTree > 5) {
          const h = 3 + FL(R() * 2), top = sy - h; lastTree = x;
          for (let dx = -1; dx <= 1; dx++) for (let dy = -2; dy <= 0; dy++) if (!this.get(x + dx, top + dy)) b[(top + dy) * W + x + dx] = T.LEAVES;
          for (let i = 1; i <= h; i++) b[(sy - i) * W + x] = T.LOG;
        } else if (R() < 0.05) { b[(sy - 1) * W + x] = T.SAPLING; this.grow.set((sy - 1) * W + x, R() * CONFIG.GROW.SAPLING); }
        else if (!safe && R() < 0.012) b[(sy - 1) * W + x] = T.SPIKE;
        else if (!safe && R() < 0.006) b[(sy - 1) * W + x] = T.SAW;
      } else if (t === T.SAND && R() < 0.1) {
        const h = 1 + FL(R() * 3); for (let i = 1; i <= h; i++) if (!this.get(x, sy - i)) b[(sy - i) * W + x] = T.CACTUS;
      }
    }
  }
  spawnPos() { const tx = (W >> 1) + FL((Math.random() - 0.5) * 6), sy = this.surfaceY(tx); return { x: tx * B + 3, y: (sy - 1) * B - S }; }

  /* ---------- игроки ---------- */
  addPlayer(sock, name, skin) {
    const sp = this.spawnPos();
    const p = { id: sock.id, sock, name, skin, x: sp.x, y: sp.y, vx: 0, vy: 0, on: false, hp: P.HP, dead: false, prot: P.SPAWN_PROT,
      inv: Object.assign({ gold: 0, wood: 0, plank: 0, stone: 0, sand: 0, dirt: 0, ore: 0, food: 0, sword: 0, wsword: 0, pick: 0, furnace: 0, door: 0, spike: 0 }, CONFIG.START),
      in: { l: 0, r: 0, u: 0, mx: 0, my: 0, slot: 0, mat: 0, down: 0 }, cd: { atk: 0, place: 0, thr: 0, eat: 0, swing: 0, toast: 0 },
      mine: null, hurtT: 0, lastHurt: 99, swing: 0, an: 0, ally: null, furnKey: null, dirty: true, lastIn: 0, chatT: 0, ctrlT: 0 };
    this.players.set(sock.id, p);
    if (!this.timer) { this.last = Date.now(); this.timer = setInterval(() => this.loop(), 1000 / CONFIG.TICK_HZ); }
    return p;
  }
  removePlayer(p) {
    this.leaveAlly(p); this.players.delete(p.id);
    if (!this.players.size) { clearInterval(this.timer); this.timer = null; }
  }
  isAlly(a, b) { return !!a.ally && a.ally === b.ally; }
  leaveAlly(p) { if (!p.ally) return; const s = this.allies.get(p.ally); if (s) { s.delete(p.id); if (!s.size) this.allies.delete(p.ally); } p.ally = null; }
  toast(p, t) { p.sock.emit('toast', t); }
  add(p, k, n) { p.inv[k] = (p.inv[k] || 0) + n; p.dirty = true; }
  hurt(t, amount, src) {
    if (t.dead || t.prot > 0) return;
    t.hp -= amount; t.lastHurt = 0; this.ev.push({ k: 'dmg', x: R1(t.x + S / 2), y: R1(t.y), v: R1(amount) });
    if (t.hp <= 0) this.kill(t, src);
  }
  kill(t, src) {
    t.dead = true; t.hp = 0; t.mine = null; t.furnKey = null;
    const loss = FL(t.inv.gold * CONFIG.DEATH.LOSS); t.inv.gold -= loss; t.dirty = true;
    let share = 0;
    if (src && src.inv && src !== t) { share = FL(loss * CONFIG.DEATH.KILLER_SHARE); src.inv.gold += share; src.dirty = true; }
    const rest = loss - share;
    if (rest > 0) for (let i = 0; i < 3; i++) { const n = i < 2 ? FL(rest / 3) : rest - 2 * FL(rest / 3); if (n > 0) this.dropItem(t.x + (i - 1) * 20, t.y, 'gold', n); }
    this.ev.push({ k: 'die', x: R1(t.x), y: R1(t.y) });
    t.sock.emit('dead', { by: src && src.name ? src.name : 'мир', lost: loss });
  }
  respawn(p) {
    if (!p.dead) return; const sp = this.spawnPos();
    Object.assign(p, { x: sp.x, y: sp.y, vx: 0, vy: 0, hp: P.HP, dead: false, prot: P.SPAWN_PROT, lastHurt: 99 }); p.sock.emit('respawned');
  }
  dropItem(x, y, k, n) { this.items.push({ id: this.nid++, x, y, vy: -200, k, n, ttl: CONFIG.DEATH.ITEM_TTL }); }

  /* ---------- действия игрока ---------- */
  tileTarget(p) {
    const tx = FL(p.in.mx / B), ty = FL(p.in.my / B);
    if (Math.hypot(tx * B + B / 2 - (p.x + S / 2), ty * B + B / 2 - (p.y + S / 2)) > CONFIG.REACH) return null;
    return { tx, ty };
  }
  melee(p) {
    const cx = p.x + S / 2, cy = p.y + S / 2, i = p.in; let dx = i.mx - cx, dy = i.my - cy; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const dmg = p.inv.wsword ? C.WSWORD : C.SWORD; let hit = false;
    const test = (ex, ey) => { ex -= cx; ey -= cy; const d = Math.hypot(ex, ey); return d < C.RANGE && (d < 30 || (ex * dx + ey * dy) / d > 0.3); };
    for (const t of this.players.values()) if (t !== p && !t.dead && !this.isAlly(p, t) && test(t.x + S / 2, t.y + S / 2)) { this.hurt(t, dmg, p); t.vy = -250; t.vx += dx * 300; hit = true; }
    for (const m of this.mobs) if (test(m.x + MOB.SIZE / 2, m.y + MOB.SIZE / 2)) { this.hurtMob(m, dmg, p); m.vx = dx * 200; hit = true; }
    if (hit) { p.cd.atk = C.CD; p.swing = 0.25; }
    return hit;
  }
  hurtMob(m, d, src) {
    m.hp -= d; this.ev.push({ k: 'dmg', x: R1(m.x + MOB.SIZE / 2), y: R1(m.y), v: R1(d) });
    if (m.hp <= 0) { this.mobs.splice(this.mobs.indexOf(m), 1); this.dropItem(m.x, m.y, 'food', 1); this.ev.push({ k: 'die', x: R1(m.x), y: R1(m.y) }); }
  }
  mine(p, dt, hasPick) {
    const tg = this.tileTarget(p); if (!tg) { p.mine = null; return; }
    const b = this.get(tg.tx, tg.ty), info = INFO[b];
    if (!b || !info || !isFinite(info.h)) { p.mine = null; return; }
    if (info.tool && !hasPick) { p.mine = null; if (p.cd.toast <= 0) { this.toast(p, 'Нужна кирка (слот 7)'); p.cd.toast = 2; } return; }
    const key = tg.ty * W + tg.tx;
    if (!p.mine || p.mine.k !== key) p.mine = { k: key, t: 0, x: tg.tx, y: tg.ty };
    p.mine.t += dt * (hasPick ? 3 : 1);
    if (p.cd.swing <= 0) { p.swing = 0.2; p.cd.swing = 0.3; }
    if (p.mine.t >= info.h) { this.breakBlock(p, tg.tx, tg.ty, b); p.mine = null; }
  }
  breakBlock(p, x, y, b) {
    const info = INFO[b], key = y * W + x;
    this.ev.push({ k: 'brk', x: x * B, y: y * B, b });
    if (b === T.BUSH) { this.add(p, 'food', CONFIG.GROW.FOOD); this.set(x, y, T.SAPLING); this.grow.set(key, this.time + CONFIG.GROW.SAPLING); return; }
    this.set(x, y, T.AIR);
    if (b === T.SAPLING) this.grow.delete(key);
    if (b === T.FURNACE) { const f = this.furn.get(key); if (f) { this.add(p, 'ore', f.ore); this.add(p, 'wood', FL(f.fuel / CONFIG.FURNACE.FUEL_PER_WOOD)); if (f.out) this.add(p, 'gold', f.out * CONFIG.FURNACE.INGOT_GOLD); this.furn.delete(key); } }
    if (info.d) { this.add(p, info.d[0], info.d[1]); if (b === T.STONE && Math.random() < CONFIG.FURNACE.ORE_CHANCE) this.add(p, 'ore', 1); }
  }
  place(p) {
    const tg = this.tileTarget(p); if (!tg) return; const { tx, ty } = tg, cur = this.get(tx, ty);
    if (cur !== T.AIR && cur !== T.WATER) return;
    const s = p.in.slot; let type, pay;
    if (s === 3) { const m = CONFIG.MATS[p.in.mat % CONFIG.MATS.length]; if (!p.inv[m]) return; type = CONFIG.MAT_BLOCK[m]; pay = () => p.inv[m]--; }
    else if (s === 4) { if (!p.inv.door) return; type = T.DOOR; pay = () => p.inv.door--; }
    else if (s === 5) { if (p.inv.gold < CONFIG.PRICES.goldblock) return; type = T.GOLD; pay = () => p.inv.gold -= CONFIG.PRICES.goldblock; }
    else if (s === 7) { if (!p.inv.spike) return; type = T.SPIKE; pay = () => p.inv.spike--; }
    else if (s === 8) { if (!p.inv.furnace) return; type = T.FURNACE; pay = () => p.inv.furnace--; }
    else return;
    if (SOLID[type]) {
      for (const o of this.players.values()) if (!o.dead && overlap(tx * B, ty * B, B, B, o.x, o.y, S, S)) return;
      for (const m of this.mobs) if (overlap(tx * B, ty * B, B, B, m.x, m.y, MOB.SIZE, MOB.SIZE)) return;
    }
    pay(); p.dirty = true; this.set(tx, ty, type); p.cd.place = CONFIG.PLACE_CD; this.ev.push({ k: 'put', x: tx * B, y: ty * B });
  }
  act(p, dt) {
    const c = p.cd, i = p.in; for (const k in c) c[k] = Math.max(0, c[k] - dt); p.swing = Math.max(0, p.swing - dt);
    p.an = Math.atan2(i.my - (p.y + S / 2), i.mx - (p.x + S / 2));
    if (!i.down) { p.mine = null; return; }
    const s = i.slot;
    if (s === 0 || s === 6) {
      if (s === 0 && c.atk <= 0 && this.melee(p)) { p.mine = null; return; }
      this.mine(p, dt, s === 6 && p.inv.pick > 0);
    } else if (s === 1) {
      if (c.thr <= 0 && p.inv.stone > 0) {
        p.inv.stone--; p.dirty = true; c.thr = C.THROW_CD; p.swing = 0.2;
        this.projs.push({ id: this.nid++, x: p.x + S / 2, y: p.y + S / 2, vx: Math.cos(p.an) * C.STONE_SPEED, vy: Math.sin(p.an) * C.STONE_SPEED - 120, owner: p, ttl: 3 });
      }
    } else if (s === 2) {
      if (c.eat <= 0 && p.inv.food > 0 && p.hp < P.HP) { p.inv.food--; p.dirty = true; p.hp = Math.min(P.HP, p.hp + C.FOOD_HEAL); c.eat = C.EAT_CD; this.ev.push({ k: 'eat', x: R1(p.x), y: R1(p.y) }); }
    } else if (c.place <= 0) this.place(p);
  }
  use(p, tx, ty) {
    if (p.dead || !Number.isInteger(tx) || !Number.isInteger(ty)) return;
    if (Math.hypot(tx * B + B / 2 - (p.x + S / 2), ty * B + B / 2 - (p.y + S / 2)) > CONFIG.REACH) return;
    const b = this.get(tx, ty), key = ty * W + tx;
    if (b === T.DOOR) this.set(tx, ty, T.DOOR_OPEN);
    else if (b === T.DOOR_OPEN) {
      for (const o of this.players.values()) if (!o.dead && overlap(tx * B, ty * B, B, B, o.x, o.y, S, S)) return;
      for (const m of this.mobs) if (overlap(tx * B, ty * B, B, B, m.x, m.y, MOB.SIZE, MOB.SIZE)) return;
      this.set(tx, ty, T.DOOR);
    } else if (b === T.FURNACE) { if (!this.furn.has(key)) this.furn.set(key, { ore: 0, fuel: 0, out: 0, prog: 0 }); p.furnKey = key; }
    else if (b === T.BUSH) this.breakBlock(p, tx, ty, b);
  }
  furnaceOp(p, op, what, n) {
    const f = p.furnKey != null && this.furn.get(p.furnKey); if (!f) return;
    n = clamp(FL(num(n, 1)), 1, CONFIG.FURNACE.PUT_MAX);
    if (op === 'put') {
      if (what === 'ore') { n = Math.min(n, p.inv.ore); p.inv.ore -= n; f.ore += n; }
      else if (what === 'wood') { n = Math.min(n, p.inv.wood); p.inv.wood -= n; f.fuel += n * CONFIG.FURNACE.FUEL_PER_WOOD; }
      p.dirty = true;
    } else if (op === 'take' && f.out > 0) { p.inv.gold += f.out * CONFIG.FURNACE.INGOT_GOLD; f.out = 0; p.dirty = true; }
  }
  craft(p, id) {
    const r = CONFIG.RECIPES[id]; if (!r) return;
    for (const k in r.cost) if ((p.inv[k] || 0) < r.cost[k]) return;
    for (const k in r.cost) p.inv[k] -= r.cost[k]; this.add(p, r.out[0], r.out[1]);
  }
  give(p, toId, item, n) {
    const t = this.players.get(toId); n = clamp(FL(num(n, 1)), 1, 99);
    if (!t || t === p || t.dead || p.dead || !(item in p.inv)) return;
    if (Math.hypot(t.x - p.x, t.y - p.y) > CONFIG.GIVE_RANGE) return;
    n = Math.min(n, p.inv[item]); if (n <= 0) return;
    p.inv[item] -= n; t.inv[item] += n; p.dirty = t.dirty = true; this.toast(t, `${p.name} передал: ${item} ×${n}`);
  }

  /* ---------- шаг симуляции ---------- */
  stepPlayer(p, dt) {
    if (p.dead) return;
    const i = p.in; p.prot = Math.max(0, p.prot - dt); p.hurtT -= dt; p.lastHurt += dt;
    const cx = p.x + S / 2, cy = p.y + S / 2, wet = this.get(FL(cx / B), FL(cy / B)) === T.WATER;
    const dir = (i.r ? 1 : 0) - (i.l ? 1 : 0), a = P.ACC * dt;
    p.vx += clamp(dir * P.SPEED * (wet ? 0.55 : 1) - p.vx, -a, a);
    p.vy += (wet ? P.WGRAV : P.GRAV) * dt;
    if (i.u) { if (wet) p.vy = -P.SWIM; else if (p.on) p.vy = -P.JUMP; }
    p.vy = clamp(p.vy, -1000, wet ? 260 : P.MAXFALL);
    this.moveBody(p, S, S, dt); p.x = clamp(p.x, 0, W * B - S);
    let dm = 0;
    for (let ty = FL((p.y + 2) / B); ty <= FL((p.y + S - 2) / B); ty++) for (let tx = FL((p.x + 2) / B); tx <= FL((p.x + S - 2) / B); tx++) dm = Math.max(dm, INFO[this.get(tx, ty)].dmg || 0);
    for (const m of this.mobs) if (overlap(p.x, p.y, S, S, m.x, m.y, MOB.SIZE, MOB.SIZE)) dm = Math.max(dm, MOB.DMG);
    if (dm > 0 && p.hurtT <= 0 && p.prot <= 0) { this.hurt(p, dm * (this.night ? DAY.NIGHT_DMG : 1), null); p.hurtT = P.HURT_CD; p.vy = -300; }
    if (p.lastHurt > P.REGEN_DELAY && p.hp < P.HP) p.hp = Math.min(P.HP, p.hp + P.REGEN_RATE * dt);
    if (p.furnKey != null) { const x = p.furnKey % W, y = FL(p.furnKey / W); if (this.get(x, y) !== T.FURNACE || Math.hypot(x * B - p.x, y * B - p.y) > CONFIG.REACH + 60) p.furnKey = null; }
    this.act(p, dt);
  }
  stepMobs(dt) {
    const sp = this.night ? MOB.SPEED_NIGHT : MOB.SPEED_DAY, Z = MOB.SIZE;
    for (let n = this.mobs.length - 1; n >= 0; n--) {
      const m = this.mobs[n]; m.t -= dt;
      if (m.t <= 0) { m.t = 1 + Math.random() * 3; m.d = [-1, 0, 0, 1][FL(Math.random() * 4)]; }
      m.vx = m.d * sp + (m.kb || 0); m.kb = 0; m.vy = Math.min(m.vy + P.GRAV * dt, 1000);
      if (m.on && m.d) { const fx = m.d > 0 ? m.x + Z + 4 : m.x - 4; if (!this.solid(FL(fx / B), FL((m.y + Z + 4) / B))) m.d *= -1; }
      this.moveBody(m, Z, Z, dt);
      if (m.hitX && m.d) m.d *= -1;
      m.x = clamp(m.x, 0, W * B - Z);
      if (m.y > CONFIG.WATER_Y * B) this.mobs.splice(n, 1);
    }
  }
  stepItems(dt) {
    for (let n = this.items.length - 1; n >= 0; n--) {
      const it = this.items[n]; it.ttl -= dt; it.vy = Math.min(it.vy + 1500 * dt, 800);
      const ny = it.y + it.vy * dt; if (this.solid(FL((it.x + 10) / B), FL((ny + 20) / B))) it.vy = 0; else it.y = ny;
      let got = null;
      for (const p of this.players.values()) if (!p.dead && Math.hypot(p.x + S / 2 - it.x - 10, p.y + S / 2 - it.y - 10) < 34) { got = p; break; }
      if (got) { this.add(got, it.k, it.n); this.ev.push({ k: 'get', x: R1(it.x), y: R1(it.y) }); this.items.splice(n, 1); }
      else if (it.ttl <= 0 || it.y > H * B) this.items.splice(n, 1);
    }
  }
  stepProjs(dt) {
    for (let n = this.projs.length - 1; n >= 0; n--) {
      const j = this.projs[n]; j.ttl -= dt; j.vy += C.STONE_GRAV * dt; j.x += j.vx * dt; j.y += j.vy * dt;
      let dead = j.ttl <= 0 || this.solid(FL(j.x / B), FL(j.y / B));
      if (!dead) for (const t of this.players.values()) if (t !== j.owner && !t.dead && !this.isAlly(j.owner, t) && Math.hypot(t.x + S / 2 - j.x, t.y + S / 2 - j.y) < S / 2 + 4) { this.hurt(t, C.STONE_DMG, j.owner); dead = true; break; }
      if (!dead) for (const m of this.mobs) if (Math.hypot(m.x + MOB.SIZE / 2 - j.x, m.y + MOB.SIZE / 2 - j.y) < MOB.SIZE / 2 + 4) { this.hurtMob(m, C.STONE_DMG, j.owner); dead = true; break; }
      if (dead) this.projs.splice(n, 1);
    }
  }
  stepWorld(dt) {
    for (const [key, f] of this.furn) if (f.ore > 0 && f.fuel > 0) {
      f.prog += dt; if (f.prog >= CONFIG.FURNACE.SMELT) { f.prog = 0; f.ore--; f.fuel--; f.out++; }
    } else f.prog = 0;
    this.growAcc += dt;
    if (this.growAcc >= 1) {
      this.growAcc = 0;
      for (const [key, at] of this.grow) if (this.time >= at) { this.grow.delete(key); if (this.blocks[key] === T.SAPLING) this.set(key % W, FL(key / W), T.BUSH); }
    }
    this.mobAcc += dt;
    if (this.mobAcc >= 1) {
      this.mobAcc = 0;
      if (this.mobs.length < (this.night ? MOB.NIGHT_MAX : MOB.DAY_MAX)) {
        const tx = FL(Math.random() * W), sy = this.surfaceY(tx), t = this.get(tx, sy);
        if (sy < CONFIG.WATER_Y && (t === T.GRASS || t === T.SAND || t === T.DIRT) && !this.get(tx, sy - 1)) {
          const x = tx * B, y = (sy - 1) * B - 2; let ok = true;
          for (const p of this.players.values()) if (Math.hypot(p.x - x, p.y - y) < MOB.SPAWN_MIN_DIST) ok = false;
          if (ok) this.mobs.push({ id: this.nid++, x, y, vx: 0, vy: 0, d: 0, t: 1, hp: MOB.HP, on: false, hitX: false, kind: FL(Math.random() * 3) });
        }
      }
    }
    const ph = (this.time % DAY.LEN) / DAY.LEN, night = ph >= DAY.NIGHT_FROM && ph < DAY.NIGHT_TO;
    if (night !== this.night) {
      this.night = night;
      if (night) {
        for (let n = 0; n < DAY.NIGHT_SPIKES * 4 && this.nightSpikes.length < DAY.NIGHT_SPIKES; n++) {
          const tx = FL(Math.random() * W), sy = this.surfaceY(tx);
          if (Math.abs(tx - W / 2) > 8 && sy < CONFIG.WATER_Y && this.get(tx, sy) === T.GRASS && !this.get(tx, sy - 1)) { this.set(tx, sy - 1, T.SPIKE); this.nightSpikes.push([tx, sy - 1]); }
        }
      } else { for (const [x, y] of this.nightSpikes) if (this.get(x, y) === T.SPIKE) this.set(x, y, T.AIR); this.nightSpikes = []; }
    }
  }
  loop() {
    const now = Date.now(); let dt = Math.min((now - this.last) / 1000, 1 / 30); this.last = now;
    this.time += dt;
    for (const p of this.players.values()) this.stepPlayer(p, dt);
    this.stepMobs(dt); this.stepProjs(dt); this.stepItems(dt); this.stepWorld(dt);
    this.snapAcc += dt;
    if (this.snapAcc >= 1 / CONFIG.SNAP_HZ) { this.snapAcc = 0; this.snapshot(); }
  }
  snapshot() {
    this.snapN++;
    if (this.changes.length) { io.to(this.id).emit('b', this.changes); this.changes = []; }
    if (this.snapN % CONFIG.SNAP_HZ === 0) {
      const lb = [...this.players.values()].sort((a, b) => b.inv.gold - a.inv.gold).slice(0, 10).map(p => ({ i: p.id, n: p.name, g: p.inv.gold }));
      io.to(this.id).emit('lb', lb);
    }
    const ph = +((this.time % DAY.LEN) / DAY.LEN).toFixed(4), VX = CONFIG.VIEW_X, VY = CONFIG.VIEW_Y;
    for (const p of this.players.values()) {
      if (p.dirty) { p.dirty = false; p.sock.emit('inv', p.inv); }
      const near = e => Math.abs(e.x - p.x) < VX && Math.abs(e.y - p.y) < VY;
      const f = p.furnKey != null ? this.furn.get(p.furnKey) : null;
      const s = { ph, you: { x: R1(p.x), y: R1(p.y), hp: R1(p.hp), al: p.ally, pr: p.prot > 0 ? 1 : 0, an: +p.an.toFixed(2), sw: p.swing,
        mine: p.mine ? { x: p.mine.x, y: p.mine.y, f: +(p.mine.t / (INFO[this.get(p.mine.x, p.mine.y)].h || 1)).toFixed(2) } : null,
        fu: f ? { x: p.furnKey % W, y: FL(p.furnKey / W), ore: f.ore, fuel: f.fuel, out: f.out, pg: +(f.prog / CONFIG.FURNACE.SMELT).toFixed(2) } : null },
        p: [], m: [], i: [], j: [], e: [] };
      for (const o of this.players.values()) if (o !== p && !o.dead && near(o)) s.p.push({ i: o.id, x: R1(o.x), y: R1(o.y), h: R1(o.hp), n: o.name, s: o.skin, a: o.ally, an: +o.an.toFixed(2), sw: o.swing, pr: o.prot > 0 ? 1 : 0 });
      for (const m of this.mobs) if (near(m)) s.m.push({ i: m.id, x: R1(m.x), y: R1(m.y), h: m.hp, k: m.kind });
      for (const it of this.items) if (near(it)) s.i.push({ i: it.id, x: R1(it.x), y: R1(it.y), k: it.k, n: it.n });
      for (const j of this.projs) if (near(j)) s.j.push({ i: j.id, x: R1(j.x), y: R1(j.y) });
      for (const e of this.ev) if (near(e)) s.e.push(e);
      p.sock.volatile.emit('s', s);
    }
    this.ev = [];
  }
}

/* ============================ SERVER ============================ */
const app = express(), server = http.createServer(app), io = new Server(server);
app.use(express.static(__dirname + '/public'));
const rooms = new Map(CONFIG.SERVERS.map((d, i) => [d.id, new Room(d, i)]));
app.get('/api/servers', (q, r) => r.json(CONFIG.SERVERS.map(d => ({ id: d.id, name: d.name, players: rooms.get(d.id).players.size, max: CONFIG.MAX_PLAYERS }))));

io.on('connection', sock => {
  let room = null, p = null;
  sock.on('join', d => {
    if (p) return; d = d || {};
    const r = rooms.get(d.room); if (!r) return sock.emit('err', 'Сервер не найден');
    if (r.players.size >= CONFIG.MAX_PLAYERS) return sock.emit('err', 'Сервер заполнен');
    room = r; p = r.addPlayer(sock, sanitize(d.name, 14) || 'Cube', clamp(FL(num(d.skin)), 0, 7)); sock.join(r.id);
    sock.emit('init', { id: sock.id, W, H, B, blocks: Buffer.from(r.blocks).toString('base64'), rec: CONFIG.RECIPES, hotbar: CONFIG.HOTBAR, mats: CONFIG.MATS, price: CONFIG.PRICES, day: DAY.LEN });
    io.to(r.id).emit('chat', { n: '*', t: `${p.name} зашёл в игру` });
  });
  sock.on('input', d => {
    if (!p || !d) return; const now = Date.now(); if (now - p.lastIn < 12) return; p.lastIn = now; const i = p.in;
    i.l = d.l ? 1 : 0; i.r = d.r ? 1 : 0; i.u = d.u ? 1 : 0; i.down = d.down ? 1 : 0;
    i.mx = clamp(num(d.mx), -100, W * B + 100); i.my = clamp(num(d.my), -400, H * B + 100);
    i.slot = clamp(FL(num(d.slot)), 0, 8); i.mat = clamp(FL(num(d.mat)), 0, CONFIG.MATS.length - 1);
  });
  const ctrl = fn => (...a) => { if (!p) return; const now = Date.now(); if (now - p.ctrlT < 60) return; p.ctrlT = now; fn(...a); };
  sock.on('use', ctrl(d => d && room.use(p, d.x, d.y)));
  sock.on('craft', ctrl(id => !p.dead && room.craft(p, String(id))));
  sock.on('give', ctrl(d => d && room.give(p, String(d.to), String(d.item), d.n)));
  sock.on('furn', ctrl(d => d && !p.dead && room.furnaceOp(p, String(d.op), String(d.what), d.n)));
  sock.on('furn:close', () => { if (p) p.furnKey = null; });
  sock.on('respawn', () => p && room.respawn(p));
  sock.on('chat', t => {
    if (!p) return; const now = Date.now(); if (now - p.chatT < CONFIG.CHAT_CD * 1000) return; p.chatT = now;
    t = sanitize(t, 100); if (t) io.to(room.id).emit('chat', { n: p.name, t, a: p.ally });
  });
  sock.on('ally:create', n => {
    if (!p) return; n = sanitize(n, 12); if (!n) return;
    if (room.allies.has(n)) return sock.emit('toast', 'Такой альянс уже есть');
    room.leaveAlly(p); room.allies.set(n, new Set([p.id])); p.ally = n; sock.emit('toast', `Альянс «${n}» создан`);
  });
  sock.on('ally:join', n => {
    if (!p) return; n = sanitize(n, 12); const s = room.allies.get(n);
    if (!s) return sock.emit('toast', 'Альянс не найден'); if (s.size >= CONFIG.ALLY_MAX) return sock.emit('toast', 'Альянс заполнен');
    room.leaveAlly(p); s.add(p.id); p.ally = n; sock.emit('toast', `Вы вступили в «${n}»`);
  });
  sock.on('ally:leave', () => p && room.leaveAlly(p));
  sock.on('disconnect', () => { if (p) { io.to(room.id).emit('chat', { n: '*', t: `${p.name} вышел` }); room.removePlayer(p); } });
});

server.listen(CONFIG.PORT, () => console.log('Cubee .io server: http://localhost:' + CONFIG.PORT));
