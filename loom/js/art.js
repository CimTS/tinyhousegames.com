// All Loom art is drawn here as inline SVG. A thread tile is a small woven
// swatch: warp yarns (vertical) and weft yarns (horizontal) passing over and
// under each other. Tier changes the weave, so tier is readable without color:
//   tier 1  plain weave  – 4 chunky yarns, simple over-under
//   tier 2  twill        – 6 yarns, a diagonal rib
//   tier 3  tapestry     – 8 fine yarns with a woven diamond motif
import { PALETTES } from "./palettes.js";

const NS = "http://www.w3.org/2000/svg";
export const svgEl = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
};

let palette = PALETTES[0];
export function setPalette(p) { palette = p; }
export function getPalette() { return palette; }
export const colorName = c => palette.colors[c].name;

// Shared gradients and textures, installed once into a hidden <svg> so every
// tile references the same ids (no duplicated ids per tile).
export function installDefs(doc = document) {
  if (doc.getElementById("loom-defs")) return;
  const host = svgEl("svg", { id: "loom-defs", width: 0, height: 0, "aria-hidden": "true", style: "position:absolute" });
  const d = svgEl("defs");
  // Rounded-yarn shading: bright crown, darker flanks.
  const shade = (id, x2, y2) => {
    const g = svgEl("linearGradient", { id, x1: 0, y1: 0, x2, y2 });
    [["0", "#000", .32], [".28", "#fff", .10], [".5", "#fff", .26], [".72", "#fff", .06], ["1", "#000", .38]]
      .forEach(([o, c, a]) => g.append(svgEl("stop", { offset: o, "stop-color": c, "stop-opacity": a })));
    d.append(g);
  };
  shade("yarn-v", 1, 0);   // warp: shaded across its width
  shade("yarn-h", 0, 1);   // weft
  // Ply twist: fine diagonal strokes, opposite directions for warp and weft.
  const twist = (id, path) => {
    const p = svgEl("pattern", { id, width: 6, height: 6, patternUnits: "userSpaceOnUse" });
    p.append(svgEl("path", { d: path, stroke: "#000", "stroke-opacity": .16, "stroke-width": 1.1, "stroke-linecap": "round" }));
    d.append(p);
  };
  twist("ply-v", "M-1 7 7 -1M-4 4 4 -4M2 10 10 2");
  twist("ply-h", "M-1 -1 7 7M-4 2 4 10M2 -4 10 4");
  host.append(d);
  doc.body.prepend(host);
}

const WEAVES = {
  1: { n: 4, over: (r, c) => (r + c) % 2 === 0 },
  2: { n: 6, over: (r, c) => ((c - r) % 4 + 4) % 4 < 2 },
  3: { n: 8, over: (r, c) => (r + c) % 2 === 0 }
};
// Tier 3 lozenge (a kilim motif): a diamond outline and a center eye where
// the light weft floats on top of the warp.
const motif = (r, c, n) => {
  const d = Math.abs(r - (n - 1) / 2) + Math.abs(c - (n - 1) / 2);
  return d === 1 || d === 4;
};

// Draws one swatch into `g` covering the square (x, y, size).
// seamless: yarns run edge to edge (tapestry); otherwise yarn ends show.
function weave(g, tile, x, y, size, seamless) {
  const col = palette.colors[tile.c];
  const { n, over } = WEAVES[tile.t] || WEAVES[1];
  const inset = seamless ? 0 : size * 0.07;
  const span = size - inset * 2;
  const pitch = span / n, w = pitch * (tile.t === 1 ? .8 : .84);
  const off = (pitch - w) / 2, rx = w / 2;
  const warpFill = tile.t === 3 ? col.hex : col.hex;
  const weftFill = tile.t === 1 ? col.dark : tile.t === 2 ? col.light : col.dark;
  const ends = seamless ? 0 : size * 0.045;

  const yarn = (vertical, fill, gx, gy, gw, gh, round = true) => {
    const a = { x: gx, y: gy, width: gw, height: gh, rx: round ? rx : 0 };
    g.append(svgEl("rect", { ...a, fill }));
    g.append(svgEl("rect", { ...a, fill: `url(#ply-${vertical ? "v" : "h"})` }));
    g.append(svgEl("rect", { ...a, fill: `url(#yarn-${vertical ? "v" : "h"})` }));
  };

  // Full weft rows first (under layer), warp columns on top, then weft
  // segments re-drawn wherever the weft passes over the warp.
  for (let r = 0; r < n; r++) {
    const fill = weftFill;
    yarn(false, fill, x + inset - ends, y + inset + r * pitch + off, span + ends * 2, w, !seamless);
  }
  for (let c = 0; c < n; c++) {
    yarn(true, warpFill, x + inset + c * pitch + off, y + inset - ends, w, span + ends * 2, !seamless);
  }
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const inMotif = tile.t === 3 && motif(r, c, n);
    const weftOver = tile.t === 3 ? inMotif : !over(r, c);
    if (!weftOver) continue;
    const fill = inMotif ? col.light : weftFill;
    // Extend slightly past the warp so the float covers it cleanly.
    const gx = x + inset + c * pitch - pitch * .02, gy = y + inset + r * pitch + off;
    yarn(false, fill, gx, gy, pitch * 1.04, w, false);
    // Soft shadow where the float tucks back under the next warp.
    g.append(svgEl("rect", { x: gx + pitch * .98, y: gy + w * .1, width: pitch * .06, height: w * .8, fill: "#000", "fill-opacity": .18 }));
  }
}

