import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { API_URL } from '../../config/api';
import { getHeaders } from '../../config/fetch';
import { useAuth } from '../../lib/AuthContext';
import { getCachedOrFetch } from '../../lib/cache';

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
  const pathname = usePathname();
  const { user: authUser, signOut } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Анимации
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const loadProfileData = useCallback(async (forceRefresh = false) => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      if (!token) {
        Alert.alert('Ошибка', 'Токен авторизации не найден. Пожалуйста, войдите снова.');
        router.replace('/auth/login');
        return;
      }

      // Используем кэш для профиля пользователя
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

      // Используем кэш для заказов
      const ordersData = await getCachedOrFetch<Order[]>(
        'user_orders',
        async () => {
          const ordersResponse = await fetch(`${API_URL}/api/orders`, {
            headers: getHeaders(token || undefined),
          });
          
          if (!ordersResponse.ok) {
            throw new Error('Failed to fetch orders');
          }

          const data = await ordersResponse.json();
          if (data.success && Array.isArray(data.data)) {
            return data.data || [];
          }
          return [];
        },
        forceRefresh
      );

      if (ordersData) {
        setOrders(ordersData);
      }
    } catch (error: any) {
      console.error('Error loading profile data:', error);
      // Не показываем ошибку, если данные загружены из кэша
      if (forceRefresh) {
        Alert.alert('Ошибка', 'Не удалось загрузить данные профиля');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    if (authUser) {
      setUser(authUser);
      // Загружаем данные только если их нет в кэше или они устарели
      loadProfileData(false);
    }
  }, [authUser, loadProfileData]);

  // Анимация появления контента
  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
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

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadProfileData(true); // Принудительное обновление
  }, [loadProfileData]);

  const handleLogout = async () => {
    try {
      await signOut();
      router.replace('/auth/login');
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось выйти. Попробуйте еще раз.');
    }
  };

  // Проверка, зарегистрирован ли пользователь через Google
  const isGoogleUser = user?.oauth_provider === 'google';

  // Подсчитываем статистику (мемоизировано для оптимизации)
  const { activeServices, pendingOrders } = useMemo(() => ({
    activeServices: orders.filter(o => o.status === 'active' || o.payment_status === 'paid').length,
    pendingOrders: orders.filter(o => o.status === 'pending' || o.payment_status === 'pending').length,
  }), [orders]);

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
        <View style={styles.headerContent}>
          <View style={styles.headerLeft} />
          <Text style={styles.headerTitle}>Профиль</Text>
          <View style={styles.headerRight} />
        </View>
      </View>

      <Animated.ScrollView
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#4F46E5']} />
        }
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarLarge}>
            <Ionicons name="person" size={32} color="#111827" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.full_name || 'Пользователь'}</Text>
            <Text style={styles.profileEmail}>{user?.email || ''}</Text>
          </View>
          <TouchableOpacity style={styles.editButton}>
            <Text style={styles.editButtonText}>Редактировать</Text>
          </TouchableOpacity>
        </View>

        {/* Account Overview */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Обзор аккаунта</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Активные сервисы</Text>
              <Text style={styles.statValue}>{activeServices}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Ожидающие заказы</Text>
              <Text style={styles.statValue}>{pendingOrders}</Text>
            </View>
          </View>
        </View>

        {/* Personal Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Личная информация</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.infoCardContent}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="person-outline" size={18} color="#111827" />
              </View>
              <View style={styles.infoDetails}>
                <Text style={styles.infoLabel}>Полное имя</Text>
                <Text style={styles.infoValue}>{user?.full_name || 'Не указано'}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.changeButton}>
              <Text style={styles.changeButtonText}>Изменить</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoCardContent}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="mail-outline" size={18} color="#111827" />
              </View>
              <View style={styles.infoDetails}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{user?.email || 'Не указано'}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.changeButton}>
              <Text style={styles.changeButtonText}>Изменить</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoCardContent}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="call-outline" size={18} color="#111827" />
              </View>
              <View style={styles.infoDetails}>
                <Text style={styles.infoLabel}>Телефон</Text>
                <Text style={styles.infoValue}>{user?.phone || 'Не указано'}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.changeButton}>
              <Text style={styles.changeButtonText}>Изменить</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Security Section */}
        {!isGoogleUser && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Безопасность</Text>
            
            <View style={styles.infoCard}>
              <View style={styles.infoCardContent}>
                <View style={styles.infoIconContainer}>
                  <Ionicons name="lock-closed-outline" size={18} color="#111827" />
                </View>
                <View style={styles.infoDetails}>
                  <Text style={styles.infoLabel}>Пароль</Text>
                  <Text style={styles.infoValue}>Последнее изменение 2 месяца назад</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.changeButton}>
                <Text style={styles.changeButtonText}>Обновить</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoCardContent}>
                <View style={styles.infoIconContainer}>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#111827" />
                </View>
                <View style={styles.infoDetails}>
                  <Text style={styles.infoLabel}>Двухфакторная аутентификация</Text>
                  <Text style={styles.infoValue}>Включена</Text>
                </View>
              </View>
              <View style={styles.secureBadge}>
                <Text style={styles.secureBadgeText}>Безопасно</Text>
              </View>
            </View>
          </View>
        )}

        {/* Billing Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Платежи</Text>
          
          <View style={styles.infoCard}>
            <View style={styles.infoCardContent}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="card-outline" size={18} color="#111827" />
              </View>
              <View style={styles.infoDetails}>
                <Text style={styles.infoLabel}>Способ оплаты</Text>
                <Text style={styles.infoValue}>Visa •••• 4242</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.changeButton}>
              <Text style={styles.changeButtonText}>Управлять</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoCardContent}>
              <View style={styles.infoIconContainer}>
                <Ionicons name="receipt-outline" size={18} color="#111827" />
              </View>
              <View style={styles.infoDetails}>
                <Text style={styles.infoLabel}>Счета</Text>
                <Text style={styles.infoValue}>Последний выдан: {new Date().toLocaleDateString('ru-RU')}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.changeButton}>
              <Text style={styles.changeButtonText}>Просмотр</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#FFFFFF" />
          <Text style={styles.logoutButtonText}>Выйти</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </Animated.ScrollView>

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
            {pathname === '/(user)/home' ? <View style={styles.bottomNavIndicator} /> : null}
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
            {pathname === '/(user)/services' ? <View style={styles.bottomNavIndicator} /> : null}
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
            {pathname === '/(user)/orders' ? <View style={styles.bottomNavIndicator} /> : null}
          </View>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.bottomNavItem}
          activeOpacity={0.7}
        >
          <View style={styles.bottomNavContent}>
            <View style={pathname === '/(user)/profile' ? styles.bottomNavIconActive : styles.bottomNavIcon}>
              <Ionicons name="person" size={20} color={pathname === '/(user)/profile' ? '#FFFFFF' : '#9CA3AF'} />
            </View>
            <Text style={pathname === '/(user)/profile' ? styles.bottomNavLabelActive : styles.bottomNavLabel}>Профиль</Text>
            {pathname === '/(user)/profile' ? <View style={styles.bottomNavIndicator} /> : null}
          </View>
        </TouchableOpacity>
      </View>
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
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: 0,
  },
  headerRight: {
    width: 40,
    height: 40,
  },
  content: {
    flex: 1,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  avatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  profileInfo: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 19.36,
  },
  profileEmail: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  editButton: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    lineHeight: 14.52,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 17,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
    marginBottom: 12,
    lineHeight: 16.94,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  statCard: {
    flex: 1,
    gap: 6,
    padding: 11,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 16.94,
  },
  infoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 13,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  infoIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoDetails: {
    flex: 1,
    gap: 2,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 16.94,
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  changeButton: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  changeButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    lineHeight: 14.52,
  },
  secureBadge: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secureBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  logoutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6366F1',
    borderRadius: 24,
    padding: 13,
    marginHorizontal: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    lineHeight: 16.94,
  },
  bottomSpacer: {
    height: 20,
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

