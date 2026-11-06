export function countMatches(
  selected: number[],

  draw: number[],
) {
  let matches = 0;

  for (const number of selected) {
    if (draw.includes(number)) {
      matches++;
    }
  }

  return matches;
}
