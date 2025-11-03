import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
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
        <ActivityIndicator size="large" color="#6366F1" />
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
            <Text style={styles.browseButtonText}>Выбрать VPS план</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          renderItem={renderOrderCard}
          keyExtractor={(item, index) => item?.order_id?.toString() || `order-${index}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#6366F1']} />
          }
        />
      )}

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={() => router.replace('/(user)/home')}
          activeOpacity={0.7}
        >
          <Ionicons name="home-outline" size={24} color="#9CA3AF" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={() => {}}
          activeOpacity={0.7}
        >
          <Ionicons name="cart" size={24} color="#6366F1" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={() => {}}
          activeOpacity={0.7}
        >
          <Ionicons name="person-outline" size={24} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 24,
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#111827',
    fontFamily: Platform.OS === 'ios' ? '-apple-system, BlinkMacSystemFont, "SF Pro Display"' : 'Roboto, sans-serif',
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#94A3B8',
    marginTop: 20,
    marginBottom: 24,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  browseButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  browseButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
    letterSpacing: 0.2,
  },
  listContent: {
    padding: 20,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  planName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? '-apple-system, BlinkMacSystemFont, "SF Pro Display"' : 'Roboto, sans-serif',
    letterSpacing: -0.3,
  },
  providerName: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  orderDetails: {
    flexDirection: 'row',
    gap: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  // Bottom Navigation
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  bottomNavLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6366F1',
    fontFamily: Platform.OS === 'ios' ? '-apple-system, BlinkMacSystemFont, "SF Pro Display"' : 'Roboto, sans-serif',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  bottomNavLabelInactive: {
    color: '#9CA3AF',
    fontWeight: '500',
  },
});
