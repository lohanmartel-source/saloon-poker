/* Saloon Poker — moteur : évaluation des mains, équité Monte Carlo, conseils et partie de Texas Hold'em.
   Aucune dépendance au DOM : le fichier tourne aussi sous Node pour les tests. */

const RD = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R', 'A'];
const SU = ['♠', '♥', '♦', '♣'];
const RNAME = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'Valets', 'Dames', 'Rois', 'As'];
const RONE = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'Valet', 'Dame', 'Roi', 'As'];
const CATS = ['Carte haute', 'Paire', 'Double paire', 'Brelan', 'Suite', 'Couleur', 'Full', 'Carré', 'Quinte flush'];
const B5 = 1048576; // 16^5

/* Une carte = entier 0..51 : rang = c >> 2 (0 = 2, 12 = As), couleur = c & 3 (♠ ♥ ♦ ♣). */
const isRed = c => (c & 3) === 1 || (c & 3) === 2;

function enc(cat, a) {
  let v = cat;
  for (let i = 0; i < 5; i++) v = v * 16 + (a[i] === undefined ? 0 : a[i] + 1);
  return v;
}
function straightHigh(mask) {
  const m = (mask << 1) | ((mask >> 12) & 1); // bit 0 = As bas
  for (let h = 13; h >= 4; h--) if (((m >> (h - 4)) & 31) === 31) return h;
  return -1;
}
function topR(rc, n, ex) {
  const o = [];
  for (let r = 12; r >= 0 && o.length < n; r--) if (rc[r] > 0 && ex.indexOf(r) < 0) o.push(r);
  return o;
}

/* Évalue 5 à 7 cartes. Plus le score est haut, meilleure est la main. */
function evalHand(cs) {
  const rc = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], sc = [0, 0, 0, 0], sm = [0, 0, 0, 0];
  let mask = 0;
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i], r = c >> 2, s = c & 3;
    rc[r]++; sc[s]++; sm[s] |= 1 << r; mask |= 1 << r;
  }
  for (let s = 0; s < 4; s++) if (sc[s] >= 5) {
    const sh = straightHigh(sm[s]);
    if (sh >= 0) return enc(8, [sh]);
    const t = [];
    for (let r = 12; r >= 0 && t.length < 5; r--) if (sm[s] >> r & 1) t.push(r);
    return enc(5, t);
  }
  let quad = -1; const tr = [], pr = [];
  for (let r = 12; r >= 0; r--) {
    if (rc[r] === 4) quad = r; else if (rc[r] === 3) tr.push(r); else if (rc[r] === 2) pr.push(r);
  }
  if (quad >= 0) return enc(7, [quad].concat(topR(rc, 1, [quad])));
  if (tr.length >= 2) return enc(6, [tr[0], tr[1]]);
  if (tr.length && pr.length) return enc(6, [tr[0], pr[0]]);
  const sh = straightHigh(mask);
  if (sh >= 0) return enc(4, [sh]);
  if (tr.length) return enc(3, [tr[0]].concat(topR(rc, 2, [tr[0]])));
  if (pr.length >= 2) return enc(2, [pr[0], pr[1]].concat(topR(rc, 1, [pr[0], pr[1]])));
  if (pr.length) return enc(1, [pr[0]].concat(topR(rc, 3, [pr[0]])));
  return enc(0, topR(rc, 5, []));
}
const catOf = s => Math.floor(s / B5);
const de = r => r === 12 ? "d'As" : 'de ' + RNAME[r];

function describe(s) {
  const c = catOf(s), a = Math.floor(s / 65536) % 16 - 1, b = Math.floor(s / 4096) % 16 - 1;
  switch (c) {
    case 0: return 'Carte haute ' + RONE[a];
    case 1: return 'Paire ' + de(a);
    case 2: return 'Double paire ' + RNAME[a] + ' et ' + RNAME[b];
    case 3: return 'Brelan ' + de(a);
    case 4: return 'Suite au ' + RONE[a - 1];
    case 5: return 'Couleur (' + RONE[a] + ' haut)';
    case 6: return 'Full aux ' + RNAME[a] + ' par les ' + RNAME[b];
    case 7: return 'Carré ' + de(a);
    case 8: return a === 13 ? 'Quinte flush royale' : 'Quinte flush au ' + RONE[a - 1];
  }
}

