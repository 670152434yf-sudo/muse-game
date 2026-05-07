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
        isWild: false,
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

function hasWild(cards) {
  return cards.some(c => c.isWild);
}

function hasJokerOrWild(cards) {
  return cards.some(c => c.isJoker || c.isWild);
}

function getCardPoints(cards) {
  return cards.reduce((sum, c) => sum + c.value, 0) % 10;
}

// 根据亮出的牌标记本局的野生牌
// 亮出普通牌 → 同点数其他花色为野生
// 亮出鬼牌 → 四张A为野生
function markWildCards(deck, revealCard) {
  let wildRank, wildSuits;

  if (revealCard.isJoker) {
    // 亮出鬼牌 → 四张A都是野生
    wildRank = 'A';
    wildSuits = null; // null means all suits
  } else {
    // 亮出普通牌 → 同点数其他花色为野生
    wildRank = revealCard.rank;
    wildSuits = SUITS.filter(s => s !== revealCard.suit);
  }

  for (const card of deck) {
    if (card.isJoker) continue;
    if (card.rank === wildRank) {
      if (wildSuits === null || wildSuits.includes(card.suit)) {
        card.isWild = true;
      }
    }
  }
}

module.exports = { SUITS, RANKS, SUIT_SYMBOLS, createDeck, shuffle, hasJoker, hasWild, hasJokerOrWild, getCardPoints, markWildCards };
