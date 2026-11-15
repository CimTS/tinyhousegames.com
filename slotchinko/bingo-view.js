/* Slotchinko bingo, on the page: the Bingo tab of the Collection sheet, and the small banners that say a square
   was daubed or a line finished. Cards and squares: bingo-data.js. What is daubed: Prefs in overlays.js. */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const SHORT = { sonny: "SONNY", undertow: "UNDERTOW", mirror: "MIRROR", house: "THE HOUSE", lou: "LOU" };
  const HOW =
    "Each square is a feat. Pull one off and it is daubed for good. Five in a row is a bingo. " +
    "Every line pays a prize: pick a star to see it. Pink squares are rush wins: A1 is Ascension 1. " +
    "Pick a square to see how to earn it.";
  // Which line each star around the grid stands for (indexes into BINGO.LINES: rows 0-4, columns 5-9, diagonals 10-11).
  // A star is a button: picking it says what that line pays.
  const star = (card, i, name, pick) => {
    const done = card.lines[i],
      classes = `bingo-star ${done ? "is-done" : ""} ${pick.line === i ? "is-on" : ""}`,
      label = `${name}${done ? ", finished" : ""}`;
    return `<button type="button" class="${classes}" data-bingo-line="${i}" aria-label="${label}">${done ? "★" : "☆"}</button>`;
  };
  /* What a prize is, in words. */
  const prizeText = z =>
    z.kind === "title"
      ? `the title “${z.name}”. Wear it from Your Prizes.`
      : z.kind === "felt"
        ? `the ${z.name} for your board. Wear it from Your Prizes.`
        : `${z.name} (${z.what}). ${z.note}`;

  /* The Bingo tab. pick: { card, square } as last chosen on this sheet. */
  function render(prefs, pick) {
    const D = window.SlotchinkoData,
      B = D.BINGO,
      art = window.SlotchinkoBossArt || {},
      states = Object.fromEntries(B.CARDS.map(c => [c.id, prefs.card(c.id)])),
      // squares daubed since their card was last looked at
      news = prefs.data.bingoNew || [],
      def = B.CARDS.find(c => c.id === pick.card) || B.CARDS[0],
      card = states[def.id],
      squares = Object.values(states).reduce((n, c) => n + c.count, 0),
      lines = Object.values(states).reduce((n, c) => n + c.lines.filter(Boolean).length, 0);
    $("collection-count").textContent =
      `${squares}/${B.CARDS.length * 25} SQUARES · ${lines}/${B.CARDS.length * B.LINES.length} LINES`;
    const tabs = B.CARDS.map(c => {
      const on = c.id === def.id,
        face = `<span class="bingo-face">${art[c.boss || "host"] || ""}</span>`,
        fresh = c.squares.some(q => news.includes(q.id)),
        attrs = `class="bingo-tab ${on ? "is-on" : ""} ${fresh ? "has-new" : ""}" data-bingo-card="${c.id}" aria-pressed="${on}"`;
      return `<button type="button" ${attrs}>${face}<b>${SHORT[c.id]}</b><small>${states[c.id].count}/25</small></button>`;
    }).join("");
    const cell = (q, i) => {
      const hit = card.hit[i],
        on = pick.square === i,
        tag = q.rush ? `<i>A${q.rush}</i>` : "",
        fresh = news.includes(q.id),
        classes = `bingo-sq ${hit ? "is-hit" : ""} ${q.rush ? "is-rush" : ""} ${on ? "is-on" : ""} ${fresh ? "is-new" : ""}`,
        label = `${q.name}${hit ? ", daubed" : ""}${fresh ? ", new" : ""}`;
      return (
        `<button type="button" class="${classes}" data-bingo-square="${i}" aria-pressed="${on}" aria-label="${label}">` +
        // a hyphen that does not break, so Two-Tone and Walk-In stay whole
        `${tag}<span>${q.name.replace(/-/g, "\u2011")}</span></button>`
      );
    };
    let grid =
      [..."BINGO"].map(c => `<span class="bingo-letter">${c}</span>`).join("") + star(card, 11, B.LINES[11].name, pick);
    for (let r = 0; r < 5; r++) {
      const row = def.squares.slice(r * 5, r * 5 + 5);
      grid += row.map((q, c) => cell(q, r * 5 + c)).join("") + star(card, r, B.LINES[r].name, pick);
    }
    grid += [5, 6, 7, 8, 9, 10].map(i => star(card, i, B.LINES[i].name, pick)).join("");
    const q = def.squares[pick.square],
      got = q && card.hit[pick.square],
      tally = q?.tally && !got ? ` ${Math.min(q.need, prefs.data.tally?.[q.tally] || 0)}/${q.need} so far.` : "",
      // a picked line (a star) or the blackout: what it pays, or that it is still a secret
      black = pick.line === "blackout",
      line = black ? { name: "BLACKOUT" } : B.LINES[pick.line],
      paid = black ? card.blackout : card.lines[pick.line],
      prize = black ? def.blackout : def.prizes[pick.line],
      secret = black ? "Daub all 25 squares to find out what it pays." : "Finish this line to find out what it pays.",
      detail = q
        ? `<b>${q.name.toUpperCase()}${got ? " · DAUBED" : ""}</b>${q.desc}${tally}`
        : line
          ? `<b>${line.name}${paid ? " · PAID" : ""}</b>${paid ? `Paid ${prizeText(prize)}` : secret}`
          : `<b>HOW IT WORKS</b>${HOW}`,
      done = card.lines.filter(Boolean).length,
      note = `${card.count}/25 DAUBED · ${done} LINE${done === 1 ? "" : "S"}`,
      blackClass = `bingo-black ${card.blackout ? "is-done" : ""} ${black ? "is-on" : ""}`,
      blackout =
        `<button type="button" class="${blackClass}" data-bingo-line="blackout">` +
        `${card.blackout ? "★" : "☆"} BLACKOUT</button>`;
    // Your Prizes: everything paid so far that can be worn. Titles and felts toggle on a press.
    const all = prefs.prizes(),
      of = kind => all.filter(p => p.prize.kind === kind).map(p => p.prize),
      chip = (kind, value, label, on) =>
        `<button type="button" class="bingo-wear ${on ? "is-on" : ""}" data-bingo-wear="${kind}" data-value="${value}" ` +
        `aria-pressed="${on}">${label}</button>`,
      titles = of("title").map(z => chip("title", z.name, z.name, prefs.title() === z.name)),
      felts = of("felt").map(z => chip("felt", z.id, z.name, prefs.felt() === z.id)),
      opened = of("unlock").map(z => `<span class="bingo-won">${z.name}</span>`),
      group = (name, list) => (list.length ? `<div><small>${name}</small>${list.join("")}</div>` : ""),
      groups = group("TITLES · PICK ONE TO WEAR", titles) + group("FELTS", felts) + group("OPENED", opened),
      prizes = all.length ? `<section class="bingo-prizes"><b>YOUR PRIZES</b>${groups}</section>` : "";
    // On a phone the parts stack (cards, grid, feat, prizes); on a desktop the cards and the feat sit beside the grid.
    $("collection-body").innerHTML = `<div class="bingo">
      <div class="bingo-tabs">${tabs}</div>
      <section class="bingo-card ${card.blackout ? "is-blackout" : ""}">
        <div class="bingo-title"><b>${def.title}</b><small>${note}</small></div>
        <div class="bingo-grid">${grid}</div>
        ${blackout}
      </section>
      <p class="bingo-detail">${detail}</p>
      ${prizes}
    </div>`;
    fit();
  }
  /* Every name has to sit inside its daub: a circle inset 7% in the square (polish.css), so 43% of it in radius.
     This steps the type down, square by square, until every line of the name is inside that circle with room to
     spare from its ring, measured from where the letters really are. Blank squares are fitted the same way, so
     daubing one never changes its lettering. */
  const GAP = 0.045;
  function inside(sq, name) {
    const box = sq.getBoundingClientRect(),
      cx = box.left + box.width / 2,
      cy = box.top + box.height / 2,
      // the ring is 2px wide; the letters stay GAP of the square's width inside it, and never less than 2.5px
      reach = box.width * 0.43 - 2 - Math.max(2.5, box.width * GAP),
      range = document.createRange();
    range.selectNodeContents(name);
    return [...range.getClientRects()].every(r =>
      [r.left, r.right].every(x => [r.top, r.bottom].every(y => Math.hypot(x - cx, y - cy) <= reach))
    );
  }
  function fit() {
    for (const sq of $("collection-body").querySelectorAll(".bingo-sq")) {
      const name = sq.querySelector("span");
      if (!name || !sq.clientWidth) continue;
      name.style.fontSize = "";
      name.style.width = "";
      const start = parseFloat(window.getComputedStyle(name).fontSize);
      // A narrower column breaks a long name onto more lines, which often lets the letters be bigger: try a few
      // widths and keep whichever fits at the largest size.
      let best = { size: 0, width: "" };
      for (const width of ["88%", "74%", "60%", "48%"]) {
        name.style.width = width;
        let size = start;
        name.style.fontSize = `${size}px`;
        while (size > 4 && !inside(sq, name)) {
          size -= 0.25;
          name.style.fontSize = `${size}px`;
        }
        if (size > best.size) best = { size, width };
        if (size === start) break;
      }
      name.style.width = best.width;
      name.style.fontSize = `${best.size}px`;
    }
  }
  window.addEventListener?.("resize", () => $("collection-body")?.querySelector?.(".bingo-sq") && fit());

  /* Banners for what was just daubed (Prefs.daub's list): one per square, a bigger one for a line or a blackout.
     They queue, so a fight that earns four squares shows four in turn. */
  const queue = [];
  let busy = false;
  function next(view) {
    const n = queue.shift();
    if (!n) return void (busy = false);
    busy = true;
    let box = $("daubs");
    if (!box) {
      box = document.createElement("div");
      box.id = "daubs";
      box.className = "daubs";
      box.setAttribute("role", "status");
      document.body.append(box);
    }
    // A banner is a button: it opens its card in the Collection, on the square it names.
    const el = document.createElement("button"),
      big = n.kind !== "square",
      head = n.kind === "square" ? n.square.name : n.kind === "line" ? `BINGO · ${n.line.name}` : "BLACKOUT";
    el.type = "button";
    el.className = `daub-pop ${big ? "is-line" : ""}`;
    el.addEventListener("click", () => {
      // The card is about to show everything that is new, so the banners still waiting are not needed.
      queue.length = 0;
      box.replaceChildren();
      api.onOpen?.(n.card.id, n.kind === "square" ? n.card.squares.indexOf(n.square) : null);
    });
    el.innerHTML =
      `<i aria-hidden="true">${big ? "★" : "✦"}</i>` +
      `<span><b>${head.toUpperCase()}</b>` +
      `<small>${n.prize ? `PRIZE: ${n.prize.name.toUpperCase()}` : n.card.title}</small></span>`;
    box.append(el);
    if (big) view?.vibrate?.([40, 60, 120]);
    window.setTimeout(() => el.remove(), big ? 5200 : 4200);
    window.setTimeout(() => next(view), 550);
  }
  function pop(news, view) {
    if (!news?.length) return;
    queue.push(...news);
    if (!busy) next(view);
  }

  // onOpen is set by ui.js: what a pressed banner does.
  const api = { render, pop, onOpen: null };
  window.SlotchinkoBingoView = api;
})();
