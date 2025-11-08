import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { API_URL } from '../../../config/api';
import { getHeaders } from '../../../config/fetch';
import { useAuth } from '../../../lib/AuthContext';
import { getCachedOrFetch } from '../../../lib/cache';
import { rateLimitedFetch } from '../../../lib/rateLimiter';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Order {
  order_id: number;
  order_number?: string;
  plan_name: string;
  provider_name: string;
  provider_country?: string;
  total_price?: number;
  amount?: number;
  currency_code?: string;
  currency?: string;
  status: string;
  payment_status?: string;
  cpu_cores?: number;
  memory_gb?: number;
  storage_gb?: number;
  bandwidth_tb?: number;
  created_at: string;
  updated_at?: string;
}

type FilterType = 'active' | 'pending' | 'history';

const OrdersScreen = React.memo(function OrdersScreen() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('active');

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async (forceRefresh = false) => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      // Загрузить заказы с кешированием и rate limiting
      const data = await getCachedOrFetch(
        'user_orders',
        () => rateLimitedFetch('user_orders', async () => {
          const response = await fetch(`${API_URL}/api/orders`, {
            headers: getHeaders(token || undefined),
          });
          return await response.json();
        }),
        forceRefresh
      );

      if (data && data.success) {
        setOrders(data.data || []);
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
    loadOrders(true); // Принудительное обновление
  };

  // Фильтрация заказов
  const filteredOrders = orders.filter(order => {
    // Фильтр по статусу
    let matchesFilter = false;
    if (filter === 'active') {
      matchesFilter = order.status === 'active' && order.payment_status === 'completed';
    } else if (filter === 'pending') {
      matchesFilter = order.status === 'pending' || order.payment_status === 'pending';
    } else if (filter === 'history') {
      matchesFilter = order.payment_status === 'completed' && order.status !== 'active';
    }

    // Поиск по номеру заказа, названию плана или провайдеру
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      order.order_number?.toLowerCase().includes(searchLower) ||
      order.plan_name?.toLowerCase().includes(searchLower) ||
      order.provider_name?.toLowerCase().includes(searchLower);

    return matchesFilter && matchesSearch;
  });

  const getOrderPrice = (order: Order) => {
    return order.total_price || order.amount || 0;
  };

  const getOrderCurrency = (order: Order) => {
    return (order.currency_code || order.currency || 'UZS').toUpperCase();
  };

  const formatOrderPrice = (order: Order) => {
    const amount = getOrderPrice(order);
    const currency = getOrderCurrency(order);

    if (!amount) {
      return '0 сум';
    }

    if (currency === 'USD') {
      return `$${amount.toFixed(2)}`;
    }

    try {
      const formatted = new Intl.NumberFormat('ru-RU').format(amount);
      return `${formatted} сум`;
    } catch (error) {
      return `${amount.toLocaleString('ru-RU')} сум`;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleDateString('ru-RU', { month: 'long' });
    return `${day} ${month}`;
  };

  const handlePayOrder = (order: Order) => {
    router.push(`/checkout?order_id=${order.order_id}` as any);
  };

  const handleManageOrder = (order: Order) => {
    // Навигация к деталям заказа или управлению
    router.push(`/(user)/orders/${order.order_id}` as any);
  };

  // Компонент карточки заказа с анимацией
  const OrderCard = React.memo(({ item, index, filterType }: { item: Order; index: number; filterType: FilterType }) => {
    const cardAnim = React.useRef(new Animated.Value(0)).current;
    const scaleAnim = React.useRef(new Animated.Value(1)).current;
    
    React.useEffect(() => {
      Animated.parallel([
        Animated.timing(cardAnim, {
          toValue: 1,
          duration: 400,
          delay: index * 50,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          delay: index * 50,
          tension: 50,
          friction: 7,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }, []);
    
    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.98,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    };
    
    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    };
    
    const opacity = cardAnim;
    const translateY = cardAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [20, 0],
    });

    const isActive = filterType === 'active';
    const isPending = filterType === 'pending';
    const isHistory = filterType === 'history';
    const priceLabel = formatOrderPrice(item);
    const orderNumber = item.order_number || `A-${item.order_id.toString().padStart(5, '0')}`;

    return (
      <Animated.View
        style={{
          opacity,
          transform: [{ translateY }, { scale: scaleAnim }],
        }}
      >
        <View style={styles.orderCard}>
          <View style={styles.orderCardContent}>
            <View style={styles.orderCardLeft}>
              <View style={styles.orderIconContainer}>
                <Ionicons 
                  name={isActive ? 'server' : isPending ? 'time-outline' : 'checkmark-circle'} 
                  size={18} 
                  color="#111827" 
                />
              </View>
              <View style={styles.orderInfo}>
                <Text style={styles.orderTitle}>
                  {isHistory ? `Оплачено: ${item.plan_name}` : item.plan_name}
                </Text>
                <View style={styles.orderMeta}>
                  {isActive && (
                    <Text style={styles.orderMetaText}>
                      Uptime 99.9% • Load 22% • Активен
                    </Text>
                  )}
                  {isPending && (
                    <Text style={styles.orderMetaText}>
                      Счет #{orderNumber} • Создан: {formatDate(item.created_at)}
                    </Text>
                  )}
                  {isHistory && (
                    <Text style={styles.orderMetaText}>
                      Счет #{orderNumber} • {formatDate(item.created_at)} 2025
                    </Text>
                  )}
                </View>
                {isActive && (
                  <View style={styles.orderTags}>
                    {item.storage_gb && (
                      <View style={styles.tag}>
                        <Ionicons name="shield-outline" size={14} color="#374151" />
                        <Text style={styles.tagText}>DDoS</Text>
                      </View>
                    )}
                    {item.storage_gb && (
                      <View style={styles.tag}>
                        <Ionicons name="hardware-chip-outline" size={14} color="#374151" />
                        <Text style={styles.tagText}>{item.storage_gb} GB SSD</Text>
                      </View>
                    )}
                    {item.cpu_cores && (
                      <View style={styles.tag}>
                        <Ionicons name="server-outline" size={14} color="#374151" />
                        <Text style={styles.tagText}>{item.cpu_cores} vCPU</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
            <View style={styles.orderCardRight}>
              <Text style={styles.orderPrice}>
                {priceLabel}{isActive ? ' / мес' : ''}
              </Text>
              {isHistory ? (
                <TouchableOpacity
                  style={styles.orderButtonVertical}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  activeOpacity={0.8}
                >
                  <Ionicons name="download-outline" size={16} color="#374151" />
                  <View style={styles.orderButtonTextVertical}>
                    <Text style={styles.orderButtonText}>Скачать</Text>
                    <Text style={styles.orderButtonText}>чек</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.orderButton,
                    isPending && styles.orderButtonPrimary
                  ]}
                  onPressIn={handlePressIn}
                  onPressOut={handlePressOut}
                  onPress={() => {
                    if (isPending) {
                      handlePayOrder(item);
                    } else if (isActive) {
                      handleManageOrder(item);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  {isPending ? (
                    <>
                      <Ionicons name="card-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.orderButtonTextPrimary}>Оплатить</Text>
                    </>
                  ) : (
                    <>
                      <Ionicons name="settings-outline" size={16} color="#374151" />
                      <Text style={styles.orderButtonText}>Управлять</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
          <View style={styles.orderDivider} />
          <View style={styles.orderFooter}>
            {isActive && (
              <Text style={styles.orderFooterText}>
                ID #{orderNumber} • Следующее списание: {formatDate(item.created_at)}
              </Text>
            )}
            {isPending && (
              <Text style={styles.orderFooterText}>
                Доступно к оплате в течение 1 часа
              </Text>
            )}
          </View>
        </View>
      </Animated.View>
    );
  });

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Заказы</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        removeClippedSubviews={true}
        directionalLockEnabled={true}
        nestedScrollEnabled={true}
        bounces={Platform.OS === 'ios'}
        overScrollMode="never"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#4F46E5']} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Ваши заказы</Text>
          <Text style={styles.welcomeSubtitle}>История покупок и активные услуги</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Поиск по номеру заказа, сервису..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filter Tabs */}
        {filter === 'active' && (
          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>Активные</Text>
          </View>
        )}
        {filter === 'pending' && (
          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>Ожидают оплаты</Text>
          </View>
        )}
        {filter === 'history' && (
          <View style={styles.filterSection}>
            <Text style={styles.filterTitle}>История</Text>
          </View>
        )}

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cart-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>
              {filter === 'active' && 'У вас нет активных заказов'}
              {filter === 'pending' && 'Нет заказов, ожидающих оплаты'}
              {filter === 'history' && 'История заказов пуста'}
            </Text>
          </View>
        ) : (
          <View style={styles.ordersList}>
            {filteredOrders.map((order, index) => (
              <OrderCard key={order.order_id} item={order} index={index} filterType={filter} />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'active' && styles.filterTabActive]}
          onPress={() => setFilter('active')}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterTabText, filter === 'active' && styles.filterTabTextActive]}>
            Активные
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'pending' && styles.filterTabActive]}
          onPress={() => setFilter('pending')}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterTabText, filter === 'pending' && styles.filterTabTextActive]}>
            Ожидают оплаты
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'history' && styles.filterTabActive]}
          onPress={() => setFilter('history')}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterTabText, filter === 'history' && styles.filterTabTextActive]}>
            История
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

export default OrdersScreen;

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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 21.78,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  welcomeSection: {
    marginBottom: 12,
    gap: 4,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 21.78,
  },
  welcomeSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: '400',
    color: '#111827',
    lineHeight: 14.52,
  },
  filterSection: {
    marginTop: 12,
    marginBottom: 8,
  },
  filterTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
    lineHeight: 16.94,
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 9,
    paddingBottom: 10,
    paddingHorizontal: 8,
    justifyContent: 'center',
    gap: 6,
  },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    minWidth: 89,
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#4F46E5',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  filterTabTextActive: {
    color: '#EEF2FF',
  },
  ordersList: {
    gap: 8,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    marginTop: 16,
    lineHeight: 14.52,
    textAlign: 'center',
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 13,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 4,
  },
  orderCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  orderCardLeft: {
    flexDirection: 'row',
    gap: 10,
    flex: 1,
  },
  orderIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 2,
  },
  orderMeta: {
    marginBottom: 8,
  },
  orderMetaText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  orderTags: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    paddingHorizontal: 11,
    paddingVertical: 7,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    lineHeight: 14.52,
  },
  orderCardRight: {
    alignItems: 'flex-end',
    gap: 8,
    justifyContent: 'flex-start',
  },
  orderPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 16.94,
  },
  orderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    paddingHorizontal: 13,
    paddingVertical: 11,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 115,
  },
  orderButtonPrimary: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  orderButtonVertical: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 24,
    paddingHorizontal: 13,
    paddingVertical: 11,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: 115,
    height: 56,
  },
  orderButtonTextVertical: {
    alignItems: 'center',
    gap: 0,
  },
  orderButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    lineHeight: 16.94,
    textAlign: 'center',
  },
  orderButtonTextPrimary: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 16.94,
    textAlign: 'center',
  },
  orderDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  orderFooter: {
    paddingTop: 0,
  },
  orderFooterText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
});
