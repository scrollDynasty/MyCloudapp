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
import { API_URL } from '../../config/api';
import { getHeaders } from '../../config/fetch';
import { useAuth } from '../context/AuthContext';

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

interface ServiceGroup {
  id: number;
  name_uz: string;
  name_ru: string;
  description_uz?: string;
  description_ru?: string;
  slug: string;
  icon?: string;
  display_order: number;
  is_active: boolean;
  plans_count: number;
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
  const [vpsPlans, setVpsPlans] = useState<VPSPlan[]>([]);
  const [serviceGroups, setServiceGroups] = useState<ServiceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'vps' | 'services'>('services');

  useEffect(() => {
    // Используем данные из AuthContext
    if (authUser) {
      setUser(authUser);
    }
    loadData();
  }, [authUser]);

  const loadData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      // Load VPS plans
      const vpsResponse = await fetch(`${API_URL}/api/vps`, {
        headers: getHeaders(token || undefined),
      });
      const vpsData = await vpsResponse.json();
      if (vpsData.success) {
        setVpsPlans(vpsData.data);
      }

      // Load service groups
      const groupsResponse = await fetch(`${API_URL}/api/service-groups`, {
        headers: getHeaders(token || undefined),
      });
      const groupsData = await groupsResponse.json();
      if (groupsData.success) {
        setServiceGroups(groupsData.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleLogout = async () => {
    try {
      await signOut();
      router.replace('/auth/login');
    } catch (error) {
      console.error('❌ Logout error:', error);
      Alert.alert('Ошибка', 'Не удалось выйти. Попробуйте еще раз.');
    }
  };

  const handleOrderVPS = async (plan: VPSPlan) => {
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
        vps_plan_id: plan.plan_id,
        notes: `Заказ VPS плана: ${plan.plan_name}`,
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

  const handleOpenServiceGroup = (group: ServiceGroup) => {
    router.push({
      pathname: '/(user)/service-group-details',
      params: { groupId: group.id, groupName: group.name_ru },
    });
  };

  const renderVPSPlanCard = ({ item }: { item: VPSPlan }) => (
    <TouchableOpacity
      style={styles.planCard}
      onPress={() => handleOrderVPS(item)}
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

  const renderServiceGroupCard = ({ item }: { item: ServiceGroup }) => (
    <TouchableOpacity
      style={styles.groupCard}
      onPress={() => handleOpenServiceGroup(item)}
      activeOpacity={0.7}
    >
      <View style={styles.groupHeader}>
        <View style={styles.groupIconContainer}>
          <Text style={styles.groupIcon}>{item.icon || '📦'}</Text>
        </View>
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{item.name_ru}</Text>
          <Text style={styles.groupDescription} numberOfLines={2}>
            {item.description_ru || item.name_uz}
          </Text>
          <View style={styles.plansCountBadge}>
            <Ionicons name="apps" size={14} color="#667eea" />
            <Text style={styles.plansCountText}>
              {item.plans_count} {item.plans_count === 1 ? 'тариф' : 'тарифов'}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#ccc" />
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

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'services' && styles.tabActive]}
          onPress={() => setActiveTab('services')}
        >
          <Ionicons 
            name="grid" 
            size={20} 
            color={activeTab === 'services' ? '#667eea' : '#999'} 
          />
          <Text style={[styles.tabText, activeTab === 'services' && styles.tabTextActive]}>
            Сервисы
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'vps' && styles.tabActive]}
          onPress={() => setActiveTab('vps')}
        >
          <Ionicons 
            name="server" 
            size={20} 
            color={activeTab === 'vps' ? '#667eea' : '#999'} 
          />
          <Text style={[styles.tabText, activeTab === 'vps' && styles.tabTextActive]}>
            VPS
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.contentSection}>
        {activeTab === 'services' ? (
          <>
            <Text style={styles.sectionTitle}>Группы сервисов</Text>
            <FlatList
              data={serviceGroups}
              renderItem={renderServiceGroupCard}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#667eea']} />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="apps-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyText}>Нет доступных сервисов</Text>
                </View>
              }
            />
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Доступные VPS планы</Text>
            <FlatList
              data={vpsPlans}
              renderItem={renderVPSPlanCard}
              keyExtractor={(item, index) => item?.plan_id?.toString() || `plan-${index}`}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#667eea']} />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="server-outline" size={64} color="#ccc" />
                  <Text style={styles.emptyText}>Нет доступных VPS планов</Text>
                </View>
              }
            />
          </>
        )}
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
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    gap: 8,
  },
  tabActive: {
    backgroundColor: '#e3f2fd',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  tabTextActive: {
    color: '#667eea',
  },
  contentSection: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 16,
  },
  // VPS Plan Card Styles
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
  // Service Group Card Styles
  groupCard: {
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
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  groupIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#f0f0ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupIcon: {
    fontSize: 28,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  plansCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  plansCountText: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
});
