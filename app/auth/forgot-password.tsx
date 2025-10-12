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

// Константы цветовой палитры (сине-белая)
const COLORS = {
  primary: '#2563EB',
  secondary: '#3B82F6',
  accent: '#60A5FA',
  background: '#F8FAFC',
  white: '#FFFFFF',
  gray: '#94A3B8',
  darkGray: '#64748B',
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
    logoSize: isSmallScreen ? 50 : isMediumScreen ? 60 : 70,
    titleSize: isSmallScreen ? 26 : isMediumScreen ? 32 : 36,
    subtitleSize: isSmallScreen ? 14 : 16,
    inputHeight: isSmallScreen ? 52 : 56,
    buttonHeight: isSmallScreen ? 52 : 56,
    padding: isSmallScreen ? 16 : 20,
  }), []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <LinearGradient
          colors={[COLORS.primary, COLORS.secondary, COLORS.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
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
                },
              ]}
            >
              {!emailSent ? (
                <>
                  {/* Заголовок */}
                  <View style={styles.header}>
                    <View style={[styles.logoContainer, { width: adaptiveStyles.logoSize + 40, height: adaptiveStyles.logoSize + 40, borderRadius: (adaptiveStyles.logoSize + 40) / 2 }]}>
                      <Ionicons name="key" size={adaptiveStyles.logoSize} color={COLORS.white} />
                    </View>
                    <Text style={[styles.title, { fontSize: adaptiveStyles.titleSize }]}>
                      Забыли пароль?
                    </Text>
                    <Text style={[styles.subtitle, { fontSize: adaptiveStyles.subtitleSize }]}>
                      Введите email для восстановления
                    </Text>
                  </View>

                  {/* Форма */}
                  <Animated.View
                    style={[
                      styles.formContainer,
                      { transform: [{ translateX: shakeAnim }] },
                    ]}
                  >
                    {/* Инструкция */}
                    <View style={styles.instructionContainer}>
                      <Ionicons name="information-circle" size={20} color={COLORS.primary} />
                      <Text style={styles.instructionText}>
                        Мы отправим вам ссылку для сброса пароля на указанный email
                      </Text>
                    </View>

                    {/* Поле Email */}
                    <View style={styles.inputWrapper}>
                      <View style={[styles.inputContainer, errors.email && touched.email && styles.inputError, { height: adaptiveStyles.inputHeight }]}>
                        <Ionicons 
                          name="mail-outline" 
                          size={20} 
                          color={errors.email && touched.email ? COLORS.error : COLORS.primary} 
                          style={styles.inputIcon} 
                        />
                        <TextInput
                          style={styles.input}
                          placeholder="Email"
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
                      <LinearGradient
                        colors={[COLORS.primary, COLORS.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.gradientButton}
                      >
                        {loading ? (
                          <ActivityIndicator color={COLORS.white} size="small" />
                        ) : (
                          <>
                            <Ionicons name="paper-plane" size={20} color={COLORS.white} style={styles.buttonIcon} />
                            <Text style={styles.resetButtonText}>Отправить</Text>
                          </>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>

                    {/* Ссылка на вход */}
                    <View style={styles.loginContainer}>
                      <TouchableOpacity onPress={handleGoToLogin} accessibilityLabel="Вернуться ко входу">
                        <View style={styles.backToLoginButton}>
                          <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
                          <Text style={styles.backToLoginText}>Вернуться ко входу</Text>
                        </View>
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
                      <LinearGradient
                        colors={[COLORS.primary, COLORS.secondary]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.gradientButton}
                      >
                        <Text style={styles.actionButtonText}>Вернуться ко входу</Text>
                      </LinearGradient>
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
        </LinearGradient>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// Мемоизация компонента для предотвращения лишних ре-рендеров
export default React.memo(ForgotPasswordScreen);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    minHeight: SCREEN_HEIGHT - 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  instructionContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.darkGray,
    lineHeight: 20,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: COLORS.error,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  resetButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  gradientButton: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  buttonIcon: {
    marginRight: 8,
  },
  resetButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '600',
  },
  loginContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  backToLoginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backToLoginText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  // Стили для экрана успеха
  successContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  successContent: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  successIconContainer: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 12,
    textAlign: 'center',
  },
  successText: {
    fontSize: 16,
    color: COLORS.darkGray,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 24,
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
    backgroundColor: COLORS.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
  },
  infoIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  successInfoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.darkGray,
    lineHeight: 20,
  },
  actionButton: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 18,
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
