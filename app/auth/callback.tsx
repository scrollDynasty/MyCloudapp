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
        
        // Если это popup окно, отправляем сообщение родителю
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.opener) {
          window.opener.postMessage({
            type: 'GOOGLE_AUTH_ERROR',
            error: params.error
          }, window.location.origin);
          window.close();
        } else {
          setError('Ошибка авторизации через Google');
          setTimeout(() => router.replace('/auth/login'), 2000);
        }
        return;
      }
      
      // Получить токен из URL параметров
      const token = params.token as string;
      const userStr = params.user as string;

      if (!token || !userStr) {
        console.error('❌ Missing token or user data');
        
        // Если это popup окно, отправляем сообщение родителю
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.opener) {
          window.opener.postMessage({
            type: 'GOOGLE_AUTH_ERROR',
            error: 'Missing token or user data'
          }, window.location.origin);
          window.close();
        } else {
          setError('Ошибка авторизации: отсутствуют данные');
          setTimeout(() => router.replace('/auth/login'), 2000);
        }
        return;
      }

      // Декодировать данные пользователя
      const user = JSON.parse(decodeURIComponent(userStr));
      console.log('✅ User data received:', user);

      // Если это popup окно (открыто из другого окна)
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.opener) {
        console.log('📤 Sending auth data to parent window');
        
        // Отправляем данные родительскому окну
        window.opener.postMessage({
          type: 'GOOGLE_AUTH_SUCCESS',
          token,
          user
        }, window.location.origin);
        
        // Закрываем popup
        window.close();
      } else {
        // Обычный callback для мобильных приложений
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
      }
    } catch (err) {
      console.error('❌ Callback error:', err);
      
      // Если это popup окно, отправляем сообщение родителю
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.opener) {
        window.opener.postMessage({
          type: 'GOOGLE_AUTH_ERROR',
          error: 'Failed to process auth data'
        }, window.location.origin);
        window.close();
      } else {
        setError('Ошибка при обработке данных авторизации');
        setTimeout(() => router.replace('/auth/login'), 2000);
      }
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