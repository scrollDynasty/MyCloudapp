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
import { useAuth } from '../../lib/AuthContext';

// Типы для TypeScript
interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  phone: string;
  role: 'individual' | 'legal_entity';
  companyName: string;
  taxId: string;
}

interface ValidationErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
  fullName?: string;
  phone?: string;
  companyName?: string;
  taxId?: string;
}

interface PasswordStrength {
  score: number; // 0-4
  label: string;
  color: string;
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
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  shadow: '#000000',
} as const;

// Получение размеров экрана для адаптивности
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 375;
const isMediumScreen = SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 768;

// Утилита для валидации email с защитой от XSS
const validateEmail = (email: string): boolean => {
  const sanitized = email.trim().toLowerCase();
  
  // Проверка на потенциальный XSS
  const dangerousChars = /<|>|"|'|&|javascript:|on\w+=/i;
  if (dangerousChars.test(sanitized)) {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  return emailRegex.test(sanitized);
};

// Утилита для валидации телефона
const validatePhone = (phone: string): boolean => {
  // Удаляем все символы кроме цифр и +
  const cleaned = phone.replace(/[^\d+]/g, '');
  // Проверяем, что номер содержит только цифры и возможно начинается с +
  return /^\+?[\d\s-]{9,15}$/.test(cleaned);
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

// Утилита для проверки силы пароля
const checkPasswordStrength = (password: string): PasswordStrength => {
  let score = 0;
  
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;

  const labels = ['Очень слабый', 'Слабый', 'Средний', 'Хороший', 'Отличный'];
  const colors = [COLORS.error, COLORS.warning, COLORS.warning, COLORS.success, COLORS.success];

  return {
    score: Math.min(score, 4),
    label: labels[Math.min(score, 4)],
    color: colors[Math.min(score, 4)],
  };
};

// Rate limiting на клиенте для регистрации
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

const registerRateLimiter = new ClientRateLimiter();

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

// Компонент формы регистрации
const RegisterScreen: React.FC = () => {
  const router = useRouter();
  const { signIn } = useAuth();

  // Состояния формы
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'individual' | 'legal_entity'>('individual');
  const [companyName, setCompanyName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState({
    email: false,
    password: false,
    confirmPassword: false,
    fullName: false,
    phone: false,
    companyName: false,
    taxId: false,
  });
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Debounced значения для валидации (оптимизация производительности)
  const debouncedEmail = useDebounce(email, 300);
  const debouncedPassword = useDebounce(password, 300);

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

  // Вычисление силы пароля (мемоизировано)
  const passwordStrength = useMemo(() => checkPasswordStrength(password), [password]);

  // Валидация полей
  const validateField = useCallback((field: string, value: string): string | undefined => {
    switch (field) {
      case 'fullName':
        if (!value.trim()) return 'Имя обязательно';
        if (value.trim().length < 2) return 'Минимум 2 символа';
        if (value.trim().length > 100) return 'Имя слишком длинное';
        // Проверка на опасные символы
        if (/<|>|"|'|&|javascript:/i.test(value)) return 'Недопустимые символы';
        break;
      
      case 'email':
        if (!value.trim()) return 'Email обязателен';
        if (!validateEmail(value)) return 'Введите корректный email';
        if (value.length > 254) return 'Email слишком длинный';
        break;
      
      case 'phone':
        if (value && value.trim()) {
          if (!validatePhone(value)) return 'Некорректный номер телефона';
          if (value.length > 20) return 'Номер слишком длинный';
        }
        break;
      
      case 'password':
        if (!value) return 'Пароль обязателен';
        if (value.length < 6) return 'Минимум 6 символов';
        if (value.length > 128) return 'Пароль слишком длинный';
        break;
      
      case 'confirmPassword':
        if (!value) return 'Подтвердите пароль';
        if (value !== password) return 'Пароли не совпадают';
        break;
      
      case 'companyName':
        if (role === 'legal_entity') {
          if (!value.trim()) return 'Название компании обязательно';
          if (value.trim().length < 2) return 'Минимум 2 символа';
          if (value.trim().length > 200) return 'Название слишком длинное';
          if (/<|>|"|'|&|javascript:/i.test(value)) return 'Недопустимые символы';
        }
        break;
      
      case 'taxId':
        if (role === 'legal_entity') {
          if (!value.trim()) return 'ИНН обязателен';
          if (!/^\d+$/.test(value.trim())) return 'ИНН должен содержать только цифры';
          if (value.trim().length < 9 || value.trim().length > 12) return 'ИНН должен быть от 9 до 12 цифр';
        }
        break;
    }
    return undefined;
  }, [password, role]);

  // Валидация debounced значений (только если пользователь вводил)
  useEffect(() => {
    if (touched.email && debouncedEmail && debouncedEmail.length > 0) {
      const error = validateField('email', debouncedEmail);
      setErrors(prev => ({ ...prev, email: error }));
    }
  }, [debouncedEmail, touched.email, validateField]);

  useEffect(() => {
    if (touched.password && debouncedPassword && debouncedPassword.length > 0) {
      const error = validateField('password', debouncedPassword);
      setErrors(prev => ({ ...prev, password: error }));
      // Также обновляем confirmPassword если пароль изменился
      if (touched.confirmPassword && confirmPassword && confirmPassword.length > 0) {
        const confirmError = validateField('confirmPassword', confirmPassword);
        setErrors(prev => ({ ...prev, confirmPassword: confirmError }));
      }
    }
  }, [debouncedPassword, touched.password, confirmPassword, touched.confirmPassword, validateField]);

  // Анимация тряски при ошибке
  const shakeAnimation = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // Обработчики изменений полей с валидацией и санитизацией
  const handleFieldChange = useCallback((field: keyof RegisterFormData, value: string) => {
    // Ограничения длины для защиты
    const maxLengths: Record<string, number> = {
      email: 254,
      password: 128,
      confirmPassword: 128,
      fullName: 100,
      phone: 20,
      companyName: 200,
      taxId: 12,
    };

    if (maxLengths[field] && value.length > maxLengths[field]) return;

    // Обновляем значение
    switch (field) {
      case 'email': 
        setEmail(value.toLowerCase().trim()); 
        break;
      case 'password': 
        setPassword(value); 
        break;
      case 'confirmPassword': 
        setConfirmPassword(value); 
        break;
      case 'fullName': 
        // Разрешаем только буквы, пробелы и некоторые символы
        const sanitizedName = value.replace(/[^a-zA-Zа-яА-ЯёЁ\s\-'\.]/g, '');
        setFullName(sanitizedName); 
        break;
      case 'phone': 
        // Разрешаем только цифры, +, пробелы и дефисы
        const sanitizedPhone = value.replace(/[^\d+\s\-()]/g, '');
        setPhone(sanitizedPhone); 
        break;
      case 'companyName': 
        // Базовая санитизация названия компании
        const sanitizedCompany = value.replace(/<|>|"|'/g, '');
        setCompanyName(sanitizedCompany); 
        break;
      case 'taxId': 
        // Только цифры для ИНН
        const sanitizedTaxId = value.replace(/\D/g, '');
        setTaxId(sanitizedTaxId); 
        break;
    }

    // Помечаем как "тронутое" только если пользователь что-то вводит
    if (value.length > 0) {
      setTouched(prev => ({ ...prev, [field]: true }));
      const error = validateField(field, field === 'email' ? value.toLowerCase() : value);
      setErrors(prev => ({ ...prev, [field]: error }));
    } else {
      // Если поле очищено, убираем ошибку
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  }, [validateField]);

  // Обработчик потери фокуса
  const handleBlur = useCallback((field: keyof typeof touched) => {
    setFocusedField(null);
    
    let value = '';
    switch (field) {
      case 'email': value = email; break;
      case 'password': value = password; break;
      case 'confirmPassword': value = confirmPassword; break;
      case 'fullName': value = fullName; break;
      case 'phone': value = phone; break;
      case 'companyName': value = companyName; break;
      case 'taxId': value = taxId; break;
    }
    
    // Помечаем как "тронутое" только если пользователь что-то вводил
    if (value.length > 0) {
      setTouched(prev => ({ ...prev, [field]: true }));
      const error = validateField(field, value);
      setErrors(prev => ({ ...prev, [field]: error }));
    }
  }, [email, password, confirmPassword, fullName, phone, companyName, taxId, validateField]);

  // Обработчик фокуса
  const handleFocus = useCallback((field: string) => {
    setFocusedField(field);
    Animated.spring(scaleAnim, {
      toValue: 1.01,
      tension: 300,
      friction: 7,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  // Переключение видимости пароля с haptic feedback
  const handleTogglePassword = useCallback((field: 'password' | 'confirmPassword') => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (field === 'password') {
      setShowPassword(prev => !prev);
    } else {
      setShowConfirmPassword(prev => !prev);
    }
  }, []);

  // Переключение роли
  const handleRoleChange = useCallback((newRole: 'individual' | 'legal_entity') => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setRole(newRole);
    // Сброс ошибок при смене роли
    if (newRole === 'individual') {
      setCompanyName('');
      setTaxId('');
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.companyName;
        delete newErrors.taxId;
        return newErrors;
      });
    }
  }, []);

  // Обработчик регистрации
  const handleRegister = useCallback(async () => {
    // Отметить все обязательные поля как "тронутые" при попытке отправки
    const newTouched = { ...touched };
    Object.keys(newTouched).forEach(key => {
      newTouched[key as keyof typeof newTouched] = true;
    });
    setTouched(newTouched);

    // Валидация всех полей
    const newErrors: ValidationErrors = {};
    newErrors.fullName = validateField('fullName', fullName);
    newErrors.email = validateField('email', email);
    newErrors.phone = validateField('phone', phone);
    newErrors.password = validateField('password', password);
    newErrors.confirmPassword = validateField('confirmPassword', confirmPassword);
    
    if (role === 'legal_entity') {
      newErrors.companyName = validateField('companyName', companyName);
      newErrors.taxId = validateField('taxId', taxId);
    }

    // Проверка наличия ошибок
    const hasErrors = Object.values(newErrors).some(error => error !== undefined);
    
    if (hasErrors) {
      setErrors(newErrors);
      shakeAnimation();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      return;
    }

    // Проверка rate limiting для регистрации
    const rateLimitKey = `register_${email}`;
    if (!registerRateLimiter.canAttempt(rateLimitKey)) {
      const remaining = registerRateLimiter.getRemainingAttempts(rateLimitKey);
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
      // Пароль не санитизируем, но проверяем длину
      const sanitizedPassword = password.length > 128 ? password.substring(0, 128) : password;
      
      // Дополнительная проверка на валидность данных
      if (!sanitizedEmail || sanitizedEmail.length === 0) {
        setLoading(false);
        Alert.alert('Ошибка', 'Email не может быть пустым');
        return;
      }

      const requestBody: any = {
        email: sanitizedEmail,
        password: sanitizedPassword,
        full_name: sanitizeInput(fullName.trim()),
        role,
      };

      if (phone && phone.trim()) {
        // Безопасная очистка номера телефона
        requestBody.phone = phone.trim().replace(/[^\d+]/g, '').substring(0, 20);
      }
      
      if (role === 'legal_entity') {
        requestBody.company_name = sanitizeInput(companyName.trim());
        requestBody.tax_id = taxId.trim().substring(0, 12);
      }

      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          ...getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.success) {
        // Сброс rate limiter при успешной регистрации
        registerRateLimiter.reset(rateLimitKey);
        
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }

        // Используем signIn из AuthContext
        await signIn(data.data.token, data.data.user);

        Alert.alert('Успешно', 'Регистрация прошла успешно!', [
          {
            text: 'OK',
            onPress: () => {
              if (data.data.user.role === 'admin') {
                router.replace('/(admin)/dashboard');
              } else {
                router.replace('/(user)/home');
              }
            },
          },
        ]);
      } else {
        shakeAnimation();
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        Alert.alert('Ошибка', data.error || 'Не удалось зарегистрироваться');
      }
    } catch (error) {
      console.error('Registration error:', error);
      shakeAnimation();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert('Ошибка', 'Не удалось подключиться к серверу. Проверьте подключение к интернету.');
    } finally {
      setLoading(false);
    }
  }, [email, password, confirmPassword, fullName, phone, role, companyName, taxId, touched, validateField, shakeAnimation, signIn, router]);

  // Обработчик перехода на логин
  const handleGoToLogin = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.replace('/auth/login');
  }, [router]);

  // Мемоизированные адаптивные стили
  const adaptiveStyles = useMemo(() => ({
    titleSize: isSmallScreen ? 28 : isMediumScreen ? 32 : 36,
    subtitleSize: isSmallScreen ? 14 : 15,
    inputHeight: isSmallScreen ? 52 : 56,
    buttonHeight: isSmallScreen ? 52 : 56,
    padding: isSmallScreen ? 24 : 28,
    maxWidth: isMediumScreen ? ('100%' as `${number}%`) : 440,
  }), []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <LinearGradient
        colors={[COLORS.backgroundLight, COLORS.background]}
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
              {/* Заголовок убран для минималистичного дизайна */}

              {/* Форма регистрации */}
              <Animated.View
                style={[
                  styles.formContainer,
                  { transform: [{ translateX: shakeAnim }] },
                ]}
              >
                {/* Выбор роли */}
                <View style={styles.roleContainer}>
                  <TouchableOpacity
                    style={[styles.roleButton, role === 'individual' && styles.roleButtonActive]}
                    onPress={() => handleRoleChange('individual')}
                    disabled={loading}
                    accessibilityLabel="Физическое лицо"
                    activeOpacity={0.8}
                  >
                    <View style={styles.roleButtonInner}>
                      <View style={[styles.roleIndicator, role === 'individual' && styles.roleIndicatorActive]} />
                      <Text style={[styles.roleText, role === 'individual' && styles.roleTextActive]}>
                        Физическое лицо
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.roleButton, role === 'legal_entity' && styles.roleButtonActive]}
                    onPress={() => handleRoleChange('legal_entity')}
                    disabled={loading}
                    accessibilityLabel="Юридическое лицо"
                    activeOpacity={0.8}
                  >
                    <View style={styles.roleButtonInner}>
                      <View style={[styles.roleIndicator, role === 'legal_entity' && styles.roleIndicatorActive]} />
                      <Text style={[styles.roleText, role === 'legal_entity' && styles.roleTextActive]}>
                        Юридическое лицо
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Полное имя */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Полное имя *</Text>
                  <Animated.View
                    style={[
                      styles.inputContainer,
                      errors.fullName && touched.fullName && styles.inputError,
                      focusedField === 'fullName' && styles.inputFocused,
                      { height: adaptiveStyles.inputHeight }
                    ]}
                  >
                    <TextInput
                      style={styles.input}
                      placeholder="Иван Иванов"
                      placeholderTextColor={COLORS.textLighter}
                      value={fullName}
                      onChangeText={(text) => handleFieldChange('fullName', text)}
                      onFocus={() => handleFocus('fullName')}
                      onBlur={() => handleBlur('fullName')}
                      editable={!loading}
                      returnKeyType="next"
                      accessibilityLabel="Поле ввода полного имени"
                      autoCapitalize="words"
                      textContentType="name"
                    />
                  </Animated.View>
                  {errors.fullName && touched.fullName && (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{errors.fullName}</Text>
                    </View>
                  )}
                </View>

                {/* Email */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Email *</Text>
                  <Animated.View
                    style={[
                      styles.inputContainer,
                      errors.email && touched.email && styles.inputError,
                      focusedField === 'email' && styles.inputFocused,
                      { height: adaptiveStyles.inputHeight }
                    ]}
                  >
                    <TextInput
                      style={styles.input}
                      placeholder="your@email.com"
                      placeholderTextColor={COLORS.textLighter}
                      value={email}
                      onChangeText={(text) => handleFieldChange('email', text)}
                      onFocus={() => handleFocus('email')}
                      onBlur={() => handleBlur('email')}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                      returnKeyType="next"
                      accessibilityLabel="Поле ввода email"
                      autoComplete="email"
                      textContentType="emailAddress"
                    />
                  </Animated.View>
                  {errors.email && touched.email && (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{errors.email}</Text>
                    </View>
                  )}
                </View>

                {/* Телефон */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Телефон (опционально)</Text>
                  <Animated.View
                    style={[
                      styles.inputContainer,
                      errors.phone && touched.phone && styles.inputError,
                      focusedField === 'phone' && styles.inputFocused,
                      { height: adaptiveStyles.inputHeight }
                    ]}
                  >
                    <TextInput
                      style={styles.input}
                      placeholder="+998 90 123 45 67"
                      placeholderTextColor={COLORS.textLighter}
                      value={phone}
                      onChangeText={(text) => handleFieldChange('phone', text)}
                      onFocus={() => handleFocus('phone')}
                      onBlur={() => handleBlur('phone')}
                      keyboardType="phone-pad"
                      editable={!loading}
                      returnKeyType="next"
                      accessibilityLabel="Поле ввода телефона"
                      textContentType="telephoneNumber"
                    />
                  </Animated.View>
                  {errors.phone && touched.phone && (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{errors.phone}</Text>
                    </View>
                  )}
                </View>

                {/* Поля для юридических лиц */}
                {role === 'legal_entity' && (
                  <>
                    <View style={styles.inputWrapper}>
                      <Text style={styles.inputLabel}>Название компании *</Text>
                      <Animated.View
                        style={[
                          styles.inputContainer,
                          errors.companyName && touched.companyName && styles.inputError,
                          focusedField === 'companyName' && styles.inputFocused,
                          { height: adaptiveStyles.inputHeight }
                        ]}
                      >
                        <TextInput
                          style={styles.input}
                          placeholder="ООО Компания"
                          placeholderTextColor={COLORS.textLighter}
                          value={companyName}
                          onChangeText={(text) => handleFieldChange('companyName', text)}
                          onFocus={() => handleFocus('companyName')}
                          onBlur={() => handleBlur('companyName')}
                          editable={!loading}
                          returnKeyType="next"
                          accessibilityLabel="Поле ввода названия компании"
                          autoCapitalize="words"
                        />
                      </Animated.View>
                      {errors.companyName && touched.companyName && (
                        <View style={styles.errorContainer}>
                          <Text style={styles.errorText}>{errors.companyName}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.inputWrapper}>
                      <Text style={styles.inputLabel}>ИНН *</Text>
                      <Animated.View
                        style={[
                          styles.inputContainer,
                          errors.taxId && touched.taxId && styles.inputError,
                          focusedField === 'taxId' && styles.inputFocused,
                          { height: adaptiveStyles.inputHeight }
                        ]}
                      >
                        <TextInput
                          style={styles.input}
                          placeholder="123456789"
                          placeholderTextColor={COLORS.textLighter}
                          value={taxId}
                          onChangeText={(text) => handleFieldChange('taxId', text)}
                          onFocus={() => handleFocus('taxId')}
                          onBlur={() => handleBlur('taxId')}
                          keyboardType="numeric"
                          editable={!loading}
                          returnKeyType="next"
                          accessibilityLabel="Поле ввода ИНН"
                          maxLength={12}
                        />
                      </Animated.View>
                      {errors.taxId && touched.taxId && (
                        <View style={styles.errorContainer}>
                          <Text style={styles.errorText}>{errors.taxId}</Text>
                        </View>
                      )}
                    </View>
                  </>
                )}

                {/* Пароль */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Пароль *</Text>
                  <Animated.View
                    style={[
                      styles.inputContainer,
                      errors.password && touched.password && styles.inputError,
                      focusedField === 'password' && styles.inputFocused,
                      { height: adaptiveStyles.inputHeight }
                    ]}
                  >
                    <TextInput
                      style={styles.input}
                      placeholder="Минимум 6 символов"
                      placeholderTextColor={COLORS.textLighter}
                      value={password}
                      onChangeText={(text) => handleFieldChange('password', text)}
                      onFocus={() => handleFocus('password')}
                      onBlur={() => handleBlur('password')}
                      secureTextEntry={!showPassword}
                      editable={!loading}
                      returnKeyType="next"
                      accessibilityLabel="Поле ввода пароля"
                      textContentType="newPassword"
                      autoComplete="password-new"
                    />
                    <TouchableOpacity
                      onPress={() => handleTogglePassword('password')}
                      style={styles.eyeIcon}
                      accessibilityLabel={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      <Ionicons
                        name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={22}
                        color={focusedField === 'password' ? COLORS.primary : COLORS.gray}
                      />
                    </TouchableOpacity>
                  </Animated.View>
                  {errors.password && touched.password && (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{errors.password}</Text>
                    </View>
                  )}
                  
                  {/* Индикатор силы пароля */}
                  {password.length > 0 && (
                    <View style={styles.passwordStrengthContainer}>
                      <View style={styles.passwordStrengthBar}>
                        {[0, 1, 2, 3, 4].map((index) => (
                          <View
                            key={index}
                            style={[
                              styles.passwordStrengthSegment,
                              index <= passwordStrength.score && {
                                backgroundColor: passwordStrength.color,
                              },
                            ]}
                          />
                        ))}
                      </View>
                      <View style={styles.passwordStrengthInfo}>
                        <Text style={[styles.passwordStrengthText, { color: passwordStrength.color }]}>
                          {passwordStrength.label}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Подтверждение пароля */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Подтвердите пароль *</Text>
                  <Animated.View
                    style={[
                      styles.inputContainer,
                      errors.confirmPassword && touched.confirmPassword && styles.inputError,
                      focusedField === 'confirmPassword' && styles.inputFocused,
                      { height: adaptiveStyles.inputHeight }
                    ]}
                  >
                    <TextInput
                      style={styles.input}
                      placeholder="Повторите пароль"
                      placeholderTextColor={COLORS.textLighter}
                      value={confirmPassword}
                      onChangeText={(text) => handleFieldChange('confirmPassword', text)}
                      onFocus={() => handleFocus('confirmPassword')}
                      onBlur={() => handleBlur('confirmPassword')}
                      secureTextEntry={!showConfirmPassword}
                      editable={!loading}
                      returnKeyType="done"
                      onSubmitEditing={handleRegister}
                      accessibilityLabel="Поле подтверждения пароля"
                      textContentType="newPassword"
                    />
                    <TouchableOpacity
                      onPress={() => handleTogglePassword('confirmPassword')}
                      style={styles.eyeIcon}
                      accessibilityLabel={showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      <Ionicons
                        name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={22}
                        color={focusedField === 'confirmPassword' ? COLORS.primary : COLORS.gray}
                      />
                    </TouchableOpacity>
                  </Animated.View>
                  {errors.confirmPassword && touched.confirmPassword && (
                    <View style={styles.errorContainer}>
                      <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                    </View>
                  )}
                </View>

                {/* Кнопка регистрации */}
                <TouchableOpacity
                  style={[
                    styles.registerButton,
                    loading && styles.registerButtonDisabled,
                    { height: adaptiveStyles.buttonHeight }
                  ]}
                  onPress={handleRegister}
                  disabled={loading}
                  accessibilityLabel="Зарегистрироваться"
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={loading ? ['#94A3B8', '#94A3B8'] : ['#3B82F6', '#2563EB', '#1D4ED8']}
                    style={[styles.registerButtonGradient, { height: adaptiveStyles.buttonHeight }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    {loading ? (
                      <ActivityIndicator color={COLORS.white} size="small" />
                    ) : (
                      <View style={styles.registerButtonContent}>
                        <Text style={styles.registerButtonText}>Создать аккаунт</Text>
                        <Ionicons name="arrow-forward" size={20} color={COLORS.white} style={styles.registerButtonIcon} />
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Ссылка на логин */}
                <View style={styles.loginContainer}>
                  <Text style={styles.loginText}>Уже есть аккаунт? </Text>
                  <TouchableOpacity 
                    onPress={handleGoToLogin} 
                    accessibilityLabel="Перейти ко входу"
                    disabled={loading}
                  >
                    <Text style={styles.loginLink}>Войти</Text>
                  </TouchableOpacity>
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
export default React.memo(RegisterScreen);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  gradientBackground: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 20,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    minHeight: SCREEN_HEIGHT - 100,
    paddingTop: 20,
  },
  formContainer: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 24,
    padding: 24,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roleContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
    padding: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
  },
  roleButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    minHeight: 80,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  roleButtonActive: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  roleButtonInner: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  roleIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
    marginBottom: 10,
  },
  roleIndicatorActive: {
    backgroundColor: COLORS.primary,
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? '-apple-system, BlinkMacSystemFont, "Segoe UI"' : 'Roboto, sans-serif',
    letterSpacing: 0.1,
  },
  roleTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  inputWrapper: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? '-apple-system, BlinkMacSystemFont, "Segoe UI"' : 'Roboto, sans-serif',
    letterSpacing: 0.1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBg,
    borderRadius: 14,
    paddingHorizontal: 18,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  inputFocused: {
    backgroundColor: COLORS.inputFocusBg,
    borderColor: COLORS.borderFocus,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  inputError: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.errorLight,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: COLORS.text,
    fontFamily: Platform.OS === 'ios' ? '-apple-system, BlinkMacSystemFont, "Segoe UI"' : 'Roboto, sans-serif',
    paddingVertical: 0,
    letterSpacing: 0.2,
  },
  eyeIcon: {
    padding: 8,
    marginLeft: 8,
  },
  errorContainer: {
    marginTop: 8,
    paddingLeft: 4,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? '-apple-system, BlinkMacSystemFont, "Segoe UI"' : 'Roboto, sans-serif',
  },
  passwordStrengthContainer: {
    marginTop: 10,
  },
  passwordStrengthBar: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 6,
  },
  passwordStrengthSegment: {
    flex: 1,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
  },
  passwordStrengthInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordStrengthText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? '-apple-system, BlinkMacSystemFont, "Segoe UI"' : 'Roboto, sans-serif',
    letterSpacing: 0.1,
  },
  registerButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  registerButtonGradient: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    width: '100%',
    flex: 1,
  },
  registerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? '-apple-system, BlinkMacSystemFont, "Segoe UI"' : 'Roboto, sans-serif',
    letterSpacing: 0.3,
  },
  registerButtonIcon: {
    marginLeft: 8,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  loginText: {
    color: COLORS.textLight,
    fontSize: 15,
    fontWeight: '400',
    fontFamily: Platform.OS === 'ios' ? '-apple-system, BlinkMacSystemFont, "Segoe UI"' : 'Roboto, sans-serif',
    letterSpacing: 0.1,
  },
  loginLink: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? '-apple-system, BlinkMacSystemFont, "Segoe UI"' : 'Roboto, sans-serif',
    letterSpacing: 0.1,
  },
});
