import * as Linking from 'expo-linking';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AuthProvider } from '../lib/AuthContext';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const processedUrls = useRef<Set<string>>(new Set());
  const isInitialized = useRef(false);

  // Мемоизированный обработчик deep links
  const handleDeepLink = useCallback((url: string) => {
    if (!url) return;

    // Игнорируем обычные навигационные URL (localhost, обычные пути)
    if (url.includes('localhost:8081') && !url.includes('payment-success') && !url.includes('payment-cancel')) {
      return;
    }

    // Проверяем, не обрабатывали ли мы уже этот URL
    if (processedUrls.current.has(url)) {
      return;
    }

    // Парсим URL
    const { hostname, path, queryParams } = Linking.parse(url);
    
    // Проверяем, что это действительно deep link для платежей или верификации email
    const isPaymentSuccess = path === 'payment-success' || hostname === 'payment-success' || url.includes('payment-success');
    const isPaymentCancel = path === 'payment-cancel' || hostname === 'payment-cancel' || url.includes('payment-cancel');
    const isVerifyEmail = path === 'verify-email' || hostname === 'verify-email' || url.includes('verify-email');

    if (!isPaymentSuccess && !isPaymentCancel && !isVerifyEmail) {
      return; // Игнорируем все остальные URL
    }

    // Помечаем URL как обработанный
    processedUrls.current.add(url);

    // Обработка verify-email
    if (isVerifyEmail && queryParams?.token) {
      router.replace({
        pathname: '/auth/verify-email',
        params: { token: queryParams.token as string }
      });
      return;
    }

    // Обработка payment-success
    if (isPaymentSuccess) {
      const orderId = queryParams?.order_id as string;
      console.log('✅ Payment success, order:', orderId);
      
      if (orderId) {
        router.replace(`/(user)/payment-success?order_id=${orderId}`);
      } else {
        router.replace('/(user)/orders');
      }
    }
    // Обработка payment-cancel
    else if (isPaymentCancel) {
      const orderId = queryParams?.order_id as string;
      console.log('❌ Payment cancelled, order:', orderId);
      
      if (orderId) {
        router.replace(`/(user)/checkout?orderId=${orderId}`);
      } else {
        router.replace('/(user)/home');
      }
    }
  }, [router]);

  // Обработчик deep links для возврата из Payme
  useEffect(() => {
    // Проверяем начальный URL при запуске только один раз
    if (!isInitialized.current) {
      isInitialized.current = true;
      
      Linking.getInitialURL().then((url) => {
        if (url) {
          handleDeepLink(url);
        }
      });
    }

    // Слушаем URL изменения только для внешних deep links
    const subscription = Linking.addEventListener('url', ({ url }) => {
      // Игнорируем обычные навигационные URL
      if (url && (url.includes('payment-success') || url.includes('payment-cancel'))) {
        handleDeepLink(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [handleDeepLink]);
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
