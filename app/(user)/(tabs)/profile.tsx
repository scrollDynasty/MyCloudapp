import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PaymeCheckout from '../../../components/PaymeCheckout';
import { API_URL } from '../../../config/api';
import { getHeaders } from '../../../config/fetch';
import { useAuth } from '../../../lib/AuthContext';
import { getCachedOrFetch } from '../../../lib/cache';

interface UserProfile {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
  company_name?: string;
  oauth_provider?: string | null;
  phone?: string | null;
}

interface Order {
  order_id: number;
  order_number?: string;
  user_id: number;
  plan_name: string;
  provider_name: string;
  total_price: number;
  currency_code: string;
  status: string;
  payment_status?: string;
  created_at: string;
}

export default React.memo(function ProfileScreen() {
  const router = useRouter();
  const { user: authUser, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddCardModal, setShowAddCardModal] = useState(false);

  const loadProfileData = useCallback(async (forceRefresh = false) => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      if (!token) {
        router.replace('/auth/login');
        return;
      }

      const profileData = await getCachedOrFetch<UserProfile>(
        'user_profile',
        async () => {
          const profileResponse = await fetch(`${API_URL}/api/auth/me`, {
            headers: getHeaders(token || undefined),
          });
          
          if (!profileResponse.ok) {
            throw new Error('Failed to fetch profile');
          }

          const data = await profileResponse.json();
          if (data.success && data.data) {
            return {
              user_id: data.data.user_id,
              full_name: data.data.full_name,
              email: data.data.email,
              role: data.data.role,
              company_name: data.data.company_name,
              oauth_provider: data.data.oauth_provider,
              phone: data.data.phone,
            };
          }
          throw new Error('Invalid profile data');
        },
        forceRefresh
      );

      if (profileData) {
        setUser(profileData);
      }

      const ordersData = await getCachedOrFetch<Order[]>(
        'user_orders',
        async () => {
          const ordersResponse = await fetch(`${API_URL}/api/orders`, {
            headers: getHeaders(token || undefined),
          });
          const data = await ordersResponse.json();
          return data.success ? data.data : [];
        },
        forceRefresh
      );

      if (ordersData) {
        setOrders(ordersData);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadProfileData(true);
  }, [loadProfileData]);

  const handleLogout = useCallback(async () => {
    Alert.alert('Выход', 'Вы уверены, что хотите выйти?', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Выйти',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/auth/login');
        },
      },
    ]);
  }, [signOut, router]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  const activeOrders = Array.isArray(orders) ? orders.filter(o => o.status === 'active') : [];
  const pendingOrders = Array.isArray(orders) ? orders.filter(o => o.status === 'pending' || o.payment_status === 'pending') : [];

  return (
    <View style={[styles.container, { paddingTop: insets.top > 0 ? 8 : 0 }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Профиль</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#0EA5E9']} />
        }
      >
        {/* Profile Section */}
        <View style={styles.profileSection}>
          {/* Avatar and User Info */}
          <View style={styles.profileRow}>
            <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={36} color="#4F46E5" />
            </View>
            </View>
            
            <View style={styles.userInfoContainer}>
              <View style={styles.userNameRow}>
                <Text style={styles.userName} numberOfLines={1}>
                  {user?.full_name || 'alex.johnson'}
                </Text>
              </View>
              
              <View style={styles.statusRow}>
                <View style={styles.statusBadge}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>Статус: Активен</Text>
                </View>
              </View>
              
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>7</Text>
                  <Text style={styles.statLabel}>Услуг</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>1.2 ТБ</Text>
                  <Text style={styles.statLabel}>Хранилище</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{pendingOrders.length}</Text>
                  <Text style={styles.statLabel}>К оплате</Text>
                </View>
              </View>
              
              <View style={styles.proBadge}>
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text style={styles.proText}>Pro</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Services Row */}
        <View style={styles.servicesRow}>
          <View style={styles.serviceCard}>
            <Text style={styles.serviceTitle}>VPS-1</Text>
            <Text style={styles.serviceStatus}>Активна</Text>
          </View>
          <View style={styles.serviceCard}>
            <Text style={styles.serviceTitle}>mysite.io</Text>
            <Text style={styles.serviceStatus}>Оплачено</Text>
          </View>
          <View style={styles.serviceCard}>
            <Text style={styles.serviceTitle}>+320 GB</Text>
            <Text style={styles.serviceStatus}>Объектное</Text>
          </View>
        </View>

        {/* Payment Button */}
        {pendingOrders.length > 0 && (
          <TouchableOpacity
            style={styles.payButton}
            onPress={() => router.push('/(user)/(tabs)/orders?filter=pending')}
          >
            <Ionicons name="card-outline" size={18} color="#FFFFFF" />
            <Text style={styles.payButtonText}>Оплатить</Text>
          </TouchableOpacity>
        )}

        {/* Account Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Профиль аккаунта</Text>
          
          <TouchableOpacity style={styles.settingCard}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="star-outline" size={20} color="#4F46E5" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Тариф: Pro</Text>
                <Text style={styles.settingSubtitle}>Ежемесячно • Приоритетная поддержка</Text>
              </View>
            </View>
            <View style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Изменить</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingCard}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="person-outline" size={20} color="#4F46E5" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Контакты</Text>
                <Text style={styles.settingSubtitle} numberOfLines={1}>
                  {user?.email || 'Имя, Email, Телефон'}
                </Text>
              </View>
            </View>
            <View style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Редактировать</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Payment Methods Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Платёжные данные</Text>
          
          <TouchableOpacity 
            style={styles.settingCard}
            onPress={() => setShowAddCardModal(true)}
          >
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="card-outline" size={20} color="#4F46E5" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Привязать карту</Text>
                <Text style={styles.settingSubtitle}>Uzcard или Humo</Text>
              </View>
            </View>
            <Ionicons name="add-circle" size={20} color="#4F46E5" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingCard}>
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Ionicons name="wallet-outline" size={20} color="#4F46E5" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Payme</Text>
                <Text style={styles.settingSubtitle}>Быстрые платежи</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            </View>
            <Text style={[styles.settingTitle, { color: '#EF4444' }]}>Выйти из аккаунта</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Payme Checkout */}
      <PaymeCheckout
        visible={showAddCardModal}
        onClose={() => setShowAddCardModal(false)}
        onCardAdded={() => {
          loadProfileData(true);
        }}
      />
    </View>
  );
});

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
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  content: {
    flex: 1,
  },
  profileSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  profileRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 16,
  },
  avatarWrapper: {
    width: 68,
    height: 68,
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#EEF2FF',
    borderWidth: 2,
    borderColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfoContainer: {
    flex: 1,
    gap: 4,
  },
  userNameRow: {
    marginBottom: 6,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  statusRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 8,
    marginBottom: 4,
  },
  statBox: {
    gap: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '400',
    color: '#6B7280',
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
    alignSelf: 'flex-start',
  },
  proText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  servicesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  serviceCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  serviceTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  serviceStatus: {
    fontSize: 11,
    fontWeight: '400',
    color: '#6B7280',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 8,
  },
  payButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingInfo: {
    flex: 1,
    gap: 4,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  settingSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
  },
  actionButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  bottomSpacer: {
    height: 20,
  },
});
