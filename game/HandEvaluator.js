const HAND_TYPES = {
  DOUBLE_JOKER: 10,
  ZERO_POINTS: 9,
  STRAIGHT_FLUSH: 8,
  THREE_KIND: 7,
  MIXED_STRAIGHT: 6,
  SUIT_THREE: 5,
  SUIT_TIANGONG: 4,
  TIANGONG: 3,
  SUIT_PAIR: 2,
  NORMAL: 0
};

const HAND_NAMES = {
  10: '双鬼至尊',
  9: '零点',
  8: '同花顺',
  7: '豹子',
  6: '杂顺子',
  5: '同花3张',
  4: '同花天公',
  3: '天公',
  2: '同花2张',
  0: '普通点数'
};

const MULTIPLIERS = {
  10: 10, // 双鬼
  9: 1,   // 0点（赢双鬼时按10倍）
  8: 6,   // 同花顺
  7: 8,   // 豹子
  6: 4,   // 杂顺子
  5: 3,   // 同花3张
  4: 2,   // 同花天公
  3: 1,   // 天公
  2: 2,   // 同花2张
  0: 1    // 普通点数
};

function rankOrder(rank) {
  if (rank === 'A') return 1;
  if (rank === 'J') return 11;
  if (rank === 'Q') return 12;
  if (rank === 'K') return 13;
  return parseInt(rank);
}

// K-A-2 也算顺子
function isConsecutive(orders) {
  const sorted = [...orders].sort((a, b) => a - b);
  if (sorted[2] - sorted[1] === 1 && sorted[1] - sorted[0] === 1) return true;
  if (sorted[0] === 1 && sorted[1] === 12 && sorted[2] === 13) return true; // Q-K-A
  if (sorted[0] === 1 && sorted[1] === 2 && sorted[2] === 13) return true;  // K-A-2
  return false;
}

function getStraightHigh(orders) {
  const sorted = [...orders].sort((a, b) => a - b);
  if (sorted[0] === 1 && sorted[1] === 12 && sorted[2] === 13) return 14; // Q-K-A
  if (sorted[0] === 1 && sorted[1] === 2 && sorted[2] === 13) return 13;  // K-A-2
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

  // 同花顺
  if (allSameSuit && consecutive) {
    return { type: HAND_TYPES.STRAIGHT_FLUSH, high: getStraightHigh(orders), points: 0 };
  }
  // 豹子
  if (allSameRank) {
    return { type: HAND_TYPES.THREE_KIND, high: values[0], points: 0 };
  }
  // 杂顺子
  if (consecutive) {
    return { type: HAND_TYPES.MIXED_STRAIGHT, high: getStraightHigh(orders), points: 0 };
  }
  // 同花3张（同花色但不是同花顺）
  if (allSameSuit) {
    const pts = values.reduce((s, v) => s + v, 0) % 10;
    return { type: HAND_TYPES.SUIT_THREE, high: Math.max(...orders), points: pts };
  }
  // 普通点数
  const pts = values.reduce((s, v) => s + v, 0) % 10;
  return { type: HAND_TYPES.NORMAL, high: 0, points: pts };
}

function nonJokers(cards) {
  return cards.filter(c => !c.isJoker);
}

const ALL_RANKS_FOR_WILD = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const ALL_SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];

function bestWithJokers(cards) {
  const jokers = cards.filter(c => c.isJoker);
  const normals = nonJokers(cards);

  if (jokers.length === 2) {
    return { type: HAND_TYPES.DOUBLE_JOKER, high: 99, points: 0 };
  }

  if (jokers.length === 1) {
    let best = { type: HAND_TYPES.NORMAL, high: 0, points: 0 };
    for (const suit of ALL_SUITS) {
      for (const rank of ALL_RANKS_FOR_WILD) {
        const fakeJoker = {
          suit, rank,
          value: rank === 'A' ? 1 : ['J', 'Q', 'K'].includes(rank) ? 10 : parseInt(rank),
          isJoker: false
        };
        const combo = [...normals, fakeJoker];
        const result = evaluateThree(combo);
        if (result.type > best.type ||
            (result.type === best.type && result.high > best.high) ||
            (result.type === best.type && result.high === best.high && result.points > best.points)) {
          best = result;
        }
      }
    }
    return best;
  }

  return evaluateThree(cards);
}

