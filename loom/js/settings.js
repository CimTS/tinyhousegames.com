import { storage } from "./storage.js";

// Setting key → checkbox id. Volume is a range; theme is a select.
const TOGGLES = {
  sound: "setting-sound", ambient: "setting-ambient", haptics: "setting-haptics",
  large: "setting-large", contrast: "setting-contrast", calm: "setting-calm", marks: "setting-marks"
};

export class Settings {
  constructor(audio) {
    this.audio = audio;
    this.value = { marks: false, theme: "system", ...storage.getSettings() };
    this.listeners = new Set();
    this.apply();
  }

  onChange(fn) { this.listeners.add(fn); }

  apply() {
    const root = document.documentElement;
    root.classList.toggle("large-text", !!this.value.large);
    root.classList.toggle("high-contrast", !!this.value.contrast);
    root.classList.toggle("calm", !!this.value.calm);
    root.classList.toggle("marks", !!this.value.marks);
    const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
    const dark = this.value.theme === "dark" || (this.value.theme === "system" && systemDark);
    root.dataset.theme = dark ? "dark" : "light";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#23211D" : "#F6F1E7");
    if (this.audio) { this.audio.settings = this.value; this.audio.setVolume(); }
    this.syncUI();
  }

  // Keeps the visible controls in step with the values (e.g. after the
  // top-bar sound button changes `sound`).
  syncUI() {
    for (const [key, id] of Object.entries(TOGGLES)) {
      const el = document.getElementById(id);
      if (el) el.checked = Boolean(this.value[key]);
    }
    const vol = document.getElementById("setting-volume");
    if (vol) { vol.value = this.value.volume; vol.disabled = !this.value.sound; }
    const theme = document.getElementById("setting-theme");
    if (theme) theme.value = this.value.theme;
  }

  save(key) {
    storage.saveSettings(this.value);
    this.apply();
    this.listeners.forEach(fn => fn(key, this.value[key]));
  }

  bind() {
    for (const [key, id] of Object.entries(TOGGLES)) {
      document.getElementById(id)?.addEventListener("change", e => { this.value[key] = e.target.checked; this.save(key); });
    }
    document.getElementById("setting-volume")?.addEventListener("input", e => { this.value.volume = Number(e.target.value); this.save("volume"); });
    document.getElementById("setting-theme")?.addEventListener("change", e => { this.value.theme = e.target.value; this.save("theme"); });
    window.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", () => {
      if (this.value.theme === "system") this.apply();
    });
  }
}
