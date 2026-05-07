const { HAND_TYPES, evaluate } = require('./HandEvaluator');

function aiDecide(cards, isDealer) {
  const eval2 = evaluate(cards);

  // 双鬼/双野生 → 不补
  if (eval2.type === HAND_TYPES.DOUBLE_JOKER) return false;

  // 天公9/8 → 不补
  if (eval2.type === HAND_TYPES.TIANGONG_9 || eval2.type === HAND_TYPES.TIANGONG_8) {
    return false;
  }

  // 同花2张 → 不补
  if (eval2.type === HAND_TYPES.SUIT_PAIR) return false;

  // 有鬼/野生牌时，已有好牌就不补
  const hasWild = cards.some(c => c.isJoker || c.isWild);
  if (hasWild) {
    // 天生大牌不补
    if (eval2.type >= HAND_TYPES.THREE_KIND) return false;
    // 否则补一张搏更大
    return true;
  }

  const pts = eval2.points;
  if (pts === 0) return true;
  if (pts <= 3) return true;
  if (pts <= 5) return !isDealer;
  return false;
}

module.exports = { aiDecide };
