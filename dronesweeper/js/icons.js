// Inline SVG icon set. Every icon is drawn on a 24x24 grid with currentColor
// so CSS decides the colour. No external assets.
const NS = "http://www.w3.org/2000/svg";

function node(tag, attrs) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

// Each entry is a list of [tag, attrs]. `f` marks filled shapes.
const P = (d, extra = {}) => ["path", { d, ...extra }];
const C = (cx, cy, r, extra = {}) => ["circle", { cx, cy, r, ...extra }];
const FILL = { fill: "currentColor", stroke: "none" };

const SHAPES = {
  // Units
  scout: [C(12, 12, 7.5), C(12, 12, 2.4, FILL), P("M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4")],
  heavy: [P("M12 2.5 20.5 7v10L12 21.5 3.5 17V7Z"), P("M8 10h8v5H8z"), P("M10 12.5h.01M14 12.5h.01", { "stroke-width": 2.6 })],
  medic: [P("M5 4.5h14a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18V6A1.5 1.5 0 0 1 5 4.5Z"), P("M12 8v8M8 12h8", { "stroke-width": 2.6 })],
  engineer: [C(12, 12, 3), P("M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1")],
  // Threats
  hazard: [P("M12 3 22 20H2Z"), P("M12 9.5v5", { "stroke-width": 2.4 }), C(12, 17.3, 1.2, FILL)],
  hostile: [P("M6 8.5h12a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6.5a2 2 0 0 1 2-2Z"), C(12, 13.6, 2.4, FILL), P("M12 8.5V4.5M9.5 4.5h5")],
  trap: [P("M12 2.5 21.5 12 12 21.5 2.5 12Z"), P("M8 8l8 8M16 8l-8 8")],
  anomaly: [P("M12 2.5c.8 5 4.5 8.7 9.5 9.5-5 .8-8.7 4.5-9.5 9.5-.8-5-4.5-8.7-9.5-9.5 5-.8 8.7-4.5 9.5-9.5Z"), C(12, 12, 1.6, FILL)],
  emp: [C(12, 12, 9), P("M13 5.5 8.5 13h4l-1.5 5.5 4.5-7.5h-4Z", FILL)],
  swarm: [C(7, 8, 2.4, FILL), C(16.5, 7, 2, FILL), C(12, 14, 2.6, FILL), C(6.5, 17.5, 1.7, FILL), C(17.5, 16.5, 2, FILL)],
  // Board marks
  beacon: [C(12, 12, 2.2, FILL), P("M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 19a10 10 0 0 1 0-14M19 5a10 10 0 0 1 0 14")],
  flag: [P("M6 21V3.5"), P("M6 4h11l-2.5 4 2.5 4H6Z", FILL)],
  scar: [P("M7 7l10 10M17 7 7 17", { "stroke-width": 1.6 })],
  // Commands
  move: [P("M5 19 19 5M9 5h10v10")],
  reveal: [P("M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7S2 12 2 12Z"), C(12, 12, 3)],
  probe: [C(10.5, 10.5, 6.5), P("M15.5 15.5 21 21"), P("M7.5 10.5h6M10.5 7.5v6", { "stroke-width": 1.6 })],
  attack: [P("M12 3v8"), P("M6.3 6.8a8 8 0 1 0 11.4 0")],
  push: [P("M5 18l7-6 7 6M5 12l7-6 7 6")],
  wait: [P("M9 5v14M15 5v14", { "stroke-width": 2.8 })],
  repair: [C(12, 12, 9), P("M12 7.5v9M7.5 12h9", { "stroke-width": 2.6 })],
  defuse: [C(6.5, 17.5, 3), C(17.5, 17.5, 3), P("M8.6 15.4 18 4M15.4 15.4 6 4")],
  // UI
  sound: [P("M4 9.5h3.5L12 5.5v13l-4.5-4H4z"), P("M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11")],
  muted: [P("M4 9.5h3.5L12 5.5v13l-4.5-4H4z"), P("M16 9.5l5 5M21 9.5l-5 5")],
  undo: [P("M9 14 4 9l5-5"), P("M4 9h10.5a5.5 5.5 0 0 1 0 11H11")],
  help: [C(12, 12, 9.5), P("M9.3 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.4-2.7 4"), C(12, 17.3, 1.1, FILL)],
  end: [P("M5 12h13M13 6l6 6-6 6")],
  armor: [P("M12 2.5 20 5.5v6c0 5-3.5 8.7-8 10-4.5-1.3-8-5-8-10v-6Z")],
  chain: [P("M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1")],
  boot: [P("M4 18h16M6 18V7l5 3 3-4 4 3v9")],
  battery: [P("M3.5 7.5h15v9h-15zM18.5 10.5h2v3"), P("M6.5 10.5h4v3h-4z", FILL)],
  radar: [C(12, 12, 9), C(12, 12, 4.5), P("M12 12 18.5 5.5")]
};

/** Create an SVG icon. `name` is a key of SHAPES. */
export function icon(name, { size = 24, label = null, className = "icon" } = {}) {
  const svg = node("svg", {
    viewBox: "0 0 24 24", width: size, height: size, class: className,
    fill: "none", stroke: "currentColor", "stroke-width": 1.9,
    "stroke-linecap": "round", "stroke-linejoin": "round", focusable: "false"
  });
  if (label) { svg.setAttribute("role", "img"); svg.setAttribute("aria-label", label); }
  else svg.setAttribute("aria-hidden", "true");
  for (const [tag, attrs] of SHAPES[name] || []) svg.append(node(tag, attrs));
  return svg;
}

export const ICON_NAMES = Object.keys(SHAPES);
