import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Linking,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '../../config/api';
import { getHeaders } from '../../config/fetch';
import { useAuth } from '../../lib/AuthContext';
import { invalidateCache } from '../../lib/cache';

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

interface ServicePlan {
  id: number;
  group_id: number;
  name_uz: string;
  name_ru: string;
  description_uz?: string;
  description_ru?: string;
  price: number;
  discount_price?: number;
  currency: string;
  billing_period: string;
  display_order: number;
  is_active: boolean;
  group_name_uz: string;
  group_name_ru: string;
  group_slug: string;
  fields?: PlanField[];
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default React.memo(function ServiceDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user: authUser } = useAuth();
  const insets = useSafeAreaInsets();
  const planId = params.planId as string;

  const [plan, setPlan] = useState<ServicePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingOrder, setProcessingOrder] = useState(false);
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  // Отслеживание изменения размеров экрана
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => subscription?.remove();
  }, []);

  // Адаптивные размеры
  const adaptive = useMemo(() => {
    const width = dimensions.width;
    const isSmall = width < 375;
    
    return {
      horizontal: isSmall ? 14 : 16,
      vertical: 12,
      gap: isSmall ? 10 : 12,
      cardPadding: isSmall ? 12 : 14,
      borderRadius: 20,
      iconSize: 20,
      smallIconSize: 16,
      titleSize: 18,
      nameSize: isSmall ? 14 : 15,
      labelSize: 14,
      textSize: 13,
      valueSize: 14,
      priceSize: isSmall ? 17 : 19,
      buttonPadding: 12,
      buttonVertical: 12,
    };
  }, [dimensions]);

  // Анимации
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Загрузка данных плана с кэшированием
  const loadPlanData = useCallback(async (forceRefresh = false) => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      if (!token) {
        Alert.alert('Ошибка', 'Токен авторизации не найден');
        router.replace('/auth/login');
        return;
      }

      // Загружаем план напрямую (кэш для конкретного плана не реализован, используем общий кэш service_plans)
      const response = await fetch(`${API_URL}/api/service-plans/${planId}`, {
        headers: getHeaders(token || undefined),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch plan');
      }

      const data = await response.json();
      if (data.success && data.data) {
        setPlan(data.data);
      } else {
        throw new Error('Invalid plan data');
      }
    } catch (error: any) {
      console.error('Error loading plan:', error);
      if (forceRefresh) {
        Alert.alert('Ошибка', 'Не удалось загрузить данные плана');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [planId, router]);

  useEffect(() => {
    if (planId) {
      loadPlanData(false);
    }
  }, [planId, loadPlanData]);

  // Анимация появления контента
  useEffect(() => {
    if (!loading && plan) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [loading, plan]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadPlanData(true);
  }, [loadPlanData]);

  // Получение значения поля по ключу
  const getFieldValue = useCallback((key: string): string => {
    const field = plan?.fields?.find(f => 
      f.field_key.toLowerCase().includes(key.toLowerCase())
    );
    return field?.field_value_ru || '';
  }, [plan]);

  // Мемоизация характеристик
  const planSpecs = useMemo(() => {
    if (!plan) return null;
    
    const cpu = getFieldValue('cpu') || getFieldValue('vCPU');
    const ram = getFieldValue('ram') || getFieldValue('memory');
    const storage = getFieldValue('storage') || getFieldValue('ssd');
    
    if (cpu || ram || storage) {
      return `VPS: ${cpu} ${ram} ${storage}`.trim();
    }
    return null;
  }, [plan, getFieldValue]);

  // Форматирование цены
  const displayPrice = useMemo(() => {
    if (!plan) return '';
    const price = plan.discount_price || plan.price;
    const formatted = new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
    return `${formatted} ${plan.currency === 'UZS' ? 'сум' : plan.currency}`;
  }, [plan]);

  // Получение текста периода биллинга
  const getBillingPeriodText = useCallback((period: string) => {
    switch (period) {
      case 'monthly':
        return '/мес';
      case 'yearly':
        return '/год';
      case 'quarterly':
        return '/квартал';
      case 'weekly':
        return '/неделя';
      case 'one_time':
        return ' разово';
      default:
        return '/мес';
    }
  }, []);

  // Обработка покупки
  const handleOrderPlan = useCallback(async () => {
    if (processingOrder || !plan || !authUser) return;

    try {
      setProcessingOrder(true);
      const token = await AsyncStorage.getItem('token');
      
      const userId = authUser.user_id;
      
      if (!userId) {
        Alert.alert('Ошибка', 'Не удалось определить пользователя');
        return;
      }

      // Санитизация данных запроса
      const requestBody = {
        user_id: userId,
        service_plan_id: plan.id,
        notes: `Заказ тарифа: ${plan.name_ru}`,
      };

      const response = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: getHeaders(token || undefined),
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      
      if (data.success) {
        // Инвалидация кэша заказов
        await invalidateCache(['user_orders']);
        
        // Создаем платеж через Payme
        const paymentResponse = await fetch(`${API_URL}/api/payments/payme`, {
          method: 'POST',
          headers: getHeaders(token || undefined),
          body: JSON.stringify({
            order_id: data.data.id,
            return_url: `${API_URL}/payment-success?order_id=${data.data.id}`,
          }),
        });

        const paymentData = await paymentResponse.json();

        if (paymentData.success && paymentData.data?.checkout_url) {
          const canOpen = await Linking.canOpenURL(paymentData.data.checkout_url);
          if (canOpen) {
            await Linking.openURL(paymentData.data.checkout_url);
          } else {
            Alert.alert('Ошибка', 'Не удалось открыть страницу оплаты');
          }
        } else {
          Alert.alert('Ошибка', paymentData.error || 'Не удалось создать платеж');
        }
      } else {
        Alert.alert('Ошибка', data.error || 'Не удалось создать заказ');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      Alert.alert('Ошибка', 'Не удалось создать заказ');
    } finally {
      setProcessingOrder(false);
    }
  }, [plan, authUser, processingOrder]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  if (!plan) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>План не найден</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top > 0 ? 8 : 0 }]}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: adaptive.horizontal }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { 
            width: 32 + adaptive.vertical,
            height: 32 + adaptive.vertical,
            borderRadius: adaptive.borderRadius 
          }]}>
            <Ionicons name="arrow-back" size={adaptive.iconSize} color="#111827" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { 
            fontSize: adaptive.titleSize,
            paddingHorizontal: 36 + adaptive.vertical 
          }]} numberOfLines={1} ellipsizeMode="tail">
            Детали сервиса
          </Text>
          <View style={styles.headerRight} />
        </View>
      </View>

      <Animated.ScrollView
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#4F46E5']} />
        }
      >
        {/* Plan Card */}
        <View style={[styles.planCard, { 
          margin: adaptive.horizontal,
          padding: adaptive.cardPadding,
          borderRadius: adaptive.borderRadius 
        }]}>
          <View style={[styles.planHeader, { gap: adaptive.gap }]}>
            <View style={[styles.planIcon, { 
              width: 36 + adaptive.vertical,
              height: 36 + adaptive.vertical,
              borderRadius: adaptive.borderRadius 
            }]}>
              <View style={[styles.planIconBorder, { 
                width: 32 + adaptive.vertical,
                height: 36 + adaptive.vertical,
                borderRadius: adaptive.borderRadius 
              }]}>
                <Ionicons name="server" size={adaptive.iconSize} color="#111827" />
              </View>
            </View>
            <View style={styles.planTitleSection}>
              <Text style={[styles.planName, { fontSize: adaptive.nameSize }]} numberOfLines={2}>
                {plan.name_ru}
              </Text>
              {planSpecs ? (
                <Text style={[styles.planSubtitle, { fontSize: adaptive.textSize }]} numberOfLines={1}>
                  {planSpecs}
                </Text>
              ) : null}
            </View>
            <View style={[styles.availabilityBadge, { 
              paddingHorizontal: adaptive.buttonPadding,
              paddingVertical: 6,
              borderRadius: adaptive.borderRadius 
            }]}>
              <Text style={[styles.availabilityText, { fontSize: adaptive.textSize }]}>
                Доступен
              </Text>
            </View>
          </View>

          {/* Price Section */}
          <View style={{ marginTop: adaptive.gap }}>
            {/* Разделитель */}
            <View style={{ height: 1, backgroundColor: '#E5E7EB', marginVertical: adaptive.gap }} />
            
            {/* Цена */}
            <View style={{ marginBottom: adaptive.gap }}>
              <Text style={{ fontSize: adaptive.textSize, color: '#9CA3AF', marginBottom: 6 }}>
                Стоимость:
              </Text>
              <Text style={[styles.priceAmount, { fontSize: adaptive.priceSize + 2, fontWeight: '500' }]}>
                {displayPrice}{getBillingPeriodText(plan.billing_period)}
              </Text>
              <Text style={[styles.priceNote, { fontSize: adaptive.textSize, marginTop: 4 }]}>
                С учётом НДС, если применимо
              </Text>
            </View>

            {/* Кнопки */}
            <View style={[styles.actionButtons, { 
              flexDirection: 'row',
              gap: adaptive.gap 
            }]}>
              <TouchableOpacity 
                style={[styles.characteristicsButton, { 
                  flex: 1,
                  paddingHorizontal: adaptive.buttonPadding,
                  paddingVertical: adaptive.buttonPadding + 2,
                  borderRadius: adaptive.borderRadius,
                  gap: 6 
                }]}
                activeOpacity={0.7}
              >
                <Ionicons name="options-outline" size={adaptive.smallIconSize} color="#374151" />
                <Text style={[styles.characteristicsButtonText, { fontSize: adaptive.labelSize }]} numberOfLines={1}>
                  Детали
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.buyButton, { 
                  flex: 1,
                  paddingHorizontal: adaptive.buttonPadding,
                  paddingVertical: adaptive.buttonVertical + 2,
                  borderRadius: adaptive.borderRadius,
                  gap: 6 
                }]}
                onPress={handleOrderPlan}
                disabled={processingOrder}
                activeOpacity={0.7}
              >
                {processingOrder ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <React.Fragment>
                    <Ionicons name="cart-outline" size={adaptive.smallIconSize} color="#FFFFFF" />
                    <Text style={[styles.buyButtonText, { fontSize: adaptive.labelSize }]} numberOfLines={1}>Купить</Text>
                  </React.Fragment>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* What's Included Section */}
        <View style={[styles.section, { marginHorizontal: adaptive.horizontal }]}>
          <Text style={[styles.sectionTitle, { fontSize: adaptive.titleSize }]}>Что включено</Text>
          <View style={[styles.includedCard, { 
            padding: adaptive.cardPadding,
            borderRadius: adaptive.borderRadius,
            gap: adaptive.gap 
          }]}>
            <View style={[styles.includedRow, { gap: adaptive.gap }]}>
              <Text style={[styles.includedLabel, { fontSize: adaptive.textSize }]}>
                Виртуальные ядра
              </Text>
              <Text style={[styles.includedValue, { fontSize: adaptive.valueSize }]} numberOfLines={1}>
                {getFieldValue('cpu') || getFieldValue('vCPU') || 'N/A'}
              </Text>
            </View>
            <View style={[styles.includedRow, { gap: adaptive.gap }]}>
              <Text style={[styles.includedLabel, { fontSize: adaptive.textSize }]}>
                Оперативная память
              </Text>
              <Text style={[styles.includedValue, { fontSize: adaptive.valueSize }]} numberOfLines={1}>
                {getFieldValue('ram') || getFieldValue('memory') || 'N/A'}
              </Text>
            </View>
            <View style={[styles.includedRow, { gap: adaptive.gap }]}>
              <Text style={[styles.includedLabel, { fontSize: adaptive.textSize }]}>Хранилище</Text>
              <Text style={[styles.includedValue, { fontSize: adaptive.valueSize }]} numberOfLines={1}>
                {getFieldValue('storage') || getFieldValue('ssd') || 'N/A'}
              </Text>
            </View>
            <View style={[styles.includedRow, { gap: adaptive.gap }]}>
              <Text style={[styles.includedLabel, { fontSize: adaptive.textSize }]}>Трафик</Text>
              <Text style={[styles.includedValue, { fontSize: adaptive.valueSize }]} numberOfLines={1}>
                {getFieldValue('traffic') || getFieldValue('bandwidth') || 'Безлимит'}
              </Text>
            </View>
            <View style={[styles.includedRow, { gap: adaptive.gap }]}>
              <Text style={[styles.includedLabel, { fontSize: adaptive.textSize }]}>Локация</Text>
              <Text style={[styles.includedValue, { fontSize: adaptive.valueSize }]} numberOfLines={1}>
                {getFieldValue('location') || getFieldValue('region') || 'Ташкент, UZ'}
              </Text>
            </View>
            <View style={[styles.includedRow, { gap: adaptive.gap }]}>
              <Text style={[styles.includedLabel, { fontSize: adaptive.textSize }]}>
                Срок биллинга
              </Text>
              <Text style={[styles.includedValue, { fontSize: adaptive.valueSize }]} numberOfLines={1}>
                {plan.billing_period === 'monthly' ? 'Ежемесячно' : 
                 plan.billing_period === 'yearly' ? 'Ежегодно' :
                 plan.billing_period === 'quarterly' ? 'Ежеквартально' : 'Ежемесячно'}
              </Text>
            </View>
          </View>
        </View>

        {/* Configuration Options Section */}
        <View style={[styles.section, { marginHorizontal: adaptive.horizontal }]}>
          <Text style={[styles.sectionTitle, { fontSize: adaptive.titleSize }]}>
            Опции конфигурации
          </Text>
          <View style={[styles.configCard, { 
            padding: adaptive.cardPadding,
            borderRadius: adaptive.borderRadius,
            gap: adaptive.gap 
          }]}>
            <View style={[styles.configRow, { gap: adaptive.gap }]}>
              <Text style={[styles.configLabel, { fontSize: adaptive.valueSize }]}>ОС</Text>
              <View style={[styles.configValueBadge, { 
                paddingHorizontal: adaptive.buttonPadding,
                paddingVertical: 8,
                borderRadius: adaptive.borderRadius 
              }]}>
                <Text style={[styles.configValueText, { fontSize: adaptive.textSize }]} numberOfLines={1}>
                  {getFieldValue('os') || getFieldValue('operating_system') || 'Ubuntu 22.04'}
                </Text>
              </View>
            </View>
            <View style={[styles.configRow, { gap: adaptive.gap }]}>
              <Text style={[styles.configLabel, { fontSize: adaptive.valueSize }]}>Снапшоты</Text>
              <View style={[styles.configValueBadge, { 
                paddingHorizontal: adaptive.buttonPadding,
                paddingVertical: 8,
                borderRadius: adaptive.borderRadius 
              }]}>
                <Text style={[styles.configValueText, { fontSize: adaptive.textSize }]}>
                  {getFieldValue('snapshot') || 'Выкл.'}
                </Text>
              </View>
            </View>
            <View style={[styles.configRow, { gap: adaptive.gap }]}>
              <Text style={[styles.configLabel, { fontSize: adaptive.valueSize }]}>
                Публичный IP
              </Text>
              <View style={[styles.configValueBadge, { 
                paddingHorizontal: adaptive.buttonPadding,
                paddingVertical: 8,
                borderRadius: adaptive.borderRadius 
              }]}>
                <Text style={[styles.configValueText, { fontSize: adaptive.textSize }]}>
                  {getFieldValue('public_ip') || 'Включён'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Description Section */}
        {plan.description_ru && (
          <View style={[styles.section, { marginHorizontal: adaptive.horizontal }]}>
            <Text style={[styles.sectionTitle, { fontSize: adaptive.titleSize }]}>Описание</Text>
            <View style={[styles.descriptionCard, { 
              padding: adaptive.cardPadding,
              borderRadius: adaptive.borderRadius 
            }]}>
              <Text style={[styles.descriptionText, { fontSize: adaptive.textSize }]}>
                {plan.description_ru}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </Animated.ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 13,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    width: '100%',
    minHeight: 36,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 1,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 21.78,
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: 44,
  },
  headerRight: {
    width: 36,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginBottom: 16,
  },
  content: {
    flex: 1,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 13,
    margin: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 5,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  planIcon: {
    width: 44,
    height: 44,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  planIconBorder: {
    width: 38,
    height: 44,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  planTitleSection: {
    flex: 1,
    gap: 2,
    minWidth: 0,
    marginRight: 8,
  },
  planName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    lineHeight: 16.94,
    flexShrink: 1,
  },
  planSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 14.52,
    flexShrink: 1,
  },
  availabilityBadge: {
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexShrink: 0,
  },
  availabilityText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    lineHeight: 14.52,
  },
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 4,
  },
  specText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#374151',
    lineHeight: 14.52,
    flexShrink: 1,
    flex: 1,
  },
  priceSection: {
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  priceInfo: {
    gap: 2,
    flex: 1,
    minWidth: 0,
  },
  priceAmount: {
    fontWeight: '700',
    color: '#111827',
    lineHeight: 21.78,
    flexShrink: 1,
  },
  priceNote: {
    fontSize: 11,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 14.52,
    flexShrink: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  characteristicsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 100,
  },
  characteristicsButtonText: {
    fontWeight: '500',
    color: '#374151',
    lineHeight: 15.73,
    flexShrink: 1,
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 24,
    backgroundColor: '#6366F1',
    borderWidth: 1,
    borderColor: '#6366F1',
    minWidth: 100,
  },
  buyButtonText: {
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 16.94,
    flexShrink: 1,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 21.78,
    marginBottom: 8,
  },
  includedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 13,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  includedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    flexWrap: 'wrap',
    gap: 4,
  },
  includedLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 14.52,
    flexShrink: 1,
    flex: 1,
    minWidth: 100,
  },
  includedValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    lineHeight: 16.94,
    flexShrink: 1,
    textAlign: 'right',
    flex: 1,
    minWidth: 100,
  },
  configCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 13,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    flexWrap: 'wrap',
    gap: 4,
  },
  configLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    lineHeight: 16.94,
    flexShrink: 1,
    flex: 1,
    minWidth: 100,
  },
  configValueBadge: {
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  configValueText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    lineHeight: 14.52,
  },
  descriptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 13,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  descriptionText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  bottomSpacer: {
    height: 80,
  },
});

