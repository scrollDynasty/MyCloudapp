import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
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

export default function ServiceGroupDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user: authUser } = useAuth();
  const groupId = params.groupId as string;
  const groupName = params.groupName as string;

  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPlans();
  }, [groupId]);

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
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      
      const userId = authUser?.user_id;
      
      if (!userId) {
        Alert.alert('Ошибка', 'Не удалось определить пользователя');
        return;
      }

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
        router.push({
          pathname: '/(user)/checkout',
          params: { orderId: data.data.id },
        });
      } else {
        Alert.alert('Ошибка', data.error || 'Не удалось создать заказ');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      Alert.alert('Ошибка', 'Не удалось создать заказ');
    } finally {
      setLoading(false);
    }
  };

  const getBillingPeriodText = (period: string) => {
    switch (period) {
      case 'monthly':
        return '/месяц';
      case 'yearly':
        return '/год';
      case 'quarterly':
        return '/квартал';
      case 'weekly':
        return '/неделя';
      case 'one_time':
        return 'разово';
      default:
        return '';
    }
  };

  const renderPlanCard = ({ item }: { item: ServicePlan }) => {
    const hasDiscount = item.discount_price && item.discount_price < item.price;
    const displayPrice = hasDiscount ? item.discount_price : item.price;

    return (
      <TouchableOpacity
        style={styles.planCard}
        onPress={() => handleOrderPlan(item)}
        activeOpacity={0.7}
      >
        {hasDiscount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>
              -{Math.round(((item.price - item.discount_price!) / item.price) * 100)}%
            </Text>
          </View>
        )}

        <View style={styles.planHeader}>
          <Text style={styles.planName}>{item.name_ru}</Text>
          {item.description_ru && (
            <Text style={styles.planDescription} numberOfLines={2}>
              {item.description_ru}
            </Text>
          )}
        </View>

        {/* Characteristics */}
        {item.fields && item.fields.length > 0 && (
          <View style={styles.fieldsContainer}>
            {item.fields.map((field, index) => (
              <View key={index} style={styles.fieldRow}>
                <View style={styles.fieldIcon}>
                  <Ionicons name="checkmark-circle" size={16} color="#3B82F6" />
                </View>
                <View style={styles.fieldContent}>
                  <Text style={styles.fieldLabel}>{field.field_label_ru}</Text>
                  {field.field_value_ru && (
                    <Text style={styles.fieldValue}>{field.field_value_ru}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.priceContainer}>
          {hasDiscount && (
            <Text style={styles.originalPrice}>
              {item.price} {item.currency}
            </Text>
          )}
          <View style={styles.currentPriceRow}>
            <Text style={styles.priceText}>
              {displayPrice} {item.currency}
            </Text>
            <Text style={styles.priceLabel}>
              {getBillingPeriodText(item.billing_period)}
            </Text>
          </View>
        </View>

        <View style={styles.orderButtonContainer}>
          <LinearGradient
            colors={['#3B82F6', '#2563EB', '#1D4ED8']}
            style={styles.orderButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.orderButtonText}>Оформить заказ</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </LinearGradient>
        </View>
      </TouchableOpacity>
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
      <LinearGradient
        colors={['#3B82F6', '#2563EB', '#1D4ED8']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{groupName}</Text>
        <View style={{ width: 32 }} />
      </LinearGradient>

      {/* Plans List */}
      <FlatList
        data={plans}
        renderItem={renderPlanCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#667eea']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="document-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Нет доступных тарифов</Text>
            <Text style={styles.emptySubtext}>В этой группе пока нет тарифов</Text>
          </View>
        }
      />
    </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  backButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
    letterSpacing: 0.3,
  },
  listContent: {
    padding: 20,
  },
  planCard: {
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
    position: 'relative',
  },
  discountBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#f44336',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  discountText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  planHeader: {
    marginBottom: 16,
  },
  planName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
    letterSpacing: 0.2,
  },
  planDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  fieldsContainer: {
    marginBottom: 16,
    gap: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  fieldIcon: {
    marginTop: 2,
  },
  fieldContent: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  fieldValue: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  priceContainer: {
    marginBottom: 16,
  },
  originalPrice: {
    fontSize: 14,
    color: '#999',
    textDecorationLine: 'line-through',
    marginBottom: 4,
  },
  currentPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#3B82F6',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
    letterSpacing: 0.3,
  },
  priceLabel: {
    fontSize: 16,
    color: '#64748B',
    marginLeft: 8,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  orderButtonContainer: {
    marginTop: 12,
  },
  orderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  orderButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
    letterSpacing: 0.2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
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
    marginTop: 8,
  },
});
