import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { API_URL } from '../../config/api';
import { getHeaders } from '../../config/fetch';
import { useAuth } from '../../lib/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Order {
  order_id: number;
  plan_name: string;
  provider_name: string;
  amount: number;
  currency: string;
  status: string;
  payment_status: string;
  created_at: string;
}

export default function OrdersScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut();
      router.replace('/auth/login');
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось выйти. Попробуйте еще раз.');
    }
  };
  
  // Анимации
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  
  // Анимация появления контента
  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
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

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/orders`, {
        headers: getHeaders(token || undefined),
      });

      const data = await response.json();
      if (data.success) {
        setOrders(data.data);
      }
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#4caf50';
      case 'pending':
        return '#ff9800';
      case 'cancelled':
        return '#f44336';
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

  // Компонент карточки заказа с анимацией
  const OrderCard = React.memo(({ item, index }: { item: Order; index: number }) => {
    const cardAnim = React.useRef(new Animated.Value(0)).current;
    const scaleAnim = React.useRef(new Animated.Value(1)).current;
    
    React.useEffect(() => {
      Animated.parallel([
        Animated.timing(cardAnim, {
          toValue: 1,
          duration: 400,
          delay: index * 50,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          delay: index * 50,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }, []);
    
    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.98,
        useNativeDriver: true,
      }).start();
    };
    
    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    };
    
    const opacity = cardAnim;
    const translateY = cardAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [20, 0],
    });
    
    return (
      <Animated.View
        style={{
          opacity,
          transform: [{ translateY }, { scale: scaleAnim }],
        }}
      >
        <TouchableOpacity 
          style={styles.orderCard} 
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.9}
        >
      <View style={styles.orderHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.planName}>{item.plan_name}</Text>
          <Text style={styles.providerName}>{item.provider_name}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
        </View>
      </View>

      <View style={styles.orderDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={16} color="#666" />
          <Text style={styles.detailText}>
            {new Date(item.created_at).toLocaleDateString('ru-RU')}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="cash-outline" size={16} color="#666" />
          <Text style={styles.detailText}>
            {item.amount} {item.currency}
          </Text>
        </View>
      </View>
        </TouchableOpacity>
      </Animated.View>
    );
  });

  // Функция рендеринга для FlatList
  const renderOrderCard = ({ item, index }: { item: Order; index: number }) => (
    <OrderCard item={item} index={index} />
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }
      ]}
    >
      {/* Professional Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Мои заказы</Text>
      </View>

      {orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyText}>У вас пока нет заказов</Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => router.replace('/(user)/home')}
          >
            <Text style={styles.browseButtonText}>Выбрать сервис</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderCard}
          keyExtractor={(item, index) => item?.order_id?.toString() || `order-${index}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#4F46E5']} />
          }
        />
      )}

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
    </Animated.View>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: 0,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#F9FAFB',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 16,
    marginBottom: 24,
    fontWeight: '500',
    lineHeight: 14.52,
  },
  browseButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  browseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: 0,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 13,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  planName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    lineHeight: 16.94,
    flex: 1,
  },
  providerName: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
    lineHeight: 14.52,
  },
  statusBadge: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  orderDetails: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
    lineHeight: 14.52,
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
