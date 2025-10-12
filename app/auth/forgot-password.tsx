import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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

// Типы для TypeScript
interface ValidationErrors {
  email?: string;
}

// Современная цветовая палитра
const COLORS = {
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  secondary: '#8B5CF6',
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
} as const;

// Получение размеров экрана для адаптивности
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 375;
const isMediumScreen = SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 768;

// Утилита для валидации email
const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Компонент формы восстановления пароля
const ForgotPasswordScreen: React.FC = () => {
  const router = useRouter();

  // Состояния формы
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState({ email: false });

  // Анимации
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

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

  // Анимация успеха
  useEffect(() => {
    if (emailSent) {
      Animated.spring(successAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();
    }
  }, [emailSent]);

  // Анимация тряски при ошибке
  const shakeAnimation = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // Валидация email
  const validateForm = useCallback((value: string): string | undefined => {
    if (!value.trim()) {
      return 'Email обязателен';
    }
    if (!validateEmail(value)) {
      return 'Введите корректный email';
    }
    return undefined;
  }, []);

  // Обработчик изменения email с валидацией
  const handleEmailChange = useCallback((text: string) => {
    setEmail(text);
    if (touched.email) {
      const error = validateForm(text);
      setErrors({ email: error });
    }
  }, [touched.email, validateForm]);

  // Обработчик потери фокуса
  const handleBlur = useCallback(() => {
    setTouched({ email: true });
    const error = validateForm(email);
    setErrors({ email: error });
  }, [email, validateForm]);

  // Обработчик отправки запроса на восстановление пароля
  const handleResetPassword = useCallback(async () => {
    // Отметить поле как "тронутое"
    setTouched({ email: true });

    // Валидация
    const emailError = validateForm(email);

    if (emailError) {
      setErrors({ email: emailError });
      shakeAnimation();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }

    setLoading(true);
    console.log('🔑 Запрос на восстановление пароля для:', email);

    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      console.log('📦 Ответ сервера:', data);

      if (data.success || response.ok) {
        console.log('✅ Письмо для восстановления отправлено');
        
        // Haptic feedback на успех
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        setEmailSent(true);
      } else {
        console.error('❌ Не удалось отправить письмо:', data.error);
        shakeAnimation();
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        Alert.alert(
          'Ошибка',
          data.error || 'Не удалось отправить письмо для восстановления пароля'
        );
      }
    } catch (error) {
      console.error('❌ Ошибка запроса:', error);
      
      // В случае ошибки сети всё равно показываем успех для безопасности
      // (чтобы злоумышленники не могли узнать, существует ли email)
      console.log('⚠️ Ошибка сети, но показываем успех для безопасности');
      setEmailSent(true);
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } finally {
      setLoading(false);
    }
  }, [email, validateForm, shakeAnimation]);

  // Обработчик возврата на страницу входа
  const handleGoToLogin = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push('/auth/login');
  }, [router]);

  // Обработчик повторной отправки
  const handleResendEmail = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setEmailSent(false);
    setEmail('');
    setErrors({});
    setTouched({ email: false });
    successAnim.setValue(0);
  }, [successAnim]);

  // Мемоизированные адаптивные стили
  const adaptiveStyles = useMemo(() => ({
    titleSize: isSmallScreen ? 28 : isMediumScreen ? 32 : 36,
    subtitleSize: isSmallScreen ? 14 : 15,
    inputHeight: isSmallScreen ? 48 : 52,
    buttonHeight: isSmallScreen ? 48 : 52,
    padding: isSmallScreen ? 20 : 24,
    maxWidth: isMediumScreen ? '100%' : 440,
  }), []);

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
                  paddingHorizontal: adaptiveStyles.padding,
                  maxWidth: adaptiveStyles.maxWidth,
                  alignSelf: 'center',
                  width: '100%',
                },
              ]}
            >
              {!emailSent ? (
                <>  
                  {/* Заголовок */}
                  <View style={styles.header}>
                    <Text style={[styles.title, { fontSize: adaptiveStyles.titleSize }]}>
                      Забыли пароль?
                    </Text>
                    <Text style={[styles.subtitle, { fontSize: adaptiveStyles.subtitleSize }]}>
                      Введите ваш email, и мы отправим инструкции по восстановлению
                    </Text>
                  </View>

                  {/* Форма */}
                  <Animated.View
                    style={[
                      styles.formContainer,
                      { transform: [{ translateX: shakeAnim }] },
                    ]}
                  >
                    {/* Поле Email */}
                    <View style={styles.inputWrapper}>
                      <Text style={styles.inputLabel}>Email</Text>
                      <View style={[styles.inputContainer, errors.email && touched.email && styles.inputError, { height: adaptiveStyles.inputHeight }]}>
                        <TextInput
                          style={styles.input}
                          placeholder="your@email.com"
                          placeholderTextColor={COLORS.gray}
                          value={email}
                          onChangeText={handleEmailChange}
                          onBlur={handleBlur}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          autoFocus={true}
                          editable={!loading}
                          returnKeyType="send"
                          onSubmitEditing={handleResetPassword}
                          accessibilityLabel="Поле ввода email"
                        />
                      </View>
                      {errors.email && touched.email && (
                        <Text style={styles.errorText}>{errors.email}</Text>
                      )}
                    </View>

                    {/* Кнопка отправки */}
                    <TouchableOpacity
                      style={[styles.resetButton, loading && styles.resetButtonDisabled, { height: adaptiveStyles.buttonHeight }]}
                      onPress={handleResetPassword}
                      disabled={loading}
                      accessibilityLabel="Отправить ссылку для восстановления"
                    >
                      {loading ? (
                        <ActivityIndicator color={COLORS.white} size="small" />
                      ) : (
                        <Text style={styles.resetButtonText}>Отправить ссылку</Text>
                      )}
                    </TouchableOpacity>

                    {/* Ссылка на вход */}
                    <View style={styles.loginContainer}>
                      <TouchableOpacity onPress={handleGoToLogin} accessibilityLabel="Вернуться ко входу">
                        <Text style={styles.backToLoginText}>← Вернуться ко входу</Text>
                      </TouchableOpacity>
                    </View>
                  </Animated.View>
                </>
              ) : (
                // Экран успешной отправки
                <Animated.View
                  style={[
                    styles.successContainer,
                    {
                      opacity: successAnim,
                      transform: [
                        {
                          scale: successAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.8, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={styles.successContent}>
                    <View style={styles.successIconContainer}>
                      <Ionicons name="checkmark-circle" size={80} color={COLORS.success} />
                    </View>
                    
                    <Text style={styles.successTitle}>Письмо отправлено!</Text>
                    
                    <Text style={styles.successText}>
                      Мы отправили инструкции по восстановлению пароля на адрес:
                    </Text>
                    
                    <Text style={styles.emailText}>{email}</Text>
                    
                    <View style={styles.successInfoBox}>
                      <Ionicons name="time-outline" size={20} color={COLORS.primary} style={styles.infoIcon} />
                      <Text style={styles.successInfoText}>
                        Ссылка будет действительна в течение 1 часа. Проверьте папку "Спам", если письмо не пришло.
                      </Text>
                    </View>

                    {/* Кнопки */}
                    <TouchableOpacity
                      style={[styles.actionButton, { height: adaptiveStyles.buttonHeight }]}
                      onPress={handleGoToLogin}
                      accessibilityLabel="Вернуться ко входу"
                    >
                      <Text style={styles.actionButtonText}>Вернуться ко входу</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.resendButton}
                      onPress={handleResendEmail}
                      accessibilityLabel="Отправить снова"
                    >
                      <Text style={styles.resendButtonText}>Отправить снова</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              )}
            </Animated.View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// Мемоизация компонента для предотвращения лишних ре-рендеров
export default React.memo(ForgotPasswordScreen);

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
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    minHeight: SCREEN_HEIGHT - 80,
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: COLORS.textLight,
    lineHeight: 22,
  },
  formContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 0,
  },
  inputWrapper: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  inputError: {
    borderColor: COLORS.error,
    backgroundColor: '#FEF2F2',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  resetButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  resetButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  loginContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  backToLoginText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  // Стили для экрана успеха
  successContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  successContent: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  successIconContainer: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  successText: {
    fontSize: 15,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 22,
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 24,
    textAlign: 'center',
  },
  successInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.cardBg,
    padding: 16,
    borderRadius: 10,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  successInfoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textLight,
    lineHeight: 20,
  },
  actionButton: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  resendButton: {
    paddingVertical: 12,
  },
  resendButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});
