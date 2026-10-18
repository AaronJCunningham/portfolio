// A reproducible shuffle bag, scored for repeat distance and repeated transitions.
// Every complete bag uses every photo once; the last bag spreads the remainder.
export function makeSequence(count, slots = 32, seed = 1) {
  if (!Number.isInteger(count) || count < 1 || count > slots || slots > 256) {
    throw new Error('Choose between 1 and 32 images.');
  }
  let state = seed >>> 0;
  const random = () => {
    state += 0x6D2B79F5;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const shuffle = () => {
    const bag = Array.from({length: count}, (_, i) => i);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  };
  let best, bestScore = Infinity;
  for (let attempt = 0; attempt < 160; attempt++) {
    const sequence = [];
    while (sequence.length < slots) {
      const bag = shuffle();
      if (count > 1 && bag[0] === sequence.at(-1)) {
        const j = 1 + Math.floor(random() * (count - 1));
        [bag[0], bag[j]] = [bag[j], bag[0]];
      }
      sequence.push(...bag.slice(0, slots - sequence.length));
    }
    let score = 0;
    const last = new Map(), transitions = new Map();
    sequence.forEach((value, index) => {
      if (last.has(value)) score += Math.max(0, count - 1 - (index - last.get(value))) ** 2 * 5;
      last.set(value, index);
      if (index) {
        const key = `${sequence[index - 1]}:${value}`;
        score += transitions.get(key) ?? 0;
        transitions.set(key, (transitions.get(key) ?? 0) + 1);
      }
      if (count > 2 && index >= count && index % count === 0 && index + count <= slots &&
        sequence.slice(index - count, index).every((v, i) => v === sequence[index + i])) score += 100;
    });
    if (score < bestScore) { best = sequence; bestScore = score; }
  }
  return best;
}
