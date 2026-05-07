const { createDeck, shuffle, hasJoker } = require('./Card');
const { evaluate, compare, HAND_NAMES, MULTIPLIERS } = require('./HandEvaluator');
const { aiDecide } = require('./AIPlayer');

const STATES = {
  WAITING: 'waiting',
  DEALING: 'dealing',
  CHOOSING: 'choosing',
  COMPARING: 'comparing',
  ROUND_END: 'round_end'
};

class Room {
  constructor(id) {
    this.id = id;
    this.players = [];
    this.state = STATES.WAITING;
    this.deck = [];
    this.dealerIndex = 0;
    this.currentPlayerIndex = -1;
    this.roundResults = [];
    this.maxPlayers = 6;
    this.scores = {};        // { playerId: 累计分数 }
    this.roundNumber = 0;
    this.STAKE = 1;          // 每局基础筹码
  }

  addPlayer(id, name, isAI = false) {
    if (this.players.length >= this.maxPlayers) return false;
    if (this.state !== STATES.WAITING && this.state !== STATES.ROUND_END) return false;
    this.players.push({
      id, name, isAI,
      cards: [],
      choice: null,
      result: null,
      isDealer: false
    });
    if (!(id in this.scores)) {
      this.scores[id] = 0;
    }
    return true;
  }

  removePlayer(id) {
    const idx = this.players.findIndex(p => p.id === id);
    if (idx === -1) return;
    this.players.splice(idx, 1);
    if (this.dealerIndex >= this.players.length) {
      this.dealerIndex = 0;
    }
    delete this.scores[id];
  }

  startGame() {
    if (this.players.length < 2) return false;
    if (this.state !== STATES.WAITING && this.state !== STATES.ROUND_END) return false;

    this.deck = shuffle(createDeck());
    this.roundResults = [];
    this.roundNumber++;
    this.players.forEach(p => {
      p.cards = [];
      p.choice = null;
      p.result = null;
      p.isDealer = false;
    });

    this.players[this.dealerIndex].isDealer = true;

    for (let i = 0; i < 2; i++) {
      for (const player of this.players) {
        player.cards.push(this.deck.pop());
      }
    }

    this.state = STATES.CHOOSING;
    this.currentPlayerIndex = this._nextPlayerToAct(0);
    return true;
  }

  _nextPlayerToAct(fromIndex) {
    for (let i = fromIndex; i < this.players.length; i++) {
      if (this.players[i].choice === null) return i;
    }
    return -1;
  }

  getCurrentPlayer() {
    if (this.currentPlayerIndex < 0) return null;
    return this.players[this.currentPlayerIndex];
  }

  // 单张鬼牌强制补牌，双鬼不强制
  _mustHit(cards) {
    const jokers = cards.filter(c => c.isJoker);
    if (jokers.length >= 2) return false; // 双鬼可以不补
    if (jokers.length === 1) return true; // 单鬼强制补牌
    return false;
  }

  makeChoice(playerId, choice) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return { error: '玩家不存在' };
    if (player.choice !== null) return { error: '已做出选择' };

    const mustHit = this._mustHit(player.cards);

    if (mustHit) {
      player.choice = 'hit';
      player.cards.push(this.deck.pop());
    } else {
      if (choice === 'hit') {
        player.choice = 'hit';
        player.cards.push(this.deck.pop());
      } else {
        player.choice = 'stand';
      }
    }

    this.currentPlayerIndex = this._nextPlayerToAct(this.currentPlayerIndex + 1);

    if (this.currentPlayerIndex === -1) {
      this._compareHands();
    }

    return { ok: true };
  }

  _compareHands() {
    this.state = STATES.COMPARING;
    const dealer = this.players[this.dealerIndex];
    const dealerEval = evaluate(dealer.cards);

    this.roundResults = [];

    for (let i = 0; i < this.players.length; i++) {
      if (i === this.dealerIndex) continue;
      const player = this.players[i];
      const playerEval = evaluate(player.cards);
      const cmp = compare(playerEval, dealerEval);

      let result, scoreChange;
      if (cmp.result > 0) {
        result = 'win';
        scoreChange = this.STAKE * cmp.multiplier;
      } else if (cmp.result < 0) {
        result = 'lose';
        scoreChange = -(this.STAKE * cmp.multiplier);
      } else {
        result = 'draw';
        scoreChange = 0;
      }

      player.result = result;
      this.scores[player.id] = (this.scores[player.id] || 0) + scoreChange;
      this.scores[dealer.id] = (this.scores[dealer.id] || 0) - scoreChange;

      this.roundResults.push({
        playerId: player.id,
        playerName: player.name,
        playerCards: player.cards.map(c => ({ ...c })),
        playerHandName: HAND_NAMES[playerEval.type],
        playerPoints: playerEval.points,
        playerHandType: playerEval.type,
        result,
        scoreChange,
        multiplier: cmp.multiplier,
        dealerCards: dealer.cards.map(c => ({ ...c })),
        dealerHandName: HAND_NAMES[dealerEval.type],
        dealerPoints: dealerPoints(dealerEval),
        dealerHandType: dealerEval.type
      });
    }

    dealer.result = 'dealer';
    this.state = STATES.ROUND_END;
  }

  nextRound() {
    this.dealerIndex = (this.dealerIndex + 1) % this.players.length;
    return this.startGame();
  }

  processAITurns() {
    const actions = [];
    while (this.currentPlayerIndex >= 0) {
      const player = this.players[this.currentPlayerIndex];
      if (!player.isAI) break;

      const isDealer = player.isDealer;
      const mustHit = this._mustHit(player.cards);
      const choice = mustHit ? 'hit' : (aiDecide(player.cards, isDealer) ? 'hit' : 'stand');

      this.makeChoice(player.id, choice);
      actions.push({ playerId: player.id, name: player.name, choice });
    }
    return actions;
  }

  getStateForPlayer(playerId) {
    return {
      roomId: this.id,
      state: this.state,
      roundNumber: this.roundNumber,
      stake: this.STAKE,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        isAI: p.isAI,
        isDealer: p.isDealer,
        cards: p.id === playerId || this.state === STATES.ROUND_END || this.state === STATES.COMPARING
          ? p.cards.map(c => ({ ...c }))
          : p.cards.map(() => ({ hidden: true })),
        choice: p.choice,
        result: p.result,
        cardCount: p.cards.length,
        score: this.scores[p.id] || 0
      })),
      currentPlayerId: this.currentPlayerIndex >= 0 ? this.players[this.currentPlayerIndex].id : null,
      roundResults: this.roundResults,
      dealerIndex: this.dealerIndex,
      isYourTurn: this.currentPlayerIndex >= 0 && this.players[this.currentPlayerIndex].id === playerId,
      scores: { ...this.scores }
    };
  }
}

function dealerPoints(eval) {
  if (eval.type === 10) return '双鬼';
  if (eval.type === 9) return '0点';
  if (eval.type === 8 || eval.type === 6) return eval.high + '高';
  if (eval.type === 7) return eval.high + '点';
  if (eval.type === 5) return eval.points + '点';
  return eval.points + '点';
}

module.exports = { Room, STATES };
