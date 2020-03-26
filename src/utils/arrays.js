/**
 * Randomly chooses a given number of elements in a given array.
 *
 * @function chooseRandomly
 *
 * @param {array} xs
 *
 *   Array from which elements are to be chosen.
 *
 * @param {number} n
 *
 *   Number of elements to be chosen.
 *
 * @return
 *
 *   New array contains `n` elements randomly chosen from `xs`.
 *
 * @memberof module:utils
 */
export function chooseRandomly (xs, n) {
  const ys = [...xs]
  for (let i = 0; i < n; ++i) {
    const chosen = Math.floor(Math.random() * (n - i))
    const tmp = ys[i]
    ys[i] = ys[chosen]
    ys[chosen] = tmp
  }
  ys.splice(n)
  return ys
}

export default {
  chooseRandomly
}
