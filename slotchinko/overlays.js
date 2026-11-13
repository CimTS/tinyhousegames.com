/* Slotchinko settings, saved best score and full-screen overlays. */
(() => {
  "use strict";
  const KEY = "slotchinko-save";
  const $ = id => document.getElementById(id);
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch {
      return {};
    }
  };
  const write = data => {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* private mode: play on, unsaved */
    }
  };
  const num = n => Number(n).toLocaleString("en-US");

  /* One tile in the Collection or Loadout grids: an icon, a name, a line of text, and anything extra. */
  const tile = ({ classes, icon, name, desc, extra = "", after = "" }) =>
    `<li class="col-tile ${classes}"><span class="col-icon">${icon}</span>` +
    `<span><b>${name}</b><small>${desc}</small>${extra}</span>${after}</li>`;
  /* One titled section of those sheets. */
  const family = (icon, title, note, body) =>
    `<section class="col-family"><h3><span>${icon}</span>${title}${note}</h3>${body}</section>`;
  const small = text => `<small>${text}</small>`;

  const FRESH = () => ({ best: 0, bestRound: 0, wins: 0, ngUnlocked: 0, found: [], deckBest: {}, setsFound: [] });
  class Prefs {
    constructor() {
      this.data = { ...FRESH(), ...read() };
      // Older saves: a first win used to open every deck at once.
      if (this.data.decksUnlocked) {
        this.data.found = [...new Set([...this.data.found, ...window.SlotchinkoData.DECKS.map(k => k.id)])];
        delete this.data.decksUnlocked;
      }
      const sys = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (this.data.motion === undefined) this.data.motion = sys ? "reduced" : "full";
      this.apply();
    }
    reducedMotion() {
      return this.data.motion === "reduced";
    }
    vibration() {
      return this.data.vibration !== false && !this.reducedMotion();
    }
    setReduced(on) {
      this.data.motion = on ? "reduced" : "full";
      this.apply();
      write(this.data);
    }
    /* Clear save data: best scores, wins, unlocks, Ascension and the Collection (motion preference kept). */
    reset() {
      const motion = this.data.motion;
      this.data = { ...FRESH(), motion };
      write(this.data);
    }
    apply() {
      document.documentElement.classList.toggle("reduce-motion", this.reducedMotion());
    }
    /* Lou's one-line tips after the tutorial, and the aim hint on the board: both on unless switched off in Settings. */
    tipsOn() {
      return this.data.tips !== false;
    }
    setTips(on) {
      this.data.tips = !!on;
      write(this.data);
    }
    seenTips() {
      return this.data.tipsSeen || [];
    }
    tipSeen(id) {
      if (this.seenTips().includes(id)) return;
      this.data.tipsSeen = [...this.seenTips(), id];
      write(this.data);
    }
    hintsOn() {
      return this.data.hints !== false;
    }
    setHints(on) {
      this.data.hints = !!on;
      write(this.data);
    }
    /* First-hand tips: for someone who has never finished a run, until they finish the first blind or hide them. */
    coachOn() {
      const d = this.data;
      return !d.coached && (!!d.coachAsked || (!d.best && !d.wins));
    }
    coachDone() {
      if (this.data.coached) return;
      this.data.coached = true;
      delete this.data.coachAsked;
      write(this.data);
    }
    /* TUTORIAL on the title screen: anyone can ask for the tips again; they run for the next first round. */
    coachStart() {
      this.data.coached = false;
      this.data.coachAsked = true;
      write(this.data);
    }
    /* Opens one unlock right away (a milestone met mid-run). True only the first time on this save. */
    find(id) {
      if (this.data.found.includes(id)) return false;
      this.data.found.push(id);
      write(this.data);
      return true;
    }
    /* Ids still locked in the unlock pool, for a new run. */
    locked() {
      return window.SlotchinkoData.UNLOCKS.map(u => u.id).filter(id => !this.data.found.includes(id));
    }
    deckOpen(id) {
      return id === "house" || this.data.found.includes(id);
    }
    /* Records a finished run: best score, wins, Ascension, sets found and new unlocks. */
    recordRun(s, game) {
      const d = this.data,
        isBest = s.total > d.best;
      if (isBest) d.best = s.total;
      d.bestRound = Math.max(d.bestRound, s.victory ? s.round : s.round - 1);
      let ascended = false;
      if (s.victory) {
        d.wins++;
        const ng = s.ng || 0;
        d.deckBest[s.deckId || "house"] = Math.max(d.deckBest[s.deckId || "house"] ?? -1, ng);
        const open = Math.min(window.SlotchinkoData.NG.MAX, ng + 1);
        if (open > (d.ngUnlocked || 0)) {
          d.ngUnlocked = open;
          ascended = true;
        }
      }
      const fresh = game ? game.newUnlocks(d.found) : [];
      d.found.push(...fresh);
      d.setsFound = [...new Set([...(d.setsFound || []), ...(s.stats?.sets || [])])];
      write(d);
      return { isBest, fresh, ascended };
    }
  }

  class Overlays {
    constructor(prefs) {
      this.prefs = prefs;
      this.open = null;
      this.onChange = () => {};
      this.returnTo = null;
    }
    show(id) {
      if (this.open) $(this.open).hidden = true;
      this.open = id;
      const el = $(id);
      el.hidden = false;
      $("app").inert = true;
      this.onChange(); // the game behind a sheet cannot be tabbed to, clicked or read out
      el.querySelector("[data-focus]")?.focus({ preventScroll: true });
    }
    hide() {
      if (!this.open) return;
      $(this.open).hidden = true;
      this.open = null;
      $("app").inert = false;
      this.onChange();
      // A finished run always ends on its summary: closing How to Play or any sheet opened over it brings it back
      // (as it was; the run is recorded once), so the game is never left with nothing to press.
      const s = window.slotchinko?.state;
      if (this.endShown && s && (s.victory || (s.phase === "roundEnd" && !s.won))) this.show("end-screen");
    }
    get pausing() {
      return !!this.open;
    }
    showTitle() {
      const d = this.prefs.data;
      $("title-best").textContent = d.best
        ? `BEST ${num(d.best)} · ${d.wins} WIN${d.wins === 1 ? "" : "S"}${d.ngUnlocked ? ` · ASCENSION ${d.ngUnlocked}` : ""}`
        : "NO RUNS YET";
      const saved = window.SlotchinkoSave?.read(),
        c = $("continue-button");
      if (c) {
        c.hidden = !saved;
        if (saved) {
          const st = saved.state;
          $("continue-detail").textContent =
            `BLIND ${st.round}/${window.SlotchinkoData.BALANCE.FINAL_BLIND} · ${num(st.total || 0)} PTS${st.ng ? ` · ASC ${st.ng}` : ""}`;
        }
      }
      $("play-button").setAttribute("data-focus", "");
      if (saved) $("play-button").removeAttribute("data-focus");
      if (c) c.toggleAttribute("data-focus", !!saved);
      this.show("title-screen");
    }
    showHowTo() {
      this.returnTo = this.open === "title-screen" ? "title" : null;
      $("motion-toggle").checked = this.prefs.reducedMotion();
      // The hand chart is written from the game's own table, so it can never disagree with play.
      const LOOKS = {
        "High Card": "nothing matches",
        "One Pair": "7 7",
        "Two Pair": "7 7 · K K",
        "Three of a Kind": "7 7 7",
        Straight: "5 6 7 8 9",
        Flush: "five of one suit",
        "Full House": "7 7 7 · K K",
        "Four of a Kind": "7 7 7 7",
        "Straight Flush": "5 6 7 8 9, one suit",
        "Royal Flush": "10 J Q K A, one suit",
        "The Cinco": "A A A A A"
      };
      $("hand-chart").tBodies[0].innerHTML = Object.entries(window.SlotchinkoData.HANDS)
        .map(
          ([name, h]) =>
            `<tr><th scope="row">${name}</th><td>${LOOKS[name] || ""}</td><td>${h.balls}</td><td>×${h.power}</td></tr>`
        )
        .join("");
      this.show("howto-screen");
    }
    closeHowTo() {
      if (this.returnTo === "title") {
        this.returnTo = null;
        this.showTitle();
      } else this.hide();
    }
    showSettings() {
      this.settingsReturn = this.open && this.open !== "settings-screen" ? this.open : null;
      $("tips-toggle").checked = this.prefs.tipsOn();
      $("hint-toggle").checked = this.prefs.hintsOn();
      this.show("settings-screen");
    }
    closeSettings() {
      const back = this.settingsReturn;
      this.settingsReturn = null;
      if (back === "title-screen") this.showTitle();
      else if (back) this.show(back);
      else this.hide();
    }
    showPause() {
      if (!this.open) this.show("pause-screen");
    }
    /* Deck select and Ascension level. Locked decks show the milestone that opens them. */
    showDecks() {
      const d = this.prefs.data,
        D = window.SlotchinkoData;
      if (this.deckPick == null || !this.prefs.deckOpen(this.deckPick)) this.deckPick = "house";
      this.ngPick = Math.max(0, Math.min(this.ngPick || 0, d.ngUnlocked || 0));
      const hint = id => D.UNLOCKS.find(u => u.id === id)?.hint || "";
      $("deck-list").innerHTML = D.DECKS.map(k => {
        const open = this.prefs.deckOpen(k.id),
          picked = this.deckPick === k.id,
          best = d.deckBest?.[k.id];
        const classes = `deck-card ${picked ? "is-picked" : ""} ${open ? "" : "is-locked"}`;
        const bestMark = best != null ? `<span class="deck-best" title="Best Ascension won">★ ${best}</span>` : "";
        return `<button type="button" class="${classes}" data-deck="${k.id}" ${open ? "" : "disabled"} aria-pressed="${picked}">
          <span class="deck-head"><span class="deck-icon">${open ? k.icon : "?"}</span>${bestMark}</span>
          <b>${open ? k.name : "Locked"}</b><small>${open ? k.desc : hint(k.id)}</small></button>`;
      }).join("");
      const n = this.ngPick,
        mods = D.NG.MODS.slice(0, n),
        pct = Math.round(((1 + D.NG.TARGET_STEP * n) * (n >= 8 ? D.NG.HIGH_STAKES : 1) - 1) * 100);
      $("ng-level").textContent = n ? `ASCENSION ${n}` : "STANDARD";
      $("ng-detail").textContent = n
        ? `${pct ? `Targets +${pct}% · ` : ""}${n} rule${n === 1 ? "" : "s"}`
        : d.ngUnlocked
          ? "Press + to raise the stakes."
          : "Win a run to open Ascension 1.";
      // Newest rule in full; earlier ones as a compact row.
      const last = mods[n - 1],
        older = mods.slice(0, -1);
      $("ng-mods").innerHTML =
        (last ? `<li class="is-new"><span>${last.icon}</span><b>${last.name}</b> ${last.desc}</li>` : "") +
        (older.length
          ? `<li class="ng-older">Also: ${older.map(m => `<b>${m.icon} ${m.name}</b>`).join(" · ")}</li>`
          : "");
      $("ng-mods").hidden = !n;
      $("ng-down").disabled = n <= 0;
      $("ng-up").disabled = n >= (d.ngUnlocked || 0);
      const found = D.DECKS.filter(k => this.prefs.deckOpen(k.id)).length;
      $("deck-count").textContent = `${found}/${D.DECKS.length} OPEN`;
      this.show("deck-screen");
    }
    /* Loadout sheet: every Chip you own with what it does and its Sell button, then run-long buffs and active sets.
       Opening it pauses a live drop like any other sheet. */
    showLoadout(game) {
      const s = game.state,
        B = window.SlotchinkoData.BALANCE,
        stacks = new Map(),
        can = game.canSell();
      s.chips.forEach(c => {
        const e = stacks.get(c.id) || { chip: c, n: 0, value: 0 };
        e.n++;
        e.value = Math.max(e.value, game.sellValue(c));
        stacks.set(c.id, e);
      });
      const sellButton = (c, n, value) =>
        `<button type="button" class="sell-chip" data-sell="${c.id}" ` +
        `aria-label="Sell ${n > 1 ? "one " : ""}${c.name} for ${value} coins">` +
        `<span>SELL${n > 1 ? " ONE" : ""}</span><b>+${value}¢</b></button>`;
      const row = ({ chip: c, n, value }) =>
        tile({
          classes: `loadout-row rarity-${c.rarity}`,
          icon: c.icon,
          name: `${c.name}${n > 1 ? ` ×${n}` : ""}`,
          desc: c.desc,
          extra: value ? "" : `<small class="loadout-note">Part of your deck. It can't be sold.</small>`,
          after: value && can ? sellButton(c, n, value) : ""
        });
      const buffs = (s.runBuffs || [])
        .map(c => tile({ classes: `rarity-${c.rarity}`, icon: c.icon, name: c.name, desc: c.desc }))
        .join("");
      const sets = game
        ._effects()
        .synergies.map(x => `<li class="is-found"><b>${x}</b></li>`)
        .join("");
      $("loadout-sheet-count").textContent = `${s.chips.length}/${B.MAX_CHIPS} CHIPS · ${s.coins}¢`;
      const chipList = stacks.size
        ? `<ul class="col-grid">${[...stacks.values()].map(row).join("")}</ul>`
        : `<p class="loadout-empty">No Chips yet. Buy them in the shop after a blind.</p>`;
      const setList = sets
        ? `<ul class="col-sets">${sets}</ul>`
        : `<p class="loadout-empty">No sets yet. Pair two different Chips with matching tags.</p>`;
      $("loadout-body").innerHTML =
        family("✦", "Chips", small(can ? "Sells for half its price" : "Sell when the drop is over"), chipList) +
        (buffs ? family("◍", "Whole-run buffs", "", `<ul class="col-grid">${buffs}</ul>`) : "") +
        family("∞", "Active sets", "", setList);
      if (this.open !== "loadout-screen") this.show("loadout-screen");
    }
    closeLoadout() {
      if (this.open === "loadout-screen") this.hide();
    }
    /* Collection: every Chip by family, the other items, sets found and decks. Locked tiles show their milestone. */
    showCollection() {
      const d = this.prefs.data,
        D = window.SlotchinkoData,
        locked = this.prefs.locked(),
        hint = id => D.UNLOCKS.find(u => u.id === id)?.hint || "";
      const isOpen = x => !locked.includes(x.id);
      const openOf = list => `${list.filter(isOpen).length}/${list.length}`;
      // A locked tile hides what it is and shows how to earn it.
      const lockable = (classes, it, open) =>
        tile({
          classes: `${classes}${open ? "" : "is-locked"}`,
          icon: open ? it.icon : "?",
          name: open ? it.name : "Locked",
          desc: open ? it.desc : hint(it.id)
        });
      const itemTile = it => lockable(`rarity-${it.rarity} `, it, isOpen(it));
      const grid = list => `<ul class="col-grid">${list.map(itemTile).join("")}</ul>`;
      const famOf = c => D.FAMILIES.find(f => (c.tags || []).some(t => f.tags.includes(t)))?.id || "chaos";
      const all = [...D.CHIP_CATALOG, ...D.CARD_CATALOG, ...D.BUFF_CATALOG, ...D.CONSUMABLE_CATALOG];
      const openCount = all.filter(isOpen).length;
      const fams = D.FAMILIES.map(f => {
        const items = D.CHIP_CATALOG.filter(c => famOf(c) === f.id);
        if (!items.length) return "";
        return family(f.icon, f.name, small(openOf(items)), grid(items));
      }).join("");
      const other = [
        ["Deck Cards", D.CARD_CATALOG, "▤"],
        ["Board Buffs", D.BUFF_CATALOG, "◍"],
        ["Bag Items", D.CONSUMABLE_CATALOG, "▣"]
      ]
        .map(([name, list, icon]) => family(icon, name, small(openOf(list)), grid(list)))
        .join("");
      const sets = (window.SlotchinkoSets || [])
        .map(x => {
          const got = (d.setsFound || []).includes(x.label);
          const label = got ? x.label : "? ? ?";
          return `<li class="${got ? "is-found" : ""}"><b>${label}</b><small>${x.need.join(" + ")}</small></li>`;
        })
        .join("");
      const decks = D.DECKS.map(k => {
        return lockable("", k, this.prefs.deckOpen(k.id));
      }).join("");
      const setsFound = (d.setsFound || []).length,
        setsTotal = (window.SlotchinkoSets || []).length;
      $("collection-count").textContent = `${openCount}/${all.length} ITEMS · ${setsFound}/${setsTotal} SETS`;
      $("collection-body").innerHTML =
        `<p class="col-lead">Two different Chips with matching tags form a set. Locked items open from milestones.</p>
        <section class="col-family"><h3><span>✦</span>Sets found</h3><ul class="col-sets">${sets}</ul></section>
        ${fams}${other}
        <section class="col-family"><h3><span>♠</span>Decks</h3><ul class="col-grid">${decks}</ul></section>`;
      $("collection-body").scrollTop = 0;
      this.show("collection-screen");
    }
    /* Path choice after the shop. */
    showPath(game) {
      const s = game.state,
        D = window.SlotchinkoData;
      if (!s.path) return;
      if (s.event) return this.showEvent(game);
      const next = s.round + 1;
      // A blind whose jackpot has moved says so before you commit to it.
      const board = game._layoutFor(next) === "classic" ? "" : ` · Board: ${game.layoutName(next)}`;
      $("path-sub").textContent = `Blind ${next} of ${D.BALANCE.FINAL_BLIND}${board}`;
      window.SlotchinkoBossView.pathPreview(game);
      $("path-boss-label").hidden = $("path-boss").hidden;
      // Tutorial, last step: Lou says what can be picked (those glow) and what the boss box is for.
      const C = window.SlotchinkoCoach,
        coach = !!this.prefs.coachOn?.() && s.round === 1,
        boss = D.BOSSES.find(x => x.round > s.round),
        words = window.SlotchinkoCopy?.words || (x => x);
      $("path-coach").hidden = !coach;
      $("path-list").closest(".path-card").classList.toggle("is-coach", coach);
      $("path-list").classList.toggle("coach-pick", coach);
      $("path-boss-note").hidden = !(coach && boss);
      if (coach) {
        if (!$("path-coach-face").firstChild) $("path-coach-face").innerHTML = window.SlotchinkoBossArt?.host || "";
        $("path-coach-step").textContent = `${C.HOST} · ${C.PATH.n} OF ${C.PATH.of}`;
        $("path-coach-text").textContent = words(C.PATH.text);
        if (boss) $("path-boss-note").textContent = C.PATH.boss(boss.round, boss.round === next);
      }
      const ev = id => id && game.eventDef(id);
      $("path-list").innerHTML = s.path.choices
        .map((c, i) => {
          const n = D.NODES[c.type],
            e = c.type === "event" ? ev(c.event) : null;
          const desc = e ? `${e.name}. ${n.desc}` : n.desc;
          return (
            `<button type="button" class="path-node is-${c.type}" data-path="${i}" ${i === 0 ? "data-focus" : ""}>` +
            `<span class="path-icon">${n.icon}</span>` +
            `<span class="path-copy"><b>${n.name}</b><small>${desc}</small></span>` +
            `<i aria-hidden="true">›</i></button>`
          );
        })
        .join("");
      this.show("path-screen");
    }
    /* Tapping the boss box does nothing in the game, so it answers instead: a shake, a line saying where the boss is,
       and a flash on the things that can be picked. */
    bossNudge(game) {
      const s = game.state,
        b = window.SlotchinkoData.BOSSES.find(x => x.round > s.round),
        note = $("path-boss-note");
      if (!b) return;
      const who = b.name;
      note.textContent =
        b.round === s.round + 1
          ? `${who} is your next round. Pick one of the boxes below to go in.`
          : `${who} is waiting at blind ${b.round}. Pick a round below to get there.`;
      note.hidden = false;
      for (const el of [$("path-boss"), $("path-list")]) {
        el.classList.remove("nudge");
        void el.offsetWidth;
        el.classList.add("nudge");
      }
      window.clearTimeout(this._nudge);
      this._nudge = window.setTimeout(() => {
        $("path-boss").classList.remove("nudge");
        $("path-list").classList.remove("nudge");
      }, 900);
    }
    showEvent(game) {
      const s = game.state,
        e = game.eventDef();
      if (!e) return;
      $("event-icon").textContent = e.icon;
      $("event-title").textContent = e.name;
      $("event-text").textContent = e.text;
      $("event-options").innerHTML = e.options
        .map((o, i) => {
          const ok = game.eventOptionOk(i);
          const blocked = o.need ? `Needs ${o.need}¢. You have ${s.coins}¢.` : "You have no Chip to swap.";
          const attrs = `data-event="${i}" ${ok ? "" : "disabled"} ${i === 0 && ok ? "data-focus" : ""}`;
          return (
            `<button type="button" class="event-option ${i === 0 ? "is-main" : ""}" ${attrs}>` +
            `<b>${o.label}</b><small>${ok ? o.detail : blocked}</small></button>`
          );
        })
        .join("");
      $("event-coins").textContent = `¢ ${s.coins}`;
      this.show("event-screen");
    }
    showEnd(s, sum) {
      this.endShown = true;
      const game = window.slotchinko,
        rec = this.prefs.recordRun(s, game),
        best = rec.isBest,
        d = this.prefs.data,
        cleared = s.victory ? s.round : s.round - 1,
        D = window.SlotchinkoData;
      sum = sum || game.summary();
      $("end-hand").textContent = sum.bestHand;
      $("end-coins").textContent = `${num(sum.coinsEarned)}¢`;
      $("end-chip").textContent = sum.topChip
        ? sum.topChip.name + (sum.topChip.times ? ` ×${sum.topChip.times}` : "")
        : "—";
      $("end-drop").textContent = num(sum.bestDrop);
      const deck = D.DECKS.find(k => k.id === (s.deckId || "house"));
      $("end-ng").hidden = false;
      $("end-ng").textContent = `${deck.name.toUpperCase()}${s.ng ? ` · ASCENSION ${s.ng}` : ""}`;
      const names = rec.fresh.map(id => {
        const u = D.UNLOCKS.find(x => x.id === id),
          it =
            u.kind === "deck"
              ? D.DECKS.find(k => k.id === id)
              : [...D.CHIP_CATALOG, ...D.CARD_CATALOG, ...D.BUFF_CATALOG, ...D.CONSUMABLE_CATALOG].find(
                  x => x.id === id
                );
        return `<li><span>${it.icon}</span>${it.name}</li>`;
      });
      if (rec.ascended) names.unshift(`<li class="is-asc"><span>♛</span>Ascension ${d.ngUnlocked}</li>`);
      $("end-unlocks").hidden = !names.length;
      $("end-unlock-list").innerHTML = names.join("");
      const canNg = s.victory && (s.ng || 0) < D.NG.MAX;
      $("ng-button").hidden = !canNg;
      if (canNg) $("ng-button-level").textContent = `${(s.ng || 0) + 1}`;
      const choose = D.DECKS.some(k => k.id !== "house" && this.prefs.deckOpen(k.id)) || d.ngUnlocked > 0;
      $("deck-button").hidden = !choose;
      $("restart-button").classList.toggle("btn-primary", !canNg);
      $("restart-button").classList.toggle("btn-secondary", canNg);
      $("restart-button").toggleAttribute("data-focus", !canNg);
      $("ng-button").toggleAttribute("data-focus", canNg);
      $("end-title").textContent = s.victory ? "YOU BEAT THE HOUSE" : "RUN OVER";
      $("end-screen").classList.toggle("is-win", !!s.victory);
      $("end-message").textContent = s.victory
        ? canNg
          ? `Every blind cleared. Ascension ${(s.ng || 0) + 1} awaits.`
          : "Every blind cleared. The table is yours."
        : `Blind ${s.round} wanted ${num(s.target)}. You had ${num(s.score)}.`;
      $("end-score").textContent = num(s.total);
      $("end-blinds").textContent = `${cleared}/${D.BALANCE.FINAL_BLIND}`;
      $("end-best").textContent = num(d.best);
      $("end-new-best").hidden = !best;
      $("end-seed").textContent = `SEED ${game.rng.seed}`;
      window.SlotchinkoBossView.endScreen(s, game);
      this.show("end-screen");
    }
  }
  window.SlotchinkoPrefs = Prefs;
  window.SlotchinkoOverlays = Overlays;
})();
