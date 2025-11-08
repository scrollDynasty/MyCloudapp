import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { API_URL } from '../../config/api';
import { getHeaders } from '../../config/fetch';
import { useAuth } from '../../lib/AuthContext';

interface User {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
  company_name?: string;
}

interface Order {
  order_id: number;
  order_number?: string;
  user_id: number;
  full_name: string;
  plan_name: string;
  provider_name: string;
  total_price: number;
  currency_code: string;
  status: string;
  payment_status?: string;
  created_at: string;
}

export default function UserHomeScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { user: authUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSegment, setActiveSegment] = useState<'servers' | 'storage'>('servers');

  // Проверка активного пути
  const isActiveRoute = (route: string) => {
    return pathname === route || pathname?.includes(route);
  };

  const [windowDimensions, setWindowDimensions] = useState(Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setWindowDimensions(window);
    });

    return () => {
      if (typeof subscription?.remove === 'function') {
        subscription.remove();
      }
    };
  }, []);

  const isCompact = windowDimensions.width < 360;
  const isTablet = windowDimensions.width >= 768;

  const adaptive = useMemo(() => ({
    horizontal: isTablet ? 24 : isCompact ? 12 : 18,
    vertical: isTablet ? 20 : isCompact ? 12 : 16,
    cardRadius: isTablet ? 28 : isCompact ? 18 : 22,
    icon: isTablet ? 52 : isCompact ? 36 : 42,
    heading: isTablet ? 24 : isCompact ? 18 : 20,
    subtitle: isTablet ? 16 : isCompact ? 12 : 13,
    body: isTablet ? 15 : isCompact ? 12 : 13,
    small: isTablet ? 13 : isCompact ? 11 : 12,
    micro: isTablet ? 12 : isCompact ? 10 : 11,
    gap: isTablet ? 18 : isCompact ? 10 : 14,
  }), [isCompact, isTablet]);

  // Анимации
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (authUser) {
      setUser(authUser);
    }
    loadDashboardData();
  }, [authUser]);

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

  const loadDashboardData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      if (!token) {
        // Тихо перенаправляем на логин без показа алерта
        router.replace('/auth/login');
        return;
      }

      // Загрузить заказы
      const ordersResponse = await fetch(`${API_URL}/api/orders`, {
        headers: getHeaders(token || undefined),
      });
      const ordersData = await ordersResponse.json();

      if (ordersData.success && Array.isArray(ordersData.data)) {
        setOrders(ordersData.data || []);
      } else {
        setOrders([]);
      }
    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
      setOrders([]);
      Alert.alert('Ошибка', 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'completed':
      case 'paid':
        return '#10B981';
      case 'pending':
      case 'processing':
        return '#F59E0B';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#9CA3AF';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Активен';
      case 'pending':
      case 'processing':
        return 'Обработка';
      case 'completed':
      case 'paid':
        return 'Завершено';
      case 'cancelled':
        return 'Отменено';
      default:
        return status;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} минут назад`;
    } else if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'час' : 'часа'} назад`;
    } else if (diffDays === 1) {
      return 'Вчера';
    } else if (diffDays < 7) {
      return `${diffDays} ${diffDays === 1 ? 'день' : 'дня'} назад`;
    } else {
      return date.toLocaleDateString('ru-RU');
    }
  };

  // Получаем последние заказы
  const recentOrders = orders
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 2);

  // Подсчитываем статистику
  const activeServices = orders.filter(o => o.status === 'active' || o.payment_status === 'paid').length;
  const pendingServices = orders.filter(o => o.status === 'pending' || o.payment_status === 'pending').length;

  const headerPaddingTop = Platform.OS === 'ios'
    ? (isTablet ? 72 : isCompact ? 48 : 58)
    : (isTablet ? 58 : isCompact ? 36 : 44);

  const headerPaddingBottom = isCompact ? 10 : 14;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  const userName = user?.full_name?.split(' ')[0] || 'Пользователь';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View
        style={[styles.header, {
          paddingHorizontal: adaptive.horizontal,
          paddingTop: headerPaddingTop,
          paddingBottom: headerPaddingBottom,
        }]}
      >
        <View style={styles.headerContent}>
          <View style={[styles.headerLeft, { width: adaptive.icon, height: adaptive.icon }]} />
          <Text style={[styles.headerTitle, { fontSize: adaptive.heading, lineHeight: adaptive.heading + 2 }]}>Главная</Text>
          <TouchableOpacity style={styles.profileButton} onPress={() => {/* TODO: открыть уведомления */}}>
            <View style={[styles.avatar, { width: adaptive.icon, height: adaptive.icon, borderRadius: adaptive.icon / 2 }]}>
              <Ionicons name="notifications-outline" size={adaptive.body + 6} color="#111827" />
            </View>
          </TouchableOpacity>
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
        {/* Welcome Section */}
        <View style={[styles.welcomeSection, { paddingHorizontal: adaptive.horizontal, paddingTop: adaptive.vertical, gap: adaptive.gap }]}>
          <View style={styles.welcomeText}>
            <Text style={[styles.welcomeTitle, { fontSize: adaptive.heading, lineHeight: adaptive.heading + 4 }]}>
              Добро пожаловать, {userName}
            </Text>
            <Text style={[styles.welcomeSubtitle, { fontSize: adaptive.small, lineHeight: adaptive.small + 2 }]}>
              Управляйте подключёнными сервисами и заказами
            </Text>
          </View>
          <View style={[styles.avatarLarge, { width: adaptive.icon, height: adaptive.icon, borderRadius: adaptive.icon / 2 }]}>
            <Ionicons name="person" size={adaptive.body + 8} color="#111827" />
          </View>
        </View>

        {/* Segment Control */}
        <View style={[styles.segmentContainer, { marginHorizontal: adaptive.horizontal, gap: isCompact ? 6 : 8 }]}> 
          <TouchableOpacity
             style={[
               styles.segmentButton,
               {
                borderRadius: 18,
                padding: isCompact ? 8 : 10,
                flex: 1,
              },
              activeSegment === 'servers' && styles.segmentButtonActive,
            ]}
            onPress={() => setActiveSegment('servers')}
            activeOpacity={0.7}
          >
            <View style={[styles.segmentIconBox, { width: isCompact ? 28 : 32, height: isCompact ? 28 : 32, borderRadius: 18 }]}>
              <Ionicons name="server-outline" size={isCompact ? 16 : 18} color="#111827" />
            </View>
            <Text
              style={[
                styles.segmentText,
                { fontSize: adaptive.small - 1 },
                activeSegment === 'servers' && styles.segmentTextActive,
              ]}
            >
              Мои серверы
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              {
                borderRadius: 18,
                padding: isCompact ? 8 : 10,
                flex: 1,
              },
              activeSegment === 'storage' && styles.segmentButtonActive,
            ]}
            onPress={() => setActiveSegment('storage')}
            activeOpacity={0.7}
          >
            <View style={[styles.segmentIconBox, { width: isCompact ? 28 : 32, height: isCompact ? 28 : 32, borderRadius: 18 }]}>
              <Ionicons name="cube-outline" size={isCompact ? 16 : 18} color="#111827" />
            </View>
            <Text
              style={[
                styles.segmentText,
                { fontSize: adaptive.small - 1 },
                activeSegment === 'storage' && styles.segmentTextActive,
              ]}
            >
              Моё хранилище
            </Text>
          </TouchableOpacity>
        </View>

        {/* Subscription Card */}
        <View
          style={[styles.subscriptionCard, {
            marginHorizontal: adaptive.horizontal,
            marginBottom: adaptive.gap,
            borderRadius: adaptive.cardRadius,
            padding: adaptive.vertical,
          }]}
        >
          <View style={styles.subscriptionHeader}>
            <View style={styles.subscriptionInfo}>
              <View style={[styles.subscriptionIconContainer, {
                width: adaptive.icon,
                height: adaptive.icon,
                borderRadius: adaptive.icon / 2,
              }]}>
                <Ionicons name="star" size={adaptive.body + 4} color="#111827" />
              </View>
              <View>
                <Text style={[styles.subscriptionTitle, { fontSize: adaptive.body }]}>
                  Подписка
                </Text>
                <Text style={[styles.subscriptionPeriod, { fontSize: adaptive.small }]}>
                  Pro • помесячно
                </Text>
              </View>
            </View>
            <TouchableOpacity>
              <Text style={[styles.subscriptionLink, { fontSize: adaptive.body, fontWeight: '600' }]}>Изменить план</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.subscriptionDivider} />
          <View style={[styles.subscriptionStats, { gap: adaptive.gap }]}>
            <View style={[styles.statItem, { borderRadius: adaptive.cardRadius, padding: adaptive.vertical - 4 }]}>
              <Text style={[styles.statValue, { fontSize: adaptive.heading - 2 }]}>{activeServices}</Text>
              <Text style={[styles.statLabel, { fontSize: adaptive.small }]}>Активные сервисы</Text>
            </View>
            <View style={[styles.statItem, { borderRadius: adaptive.cardRadius, padding: adaptive.vertical - 4 }]}>
              <Text style={[styles.statValue, { fontSize: adaptive.heading - 2 }]}>{pendingServices}</Text>
              <Text style={[styles.statLabel, { fontSize: adaptive.small }]}>Ожидают</Text>
            </View>
          </View>
        </View>

        {/* My Services Section */}
        <View style={[styles.section, { paddingHorizontal: adaptive.horizontal, marginBottom: adaptive.gap }]}>
          <Text style={[styles.sectionTitle, { fontSize: adaptive.small, marginBottom: adaptive.micro }]}>
            Мои сервисы
          </Text>
          
          <View style={[styles.serviceCard, { borderRadius: adaptive.cardRadius, padding: adaptive.vertical, marginBottom: adaptive.gap - 4 }]}>
            <View style={styles.serviceCardContent}>
              <View style={[styles.serviceIconContainer, {
                width: adaptive.icon,
                height: adaptive.icon,
                borderRadius: adaptive.icon / 2,
              }]}>
                <Ionicons name="server" size={adaptive.body + 4} color="#111827" />
              </View>
              <View style={styles.serviceInfo}>
                <Text style={[styles.serviceName, { fontSize: adaptive.body }]}>
                  Серверы
                </Text>
                <Text style={[styles.serviceDescription, { fontSize: adaptive.small }]}>
                  {activeServices} активных • средняя загрузка 28%
                </Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.serviceButton, { borderRadius: adaptive.cardRadius / 2, paddingHorizontal: adaptive.horizontal - 4, paddingVertical: 8 }]}> 
              <Text style={[styles.serviceButtonText, { fontSize: adaptive.small, fontWeight: '600' }]}>Открыть</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.serviceCard, { borderRadius: adaptive.cardRadius, padding: adaptive.vertical }]}>
            <View style={styles.serviceCardContent}>
              <View style={[styles.serviceIconContainer, {
                width: adaptive.icon,
                height: adaptive.icon,
                borderRadius: adaptive.icon / 2,
              }]}>
                <Ionicons name="cube" size={adaptive.body + 4} color="#111827" />
              </View>
              <View style={styles.serviceInfo}>
                <Text style={[styles.serviceName, { fontSize: adaptive.body }]}>Объектное хранилище</Text>
                <Text style={[styles.serviceDescription, { fontSize: adaptive.small }]}>1 бакет • 40 ГБ</Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.serviceButton, { borderRadius: adaptive.cardRadius / 2, paddingHorizontal: adaptive.horizontal - 4, paddingVertical: 8 }]}> 
              <Text style={[styles.serviceButtonText, { fontSize: adaptive.small, fontWeight: '600' }]}>Открыть</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Orders Section */}
        <View style={[styles.section, { paddingHorizontal: adaptive.horizontal, marginBottom: adaptive.gap }]}>
          <Text style={[styles.sectionTitle, { fontSize: adaptive.small, marginBottom: adaptive.micro }]}>Последние заказы</Text>
          
          {recentOrders.length > 0 ? (
            recentOrders.map((order) => (
              <View key={order.order_id} style={[styles.orderCard, { borderRadius: adaptive.cardRadius, padding: adaptive.vertical - 2, marginBottom: adaptive.gap - 6 }]}>
                <View style={styles.orderCardContent}>
                  <View style={[styles.orderIconContainer, {
                    width: adaptive.icon - 4,
                    height: adaptive.icon,
                    borderRadius: adaptive.icon / 2,
                  }]}>
                    <Ionicons name="document-text" size={adaptive.body + 4} color="#111827" />
                  </View>
                  <View style={styles.orderInfo}>
                    <Text style={[styles.orderTitle, { fontSize: adaptive.body }]}>{order.plan_name}</Text>
                    <Text style={[styles.orderSubtitle, { fontSize: adaptive.small }]}>
                      Заказ №{order.order_number || order.order_id} • {formatTimeAgo(order.created_at)}
                    </Text>
                  </View>
                </View>
                <View style={[styles.orderStatusBadge, { borderRadius: adaptive.cardRadius / 2, paddingVertical: 6, paddingHorizontal: adaptive.horizontal - 6 }]}>
                  <Text style={[styles.orderStatusText, { fontSize: adaptive.small }] }>
                    {getStatusLabel(order.status || order.payment_status || 'pending')}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={[styles.emptyCard, { borderRadius: adaptive.cardRadius, padding: adaptive.vertical + 6 }]}>
              <Text style={[styles.emptyText, { fontSize: adaptive.small }]}>Нет заказов</Text>
            </View>
          )}
        </View>

        {/* Support Section */}
        <View style={[styles.section, { paddingHorizontal: adaptive.horizontal, marginBottom: adaptive.gap }]}>
          <Text style={[styles.sectionTitle, { fontSize: adaptive.small, marginBottom: adaptive.micro }]}>Поддержка</Text>
          
          <TouchableOpacity style={[styles.supportCard, { borderRadius: adaptive.cardRadius, padding: adaptive.vertical }]}>
            <View style={styles.supportCardContent}>
              <View style={[styles.supportIconContainer, {
                width: adaptive.icon,
                height: adaptive.icon,
                borderRadius: adaptive.icon / 2,
              }]}>
                <Ionicons name="chatbubble-ellipses" size={adaptive.body + 4} color="#111827" />
              </View>
              <View style={styles.supportInfo}>
                <Text style={[styles.supportTitle, { fontSize: adaptive.body }]}>Открыть тикет</Text>
                <Text style={[styles.supportDescription, { fontSize: adaptive.small }]}>Поможем решить вопрос</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.supportCard, { borderRadius: adaptive.cardRadius, padding: adaptive.vertical }]}>
            <View style={styles.supportCardContent}>
              <View style={[styles.supportIconContainer, {
                width: adaptive.icon,
                height: adaptive.icon,
                borderRadius: adaptive.icon / 2,
              }]}>
                <Ionicons name="receipt" size={adaptive.body + 4} color="#111827" />
              </View>
              <View style={styles.supportInfo}>
                <Text style={[styles.supportTitle, { fontSize: adaptive.body }]}>Оплата и счета</Text>
                <Text style={[styles.supportDescription, { fontSize: adaptive.small }]}>Способы оплаты и история</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <View style={[styles.bottomSpacer, { height: adaptive.vertical + 4 }]} />
      </Animated.ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={() => {
            if (!isActiveRoute('/home')) {
              router.replace('/(user)/home');
            }
          }}
          activeOpacity={0.7}
        >
          <View style={styles.bottomNavContent}>
            <View style={isActiveRoute('/home') ? styles.bottomNavIconActive : styles.bottomNavIcon}>
              <Ionicons name="home" size={20} color={isActiveRoute('/home') ? '#FFFFFF' : '#9CA3AF'} />
            </View>
            <Text style={isActiveRoute('/home') ? styles.bottomNavLabelActive : styles.bottomNavLabel}>Главная</Text>
            {isActiveRoute('/home') && <View style={styles.bottomNavIndicator} />}
          </View>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={() => {
            if (!isActiveRoute('/services')) {
              router.replace('/(user)/services');
            }
          }}
          activeOpacity={0.7}
        >
          <View style={styles.bottomNavContent}>
            <View style={isActiveRoute('/services') ? styles.bottomNavIconActive : styles.bottomNavIcon}>
              <Ionicons name="grid" size={20} color={isActiveRoute('/services') ? '#FFFFFF' : '#9CA3AF'} />
            </View>
            <Text style={isActiveRoute('/services') ? styles.bottomNavLabelActive : styles.bottomNavLabel}>Сервисы</Text>
            {isActiveRoute('/services') && <View style={styles.bottomNavIndicator} />}
          </View>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={() => {
            if (!isActiveRoute('/orders')) {
              router.replace('/(user)/orders');
            }
          }}
          activeOpacity={0.7}
        >
          <View style={styles.bottomNavContent}>
            <View style={isActiveRoute('/orders') ? styles.bottomNavIconActive : styles.bottomNavIcon}>
              <Ionicons name="cart" size={20} color={isActiveRoute('/orders') ? '#FFFFFF' : '#9CA3AF'} />
            </View>
            <Text style={isActiveRoute('/orders') ? styles.bottomNavLabelActive : styles.bottomNavLabel}>Заказы</Text>
            {isActiveRoute('/orders') && <View style={styles.bottomNavIndicator} />}
          </View>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={() => {
            if (!isActiveRoute('/profile')) {
              router.replace('/(user)/profile');
            }
          }}
          activeOpacity={0.7}
        >
          <View style={styles.bottomNavContent}>
            <View style={isActiveRoute('/profile') ? styles.bottomNavIconActive : styles.bottomNavIcon}>
              <Ionicons name="person" size={20} color={isActiveRoute('/profile') ? '#FFFFFF' : '#9CA3AF'} />
            </View>
            <Text style={isActiveRoute('/profile') ? styles.bottomNavLabelActive : styles.bottomNavLabel}>Профиль</Text>
            {isActiveRoute('/profile') && <View style={styles.bottomNavIndicator} />}
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
    paddingTop: Platform.OS === 'ios' ? 52 : 40,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
  },
  profileButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  avatarLarge: {
    width: 40,
    height: 40,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  content: {
    flex: 1,
  },
  welcomeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    gap: 12,
  },
  welcomeText: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
    lineHeight: 24,
  },
  welcomeSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
    lineHeight: 16,
  },
  segmentContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 10,
  },
  segmentButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flex: 1,
    gap: 5,
  },
  segmentButtonActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  segmentIconBox: {
    width: 32,
    height: 32,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
  },
  segmentTextActive: {
    color: '#111827',
  },
  subscriptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subscriptionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subscriptionIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  subscriptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 16.94,
  },
  subscriptionPeriod: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  subscriptionLink: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 20,
  },
  subscriptionDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  subscriptionStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 4,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 16.94,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    lineHeight: 14.52,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 18,
  },
  serviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  serviceCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  serviceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  serviceInfo: {
    flex: 1,
    gap: 2,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 16.94,
  },
  serviceDescription: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  serviceButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  serviceButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 16,
  },
  orderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  orderCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  orderIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  orderInfo: {
    flex: 1,
    gap: 2,
  },
  orderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 16.94,
  },
  orderSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  orderStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  orderStatusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  supportCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  supportCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  supportIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  supportInfo: {
    flex: 1,
    gap: 2,
  },
  supportTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 16.94,
  },
  supportDescription: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
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
