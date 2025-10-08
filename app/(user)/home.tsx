import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

const API_URL = 'http://localhost:5000';

interface VPSPlan {
  plan_id: number;
  provider_name: string;
  plan_name: string;
  cpu_cores: number;
  ram_gb: number;
  storage_gb: number;
  bandwidth_tb: number;
  price: number;
  currency_code: string;
  region_name: string;
}

interface User {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
  company_name?: string;
}

export default function UserHomeScreen() {
  const router = useRouter();
  const { user: authUser, signOut } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [plans, setPlans] = useState<VPSPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Используем данные из AuthContext
    if (authUser) {
      setUser(authUser);
    }
    loadPlans();
  }, [authUser]);

  const loadPlans = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/vps`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setPlans(data.data);
      }
    } catch (error) {
      console.error('Error loading plans:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить список VPS');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadPlans();
  };

  const handleLogout = async () => {
    console.log('🔘 Logout button clicked!');
    
    try {
      console.log('🔓 Starting logout process...');
      // Используем signOut из AuthContext
      await signOut();
      console.log('✅ SignOut completed');
      
      // Перенаправляем на логин
      console.log('🔄 Navigating to login...');
      router.replace('/auth/login');
      console.log('✅ Navigation completed');
    } catch (error) {
      console.error('❌ Logout error:', error);
      Alert.alert('Ошибка', 'Не удалось выйти. Попробуйте еще раз.');
    }
  };

  const handleOrderPlan = async (plan: VPSPlan) => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');
      
      // Получаем ID пользователя
      const userId = authUser?.user_id;
      console.log('👤 Current user:', authUser);
      console.log('🆔 User ID:', userId);
      console.log('📦 Plan:', plan);
      
      if (!userId) {
        Alert.alert('Ошибка', 'Не удалось определить пользователя');
        return;
      }

      const requestBody = {
        user_id: userId,
        vps_plan_id: plan.plan_id,
        notes: `Заказ VPS плана: ${plan.plan_name}`,
      };
      
      console.log('📤 Sending order request:', requestBody);

      const response = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      console.log('📥 Order response:', data);
      
      if (data.success) {
        // Перенаправляем на страницу оформления заказа
        router.push({
          pathname: '/(user)/checkout',
          params: { orderId: data.data.id },
        });
      } else {
        console.error('❌ Order creation failed:', data);
        Alert.alert('Ошибка', data.error || 'Не удалось создать заказ');
      }
    } catch (error) {
      console.error('❌ Order error:', error);
      Alert.alert('Ошибка', 'Не удалось создать заказ');
    } finally {
      setLoading(false);
    }
  };

  const renderPlanCard = ({ item }: { item: VPSPlan }) => (
    <TouchableOpacity
      style={styles.planCard}
      onPress={() => handleOrderPlan(item)}
      activeOpacity={0.7}
    >
      <View style={styles.planHeader}>
        <View>
          <Text style={styles.providerName}>{item.provider_name}</Text>
          <Text style={styles.planName}>{item.plan_name}</Text>
        </View>
        <View style={styles.regionBadge}>
          <Ionicons name="location" size={14} color="#667eea" />
          <Text style={styles.regionText}>{item.region_name}</Text>
        </View>
      </View>

      <View style={styles.specsContainer}>
        <View style={styles.specItem}>
          <Ionicons name="hardware-chip" size={18} color="#667eea" />
          <Text style={styles.specText}>{item.cpu_cores} CPU</Text>
        </View>
        <View style={styles.specItem}>
          <Ionicons name="server" size={18} color="#667eea" />
          <Text style={styles.specText}>{item.ram_gb} GB RAM</Text>
        </View>
        <View style={styles.specItem}>
          <Ionicons name="save" size={18} color="#667eea" />
          <Text style={styles.specText}>{item.storage_gb} GB</Text>
        </View>
        <View style={styles.specItem}>
          <Ionicons name="swap-horizontal" size={18} color="#667eea" />
          <Text style={styles.specText}>{item.bandwidth_tb} TB</Text>
        </View>
      </View>

      <View style={styles.priceContainer}>
        <Text style={styles.priceText}>
          {item.price} {item.currency_code}
        </Text>
        <Text style={styles.priceLabel}>/месяц</Text>
      </View>
    </TouchableOpacity>
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
          <Text style={styles.greeting}>Добро пожаловать,</Text>
          <Text style={styles.userName}>{user?.full_name || 'Пользователь'}</Text>
          {user?.role === 'legal_entity' && user?.company_name && (
            <Text style={styles.companyName}>{user.company_name}</Text>
          )}
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#d32f2f" />
        </TouchableOpacity>
      </View>

      {/* Plans List */}
      <View style={styles.plansSection}>
        <Text style={styles.sectionTitle}>Доступные VPS планы</Text>
        <FlatList
          data={plans}
          renderItem={renderPlanCard}
          keyExtractor={(item, index) => item?.plan_id?.toString() || `plan-${index}`}
          contentContainerStyle={styles.plansList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#667eea']} />
          }
        />
      </View>
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
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  greeting: {
    fontSize: 14,
    color: '#666',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  companyName: {
    fontSize: 14,
    color: '#667eea',
    marginTop: 2,
  },
  logoutButton: {
    padding: 8,
  },
  plansSection: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  plansList: {
    paddingBottom: 16,
  },
  planCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
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
  providerName: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
  },
  planName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
  },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  regionText: {
    fontSize: 12,
    color: '#667eea',
    marginLeft: 4,
    fontWeight: '500',
  },
  specsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    gap: 12,
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  specText: {
    fontSize: 13,
    color: '#333',
    marginLeft: 6,
    fontWeight: '500',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
  },
  priceText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#667eea',
  },
  priceLabel: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
});