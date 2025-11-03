import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL } from '../../config/api';
import { getHeaders } from '../../config/fetch';

// Современная цветовая палитра
const COLORS = {
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  background: '#FFFFFF',
  cardBg: '#FAFAFA',
  inputBg: '#F8F9FA',
  white: '#FFFFFF',
  text: '#0F172A',
  textLight: '#64748B',
  gray: '#94A3B8',
  border: '#E2E8F0',
  error: '#EF4444',
  success: '#10B981',
  info: '#3B82F6',
  infoBg: '#EFF6FF',
} as const;

// Получение размеров экрана для адаптивности
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 375;

// Форматирование номера телефона для отображения
const formatPhoneNumber = (value: string): string => {
  // Удаляем все нецифровые символы
  const digits = value.replace(/\D/g, '');
  
  // Начинаем с +998
  if (!digits.startsWith('998')) {
    if (digits.length === 0) return '+998 ';
    return `+998 ${digits}`;
  }
  
  // Форматируем: +998 XX XXX XX XX
  const cleaned = digits.slice(3); // Убираем 998
  let formatted = '+998 ';
  
  if (cleaned.length > 0) formatted += cleaned.substring(0, 2);
  if (cleaned.length > 2) formatted += ' ' + cleaned.substring(2, 5);
  if (cleaned.length > 5) formatted += ' ' + cleaned.substring(5, 7);
  if (cleaned.length > 7) formatted += ' ' + cleaned.substring(7, 9);
  
  return formatted;
};

// Извлечение чистого номера для отправки на сервер
const extractPhoneNumber = (formatted: string): string => {
  return '+' + formatted.replace(/\D/g, '');
};

// Валидация номера телефона
const validatePhoneNumber = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  // Должен быть формат: 998XXXXXXXXX (12 цифр)
  return cleaned.length === 12 && cleaned.startsWith('998');
};

// Компонент экрана ввода телефона
const PhoneLoginScreen: React.FC = () => {
  const router = useRouter();
  
  // Состояния
  const [phoneDisplay, setPhoneDisplay] = useState('+998 ');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Анимации
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  
  // Запуск анимации появления при монтировании
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);
  
  // Анимация тряски при ошибке
  const shakeAnimation = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);
  
  // Обработчик изменения номера телефона
  const handlePhoneChange = useCallback((text: string) => {
    // Если пользователь стер все, вернуть +998 
    if (text.length < 5) {
      setPhoneDisplay('+998 ');
      setError('');
      return;
    }
    
    const formatted = formatPhoneNumber(text);
    setPhoneDisplay(formatted);
    setError('');
  }, []);
  
  // Обработчик отправки кода
  const handleSendCode = useCallback(async () => {
    const phoneNumber = extractPhoneNumber(phoneDisplay);
    
    // Валидация
    if (!validatePhoneNumber(phoneNumber)) {
      setError('Неверный формат номера телефона');
      shakeAnimation();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${API_URL}/api/auth/phone/send-code`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ phoneNumber }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Haptic feedback на успех
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        
        // Переход на экран ввода кода
        router.push({
          pathname: '/auth/verify-code',
          params: { phoneNumber }
        });
      } else {
        setError(data.error || 'Ошибка отправки SMS, проверьте номер');
        shakeAnimation();
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
    } catch (error: any) {
      console.error('Send code error:', error);
      
      // Определяем тип ошибки
      let errorMessage = 'Произошла ошибка, попробуйте снова';
      if (error.message === 'Network request failed' || !navigator.onLine) {
        errorMessage = 'Нет интернет-соединения';
      }
      
      setError(errorMessage);
      shakeAnimation();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setLoading(false);
    }
  }, [phoneDisplay, shakeAnimation, router]);
  
  // Проверка на возможность отправки
  const canSend = validatePhoneNumber(extractPhoneNumber(phoneDisplay)) && !loading;
  
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.background}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              style={[
                styles.content,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              {/* Заголовок */}
              <View style={styles.header}>
                <Text style={styles.title}>Вход в систему</Text>
                <Text style={styles.subtitle}>
                  Введите номер телефона для входа или регистрации
                </Text>
              </View>
              
              {/* Форма */}
              <Animated.View
                style={[
                  styles.formContainer,
                  { transform: [{ translateX: shakeAnim }] },
                ]}
              >
                {/* Информационный блок */}
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle" size={20} color={COLORS.info} />
                  <Text style={styles.infoText}>
                    Мы отправим SMS с кодом подтверждения на ваш номер
                  </Text>
                </View>
                
                {/* Поле номера телефона */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Номер телефона</Text>
                  <View style={[
                    styles.inputContainer,
                    error ? styles.inputError : null
                  ]}>
                    <Ionicons 
                      name="call-outline" 
                      size={20} 
                      color={COLORS.gray}
                      style={styles.phoneIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="+998 XX XXX XX XX"
                      placeholderTextColor={COLORS.gray}
                      value={phoneDisplay}
                      onChangeText={handlePhoneChange}
                      keyboardType="phone-pad"
                      editable={!loading}
                      maxLength={17} // +998 XX XXX XX XX
                      returnKeyType="done"
                      onSubmitEditing={handleSendCode}
                      accessibilityLabel="Поле ввода номера телефона"
                      autoFocus
                    />
                  </View>
                  {error && (
                    <View style={styles.errorContainer}>
                      <Ionicons name="alert-circle" size={16} color={COLORS.error} />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}
                </View>
                
                {/* Кнопка отправки кода */}
                <TouchableOpacity
                  style={[
                    styles.sendButton,
                    !canSend ? styles.sendButtonDisabled : null
                  ]}
                  onPress={handleSendCode}
                  disabled={!canSend}
                  accessibilityLabel="Получить код подтверждения"
                >
                  {loading ? (
                    <ActivityIndicator color={COLORS.white} size="small" />
                  ) : (
                    <>
                      <Text style={styles.sendButtonText}>Получить код</Text>
                      <Ionicons name="arrow-forward" size={20} color={COLORS.white} />
                    </>
                  )}
                </TouchableOpacity>
                
                {/* Разъяснение */}
                <Text style={styles.disclaimer}>
                  Нажимая "Получить код", вы соглашаетесь с условиями использования и политикой конфиденциальности
                </Text>
              </Animated.View>
            </Animated.View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default React.memo(PhoneLoginScreen);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 40,
    paddingHorizontal: isSmallScreen ? 20 : 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    minHeight: SCREEN_HEIGHT - 80,
    maxWidth: 440,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: isSmallScreen ? 28 : 32,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  subtitle: {
    fontSize: isSmallScreen ? 14 : 15,
    color: COLORS.textLight,
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  formContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 0,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.infoBg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: COLORS.info,
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  inputWrapper: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    height: isSmallScreen ? 52 : 56,
  },
  inputError: {
    borderColor: COLORS.error,
    backgroundColor: '#FEF2F2',
  },
  phoneIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 4,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
    marginLeft: 6,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    height: isSmallScreen ? 52 : 56,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  disclaimer: {
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
});
