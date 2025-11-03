import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { API_URL } from '../../config/api';
import { useAuth } from '../../lib/AuthContext';

// Helper function to add required headers for ngrok
const getHeaders = (token?: string) => {
  const headers: Record<string, string> = {
    'ngrok-skip-browser-warning': 'true',
    'User-Agent': 'VPSBilling-Admin',
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

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

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { user: authUser, signOut } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSegment, setActiveSegment] = useState<'servers' | 'storage'>('servers');

  useEffect(() => {
    if (authUser) {
      if (authUser.role !== 'admin') {
        Alert.alert('Доступ запрещен', 'У вас нет прав администратора');
        router.replace('/auth/login');
        return;
      }
      setUser(authUser);
    }
    loadDashboardData();
  }, [authUser]);

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
        headers: getHeaders(token),
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
      console.error('Logout error:', error);
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
        return '#7A7A7A';
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
        <ActivityIndicator size="large" color="#5B5AFD" />
      </View>
    );
  }

  const userName = user?.full_name?.split(' ')[0] || 'Пользователь';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.menuButton} onPress={() => {}}>
            <Ionicons name="reorder-three-outline" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Главная</Text>
          <TouchableOpacity style={styles.profileButton} onPress={handleLogout}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={20} color="#5B5AFD" />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#5B5AFD']} />
        }
      >
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeText}>
            <Text style={styles.welcomeTitle}>Добро пожаловать, {userName}</Text>
            <Text style={styles.welcomeSubtitle}>Управляйте подключёнными сервисами и заказами</Text>
          </View>
          <View style={styles.avatarLarge}>
            <Ionicons name="person" size={32} color="#5B5AFD" />
          </View>
        </View>

        {/* Segment Control */}
        <View style={styles.segmentContainer}>
          <TouchableOpacity
            style={[styles.segmentButton, activeSegment === 'servers' && styles.segmentButtonActive]}
            onPress={() => setActiveSegment('servers')}
            activeOpacity={0.7}
          >
            <Text style={[styles.segmentText, activeSegment === 'servers' && styles.segmentTextActive]}>
              Мои серверы
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentButton, activeSegment === 'storage' && styles.segmentButtonActive]}
            onPress={() => setActiveSegment('storage')}
            activeOpacity={0.7}
          >
            <Text style={[styles.segmentText, activeSegment === 'storage' && styles.segmentTextActive]}>
              Моё хранилище
            </Text>
          </TouchableOpacity>
        </View>

        {/* Subscription Card */}
        <View style={styles.subscriptionCard}>
          <View style={styles.subscriptionHeader}>
            <Text style={styles.subscriptionTitle}>Подписка Pro — помесячно</Text>
            <TouchableOpacity>
              <Text style={styles.subscriptionLink}>Изменить план</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.subscriptionStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{activeServices}</Text>
              <Text style={styles.statLabel}>Активные сервисы</Text>
            </View>
            <View style={styles.statDivider} />
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
            <View style={styles.serviceIconContainer}>
              <Ionicons name="server" size={24} color="#5B5AFD" />
            </View>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>Серверы</Text>
              <Text style={styles.serviceDescription}>
                {activeServices} активных • средняя загрузка 28%
              </Text>
            </View>
            <TouchableOpacity style={styles.serviceButton}>
              <Text style={styles.serviceButtonText}>Открыть</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.serviceCard}>
            <View style={styles.serviceIconContainer}>
              <Ionicons name="cloud" size={24} color="#5B5AFD" />
            </View>
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>Объектное хранилище</Text>
              <Text style={styles.serviceDescription}>1 бакет • 40 ГБ</Text>
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
                <View style={styles.orderIconContainer}>
                  <Ionicons name="document-text" size={20} color="#5B5AFD" />
                </View>
                <View style={styles.orderInfo}>
                  <Text style={styles.orderTitle}>{order.plan_name}</Text>
                  <Text style={styles.orderSubtitle}>
                    Заказ №{order.order_number || order.order_id} • {formatTimeAgo(order.created_at)}
                  </Text>
                </View>
                <View style={[styles.orderStatusBadge, { backgroundColor: getStatusColor(order.status || order.payment_status || 'pending') }]}>
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
            <View style={styles.supportIconContainer}>
              <Ionicons name="chatbubble-ellipses" size={24} color="#5B5AFD" />
            </View>
            <View style={styles.supportInfo}>
              <Text style={styles.supportTitle}>Открыть тикет</Text>
              <Text style={styles.supportDescription}>Поможем решить вопрос</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#7A7A7A" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.supportCard}>
            <View style={styles.supportIconContainer}>
              <Ionicons name="receipt" size={24} color="#5B5AFD" />
            </View>
            <View style={styles.supportInfo}>
              <Text style={styles.supportTitle}>Оплата и счета</Text>
              <Text style={styles.supportDescription}>Способы оплаты и история</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#7A7A7A" />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.bottomNavItem}>
          <View style={styles.bottomNavIconActive}>
            <Ionicons name="home" size={24} color="#5B5AFD" />
          </View>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={() => router.push('/(user)/home')}
        >
          <Ionicons name="grid" size={24} color="#7A7A7A" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={() => router.push('/(user)/orders')}
        >
          <Ionicons name="cart" size={24} color="#7A7A7A" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={handleLogout}
        >
          <Ionicons name="person" size={24} color="#7A7A7A" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FB',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    fontFamily: Platform.OS === 'ios' ? '-apple-system, BlinkMacSystemFont, "SF Pro Display"' : 'Roboto, sans-serif',
    letterSpacing: -0.3,
  },
  profileButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0F0FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F0F0FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  welcomeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  welcomeText: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? '-apple-system, BlinkMacSystemFont, "SF Pro Display"' : 'Roboto, sans-serif',
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#7A7A7A',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
    lineHeight: 20,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#5B5AFD',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7A7A7A',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  subscriptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  subscriptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  subscriptionLink: {
    fontSize: 14,
    fontWeight: '500',
    color: '#5B5AFD',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  subscriptionStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  statLabel: {
    fontSize: 12,
    color: '#7A7A7A',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 20,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? '-apple-system, BlinkMacSystemFont, "SF Pro Display"' : 'Roboto, sans-serif',
    letterSpacing: -0.3,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  serviceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  serviceDescription: {
    fontSize: 14,
    color: '#7A7A7A',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  serviceButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#5B5AFD',
  },
  serviceButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  orderIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  orderSubtitle: {
    fontSize: 12,
    color: '#7A7A7A',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  orderStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  orderStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#7A7A7A',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  supportIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  supportInfo: {
    flex: 1,
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  supportDescription: {
    fontSize: 14,
    color: '#7A7A7A',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  bottomSpacer: {
    height: 20,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    paddingHorizontal: 20,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  bottomNavIconActive: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F0FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#5B5AFD',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
});