/* Équité Monte Carlo contre nOpp mains aléatoires. */
function equity(hole, board, nOpp, iters) {
  const used = new Set(hole.concat(board)), deck = [];
  for (let c = 0; c < 52; c++) if (!used.has(c)) deck.push(c);
  const need = 5 - board.length, k = need + 2 * nOpp;
  let win = 0, tie = 0, eq = 0;
  const cats = [0, 0, 0, 0, 0, 0, 0, 0, 0], h = new Array(7), o = new Array(7);
  for (let it = 0; it < iters; it++) {
    for (let j = 0; j < k; j++) {
      const r = j + Math.floor(Math.random() * (deck.length - j));
      const t = deck[j]; deck[j] = deck[r]; deck[r] = t;
    }
    h[0] = hole[0]; h[1] = hole[1];
    for (let j = 0; j < board.length; j++) h[2 + j] = board[j];
    for (let j = 0; j < need; j++) h[2 + board.length + j] = deck[j];
    const hs = evalHand(h); cats[catOf(hs)]++;
    for (let j = 2; j < 7; j++) o[j] = h[j];
    let beaten = false, ties = 0;
    for (let q = 0; q < nOpp; q++) {
      o[0] = deck[need + 2 * q]; o[1] = deck[need + 2 * q + 1];
      const os = evalHand(o);
      if (os > hs) { beaten = true; break; }
      if (os === hs) ties++;
    }
    if (!beaten) { if (ties === 0) { win++; eq += 1; } else { tie++; eq += 1 / (ties + 1); } }
  }
  return { eq: eq / iters, win: win / iters, tie: tie / iters, cats: cats.map(c => c / iters) };
}

/* Outs : cartes qui font monter TA main de catégorie (pas seulement la table). */
function outs(hole, board) {
  if (board.length < 3 || board.length > 4) return null;
  const cur = catOf(evalHand(hole.concat(board)));
  const used = new Set(hole.concat(board));
  let n = 0;
  for (let c = 0; c < 52; c++) {
    if (used.has(c)) continue;
    const mine = catOf(evalHand(hole.concat(board, [c])));
    const tbl = catOf(evalHand(board.concat([c])));
    if (mine > cur && mine > tbl) n++;
  }
  const left = 52 - used.size;
  const p = board.length === 3 ? 1 - (1 - n / left) * (1 - n / (left - 1)) : n / left;
  return { n, p };
}

const pc = x => Math.round(x * 100) + '%';

function tier(eq, nOpp) {
  const r = eq * (nOpp + 1);
  if (r >= 1.9) return 'Premium';
  if (r >= 1.45) return 'Forte';
  if (r >= 1.1) return 'Jouable';
  if (r >= 0.9) return 'Marginale';
  return 'Faible';
}

function advise(r, nOpp, pot, toCall, street) {
  const fair = 1 / (nOpp + 1), eq = r.eq;
  const sz = f => pot > 0 ? ' (~' + Math.round((pot + toCall) * f) + ')' : '';
  if (toCall > 0) {
    const po = toCall / (pot + toCall);
    if (eq >= Math.max(po + 0.2, fair * 2)) return { t: 'RELANCER', c: 'raise', po, why: 'Ton équité (' + pc(eq) + ') dépasse largement la cote du pot (' + pc(po) + '). Relance d\'environ ¾ du pot' + sz(0.75) + '.' };
    if (eq >= po) return { t: 'SUIVRE', c: 'call', po, why: 'Équité ' + pc(eq) + ' ≥ cote du pot ' + pc(po) + ' : suivre est rentable à long terme.' };
    if (eq >= po * 0.85 && street < 3) return { t: 'SUIVRE (limite)', c: 'call', po, why: 'Un peu court (' + pc(eq) + ' pour ' + pc(po) + ' requis). Jouable seulement si la mise est petite.' };
    return { t: 'SE COUCHER', c: 'fold', po, why: 'Il te faut ' + pc(po) + ' d\'équité pour suivre, tu n\'as que ' + pc(eq) + '.' };
  }
  if (eq >= Math.max(0.55, fair * 1.8)) return { t: 'MISER', c: 'raise', why: 'Main forte (' + pc(eq) + ' vs moyenne ' + pc(fair) + '). Mise ' + (eq > 0.75 ? '¾' : '½') + ' du pot' + sz(eq > 0.75 ? 0.75 : 0.5) + ' pour faire payer.' };
  if (eq >= fair * 1.25) return { t: 'PETITE MISE', c: 'call', why: 'Au-dessus de la moyenne (' + pc(eq) + ' vs ' + pc(fair) + '). Mise ⅓ du pot' + sz(0.33) + ' ou check.' };
  return { t: 'CHECK', c: 'check', why: 'Main sous la moyenne de la table (' + pc(eq) + ' vs ' + pc(fair) + '). Check, et lâche si ça mise fort.' };
}

