// 全新牌型等级（从大到小）
const HAND_TYPES = {
  DOUBLE_JOKER: 13,
  TIANGONG_9: 12,       // 2张9点（含同花天公9）
  TIANGONG_8: 11,       // 2张8点（含同花天公8）
  THREE_KIND: 10,       // 豹子
  STRAIGHT_FLUSH: 9,    // 同花顺
  SUIT_THREE: 8,        // 同花3张
  MIXED_STRAIGHT: 7,    // 杂顺子
  POINTS_9: 6,          // 3张9点
  POINTS_8: 5,          // 3张8点
  POINTS_7: 4,
  POINTS_6: 3,
  POINTS_5: 2,
  POINTS_4: 1,
  POINTS_3: 0,
  POINTS_2: -1,
  POINTS_1: -2,
  SUIT_PAIR: -3,        // 同花2张（非天公）
  NORMAL_2: -4,         // 普通2张（非天公非同花）
  ZERO_POINTS: -5       // 零点（最小，但吃双鬼）
};

const HAND_NAMES = {
  13: '双鬼至尊',
  12: '天公9',
  11: '天公8',
  10: '豹子',
  9: '同花顺',
  8: '同花3张',
  7: '杂顺子',
  6: '9点',
  5: '8点',
  4: '7点',
  3: '6点',
  2: '5点',
  1: '4点',
  0: '3点',
  '-1': '2点',
  '-2': '1点',
  '-3': '同花2张',
  '-4': '普通',
  '-5': '零点'
};

// 赔率倍数（同花天公在判定时动态设置）
const MULTIPLIERS = {
  13: 10,  // 双鬼
  12: 1,   // 天公9（同花时2x）
  11: 1,   // 天公8（同花时2x）
  10: 8,   // 豹子
  9: 6,    // 同花顺
  8: 3,    // 同花3张
  7: 4,    // 杂顺子
  6: 1,    // 9点
  5: 1,    // 8点
  4: 1, 3: 1, 2: 1, 1: 1, 0: 1, '-1': 1, '-2': 1,
  '-3': 2, // 同花2张
  '-4': 1, // 普通
  '-5': 1  // 零点（赢双鬼时10x）
};

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

// 3张点数对应牌型
const POINTS_TO_TYPE = {
  9: HAND_TYPES.POINTS_9, 8: HAND_TYPES.POINTS_8,
  7: HAND_TYPES.POINTS_7, 6: HAND_TYPES.POINTS_6,
  5: HAND_TYPES.POINTS_5, 4: HAND_TYPES.POINTS_4,
  3: HAND_TYPES.POINTS_3, 2: HAND_TYPES.POINTS_2,
  1: HAND_TYPES.POINTS_1
};

function evaluateThree(cards) {
  const orders = cards.map(c => rankOrder(c.rank));
  const suits = cards.map(c => c.suit);
  const allSameSuit = suits.every(s => s === suits[0]);
  const consecutive = isConsecutive(orders);
  const values = cards.map(c => c.value);
  const ranks = cards.map(c => c.rank);
  const allSameRank = ranks[0] === ranks[1] && ranks[1] === ranks[2];
  const pts = values.reduce((s, v) => s + v, 0) % 10;

  // 豹子（最高优先）
  if (allSameRank) {
    return { type: HAND_TYPES.THREE_KIND, high: values[0], points: 0 };
  }
  // 同花顺
  if (allSameSuit && consecutive) {
    return { type: HAND_TYPES.STRAIGHT_FLUSH, high: getStraightHigh(orders), points: 0 };
  }
  // 同花3张
  if (allSameSuit) {
    return { type: HAND_TYPES.SUIT_THREE, high: Math.max(...orders), points: pts };
  }
  // 杂顺子
  if (consecutive) {
    return { type: HAND_TYPES.MIXED_STRAIGHT, high: getStraightHigh(orders), points: 0 };
  }
  // 普通点数
  if (pts === 0) {
    return { type: HAND_TYPES.ZERO_POINTS, high: 0, points: 0 };
  }
  return { type: POINTS_TO_TYPE[pts] || HAND_TYPES.POINTS_1, high: 0, points: pts };
}

function isWildCard(c) {
  return c.isJoker || c.isWild;
}

function nonWilds(cards) {
  return cards.filter(c => !isWildCard(c));
}

const ALL_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const ALL_SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];

function bestWithWilds(cards) {
  const wilds = cards.filter(c => isWildCard(c));
  const normals = nonWilds(cards);

  if (wilds.length === 2) {
    return { type: HAND_TYPES.DOUBLE_JOKER, high: 99, points: 0 };
  }

  if (wilds.length === 1) {
    let best = { type: HAND_TYPES.ZERO_POINTS, high: -99, points: 0 };
    for (const suit of ALL_SUITS) {
      for (const rank of ALL_RANKS) {
        const fake = {
          suit, rank,
          value: rank === 'A' ? 1 : ['J', 'Q', 'K'].includes(rank) ? 10 : parseInt(rank),
          isJoker: false, isWild: false
        };
        const result = evaluateThree([...normals, fake]);
        if (result.type > best.type ||
            (result.type === best.type && result.high > best.high)) {
          best = result;
        }
      }
    }
    return best;
  }

  return evaluateThree(cards);
}

