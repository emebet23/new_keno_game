import { useAppStore } from "./store";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function playSound(type: "click" | "select" | "success" | "error" = "click") {
  if (!useAppStore.getState().soundEnabled) return;

  try {
    const c = getCtx();
    const o = c.createOscillator();
    const g = c.createGain();
    o.connect(g);
    g.connect(c.destination);
    const t = c.currentTime;

    switch (type) {
      case "click":
        o.frequency.setValueAtTime(900, t);
        g.gain.setValueAtTime(0.08, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        o.start(t);
        o.stop(t + 0.04);
        break;
      case "select":
        o.frequency.setValueAtTime(660, t);
        o.frequency.exponentialRampToValueAtTime(1100, t + 0.08);
        g.gain.setValueAtTime(0.1, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        o.start(t);
        o.stop(t + 0.1);
        break;
      case "success":
        o.frequency.setValueAtTime(523, t);
        o.frequency.setValueAtTime(659, t + 0.08);
        o.frequency.setValueAtTime(784, t + 0.16);
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        o.start(t);
        o.stop(t + 0.35);
        break;
      case "error":
        o.frequency.setValueAtTime(350, t);
        o.frequency.setValueAtTime(250, t + 0.12);
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        o.start(t);
        o.stop(t + 0.25);
        break;
    }
  } catch {
    // audio unavailable
  }
}