function shuffled() {
  const d = [];
  for (let c = 0; c < 52; c++) d.push(c);
  for (let i = 51; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}

/* ---------- Partie ---------- */
const BOTS = [
  { name: 'Cole Barrett', aggr: 0.6, bluff: 0.10, style: 'Agressif' },
  { name: 'Ma Hollis', aggr: 0.3, bluff: 0.04, style: 'Prudente' },
  { name: 'Doc Weller', aggr: 0.8, bluff: 0.16, style: 'Bluffeur' }
];
const G = {
  players: [], dealer: 0, board: [], deck: [], street: 0, curBet: 0, minRaise: 20, toAct: -1,
  handOver: true, sb: 10, bb: 20, handNo: 0, token: 0, msg: '', logs: [], gameOver: false,
  delay: 750, blindsUp: true, result: null, ui: () => {}, onEnd: null, autoHuman: false
};
function log(s) { G.logs.unshift(s); if (G.logs.length > 60) G.logs.pop(); }

function newGame(opts = {}) {
  const stack = opts.stack || 1000;
  G.players = [{ name: opts.name || 'Toi', chips: stack, human: true }]
    .concat(BOTS.map(b => Object.assign({ chips: stack }, b)));
  G.dealer = Math.floor(Math.random() * 4);
  G.handNo = 0; G.sb = Math.max(5, Math.round(stack / 100)); G.bb = G.sb * 2;
  G.gameOver = false; G.logs = []; G.result = null;
  startHand();
}
const canAct = p => !p.out && !p.folded && !p.allIn;
const inHand = p => !p.out && !p.folded;
function nextSeat(i, pred) {
  const n = G.players.length;
  for (let k = 1; k <= n; k++) { const j = (i + k) % n; if (pred(G.players[j])) return j; }
  return -1;
}
const potTotal = () => G.players.reduce((s, p) => s + (p.contrib || 0), 0);
function post(i, amt) {
  const p = G.players[i], a = Math.min(amt, p.chips);
  p.chips -= a; p.bet += a; p.contrib += a;
  if (p.chips === 0) p.allIn = true;
  return a;
}

function startHand() {
  G.token++; G.result = null;
  G.players.forEach(p => {
    p.out = p.chips <= 0; p.folded = p.out; p.allIn = false; p.bet = 0; p.contrib = 0;
    p.hole = []; p.needAct = false; p.lastAct = p.out ? 'Ruiné' : ''; p.show = false; p.winner = false;
  });
  const alive = G.players.filter(p => !p.out);
  if (G.players[0].out) { G.gameOver = true; G.handOver = true; G.msg = 'Tu es ruiné, cowboy.'; G.ui(); return; }
  if (alive.length === 1) { G.gameOver = true; G.handOver = true; G.msg = 'Tu as plumé tout le saloon !'; G.ui(); return; }
  G.handNo++;
  if (G.blindsUp && G.handNo > 1 && (G.handNo - 1) % 10 === 0) { G.sb *= 2; G.bb *= 2; log('Les blindes montent : ' + G.sb + '/' + G.bb); }
  G.dealer = nextSeat(G.dealer, p => !p.out);
  G.deck = shuffled(); G.board = []; G.street = 0; G.handOver = false; G.msg = '';
  for (let r = 0; r < 2; r++) G.players.forEach(p => { if (!p.out) p.hole.push(G.deck.pop()); });
  let sbI, bbI;
  if (alive.length === 2) { sbI = G.dealer; bbI = nextSeat(sbI, p => !p.out); }
  else { sbI = nextSeat(G.dealer, p => !p.out); bbI = nextSeat(sbI, p => !p.out); }
  post(sbI, G.sb); G.players[sbI].lastAct = 'Petite blinde';
  post(bbI, G.bb); G.players[bbI].lastAct = 'Grosse blinde';
  G.curBet = G.bb; G.minRaise = G.bb;
  G.players.forEach(p => p.needAct = canAct(p));
  log('— Main #' + G.handNo + ' —');
  G.toAct = nextSeat(bbI, canAct);
  if (G.toAct < 0) { runout(); return; }
  G.ui(); loop();
}

function act(i, type, raiseTo) {
  if (G.handOver || i !== G.toAct) return;
  const p = G.players[i], toCall = G.curBet - p.bet;
  if (type === 'raise') { raiseTo = Math.min(raiseTo, p.bet + p.chips); if (raiseTo <= G.curBet) type = 'call'; }
  if (type === 'fold') { if (toCall <= 0) type = 'call'; else { p.folded = true; p.lastAct = 'Couché'; } }
  if (type === 'call') {
    if (toCall <= 0) p.lastAct = 'Check';
    else { const a = post(i, toCall); p.lastAct = p.allIn ? 'Tapis (' + a + ')' : 'Suit ' + a; }
  } else if (type === 'raise') {
    const wasOpen = G.curBet === 0, inc = raiseTo - G.curBet;
    if (inc >= G.minRaise) G.minRaise = inc;
    post(i, raiseTo - p.bet); G.curBet = raiseTo;
    G.players.forEach((q, j) => { if (j !== i && canAct(q)) q.needAct = true; });
    p.lastAct = p.allIn ? 'Tapis (' + raiseTo + ')' : (wasOpen ? 'Mise ' : 'Relance à ') + raiseTo;
  }
  p.needAct = false; p.lastType = type;
  log(p.name + ' : ' + p.lastAct);
  if (G.onAct) G.onAct(i, type);
  advance();
}
function advance() {
  if (G.players.filter(inHand).length === 1) return foldWin();
  const nx = nextSeat(G.toAct, p => canAct(p) && p.needAct);
  if (nx >= 0) { G.toAct = nx; G.ui(); loop(); return; }
  nextStreet();
}
function nextStreet() {
  G.players.forEach(p => p.bet = 0); G.curBet = 0; G.minRaise = G.bb;
  if (G.street === 3) return showdown();
  G.street++;
  if (G.street === 1) G.board.push(G.deck.pop(), G.deck.pop(), G.deck.pop()); else G.board.push(G.deck.pop());
  if (G.players.filter(canAct).length <= 1) { runout(); return; }
  G.players.forEach(p => { p.needAct = canAct(p); if (canAct(p)) p.lastAct = ''; });
  G.toAct = nextSeat(G.dealer, canAct); G.ui(); loop();
}
function runout() {
  G.toAct = -1;
  G.players.forEach(p => { if (inHand(p)) p.show = true; });
  G.ui();
  const t = G.token;
  setTimeout(() => { if (t === G.token) nextStreet(); }, G.delay * 1.3);
}
function foldWin() {
  const w = G.players.find(inHand), P = potTotal();
  w.chips += P; w.winner = true;
  G.result = { winners: [{ p: w, amt: P }], pot: P, showdown: false };
  G.msg = w.name + ' ramasse ' + P; log(G.msg + ' (tout le monde s\'est couché)');
  endHand();
}
function showdown() {
  const live = G.players.filter(inHand);
  live.forEach(p => { p.score = evalHand(p.hole.concat(G.board)); p.show = true; });
  const lv = [...new Set(G.players.map(p => p.contrib).filter(c => c > 0))].sort((a, b) => a - b);
  const won = new Map(); let prev = 0;
  for (const L of lv) {
    let amt = 0;
    G.players.forEach(p => amt += Math.max(0, Math.min(p.contrib, L) - prev));
    let el = live.filter(p => p.contrib >= L); if (!el.length) el = live;
    const best = Math.max(...el.map(p => p.score)), w = el.filter(p => p.score === best);
    const sh = Math.floor(amt / w.length);
    w.forEach((p, k) => { const g = sh + (k === 0 ? amt - sh * w.length : 0); p.chips += g; won.set(p, (won.get(p) || 0) + g); });
    prev = L;
  }
  live.forEach(p => { p.winner = won.has(p); p.lastAct = describe(p.score); });
  G.result = { winners: [...won].map(([p, amt]) => ({ p, amt })), pot: potTotal(), showdown: true };
  G.msg = G.result.winners.map(w => w.p.name + ' gagne ' + w.amt + ' — ' + describe(w.p.score)).join(' · ');
  log(G.msg); endHand();
}
function endHand() { G.handOver = true; G.toAct = -1; G.ui(); if (G.onEnd) G.onEnd(); }
function loop() {
  if (G.handOver || G.toAct < 0) return;
  const p = G.players[G.toAct];
  if (p.human && !G.autoHuman) return;
  const i = G.toAct, t = G.token;
  setTimeout(() => { if (t === G.token && G.toAct === i && !G.handOver) botAct(i); }, G.delay);
}
function botAct(i) {
  const p = G.players[i], opps = G.players.filter(q => inHand(q) && q !== p).length;
  const eq = equity(p.hole, G.board, opps, 400).eq + (Math.random() - 0.5) * 0.08;
  const toCall = G.curBet - p.bet, P = potTotal(), fair = 1 / (opps + 1), r = Math.random(), maxTo = p.bet + p.chips;
  const aggr = p.aggr ?? 0.5, bluff = p.bluff ?? 0.08;
  const size = f => Math.min(maxTo, Math.max(G.curBet + G.minRaise, Math.round((G.curBet + (P + toCall) * f) / G.sb) * G.sb));
  if (toCall <= 0) {
    if ((eq > fair * 1.6 && r < aggr + 0.35) || r < bluff) return act(i, 'raise', size(eq > 0.75 ? 0.75 : 0.5));
    return act(i, 'call');
  }
  const po = toCall / (P + toCall);
  if (eq > Math.max(po + 0.18, fair * 2) && r < aggr) return act(i, 'raise', size(0.7));
  if (eq >= po - 0.03 || r < bluff * 0.5) return act(i, 'call');
  return act(i, 'fold');
}

if (typeof module !== 'undefined') {
  module.exports = { RD, SU, CATS, evalHand, describe, equity, outs, advise, tier, catOf, G, newGame, startHand, act, potTotal };
}
