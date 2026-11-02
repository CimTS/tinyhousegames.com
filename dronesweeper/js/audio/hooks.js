/* Wires the sound engine into the running game. Like Slotchinko's hooks, game logic is untouched:
 * here the hook point is the event bus (docs/EVENTS.md) instead of wrapped prototype methods.
 *  - audio starts on the first click, tap or key press (browsers require a gesture)
 *  - hidden tabs and locked screens suspend the AudioContext; it resumes when visible
 *  - SFX are panned by board column
 *  - danger and screen events drive the music (see cues.js) */
import { createSound } from "./sound.js";
import { createMusic } from "./music.js";
import { connectAudio } from "./cues.js";

export function startAudio({ bus, boardSize = () => 8 } = {}) {
  const sound = createSound({ music: createMusic });
  sound.panFor = cell => {
    const size = boardSize();
    return size > 1 ? ((cell % size) / (size - 1) - 0.5) * 0.7 : 0;
  };
  connectAudio(bus, sound);

  const unlock = () => sound.unlock();
  for (const type of ["pointerdown", "touchend", "keydown", "click"]) {
    window.addEventListener(type, unlock, { capture: true, passive: true });
  }
  document.addEventListener("visibilitychange", () => sound.onVisibility());
  // iOS fires pagehide/pageshow when locking the screen or switching apps.
  window.addEventListener("pagehide", () => sound.ctx?.suspend?.());
  window.addEventListener("pageshow", () => sound.onVisibility());

  window.dronesweeperSound = sound; // for the console and future tooling
  return sound;
}
