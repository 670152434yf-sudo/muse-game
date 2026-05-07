// 牌型等级：双鬼 > 天公9 > 天公8 > 豹子 > 同花顺 > 杂顺子 > 其他拼点数
const HAND_TYPES = {
  DOUBLE_JOKER: 13,
  TIANGONG_9: 12,
  TIANGONG_8: 11,
  THREE_KIND: 10,
  STRAIGHT_FLUSH: 9,
  MIXED_STRAIGHT: 8,
  // 以下全是拼点数，等级一样，只比 points
  POINT_BASED: 0
};

const HAND_NAMES = {
  13: '双鬼至尊',
  12: '天公9',
  11: '天公8',
  10: '豹子',
  9: '同花顺',
  8: '杂顺子',
  0: '' // 动态显示点数
};

function handDisplayName(result) {
  if (result.type === HAND_TYPES.POINT_BASED) {
    return result.points + '点';
  }
  return HAND_NAMES[result.type] || '';
}

// 倍率：根据手牌内容动态计算
function getMultiplier(type, points, cards) {
  if (type === HAND_TYPES.DOUBLE_JOKER) return 10;
  if (type === HAND_TYPES.TIANGONG_9 || type === HAND_TYPES.TIANGONG_8) {
    // 同花天公或对子 → 2倍
    if (cards.length === 2) {
      if (cards[0].suit === cards[1].suit) return 2;
      if (cards[0].rank === cards[1].rank) return 2;
    }
    return 1;
  }
  if (type === HAND_TYPES.THREE_KIND) return 8;
  if (type === HAND_TYPES.STRAIGHT_FLUSH) return 6;
  if (type === HAND_TYPES.MIXED_STRAIGHT) return 4;

  // 点数类：看同花情况
  if (cards.length === 3) {
    const allSameSuit = cards.every(c => c.suit === cards[0].suit);
    return allSameSuit ? 3 : 1;
  }
  if (cards.length === 2) {
    // 同花或对子 → 2x
    if (cards[0].suit === cards[1].suit) return 2;
    if (cards[0].rank === cards[1].rank) return 2;
    return 1;
  }
  return 1;
}

function rankOrder(rank) {
  if (rank === 'A') return 1;
  if (rank === 'J') return 11;
  if (rank === 'Q') return 12;
  if (rank === 'K') return 13;
  return parseInt(rank);
}

function isConsecutive(orders) {
  const sorted = [...orders].sort((a, b) => a - b);
  if (sorted[2] - sorted[1] === 1 && sorted[1] - sorted[0] === 1) return true;
  if (sorted[0] === 1 && sorted[1] === 12 && sorted[2] === 13) return true;
  if (sorted[0] === 1 && sorted[1] === 2 && sorted[2] === 13) return true;
  return false;
}

function getStraightHigh(orders) {
  const sorted = [...orders].sort((a, b) => a - b);
  if (sorted[0] === 1 && sorted[1] === 12 && sorted[2] === 13) return 14;
  if (sorted[0] === 1 && sorted[1] === 2 && sorted[2] === 13) return 13;
  return sorted[2];
}

function evaluateThree(cards) {
  const orders = cards.map(c => rankOrder(c.rank));
  const suits = cards.map(c => c.suit);
  const allSameSuit = suits.every(s => s === suits[0]);
  const consecutive = isConsecutive(orders);
  const values = cards.map(c => c.value);
  const ranks = cards.map(c => c.rank);
  const allSameRank = ranks[0] === ranks[1] && ranks[1] === ranks[2];
  const pts = values.reduce((s, v) => s + v, 0) % 10;

  // 豹子
  if (allSameRank) return { type: HAND_TYPES.THREE_KIND, high: values[0], points: 0 };
  // 同花顺
  if (allSameSuit && consecutive) return { type: HAND_TYPES.STRAIGHT_FLUSH, high: getStraightHigh(orders), points: 0 };
  // 杂顺子
  if (consecutive) return { type: HAND_TYPES.MIXED_STRAIGHT, high: getStraightHigh(orders), points: 0 };
  // 其他：拼点数
  return { type: HAND_TYPES.POINT_BASED, high: 0, points: pts };
}

function isWildCard(c) { return c.isJoker || c.isWild; }
function nonWilds(cards) { return cards.filter(c => !isWildCard(c)); }

const ALL_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const ALL_SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];

