import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
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
  const { user: authUser, signOut } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSegment, setActiveSegment] = useState<'servers' | 'storage'>('servers');

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
        Alert.alert('Ошибка', 'Токен авторизации не найден. Пожалуйста, войдите снова.');
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

  const handleLogout = async () => {
    try {
      await signOut();
      router.replace('/auth/login');
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось выйти. Попробуйте еще раз.');
    }
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
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft} />
          <Text style={styles.headerTitle}>Главная</Text>
          <TouchableOpacity style={styles.profileButton} onPress={() => {/* TODO: открыть уведомления */}}>
            <View style={styles.avatar}>
              <Ionicons name="notifications-outline" size={20} color="#111827" />
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
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeText}>
            <Text style={styles.welcomeTitle}>Добро пожаловать, {userName}</Text>
            <Text style={styles.welcomeSubtitle}>Управляйте подключёнными сервисами и заказами</Text>
          </View>
          <View style={styles.avatarLarge}>
            <Ionicons name="person" size={24} color="#111827" />
          </View>
        </View>

        {/* Segment Control */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentButton, activeSegment === 'servers' && styles.segmentButtonActive]}
            onPress={() => setActiveSegment('servers')}
            activeOpacity={0.7}
          >
            <View style={styles.segmentIconContainer}>
              <Ionicons name="server" size={18} color={activeSegment === 'servers' ? '#111827' : '#9CA3AF'} />
            </View>
            <Text style={[styles.segmentText, activeSegment === 'servers' && styles.segmentTextActive]}>
              Мои серверы
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentButton, activeSegment === 'storage' && styles.segmentButtonActive]}
            onPress={() => setActiveSegment('storage')}
            activeOpacity={0.7}
          >
            <View style={styles.segmentIconContainer}>
              <Ionicons name="cube" size={18} color={activeSegment === 'storage' ? '#111827' : '#9CA3AF'} />
            </View>
            <Text style={[styles.segmentText, activeSegment === 'storage' && styles.segmentTextActive]}>
              Моё{'\n'}хранилище
            </Text>
          </TouchableOpacity>
        </View>

        {/* Subscription Card */}
        <View style={styles.subscriptionCard}>
          <View style={styles.subscriptionHeader}>
            <View style={styles.subscriptionInfo}>
              <View style={styles.subscriptionIconContainer}>
                <Ionicons name="star" size={18} color="#111827" />
              </View>
              <View>
                <Text style={styles.subscriptionTitle}>Подписка</Text>
                <Text style={styles.subscriptionPeriod}>Pro • помесячно</Text>
              </View>
            </View>
            <TouchableOpacity>
              <Text style={styles.subscriptionLink}>Изменить план</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.subscriptionDivider} />
          <View style={styles.subscriptionStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{activeServices}</Text>
              <Text style={styles.statLabel}>Активные сервисы</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{pendingServices}</Text>
              <Text style={styles.statLabel}>Ожидают</Text>
            </View>
          </View>
        </View>

        {/* My Services Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Мои сервисы</Text>
          
          <View style={styles.serviceCard}>
            <View style={styles.serviceCardContent}>
              <View style={styles.serviceIconContainer}>
                <Ionicons name="server" size={18} color="#111827" />
              </View>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceName}>Серверы</Text>
                <Text style={styles.serviceDescription}>
                  {activeServices} активных • средняя загрузка 28%
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.serviceButton}>
              <Text style={styles.serviceButtonText}>Открыть</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.serviceCard}>
            <View style={styles.serviceCardContent}>
              <View style={styles.serviceIconContainer}>
                <Ionicons name="cube" size={18} color="#111827" />
              </View>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceName}>Объектное хранилище</Text>
                <Text style={styles.serviceDescription}>1 бакет • 40 ГБ</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.serviceButton}>
              <Text style={styles.serviceButtonText}>Открыть</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Orders Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Последние заказы</Text>
          
          {recentOrders.length > 0 ? (
            recentOrders.map((order) => (
              <View key={order.order_id} style={styles.orderCard}>
                <View style={styles.orderCardContent}>
                  <View style={styles.orderIconContainer}>
                    <Ionicons name="document-text" size={18} color="#111827" />
                  </View>
                  <View style={styles.orderInfo}>
                    <Text style={styles.orderTitle}>{order.plan_name}</Text>
                    <Text style={styles.orderSubtitle}>
                      Заказ №{order.order_number || order.order_id} • {formatTimeAgo(order.created_at)}
                    </Text>
                  </View>
                </View>
                <View style={styles.orderStatusBadge}>
                  <Text style={styles.orderStatusText}>
                    {getStatusLabel(order.status || order.payment_status || 'pending')}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Нет заказов</Text>
            </View>
          )}
        </View>

        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Поддержка</Text>
          
          <TouchableOpacity style={styles.supportCard}>
            <View style={styles.supportCardContent}>
              <View style={styles.supportIconContainer}>
                <Ionicons name="chatbubble-ellipses" size={18} color="#111827" />
              </View>
              <View style={styles.supportInfo}>
                <Text style={styles.supportTitle}>Открыть тикет</Text>
                <Text style={styles.supportDescription}>Поможем решить вопрос</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.supportCard}>
            <View style={styles.supportCardContent}>
              <View style={styles.supportIconContainer}>
                <Ionicons name="receipt" size={18} color="#111827" />
              </View>
              <View style={styles.supportInfo}>
                <Text style={styles.supportTitle}>Оплата и счета</Text>
                <Text style={styles.supportDescription}>Способы оплаты и история</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
          </TouchableOpacity>
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
            <View style={pathname === '/(user)/home' ? styles.bottomNavIconActive : styles.bottomNavIcon}>
              <Ionicons name="home" size={20} color={pathname === '/(user)/home' ? '#FFFFFF' : '#9CA3AF'} />
            </View>
            <Text style={pathname === '/(user)/home' ? styles.bottomNavLabelActive : styles.bottomNavLabel}>Главная</Text>
            {pathname === '/(user)/home' && <View style={styles.bottomNavIndicator} />}
          </View>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={() => router.push('/(user)/services' as any)}
          activeOpacity={0.7}
        >
          <View style={styles.bottomNavContent}>
            <View style={pathname === '/(user)/services' ? styles.bottomNavIconActive : styles.bottomNavIcon}>
              <Ionicons name="grid" size={20} color={pathname === '/(user)/services' ? '#FFFFFF' : '#9CA3AF'} />
            </View>
            <Text style={pathname === '/(user)/services' ? styles.bottomNavLabelActive : styles.bottomNavLabel}>Сервисы</Text>
            {pathname === '/(user)/services' && <View style={styles.bottomNavIndicator} />}
          </View>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={() => router.push('/(user)/orders')}
          activeOpacity={0.7}
        >
          <View style={styles.bottomNavContent}>
            <View style={pathname === '/(user)/orders' ? styles.bottomNavIconActive : styles.bottomNavIcon}>
              <Ionicons name="cart" size={20} color={pathname === '/(user)/orders' ? '#FFFFFF' : '#9CA3AF'} />
            </View>
            <Text style={pathname === '/(user)/orders' ? styles.bottomNavLabelActive : styles.bottomNavLabel}>Заказы</Text>
            {pathname === '/(user)/orders' && <View style={styles.bottomNavIndicator} />}
          </View>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={() => router.push('/(user)/profile' as any)}
          activeOpacity={0.7}
        >
          <View style={styles.bottomNavContent}>
            <View style={pathname === '/(user)/profile' ? styles.bottomNavIconActive : styles.bottomNavIcon}>
              <Ionicons name="person" size={20} color={pathname === '/(user)/profile' ? '#FFFFFF' : '#9CA3AF'} />
            </View>
            <Text style={pathname === '/(user)/profile' ? styles.bottomNavLabelActive : styles.bottomNavLabel}>Профиль</Text>
            {pathname === '/(user)/profile' && <View style={styles.bottomNavIndicator} />}
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
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: 0,
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
    paddingTop: 16,
    paddingBottom: 12,
    gap: 11,
  },
  welcomeText: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: 0,
    lineHeight: 21.78,
  },
  welcomeSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  segmentContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  segmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 13,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 175,
  },
  segmentButtonActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E5E7EB',
  },
  segmentIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    lineHeight: 15.73,
  },
  segmentTextActive: {
    color: '#111827',
  },
  subscriptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 17,
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
    width: 44,
    height: 44,
    borderRadius: 24,
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
    fontWeight: '500',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  subscriptionLink: {
    fontSize: 16,
    fontWeight: '400',
    color: '#111827',
    lineHeight: 19.36,
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
    borderRadius: 24,
    padding: 11,
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
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
    marginBottom: 8,
    lineHeight: 16.94,
  },
  serviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 13,
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
    width: 44,
    height: 44,
    borderRadius: 24,
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
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  serviceButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    lineHeight: 14.52,
  },
  orderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 13,
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
    width: 40.73,
    height: 44,
    borderRadius: 24,
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
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
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
    borderRadius: 24,
    padding: 13,
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
    width: 44,
    height: 44,
    borderRadius: 24,
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
