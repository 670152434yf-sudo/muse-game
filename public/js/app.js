(() => {
  const socket = io();
  let myId = null;
  let currentState = null;
  let countdownTimer = null;
  let prevState = null; // 用于检测状态变化触发动画

  const $ = id => document.getElementById(id);
  const lobby = $('lobby');
  const room = $('room');
  const table = $('table');

  function showScreen(name) {
    [lobby, room, table].forEach(s => s.classList.remove('active'));
    $(name).classList.add('active');
  }

  // === Socket ===
  socket.on('connect', () => { myId = socket.id; });

  socket.on('gameState', (state) => {
    const prev = currentState;
    currentState = state;
    if (state.state === 'waiting') {
      showScreen('room');
      renderRoom(state);
    } else {
      showScreen('table');
      renderTable(state, prev);
    }
    prevState = prev;
  });

  // === Lobby ===
  $('btnCreate').onclick = () => {
    const name = $('playerName').value.trim() || '玩家1';
    socket.emit('createRoom', { playerName: name }, ({ roomId }) => {
      if (roomId) $('displayRoomId').textContent = roomId;
    });
  };
  $('btnJoin').onclick = () => {
    const roomId = $('roomIdInput').value.trim();
    const name = $('playerName').value.trim() || '玩家';
    if (!roomId) return alert('请输入房间号');
    socket.emit('joinRoom', { roomId, playerName: name }, ({ error }) => {
      if (error) alert(error);
    });
  };

  // === Room ===
  function renderRoom(state) {
    $('displayRoomId').textContent = state.roomId;
    $('tableRoomId').textContent = state.roomId;
    const list = $('playerList');
    list.innerHTML = '';
    state.players.forEach(p => {
      const div = document.createElement('div');
      div.className = 'player-item';
      const tag = p.isDealer ? '<span class="tag dealer">庄</span>' :
                  p.isAI ? '<span class="tag">AI</span>' : '';
      div.innerHTML = `<span class="name">${esc(p.name)}</span>${tag}`;
      list.appendChild(div);
    });
  }
  $('btnAddAI').onclick = () => socket.emit('addAI', {}, ({ error }) => { if (error) alert(error); });
  $('btnStart').onclick = () => socket.emit('startGame', {}, ({ error }) => { if (error) alert(error); });

  // === Table ===
  function renderTable(state, prev) {
    $('tableRoomId').textContent = state.roomId;
    $('tableRound').textContent = '第' + state.roundNumber + '轮';

    const statusMap = { dealing: '发牌中', choosing: '选择阶段', comparing: '开牌中', round_end: '本轮结束' };
    $('tableStatus').textContent = statusMap[state.state] || '';
    $('oddsInfo').classList.toggle('hidden', state.state === 'waiting');

    // 阶段提示
    updatePhaseBanner(state);

    // 亮牌 + 野生标记
    renderRevealCard(state);

    // 记分牌
    renderScores(state);

    // 牌桌
    renderSeats(state, prev);

    // 操作面板
    updateActionPanel(state);

    // 结果
    if (state.state === 'round_end' && state.roundResults) {
      renderResults(state);
      startCountdown(state);
    } else {
      $('resultPanel').classList.add('hidden');
      $('countdown').classList.add('hidden');
      stopCountdown();
    }
  }

  function updatePhaseBanner(state) {
    const banner = $('phaseBanner');
    if (state.state === 'choosing' && state.currentPlayerId) {
      const cp = state.players.find(p => p.id === state.currentPlayerId);
      if (cp) {
        const isMe = cp.id === myId;
        const dealerName = state.players.find(p => p.isDealer)?.name || '';
        if (cp.isDealer) {
          banner.textContent = '庄家 ' + dealerName + ' 思考中...';
        } else if (isMe) {
          banner.textContent = '轮到你操作';
        } else {
          banner.textContent = cp.name + ' 思考中...';
        }
        banner.classList.remove('hidden');
      }
    } else {
      banner.classList.add('hidden');
    }
  }

  function renderRevealCard(state) {
    const container = $('revealArea');
    if (!container) return;
    if (!state.revealCard) {
      container.innerHTML = '';
      return;
    }
    const rc = state.revealCard;
    const cardHtml = rc.isJoker
      ? `<div class="card face-up ${rc.rank === 'big' ? 'joker-big' : 'joker-small'}"><div class="joker-text">${rc.rank === 'big' ? '大王' : '小王'}</div></div>`
      : (() => {
          const isRed = rc.suit === 'hearts' || rc.suit === 'diamonds';
          const sym = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }[rc.suit];
          return `<div class="card face-up ${isRed ? 'red' : 'black'}"><div class="card-rank">${rc.rank}</div><div class="card-suit">${sym}</div></div>`;
        })();

    container.innerHTML = `
      <div class="reveal-card-area">
        <div class="reveal-label">亮牌</div>
        ${cardHtml}
        <div class="reveal-wild-text">${esc(state.wildDisplay)}</div>
      </div>
    `;
  }

  function renderScores(state) {
    const board = $('scoreBoard');
    board.innerHTML = '';
    state.players.forEach(p => {
      const score = p.score || 0;
      const cls = score > 0 ? 'positive' : score < 0 ? 'negative' : 'zero';
      const div = document.createElement('div');
      div.className = 'score-item';
      div.innerHTML = `<span class="s-name">${esc(p.name)}${p.isDealer ? '👑' : ''}</span>` +
        `<span class="s-score ${cls}">${score > 0 ? '+' : ''}${score}</span>`;
      board.appendChild(div);
    });
  }

  function renderSeats(state, prev) {
    const tableEl = $('gameTable');
    const isNewDeal = prev && prev.state === 'waiting' && state.state !== 'waiting';
    const seats = computeSeatPositions(state.players.length);

    tableEl.innerHTML = '';
    state.players.forEach((p, i) => {
      const seat = document.createElement('div');
      seat.className = 'seat';
      seat.style.cssText = seats[i];

      // 名字
      const nameEl = document.createElement('div');
      nameEl.className = 'player-name';
      if (p.isDealer) nameEl.classList.add('is-dealer');
      if (state.currentPlayerId === p.id) nameEl.classList.add('is-current');
      nameEl.textContent = p.name + (p.id === myId ? '(你)' : '');
      seat.appendChild(nameEl);

      // 状态
      const statusEl = document.createElement('div');
      statusEl.className = 'player-status';
      if (state.state === 'choosing') {
        if (p.choice === 'hit') statusEl.textContent = '已补牌';
        else if (p.choice === 'stand') statusEl.textContent = '不补牌';
        else if (state.currentPlayerId === p.id) statusEl.textContent = '思考中...';
      }
      seat.appendChild(statusEl);

      // 牌
      const cardsEl = document.createElement('div');
      cardsEl.className = 'cards';
      p.cards.forEach((c, ci) => {
        const cardEl = createCardEl(c);
        // 发牌动画：新发的牌添加动画
        if (isNewDeal && !c.hidden) {
          cardEl.classList.add('dealing');
          cardEl.style.animationDelay = (ci * 0.12) + 's';
        }
        // 开牌动画
        if (state.state === 'round_end' && c.hidden === undefined && prev?.state === 'comparing') {
          cardEl.classList.add('flip-reveal');
          cardEl.style.animationDelay = (ci * 0.1) + 's';
        }
        cardsEl.appendChild(cardEl);
      });
      seat.appendChild(cardsEl);

      tableEl.appendChild(seat);
    });
  }

  function createCardEl(card) {
    const el = document.createElement('div');
    el.className = 'card';
    if (card.hidden) {
      el.classList.add('face-down');
      return el;
    }
    el.classList.add('face-up');
    if (card.isJoker) {
      el.classList.add(card.rank === 'big' ? 'joker-big' : 'joker-small');
      el.innerHTML = `<div class="joker-text">${card.rank === 'big' ? '大王' : '小王'}</div>`;
    } else {
      const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
      el.classList.add(isRed ? 'red' : 'black');
      const suitSymbol = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }[card.suit];
      el.innerHTML = `<div class="card-rank">${card.rank}</div><div class="card-suit">${suitSymbol}</div>`;
    }
    // 野生牌标记
    if (card.isWild) {
      el.classList.add('wild-card');
      const badge = document.createElement('div');
      badge.className = 'wild-badge';
      badge.textContent = '鬼';
      el.appendChild(badge);
    }
    return el;
  }

  function updateActionPanel(state) {
    const panel = $('actionPanel');
    if (state.state === 'choosing' && state.isYourTurn) {
      panel.classList.remove('hidden');
      const me = state.players.find(p => p.id === myId);
      const wildCount = me.cards.filter && me.cards.filter(c => c.isJoker || c.isWild).length;
      if (wildCount >= 2) {
        $('actionText').textContent = '双鬼至尊！可不补（最大），或补一张：';
      } else if (wildCount === 1) {
        $('actionText').textContent = '鬼牌两张时算0点，补第三张后可变任意牌凑特殊牌型：';
      } else {
        $('actionText').textContent = '请选择：';
      }
      $('btnHit').style.display = '';
      $('btnStand').style.display = '';
    } else {
      panel.classList.add('hidden');
    }
  }

  // === 结果 ===
  const MULTIPLIER_NAMES = {
    10: '10x', 8: '8x', 6: '6x', 4: '4x',
    3: '3x', 2: '2x', 1: '1x', 0: ''
  };

  function renderResults(state) {
    const panel = $('resultPanel');
    let html = '<h3>第' + state.roundNumber + '轮 结算</h3>';

    const dealer = state.players.find(p => p.isDealer);

    state.roundResults.forEach(r => {
      const cls = r.result === 'win' ? 'win' : r.result === 'lose' ? 'lose' : 'draw';
      const txt = r.result === 'win' ? '赢' : r.result === 'lose' ? '输' : '平';
      const pMult = MULTIPLIER_NAMES[r.multiplier] || '';
      const dMult = MULTIPLIER_NAMES[r.multiplier] || '';
      const sCls = r.scoreChange > 0 ? 'positive' : r.scoreChange < 0 ? 'negative' : 'zero';
      const pScore = r.scoreChange > 0 ? '+' + r.scoreChange : String(r.scoreChange);
      const dScore = r.scoreChange > 0 ? '-' + r.scoreChange : r.scoreChange < 0 ? '+' + Math.abs(r.scoreChange) : '0';

      html += `<div class="result-matchup">
        <div class="matchup-header">
          <span class="mh-player">${esc(r.playerName)} (闲)</span>
          <span class="mh-vs">VS</span>
          <span class="mh-dealer">${esc(dealer?.name || '')} (庄)</span>
        </div>
        <table class="matchup-table">
          <tr>
            <td class="mt-hand ${cls}">${r.playerHandName} ${pMult}</td>
            <td class="mt-label">牌型</td>
            <td class="mt-hand">${r.dealerHandName} ${dMult}</td>
          </tr>
          <tr>
            <td class="mt-score ${sCls}">${pScore}</td>
            <td class="mt-label">得分</td>
            <td class="mt-score ${r.result === 'win' ? 'negative' : r.result === 'lose' ? 'positive' : 'zero'}">${dScore}</td>
          </tr>
        </table>
        <div class="matchup-result ${cls}">${txt}</div>
      </div>`;
    });

    // 换庄提示
    if (state.prevDealerId) {
      const newDealer = state.players.find(p => p.isDealer);
      const qualWins = state.roundResults.filter(r =>
        r.result === 'win' && r.playerHandType >= 8
      );
      if (qualWins.length > 0 && newDealer) {
        const best = qualWins.reduce((a, b) => a.playerHandType > b.playerHandType ? a : b);
        html += `<div class="dealer-change-banner">🎉 ${esc(best.playerName)} 以${best.playerHandName}上庄！</div>`;
      }
    }

    panel.innerHTML = html;
    panel.classList.remove('hidden');
  }

  // === 倒计时 ===
  function startCountdown(state) {
    stopCountdown();
    let sec = 6;
    const el = $('countdown');
    el.classList.remove('hidden');
    el.textContent = sec + '秒后自动开始下一轮...';
    countdownTimer = setInterval(() => {
      sec--;
      if (sec <= 0) {
        stopCountdown();
        socket.emit('nextRound', {}, ({ error }) => { if (error) console.error(error); });
      } else {
        el.textContent = sec + '秒后自动开始下一轮...';
      }
    }, 1000);
  }
  function stopCountdown() {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    $('countdown').classList.add('hidden');
  }

  // === Actions ===
  $('btnHit').onclick = () => socket.emit('makeChoice', { choice: 'hit' }, ({ error }) => { if (error) alert(error); });
  $('btnStand').onclick = () => socket.emit('makeChoice', { choice: 'stand' }, ({ error }) => { if (error) alert(error); });
  $('btnLeave').onclick = () => {
    if (confirm('确定离开房间？')) {
      stopCountdown();
      socket.emit('leaveRoom', {}, () => showScreen('lobby'));
    }
  };

  // === Seat positions ===
  function computeSeatPositions(count) {
    const positions = [];
    const myPos = `bottom: -10px; left: 50%; transform: translateX(-50%);`;
    if (count === 1) return [myPos];
    positions.push(myPos);
    const others = count - 1;
    for (let i = 0; i < others; i++) {
      const fraction = (i + 1) / (others + 1);
      const angle = Math.PI + fraction * Math.PI;
      const x = 450 + 340 * Math.cos(angle);
      const y = 240 + 170 * Math.sin(angle);
      positions.push(`left: ${(x / 900 * 100).toFixed(1)}%; top: ${(y / 480 * 100).toFixed(1)}%; transform: translate(-50%, -50%);`);
    }
    return positions;
  }

  function esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
})();
