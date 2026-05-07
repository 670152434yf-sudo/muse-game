(() => {
  const socket = io();
  let myId = null;
  let currentState = null;
  let countdownTimer = null;

  const $ = id => document.getElementById(id);
  const lobby = $('lobby');
  const room = $('room');
  const table = $('table');

  function showScreen(name) {
    [lobby, room, table].forEach(s => s.classList.remove('active'));
    $(name).classList.add('active');
  }

  // === Socket Events ===
  socket.on('connect', () => { myId = socket.id; });

  socket.on('gameState', (state) => {
    currentState = state;
    if (state.state === 'waiting') {
      showScreen('room');
      renderRoom(state);
    } else {
      showScreen('table');
      renderTable(state);
    }
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

  $('btnAddAI').onclick = () => {
    socket.emit('addAI', {}, ({ error }) => {
      if (error) alert(error);
    });
  };

  $('btnStart').onclick = () => {
    socket.emit('startGame', {}, ({ error }) => {
      if (error) alert(error);
    });
  };

  // === Table ===
  function renderTable(state) {
    $('tableRoomId').textContent = state.roomId;
    $('tableRound').textContent = '第' + state.roundNumber + '轮';

    const statusMap = {
      dealing: '发牌中',
      choosing: '选择阶段',
      comparing: '开牌中',
      round_end: '本轮结束'
    };
    $('tableStatus').textContent = statusMap[state.state] || '';

    // 赔率表
    $('oddsInfo').classList.toggle('hidden', state.state === 'waiting');

    // 记分牌
    renderScores(state);

    // 牌桌
    const tableEl = $('gameTable');
    tableEl.innerHTML = '';

    const seats = computeSeatPositions(state.players.length);
    state.players.forEach((p, i) => {
      const seat = document.createElement('div');
      seat.className = 'seat';
      seat.style.cssText = seats[i];

      const nameEl = document.createElement('div');
      nameEl.className = 'player-name';
      if (p.isDealer) nameEl.classList.add('is-dealer');
      if (state.currentPlayerId === p.id) nameEl.classList.add('is-current');
      nameEl.textContent = p.name + (p.id === myId ? ' (你)' : '');
      seat.appendChild(nameEl);

      const statusEl = document.createElement('div');
      statusEl.className = 'player-status';
      if (state.state === 'choosing') {
        if (p.choice === 'hit') statusEl.textContent = '已补牌';
        else if (p.choice === 'stand') statusEl.textContent = '不补牌';
        else if (state.currentPlayerId === p.id) statusEl.textContent = '思考中...';
      }
      seat.appendChild(statusEl);

      const cardsEl = document.createElement('div');
      cardsEl.className = 'cards';
      p.cards.forEach(c => cardsEl.appendChild(createCardEl(c)));
      seat.appendChild(cardsEl);

      tableEl.appendChild(seat);
    });

    // 操作面板
    const actionPanel = $('actionPanel');
    if (state.state === 'choosing' && state.isYourTurn) {
      actionPanel.classList.remove('hidden');
      const me = state.players.find(p => p.id === myId);
      const jokerCount = me.cards.filter && me.cards.filter(c => c.isJoker).length;
      if (jokerCount === 1) {
        $('actionText').textContent = '你有单张鬼牌，必须补牌！';
        $('btnHit').style.display = '';
        $('btnStand').style.display = 'none';
      } else if (jokerCount >= 2) {
        $('actionText').textContent = '双鬼至尊！可以不补牌（最大），或补一张：';
        $('btnHit').style.display = '';
        $('btnStand').style.display = '';
      } else {
        $('actionText').textContent = '请选择：';
        $('btnHit').style.display = '';
        $('btnStand').style.display = '';
      }
    } else {
      actionPanel.classList.add('hidden');
    }

    // 结果面板 + 自动继续
    const resultPanel = $('resultPanel');
    const countdownEl = $('countdown');
    if (state.state === 'round_end' && state.roundResults) {
      resultPanel.classList.remove('hidden');
      renderResults(state);
      // 自动倒计时
      startCountdown(state);
    } else {
      resultPanel.classList.add('hidden');
      countdownEl.classList.add('hidden');
      stopCountdown();
    }
  }

  function renderScores(state) {
    const board = $('scoreBoard');
    board.innerHTML = '';
    state.players.forEach(p => {
      const score = p.score || 0;
      const scoreClass = score > 0 ? 'positive' : score < 0 ? 'negative' : 'zero';
      const div = document.createElement('div');
      div.className = 'score-item';
      div.innerHTML = `<span class="s-name">${esc(p.name)}${p.isDealer ? '(庄)' : ''}</span>` +
        `<span class="s-score ${scoreClass}">${score > 0 ? '+' : ''}${score}</span>`;
      board.appendChild(div);
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
    return el;
  }

  const MULTIPLIER_NAMES = {
    10: '双鬼10x', 8: '豹子8x', 6: '同花顺6x', 4: '顺子4x',
    3: '同花3张3x', 2: '同花2x', 1: '普通1x', 0: ''
  };

  function renderResults(state) {
    const panel = $('resultPanel');
    let html = '<h3>第' + state.roundNumber + '轮 结算</h3>';
    state.roundResults.forEach(r => {
      const outcomeClass = r.result === 'win' ? 'win' : r.result === 'lose' ? 'lose' : 'draw';
      const outcomeText = r.result === 'win' ? '赢' : r.result === 'lose' ? '输' : '平';
      const scoreClass = r.scoreChange > 0 ? 'positive' : r.scoreChange < 0 ? 'negative' : 'zero';
      const scoreText = r.scoreChange > 0 ? '+' + r.scoreChange : String(r.scoreChange);
      const multText = MULTIPLIER_NAMES[r.multiplier] || '';

      html += `<div class="result-item">
        <span class="result-name">${esc(r.playerName)}</span>
        <span class="result-hand">${r.playerHandName} vs ${r.dealerHandName}</span>
        <span class="result-multiplier">${multText}</span>
        <span class="result-outcome ${outcomeClass}">${outcomeText}</span>
        <span class="result-score ${scoreClass}">${scoreText}</span>
      </div>`;
    });
    panel.innerHTML = html;
  }

  // === 自动继续倒计时 ===
  function startCountdown(state) {
    stopCountdown();
    let sec = 5;
    const countdownEl = $('countdown');
    countdownEl.classList.remove('hidden');
    countdownEl.textContent = sec + '秒后自动开始下一轮...';

    countdownTimer = setInterval(() => {
      sec--;
      if (sec <= 0) {
        stopCountdown();
        socket.emit('nextRound', {}, ({ error }) => {
          if (error) console.error(error);
        });
      } else {
        countdownEl.textContent = sec + '秒后自动开始下一轮...';
      }
    }, 1000);
  }

  function stopCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    $('countdown').classList.add('hidden');
  }

  // === Actions ===
  $('btnHit').onclick = () => {
    socket.emit('makeChoice', { choice: 'hit' }, ({ error }) => {
      if (error) alert(error);
    });
  };
  $('btnStand').onclick = () => {
    socket.emit('makeChoice', { choice: 'stand' }, ({ error }) => {
      if (error) alert(error);
    });
  };
  $('btnLeave').onclick = () => {
    if (confirm('确定离开房间？')) {
      stopCountdown();
      socket.emit('leaveRoom', {}, () => {
        showScreen('lobby');
      });
    }
  };

  // === Seat positioning ===
  function computeSeatPositions(count) {
    const positions = [];
    const myPos = `bottom: -10px; left: 50%; transform: translateX(-50%);`;
    if (count === 1) return [myPos];

    positions.push(myPos);
    const others = count - 1;
    for (let i = 0; i < others; i++) {
      const fraction = (i + 1) / (others + 1);
      const angle = Math.PI + fraction * Math.PI;
      const x = 450 + 350 * Math.cos(angle);
      const y = 250 + 180 * Math.sin(angle);
      const leftPct = (x / 900 * 100).toFixed(1);
      const topPct = (y / 500 * 100).toFixed(1);
      positions.push(`left: ${leftPct}%; top: ${topPct}%; transform: translate(-50%, -50%);`);
    }
    return positions;
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }
})();