function evaluate(cards) {
  const jokerCount = cards.filter(c => c.isJoker).length;

  // 双鬼（2张或3张都可能）
  if (cards.length >= 2 && jokerCount >= 2) {
    return { type: HAND_TYPES.DOUBLE_JOKER, high: 99, points: 0 };
  }

  // 2张牌
  if (cards.length === 2) {
    if (jokerCount > 0) {
      // 单鬼 + 1张普通牌 → 同花2张（百搭同花色）
      const normal = cards.find(c => !c.isJoker);
      return { type: HAND_TYPES.SUIT_PAIR, high: rankOrder(normal.rank), points: normal.value % 10 };
    }
    // 两张普通牌
    const pts = cards.reduce((s, c) => s + c.value, 0) % 10;
    const sameSuit = cards[0].suit === cards[1].suit;
    const isTianGong = pts === 9 || pts === 8;
    // 同花天公：同花色 + 天公点数 → 2倍
    if (sameSuit && isTianGong) {
      return { type: HAND_TYPES.SUIT_TIANGONG, high: Math.max(rankOrder(cards[0].rank), rankOrder(cards[1].rank)), points: pts };
    }
    // 普通天公
    if (isTianGong) {
      return { type: HAND_TYPES.TIANGONG, high: 0, points: pts };
    }
    // 同花2张（同花色但非天公）
    if (sameSuit) {
      return { type: HAND_TYPES.SUIT_PAIR, high: Math.max(rankOrder(cards[0].rank), rankOrder(cards[1].rank)), points: pts };
    }
    return { type: HAND_TYPES.NORMAL, high: 0, points: pts };
  }

  // 3张牌
  if (cards.length === 3) {
    if (jokerCount > 0) {
      return bestWithJokers(cards);
    }
    const result = evaluateThree(cards);
    // 检查0点
    if (result.type === HAND_TYPES.NORMAL && result.points === 0) {
      return { type: HAND_TYPES.ZERO_POINTS, high: 0, points: 0 };
    }
    return result;
  }

  return { type: HAND_TYPES.NORMAL, high: 0, points: 0 };
}

// 返回 { result: 1|-1|0, multiplier: 赢家的倍率 }
function compare(a, b) {
  // 双鬼 vs 0点：0点赢
  if (a.type === HAND_TYPES.DOUBLE_JOKER && b.type === HAND_TYPES.ZERO_POINTS) {
    return { result: -1, multiplier: 10 };
  }
  if (b.type === HAND_TYPES.DOUBLE_JOKER && a.type === HAND_TYPES.ZERO_POINTS) {
    return { result: 1, multiplier: 10 };
  }
  // 双鬼 vs 其他：双鬼赢
  if (a.type === HAND_TYPES.DOUBLE_JOKER && b.type !== HAND_TYPES.DOUBLE_JOKER) {
    return { result: 1, multiplier: MULTIPLIERS[a.type] };
  }
  if (b.type === HAND_TYPES.DOUBLE_JOKER && a.type !== HAND_TYPES.DOUBLE_JOKER) {
    return { result: -1, multiplier: MULTIPLIERS[b.type] };
  }

  // 不同类型，高者赢
  if (a.type !== b.type) {
    const winner = a.type > b.type ? a : b;
    return { result: a.type > b.type ? 1 : -1, multiplier: MULTIPLIERS[winner.type] };
  }

  // 同类型比较
  if (a.type === HAND_TYPES.DOUBLE_JOKER) return { result: 0, multiplier: 0 };

  if (a.type === HAND_TYPES.STRAIGHT_FLUSH || a.type === HAND_TYPES.MIXED_STRAIGHT) {
    if (a.high !== b.high) return { result: a.high > b.high ? 1 : -1, multiplier: MULTIPLIERS[a.type] };
    return { result: 0, multiplier: 0 };
  }
  if (a.type === HAND_TYPES.THREE_KIND) {
    if (a.high !== b.high) return { result: a.high > b.high ? 1 : -1, multiplier: MULTIPLIERS[a.type] };
    return { result: 0, multiplier: 0 };
  }
  if (a.type === HAND_TYPES.SUIT_THREE) {
    if (a.points !== b.points) return { result: a.points > b.points ? 1 : -1, multiplier: MULTIPLIERS[a.type] };
    if (a.high !== b.high) return { result: a.high > b.high ? 1 : -1, multiplier: MULTIPLIERS[a.type] };
    return { result: 0, multiplier: 0 };
  }
  if (a.type === HAND_TYPES.SUIT_TIANGONG || a.type === HAND_TYPES.TIANGONG) {
    if (a.points !== b.points) return { result: a.points > b.points ? 1 : -1, multiplier: MULTIPLIERS[a.type] };
    if (a.high !== b.high) return { result: a.high > b.high ? 1 : -1, multiplier: MULTIPLIERS[a.type] };
    return { result: 0, multiplier: 0 };
  }
  if (a.type === HAND_TYPES.SUIT_PAIR) {
    if (a.points !== b.points) return { result: a.points > b.points ? 1 : -1, multiplier: MULTIPLIERS[a.type] };
    if (a.high !== b.high) return { result: a.high > b.high ? 1 : -1, multiplier: MULTIPLIERS[a.type] };
    return { result: 0, multiplier: 0 };
  }
  // 普通/0点
  if (a.points !== b.points) return { result: a.points > b.points ? 1 : -1, multiplier: MULTIPLIERS[a.type] };
  return { result: 0, multiplier: 0 };
}

module.exports = { HAND_TYPES, HAND_NAMES, MULTIPLIERS, evaluate, compare };
