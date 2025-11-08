import AsyncStorage from '@react-native-async-storage/async-storage';
import { CacheKey } from './cache';

/**
 * Оптимизатор кеша - автоматически очищает старые данные
 */

const MAX_CACHE_SIZE_MB = 10; // Максимум 10MB кеша
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000; // Очистка каждые 5 минут

/**
 * Получить размер данных в байтах
 */
function getDataSize(data: string): number {
  return new Blob([data]).size;
}

/**
 * Очистить устаревшие элементы кеша
 */
export async function cleanupExpiredCache(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(key => key.startsWith('cache_'));
    
    let totalSize = 0;
    const cacheItems: Array<{ key: string; size: number; timestamp: number }> = [];
    
    // Собираем информацию о всех элементах кеша
    for (const key of cacheKeys) {
      const value = await AsyncStorage.getItem(key);
      if (value) {
        try {
          const parsed = JSON.parse(value);
          const size = getDataSize(value);
          totalSize += size;
          
          // Проверяем, не истек ли срок действия
          if (Date.now() > parsed.expiresAt) {
            await AsyncStorage.removeItem(key);
            console.log(`🧹 Cache cleaned: ${key} (expired)`);
          } else {
            cacheItems.push({
              key,
              size,
              timestamp: parsed.timestamp || 0,
            });
          }
        } catch (e) {
          // Поврежденный кеш - удаляем
          await AsyncStorage.removeItem(key);
        }
      }
    }
    
    // Если кеш слишком большой, удаляем старые элементы
    const maxSizeBytes = MAX_CACHE_SIZE_MB * 1024 * 1024;
    if (totalSize > maxSizeBytes) {
      // Сортируем по времени создания (старые первыми)
      cacheItems.sort((a, b) => a.timestamp - b.timestamp);
      
      let removedSize = 0;
      for (const item of cacheItems) {
        if (totalSize - removedSize <= maxSizeBytes) break;
        
        await AsyncStorage.removeItem(item.key);
        removedSize += item.size;
        console.log(`🧹 Cache cleaned: ${item.key} (size limit)`);
      }
    }
  } catch (error) {
    console.error('Cache cleanup error:', error);
  }
}

/**
 * Запустить автоматическую очистку кеша
 */
export function startCacheCleanup(): () => void {
  // Запускаем сразу
  cleanupExpiredCache();
  
  // Затем каждые 5 минут
  const interval = setInterval(cleanupExpiredCache, CACHE_CLEANUP_INTERVAL);
  
  // Возвращаем функцию для остановки
  return () => clearInterval(interval);
}

/**
 * Предзагрузка критичных данных
 */
export async function preloadCriticalData(keys: CacheKey[]): Promise<void> {
  // Проверяем, какие данные уже есть в кеше
  const cachePromises = keys.map(async (key) => {
    const cached = await AsyncStorage.getItem(`cache_${key}`);
    return { key, exists: !!cached };
  });
  
  const results = await Promise.all(cachePromises);
  const missing = results.filter(r => !r.exists);
  
  if (missing.length > 0) {
    console.log('📦 Preloading cache for:', missing.map(m => m.key));
  }
}

