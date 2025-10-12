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
import { useAuth } from '../context/AuthContext';

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
  warning: '#F59E0B',
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

// Утилита для проверки силы пароля
const checkPasswordStrength = (password: string): PasswordStrength => {
  let score = 0;
  
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;

  const labels = ['Очень слабый', 'Слабый', 'Средний', 'Хороший', 'Отличный'];
  const colors = [COLORS.error, '#F59E0B', '#F59E0B', COLORS.success, COLORS.success];

  return {
    score: Math.min(score, 4),
    label: labels[Math.min(score, 4)],
    color: colors[Math.min(score, 4)],
  };
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

  // Вычисление силы пароля (мемоизировано)
  const passwordStrength = useMemo(() => checkPasswordStrength(password), [password]);

  // Анимация тряски при ошибке
  const shakeAnimation = useCallback(() => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);

  // Валидация полей
  const validateField = useCallback((field: string, value: string): string | undefined => {
    switch (field) {
      case 'fullName':
        if (!value.trim()) return 'Имя обязательно';
        if (value.trim().length < 2) return 'Минимум 2 символа';
        break;
      
      case 'email':
        if (!value.trim()) return 'Email обязателен';
        if (!validateEmail(value)) return 'Введите корректный email';
        break;
      
      case 'phone':
        if (value && value.length < 9) return 'Некорректный номер';
        break;
      
      case 'password':
        if (!value) return 'Пароль обязателен';
        if (value.length < 6) return 'Минимум 6 символов';
        break;
      
      case 'confirmPassword':
        if (!value) return 'Подтвердите пароль';
        if (value !== password) return 'Пароли не совпадают';
        break;
      
      case 'companyName':
        if (role === 'legal_entity' && !value.trim()) return 'Название компании обязательно';
        break;
      
      case 'taxId':
        if (role === 'legal_entity' && !value.trim()) return 'ИНН обязателен';
        break;
    }
    return undefined;
  }, [password, role]);

  // Обработчики изменений полей с валидацией
  const handleFieldChange = useCallback((field: keyof RegisterFormData, value: string) => {
    // Обновляем значение
    switch (field) {
      case 'email': setEmail(value); break;
      case 'password': setPassword(value); break;
      case 'confirmPassword': setConfirmPassword(value); break;
      case 'fullName': setFullName(value); break;
      case 'phone': setPhone(value); break;
      case 'companyName': setCompanyName(value); break;
      case 'taxId': setTaxId(value); break;
    }

    // Валидация при изменении, если поле уже "тронуто"
    if (touched[field as keyof typeof touched]) {
      const error = validateField(field, value);
      setErrors(prev => ({ ...prev, [field]: error }));
    }
  }, [touched, validateField]);

  // Обработчик потери фокуса
  const handleBlur = useCallback((field: keyof typeof touched) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    
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
    
    const error = validateField(field, value);
    setErrors(prev => ({ ...prev, [field]: error }));
  }, [email, password, confirmPassword, fullName, phone, companyName, taxId, validateField]);

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
  }, []);

  // Обработчик регистрации
  const handleRegister = useCallback(async () => {
    // Отметить все обязательные поля как "тронутые"
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

    setLoading(true);
    console.log('📝 Попытка регистрации:', email);

    try {
      const requestBody: any = {
        email,
        password,
        full_name: fullName,
        role,
      };

      if (phone) requestBody.phone = phone;
      if (role === 'legal_entity') {
        requestBody.company_name = companyName;
        requestBody.tax_id = taxId;
      }

      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ Регистрация успешна');
        
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
        console.error('❌ Регистрация не удалась:', data.error);
        shakeAnimation();
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
        Alert.alert('Ошибка', data.error || 'Не удалось зарегистрироваться');
      }
    } catch (error) {
      console.error('❌ Ошибка регистрации:', error);
      shakeAnimation();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
      Alert.alert('Ошибка', 'Не удалось подключиться к серверу');
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
              {/* Заголовок */}
              <View style={styles.header}>
                <Text style={[styles.title, { fontSize: adaptiveStyles.titleSize }]}>Регистрация</Text>
                <Text style={[styles.subtitle, { fontSize: adaptiveStyles.subtitleSize }]}>
                  Создайте аккаунт, чтобы начать работу
                </Text>
              </View>

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
                  >
                    <Ionicons 
                      name="person" 
                      size={22} 
                      color={role === 'individual' ? COLORS.white : COLORS.primary} 
                    />
                    <Text style={[styles.roleText, role === 'individual' && styles.roleTextActive]}>
                      Физ. лицо
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.roleButton, role === 'legal_entity' && styles.roleButtonActive]}
                    onPress={() => handleRoleChange('legal_entity')}
                    disabled={loading}
                    accessibilityLabel="Юридическое лицо"
                  >
                    <Ionicons 
                      name="briefcase" 
                      size={22} 
                      color={role === 'legal_entity' ? COLORS.white : COLORS.primary} 
                    />
                    <Text style={[styles.roleText, role === 'legal_entity' && styles.roleTextActive]}>
                      Юр. лицо
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Полное имя */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Полное имя *</Text>
                  <View style={[styles.inputContainer, errors.fullName && touched.fullName && styles.inputError, { height: adaptiveStyles.inputHeight }]}>
                    <TextInput
                      style={styles.input}
                      placeholder="Иван Иванов"
                      placeholderTextColor={COLORS.gray}
                      value={fullName}
                      onChangeText={(text) => handleFieldChange('fullName', text)}
                      onBlur={() => handleBlur('fullName')}
                      editable={!loading}
                      returnKeyType="next"
                      accessibilityLabel="Поле ввода полного имени"
                    />
                  </View>
                  {errors.fullName && touched.fullName && (
                    <Text style={styles.errorText}>{errors.fullName}</Text>
                  )}
                </View>

                {/* Email */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Email *</Text>
                  <View style={[styles.inputContainer, errors.email && touched.email && styles.inputError, { height: adaptiveStyles.inputHeight }]}>
                    <TextInput
                      style={styles.input}
                      placeholder="your@email.com"
                      placeholderTextColor={COLORS.gray}
                      value={email}
                      onChangeText={(text) => handleFieldChange('email', text)}
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

                {/* Телефон */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Телефон (опционально)</Text>
                  <View style={[styles.inputContainer, errors.phone && touched.phone && styles.inputError, { height: adaptiveStyles.inputHeight }]}>
                    <TextInput
                      style={styles.input}
                      placeholder="+998 90 123 45 67"
                      placeholderTextColor={COLORS.gray}
                      value={phone}
                      onChangeText={(text) => handleFieldChange('phone', text)}
                      onBlur={() => handleBlur('phone')}
                      keyboardType="phone-pad"
                      editable={!loading}
                      returnKeyType="next"
                      accessibilityLabel="Поле ввода телефона"
                    />
                  </View>
                  {errors.phone && touched.phone && (
                    <Text style={styles.errorText}>{errors.phone}</Text>
                  )}
                </View>

                {/* Поля для юридических лиц */}
                {role === 'legal_entity' && (
                  <>
                    <View style={styles.inputWrapper}>
                      <Text style={styles.inputLabel}>Название компании *</Text>
                      <View style={[styles.inputContainer, errors.companyName && touched.companyName && styles.inputError, { height: adaptiveStyles.inputHeight }]}>
                        <TextInput
                          style={styles.input}
                          placeholder="ООО Компания"
                          placeholderTextColor={COLORS.gray}
                          value={companyName}
                          onChangeText={(text) => handleFieldChange('companyName', text)}
                          onBlur={() => handleBlur('companyName')}
                          editable={!loading}
                          returnKeyType="next"
                          accessibilityLabel="Поле ввода названия компании"
                        />
                      </View>
                      {errors.companyName && touched.companyName && (
                        <Text style={styles.errorText}>{errors.companyName}</Text>
                      )}
                    </View>

                    <View style={styles.inputWrapper}>
                      <Text style={styles.inputLabel}>ИНН *</Text>
                      <View style={[styles.inputContainer, errors.taxId && touched.taxId && styles.inputError, { height: adaptiveStyles.inputHeight }]}>
                        <TextInput
                          style={styles.input}
                          placeholder="123456789"
                          placeholderTextColor={COLORS.gray}
                          value={taxId}
                          onChangeText={(text) => handleFieldChange('taxId', text)}
                          onBlur={() => handleBlur('taxId')}
                          keyboardType="numeric"
                          editable={!loading}
                          returnKeyType="next"
                          accessibilityLabel="Поле ввода ИНН"
                        />
                      </View>
                      {errors.taxId && touched.taxId && (
                        <Text style={styles.errorText}>{errors.taxId}</Text>
                      )}
                    </View>
                  </>
                )}

                {/* Пароль */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Пароль *</Text>
                  <View style={[styles.inputContainer, errors.password && touched.password && styles.inputError, { height: adaptiveStyles.inputHeight }]}>
                    <TextInput
                      style={styles.input}
                      placeholder="Минимум 6 символов"
                      placeholderTextColor={COLORS.gray}
                      value={password}
                      onChangeText={(text) => handleFieldChange('password', text)}
                      onBlur={() => handleBlur('password')}
                      secureTextEntry={!showPassword}
                      editable={!loading}
                      returnKeyType="next"
                      accessibilityLabel="Поле ввода пароля"
                    />
                    <TouchableOpacity
                      onPress={() => handleTogglePassword('password')}
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
                      <Text style={[styles.passwordStrengthText, { color: passwordStrength.color }]}>
                        {passwordStrength.label}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Подтверждение пароля */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Подтвердите пароль *</Text>
                  <View style={[styles.inputContainer, errors.confirmPassword && touched.confirmPassword && styles.inputError, { height: adaptiveStyles.inputHeight }]}>
                    <TextInput
                      style={styles.input}
                      placeholder="Повторите пароль"
                      placeholderTextColor={COLORS.gray}
                      value={confirmPassword}
                      onChangeText={(text) => handleFieldChange('confirmPassword', text)}
                      onBlur={() => handleBlur('confirmPassword')}
                      secureTextEntry={!showConfirmPassword}
                      editable={!loading}
                      returnKeyType="done"
                      onSubmitEditing={handleRegister}
                      accessibilityLabel="Поле подтверждения пароля"
                    />
                    <TouchableOpacity
                      onPress={() => handleTogglePassword('confirmPassword')}
                      style={styles.eyeIcon}
                      accessibilityLabel={showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      <Ionicons
                        name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                        size={20}
                        color={COLORS.gray}
                      />
                    </TouchableOpacity>
                  </View>
                  {errors.confirmPassword && touched.confirmPassword && (
                    <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                  )}
                </View>

                {/* Кнопка регистрации */}
                <TouchableOpacity
                  style={[styles.registerButton, loading && styles.registerButtonDisabled, { height: adaptiveStyles.buttonHeight }]}
                  onPress={handleRegister}
                  disabled={loading}
                  accessibilityLabel="Зарегистрироваться"
                >
                  {loading ? (
                    <ActivityIndicator color={COLORS.white} size="small" />
                  ) : (
                    <Text style={styles.registerButtonText}>Создать аккаунт</Text>
                  )}
                </TouchableOpacity>

                {/* Ссылка на логин */}
                <View style={styles.loginContainer}>
                  <Text style={styles.loginText}>Уже есть аккаунт? </Text>
                  <TouchableOpacity onPress={handleGoToLogin} accessibilityLabel="Перейти ко входу">
                    <Text style={styles.loginLink}>Войти</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </Animated.View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
    marginBottom: 32,
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
  roleContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 10,
  },
  roleButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  roleButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    textAlign: 'center',
  },
  roleTextActive: {
    color: COLORS.white,
  },
  inputWrapper: {
    marginBottom: 18,
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
  passwordStrengthContainer: {
    marginTop: 8,
  },
  passwordStrengthBar: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 6,
  },
  passwordStrengthSegment: {
    flex: 1,
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
  },
  passwordStrengthText: {
    fontSize: 12,
    fontWeight: '500',
  },
  registerButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginText: {
    color: COLORS.textLight,
    fontSize: 15,
  },
  loginLink: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '600',
  },
});
