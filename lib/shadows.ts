import { Platform, ViewStyle } from 'react-native';

/**
 * Кроссплатформенная функция для создания теней
 * Использует shadowColor/shadowOffset/shadowOpacity/shadowRadius для iOS/Android
 * и boxShadow для web (через style prop, не StyleSheet)
 */

export interface ShadowOptions {
  color?: string;
  offsetX?: number;
  offsetY?: number;
  opacity?: number;
  radius?: number;
  elevation?: number;
}

export function createShadow(options: ShadowOptions = {}): ViewStyle {
  const {
    color = '#000',
    offsetX = 0,
    offsetY = 4,
    opacity = 0.1,
    radius = 8,
    elevation = 3,
  } = options;

  if (Platform.OS === 'web') {
    // Для web возвращаем пустой объект
    // boxShadow будет применен через inline style
    return {
      // @ts-ignore - boxShadow не в типах ViewStyle, но работает на web
      boxShadow: `${offsetX}px ${offsetY}px ${radius}px rgba(0, 0, 0, ${opacity})`,
    } as ViewStyle;
  }

  // Для iOS/Android используем стандартные shadow* свойства
  return {
    shadowColor: color,
    shadowOffset: { width: offsetX, height: offsetY },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation, // Для Android
  };
}

// Пресеты теней для удобства
export const shadows = {
  sm: createShadow({ offsetY: 2, radius: 4, opacity: 0.05, elevation: 2 }),
  md: createShadow({ offsetY: 4, radius: 8, opacity: 0.08, elevation: 3 }),
  lg: createShadow({ offsetY: 8, radius: 16, opacity: 0.1, elevation: 5 }),
  xl: createShadow({ offsetY: 12, radius: 24, opacity: 0.12, elevation: 8 }),
};

