import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

const API_URL = 'http://localhost:5000';

interface AdminUser {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
  company_name?: string;
  phone?: string;
  created_at: string;
}

interface User {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
  company_name?: string;
}

interface Order {
  order_id: number;
  user_id: number;
  full_name: string;
  plan_name: string;
  provider_name: string;
  total_price: number;
  currency_code: string;
  status: string;
  created_at: string;
}

interface Stats {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { user: authUser, signOut } = useAuth();
  const [admin, setAdmin] = useState<User | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'orders' | 'stats'>('stats');

  useEffect(() => {
    if (authUser) {
      if (authUser.role !== 'admin') {
        Alert.alert('Доступ запрещен', 'У вас нет прав администратора');
        router.replace('/auth/login');
        return;
      }
      setAdmin(authUser);
    }
    loadDashboardData();
  }, [authUser]);

  const loadDashboardData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');

      // Загрузить пользователей
      const usersResponse = await fetch(`${API_URL}/api/auth/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const usersData = await usersResponse.json();

      // Загрузить заказы
      const ordersResponse = await fetch(`${API_URL}/api/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const ordersData = await ordersResponse.json();

      // Безопасная установка пользователей
      if (usersData.success && Array.isArray(usersData.data)) {
        setUsers(usersData.data);
      } else {
        setUsers([]);
      }

      if (ordersData.success && Array.isArray(ordersData.data)) {
        setOrders(ordersData.data || []);
        
        // Рассчитать статистику
        const totalRevenue = (ordersData.data || [])
          .filter((o: Order) => o.status === 'active' && o.total_price != null)
          .reduce((sum: number, o: Order) => {
            const price = o.total_price != null ? parseFloat(o.total_price.toString()) : 0;
            return sum + (isNaN(price) ? 0 : price);
          }, 0);
        
        const pendingOrders = (ordersData.data || []).filter((o: Order) => o.status === 'pending').length;

        setStats({
          totalUsers: (usersData.data || []).length,
          totalOrders: (ordersData.data || []).length,
          totalRevenue,
          pendingOrders,
        });
      } else {
        // If orders fetch failed, still set empty data and stats
        setOrders([]);
        setStats({
          totalUsers: (usersData.data || []).length,
          totalOrders: 0,
          totalRevenue: 0,
          pendingOrders: 0,
        });
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      // Установить пустые данные при ошибке
      setUsers([]);
      setOrders([]);
      setStats({
        totalUsers: 0,
        totalOrders: 0,
        totalRevenue: 0,
        pendingOrders: 0,
      });
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
      console.log('🔘 Admin logout button clicked!');
      console.log('🔓 Starting admin logout process...');
      
      // Используем signOut из AuthContext
      await signOut();
      console.log('✅ Admin signOut completed');
      
      // Перенаправляем на логин
      console.log('🔄 Navigating to login...');
      router.replace('/auth/login');
      console.log('✅ Navigation completed');
    } catch (error) {
      console.error('❌ Logout error:', error);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return '#d32f2f';
      case 'legal_entity':
        return '#1976d2';
      default:
        return '#388e3c';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Администратор';
      case 'legal_entity':
        return 'Юр. лицо';
      default:
        return 'Физ. лицо';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#4caf50';
      case 'pending':
        return '#ff9800';
      case 'cancelled':
        return '#f44336';
      case 'suspended':
        return '#9e9e9e';
      default:
        return '#757575';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Активен';
      case 'pending':
        return 'В ожидании';
      case 'cancelled':
        return 'Отменен';
      case 'suspended':
        return 'Приостановлен';
      default:
        return status;
    }
  };

