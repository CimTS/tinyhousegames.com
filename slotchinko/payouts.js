/* Slotchinko payout popups: "COIN PRESS +6¢" pills when a Chip pays out.
   SlotchinkoPayoutBatch is pure (testable): the same Chip within `merge` ms adds into one pill,
   at most `max` pills show at once, each lives `life` ms after its last update.
   SlotchinkoPayoutLayer draws a batch into a DOM container. */
(() => {
  "use strict";
  const fmt = n => Number(n).toLocaleString("en-US");
  const text = e => e.unit === "BALL" ? `+${fmt(e.amount)} BALL${e.amount === 1 ? "" : "S"}` : e.unit === "PTS" ? `+${fmt(e.amount)}` : `+${fmt(e.amount)}${e.unit || ""}`;

  class Batch {
    constructor({ merge = 900, life = 1700, max = 3 } = {}) { this.merge = merge; this.life = life; this.max = max; this.entries = []; this.serial = 0; }
    add(e, now) {
      this.prune(now);
      const hit = this.entries.find(x => x.id === e.id && now - x.updated <= this.merge);
      if (hit) { hit.amount += e.amount; hit.updated = now; hit.text = text(hit); hit.bumps++; return { entry: hit, merged: true, dropped: [] }; }
      const entry = { ...e, key: ++this.serial, born: now, updated: now, bumps: 0 };
      entry.text = text(entry);
      this.entries.push(entry);
      const dropped = this.entries.length > this.max ? this.entries.splice(0, this.entries.length - this.max) : [];
      return { entry, merged: false, dropped };
    }
    prune(now) {
      const gone = this.entries.filter(x => now - x.updated > this.life);
      this.entries = this.entries.filter(x => now - x.updated <= this.life);
      return gone;
    }
  }

  class Layer {
    constructor(root, opts) { this.root = root; this.batch = new Batch(opts); this.els = new Map(); this.timer = 0; }
    show(e) {
      if (!this.root || !e || !(e.amount > 0)) return;
      const now = performance.now(), { entry, merged, dropped } = this.batch.add(e, now);
      dropped.forEach(x => this.remove(x.key));
      let el = this.els.get(entry.key);
      if (!el) {
        el = document.createElement("div");
        el.className = `payout payout-${entry.kind || "coin"}`;
        el.innerHTML = `<span class="payout-icon" aria-hidden="true"></span><span class="payout-name"></span><b class="payout-amount"></b>`;
        el.querySelector(".payout-icon").textContent = entry.icon || "✦";
        el.querySelector(".payout-name").textContent = entry.name;
        this.root.appendChild(el); this.els.set(entry.key, el);
      }
      el.querySelector(".payout-amount").textContent = entry.text;
      el.setAttribute("aria-label", `${entry.name} ${entry.text}`);
      if (merged) { el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
      el.classList.remove("leaving");
      this.schedule();
    }
    schedule() {
      clearTimeout(this.timer);
      if (!this.batch.entries.length) return;
      const now = performance.now(), next = Math.min(...this.batch.entries.map(x => x.updated + this.batch.life)) - now;
      this.timer = setTimeout(() => { this.batch.prune(performance.now()).forEach(x => this.remove(x.key)); this.schedule(); }, Math.max(16, next + 5));
    }
    remove(key) {
      const el = this.els.get(key); if (!el) return; this.els.delete(key);
      el.classList.add("leaving"); setTimeout(() => el.remove(), 260);
    }
  }
  window.SlotchinkoPayoutBatch = Batch; window.SlotchinkoPayoutLayer = Layer;
})();