function getMulti(playerType, cards) {
  if (playerType === HAND_TYPES.DOUBLE_JOKER) return 10;
  if (playerType === HAND_TYPES.ZERO_POINTS) return 1;
  if (playerType === HAND_TYPES.TIANGONG_9 || playerType === HAND_TYPES.TIANGONG_8) {
    // 同花天公2倍
    if (cards.length === 2 && cards[0].suit === cards[1].suit) return 2;
    return 1;
  }
  return MULTIPLIERS[playerType] || 1;
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
      // 单鬼/野生 + 普通 → 天公9（百搭凑9点）
      return { type: HAND_TYPES.TIANGONG_9, high: 9, points: 9 };
    }
    const pts = cards.reduce((s, c) => s + c.value, 0) % 10;
    if (pts === 9) return { type: HAND_TYPES.TIANGONG_9, high: 9, points: 9 };
    if (pts === 8) return { type: HAND_TYPES.TIANGONG_8, high: 8, points: 8 };
    // 同花2张
    if (cards[0].suit === cards[1].suit) {
      return { type: HAND_TYPES.SUIT_PAIR, high: Math.max(rankOrder(cards[0].rank), rankOrder(cards[1].rank)), points: pts };
    }
    return { type: HAND_TYPES.NORMAL_2, high: 0, points: pts };
  }

  // 3张牌
  if (cards.length === 3) {
    if (wildCount > 0) {
      return bestWithWilds(cards);
    }
    return evaluateThree(cards);
  }

  return { type: HAND_TYPES.NORMAL_2, high: 0, points: 0 };
}

// 比较两手牌
function compare(a, b, cardsA, cardsB) {
  const multA = getMulti(a.type, cardsA || []);
  const multB = getMulti(b.type, cardsB || []);

  // 零点 vs 双鬼：零点赢，10倍
  if (a.type === HAND_TYPES.ZERO_POINTS && b.type === HAND_TYPES.DOUBLE_JOKER) {
    return { result: 1, multiplier: 10 };
  }
  if (b.type === HAND_TYPES.ZERO_POINTS && a.type === HAND_TYPES.DOUBLE_JOKER) {
    return { result: -1, multiplier: 10 };
  }

  // 不同类型
  if (a.type !== b.type) {
    const winner = a.type > b.type ? a : b;
    const winnerMult = a.type > b.type ? multA : multB;
    return { result: a.type > b.type ? 1 : -1, multiplier: winnerMult };
  }

  // 同类型
  if (a.type === HAND_TYPES.DOUBLE_JOKER) return { result: 0, multiplier: 0 };

  // 天公：同点数平局（不管同不同花）
  if (a.type === HAND_TYPES.TIANGONG_9 || a.type === HAND_TYPES.TIANGONG_8) {
    return { result: 0, multiplier: 0 };
  }

  // 豹子
  if (a.type === HAND_TYPES.THREE_KIND) {
    if (a.high !== b.high) return { result: a.high > b.high ? 1 : -1, multiplier: 8 };
    return { result: 0, multiplier: 0 };
  }

  // 同花顺/顺子：比最大牌
  if (a.type === HAND_TYPES.STRAIGHT_FLUSH || a.type === HAND_TYPES.MIXED_STRAIGHT) {
    if (a.high !== b.high) return { result: a.high > b.high ? 1 : -1, multiplier: MULTIPLIERS[a.type] };
    return { result: 0, multiplier: 0 };
  }

  // 同花3张
  if (a.type === HAND_TYPES.SUIT_THREE) {
    if (a.points !== b.points) return { result: a.points > b.points ? 1 : -1, multiplier: 3 };
    if (a.high !== b.high) return { result: a.high > b.high ? 1 : -1, multiplier: 3 };
    return { result: 0, multiplier: 0 };
  }

  // 同花2张
  if (a.type === HAND_TYPES.SUIT_PAIR) {
    if (a.points !== b.points) return { result: a.points > b.points ? 1 : -1, multiplier: 2 };
    return { result: 0, multiplier: 0 };
  }

  // 普通点数（含补牌后9~1点、零点）
  if (a.points !== b.points) return { result: a.points > b.points ? 1 : -1, multiplier: 1 };
  return { result: 0, multiplier: 0 };
}

module.exports = { HAND_TYPES, HAND_NAMES, MULTIPLIERS, evaluate, compare, getMulti };
