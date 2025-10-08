import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';


export default function CallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // Получить токен из URL параметров
      const token = params.token as string;
      const userStr = params.user as string;

      if (!token || !userStr) {
        setError('Ошибка авторизации: отсутствуют данные');
        setTimeout(() => router.replace('/auth/login'), 2000);
        return;
      }

      // Декодировать данные пользователя
      const user = JSON.parse(decodeURIComponent(userStr));

      // Сохранить токен и данные пользователя
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));

      // Перенаправить в зависимости от роли
      if (user.role === 'admin') {
        router.replace('/(admin)/dashboard');
      } else {
        router.replace('/(user)/home');
      }
    } catch (err) {
      console.error('Callback error:', err);
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