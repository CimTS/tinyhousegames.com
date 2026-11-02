// Title screen, field guide and mission report. Buttons are bound once in main.js;
// this module only fills content and toggles visibility.
import { icon } from "./icons.js";
import { getDailyLeaderboard, FINAL_FLOOR } from "./game.js";
import { UPGRADE_BY_ID, stacks } from "./upgrades.js";

const $ = id => document.getElementById(id);

function el(tag, className, ...kids) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  for (const k of kids) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
}
const para = html => { const p = el("p"); for (const part of html) p.append(part); return p; };
const strong = t => el("strong", "", t);

function legend(items) {
  return el("div", "legend-grid", ...items.map(([name, label, note, color]) => {
    const i = icon(name); i.style.color = color;
    return el("div", "legend-item", i, el("span", "", label, el("small", "", note)));
  }));
}

export const GUIDE = [
  ["Command your squad", () => [
    para(["You run a salvage squad of drones on a fogged site. ", strong("Pick a drone"), " (click it, or press ", el("kbd", "", "Tab"), "), ", strong("pick a command"), ", then ", strong("click a highlighted tile"), " next to it."]),
    legend([
      ["scout", "Scout", "Probes tiles safely", "var(--u-scout)"],
      ["heavy", "Heavy", "Disables bots, pushes hazards", "var(--u-heavy)"],
      ["medic", "Medic", "Unlockable: repairs", "var(--u-medic)"],
      ["engineer", "Engineer", "Unlockable: defuses", "var(--u-engineer)"]
    ])
  ]],
  ["One move + one action", () => [
    para(["Each living drone gets ", strong("one move"), " and ", strong("one action"), " per turn, in either order. Move only onto mapped, safe tiles."]),
    para(["Tapping a mapped tile next to a drone moves it. When everyone is spent, ", strong("End turn"), ". Hostile bots next to a drone will patrol or strike."]),
    para(["Find the ", strong("extraction beacon"), " and move any drone onto it before turn 30 to clear the floor."])
  ]],
  ["Read the noise", () => [
    para(["Mapped tiles show how many threats sit in the 8 tiles around them. Readings are ", strong("noisy: sometimes off by one"), ". Hotter colours mean more danger."]),
    el("div", "ramp", ...[1, 2, 3, 4, 5, 6].map(n => { const s = el("span", "", n); s.style.color = `var(--s${n})`; return s; })),
    para(["Use ", strong("Flag"), " to mark suspicions and the Scout's ", strong("Probe"), " to look before you leap."])
  ]],
  ["Know your threats", () => [
    legend([
      ["hazard", "Hazard", "1 dmg · Push to clear", "var(--amber)"],
      ["hostile", "Hostile", "1 dmg · patrols · Disable", "var(--red)"],
      ["trap", "Trap", "2 dmg when revealed", "var(--violet)"],
      ["anomaly", "Anomaly", "2 dmg · floor 3+", "var(--magenta)"],
      ["emp", "EMP", "Drains moves · floor 5+", "var(--blue)"],
      ["swarm", "Swarm", "Spreads · floor 7+", "var(--lime)"]
    ]),
    para(["Clear a floor to ", strong("draft an upgrade"), ". Upgrades stack. Build a run that snowballs."])
  ]],
  ["Controls", () => [
    el("div", "keys",
      el("span", "", el("kbd", "", "←↑↓→"), " ", el("kbd", "", "WASD")), el("span", "", "Aim the cursor"),
      el("kbd", "", "1–9"), el("span", "", "Choose a command"),
      el("span", "", el("kbd", "", "Enter"), " ", el("kbd", "", "Space")), el("span", "", "Carry out on the cursor tile"),
      el("kbd", "", "Tab"), el("span", "", "Next drone (Shift+Tab: previous)"),
      el("kbd", "", "E"), el("span", "", "End turn"),
      el("span", "", el("kbd", "", "U"), " ", el("kbd", "", "Ctrl+Z")), el("span", "", "Undo last command"),
      el("kbd", "", "?"), el("span", "", "This guide")),
    para(["On a phone, commands live in the bar at the bottom. Your run is saved automatically."])
  ]]
];

function renderTitle(state, ui) {
  const show = ui.screen === "title";
  $("titleScreen").hidden = !show;
  if (!show) return;
  const emblem = $("titleEmblem");
  if (!emblem.firstChild) emblem.append(icon("scout"));
  $("resumeBtn").hidden = !ui.hasSave;
  const meta = $("titleMeta");
  meta.replaceChildren(el("span", "", "Best floor ", el("b", "", String(ui.bestFloor ?? 1))));
  if (ui.dailyRecord) meta.append(el("br"), el("span", "", "Today's survey ", el("b", "", `floor ${ui.dailyRecord.floor} · ${ui.dailyRecord.turns} turns`)));
}

