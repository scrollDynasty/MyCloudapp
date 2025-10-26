import * as Linking from 'expo-linking';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { AuthProvider } from '../lib/AuthContext';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  // Обработчик deep links для возврата из Payme
  useEffect(() => {
    // Слушаем URL изменения
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('🔗 Deep link received:', url);
      handleDeepLink(url);
    });

    // Проверяем начальный URL при запуске
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('🔗 Initial URL:', url);
        handleDeepLink(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleDeepLink = (url: string) => {
    if (!url) return;

    // Парсим URL
    const { hostname, path, queryParams } = Linking.parse(url);
    
    console.log('📍 Parsed URL:', { hostname, path, queryParams });

    // Обработка payment-success
    if (path === 'payment-success' || hostname === 'payment-success') {
      const orderId = queryParams?.order_id as string;
      console.log('✅ Payment success, order:', orderId);
      
      if (orderId) {
        router.replace(`/(user)/payment-success?order_id=${orderId}`);
      } else {
        router.replace('/(user)/orders');
      }
    }
    // Обработка payment-cancel
    else if (path === 'payment-cancel' || hostname === 'payment-cancel') {
      const orderId = queryParams?.order_id as string;
      console.log('❌ Payment cancelled, order:', orderId);
      
      if (orderId) {
        router.replace(`/(user)/checkout?orderId=${orderId}`);
      } else {
        router.replace('/(user)/home');
      }
    }
  };
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen 
          name="auth/login" 
          options={{ 
            gestureEnabled: false,
            animation: 'fade'
          }} 
        />
        <Stack.Screen 
          name="auth/register" 
          options={{ 
            gestureEnabled: false,
            animation: 'fade'
          }} 
        />
        <Stack.Screen 
          name="auth/forgot-password" 
          options={{ 
            gestureEnabled: false,
            animation: 'fade'
          }} 
        />
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="(user)" />
        <Stack.Screen name="(admin)" />
      </Stack>
    </AuthProvider>
  );
}
