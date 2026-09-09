import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnimationSound } from "./sound.js";

class MockOscillator {
  type = "sine";
  frequency = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class MockGain {
  gain = {
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
  connect = vi.fn();
}

describe("AnimationSound", () => {
  const createOscillator = vi.fn(() => new MockOscillator());

  beforeEach(() => {
    createOscillator.mockClear();
    vi.stubGlobal(
      "AudioContext",
      vi.fn(() => ({
        createOscillator,
        createGain: () => new MockGain(),
        destination: {},
        currentTime: 0,
        resume: vi.fn().mockResolvedValue(undefined),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not play before unlock", () => {
    const sound = new AnimationSound();
    sound.setEnabled(true);
    sound.play("flash", 0.8);
    expect(createOscillator).not.toHaveBeenCalled();
  });

  it("plays after unlock when enabled", () => {
    const sound = new AnimationSound();
    sound.setEnabled(true);
    sound.unlock();
    sound.play("burst", 0.5);
    expect(createOscillator).toHaveBeenCalled();
  });

  it("stays silent when disabled", () => {
    const sound = new AnimationSound();
    sound.setEnabled(false);
    sound.unlock();
    sound.play("sweep", 1);
    expect(createOscillator).not.toHaveBeenCalled();
  });
});
