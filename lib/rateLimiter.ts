/**
 * Client-side rate limiter для предотвращения слишком частых запросов к API
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 10, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Проверяет, можно ли выполнить запрос
   */
  canMakeRequest(key: string): boolean {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now > entry.resetTime) {
      // Создаем новую запись или обновляем истекшую
      this.limits.set(key, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (entry.count < this.maxRequests) {
      entry.count++;
      return true;
    }

    return false;
  }

  /**
   * Получает время до сброса лимита (в секундах)
   */
  getTimeUntilReset(key: string): number {
    const entry = this.limits.get(key);
    if (!entry) return 0;

    const now = Date.now();
    if (now > entry.resetTime) return 0;

    return Math.ceil((entry.resetTime - now) / 1000);
  }

  /**
   * Сбрасывает лимит для конкретного ключа
   */
  reset(key: string): void {
    this.limits.delete(key);
  }

  /**
   * Очищает все лимиты
   */
  resetAll(): void {
    this.limits.clear();
  }
}

// Создаем глобальный экземпляр rate limiter
// 20 запросов в минуту на один endpoint
export const apiRateLimiter = new RateLimiter(20, 60000);

/**
 * Хелпер для выполнения запроса с учетом rate limiting
 */
export async function rateLimitedFetch<T>(
  key: string,
  fetchFn: () => Promise<T>
): Promise<T> {
  if (!apiRateLimiter.canMakeRequest(key)) {
    const waitTime = apiRateLimiter.getTimeUntilReset(key);
    throw new Error(
      `Rate limit exceeded for ${key}. Please wait ${waitTime} seconds.`
    );
  }

  return await fetchFn();
}

