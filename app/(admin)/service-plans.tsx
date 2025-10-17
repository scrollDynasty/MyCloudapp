import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { API_URL } from '../../config/api';

// Helper function to add required headers
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
  fields_count: number;
  group_name_uz: string;
  group_name_ru: string;
  created_at: string;
  updated_at: string;
}

export default function ServicePlansScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const groupId = params.group_id as string;
  const groupName = params.group_name as string;

  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (groupId) {
      loadPlans();
    }
  }, [groupId]);

  const loadPlans = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/api/service-plans-admin?group_id=${groupId}&_t=${Date.now()}`, 
        {
          headers: getHeaders(token || undefined),
          cache: 'no-store',
        }
      );

      const data = await response.json();
      if (data.success) {
        setPlans(data.data);
      }
    } catch (error) {
      console.error('Error loading plans:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadPlans();
  };

  const handleDelete = async (plan: ServicePlan) => {
    const confirmDelete = Platform.OS === 'web' 
      ? window.confirm(`Вы уверены, что хотите удалить "${plan.name_ru}"?`)
      : await new Promise((resolve) => {
          Alert.alert(
            'Удалить тариф',
            `Вы уверены, что хотите удалить "${plan.name_ru}"?`,
            [
              { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Удалить', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmDelete) return;

    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/service-plans-admin/${plan.id}`, {
        method: 'DELETE',
        headers: getHeaders(token || undefined),
      });

      const data = await response.json();
      
      if (data.success) {
        if (Platform.OS === 'web') {
          alert('Тариф успешно удален');
        } else {
          Alert.alert('Успешно', 'Тариф удален');
        }
        loadPlans();
      } else {
        if (Platform.OS === 'web') {
          alert('Ошибка: ' + (data.error || 'Не удалось удалить тариф'));
        } else {
          Alert.alert('Ошибка', data.error || 'Не удалось удалить тариф');
        }
      }
    } catch (error) {
      console.error('Delete error:', error);
      if (Platform.OS === 'web') {
        alert('Ошибка при удалении тарифа');
      } else {
        Alert.alert('Ошибка', 'Не удалось удалить тариф');
      }
    }
  };

  const toggleActive = async (plan: ServicePlan) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/service-plans-admin/${plan.id}`, {
        method: 'PUT',
        headers: getHeaders(token || undefined),
        body: JSON.stringify({
          is_active: !plan.is_active,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        loadPlans();
      }
    } catch (error) {
      console.error('Toggle error:', error);
    }
  };

  const formatPrice = (price: number, discountPrice?: number, currency: string = 'UZS') => {
    const formatNumber = (num: number) => {
      return new Intl.NumberFormat('ru-RU').format(num);
    };

    if (discountPrice && discountPrice < price) {
      return (
        <View style={styles.priceContainer}>
          <Text style={styles.oldPrice}>{formatNumber(price)}</Text>
          <Text style={styles.price}>{formatNumber(discountPrice)} {currency}</Text>
        </View>
      );
    }

    return <Text style={styles.price}>{formatNumber(price)} {currency}</Text>;
  };

  const getBillingPeriodLabel = (period: string) => {
    switch (period) {
      case 'monthly': return '/месяц';
      case 'yearly': return '/год';
      case 'once': return '';
      default: return `/${period}`;
    }
  };

  const renderPlanCard = ({ item }: { item: ServicePlan }) => {
    return (
      <View style={styles.planCard}>
        <View style={styles.planHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.planName}>{item.name_ru}</Text>
            <Text style={styles.planNameUz}>{item.name_uz}</Text>
            <View style={styles.priceRow}>
              {formatPrice(item.price, item.discount_price, item.currency)}
              <Text style={styles.billingPeriod}>
                {getBillingPeriodLabel(item.billing_period)}
              </Text>
            </View>
            <Text style={styles.fieldsCount}>📋 Характеристик: {item.fields_count}</Text>
          </View>
          <TouchableOpacity
            style={[styles.activeBadge, { backgroundColor: item.is_active ? '#4caf50' : '#f44336' }]}
            onPress={() => toggleActive(item)}
          >
            <Text style={styles.activeText}>
              {item.is_active ? 'Активен' : 'Неактивен'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.planFooter}>
          <Text style={styles.orderText}>Порядок: {item.display_order}</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push(`/(admin)/service-plan-form?id=${item.id}&group_id=${groupId}`)}
            >
              <Ionicons name="create-outline" size={20} color="#667eea" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDelete(item)}
            >
              <Ionicons name="trash-outline" size={20} color="#f44336" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Тарифы</Text>
          <Text style={styles.headerSubtitle}>{groupName || 'Группа'}</Text>
        </View>
        <TouchableOpacity 
          onPress={() => router.push(`/(admin)/service-plan-form?group_id=${groupId}`)} 
          style={styles.addButton}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Plans List */}
      <FlatList
        data={plans}
        renderItem={renderPlanCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#667eea']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="pricetags-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Нет тарифов</Text>
            <Text style={styles.emptySubtext}>Создайте первый тариф</Text>
          </View>
        }
      />
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
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#e0e0ff',
    marginTop: 2,
  },
  addButton: {
    padding: 4,
  },
  listContent: {
    padding: 16,
  },
  planCard: {
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
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  planName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  planNameUz: {
    fontSize: 14,
    color: '#667eea',
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4caf50',
  },
  oldPrice: {
    fontSize: 16,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  billingPeriod: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  fieldsCount: {
    fontSize: 12,
    color: '#666',
  },
  activeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  activeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  planFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  orderText: {
    fontSize: 12,
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    padding: 8,
  },
  deleteButton: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 4,
  },
});
