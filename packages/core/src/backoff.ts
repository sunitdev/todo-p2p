/**
 * Exponential backoff policy (M4 E4.3). Pure + deterministic: jitter draws from
 * an injected `rng`, never `Math.random`, so retry timing is unit-testable and
 * core stays side-effect free. The owner (e.g. the app's `PeerManager`) holds
 * one `Backoff` per peer, calls `nextDelay()` after each failed attempt, and
 * `reset()` once a connection succeeds.
 */
export interface BackoffOptions {
  /** Delay for the first retry, in ms. Default 1000. */
  baseMs?: number;
  /** Multiplier per attempt. Default 2. */
  factor?: number;
  /** Upper bound on a single delay, in ms. Default 30000. */
  capMs?: number;
  /**
   * Jitter as a fraction (0..1) of the computed delay. Default 0 (none). When
   * > 0 the delay is spread by ±(jitter·delay) using `rng`.
   */
  jitter?: number;
  /** Deterministic source in [0,1). Default `() => 0.5` (zero net jitter). */
  rng?: () => number;
}

export class Backoff {
  private attemptCount = 0;
  private readonly baseMs: number;
  private readonly factor: number;
  private readonly capMs: number;
  private readonly jitter: number;
  private readonly rng: () => number;

  constructor(opts: BackoffOptions = {}) {
    this.baseMs = opts.baseMs ?? 1000;
    this.factor = opts.factor ?? 2;
    this.capMs = opts.capMs ?? 30_000;
    this.jitter = opts.jitter ?? 0;
    this.rng = opts.rng ?? (() => 0.5);
  }

  /** Number of delays handed out since the last `reset()`. */
  get attempts(): number {
    return this.attemptCount;
  }

  /** Delay for the next retry (ms), then advance the attempt counter. */
  nextDelay(): number {
    const exp = this.baseMs * this.factor ** this.attemptCount;
    const capped = Math.min(exp, this.capMs);
    this.attemptCount++;
    if (this.jitter <= 0) return capped;
    // Spread by ±(jitter·delay); rng() in [0,1) maps to [-1,+1).
    const delta = (this.rng() * 2 - 1) * this.jitter * capped;
    return Math.max(0, Math.round(capped + delta));
  }

  reset(): void {
    this.attemptCount = 0;
  }
}
