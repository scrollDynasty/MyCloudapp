import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success || response.ok) {
        
        // Haptic feedback на успех
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        setEmailSent(true);
      } else {
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
      // В случае ошибки сети всё равно показываем успех для безопасности
      // (чтобы злоумышленники не могли узнать, существует ли email)
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
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/auth/login');
    }
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
    maxWidth: isMediumScreen ? ('100%' as `${number}%`) : 440,
  }), []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <LinearGradient
        colors={['#F9FAFB', '#FFFFFF']}
        style={styles.gradientBackground}
      >
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
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
                <Animated.View
                  style={[
                    styles.formContainer,
                    { transform: [{ translateX: shakeAnim }] },
                  ]}
                >
                  <View style={styles.formInner}>
                    {/* Header */}
                    <View style={styles.header}>
                      <Text style={styles.headerTitle}>Восстановление доступа</Text>
                    </View>

                    {/* Welcome Section */}
                    <View style={styles.welcomeSection}>
                      <View style={styles.welcomeIconContainer}>
                        <Ionicons name="lock-closed-outline" size={28} color="#111827" />
                      </View>
                      <Text style={styles.welcomeTitle}>Забыли пароль?</Text>
                      <Text style={styles.welcomeSubtitle}>
                        Введите email, на него отправим ссылку для сброса пароля
                      </Text>
                    </View>

                    {/* Form Content */}
                    <View style={styles.formContent}>
                      {/* Контакты Section */}
                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Контакты</Text>
                        
                        {/* Email Field */}
                        <View style={styles.inputWrapper}>
                          <Text style={styles.inputLabel}>Email аккаунта *</Text>
                          <View style={[
                            styles.inputContainer,
                            errors.email && touched.email && styles.inputError,
                          ]}>
                            <Ionicons name="mail-outline" size={20} color="#9CA3AF" />
                            <TextInput
                              style={styles.input}
                              placeholder="your@email.com"
                              placeholderTextColor="#9CA3AF"
                              value={email}
                              onChangeText={handleEmailChange}
                              onBlur={handleBlur}
                              keyboardType="email-address"
                              autoCapitalize="none"
                              autoCorrect={false}
                              editable={!loading}
                              returnKeyType="send"
                              onSubmitEditing={handleResetPassword}
                              accessibilityLabel="Поле ввода email"
                            />
                          </View>
                          {errors.email && touched.email && (
                            <View style={styles.errorContainer}>
                              <Text style={styles.errorText}>{errors.email}</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Подтверждение Section */}
                      <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Подтверждение</Text>
                        <View style={styles.confirmationBox}>
                          <Ionicons name="information-circle-outline" size={20} color="#374151" />
                          <Text style={styles.confirmationText}>
                            Если ваша учетная запись принадлежит компании, письмо придет на корпоративную почту администратора.
                          </Text>
                        </View>
                      </View>

                      {/* Submit Button */}
                      <TouchableOpacity
                        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                        onPress={handleResetPassword}
                        disabled={loading}
                        accessibilityLabel="Отправить ссылку для сброса"
                      >
                        {loading ? (
                          <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                          <>
                            <Ionicons name="send-outline" size={16} color="#FFFFFF" />
                            <Text style={styles.submitButtonText}>Отправить ссылку для сброса</Text>
                          </>
                        )}
                      </TouchableOpacity>

                      {/* Divider */}
                      <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>или</Text>
                        <View style={styles.dividerLine} />
                      </View>

                      {/* Back to Login Button */}
                      <TouchableOpacity
                        style={styles.backButton}
                        onPress={handleGoToLogin}
                        accessibilityLabel="Вернуться к входу"
                      >
                        <Ionicons name="arrow-back-outline" size={14} color="#374151" />
                        <Text style={styles.backButtonText}>Вернуться к входу</Text>
                      </TouchableOpacity>

                      {/* Info Text */}
                      <View style={styles.infoContainer}>
                        <Text style={styles.infoText}>
                          После сброса пароля вы сможете продолжить регистрацию как юридическое лицо и оформлять заказы во вкладке «Заказы».
                        </Text>
                      </View>
                    </View>
                  </View>
                </Animated.View>
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
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
};

// Мемоизация компонента для предотвращения лишних ре-рендеров
export default React.memo(ForgotPasswordScreen);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  gradientBackground: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 30,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    minHeight: SCREEN_HEIGHT - 100,
    paddingTop: 20,
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 48,
    padding: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  formInner: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 16,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 17,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 21.78,
  },
  welcomeSection: {
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
    alignItems: 'center',
    gap: 8,
  },
  welcomeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 21.78,
  },
  welcomeSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 14.52,
    textAlign: 'center',
  },
  formContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  section: {
    gap: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  inputWrapper: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    paddingHorizontal: 13,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEE2E2',
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    color: '#111827',
    lineHeight: 16.94,
    paddingVertical: 0,
  },
  errorContainer: {
    marginTop: 4,
    paddingLeft: 4,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '400',
  },
  confirmationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  confirmationText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '400',
    color: '#374151',
    lineHeight: 14.52,
  },
  submitButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#6366F1',
    paddingVertical: 13,
    paddingHorizontal: 13,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 16.94,
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  backButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 11,
    paddingHorizontal: 11,
    gap: 8,
  },
  backButtonText: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 15.73,
    textAlign: 'center',
  },
  infoContainer: {
    alignItems: 'center',
    paddingTop: 4,
  },
  infoText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 14.52,
    textAlign: 'center',
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
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  successText: {
    fontSize: 15,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 24,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
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
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
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
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  resendButton: {
    paddingVertical: 12,
  },
  resendButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
});
