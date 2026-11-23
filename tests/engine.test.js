// Lance avec : node tests/engine.test.js
const assert = require('assert');
const queue = [];
global.setTimeout = f => queue.push(f);
const E = require('../js/engine.js');

const RK = '23456789TJQKA';
const C = s => s.split(' ').map(x => RK.indexOf(x[0]) * 4 + 'shdc'.indexOf(x[1]));
const name = s => E.describe(E.evalHand(C(s)));

assert.strictEqual(name('As Ks Qs Js Ts 2d 3c'), 'Quinte flush royale');
assert.strictEqual(name('5h 4d 3c 2s Ad Kd Kh'), 'Suite au 5');
assert.strictEqual(name('Kh Kd Ks 9c 9d 2s 3s'), 'Full aux Rois par les 9');
assert.ok(E.evalHand(C('6h 5d 4c 3s 2d')) > E.evalHand(C('5h 4d 3c 2s Ad')));
assert.strictEqual(E.outs(C('Ah Kh'), C('2h 7h Qc')).n, 15);

const aa = E.equity(C('As Ah'), [], 3, 20000).eq;
assert.ok(aa > 0.6 && aa < 0.67, 'AA contre 3 : ' + aa);

// 20 parties complètes entre bots : aucun jeton ne doit se perdre.
const G = E.G; G.autoHuman = true;
G.onEnd = () => {
  const total = G.players.reduce((s, p) => s + p.chips, 0);
  assert.strictEqual(total, 4000);
  queue.push(() => E.startHand());
};
for (let g = 0; g < 20; g++) {
  E.newGame({ stack: 1000 });
  let n = 0;
  while (queue.length && n < 1e6 && !G.gameOver) { queue.shift()(); n++; }
  queue.length = 0;
}
console.log('Tous les tests passent ✔');
