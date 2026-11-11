// A short lesson, paced entirely by the player: nothing advances on a timer.
// Each step either waits for one specific tap or for the Next button.
const $ = id => document.getElementById(id);

const STEPS = [
  { text: "Tap the glowing square to place your first thread.", wait: "place", cell: 12 },
  { text: "The next thread is the same color. Tap the glowing square beside it.", wait: "place", cell: 13 },
  { text: "Matching neighbors can be woven together. Tap the first thread.", wait: "select", cell: 12 },
  { text: "Now tap its neighbor. The thread you tap second is where they join.", wait: "merge", cell: 13 },
  { text: "They became a twill, a finer weave. Two twills make a tapestry thread.", wait: "next", cell: 13 },
  { text: "Weaving these patterns earns points. Tap any pattern to see how to make it.", wait: "next", focus: ".cards-panel" },
  { text: "Your next threads wait here. Undo takes back your last move. Tap it again to go back further.", wait: "next", focus: ".dock", last: true }
];

export class Tutorial {
  constructor(game) { this.game = game; this.active = false; this.step = 0; }

  start() {
    this.active = true; this.step = 0;
    document.documentElement.classList.add("tutorial-active");
    $("tutorial-banner").classList.remove("hidden");
    this.update();
  }

  stop() {
    this.active = false;
    document.documentElement.classList.remove("tutorial-active");
    $("tutorial-banner").classList.add("hidden");
    document.querySelectorAll(".dim, .tutorial-target, .tutorial-focus")
      .forEach(el => el.classList.remove("dim", "tutorial-target", "tutorial-focus"));
  }

  get current() { return STEPS[this.step]; }

  // Returns true when the tap was handled (or deliberately ignored) here.
  handleCell(index) {
    const s = this.current, g = this.game;
    if (index !== s.cell || s.wait === "next") return true;
    if (s.wait === "place") g.placeAt(index);
    else if (s.wait === "select") g.select(index);
    else if (s.wait === "merge") g.mergeInto(index);
    this.advance();
    return true;
  }

  advance() {
    if (this.current.last) { this.stop(); this.game.finishTutorial(); return; }
    this.step++;
    this.update();
  }

  update() {
    if (!this.active) return;
    const s = this.current;
    $("tutorial-step").textContent = `Step ${this.step + 1} of ${STEPS.length}`;
    $("tutorial-text").textContent = s.text;
    const next = $("tutorial-next");
    next.classList.toggle("hidden", s.wait !== "next");
    next.innerHTML = s.last ? "Start today's piece <span aria-hidden=\"true\">→</span>" : "Next <span aria-hidden=\"true\">→</span>";
    const cells = this.game.renderer.cells;
    cells.forEach((b, i) => {
      b.classList.toggle("tutorial-target", s.cell === i && s.wait !== "next");
      b.classList.toggle("dim", s.cell !== i && this.game.renderer.selected !== i);
    });
    for (const sel of [".dock", ".cards-panel", ".rail-foot"]) {
      const el = document.querySelector(sel);
      el.classList.toggle("dim", s.focus !== sel);
      el.classList.toggle("tutorial-focus", s.focus === sel);
    }
    document.querySelector(".loom-frame").classList.toggle("dim", Boolean(s.focus));
    if (s.focus) document.querySelector(s.focus).scrollIntoView({ block: "nearest", behavior: "auto" });
    if (s.wait === "next") next.focus({ preventScroll: true });
    else if (s.cell !== undefined) {
      // Keyboard players already on the board are moved to the target.
      const onBoard = document.activeElement?.classList.contains("cell");
      this.game.renderer.cursor = s.cell; this.game.renderer.syncTabStops();
      if (onBoard) this.game.renderer.focusCursor();
    }
  }
}
