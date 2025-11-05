import { Ionicons } from '@expo/vector-icons';
import * as AuthSession from 'expo-auth-session';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
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
import { useAuth } from '../../lib/AuthContext';

// Завершать браузер после успешной авторизации
WebBrowser.maybeCompleteAuthSession();

// Типы для TypeScript
interface LoginFormData {
  email: string;
  password: string;
}

interface ValidationErrors {
  email?: string;
  password?: string;
}

// Современная цветовая палитра с градиентами
const COLORS = {
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  primaryLight: '#818CF8',
  secondary: '#8B5CF6',
  gradientStart: '#667EEA',
  gradientEnd: '#764BA2',
  background: '#FFFFFF',
  backgroundLight: '#F8FAFC',
  cardBg: '#FFFFFF',
  inputBg: '#F1F5F9',
  inputFocusBg: '#FFFFFF',
  white: '#FFFFFF',
  text: '#0F172A',
  textLight: '#64748B',
  textLighter: '#94A3B8',
  gray: '#94A3B8',
  border: '#E2E8F0',
  borderFocus: '#6366F1',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  success: '#10B981',
  focus: '#6366F1',
  googleBg: '#FFFFFF',
  googleBorder: '#E2E8F0',
  shadow: '#000000',
} as const;

// Получение размеров экрана для адаптивности
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 375;
const isMediumScreen = SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 768;

// Утилита для валидации email с защитой от XSS
const validateEmail = (email: string): boolean => {
  // Базовая санитизация - удаление опасных символов
  const sanitized = email.trim().toLowerCase();
  
  // Проверка на потенциальный XSS
  const dangerousChars = /<|>|"|'|&|javascript:|on\w+=/i;
  if (dangerousChars.test(sanitized)) {
    return false;
  }
  
  // Стандартная валидация email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return emailRegex.test(sanitized);
};

// Санитизация ввода для защиты от XSS (улучшенная версия)
const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  
  // Ограничение длины для защиты от DoS
  const maxLength = 1000;
  const truncated = input.length > maxLength ? input.substring(0, maxLength) : input;
  
  return truncated
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
};

// Rate limiting на клиенте
class ClientRateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private readonly maxAttempts = 5;
  private readonly windowMs = 15 * 60 * 1000; // 15 минут

  canAttempt(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Удаляем старые попытки
    const recentAttempts = attempts.filter(time => now - time < this.windowMs);
    
    if (recentAttempts.length >= this.maxAttempts) {
      return false;
    }
    
    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);
    return true;
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }

  getRemainingAttempts(key: string): number {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    const recentAttempts = attempts.filter(time => now - time < this.windowMs);
    return Math.max(0, this.maxAttempts - recentAttempts.length);
  }
}

const rateLimiter = new ClientRateLimiter();

