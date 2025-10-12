import { Ionicons } from '@expo/vector-icons';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { API_URL } from '../../config/api';
import { getHeaders } from '../../config/fetch';
import { useAuth } from '../context/AuthContext';

// Завершать браузер после успешной авторизации
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Ошибка', 'Пожалуйста, заполните все поля');
      return;
    }

    setLoading(true);
    console.log('🔑 Attempting login with:', email);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      console.log('📦 Login response:', data);

      if (data.success) {
        console.log('✅ Login successful, user:', data.data.user);
        
        // Используем signIn из AuthContext
        await signIn(data.data.token, data.data.user);
        console.log('✅ SignIn completed');

        // Перенаправить в зависимости от роли
        if (data.data.user.role === 'admin') {
          console.log('🔄 Redirecting to admin dashboard');
          router.replace('/(admin)/dashboard');
        } else {
          console.log('🔄 Redirecting to user home');
          router.replace('/(user)/home');
        }
      } else {
        console.error('❌ Login failed:', data.error);
        Alert.alert('Ошибка', data.error || 'Неверный email или пароль');
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      Alert.alert('Ошибка', 'Не удалось подключиться к серверу');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      
      // Проверяем платформу
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        // Для веб используем popup окно
        console.log('🔑 Starting Google OAuth in popup');
        
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
          `client_id=${encodeURIComponent('735617581412-e8ceb269bj7qqrv9sl066q63g5dr5sne.apps.googleusercontent.com')}&` +
          `redirect_uri=${encodeURIComponent(`${API_URL}/api/auth/google/callback`)}&` +
          `response_type=code&` +
          `scope=${encodeURIComponent('openid profile email')}&` +
          `access_type=offline&` +
          `prompt=select_account&` +
          `state=${encodeURIComponent(`${window.location.origin}/auth/callback`)}`;
        
        // Открываем popup окно
        const width = 500;
        const height = 600;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        const popup = window.open(
          authUrl,
          'Google OAuth',
          `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
        );
        
        if (!popup) {
          Alert.alert('Ошибка', 'Не удалось открыть окно авторизации. Проверьте настройки блокировки всплывающих окон.');
          setLoading(false);
          return;
        }
        
        // Слушаем сообщения от popup окна
        const handleMessage = async (event: MessageEvent) => {
          // Проверяем origin для безопасности
          if (event.origin !== window.location.origin) {
            return;
          }
          
          if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
            console.log('✅ Google login successful:', event.data);
            
            const { token, user } = event.data;
            
            await signIn(token, user);
            
            if (user.role === 'admin') {
              router.replace('/(admin)/dashboard');
            } else {
              router.replace('/(user)/home');
            }
            
            window.removeEventListener('message', handleMessage);
            setLoading(false);
          } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
            console.error('❌ Google auth error:', event.data.error);
            Alert.alert('Ошибка', 'Ошибка авторизации через Google');
            window.removeEventListener('message', handleMessage);
            setLoading(false);
          }
        };
        
        window.addEventListener('message', handleMessage);
        
        // Проверяем, закрыто ли popup окно
        const checkPopupClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkPopupClosed);
            window.removeEventListener('message', handleMessage);
            setLoading(false);
          }
        }, 500);
        
      } else {
        // Для мобильных используем стандартный способ
        const redirectUri = AuthSession.makeRedirectUri({
          scheme: 'mycloud',
          path: 'auth/callback'
        });
        
        console.log('🔑 Starting Google OAuth with redirect:', redirectUri);
        
        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
          `client_id=${encodeURIComponent('735617581412-e8ceb269bj7qqrv9sl066q63g5dr5sne.apps.googleusercontent.com')}&` +
          `redirect_uri=${encodeURIComponent(`${API_URL}/api/auth/google/callback`)}&` +
          `response_type=code&` +
          `scope=${encodeURIComponent('openid profile email')}&` +
          `access_type=offline&` +
          `prompt=select_account&` +
          `state=${encodeURIComponent(redirectUri)}`;
        
        console.log('🌐 Opening Google auth URL');
        
        const result = await WebBrowser.openAuthSessionAsync(
          authUrl,
          redirectUri
        );
        
        console.log('📦 Auth result:', result);
        
        if (result.type === 'success') {
          const url = result.url;
          console.log('✅ Success URL:', url);
          
          if (url.includes('token=')) {
            const tokenMatch = url.match(/token=([^&]+)/);
            const userMatch = url.match(/user=([^&]+)/);
            
            if (tokenMatch && userMatch) {
              const token = tokenMatch[1];
              const userStr = decodeURIComponent(userMatch[1]);
              const user = JSON.parse(userStr);
              
              console.log('✅ Google login successful, user:', user);
              
              await signIn(token, user);
              
              if (user.role === 'admin') {
                router.replace('/(admin)/dashboard');
              } else {
                router.replace('/(user)/home');
              }
            }
          }
        } else if (result.type === 'cancel') {
          console.log('❌ User cancelled Google login');
          Alert.alert('Отменено', 'Вход через Google был отменен');
        }
        
        setLoading(false);
      }
    } catch (error) {
      console.error('❌ Google login error:', error);
      Alert.alert(
        'Ошибка',
        'Произошла ошибка при входе через Google. Попробуйте позже.'
      );
      setLoading(false);
    }
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
        <View style={styles.content}>
          {/* Logo/Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="cloud" size={60} color="#fff" />
            </View>
            <Text style={styles.title}>VPS Billing</Text>
            <Text style={styles.subtitle}>Войдите в свой аккаунт</Text>
          </View>

          {/* Login Form */}
          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#667eea" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#667eea" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Пароль"
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

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>Войти</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>или</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Login Button */}
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleLogin}
              disabled={loading}
            >
              <Ionicons name="logo-google" size={20} color="#fff" style={styles.googleIcon} />
              <Text style={styles.googleButtonText}>Войти через Google</Text>
            </TouchableOpacity>

            {/* Register Link */}
            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Нет аккаунта? </Text>
              <TouchableOpacity onPress={() => router.push('/auth/register')}>
                <Text style={styles.registerLink}>Зарегистрироваться</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Test Credentials */}
          <View style={styles.testCredentials}>
            <Text style={styles.testTitle}>Тестовые данные:</Text>
            <Text style={styles.testText}>Админ: admin@vps-billing.com / admin123</Text>
            <Text style={styles.testText}>Пользователь: john@individual.com / user123</Text>
          </View>
        </View>
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
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  eyeIcon: {
    padding: 8,
  },
  loginButton: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#999',
    fontSize: 14,
  },
  googleButton: {
    backgroundColor: '#DB4437',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  googleIcon: {
    marginRight: 12,
  },
  googleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  registerText: {
    color: '#666',
    fontSize: 14,
  },
  registerLink: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '600',
  },
  testCredentials: {
    marginTop: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
  },
  testTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667eea',
    marginBottom: 8,
  },
  testText: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
});