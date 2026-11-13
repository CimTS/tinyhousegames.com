/* Extra hooks for events sound.js predates. It stays untouched: this only triggers its
 * existing music accents, so the mix and SFX levels do not change. */
(() => {
  "use strict";
  const G = window.SlotchinkoGame && window.SlotchinkoGame.prototype;
  if (!G || !window.SlotchinkoSound) return;
  const music = () => window.SlotchinkoSound.music;
  const newRun = G.newRun;
  G.newRun = function (...args) {
    newRun.apply(this, args);
    const m = music();
    if (m && m.state.running) {
      m.accent("reset");
      m.setIntensity(0);
    }
  };
  const onBucket = G.onBucket;
  G.onBucket = function (result) {
    const had = this.state.targetHit;
    onBucket.call(this, result);
    if (!had && this.state.targetHit) music()?.accent("big");
  };
})();
