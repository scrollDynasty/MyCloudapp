import { Ionicons } from '@expo/vector-icons';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
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
import { useAuth } from '../context/AuthContext';

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
  focus: '#6366F1',
  googleBg: '#4285F4',
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

// Компонент формы логина
const LoginScreen: React.FC = () => {
  const router = useRouter();
  const { signIn } = useAuth();

  // Состояния формы
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState({ email: false, password: false });

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

  // Валидация формы в реальном времени
  const validateForm = useCallback((field: 'email' | 'password', value: string): string | undefined => {
    if (field === 'email') {
      if (!value.trim()) {
        return 'Email обязателен';
      }
      if (!validateEmail(value)) {
        return 'Введите корректный email';
      }
    }
    
    if (field === 'password') {
      if (!value) {
        return 'Пароль обязателен';
      }
      if (value.length < 6) {
        return 'Минимум 6 символов';
      }
    }
    
    return undefined;
  }, []);

  // Обработчик изменения email с валидацией
  const handleEmailChange = useCallback((text: string) => {
    setEmail(text);
    if (touched.email) {
      const error = validateForm('email', text);
      setErrors(prev => ({ ...prev, email: error }));
    }
  }, [touched.email, validateForm]);

  // Обработчик изменения пароля с валидацией
  const handlePasswordChange = useCallback((text: string) => {
    setPassword(text);
    if (touched.password) {
      const error = validateForm('password', text);
      setErrors(prev => ({ ...prev, password: error }));
    }
  }, [touched.password, validateForm]);

  // Обработчик потери фокуса для отметки поля как "тронутого"
  const handleBlur = useCallback((field: 'email' | 'password') => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const value = field === 'email' ? email : password;
    const error = validateForm(field, value);
    setErrors(prev => ({ ...prev, [field]: error }));
  }, [email, password, validateForm]);

  // Обработчик переключения видимости пароля с haptic feedback
  const handleTogglePassword = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setShowPassword(prev => !prev);
  }, []);

  // Обработчик "Запомнить меня" с haptic feedback
  const handleToggleRememberMe = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setRememberMe(prev => !prev);
  }, []);

  // Обработчик входа
  const handleLogin = useCallback(async () => {
    // Отметить все поля как "тронутые"
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

    setLoading(true);
    console.log('🔑 Попытка входа с:', email);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      console.log('📦 Ответ сервера:', data);

      if (data.success) {
        console.log('✅ Вход успешен, пользователь:', data.data.user);
        
        // Haptic feedback на успех
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        // Используем signIn из AuthContext
        await signIn(data.data.token, data.data.user);
        console.log('✅ SignIn завершен');

        // Перенаправить в зависимости от роли
        if (data.data.user.role === 'admin') {
          console.log('🔄 Перенаправление на панель администратора');
          router.replace('/(admin)/dashboard');
        } else {
          console.log('🔄 Перенаправление на домашнюю страницу');
          router.replace('/(user)/home');
        }
      } else {
        console.error('❌ Вход не удался:', data.error);
        shakeAnimation();
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        Alert.alert('Ошибка', data.error || 'Неверный email или пароль');
      }
    } catch (error) {
      console.error('❌ Ошибка входа:', error);
      shakeAnimation();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert('Ошибка', 'Не удалось подключиться к серверу');
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
      
      console.log('🔑 Начало Google OAuth с redirect:', redirectUri);
      
      // Формируем URL для авторизации Google
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
        `client_id=${encodeURIComponent('735617581412-e8ceb269bj7qqrv9sl066q63g5dr5sne.apps.googleusercontent.com')}&` +
        `redirect_uri=${encodeURIComponent(`${API_URL}/api/auth/google/callback`)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent('openid profile email')}&` +
        `access_type=offline&` +
        `prompt=select_account&` +
        `state=${encodeURIComponent(redirectUri)}`;
      
      console.log('🌐 Открытие Google auth URL');
      
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // Для веб - перенаправляем в той же вкладке
        window.location.href = authUrl;
      } else {
        // Для мобильных - используем WebBrowser
        const result = await WebBrowser.openAuthSessionAsync(
          authUrl,
          redirectUri
        );
        
        console.log('📦 Результат авторизации:', result);
        
        if (result.type === 'success') {
          const url = result.url;
          console.log('✅ URL успеха:', url);
          
          if (url.includes('token=')) {
            const tokenMatch = url.match(/token=([^&]+)/);
            const userMatch = url.match(/user=([^&#]+)/);
            
            if (tokenMatch && userMatch) {
              const token = tokenMatch[1];
              let userStr = decodeURIComponent(userMatch[1]);
              userStr = userStr.replace(/#.*$/, '');
              const user = JSON.parse(userStr);
              
              console.log('✅ Вход через Google успешен, пользователь:', user);
              
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
          console.log('❌ Пользователь отменил вход через Google');
          Alert.alert('Отменено', 'Вход через Google был отменен');
        }
        
        setLoading(false);
      }
    } catch (error) {
      console.error('❌ Ошибка входа через Google:', error);
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
    router.push('/auth/forgot-password');
  }, [router]);

  // Обработчик перехода на регистрацию
  const handleGoToRegister = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push('/auth/register');
  }, [router]);

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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
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
              {/* Заголовок */}
              <View style={styles.header}>
                <Text style={[styles.title, { fontSize: adaptiveStyles.titleSize }]}>Вход</Text>
                <Text style={[styles.subtitle, { fontSize: adaptiveStyles.subtitleSize }]}>
                  Войдите в свой аккаунт, чтобы продолжить
                </Text>
              </View>

              {/* Форма входа */}
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
                      onBlur={() => handleBlur('email')}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                      returnKeyType="next"
                      accessibilityLabel="Поле ввода email"
                    />
                  </View>
                  {errors.email && touched.email && (
                    <Text style={styles.errorText}>{errors.email}</Text>
                  )}
                </View>

                {/* Поле Пароль */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Пароль</Text>
                  <View style={[styles.inputContainer, errors.password && touched.password && styles.inputError, { height: adaptiveStyles.inputHeight }]}>
                    <TextInput
                      style={styles.input}
                      placeholder="Введите пароль"
                      placeholderTextColor={COLORS.gray}
                      value={password}
                      onChangeText={handlePasswordChange}
                      onBlur={() => handleBlur('password')}
                      secureTextEntry={!showPassword}
                      editable={!loading}
                      returnKeyType="done"
                      onSubmitEditing={handleLogin}
                      accessibilityLabel="Поле ввода пароля"
                    />
                    <TouchableOpacity
                      onPress={handleTogglePassword}
                      style={styles.eyeIcon}
                      accessibilityLabel={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color={COLORS.gray}
                      />
                    </TouchableOpacity>
                  </View>
                  {errors.password && touched.password && (
                    <Text style={styles.errorText}>{errors.password}</Text>
                  )}
                </View>

                {/* Запомнить меня и Забыли пароль */}
                <View style={styles.optionsContainer}>
                  <TouchableOpacity
                    style={styles.rememberMeContainer}
                    onPress={handleToggleRememberMe}
                    accessibilityLabel="Запомнить меня"
                  >
                    <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                      {rememberMe && (
                        <Ionicons name="checkmark" size={16} color={COLORS.white} />
                      )}
                    </View>
                    <Text style={styles.rememberMeText}>Запомнить меня</Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={handleForgotPassword} accessibilityLabel="Забыли пароль?">
                    <Text style={styles.forgotPasswordText}>Забыли пароль?</Text>
                  </TouchableOpacity>
                </View>

                {/* Кнопка входа */}
                <TouchableOpacity
                  style={[styles.loginButton, loading && styles.loginButtonDisabled, { height: adaptiveStyles.buttonHeight }]}
                  onPress={handleLogin}
                  disabled={loading}
                  accessibilityLabel="Войти в систему"
                >
                  {loading ? (
                    <ActivityIndicator color={COLORS.white} size="small" />
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
                  style={[styles.googleButton, { height: adaptiveStyles.buttonHeight }]}
                  onPress={handleGoogleLogin}
                  disabled={loading}
                  accessibilityLabel="Войти через Google"
                >
                  <Ionicons name="logo-google" size={20} color={COLORS.googleBg} style={styles.googleIcon} />
                  <Text style={styles.googleButtonText}>Продолжить с Google</Text>
                </TouchableOpacity>

                {/* Ссылка на регистрацию */}
                <View style={styles.registerContainer}>
                  <Text style={styles.registerText}>Нет аккаунта? </Text>
                  <TouchableOpacity onPress={handleGoToRegister} accessibilityLabel="Перейти к регистрации">
                    <Text style={styles.registerLink}>Зарегистрироваться</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>

              {/* Тестовые данные */}
              <View style={styles.testCredentials}>
                <Text style={styles.testTitle}>Тестовые данные:</Text>
                <Text style={styles.testText}>Админ: admin@vps-billing.com / admin123</Text>
                <Text style={styles.testText}>Пользователь: john@individual.com / user123</Text>
              </View>
            </Animated.View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// Мемоизация компонента для предотвращения лишних ре-рендеров
export default React.memo(LoginScreen);

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
    marginBottom: 8,
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
    marginBottom: 20,
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
  eyeIcon: {
    padding: 8,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  rememberMeText: {
    color: COLORS.textLight,
    fontSize: 14,
  },
  forgotPasswordText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    marginHorizontal: 16,
    color: COLORS.gray,
    fontSize: 14,
  },
  googleButton: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  googleIcon: {
    marginRight: 10,
  },
  googleButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  registerText: {
    color: COLORS.textLight,
    fontSize: 15,
  },
  registerLink: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  testCredentials: {
    marginTop: 32,
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  testTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 10,
  },
  testText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
