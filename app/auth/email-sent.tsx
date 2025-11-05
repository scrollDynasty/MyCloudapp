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

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallScreen = SCREEN_WIDTH < 375;

export default function EmailSentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = params.email as string;

  const [resendCooldown, setResendCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  
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
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendCooldown]);

  const handleResend = () => {
    setCanResend(false);
    setResendCooldown(60);
    console.log('Resending email to:', email);
    // TODO: Implement resend API call
  };

  const handleBackToLogin = () => {
    router.replace('/auth/login');
  };

  return (
    <View style={styles.container}>
      <View style={styles.overlay}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
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
              <Text style={styles.headerTitle}>Проверьте почту</Text>
            </View>

            {/* Info Banner */}
            <View style={styles.infoBanner}>
              <View style={styles.infoIcon}>
                <Ionicons name="mail" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.infoText}>Письмо отправлено на {email}</Text>
            </View>

            {/* Main Info Card */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.iconBox}>
                  <Ionicons name="mail-open-outline" size={18} color="#374151" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoTitle}>Подтвердите email</Text>
                  <Text style={styles.infoDescription}>
                    Мы отправили письмо с ссылкой для подтверждения. Проверьте входящие или папку "Спам".
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Steps */}
              <View style={styles.stepsContainer}>
                <View style={styles.stepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>1</Text>
                  </View>
                  <Text style={styles.stepText}>Откройте ваш почтовый ящик</Text>
                </View>
                <View style={styles.stepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>2</Text>
                  </View>
                  <Text style={styles.stepText}>Найдите письмо от MyCloud</Text>
                </View>
                <View style={styles.stepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>3</Text>
                  </View>
                  <Text style={styles.stepText}>Нажмите на кнопку подтверждения</Text>
                </View>
              </View>
            </View>

            {/* Expiry Notice */}
            <View style={styles.warningBanner}>
              <Ionicons name="time-outline" size={16} color="#F59E0B" />
              <Text style={styles.warningText}>
                Ссылка действительна в течение 10 минут
              </Text>
            </View>

            {/* Resend Button */}
            <TouchableOpacity
              style={[styles.resendButton, !canResend && styles.buttonDisabled]}
              onPress={handleResend}
              disabled={!canResend}
            >
              {canResend ? (
                <>
                  <Ionicons name="refresh" size={16} color="#6366F1" />
                  <Text style={styles.resendButtonText}>Отправить повторно</Text>
                </>
              ) : (
                <>
                  <ActivityIndicator size="small" color="#9CA3AF" />
                  <Text style={styles.resendButtonTextDisabled}>
                    Повтор через {resendCooldown}с
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Back to Login */}
            <TouchableOpacity style={styles.backButton} onPress={handleBackToLogin}>
              <Ionicons name="arrow-back" size={16} color="#6366F1" />
              <Text style={styles.backButtonText}>Вернуться к входу</Text>
            </TouchableOpacity>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Не получили письмо? Проверьте папку "Спам" или запросите повторную отправку.
              </Text>
            </View>
          </Animated.View>
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#6366F1',
    borderRadius: 24,
    paddingVertical: 13,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 17,
  },
  infoCard: {
    gap: 12,
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
  },
  stepsContainer: {
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '400',
    color: '#374151',
    lineHeight: 16,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 24,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: '#92400E',
    lineHeight: 15,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  buttonDisabled: {
    opacity: 0.5,
    borderColor: '#E5E7EB',
  },
  resendButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366F1',
  },
  resendButtonTextDisabled: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6366F1',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 15,
    textAlign: 'center',
    paddingTop: 8,
  },
});
