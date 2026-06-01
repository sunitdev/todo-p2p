import { describe, expect, test } from "bun:test";
import { Backoff } from "../src/backoff.ts";

describe("Backoff", () => {
  test("grows exponentially from base by factor", () => {
    const b = new Backoff({ baseMs: 1000, factor: 2, capMs: 1_000_000 });
    expect(b.nextDelay()).toBe(1000);
    expect(b.nextDelay()).toBe(2000);
    expect(b.nextDelay()).toBe(4000);
    expect(b.nextDelay()).toBe(8000);
  });

  test("caps the delay", () => {
    const b = new Backoff({ baseMs: 1000, factor: 2, capMs: 5000 });
    expect(b.nextDelay()).toBe(1000);
    expect(b.nextDelay()).toBe(2000);
    expect(b.nextDelay()).toBe(4000);
    expect(b.nextDelay()).toBe(5000); // would be 8000, capped
    expect(b.nextDelay()).toBe(5000);
  });

  test("reset returns to base and clears attempt count", () => {
    const b = new Backoff({ baseMs: 1000, factor: 2 });
    b.nextDelay();
    b.nextDelay();
    expect(b.attempts).toBe(2);
    b.reset();
    expect(b.attempts).toBe(0);
    expect(b.nextDelay()).toBe(1000);
  });

  test("jitter is deterministic with an injected rng", () => {
    // rng=0 → delta = (0*2-1)*jitter*delay = -jitter*delay (lower bound).
    const low = new Backoff({ baseMs: 1000, factor: 1, jitter: 0.2, rng: () => 0 });
    expect(low.nextDelay()).toBe(800);
    // rng=1 → delta = +jitter*delay (upper bound).
    const high = new Backoff({ baseMs: 1000, factor: 1, jitter: 0.2, rng: () => 1 });
    expect(high.nextDelay()).toBe(1200);
    // rng=0.5 → no net jitter.
    const mid = new Backoff({ baseMs: 1000, factor: 1, jitter: 0.2, rng: () => 0.5 });
    expect(mid.nextDelay()).toBe(1000);
  });

  test("default rng yields zero net jitter (deterministic, no Math.random)", () => {
    const b = new Backoff({ baseMs: 1000, factor: 2, jitter: 0.5 });
    expect(b.nextDelay()).toBe(1000);
    expect(b.nextDelay()).toBe(2000);
  });

  test("delay never goes negative", () => {
    const b = new Backoff({ baseMs: 10, factor: 1, jitter: 5, rng: () => 0 });
    expect(b.nextDelay()).toBeGreaterThanOrEqual(0);
  });
});
