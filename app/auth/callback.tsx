import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';


export default function CallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      console.log('🔄 Callback params:', params);
      
      // Проверить на ошибку
      if (params.error) {
        console.error('❌ Auth error from server:', params.error);
        setError('Ошибка авторизации через Google');
        setTimeout(() => router.replace('/auth/login'), 2000);
        return;
      }
      
      // Получить токен из URL параметров
      const token = params.token as string;
      let userStr = params.user as string;

      if (!token || !userStr) {
        console.error('❌ Missing token or user data');
        setError('Ошибка авторизации: отсутствуют данные');
        setTimeout(() => router.replace('/auth/login'), 2000);
        return;
      }

      // Декодировать данные пользователя и убрать символ #
      userStr = decodeURIComponent(userStr);
      // Удаляем все после символа # (hash fragment)
      userStr = userStr.replace(/#.*$/, '');
      
      const user = JSON.parse(userStr);
      console.log('✅ User data received:', user);

      // Использовать signIn из AuthContext
      await signIn(token, user);
      console.log('✅ SignIn completed via Google OAuth');

      // Перенаправить в зависимости от роли
      if (user.role === 'admin') {
        console.log('🔄 Redirecting to admin dashboard');
        router.replace('/(admin)/dashboard');
      } else {
        console.log('🔄 Redirecting to user home');
        router.replace('/(user)/home');
      }
    } catch (err) {
      console.error('❌ Callback error:', err);
      setError('Ошибка при обработке данных авторизации');
      setTimeout(() => router.replace('/auth/login'), 2000);
    }
  };

  return (
    <View style={styles.container}>
      {error ? (
        <>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.subText}>Перенаправление на страницу входа...</Text>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Авторизация...</Text>
          <Text style={styles.subText}>Пожалуйста, подождите</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  subText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 8,
  },
});