import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { API_URL } from '../../config/api';
import { getHeaders } from '../../config/fetch';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 375;

type VerificationState = 'verifying' | 'success' | 'error' | 'expired';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const token = params.token as string;

  const [state, setState] = useState<VerificationState>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const [userName, setUserName] = useState('');
  const [redirectCountdown, setRedirectCountdown] = useState(10);

  // Анимации
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.95);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (token) {
      verifyEmail(token);
    } else {
      setState('error');
      setErrorMessage('Токен подтверждения не найден');
    }
  }, [token]);

  useEffect(() => {
    if (state === 'success' && redirectCountdown > 0) {
      const timer = setTimeout(() => {
        setRedirectCountdown(redirectCountdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (state === 'success' && redirectCountdown === 0) {
      router.replace('/auth/login');
    }
  }, [state, redirectCountdown, router]);

  const verifyEmail = async (verificationToken: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/verify-email/confirm`, {
        method: 'POST',
        headers: {
          ...getHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: verificationToken }),
      });

      const data = await response.json();

      if (data.success) {
        setState('success');
        setUserName(data.name || '');
      } else {
        if (data.error?.includes('истёк') || data.error?.includes('недействителен')) {
          setState('expired');
          setErrorMessage(data.error);
        } else {
          setState('error');
          setErrorMessage(data.error || 'Не удалось подтвердить email');
        }
      }
    } catch (error) {
      console.error('Verification error:', error);
      setState('error');
      setErrorMessage('Ошибка сети. Проверьте подключение.');
    }
  };

  const handleGoToLogin = () => {
    router.replace('/auth/login');
  };

  const renderContent = () => {
    switch (state) {
      case 'verifying':
        return (
          <View style={styles.verifyingContainer}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.verifyingText}>Подтверждение email...</Text>
          </View>
        );

      case 'success':
        return (
          <Animated.View
            style={[
              styles.card,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Email подтверждён</Text>
            </View>

            {/* Success Banner */}
            <View style={styles.successBanner}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.successText}>Вы успешно подтвердили адрес</Text>
            </View>

            {/* Main Info Card */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.iconBox}>
                  <Ionicons name="mail" size={18} color="#374151" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoTitle}>Почта подтверждена</Text>
                  <Text style={styles.infoDescription}>
                    Спасибо! Ссылка из письма сработала, и ваш аккаунт активирован.
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.noteRow}>
                <Ionicons name="information-circle-outline" size={16} color="#9CA3AF" />
                <Text style={styles.noteText}>
                  Без ввода почты — всё сделано автоматически.
                </Text>
              </View>
            </View>

            {/* Redirect Notice */}
            <View style={styles.redirectBanner}>
              <Ionicons name="time-outline" size={16} color="#374151" />
              <Text style={styles.redirectText}>
                Сейчас вы будете автоматически перенаправлены на экран входа…
              </Text>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Если перенаправление не началось, вернитесь в приложение и выполните вход.
              </Text>
            </View>
          </Animated.View>
        );

      case 'expired':
        return (
          <Animated.View
            style={[
              styles.card,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Ссылка истекла</Text>
            </View>

            <View style={styles.errorBanner}>
              <View style={styles.errorIcon}>
                <Ionicons name="time-outline" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.errorText}>Срок действия ссылки истёк</Text>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.iconBox}>
                  <Ionicons name="alert-circle-outline" size={18} color="#374151" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoTitle}>Ссылка устарела</Text>
                  <Text style={styles.infoDescription}>
                    Срок действия ссылки для подтверждения истёк. Ссылки действительны только 10 минут по соображениям безопасности.
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.noteRow}>
                <Ionicons name="information-circle-outline" size={16} color="#9CA3AF" />
                <Text style={styles.noteText}>
                  Запросите новую ссылку для подтверждения из приложения.
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.actionButton} onPress={handleGoToLogin}>
              <Text style={styles.actionButtonText}>Вернуться к входу</Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Войдите в приложение и запросите новую ссылку для подтверждения email.
              </Text>
            </View>
          </Animated.View>
        );

      case 'error':
      default:
        return (
          <Animated.View
            style={[
              styles.card,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Ошибка подтверждения</Text>
            </View>

            <View style={styles.errorBanner}>
              <View style={styles.errorIcon}>
                <Ionicons name="close" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.errorText}>Не удалось подтвердить email</Text>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.iconBox}>
                  <Ionicons name="warning-outline" size={18} color="#374151" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoTitle}>Что-то пошло не так</Text>
                  <Text style={styles.infoDescription}>{errorMessage}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.noteRow}>
                <Ionicons name="information-circle-outline" size={16} color="#9CA3AF" />
                <Text style={styles.noteText}>
                  Попробуйте запросить новую ссылку или обратитесь в поддержку.
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.actionButton} onPress={handleGoToLogin}>
              <Text style={styles.actionButtonText}>Вернуться к входу</Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Если проблема повторяется, свяжитесь с нами: support@mycloud.uz
              </Text>
            </View>
          </Animated.View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.overlay}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderContent()}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: isSmallScreen ? 16 : 24,
  },
  verifyingContainer: {
    alignItems: 'center',
    gap: 16,
  },
  verifyingText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  card: {
    width: '100%',
    maxWidth: 392,
    backgroundColor: '#FFFFFF',
    borderRadius: 48,
    padding: 21,
    gap: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 40,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 22,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#10B981',
    borderRadius: 24,
    paddingVertical: 13,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  successIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 17,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#EF4444',
    borderRadius: 24,
    paddingVertical: 13,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  errorIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 17,
  },
  infoCard: {
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 13,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoTextContainer: {
    flex: 1,
    gap: 6,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    lineHeight: 17,
  },
  infoDescription: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 15,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 16,
  },
  redirectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  redirectText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    lineHeight: 15,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 15,
    textAlign: 'center',
  },
  actionButton: {
    backgroundColor: '#6366F1',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
