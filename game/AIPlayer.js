const { HAND_TYPES, evaluate } = require('./HandEvaluator');

function aiDecide(cards, isDealer) {
  const wildCount = cards.filter(c => c.isJoker || c.isWild).length;

  // 双鬼/双野生 → 不补
  if (wildCount >= 2) return false;
  // 单鬼/野生 → 强制（由Room处理）
  if (wildCount === 1) return true;

  const eval2 = evaluate(cards);

  // 同花天公 / 天公 → 不补
  if (eval2.type === HAND_TYPES.SUIT_TIANGONG || eval2.type === HAND_TYPES.TIANGONG) {
    return false;
  }

  // 同花2张 → 不补
  if (eval2.type === HAND_TYPES.SUIT_PAIR) {
    return false;
  }

  const pts = eval2.points;

  if (pts === 0) return true;
  if (pts <= 3) return true;
  if (pts <= 5) return !isDealer;
  return false;
}

module.exports = { aiDecide };
