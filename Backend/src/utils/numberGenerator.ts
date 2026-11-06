export function generateDraw() {
  const pool = Array.from({ length: 80 }, (_, i) => i + 1);

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, 20).sort((a, b) => a - b);
}
