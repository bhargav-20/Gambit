/**
 * Build a data-URI SVG that tiles into a perfect 8×8 checkerboard. We tile a
 * 2×2 cell at 25% size, which repeats 4× per axis = 8 squares per axis.
 *
 * Why SVG instead of multiple linear-gradients: stacked gradients produced
 * diamond/diagonal artifacts that don't read as a chess board. SVG gives
 * crisp axis-aligned squares.
 */
export function checkerboardBackground(light: string, dark: string): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 2 2' shape-rendering='crispEdges'>` +
    `<rect width='2' height='2' fill='${light}'/>` +
    `<rect width='1' height='1' fill='${dark}'/>` +
    `<rect x='1' y='1' width='1' height='1' fill='${dark}'/>` +
    `</svg>`;
  return `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
}
