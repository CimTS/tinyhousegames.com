// Sound settings panel and HUD speaker button. Mirrors the sound engine's saved state.
import { icon } from "./icons.js";

const $ = id => document.getElementById(id);

export function bindAudioPanel(sound, { onOpen, onClose } = {}) {
  const panel = $("audioPanel");

  function sync({ muted, volume } = { muted: sound.muted, volume: sound.volume }) {
    for (const k of ["music", "sfx"]) {
      const range = $(`${k}Volume`), out = $(`${k}VolumeValue`), pct = Math.round(volume[k] * 100);
      range.value = String(pct);
      range.style.setProperty("--fill", `${pct}%`);
      range.setAttribute("aria-valuetext", pct ? `${pct}%` : "off");
      out.textContent = pct ? `${pct}%` : "Off";
      out.parentElement.classList.toggle("is-off", !pct);
    }
    $("muteToggle").checked = muted;
    panel.querySelector(".sheet").classList.toggle("is-muted", muted);
    for (const id of ["soundBtn"]) {
      const b = $(id);
      b.replaceChildren(icon(muted ? "muted" : "sound"));
      b.classList.toggle("muted", muted);
      b.title = muted ? "Sound settings (muted, M to unmute)" : "Sound settings (M mutes)";
    }
  }

  let lastPreview = 0;
  for (const k of ["music", "sfx"]) {
    $(`${k}Volume`).addEventListener("input", e => {
      sound.unlock();
      sound.setVolume(k, Number(e.target.value) / 100);
      const now = performance.now();
      if (k === "sfx" && now - lastPreview > 120) { lastPreview = now; sound.play("chirp", { vel: 0.08 }); } // hear the new level
    });
  }
  $("muteToggle").addEventListener("change", e => { sound.unlock(); sound.setMuted(e.target.checked); if (!e.target.checked) sound.play("chirp", { vel: 0.08 }); });

  const open = () => { panel.hidden = false; onOpen?.(); $("musicVolume").focus(); };
  const close = () => { panel.hidden = true; onClose?.(); };
  $("soundBtn").addEventListener("click", open);
  $("titleSoundBtn").addEventListener("click", open);
  $("audioClose").addEventListener("click", close);
  panel.addEventListener("click", e => { if (e.target === panel) close(); });

  sound.onChange(sync);
  sync();
  return { open, close, get isOpen() { return !panel.hidden; }, toggleMute: () => sound.setMuted(!sound.muted) };
}
