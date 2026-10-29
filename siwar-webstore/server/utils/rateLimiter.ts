/**
 * server/utils/rateLimiter.ts
 * In-memory sliding-window rate limiter for blocking brute-force enumeration attacks.
 */

interface RateLimitRecord {
  timestamps: number[]
}

export class InMemoryRateLimiter {
  private store = new Map<string, RateLimitRecord>()
  private windowMs: number
  private maxRequests: number

  constructor(maxRequests = 5, windowMs = 60_000) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }

  /**
   * Evaluates if a request from the given key (e.g. IP address) is permitted.
   */
  check(key: string): {
    allowed: boolean
    remaining: number
    resetSeconds: number
    totalRequests: number
  } {
    const now = Date.now()
    const cutoff = now - this.windowMs
    let record = this.store.get(key)

    if (!record) {
      record = { timestamps: [] }
      this.store.set(key, record)
    }

    // Filter out timestamps outside the current sliding window
    record.timestamps = record.timestamps.filter((ts) => ts > cutoff)

    if (record.timestamps.length >= this.maxRequests) {
      const oldest = record.timestamps[0] || now
      const resetSeconds = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000))
      return {
        allowed: false,
        remaining: 0,
        resetSeconds,
        totalRequests: record.timestamps.length,
      }
    }

    // Record the valid attempt within the window
    record.timestamps.push(now)
    const remaining = this.maxRequests - record.timestamps.length
    const oldest = record.timestamps[0]
    let resetSeconds = 0
    if (oldest) {
      resetSeconds = Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000))
    }

    return {
      allowed: true,
      remaining,
      resetSeconds,
      totalRequests: record.timestamps.length,
    }
  }

  /**
   * Resets limit records (useful for testing or cache eviction).
   */
  reset(key?: string): void {
    if (key) {
      this.store.delete(key)
    } else {
      this.store.clear()
    }
  }
}

/**
 * Singleton rate limiter specifically protecting the guest order lookup portal:
 * Max 5 attempts per 60 seconds per IP address (AC-4).
 */
export const orderLookupRateLimiter = new InMemoryRateLimiter(5, 60_000)
