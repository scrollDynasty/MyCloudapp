import AsyncStorage from '@react-native-async-storage/async-storage';

// Типы кэшируемых данных
export type CacheKey = 
  | 'user_profile'
  | 'user_orders'
  | 'user_services'
  | 'service_groups'
  | 'service_plans'
  | 'dashboard_data';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

// Время жизни кэша (в миллисекундах)
const CACHE_TTL: Record<CacheKey, number> = {
  user_profile: 5 * 60 * 1000, // 5 минут
  user_orders: 2 * 60 * 1000, // 2 минуты
  user_services: 10 * 60 * 1000, // 10 минут
  service_groups: 30 * 60 * 1000, // 30 минут
  service_plans: 30 * 60 * 1000, // 30 минут
  dashboard_data: 2 * 60 * 1000, // 2 минуты
};

/**
 * Сохранить данные в кэш
 */
export async function setCache<T>(key: CacheKey, data: T, customTTL?: number): Promise<void> {
  try {
    const ttl = customTTL || CACHE_TTL[key];
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
    };
    await AsyncStorage.setItem(`cache_${key}`, JSON.stringify(entry));
  } catch (error) {
    console.error(`Error caching ${key}:`, error);
  }
}

/**
 * Получить данные из кэша
 */
export async function getCache<T>(key: CacheKey): Promise<T | null> {
  try {
    const cached = await AsyncStorage.getItem(`cache_${key}`);
    if (!cached) return null;

    const entry: CacheEntry<T> = JSON.parse(cached);
    
    // Проверка на истечение срока действия
    if (Date.now() > entry.expiresAt) {
      await AsyncStorage.removeItem(`cache_${key}`);
      return null;
    }

    return entry.data;
  } catch (error) {
    console.error(`Error reading cache ${key}:`, error);
    return null;
  }
}

/**
 * Проверить, актуален ли кэш (без загрузки данных)
 */
export async function isCacheValid(key: CacheKey): Promise<boolean> {
  try {
    const cached = await AsyncStorage.getItem(`cache_${key}`);
    if (!cached) return false;

    const entry: CacheEntry<any> = JSON.parse(cached);
    return Date.now() <= entry.expiresAt;
  } catch (error) {
    return false;
  }
}

/**
 * Очистить конкретный кэш
 */
export async function clearCache(key: CacheKey): Promise<void> {
  try {
    await AsyncStorage.removeItem(`cache_${key}`);
  } catch (error) {
    console.error(`Error clearing cache ${key}:`, error);
  }
}

/**
 * Очистить все кэши
 */
export async function clearAllCache(): Promise<void> {
  try {
    const keys = Object.keys(CACHE_TTL) as CacheKey[];
    await Promise.all(keys.map(key => AsyncStorage.removeItem(`cache_${key}`)));
  } catch (error) {
    console.error('Error clearing all cache:', error);
  }
}

/**
 * Получить данные с кэшированием или выполнить загрузку
 */
export async function getCachedOrFetch<T>(
  key: CacheKey,
  fetchFn: () => Promise<T>,
  forceRefresh = false
): Promise<T | null> {
  // Если принудительное обновление, очищаем кэш
  if (forceRefresh) {
    await clearCache(key);
  }

  // Пытаемся получить из кэша
  const cached = await getCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Загружаем данные
  try {
    const data = await fetchFn();
    await setCache(key, data);
    return data;
  } catch (error) {
    console.error(`Error fetching ${key}:`, error);
    // В случае ошибки возвращаем старые данные из кэша, если они есть
    return cached;
  }
}

/**
 * Инвалидировать кэш при изменении данных
 */
export async function invalidateCache(keys: CacheKey[]): Promise<void> {
  await Promise.all(keys.map(key => clearCache(key)));
}