  const renderUserCard = ({ item }: { item: AdminUser }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardTitle}>{item.full_name}</Text>
          <Text style={styles.cardSubtitle}>{item.email}</Text>
          {item.company_name && (
            <Text style={styles.companyText}>🏢 {item.company_name}</Text>
          )}
        </View>
        <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(item.role) }]}>
          <Text style={styles.roleBadgeText}>{getRoleLabel(item.role)}</Text>
        </View>
      </View>
      {item.phone && (
        <Text style={styles.phoneText}>📱 {item.phone}</Text>
      )}
      <Text style={styles.dateText}>
        Зарегистрирован: {new Date(item.created_at).toLocaleDateString('ru-RU')}
      </Text>
    </View>
  );

  const renderOrderCard = ({ item }: { item: Order }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.plan_name}</Text>
          <Text style={styles.cardSubtitle}>{item.provider_name}</Text>
          <Text style={styles.userNameText}>👤 {item.full_name}</Text>
        </View>
        <View>
          <Text style={styles.priceText}>
            {item.total_price} {item.currency_code}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusBadgeText}>{getStatusLabel(item.status)}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.dateText}>
        Создан: {new Date(item.created_at).toLocaleDateString('ru-RU')}
      </Text>
    </View>
  );

  const renderStatsCard = (title: string, value: string | number, icon: string, color: string) => (
    <View style={[styles.statsCard, { borderLeftColor: color }]}>
      <View style={styles.statsIconContainer}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <View style={styles.statsTextContainer}>
        <Text style={styles.statsValue}>{value}</Text>
        <Text style={styles.statsTitle}>{title}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Панель управления</Text>
          <Text style={styles.userName}>{admin?.full_name || 'Администратор'}</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#d32f2f" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stats' && styles.tabActive]}
          onPress={() => setActiveTab('stats')}
        >
          <Ionicons 
            name="stats-chart" 
            size={20} 
            color={activeTab === 'stats' ? '#667eea' : '#999'} 
          />
          <Text style={[styles.tabText, activeTab === 'stats' && styles.tabTextActive]}>
            Статистика
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'users' && styles.tabActive]}
          onPress={() => setActiveTab('users')}
        >
          <Ionicons 
            name="people" 
            size={20} 
            color={activeTab === 'users' ? '#667eea' : '#999'} 
          />
          <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>
            Пользователи
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'orders' && styles.tabActive]}
          onPress={() => setActiveTab('orders')}
        >
          <Ionicons 
            name="cart" 
            size={20} 
            color={activeTab === 'orders' ? '#667eea' : '#999'} 
          />
          <Text style={[styles.tabText, activeTab === 'orders' && styles.tabTextActive]}>
            Заказы
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'stats' && stats && (
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#667eea']} />
          }
        >
          <View style={styles.statsGrid}>
            {renderStatsCard('Всего пользователей', stats.totalUsers, 'people', '#667eea')}
            {renderStatsCard('Всего заказов', stats.totalOrders, 'cart', '#4caf50')}
            {renderStatsCard('Выручка (UZS)', stats.totalRevenue.toFixed(2), 'cash', '#ff9800')}
            {renderStatsCard('Ожидают оплаты', stats.pendingOrders, 'time', '#f44336')}
          </View>
        </ScrollView>
      )}

      {activeTab === 'users' && (
        <FlatList
          data={users}
          renderItem={renderUserCard}
          keyExtractor={(item, index) => item?.user_id?.toString() || `user-${index}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#667eea']} />
          }
        />
      )}

      {activeTab === 'orders' && (
        <FlatList
          data={orders}
          renderItem={renderOrderCard}
          keyExtractor={(item, index) => item?.order_id?.toString() || `order-${index}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#667eea']} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#667eea',
    padding: 20,
    paddingTop: 60,
  },
  greeting: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
  },
  logoutButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#f0f0ff',
  },
  tabText: {
    fontSize: 14,
    color: '#999',
    marginLeft: 6,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#667eea',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  statsGrid: {
    padding: 16,
    gap: 12,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statsIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statsTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  statsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statsTitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  companyText: {
    fontSize: 13,
    color: '#667eea',
    marginTop: 4,
  },
  userNameText: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  phoneText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#999',
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  priceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'right',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-end',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
});