function renderGuide(ui) {
  $("guide").hidden = !ui.guideOpen;
  if (!ui.guideOpen) return;
  const [title, body] = GUIDE[ui.guideIndex];
  $("guideTitle").textContent = title;
  $("guideStep").textContent = `${ui.guideIndex + 1} / ${GUIDE.length}`;
  $("guideBody").replaceChildren(...body());
  $("guidePrev").disabled = ui.guideIndex === 0;
  $("guideNext").textContent = ui.guideIndex === GUIDE.length - 1 ? "Got it" : "Next";
}

function stat(label, value) {
  return el("div", "stat", el("span", "", label), el("strong", "", String(value)));
}

function renderResult(state, ui) {
  const show = ui.screen === "game" && state.status !== "playing" && !ui.draftOpen;
  $("result").hidden = !show;
  if (!show) return;
  const won = state.status === "won";
  const complete = state.runComplete;
  const sheet = $("result").querySelector(".sheet");
  sheet.classList.toggle("won", won);
  sheet.classList.toggle("lost", !won);
  $("resultKicker").textContent = complete ? "Run complete" : won ? `Floor ${String(state.floor).padStart(2, "0")} of ${FINAL_FLOOR} cleared` : "Run over";
  $("resultTitle").textContent = complete ? "Deep site cleared" : won ? "Extraction successful" : "Signal lost";
  $("resultText").textContent = state.message;
  const run = state.run.stats;
  const survivors = state.units.filter(u => u.alive).length;
  const items = won && !complete
    ? [stat("Turns", state.turn), stat("Damage", state.metrics.damageTaken), stat("Survivors", `${survivors}/${state.units.length}`)]
    : [stat("Floor reached", state.floor), stat("Threats cleared", run.threatsCleared), stat("Tiles mapped", run.tilesMapped),
       stat("Turns played", run.turns + (state.floorClosed ? 0 : state.turn)), stat("Damage taken", run.damageTaken), stat("Upgrades", state.run.upgrades.length)];
  $("resultStats").replaceChildren(...items);
  const chips = won && !complete ? [] : upgradeChips(state.run);
  $("resultLoadout").replaceChildren(...(chips.length ? [el("span", "owned-label", "Loadout"), ...chips] : []));
  const record = getDailyLeaderboard(state);
  $("resultRecord").textContent = record ? `Today's best: floor ${record.floor} in ${record.turns} turns · ${record.hp} HP` : "";
  $("resultContinue").textContent = won && !complete ? "Choose upgrade" : "New run";
}

export function upgradeChips(run) {
  const seen = [...new Set(run.upgrades)];
  return seen.map(id => {
    const up = UPGRADE_BY_ID[id];
    const n = stacks(run, id);
    const chip = el("span", `owned r-${up.rarity}`, icon(up.icon, { size: 14 }), up.name + (n > 1 ? ` ×${n}` : ""));
    chip.title = up.desc;
    return chip;
  });
}

function renderDraft(state, ui, handlers) {
  $("draft").hidden = !ui.draftOpen;
  if (!ui.draftOpen) return;
  $("draftKicker").textContent = `Floor ${String(state.floor).padStart(2, "0")} cleared · next: floor ${String(state.floor + 1).padStart(2, "0")}`;
  const cards = ui.offer.map((up, i) => {
    const n = stacks(state.run, up.id);
    const b = el("button", `upgrade ${up.rarity}`);
    b.type = "button";
    b.style.setProperty("--i", i);
    b.append(el("span", "up-icon", icon(up.icon)), el("strong", "", up.name), el("p", "", up.desc),
      el("span", "up-tag", `${i + 1} · ${up.rarity === "unlock" ? "New drone" : up.rarity}${up.max > 1 && up.max <= 3 ? ` · ${n}/${up.max}` : ""}`));
    b.addEventListener("click", () => handlers.pick(up.id));
    return b;
  });
  $("draftChoices").replaceChildren(...cards);
  const owned = upgradeChips(state.run);
  $("draftOwned").replaceChildren(...(owned.length ? [el("span", "owned-label", "Loadout"), ...owned] : []));
}

export function renderOverlays(state, ui, handlers) {
  renderTitle(state, ui);
  renderGuide(ui);
  renderResult(state, ui);
  renderDraft(state, ui, handlers);
}
