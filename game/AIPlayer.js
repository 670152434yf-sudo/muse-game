const { hasJoker } = require('./Card');
const { HAND_TYPES, evaluate } = require('./HandEvaluator');

function aiDecide(cards, isDealer) {
  const jokerCount = cards.filter(c => c.isJoker).length;

  // 双鬼 → 不补
  if (jokerCount >= 2) return false;
  // 单鬼 → 强制（由Room处理）
  if (jokerCount === 1) return true;

  const eval2 = evaluate(cards);

  // 同花天公 / 天公 → 不补
  if (eval2.type === HAND_TYPES.SUIT_TIANGONG || eval2.type === HAND_TYPES.TIANGONG) {
    return false;
  }

  // 同花2张 → 不补（已有2倍）
  if (eval2.type === HAND_TYPES.SUIT_PAIR) {
    return false;
  }

  const pts = eval2.points;

  // 点数0 → 补牌
  if (pts === 0) return true;
  // 点数1-3 → 补牌
  if (pts <= 3) return true;
  // 点数4-5 → 庄家保守不补，闲家补
  if (pts <= 5) return !isDealer;
  // 点数6-9 → 不补
  return false;
}

module.exports = { aiDecide };
