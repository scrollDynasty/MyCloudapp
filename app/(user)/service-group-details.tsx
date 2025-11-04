import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
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
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { API_URL } from '../../config/api';
import { getHeaders } from '../../config/fetch';
import { useAuth } from '../../lib/AuthContext';

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

export default function ServiceGroupDetailsScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const { user: authUser } = useAuth();
  const groupId = params.groupId as string;
  const groupName = params.groupName as string;

  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [filteredPlans, setFilteredPlans] = useState<ServicePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  const [processingOrder, setProcessingOrder] = useState<number | null>(null);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => subscription?.remove();
  }, []);

  // Анимации
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  
  // Анимации для нижней панели навигации - используем useRef с правильным обновлением
  const navAnimationsRef = useRef({
    home: {
      bg: new Animated.Value(pathname === '/(user)/home' ? 1 : 0),
      label: new Animated.Value(pathname === '/(user)/home' ? 1 : 0),
    },
    services: {
      bg: new Animated.Value(pathname === '/(user)/services' ? 1 : 0),
      label: new Animated.Value(pathname === '/(user)/services' ? 1 : 0),
    },
    orders: {
      bg: new Animated.Value(pathname === '/(user)/orders' ? 1 : 0),
      label: new Animated.Value(pathname === '/(user)/orders' ? 1 : 0),
    },
    profile: {
      bg: new Animated.Value(pathname === '/(user)/profile' ? 1 : 0),
      label: new Animated.Value(pathname === '/(user)/profile' ? 1 : 0),
    },
  });

  // Анимация навигации при изменении pathname
  useEffect(() => {
    const navAnimations = navAnimationsRef.current;
    const routes = ['home', 'services', 'orders', 'profile'] as const;
    
    routes.forEach((route) => {
      const isActive = pathname === `/(user)/${route}`;
      Animated.parallel([
        Animated.timing(navAnimations[route].bg, {
          toValue: isActive ? 1 : 0,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(navAnimations[route].label, {
          toValue: isActive ? 1 : 0,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    });
  }, [pathname]);

  useEffect(() => {
    loadPlans();
  }, [groupId]);

  // Анимация появления контента
  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading]);

  // Фильтрация планов по поисковому запросу
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredPlans(plans);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = plans.filter((plan) => {
        const matchesName = plan.name_ru.toLowerCase().includes(query) ||
                           plan.name_uz.toLowerCase().includes(query);
        const matchesDescription = plan.description_ru?.toLowerCase().includes(query) ||
                                   plan.description_uz?.toLowerCase().includes(query);
        const matchesFields = plan.fields?.some(field =>
          field.field_label_ru.toLowerCase().includes(query) ||
          field.field_value_ru.toLowerCase().includes(query) ||
          field.field_key.toLowerCase().includes(query)
        );
        return matchesName || matchesDescription || matchesFields;
      });
      setFilteredPlans(filtered);
    }
  }, [searchQuery, plans]);

  const loadPlans = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/service-plans?group_id=${groupId}`, {
        headers: getHeaders(token || undefined),
      });

      const data = await response.json();
      if (data.success) {
        // Load fields for each plan
        const plansWithFields = await Promise.all(
          data.data.map(async (plan: ServicePlan) => {
            try {
              const planResponse = await fetch(`${API_URL}/api/service-plans/${plan.id}`, {
                headers: getHeaders(token || undefined),
              });
              const planData = await planResponse.json();
              if (planData.success) {
                return { ...plan, fields: planData.data.fields || [] };
              }
            } catch (err) {
              console.error('Error loading plan fields:', err);
            }
            return { ...plan, fields: [] };
          })
        );
        setPlans(plansWithFields);
        setFilteredPlans(plansWithFields);
      }
    } catch (error) {
      console.error('Error loading plans:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить тарифы');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadPlans();
  };

  const handleOrderPlan = async (plan: ServicePlan) => {
    if (processingOrder === plan.id) return;

    try {
      setProcessingOrder(plan.id);
      const token = await AsyncStorage.getItem('token');
      
      const userId = authUser?.user_id;
      
      if (!userId) {
        Alert.alert('Ошибка', 'Не удалось определить пользователя');
        return;
      }

      // Создаем заказ
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
          // Открываем страницу оплаты Payme
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
      setProcessingOrder(null);
    }
  };

  const handleViewDetails = (plan: ServicePlan) => {
    router.push({
      pathname: '/(user)/service-details',
      params: {
        planId: plan.id.toString(),
      },
    } as any);
  };

  const getBillingPeriodText = (period: string) => {
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
  };

  // Форматирование характеристик плана
  const formatPlanSpecs = (plan: ServicePlan) => {
    const specs: string[] = [];
    
    // Ищем CPU, RAM, Storage в полях
    const cpuField = plan.fields?.find(f => f.field_key.toLowerCase().includes('cpu'));
    const ramField = plan.fields?.find(f => f.field_key.toLowerCase().includes('ram') || f.field_key.toLowerCase().includes('memory'));
    const storageField = plan.fields?.find(f => f.field_key.toLowerCase().includes('storage') || f.field_key.toLowerCase().includes('ssd'));
    
    if (cpuField && cpuField.field_value_ru) {
      specs.push(`${cpuField.field_value_ru} vCPU`);
    }
    if (ramField && ramField.field_value_ru) {
      specs.push(`${ramField.field_value_ru} RAM`);
    }
    if (storageField && storageField.field_value_ru) {
      specs.push(`${storageField.field_value_ru} SSD`);
    }
    
    return specs.join(' • ');
  };

  // Получение тегов (badges) для плана
  const getPlanBadges = (plan: ServicePlan) => {
    const badges: string[] = [];
    
    // Ищем специальные поля-теги
    plan.fields?.forEach(field => {
      const key = field.field_key.toLowerCase();
      const value = field.field_value_ru;
      
      if (key.includes('backup') || key.includes('бэкап')) {
        badges.push(value || 'Ежедневные бэкапы');
      } else if (key.includes('ipv4') || key.includes('ip')) {
        badges.push(value || 'IPv4');
      } else if (key.includes('traffic') || key.includes('трафик')) {
        badges.push(value || 'Трафик');
      } else if (key.includes('monitoring') || key.includes('мониторинг')) {
        badges.push(value || 'Мониторинг 24/7');
      } else if (key.includes('ddos') || key.includes('ddos')) {
        badges.push(value || 'DDoS защита');
      } else if (key.includes('channel') || key.includes('канал')) {
        badges.push(value || 'Выделенный канал');
      } else if (key.includes('snapshot') || key.includes('снапшот')) {
        badges.push(value || 'Снапшоты');
      }
    });
    
    return badges.slice(0, 3); // Максимум 3 тега
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  const displayPrice = (plan: ServicePlan) => {
    const price = plan.discount_price || plan.price;
    return `${price} ${plan.currency === 'UZS' ? 'сум' : plan.currency}`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Группа: {groupName}</Text>
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
        {/* Title Section */}
        <View style={styles.titleSection}>
          <View style={styles.titleText}>
            <Text style={styles.title}>Планы внутри группы</Text>
            <Text style={styles.subtitle}>Выберите конфигурацию для покупки</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchIconContainer}>
            <Ionicons name="search" size={18} color="#9CA3AF" />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Поиск по планам, CPU, RAM..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Available Services Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Доступные сервисы</Text>
          {filteredPlans.map((plan) => {
            const specs = formatPlanSpecs(plan);
            const badges = getPlanBadges(plan);
            const isProcessing = processingOrder === plan.id;

            return (
              <View key={plan.id} style={styles.planCard}>
                <View style={[styles.planCardContent, { flexDirection: dimensions.width < 375 ? 'column' : 'row' }]}>
                  <View style={styles.planMainInfo}>
                    <View style={styles.planIconContainer}>
                      <Ionicons name="server" size={18} color="#111827" />
                    </View>
                    <View style={styles.planDetails}>
                      <Text style={styles.planName} numberOfLines={1} ellipsizeMode="tail">{plan.name_ru}</Text>
                      {specs ? (
                        <Text style={styles.planSpecs} numberOfLines={2} ellipsizeMode="tail">{specs}</Text>
                      ) : null}
                      {badges.length > 0 ? (
                        <View style={styles.badgesContainer}>
                          {badges.map((badge, index) => (
                            <View key={index} style={styles.badge}>
                              <Text style={styles.badgeText} numberOfLines={1}>{badge}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View style={[styles.planActions, { 
                    alignItems: dimensions.width < 375 ? 'flex-start' : 'flex-end',
                    marginTop: dimensions.width < 375 ? 12 : 0,
                  }]}>
                    <Text style={styles.priceText} numberOfLines={1}>
                      {displayPrice(plan)}{getBillingPeriodText(plan.billing_period)}
                    </Text>
                    <View style={[styles.buttonsRow, { 
                      flexDirection: dimensions.width < 375 ? 'column' : 'row',
                      width: dimensions.width < 375 ? '100%' : 'auto',
                      gap: dimensions.width < 375 ? 8 : 8,
                    }]}>
                      <TouchableOpacity
                        style={[styles.detailsButton, {
                          flex: dimensions.width < 375 ? 1 : 0,
                          width: dimensions.width < 375 ? '100%' : 'auto',
                          minWidth: dimensions.width < 375 ? '100%' : 0,
                        }]}
                        onPress={() => handleViewDetails(plan)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="information-circle-outline" size={16} color="#374151" />
                        <Text style={styles.detailsButtonText} numberOfLines={1}>Детали</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.buyButton, {
                          flex: dimensions.width < 375 ? 1 : 0,
                          width: dimensions.width < 375 ? '100%' : 'auto',
                          minWidth: dimensions.width < 375 ? '100%' : 0,
                        }]}
                        onPress={() => handleOrderPlan(plan)}
                        disabled={isProcessing}
                        activeOpacity={0.7}
                      >
                        {isProcessing ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <React.Fragment>
                            <Ionicons name="cart" size={16} color="#FFFFFF" />
                            <Text style={styles.buyButtonText} numberOfLines={1}>Купить</Text>
                          </React.Fragment>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
                {plan.description_ru ? (
                  <React.Fragment>
                    <View style={styles.divider} />
                    <Text style={styles.planDescription} numberOfLines={3} ellipsizeMode="tail">{plan.description_ru}</Text>
                  </React.Fragment>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* What's Included Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Что входит</Text>
          <View style={styles.includedCard}>
            <View style={styles.includedBadges}>
              <View style={styles.includedBadge}>
                <Text style={styles.includedBadgeText}>Поддержка 24/7</Text>
              </View>
              <View style={styles.includedBadge}>
                <Text style={styles.includedBadgeText}>Бесплатный SSL</Text>
              </View>
              <View style={styles.includedBadge}>
                <Text style={styles.includedBadgeText}>Гибкая масштабируемость</Text>
              </View>
              <View style={styles.includedBadge}>
                <Text style={styles.includedBadgeText}>Панель управления</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </Animated.ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={() => router.push('/(user)/home')}
          activeOpacity={0.7}
        >
          <View style={styles.bottomNavContent}>
            <Animated.View 
              style={[
                styles.bottomNavIcon,
                {
                  backgroundColor: navAnimationsRef.current.home.bg.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['transparent', '#4F46E5'],
                  }),
                }
              ]}
            >
              <Ionicons 
                name="home" 
                size={20} 
                color={pathname === '/(user)/home' ? '#FFFFFF' : '#9CA3AF'}
              />
            </Animated.View>
            <Animated.Text 
              style={[
                styles.bottomNavLabel,
                {
                  color: navAnimationsRef.current.home.label.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['#9CA3AF', '#4F46E5'],
                  }),
                  fontWeight: navAnimationsRef.current.home.label.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['500', '600'],
                  }) as any,
                }
              ]}
            >
              Главная
            </Animated.Text>
            {pathname === '/(user)/home' ? <View style={styles.bottomNavIndicator} /> : null}
          </View>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={() => router.push('/(user)/services' as any)}
          activeOpacity={0.7}
        >
          <View style={styles.bottomNavContent}>
            <Animated.View 
              style={[
                styles.bottomNavIcon,
                {
                  backgroundColor: navAnimationsRef.current.services.bg.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['transparent', '#4F46E5'],
                  }),
                }
              ]}
            >
              <Ionicons 
                name="grid" 
                size={20} 
                color={pathname === '/(user)/services' ? '#FFFFFF' : '#9CA3AF'}
              />
            </Animated.View>
            <Animated.Text 
              style={[
                styles.bottomNavLabel,
                {
                  color: navAnimationsRef.current.services.label.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['#9CA3AF', '#4F46E5'],
                  }),
                  fontWeight: navAnimationsRef.current.services.label.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['500', '600'],
                  }) as any,
                }
              ]}
            >
              Сервисы
            </Animated.Text>
            {pathname === '/(user)/services' ? <View style={styles.bottomNavIndicator} /> : null}
          </View>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={() => router.push('/(user)/orders')}
          activeOpacity={0.7}
        >
          <View style={styles.bottomNavContent}>
            <Animated.View 
              style={[
                styles.bottomNavIcon,
                {
                  backgroundColor: navAnimationsRef.current.orders.bg.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['transparent', '#4F46E5'],
                  }),
                }
              ]}
            >
              <Ionicons 
                name="cart" 
                size={20} 
                color={pathname === '/(user)/orders' ? '#FFFFFF' : '#9CA3AF'}
              />
            </Animated.View>
            <Animated.Text 
              style={[
                styles.bottomNavLabel,
                {
                  color: navAnimationsRef.current.orders.label.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['#9CA3AF', '#4F46E5'],
                  }),
                  fontWeight: navAnimationsRef.current.orders.label.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['500', '600'],
                  }) as any,
                }
              ]}
            >
              Заказы
            </Animated.Text>
            {pathname === '/(user)/orders' ? <View style={styles.bottomNavIndicator} /> : null}
          </View>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={() => router.push('/(user)/profile' as any)}
          activeOpacity={0.7}
        >
          <View style={styles.bottomNavContent}>
            <Animated.View 
              style={[
                styles.bottomNavIcon,
                {
                  backgroundColor: navAnimationsRef.current.profile.bg.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['transparent', '#4F46E5'],
                  }),
                }
              ]}
            >
              <Ionicons 
                name="person" 
                size={20} 
                color={pathname === '/(user)/profile' ? '#FFFFFF' : '#9CA3AF'}
              />
            </Animated.View>
            <Animated.Text 
              style={[
                styles.bottomNavLabel,
                {
                  color: navAnimationsRef.current.profile.label.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['#9CA3AF', '#4F46E5'],
                  }),
                  fontWeight: navAnimationsRef.current.profile.label.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['500', '600'],
                  }) as any,
                }
              ]}
            >
              Профиль
            </Animated.Text>
            {pathname === '/(user)/profile' ? <View style={styles.bottomNavIndicator} /> : null}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

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
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    minHeight: Platform.OS === 'ios' ? 72 : 62,
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
    zIndex: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  headerTitle: {
    fontWeight: '600',
    color: '#111827',
    letterSpacing: 0,
    flex: 1,
    textAlign: 'center',
    paddingHorizontal: 40,
    ...Platform.select({
      ios: {
        fontSize: Dimensions.get('window').width < 375 ? 16 : 18,
      },
      android: {
        fontSize: Dimensions.get('window').width < 375 ? 15 : 17,
      },
    }),
  },
  headerRight: {
    width: 36,
    height: 36,
  },
  content: {
    flex: 1,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  titleText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 21.78,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  searchIconContainer: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: '400',
    color: '#111827',
    lineHeight: 14.52,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
    marginBottom: 12,
    lineHeight: 16.94,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 13,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  planCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    flexWrap: 'wrap',
  },
  planMainInfo: {
    flexDirection: 'row',
    gap: 10,
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
  },
  planIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  planDetails: {
    flex: 1,
    gap: 2,
    minWidth: 0,
    flexShrink: 1,
  },
  planName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 16.94,
  },
  planSpecs: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 14.52,
    marginTop: 2,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  planActions: {
    alignItems: 'flex-end',
    gap: 8,
    flexShrink: 0,
    minWidth: 0,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 16.94,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    lineHeight: 16.94,
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 24,
    backgroundColor: '#6366F1',
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  buyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 16.94,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  planDescription: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  includedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 21,
    paddingBottom: 13,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  includedBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  includedBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  includedBadgeText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  bottomSpacer: {
    height: 20,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 9,
    paddingBottom: Platform.OS === 'ios' ? 15 : 15,
    paddingHorizontal: 8,
    justifyContent: 'center',
    gap: 6,
  },
  bottomNavItem: {
    width: 89,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bottomNavContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    position: 'relative',
  },
  bottomNavIcon: {
    width: 28,
    height: 28,
    borderRadius: 24,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomNavIconActive: {
    width: 28,
    height: 28,
    borderRadius: 24,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomNavIndicator: {
    position: 'absolute',
    bottom: -12,
    width: 32,
    height: 3,
    backgroundColor: '#4F46E5',
    borderRadius: 2,
  },
  bottomNavLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  bottomNavLabelActive: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
    lineHeight: 14.52,
  },
});
