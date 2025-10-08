import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const API_URL = 'http://localhost:5000';

export default function RegisterScreen() {
  const router = useRouter();
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

  const handleRegister = async () => {
    if (!email || !password || !fullName) {
      Alert.alert('Ошибка', 'Пожалуйста, заполните обязательные поля');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Ошибка', 'Пароли не совпадают');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Ошибка', 'Пароль должен содержать минимум 6 символов');
      return;
    }

    if (role === 'legal_entity' && (!companyName || !taxId)) {
      Alert.alert('Ошибка', 'Для юридических лиц укажите название компании и ИНН');
      return;
    }

    setLoading(true);

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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.success) {
        // Сохранить токен
        await AsyncStorage.setItem('token', data.data.token);
        await AsyncStorage.setItem('user', JSON.stringify(data.data.user));

        Alert.alert('Успешно', 'Регистрация прошла успешно!', [
          {
            text: 'OK',
            onPress: () => router.replace('/(user)/home'),
          },
        ]);
      } else {
        Alert.alert('Ошибка', data.error || 'Не удалось зарегистрироваться');
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось подключиться к серверу');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    const googleAuthUrl = `${API_URL}/api/auth/google`;
    
    Alert.alert(
      'Google регистрация',
      'Откройте браузер для регистрации через Google',
      [
        {
          text: 'Отмена',
          style: 'cancel',
        },
        {
          text: 'Открыть',
          onPress: () => {
            console.log('Открыть:', googleAuthUrl);
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={['#667eea', '#764ba2', '#f093fb']}
        style={styles.gradient}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Ionicons name="person-add" size={50} color="#fff" />
              </View>
              <Text style={styles.title}>Регистрация</Text>
              <Text style={styles.subtitle}>Создайте новый аккаунт</Text>
            </View>

            {/* Register Form */}
            <View style={styles.formContainer}>
              {/* Role Selection */}
              <View style={styles.roleContainer}>
                <TouchableOpacity
                  style={[styles.roleButton, role === 'individual' && styles.roleButtonActive]}
                  onPress={() => setRole('individual')}
                  disabled={loading}
                >
                  <Ionicons 
                    name="person" 
                    size={24} 
                    color={role === 'individual' ? '#fff' : '#667eea'} 
                  />
                  <Text style={[styles.roleText, role === 'individual' && styles.roleTextActive]}>
                    Физическое лицо
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.roleButton, role === 'legal_entity' && styles.roleButtonActive]}
                  onPress={() => setRole('legal_entity')}
                  disabled={loading}
                >
                  <Ionicons 
                    name="briefcase" 
                    size={24} 
                    color={role === 'legal_entity' ? '#fff' : '#667eea'} 
                  />
                  <Text style={[styles.roleText, role === 'legal_entity' && styles.roleTextActive]}>
                    Юридическое лицо
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Full Name */}
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Полное имя *"
                  placeholderTextColor="#999"
                  value={fullName}
                  onChangeText={setFullName}
                  editable={!loading}
                />
              </View>

              {/* Email */}
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email *"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>

              {/* Phone */}
              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={20} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Телефон (опционально)"
                  placeholderTextColor="#999"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  editable={!loading}
                />
              </View>

              {/* Legal Entity Fields */}
              {role === 'legal_entity' && (
                <>
                  <View style={styles.inputContainer}>
                    <Ionicons name="business-outline" size={20} color="#667eea" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Название компании *"
                      placeholderTextColor="#999"
                      value={companyName}
                      onChangeText={setCompanyName}
                      editable={!loading}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Ionicons name="document-text-outline" size={20} color="#667eea" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="ИНН *"
                      placeholderTextColor="#999"
                      value={taxId}
                      onChangeText={setTaxId}
                      keyboardType="numeric"
                      editable={!loading}
                    />
                  </View>
                </>
              )}

              {/* Password */}
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Пароль *"
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#999"
                  />
                </TouchableOpacity>
              </View>

              {/* Confirm Password */}
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#667eea" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Подтвердите пароль *"
                  placeholderTextColor="#999"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeIcon}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#999"
                  />
                </TouchableOpacity>
              </View>

              {/* Register Button */}
              <TouchableOpacity
                style={[styles.registerButton, loading && styles.registerButtonDisabled]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.registerButtonText}>Зарегистрироваться</Text>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>или</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Google Register Button */}
              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleRegister}
                disabled={loading}
              >
                <Ionicons name="logo-google" size={20} color="#fff" style={styles.googleIcon} />
                <Text style={styles.googleButtonText}>Регистрация через Google</Text>
              </TouchableOpacity>

              {/* Login Link */}
              <View style={styles.loginContainer}>
                <Text style={styles.loginText}>Уже есть аккаунт? </Text>
                <TouchableOpacity onPress={() => router.push('/auth/login')}>
                  <Text style={styles.loginLink}>Войти</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
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
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  roleContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  roleButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#667eea',
    backgroundColor: '#fff',
  },
  roleButtonActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  roleText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#667eea',
    textAlign: 'center',
  },
  roleTextActive: {
    color: '#fff',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginBottom: 14,
    paddingHorizontal: 16,
    height: 52,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  eyeIcon: {
    padding: 8,
  },
  registerButton: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 17,
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
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#999',
    fontSize: 13,
  },
  googleButton: {
    backgroundColor: '#DB4437',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  googleIcon: {
    marginRight: 12,
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginText: {
    color: '#666',
    fontSize: 14,
  },
  loginLink: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
  },
});