export function tileSvg(tile, label = true) {
  const svg = svgEl("svg", { viewBox: "0 0 100 100", class: `tile tier-${tile.t}` });
  if (label) { svg.setAttribute("role", "img"); svg.setAttribute("aria-label", `${colorName(tile.c)} thread, tier ${tile.t}`); }
  else svg.setAttribute("aria-hidden", "true");
  const col = palette.colors[tile.c];
  // The backing shows through gaps: a deep tone of the same dye reads as depth.
  svg.append(svgEl("rect", { x: 3, y: 3, width: 94, height: 94, rx: 12, fill: col.dark }));
  svg.append(svgEl("rect", { x: 3, y: 3, width: 94, height: 94, rx: 12, fill: "#000", "fill-opacity": .22 }));
  const g = svgEl("g", { class: "weave" });
  weave(g, tile, 0, 0, 100, false);
  svg.append(g);
  svg.append(svgEl("rect", { x: 3, y: 3, width: 94, height: 94, rx: 12, fill: "none", stroke: "#000", "stroke-opacity": .18, "stroke-width": 1.5 }));
  if (tile.t === 3) {
    // A fine running stitch in gold thread marks a finished braid.
    svg.append(svgEl("rect", { x: 5.5, y: 5.5, width: 89, height: 89, rx: 10, fill: "none", stroke: "#F1CF7A", "stroke-width": 1.6, "stroke-dasharray": "4 3", "stroke-opacity": .95 }));
  }
  svg.append(colorMark(tile.c));
  return svg;
}

// A small stitched symbol per color so colors are distinguishable without
// relying on hue (shown when "Color symbols" is on; hidden by CSS otherwise).
const MARKS = [
  "M0 -6a6 6 0 1 0 0.01 0Z",                 // circle
  "M-5.5 -5.5h11v11h-11Z",                    // square
  "M0 -7 6.5 5h-13Z",                         // triangle
  "M0 -7 7 0 0 7-7 0Z",                       // diamond
  "M-2.2 -7h4.4v4.8h4.8v4.4h-4.8V7h-4.4V2.2h-4.8v-4.4h4.8Z" // cross
];
function colorMark(c) {
  const g = svgEl("g", { class: "color-mark", transform: "translate(81 81) scale(.85)" });
  g.append(svgEl("circle", { r: 10, fill: "#FFFDF8", "fill-opacity": .92, stroke: "#2B2A28", "stroke-opacity": .5, "stroke-width": 1 }));
  g.append(svgEl("path", { d: MARKS[c], fill: "#2B2A28" }));
  return g;
}