// Debounce утилита для оптимизации
const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// Компонент формы логина
const LoginScreen: React.FC = () => {
  const router = useRouter();
  const { signIn } = useAuth();

  // Состояния формы
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState({ email: false, password: false });
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [loginAttempts, setLoginAttempts] = useState(0);

  // Debounced email для валидации (оптимизация производительности)
  const debouncedEmail = useDebounce(email, 300);

  // Анимации
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

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
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
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

  // Валидация формы в реальном времени
  const validateForm = useCallback((field: 'email' | 'password', value: string): string | undefined => {
    if (field === 'email') {
      if (!value.trim()) {
        return 'Email обязателен';
      }
      if (!validateEmail(value)) {
        return 'Введите корректный email';
      }
      // Дополнительная проверка длины для защиты
      if (value.length > 254) {
        return 'Email слишком длинный';
      }
    }
    
    if (field === 'password') {
      if (!value) {
        return 'Пароль обязателен';
      }
      if (value.length < 6) {
        return 'Минимум 6 символов';
      }
      // Максимальная длина пароля для защиты
      if (value.length > 128) {
        return 'Пароль слишком длинный';
      }
    }
    
    return undefined;
  }, []);

  // Валидация debounced email (только если пользователь вводил)
  useEffect(() => {
    if (touched.email && debouncedEmail && debouncedEmail.length > 0) {
      const error = validateForm('email', debouncedEmail);
      setErrors(prev => ({ ...prev, email: error }));
    }
  }, [debouncedEmail, touched.email, validateForm]);

  // Обработчик изменения email с валидацией и санитизацией
  const handleEmailChange = useCallback((text: string) => {
    // Ограничение длины для защиты
    if (text.length > 254) return;
    
    // Базовая санитизация
    const sanitized = text.toLowerCase().trim();
    setEmail(sanitized);
    
    // Помечаем как "тронутое" только если пользователь что-то вводит
    if (sanitized.length > 0) {
      setTouched(prev => ({ ...prev, email: true }));
      const error = validateForm('email', sanitized);
      setErrors(prev => ({ ...prev, email: error }));
    } else {
      // Если поле очищено, убираем ошибку
      setErrors(prev => ({ ...prev, email: undefined }));
    }
  }, [validateForm]);

  // Обработчик изменения пароля с валидацией
  const handlePasswordChange = useCallback((text: string) => {
    // Ограничение длины для защиты
    if (text.length > 128) return;
    
    setPassword(text);
    
    // Помечаем как "тронутое" только если пользователь что-то вводит
    if (text.length > 0) {
      setTouched(prev => ({ ...prev, password: true }));
      const error = validateForm('password', text);
      setErrors(prev => ({ ...prev, password: error }));
    } else {
      // Если поле очищено, убираем ошибку
      setErrors(prev => ({ ...prev, password: undefined }));
    }
  }, [validateForm]);

  // Обработчик потери фокуса для отметки поля как "тронутого"
  const handleBlur = useCallback((field: 'email' | 'password') => {
    setFocusedField(null);
    const value = field === 'email' ? email : password;
    // Помечаем как "тронутое" только если пользователь что-то вводил
    if (value.length > 0) {
      setTouched(prev => ({ ...prev, [field]: true }));
      const error = validateForm(field, value);
      setErrors(prev => ({ ...prev, [field]: error }));
    }
  }, [email, password, validateForm]);

  // Обработчик фокуса
  const handleFocus = useCallback((field: 'email' | 'password') => {
    setFocusedField(field);
    // Анимация фокуса
    Animated.spring(scaleAnim, {
      toValue: 1.02,
      tension: 300,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  // Обработчик переключения видимости пароля с haptic feedback
  const handleTogglePassword = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } 
    setShowPassword(prev => !prev);
  }, []);


  // Обработчик входа с защитой от rate limiting
  const handleLogin = useCallback(async () => {
    // Отметить все поля как "тронутые" при попытке отправки
    setTouched({ email: true, password: true });

    // Валидация
    const emailError = validateForm('email', email);
    const passwordError = validateForm('password', password);

    if (emailError || passwordError) {
      setErrors({ email: emailError, password: passwordError });
      shakeAnimation();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }

    // Проверка rate limiting
    const rateLimitKey = `login_${email}`;
    if (!rateLimiter.canAttempt(rateLimitKey)) {
      const remaining = rateLimiter.getRemainingAttempts(rateLimitKey);
      Alert.alert(
        'Слишком много попыток',
        `Пожалуйста, подождите перед следующей попыткой. Осталось попыток: ${remaining}`,
        [{ text: 'OK' }]
      );
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }

    setLoading(true);

    try {
      // Санитизация данных перед отправкой (улучшенная безопасность)
      const sanitizedEmail = sanitizeInput(email.toLowerCase().trim());
      // Пароль не санитизируем, но проверяем длину и безопасность
      const sanitizedPassword = password.length > 128 ? password.substring(0, 128) : password;

      // Дополнительная проверка на валидность данных
      if (!sanitizedEmail || sanitizedEmail.length === 0) {
        setLoading(false);
        Alert.alert('Ошибка', 'Email не может быть пустым');
        return;
      }

      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          ...getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email: sanitizedEmail, 
          password: sanitizedPassword 
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Сброс rate limiter при успешном входе
        rateLimiter.reset(rateLimitKey);
        
        // Haptic feedback на успех
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        // Используем signIn из AuthContext
        await signIn(data.data.token, data.data.user);

        // Перенаправить в зависимости от роли
        if (data.data.user.role === 'admin') {
          router.replace('/(admin)/dashboard');
        } else {
          router.replace('/(user)/home');
        }
      } else {
        setLoginAttempts(prev => prev + 1);
        shakeAnimation();
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        Alert.alert('Ошибка', data.error || 'Неверный email или пароль');
      }
    } catch (error) {
      console.error('Login error:', error);
      shakeAnimation();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert('Ошибка', 'Не удалось подключиться к серверу. Проверьте подключение к интернету.');
    } finally {
      setLoading(false);
    }
  }, [email, password, validateForm, shakeAnimation, signIn, router]);

  // Обработчик входа через Google
  const handleGoogleLogin = useCallback(async () => {
    try {
      setLoading(true);
      
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      
      // Определяем redirect URI для текущей платформы
      const redirectUri = Platform.OS === 'web' && typeof window !== 'undefined'
        ? `${window.location.origin}/auth/callback`
        : AuthSession.makeRedirectUri({
            scheme: 'mycloud',
            path: 'auth/callback'
          });
      
      // Формируем URL для авторизации Google
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
        `client_id=${encodeURIComponent('735617581412-e8ceb269bj7qqrv9sl066q63g5dr5sne.apps.googleusercontent.com')}&` +
        `redirect_uri=${encodeURIComponent(`${API_URL}/api/auth/google/callback`)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent('openid profile email')}&` +
        `access_type=offline&` +
        `prompt=select_account&` +
        `state=${encodeURIComponent(redirectUri)}`;
      
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // Для веб - перенаправляем в той же вкладке
        window.location.href = authUrl;
      } else {
        // Для мобильных - используем WebBrowser
        const result = await WebBrowser.openAuthSessionAsync(
          authUrl,
          redirectUri
        );
        
        if (result.type === 'success') {
          const url = result.url;
          
          if (url.includes('token=')) {
            const tokenMatch = url.match(/token=([^&]+)/);
            const userMatch = url.match(/user=([^&#]+)/);
            
            if (tokenMatch && userMatch) {
              const token = tokenMatch[1];
              let userStr = decodeURIComponent(userMatch[1]);
              userStr = userStr.replace(/#.*$/, '');
              const user = JSON.parse(userStr);
              
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              
              await signIn(token, user);
              
              if (user.role === 'admin') {
                router.replace('/(admin)/dashboard');
              } else {
                router.replace('/(user)/home');
              }
            }
          }
        } else if (result.type === 'cancel') {
          Alert.alert('Отменено', 'Вход через Google был отменен');
        }
        
        setLoading(false);
      }
    } catch (error) {
      console.error('Google login error:', error);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert(
        'Ошибка',
        'Произошла ошибка при входе через Google. Попробуйте позже.'
      );
      setLoading(false);
    }
  }, [signIn, router]);

  // Обработчик "Забыли пароль?"
  const handleForgotPassword = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.replace('/auth/forgot-password');
  }, [router]);

  // Обработчик перехода на регистрацию
  const handleGoToRegister = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push('/auth/register');
  }, [router]);

  // Мемоизированные адаптивные стили (оптимизация производительности)
  const adaptiveStyles = useMemo(() => ({
    titleSize: isSmallScreen ? 28 : isMediumScreen ? 32 : 40,
    subtitleSize: isSmallScreen ? 13 : 15,
    inputHeight: isSmallScreen ? 48 : 56,
    buttonHeight: isSmallScreen ? 48 : 56,
    padding: isSmallScreen ? 16 : Platform.OS === 'ios' ? 24 : 20,
    maxWidth: isMediumScreen ? ('100%' as `${number}%`) : 440,
    formPadding: isSmallScreen ? 16 : 20,
  }), [isSmallScreen, isMediumScreen]);

  // Мемоизация обработчиков для предотвращения лишних ре-рендеров
  const memoizedHandlers = useMemo(() => ({
    emailChange: handleEmailChange,
    passwordChange: handlePasswordChange,
    emailBlur: () => handleBlur('email'),
    passwordBlur: () => handleBlur('password'),
    emailFocus: () => handleFocus('email'),
    passwordFocus: () => handleFocus('password'),
  }), [handleEmailChange, handlePasswordChange, handleBlur, handleFocus]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <LinearGradient
        colors={[COLORS.backgroundLight, COLORS.background]}
        style={styles.gradientBackground}
      >
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
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
                  transform: [
                    { translateY: slideAnim },
                    { scale: scaleAnim }
                  ],
                  paddingHorizontal: adaptiveStyles.padding,
                  maxWidth: adaptiveStyles.maxWidth,
                  alignSelf: 'center',
                  width: '100%',
                },
              ]}
            >
              {/* Форма входа */}
              <Animated.View
                style={[
                  styles.formContainer,
                  { transform: [{ translateX: shakeAnim }] },
                  { paddingHorizontal: adaptiveStyles.padding },
                  { borderRadius: adaptiveStyles.formPadding === 16 ? 32 : 48 },
                ]}
              >
                <View style={styles.formInner}>
                  {/* Header */}
                  <View style={styles.header}>
                    <Text style={styles.headerTitle}>Вход</Text>
                  </View>

                  {/* Welcome Section */}
                  <View style={styles.welcomeSection}>
                    <View style={styles.welcomeIconContainer}>
                      {/* Иконка будет здесь, но пока пропустим */}
                    </View>
                    <Text style={styles.welcomeTitle}>Добро пожаловать</Text>
                    <Text style={styles.welcomeSubtitle}>Войдите, чтобы управлять сервисами и заказами</Text>
                  </View>
                  {/* Поле Email */}
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Email</Text>
                    <Animated.View
                      style={[
                        styles.inputContainer,
                        errors.email && touched.email && styles.inputError,
                        focusedField === 'email' && styles.inputFocused,
                      ]}
                    >
                      <Ionicons name="mail-outline" size={20} color="#9CA3AF" />
                      <TextInput
                        style={styles.input}
                        placeholder="your@email.com"
                        placeholderTextColor="#9CA3AF"
                        value={email}
                        onChangeText={memoizedHandlers.emailChange}
                        onFocus={memoizedHandlers.emailFocus}
                        onBlur={memoizedHandlers.emailBlur}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        autoComplete="email"
                        editable={!loading}
                        returnKeyType="next"
                        accessibilityLabel="Поле ввода email"
                        textContentType="emailAddress"
                      />
                    </Animated.View>
                    {errors.email && touched.email && (
                      <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{errors.email}</Text>
                      </View>
                    )}
                  </View>

                  {/* Поле Пароль */}
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Пароль</Text>
                    <Animated.View
                      style={[
                        styles.inputContainer,
                        errors.password && touched.password && styles.inputError,
                        focusedField === 'password' && styles.inputFocused,
                      ]}
                    >
                      <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" />
                      <TextInput
                        style={styles.input}
                        placeholder="Введите пароль"
                        placeholderTextColor="#9CA3AF"
                        value={password}
                        onChangeText={memoizedHandlers.passwordChange}
                        onFocus={memoizedHandlers.passwordFocus}
                        onBlur={memoizedHandlers.passwordBlur}
                        secureTextEntry={!showPassword}
                        editable={!loading}
                        returnKeyType="done"
                        onSubmitEditing={handleLogin}
                        accessibilityLabel="Поле ввода пароля"
                        textContentType="password"
                        autoComplete="password"
                      />
                      <TouchableOpacity
                        onPress={handleTogglePassword}
                        style={styles.eyeIcon}
                        accessibilityLabel={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                      >
                        <Ionicons
                          name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                          size={20}
                          color="#9CA3AF"
                        />
                      </TouchableOpacity>
                    </Animated.View>
                    {errors.password && touched.password && (
                      <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{errors.password}</Text>
                      </View>
                    )}
                  </View>

                  {/* Забыли пароль и Нет аккаунта */}
                  <View style={styles.optionsContainer}>
                    <TouchableOpacity 
                      onPress={handleForgotPassword} 
                      accessibilityLabel="Забыли пароль?"
                      disabled={loading}
                    >
                      <Text style={styles.forgotPasswordText}>Забыли пароль?</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={handleGoToRegister} 
                      accessibilityLabel="Нет аккаунта?"
                      disabled={loading}
                    >
                      <Text style={styles.forgotPasswordText}>Нет аккаунта?</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Кнопка входа */}
                  <TouchableOpacity
                    style={[
                      styles.loginButton,
                      loading && styles.loginButtonDisabled,
                    ]}
                    onPress={handleLogin}
                    disabled={loading}
                    accessibilityLabel="Войти в систему"
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.loginButtonText}>Войти</Text>
                    )}
                  </TouchableOpacity>

                  {/* Разделитель */}
                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>или</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  {/* Кнопка входа через Google */}
                  <TouchableOpacity
                    style={styles.googleButton}
                    onPress={handleGoogleLogin}
                    disabled={loading}
                    accessibilityLabel="Войти через Google"
                    activeOpacity={0.7}
                  >
                    <Ionicons name="logo-google" size={16} color="#374151" />
                    <Text style={styles.googleButtonText}>Войти через Google</Text>
                  </TouchableOpacity>

                  {/* Ссылка на регистрацию */}
                  <View style={styles.registerContainer}>
                    <Text style={styles.registerText}>Нет аккаунта?</Text>
                    <TouchableOpacity 
                      onPress={handleGoToRegister} 
                      accessibilityLabel="Перейти к регистрации"
                      disabled={loading}
                      style={styles.registerButton}
                    >
                      <Text style={styles.registerLink}>Зарегистрироваться</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
};