function bestWithWilds(cards) {
  const wilds = cards.filter(c => isWildCard(c));
  const normals = nonWilds(cards);

  if (wilds.length === 2) return { type: HAND_TYPES.DOUBLE_JOKER, high: 99, points: 0 };

  if (wilds.length === 1) {
    let best = { type: HAND_TYPES.POINT_BASED, high: -99, points: 0 };
    for (const suit of ALL_SUITS) {
      for (const rank of ALL_RANKS) {
        const fake = {
          suit, rank,
          value: rank === 'A' ? 1 : ['J', 'Q', 'K'].includes(rank) ? 10 : parseInt(rank),
          isJoker: false, isWild: false
        };
        const result = evaluateThree([...normals, fake]);
        // 豹子/同花顺/顺子优先；否则比点数
        if (result.type > best.type || (result.type === best.type && result.points > best.points)) {
          best = result;
        }
      }
    }
    return best;
  }

  return evaluateThree(cards);
}

function evaluate(cards) {
  const wildCount = cards.filter(c => isWildCard(c)).length;

  // 双鬼
  if (cards.length >= 2 && wildCount >= 2) {
    return { type: HAND_TYPES.DOUBLE_JOKER, high: 99, points: 0 };
  }

  // 2张牌
  if (cards.length === 2) {
    if (wildCount > 0) {
      // 单鬼/野生 + 普通 → 天公9（百搭凑9）
      return { type: HAND_TYPES.TIANGONG_9, high: 9, points: 9 };
    }
    const pts = cards.reduce((s, c) => s + c.value, 0) % 10;
    if (pts === 9) return { type: HAND_TYPES.TIANGONG_9, high: 9, points: 9 };
    if (pts === 8) return { type: HAND_TYPES.TIANGONG_8, high: 8, points: 8 };
    // 充点数
    return { type: HAND_TYPES.POINT_BASED, high: 0, points: pts };
  }

  // 3张牌
  if (cards.length === 3) {
    if (wildCount > 0) return bestWithWilds(cards);
    return evaluateThree(cards);
  }

  return { type: HAND_TYPES.POINT_BASED, high: 0, points: 0 };
}

function compare(a, b, cardsA, cardsB) {
  const multA = getMultiplier(a.type, a.points, cardsA || []);
  const multB = getMultiplier(b.type, b.points, cardsB || []);

  // 零点 vs 双鬼：零点赢
  if (a.type === HAND_TYPES.POINT_BASED && a.points === 0 && b.type === HAND_TYPES.DOUBLE_JOKER) {
    return { result: 1, multiplier: 10 };
  }
  if (b.type === HAND_TYPES.POINT_BASED && b.points === 0 && a.type === HAND_TYPES.DOUBLE_JOKER) {
    return { result: -1, multiplier: 10 };
  }

  // 不同大类
  if (a.type !== b.type) {
    const winner = a.type > b.type ? a : b;
    const wMult = a.type > b.type ? multA : multB;
    return { result: a.type > b.type ? 1 : -1, multiplier: wMult };
  }

  // 同类比较
  if (a.type === HAND_TYPES.DOUBLE_JOKER) return { result: 0, multiplier: 0 };

  // 天公：同点数平局
  if (a.type === HAND_TYPES.TIANGONG_9 || a.type === HAND_TYPES.TIANGONG_8) {
    return { result: 0, multiplier: 0 };
  }

  // 豹子
  if (a.type === HAND_TYPES.THREE_KIND) {
    if (a.high !== b.high) return { result: a.high > b.high ? 1 : -1, multiplier: 8 };
    return { result: 0, multiplier: 0 };
  }

  // 同花顺/杂顺子：比最大牌
  if (a.type === HAND_TYPES.STRAIGHT_FLUSH || a.type === HAND_TYPES.MIXED_STRAIGHT) {
    if (a.high !== b.high) return { result: a.high > b.high ? 1 : -1, multiplier: a.type === HAND_TYPES.STRAIGHT_FLUSH ? 6 : 4 };
    return { result: 0, multiplier: 0 };
  }

  // 点数类：纯比点数
  if (a.points !== b.points) return { result: a.points > b.points ? 1 : -1, multiplier: a.points > b.points ? multA : multB };
  return { result: 0, multiplier: 0 };
}

module.exports = { HAND_TYPES, HAND_NAMES, handDisplayName, getMultiplier, evaluate, compare };
