import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { API_URL } from '../../config/api';
import { getHeaders } from '../../config/fetch';

interface PlanField {
  id: number;
  plan_id: number;
  field_key: string;
  field_label_uz: string;
  field_label_ru: string;
  field_value_uz: string;
  field_value_ru: string;
  field_type: string;
  display_order: number;
}

interface OrderDetails {
  order_id: number;
  order_type: 'vps' | 'service';
  plan_name: string;
  provider_name?: string;
  group_name?: string;
  billing_period?: string;
  cpu_cores?: number;
  memory_gb?: number;
  storage_gb?: number;
  bandwidth_tb?: number;
  fields?: PlanField[];
  amount: number;
  currency: string;
  full_name: string;
  email: string;
  order_number?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderIdParam = (params.orderId || params.order_id) as string | undefined;
  const orderId = orderIdParam ?? '';

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const isSmallScreen = SCREEN_WIDTH < 375;
  const isMediumScreen = SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 768;

  const adaptive = useMemo(() => {
    return {
      cardPadding: isSmallScreen ? 18 : 24,
      cardRadius: isSmallScreen ? 20 : 28,
      contentPadding: isSmallScreen ? 14 : 20,
    } as const;
  }, [isSmallScreen]);

  useEffect(() => {
    if (orderId) {
      loadOrderDetails();
    }
  }, [orderId]);

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 450,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [loading, fadeAnim]);

  const loadOrderDetails = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/orders/${orderId}`, {
        headers: getHeaders(token || undefined),
      });

      const data = await response.json();
      if (data.success) {
        setOrder(data.data);
      }
    } catch (error) {
      console.error('Error loading order:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayWithPayme = async () => {
    try {
      setProcessing(true);
      const token = await AsyncStorage.getItem('token');

      if (!token) {
        Alert.alert('Ошибка', 'Токен авторизации не найден. Пожалуйста, войдите заново.');
        return;
      }

      const paymentUrl = `${API_URL}/api/payments/payme`;
      const returnUrl = `${API_URL}/payment-success?order_id=${orderId}`;

      const response = await fetch(paymentUrl, {
        method: 'POST',
        headers: getHeaders(token),
        body: JSON.stringify({
          order_id: orderId,
          return_url: returnUrl,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (data.success && data.data?.checkout_url) {
        if (Platform.OS === 'web') {
          const paymentWindow = window.open(data.data.checkout_url, '_blank');

          if (!paymentWindow) {
            let message = 'Разрешите всплывающие окна или используйте одну из этих ссылок:\n\n';
            message += '1. Основная ссылка:\n' + data.data.checkout_url + '\n\n';

            if (data.data.alternative_urls) {
              message += '2. Альтернативная (ac.account):\n' + data.data.alternative_urls.account + '\n\n';
              message += '3. Альтернативная (ac.id):\n' + data.data.alternative_urls.id + '\n\n';
            }

            Alert.alert('⚠️ Всплывающее окно заблокировано', message);
          }
        } else {
          const canOpen = await Linking.canOpenURL(data.data.checkout_url);
          if (canOpen) {
            await Linking.openURL(data.data.checkout_url);
          } else {
            Alert.alert('Ошибка', 'Не удалось открыть страницу оплаты');
          }
        }
      } else {
        let errorMessage = 'Неизвестная ошибка при создании платежа';

        if (data.error) {
          if (typeof data.error === 'string') {
            errorMessage = data.error;
          } else if (data.error.message) {
            errorMessage = data.error.message;
          } else if (typeof data.error === 'object') {
            errorMessage = JSON.stringify(data.error, null, 2);
          }
        }

        if (data.message) {
          errorMessage += '\n\nДетали: ' + data.message;
        }

        errorMessage += '• Merchant ID не активирован в системе Payme\n';
        errorMessage += '• Account поля не настроены в личном кабинете\n';
        errorMessage += '• Неверная конфигурация кассы\n';
        errorMessage += '• Проверьте логи сервера для деталей';

        if (data.data?.debug?.note) {
          errorMessage += '\n\n⚠️ ' + data.data.debug.note;
        }

        Alert.alert('Ошибка оплаты Payme', errorMessage);
      }
    } catch (error: any) {
      const errorMsg = error?.message || 'Не удалось инициировать оплату';
      Alert.alert('Ошибка', errorMsg);
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(user)/(tabs)/home');
    }
  };

  const formatAmount = useMemo(() => {
    return (amount: number, currency: string) => {
      if (!amount) {
        return '0 сум';
      }

      const normalizedCurrency = (currency || 'UZS').toUpperCase();

      if (normalizedCurrency === 'USD') {
        return `$${amount.toFixed(2)}`;
      }

      try {
        return `${new Intl.NumberFormat('ru-RU').format(amount)} сум`;
      } catch (error) {
        return `${amount.toLocaleString('ru-RU')} сум`;
      }
    };
  }, []);

  const infoRows = useMemo(() => {
    if (!order) {
      return [];
    }

    const rows = [
      { label: 'Клиент', value: order.full_name },
      { label: 'Email', value: order.email },
      { label: 'Тариф', value: order.plan_name },
    ];

    if (order.order_type === 'service') {
      rows.push({ label: 'Сервис', value: order.group_name || '—' });
    } else {
      rows.push({ label: 'Провайдер', value: order.provider_name || '—' });
    }

    return rows.filter(row => row.value);
  }, [order]);

  const paymentLabel = order ? formatAmount(order.amount, order.currency) : '';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Загрузка деталей заказа...</Text>
      </View>
    );
  }

  if (!order) {
     return (
       <View style={styles.errorContainer}>
         <Ionicons name="alert-circle" size={64} color="#f87171" />
         <Text style={styles.errorTitle}>Заказ не найден</Text>
         <Text style={styles.errorSubtitle}>Возможно, ссылка устарела или заказ был удалён.</Text>
         <TouchableOpacity style={styles.errorButton} onPress={handleCancel}>
           <Text style={styles.errorButtonText}>Вернуться назад</Text>
         </TouchableOpacity>
       </View>
     );
   }
 
  return (
    <SafeAreaView style={styles.pageSafeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.pageContainer}>
        <View style={styles.pageHeader}>
          <View style={styles.headerContent}>
            <TouchableOpacity style={styles.headerBackButton} onPress={handleCancel} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={20} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.pageTitle}>Оплата заказа</Text>
            <View style={styles.headerRight}>
              <View style={styles.headerBadge}>
                <Ionicons name="shield-checkmark" size={14} color="#4F46E5" />
                <Text style={styles.headerBadgeText}>Безопасно</Text>
              </View>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.pageScroll}
          contentContainerStyle={[
            styles.pageContent,
            {
              paddingHorizontal: adaptive.contentPadding,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles.pageCard,
              {
                opacity: fadeAnim,
                padding: adaptive.cardPadding,
                borderRadius: adaptive.cardRadius,
              },
            ]}
          >
            <View style={styles.sectionCard}>
              <View style={styles.sectionIcon}>
                <Ionicons name="document-text-outline" size={18} color="#374151" />
              </View>
              <View style={styles.sectionTextContainer}>
                <Text style={styles.sectionTitle}>Детали заказа</Text>
                <Text style={styles.sectionSubtitle}>Проверьте данные перед оплатой.</Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              {infoRows.map((row, index) => (
                <View
                  key={row.label}
                  style={[styles.infoRow, index !== infoRows.length - 1 && styles.infoRowDivider]}
                >
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={styles.infoValue}>{row.value}</Text>
                </View>
              ))}
            </View>

            {order.order_number && (
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Заказ</Text>
                  <Text style={styles.summaryValue}>#{order.order_number}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryTotalLabel}>Итого к оплате</Text>
                  <Text style={styles.summaryTotalValue}>{paymentLabel}</Text>
                </View>
              </View>
            )}

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.backButton]}
                onPress={handleCancel}
                disabled={processing}
                activeOpacity={0.8}
              >
                <Ionicons name="chevron-back" size={18} color="#374151" />
                <Text style={styles.backButtonText}>Назад</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.payButton, processing && styles.payButtonDisabled]}
                onPress={handlePayWithPayme}
                disabled={processing}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#7C3AED', '#6366F1']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.payButtonGradient}
                >
                  {processing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="card-outline" size={18} color="#FFFFFF" />
                      <Ionicons name="arrow-forward" size={16} color="#C7D2FE" />
                      <Text style={styles.payButtonText}>{paymentLabel}</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <Text style={styles.termsText}>
              Продолжая, вы соглашаетесь с условиями обслуживания и политикой возвратов.
            </Text>
          </Animated.View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pageSafeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  pageContainer: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  pageHeader: {
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingBottom: 10,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    elevation: 1,
    marginBottom: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBackButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pageTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  headerRight: {
    width: 72,
    alignItems: 'flex-end',
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  headerBadgeText: {
    fontSize: 10,
    color: '#4F46E5',
    fontWeight: '500',
  },
  pageScroll: {
    flex: 1,
  },
  pageContent: {
    paddingVertical: 20,
    paddingBottom: 28,
  },
  pageCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleGroup: {
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  securityText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F5F6F9',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTextContainer: {
    flex: 1,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#6B7280',
  },
  infoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 10,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
    textAlign: 'right',
    flexShrink: 1,
  },
  summaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#374151',
  },
  summaryValue: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '600',
  },
  summaryDivider: {
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 1,
  },
  summaryTotalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  summaryTotalValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
  },
  backButton: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 12,
  },
  backButtonText: {
    fontSize: 12,
    color: '#1F2937',
    fontWeight: '600',
  },
  payButton: {
    borderRadius: 16,
  },
  payButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    minHeight: 38,
  },
  payButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  payButtonDisabled: {
    opacity: 0.7,
  },
  termsText: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: '#4B5563',
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  errorButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