// Мемоизация компонента для предотвращения лишних ре-рендеров
export default React.memo(LoginScreen);

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
    paddingVertical: Platform.OS === 'ios' ? 30 : 20,
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    minHeight: Math.max(SCREEN_HEIGHT - 150, 400),
    paddingTop: Platform.OS === 'ios' ? 20 : 10,
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
    paddingBottom: Platform.OS === 'ios' ? 20 : 16,
    paddingTop: Platform.OS === 'ios' ? 0 : 4,
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
  inputWrapper: {
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    marginBottom: 6,
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
  inputFocused: {
    backgroundColor: '#FFFFFF',
    borderColor: '#6366F1',
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
  eyeIcon: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
    minWidth: 24,
    height: 20,
  },
  errorContainer: {
    marginTop: 4,
    paddingLeft: 4,
    paddingHorizontal: 16,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '400',
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  forgotPasswordText: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 16.94,
  },
  loginButton: {
    borderRadius: 24,
    backgroundColor: '#6366F1',
    borderWidth: 1,
    borderColor: '#6366F1',
    paddingVertical: 13,
    paddingHorizontal: 13,
    marginHorizontal: 16,
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 16.94,
    textAlign: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 14.52,
  },
  googleButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 13,
    paddingHorizontal: 13,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  googleButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 16.94,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 4,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  registerText: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 15.73,
  },
  registerButton: {
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 9,
    paddingHorizontal: 11,
  },
  registerLink: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 15.73,
  },
});
