const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let i = 0; i < RANKS.length; i++) {
      const rank = RANKS[i];
      let value;
      if (rank === 'A') value = 1;
      else if (['J', 'Q', 'K'].includes(rank)) value = 10;
      else value = parseInt(rank);

      deck.push({
        suit,
        rank,
        value,
        isJoker: false,
        id: `${suit}_${rank}`,
        display: `${SUIT_SYMBOLS[suit]}${rank}`
      });
    }
  }
  // 大王
  deck.push({
    suit: 'joker',
    rank: 'big',
    value: 0,
    isJoker: true,
    id: 'joker_big',
    display: '大王'
  });
  // 小王
  deck.push({
    suit: 'joker',
    rank: 'small',
    value: 0,
    isJoker: true,
    id: 'joker_small',
    display: '小王'
  });
  return deck;
}

function shuffle(deck) {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function hasJoker(cards) {
  return cards.some(c => c.isJoker);
}

function getCardPoints(cards) {
  return cards.reduce((sum, c) => sum + c.value, 0) % 10;
}

module.exports = { SUITS, RANKS, SUIT_SYMBOLS, createDeck, shuffle, hasJoker, getCardPoints };