export function cardIcon(type) {
  const svg = svgEl("svg", { viewBox: "0 0 28 28", "aria-hidden": "true" });
  const paths = {
    line: "M3 14h22M3 9.5h22M3 18.5h22",
    cluster: "M6 6h7v7H6zM15 6h7v7h-7zM6 15h7v7H6zM15 15h7v7h-7z",
    diagonal: "M4 24 24 4M8.5 24 24 8.5M4 19.5 19.5 4",
    corners: "M4 4h6v6H4zM18 4h6v6h-6zM4 18h6v6H4zM18 18h6v6h-6z",
    cross: "M11 3h6v7h-6zM11 18h6v7h-6zM3 11h7v6H3zM18 11h7v6h-7zM11 11h6v6h-6z",
    tiers: "M4 23h5V12H4zM11.5 23h5V7h-5zM19 23h5V3h-5z",
    rainbow: "M3 22a11 11 0 0 1 22 0M7 22a7 7 0 0 1 14 0M11 22a3 3 0 0 1 6 0",
    weave: "M4 4h20v20H4zM4 11h20M4 17h20M11 4v20M17 4v20"
  };
  svg.append(svgEl("path", { d: paths[type] || paths.line }));
  return svg;
}

// The finished piece: one continuous cloth on a wooden dowel, with fringe
// tied from the bottom row's warp. Cells abut so it reads as a single weave.
// With `lights`, each woven square also gets a soft light that the finish screen
// turns on while that square's note is sounding.
export function patternSvg(cells, { animate = false, lights = false } = {}) {
  const svg = svgEl("svg", { viewBox: "-14 -26 278 318", class: "tapestry" + (animate ? " weaving" : ""), role: "img", "aria-label": "Finished five by five woven tapestry" });
  // hanging cord
  svg.append(svgEl("path", { d: "M14 -14 125 -24 236 -14", fill: "none", stroke: "#8A6A4A", "stroke-width": 2, "stroke-linecap": "round" }));
  // cloth backing
  svg.append(svgEl("rect", { x: 0, y: 0, width: 250, height: 250, fill: "#3A332B" }));
  cells.forEach((tile, i) => {
    const row = Math.floor(i / 5), g = svgEl("g", { class: "tapestry-row", style: `--row:${row}` });
    if (tile) weave(g, tile, (i % 5) * 50, row * 50, 50, true);
    else g.append(svgEl("rect", { x: (i % 5) * 50, y: row * 50, width: 50, height: 50, fill: "#E8DCC8" }));
    svg.append(g);
  });
  if (lights) cells.forEach((tile, i) => {
    if (tile) svg.append(svgEl("rect", {
      class: "tune-light", "data-index": i, x: (i % 5) * 50 + 2.5, y: Math.floor(i / 5) * 50 + 2.5, width: 45, height: 45, rx: 6,
      fill: "#FFF6DC", "fill-opacity": .22, stroke: "#FFF6DC", "stroke-width": 3
    }));
  });
  // selvedge shadow along the sides and a soft hem at the top
  svg.append(svgEl("rect", { x: 0, y: 0, width: 250, height: 250, fill: "none", stroke: "#000", "stroke-opacity": .25, "stroke-width": 2 }));
  // fringe: one tassel per bottom warp group, in that cell's dye
  for (let k = 0; k < 20; k++) {
    const cell = cells[20 + Math.floor(k / 4)];
    const col = cell ? palette.colors[cell.c] : { hex: "#C9B79C", dark: "#9C8A70" };
    const x = k * 12.5 + 6.25, sway = (k % 3) - 1;
    svg.append(svgEl("path", { d: `M${x} 250q${sway * 2} 9 ${sway} 22`, stroke: col.dark, "stroke-width": 4.2, fill: "none", "stroke-linecap": "round", class: "fringe" }));
    svg.append(svgEl("path", { d: `M${x} 250q${sway * 2} 9 ${sway} 22`, stroke: col.hex, "stroke-width": 2.4, fill: "none", "stroke-linecap": "round", class: "fringe" }));
  }
  svg.append(svgEl("rect", { x: 0, y: 249, width: 250, height: 4, fill: "#000", "fill-opacity": .2 }));
  // wooden dowel
  svg.append(svgEl("rect", { x: -10, y: -11, width: 270, height: 13, rx: 6.5, fill: "#9A7350" }));
  svg.append(svgEl("rect", { x: -10, y: -9, width: 270, height: 4, rx: 2, fill: "#fff", "fill-opacity": .22 }));
  svg.append(svgEl("rect", { x: -10, y: -11, width: 270, height: 13, rx: 6.5, fill: "none", stroke: "#5E4128", "stroke-opacity": .6 }));
  for (const x of [-9, 259]) svg.append(svgEl("circle", { cx: x, cy: -4.5, r: 7.5, fill: "#86613F", stroke: "#5E4128", "stroke-opacity": .7 }));
  return svg;
}
