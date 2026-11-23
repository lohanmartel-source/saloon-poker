/* Saloon Poker — interface (conseiller + table). Dépend de js/engine.js. */
(() => {
  const $ = id => document.getElementById(id);

  /* ---------- Stockage local (réglages + carnet) ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('saloonPoker.' + k); return v ? Object.assign({}, d, JSON.parse(v)) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('saloonPoker.' + k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } }
  };
  const S = store.get('settings', { name: '', stack: 1000, delay: 750, autoAdv: true, blindsUp: true, sound: true });
  const STATS0 = { hands: 0, won: 0, biggest: 0, best: 0, games: 0, gamesWon: 0 };
  let ST = store.get('stats', STATS0);

  /* ---------- Sons (WebAudio, aucun fichier) ---------- */
  let ac = null;
  document.addEventListener('pointerdown', () => {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
  }, { once: true });
  function sfx(kind) {
    if (!S.sound || !ac) return;
    try {
      const t = ac.currentTime;
      if (kind === 'win') {
        [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.09, 0.18, 'triangle', 0.12));
        return;
      }
      const len = kind === 'chip' ? 0.06 : 0.03;
      const buf = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      f.type = 'bandpass'; f.frequency.value = kind === 'chip' ? 3200 : 1800;
      g.gain.value = kind === 'chip' ? 0.5 : 0.35;
      src.buffer = buf; src.connect(f); f.connect(g); g.connect(ac.destination); src.start(t);
    } catch (e) { /* audio refusé */ }
  }
  function tone(freq, at, dur, type, vol) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g); g.connect(ac.destination); o.start(at); o.stop(at + dur);
  }

  /* ---------- Cartes ---------- */
  function cardH(c, extra = '') {
    if (c == null) return '';
    const r = RD[c >> 2], s = SU[c & 3];
    return '<div class="card' + (isRed(c) ? ' red' : '') + (extra ? ' ' + extra : '') + '">' +
      '<span class="ci">' + r + '<small>' + s + '</small></span><span class="cc">' + s + '</span></div>';
  }
  const backH = (extra = '') => '<div class="card back' + (extra ? ' ' + extra : '') + '"></div>';

  /* ---------- Onglets ---------- */
  function showTab(tab) {
    document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x.dataset.tab === tab));
    $('adv').hidden = tab !== 'adv'; $('play').hidden = tab !== 'play';
    document.body.classList.toggle('playing', tab === 'play');
    if (tab === 'play' && !G.players.length) startGame();
    else if (tab === 'play') renderTable();
    try { history.replaceState(null, '', tab === 'play' ? '#jouer' : '#conseiller'); } catch (e) { /* ignoré */ }
  }
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));

  /* =====================================================
     CONSEILLER
     ===================================================== */
  const A = { hole: [null, null], board: [null, null, null, null, null], opp: 3, order: [] };
  const LBL = ['Flop', 'Flop', 'Flop', 'Turn', 'River'];

  function renderAdv() {
    const all = A.hole.concat(A.board), next = all.indexOf(null);
    const slot = (c, k, i, label, idx) => '<button class="slot' + (c != null ? ' filled' : '') + (idx === next ? ' next' : '') +
      '" data-k="' + k + '" data-i="' + i + '">' + (c == null ? label : cardH(c)) + '</button>';
    $('hole').innerHTML = A.hole.map((c, i) => slot(c, 'hole', i, 'Carte ' + (i + 1), i)).join('');
    $('board').innerHTML = A.board.map((c, i) => slot(c, 'board', i, LBL[i], i + 2)).join('');
    document.querySelectorAll('#hole .slot, #board .slot').forEach(s => s.onclick = () => {
      const arr = A[s.dataset.k], i = +s.dataset.i;
      if (arr[i] == null) return;
      A.order = A.order.filter(c => c !== arr[i]); arr[i] = null;
      renderAdv(); schedule();
    });
    const used = new Set(all.filter(c => c != null));
    let h = '';
    for (let s = 0; s < 4; s++) {
      h += '<div class="prow">';
      for (let r = 12; r >= 0; r--) {
        const c = r * 4 + s;
        h += '<button class="' + (isRed(c) ? 'red' : '') + '" data-c="' + c + '"' + (used.has(c) ? ' disabled' : '') +
          ' aria-label="' + RD[r] + SU[s] + '">' + RD[r] + '<small>' + SU[s] + '</small></button>';
      }
      h += '</div>';
    }
    $('picker').innerHTML = h;
    document.querySelectorAll('#picker button').forEach(b => b.onclick = () => {
      const c = +b.dataset.c;
      let i = A.hole.indexOf(null);
      if (i >= 0) A.hole[i] = c;
      else { i = A.board.indexOf(null); if (i < 0) return; A.board[i] = c; }
      A.order.push(c); sfx('card');
      renderAdv(); schedule();
    });
    $('oppN').textContent = A.opp;
  }

  let tmr;
  function schedule() { clearTimeout(tmr); tmr = setTimeout(analyze, 40); }

  function analyze() {
    const res = $('res');
    if (A.hole.includes(null)) {
      res.innerHTML = '<div class="empty">Touche tes 2 cartes ci-dessus.<br>Ajoute le flop, la turn et la river au fil de la main.</div>';
      return;
    }
    const board = A.board.filter(c => c != null);
    const street = board.length >= 5 ? 3 : board.length >= 4 ? 2 : board.length >= 3 ? 1 : 0;
    const pot = Math.max(0, +$('pot').value || 0), call = Math.max(0, +$('call').value || 0);
    const r = equity(A.hole, board, A.opp, 14000);
    const a = advise(r, A.opp, pot, call, street);
    const pair = (A.hole[0] >> 2) === (A.hole[1] >> 2);
    const suited = (A.hole[0] & 3) === (A.hole[1] & 3);
    const cur = board.length >= 3 ? describe(evalHand(A.hole.concat(board)))
      : pair ? 'Paire servie ' + ('de ' + RD[A.hole[0] >> 2]) : (suited ? 'Assorties' : 'Dépareillées');
    const o = outs(A.hole, board);
    const fair = 1 / (A.opp + 1);

    let dist = '';
    if (street < 3) {
      const rows = r.cats.map((p, i) => ({ p, i })).filter(x => x.p >= 0.005).reverse();
      dist = '<div class="dist"><div class="lbl">Chances de finir avec</div>' + rows.map(x =>
        '<div class="d"><span>' + CATS[x.i] + '</span><span class="dbar"><i style="width:' + Math.min(100, x.p * 100) + '%"></i></span><span>' +
        (x.p * 100).toFixed(1) + '%</span></div>').join('') + '</div>';
    }
    res.innerHTML =
      '<span class="stamp ' + a.c + '">' + a.t + '</span>' +
      '<p class="why">' + a.why + '</p>' +
      '<div class="gauge"><div style="width:' + (r.eq * 100).toFixed(1) + '%"></div>' +
      (a.po ? '<i style="left:' + (a.po * 100).toFixed(1) + '%"></i>' : '') + '</div>' +
      '<div class="gauge-l"><span>Équité ' + pc(r.eq) + '</span>' + (a.po ? '<span style="color:var(--red)">Cote du pot ' + pc(a.po) + '</span>' : '<span>Moyenne ' + pc(fair) + '</span>') + '</div>' +
      '<div class="kv">' +
      '<div>Gagne<b>' + (r.win * 100).toFixed(1) + '%</b></div>' +
      '<div>Égalité<b>' + (r.tie * 100).toFixed(1) + '%</b></div>' +
      '<div>Force<b>' + tier(r.eq, A.opp) + '</b></div>' +
      '<div class="wide">Main actuelle<b>' + cur + '</b></div>' +
      (o ? '<div class="wide">Cartes qui t\'améliorent<b>' + o.n + ' outs · ' + pc(o.p) + (street === 1 ? ' d\'ici la river' : ' à la river') + '</b></div>' : '') +
      '</div>' + dist +
      (board.length && board.length < 3 ? '<div class="warn">Le flop compte 3 cartes.</div>' : '');
  }

  $('oppM').onclick = () => { A.opp = Math.max(1, A.opp - 1); renderAdv(); schedule(); };
  $('oppP').onclick = () => { A.opp = Math.min(7, A.opp + 1); renderAdv(); schedule(); };
  $('pot').oninput = schedule; $('call').oninput = schedule;
  $('undo').onclick = () => {
    const c = A.order.pop(); if (c == null) return;
    let i = A.board.indexOf(c); if (i >= 0) A.board[i] = null; else { i = A.hole.indexOf(c); if (i >= 0) A.hole[i] = null; }
    renderAdv(); schedule();
  };
  $('clr').onclick = () => {
    A.hole = [null, null]; A.board = [null, null, null, null, null]; A.order = [];
    $('pot').value = 0; $('call').value = 0; renderAdv(); analyze();
  };

  /* =====================================================
     TABLE
     ===================================================== */
  let seen = new Set(), seenTok = -1, lastBoard = 0, wasOver = false;

  function applySettings() {
    G.delay = +S.delay; G.blindsUp = !!S.blindsUp;
    if (G.players[0]) G.players[0].name = S.name || 'Toi';
  }
  function startGame() {
    applySettings();
    newGame({ name: S.name || 'Toi', stack: +S.stack });
  }

  function anim(key, cls) {
    if (seen.has(key)) return '';
    seen.add(key); return cls;
  }

  function seatH(p, i) {
    const me = i === 0;
    const cls = ['seat'];
    if (me) cls.push('me');
    if (i === G.toAct) cls.push('act');
    if (p.out) cls.push('out'); else if (p.folded) cls.push('fold');
    if (G.handOver && p.winner) cls.push('win');
    let cards = '';
    if (!p.out) {
      cards = p.hole.map((c, k) => {
        if (me || p.show) return cardH(c, anim((me ? 'm' : 'r' + i) + c, me ? 'deal' : 'flip'));
        return backH(anim('b' + i + k, 'deal'));
      }).join('');
    }
    const bet = p.bet ? '<div class="bet"><span class="chip"></span>' + p.bet + '</div>' : '';
    const dealer = i === G.dealer && !p.out ? '<div class="dbtn">D</div>' : '';
    const la = '<div class="la ' + (p.lastAct ? anim('L' + i + G.street + p.lastAct, 'bubble') : '') + '">' + esc(p.lastAct || '') + '</div>';
    if (me) {
      let hand = '';
      if (!p.out && p.hole.length) {
        hand = G.board.length >= 3 ? describe(evalHand(p.hole.concat(G.board)))
          : ((p.hole[0] >> 2) === (p.hole[1] >> 2) ? 'Paire servie' : '');
      }
      return '<div class="' + cls.join(' ') + '">' + dealer +
        '<div class="cs">' + cards + '</div>' +
        '<div><div class="nm">' + esc(p.name) + '</div><div class="stack"><span class="chip"></span>' + p.chips + '</div>' +
        '<div class="hand">' + hand + '</div>' + (p.lastAct === hand ? '' : la) + '</div>' + bet + '</div>';
    }
    return '<div class="' + cls.join(' ') + '">' + dealer +
      '<div class="nm">' + esc(p.name) + '</div><div class="st">' + (p.style || '') + '</div>' +
      '<div class="stack"><span class="chip"></span>' + p.chips + '</div>' +
      '<div class="cs">' + cards + '</div>' + la + bet + '</div>';
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function renderTable() {
    if (!G.players.length) return;
    if (seenTok !== G.token) { seen = new Set(); seenTok = G.token; lastBoard = 0; }
    if (G.board.length > lastBoard) { sfx('card'); lastBoard = G.board.length; }
    const P = G.players;
    $('info').textContent = 'Main #' + G.handNo + ' · Blindes ' + G.sb + '/' + G.bb;
    $('opps').innerHTML = P.slice(1).map((p, k) => seatH(p, k + 1)).join('');
    $('meSeat').innerHTML = seatH(P[0], 0);
    $('potv').textContent = potTotal();
    $('pboard').innerHTML = [0, 1, 2, 3, 4].map(i => G.board[i] != null
      ? cardH(G.board[i], anim('B' + G.board[i], 'deal')) : '<div class="slot"></div>').join('');
    const msg = $('msg');
    msg.className = 'msg' + (G.handOver && G.result ? ' win' : '');
    msg.textContent = G.msg || (G.toAct > 0 ? P[G.toAct].name + ' réfléchit…' : '');
    $('log').innerHTML = G.logs.map(esc).join('<br>');
    renderCtrl();
  }
  G.ui = () => { if (!$('play').hidden) renderTable(); };
  G.onAct = (i, type) => { if (type !== 'fold') sfx('chip'); };
  G.onEnd = () => {
    const me = G.players[0], res = G.result;
    if (!me.out) {
      ST.hands++;
      const w = res && res.winners.find(x => x.p === me);
      if (w) { ST.won++; ST.biggest = Math.max(ST.biggest, w.amt); sfx('win'); }
      if (res && res.showdown && !me.folded && me.score > ST.best) ST.best = me.score;
      store.set('stats', ST);
    }
  };

  function renderCtrl() {
    const c = $('ctrl'), me = G.players[0];
    $('advBox').innerHTML = '';
    if (G.gameOver && !wasOver) {
      wasOver = true; ST.games++; if (!me.out) ST.gamesWon++; store.set('stats', ST);
    }
    if (G.handOver) {
      c.innerHTML = '<button class="btn brass" id="nx">' + (G.gameOver ? 'Nouvelle partie' : 'Main suivante') + '</button>';
      $('nx').onclick = () => { if (G.gameOver) { wasOver = false; startGame(); } else startHand(); };
      return;
    }
    if (G.toAct !== 0) {
      const who = G.toAct > 0 ? G.players[G.toAct].name + ' réfléchit…' : 'On retourne les cartes…';
      c.innerHTML = '<div class="wait">' + (me.folded ? 'Tu es couché · ' : '') + esc(who) + '</div>';
      return;
    }
    const toCall = G.curBet - me.bet, maxTo = me.bet + me.chips, P = potTotal();
    const minTo = Math.min(maxTo, G.curBet + G.minRaise), canRaise = maxTo > G.curBet;
    const callLbl = toCall <= 0 ? 'Check' : (toCall >= me.chips ? 'Tapis ' + me.chips : 'Suivre ' + toCall);
    const rl = G.curBet === 0 ? 'Miser' : 'Relancer';
    c.innerHTML = '<div id="tipSlot"></div>' +
      '<div class="r"><button class="btn fold" id="bF"' + (toCall <= 0 ? ' disabled' : '') + '>Coucher</button>' +
      '<button class="btn call" id="bC">' + callLbl + '</button>' +
      '<button class="btn tip" id="bA" aria-label="Conseil">💡</button></div>' +
      (canRaise ?
        '<div class="raise-box"><input type="range" id="rg" min="' + minTo + '" max="' + maxTo + '" step="' + G.sb + '" value="' + minTo + '">' +
        '<button class="btn raise" id="bR"></button></div>' +
        '<div class="qk"><button data-f=".33">⅓ pot</button><button data-f=".5">½ pot</button><button data-f="1">Pot</button><button data-f="all">Tapis</button></div>' : '');
    $('bF').onclick = () => act(0, 'fold');
    $('bC').onclick = () => act(0, 'call');
    $('bA').onclick = showTip;
    if (canRaise) {
      const rg = $('rg'), bR = $('bR');
      const upd = () => bR.textContent = (+rg.value >= maxTo ? 'Tapis ' : rl + ' ') + rg.value;
      rg.oninput = upd; upd();
      document.querySelectorAll('.qk button').forEach(b => b.onclick = () => {
        const f = b.dataset.f;
        const v = f === 'all' ? maxTo : Math.round((G.curBet + (P + toCall) * (+f)) / G.sb) * G.sb;
        rg.value = Math.max(minTo, Math.min(maxTo, v)); upd();
      });
      bR.onclick = () => act(0, 'raise', +rg.value);
    }
    if (S.autoAdv) showTip();
  }

  function showTip() {
    const me = G.players[0], opps = G.players.filter(q => !q.out && !q.folded && q !== me).length;
    const r = equity(me.hole, G.board, opps, 6000), toCall = G.curBet - me.bet;
    const a = advise(r, opps, potTotal(), toCall, G.street);
    const box = $('tipSlot') || $('advBox');
    box.innerHTML = '<div class="parchment tipbox"><span class="stamp ' + a.c + '">' + a.t + '</span>' +
      '<p class="why">' + a.why + '</p><div class="sm">Équité ' + pc(r.eq) + ' contre ' + opps + ' adv. · ' + tier(r.eq, opps) + '</div></div>';
  }

  /* ---------- Réglages ---------- */
  function fillSettings() {
    $('sName').value = S.name; $('sStack').value = String(S.stack); $('sSpeed').value = String(S.delay);
    $('sAdv').checked = S.autoAdv; $('sBlinds').checked = S.blindsUp; $('sSound').checked = S.sound;
    const pct = ST.hands ? Math.round(ST.won / ST.hands * 100) + '%' : '—';
    $('statsBox').innerHTML =
      '<div>Mains jouées<b>' + ST.hands + '</b></div><div>Mains gagnées<b>' + ST.won + ' (' + pct + ')</b></div>' +
      '<div>Plus gros pot<b>' + ST.biggest + '</b></div><div>Meilleure main<b>' + (ST.best ? describe(ST.best) : '—') + '</b></div>' +
      '<div>Parties<b>' + ST.games + '</b></div><div>Saloons plumés<b>' + ST.gamesWon + '</b></div>';
  }
  function saveSettings() {
    S.name = $('sName').value.trim(); S.stack = +$('sStack').value; S.delay = +$('sSpeed').value;
    S.autoAdv = $('sAdv').checked; S.blindsUp = $('sBlinds').checked; S.sound = $('sSound').checked;
    store.set('settings', S); applySettings(); renderTable();
  }
  ['sName', 'sStack', 'sSpeed', 'sAdv', 'sBlinds', 'sSound'].forEach(id => $(id).addEventListener('change', saveSettings));
  $('sName').addEventListener('input', saveSettings);
  $('openSet').onclick = () => { fillSettings(); $('setModal').hidden = false; };
  $('closeSet').onclick = () => { $('setModal').hidden = true; };
  $('setModal').onclick = e => { if (e.target.id === 'setModal') $('setModal').hidden = true; };
  $('resetStats').onclick = () => { ST = Object.assign({}, STATS0); store.set('stats', ST); fillSettings(); };
  $('restart').onclick = () => { $('setModal').hidden = true; wasOver = false; startGame(); };

  /* ---------- Démarrage ---------- */
  renderAdv(); analyze();
  if (location.hash === '#jouer') showTab('play');
})();
