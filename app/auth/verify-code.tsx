import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_URL } from '../../config/api';
import { getHeaders } from '../../config/fetch';
import { useAuth } from '../../lib/AuthContext';

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

// Получение размеров экрана
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 375;

// Компонент экрана ввода кода
const VerifyCodeScreen: React.FC = () => {
  const router = useRouter();
  const { signIn } = useAuth();
  const params = useLocalSearchParams<{ phoneNumber: string }>();
  const phoneNumber = params.phoneNumber;
  
  // Состояния
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [resending, setResending] = useState(false);
  
  // Ссылки на инпуты
  const inputRefs = useRef<Array<TextInput | null>>([]);
  
  // Анимации
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  
  // Запуск анимации появления
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
    
    // Фокус на первый инпут
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 300);
  }, []);
  
  // Таймер обратного отсчета
  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [timer]);
  
  // Автоматическая проверка при вводе 6 цифр
  useEffect(() => {
    const fullCode = code.join('');
    if (fullCode.length === 6 && !loading) {
      handleVerifyCode(fullCode);
    }
  }, [code]);
  
  // Анимация тряски при ошибке
  const shakeAnimation = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);
  
  // Обработчик изменения кода
  const handleCodeChange = useCallback((text: string, index: number) => {
    // Разрешаем только цифры
    const digit = text.replace(/[^0-9]/g, '');
    
    if (digit.length > 1) {
      // Если вставили несколько цифр (например, из буфера)
      const digits = digit.slice(0, 6).split('');
      const newCode = [...code];
      digits.forEach((d, i) => {
        if (index + i < 6) {
          newCode[index + i] = d;
        }
      });
      setCode(newCode);
      setError('');
      
      // Фокус на последний заполненный или следующий пустой
      const nextEmpty = newCode.findIndex(c => c === '');
      const focusIndex = nextEmpty === -1 ? 5 : nextEmpty;
      inputRefs.current[focusIndex]?.focus();
    } else {
      // Одна цифра
      const newCode = [...code];
      newCode[index] = digit;
      setCode(newCode);
      setError('');
      
      // Автоматический переход на следующее поле
      if (digit && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  }, [code]);
  
  // Обработчик удаления
  const handleKeyPress = useCallback((e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (!code[index] && index > 0) {
        // Если текущее поле пустое, переходим на предыдущее
        inputRefs.current[index - 1]?.focus();
        const newCode = [...code];
        newCode[index - 1] = '';
        setCode(newCode);
      } else {
        // Очищаем текущее поле
        const newCode = [...code];
        newCode[index] = '';
        setCode(newCode);
      }
      setError('');
    }
  }, [code]);
  
  // Проверка кода
  const handleVerifyCode = useCallback(async (verificationCode?: string) => {
    const fullCode = verificationCode || code.join('');
    
    if (fullCode.length !== 6) {
      setError('Введите 6-значный код');
      shakeAnimation();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`${API_URL}/api/auth/phone/verify-code`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          phoneNumber,
          code: fullCode,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Haptic feedback на успех
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        
        // Сохраняем токен и пользователя
        await signIn(data.data.token, data.data.user);
        
        // Перенаправление в зависимости от роли
        if (data.data.user.role === 'admin') {
          router.replace('/(admin)/dashboard');
        } else {
          router.replace('/(user)/home');
        }
      } else {
        // Определяем тип ошибки
        let errorMessage = data.error || 'Неверный код подтверждения';
        
        if (errorMessage.includes('expired')) {
          errorMessage = 'Код истек, запросите новый';
        } else if (errorMessage.includes('attempts')) {
          errorMessage = 'Слишком много попыток, попробуйте позже';
        }
        
        setError(errorMessage);
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        shakeAnimation();
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
    } catch (error: any) {
      console.error('Verify code error:', error);
      
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
  }, [code, phoneNumber, signIn, router, shakeAnimation]);
  
  // Повторная отправка кода
  const handleResendCode = useCallback(async () => {
    if (!canResend || resending) return;
    
    setResending(true);
    setError('');
    setCode(['', '', '', '', '', '']);
    
    try {
      const response = await fetch(`${API_URL}/api/auth/phone/send-code`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ phoneNumber }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        
        // Сброс таймера
        setTimer(60);
        setCanResend(false);
        inputRefs.current[0]?.focus();
        
        Alert.alert('Успешно', 'Новый код отправлен на ваш номер');
      } else {
        setError(data.error || 'Ошибка отправки SMS');
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
    } catch (error) {
      console.error('Resend code error:', error);
      setError('Не удалось отправить код повторно');
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setResending(false);
    }
  }, [canResend, resending, phoneNumber]);
  
  // Изменить номер телефона
  const handleChangePhone = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.back();
  }, [router]);
  
  // Форматирование номера для отображения
  const displayPhone = phoneNumber?.replace(/(\+998)(\d{2})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
  
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
              {/* Кнопка назад */}
              <TouchableOpacity 
                style={styles.backButton}
                onPress={handleChangePhone}
                accessibilityLabel="Вернуться назад"
              >
                <Ionicons name="arrow-back" size={24} color={COLORS.text} />
              </TouchableOpacity>
              
              {/* Заголовок */}
              <View style={styles.header}>
                <Text style={styles.title}>Введите код</Text>
                <Text style={styles.subtitle}>Мы отправили SMS с кодом на номер{'\n'}<Text style={styles.phoneText}>{displayPhone}</Text></Text>
                <TouchableOpacity onPress={handleChangePhone} style={styles.changePhoneButton}>
                  <Text style={styles.changePhoneText}>Изменить номер</Text>
                </TouchableOpacity>
              </View>
              
              {/* Форма */}
              <Animated.View
                style={[
                  styles.formContainer,
                  { transform: [{ translateX: shakeAnim }] },
                ]}
              >
                {/* Поля ввода кода */}
                <View style={styles.codeContainer}>
                  {code.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={ref => {
                        inputRefs.current[index] = ref;
                      }}
                      style={[
                        styles.codeInput,
                        digit ? styles.codeInputFilled : null,
                        error ? styles.codeInputError : null,
                      ]}
                      value={digit}
                      onChangeText={text => handleCodeChange(text, index)}
                      onKeyPress={e => handleKeyPress(e, index)}
                      keyboardType="number-pad"
                      maxLength={1}
                      editable={!loading}
                      selectTextOnFocus
                      accessibilityLabel={`Цифра ${index + 1}`}
                    />
                  ))}
                </View>
                
                {/* Ошибка */}
                {error && (
                  <View style={styles.errorContainer}>
                    <Ionicons name="alert-circle" size={18} color={COLORS.error} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}
                
                {/* Загрузка */}
                {loading && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator color={COLORS.primary} size="small" />
                    <Text style={styles.loadingText}>Проверка кода...</Text>
                  </View>
                )}
                
                {/* Таймер и повторная отправка */}
                <View style={styles.resendContainer}>
                  {!canResend ? (
                    <Text style={styles.timerText}>
                      Отправить код повторно через {timer} сек
                    </Text>
                  ) : (
                    <TouchableOpacity
                      onPress={handleResendCode}
                      disabled={resending}
                      style={styles.resendButton}
                      accessibilityLabel="Отправить код повторно"
                    >
                      {resending ? (
                        <ActivityIndicator color={COLORS.primary} size="small" />
                      ) : (
                        <>
                          <Ionicons name="refresh" size={18} color={COLORS.primary} />
                          <Text style={styles.resendText}>Отправить код повторно</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
                
                {/* Информация */}
                <View style={styles.infoBox}>
                  <Ionicons name="information-circle" size={18} color={COLORS.info} />
                  <Text style={styles.infoText}>
                    Код действителен в течение 10 минут
                  </Text>
                </View>
              </Animated.View>
            </Animated.View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default React.memo(VerifyCodeScreen);

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
    paddingVertical: 20,
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: isSmallScreen ? 28 : 32,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textLight,
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  phoneText: {
    fontWeight: '600',
    color: COLORS.text,
  },
  changePhoneButton: {
    marginTop: 8,
  },
  changePhoneText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  formContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 0,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  codeInput: {
    width: isSmallScreen ? 45 : 52,
    height: isSmallScreen ? 55 : 62,
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  codeInputFilled: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  codeInputError: {
    borderColor: COLORS.error,
    backgroundColor: '#FEF2F2',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    marginLeft: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 14,
    color: COLORS.textLight,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  timerText: {
    fontSize: 14,
    color: COLORS.gray,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  resendText: {
    fontSize: 15,
    color: COLORS.primary,
    fontWeight: '600',
    marginLeft: 6,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.infoBg,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 13,
    color: COLORS.info,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
});
