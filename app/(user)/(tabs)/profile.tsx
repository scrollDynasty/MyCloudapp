import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '../../../config/api';
import { getHeaders } from '../../../config/fetch';
import { useAuth } from '../../../lib/AuthContext';
import { getCachedOrFetch } from '../../../lib/cache';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isSmallDevice = SCREEN_WIDTH < 375;

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
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => subscription?.remove();
  }, []);

  // Анимации
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const loadProfileData = useCallback(async (forceRefresh = false) => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      if (!token) {
        // Тихо перенаправляем на логин без показа алерта
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

      if (ordersData && Array.isArray(ordersData)) {
        setOrders(ordersData);
      } else {
        setOrders([]);
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
    } else {
      // Если пользователь вышел, сбрасываем состояние
      setUser(null);
      setLoading(false);
    }
  }, [authUser, loadProfileData]);

  // Анимация появления контента
  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: Platform.OS !== 'web',
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
      // Сначала очищаем состояние
      setUser(null);
      // Затем выходим
      await signOut();
      // Перенаправляем на страницу логина
      router.replace('/auth/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Все равно перенаправляем на логин, даже если произошла ошибка
      router.replace('/auth/login');
    }
  };

  // Проверка, зарегистрирован ли пользователь через Google
  const isGoogleUser = user?.oauth_provider === 'google';

  // Адаптивные размеры
  const adaptive = useMemo(() => {
    const width = dimensions.width;
    const isVerySmall = width < 360;
    const isSmall = width < 375;
    const isMedium = width >= 375 && width < 430;
    
    return {
      horizontal: isVerySmall ? 12 : isSmall ? 14 : 16,
      vertical: isVerySmall ? 12 : 16,
      gap: isVerySmall ? 8 : isSmall ? 10 : 12,
      avatarSize: isVerySmall ? 56 : 64,
      iconSize: isVerySmall ? 16 : 18,
      largeIconSize: isVerySmall ? 28 : 32,
      titleSize: isVerySmall ? 16 : 18,
      nameSize: isVerySmall ? 15 : 16,
      labelSize: isVerySmall ? 13 : 14,
      textSize: isVerySmall ? 11 : 12,
      buttonPadding: isVerySmall ? 8 : 11,
      cardPadding: isVerySmall ? 11 : 13,
      borderRadius: isVerySmall ? 20 : 24,
    };
  }, [dimensions]);

  // Подсчитываем статистику (мемоизировано для оптимизации)
  const { activeServices, pendingOrders } = useMemo(() => ({
    activeServices: Array.isArray(orders) ? orders.filter(o => o.status === 'active' || o.payment_status === 'paid').length : 0,
    pendingOrders: Array.isArray(orders) ? orders.filter(o => o.status === 'pending' || o.payment_status === 'pending').length : 0,
  }), [orders]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
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
        <View style={[styles.profileHeader, { 
          paddingHorizontal: adaptive.horizontal,
          paddingTop: adaptive.vertical,
          paddingBottom: adaptive.gap,
          gap: adaptive.gap 
        }]}>
          <View style={[styles.avatarLarge, { 
            width: adaptive.avatarSize, 
            height: adaptive.avatarSize,
            borderRadius: adaptive.borderRadius 
          }]}>
            <Ionicons name="person" size={adaptive.largeIconSize} color="#111827" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { fontSize: adaptive.nameSize }]} numberOfLines={1}>
              {user?.full_name || 'Пользователь'}
            </Text>
            <Text style={[styles.profileEmail, { fontSize: adaptive.textSize }]} numberOfLines={1}>
              {user?.email || ''}
            </Text>
          </View>
          <TouchableOpacity style={[styles.editButton, { 
            paddingHorizontal: adaptive.buttonPadding,
            paddingVertical: adaptive.buttonPadding / 1.5,
            borderRadius: adaptive.borderRadius 
          }]}>
            <Text style={[styles.editButtonText, { fontSize: adaptive.textSize }]}>
              {dimensions.width < 360 ? 'Ред.' : 'Редактировать'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Account Overview */}
        <View style={[styles.sectionCard, { 
          marginHorizontal: adaptive.horizontal,
          padding: adaptive.cardPadding,
          borderRadius: adaptive.borderRadius 
        }]}>
          <Text style={[styles.sectionTitle, { fontSize: adaptive.labelSize }]}>Обзор аккаунта</Text>
          <View style={[styles.statsRow, { gap: adaptive.gap }]}>
            <View style={[styles.statCard, { 
              padding: adaptive.buttonPadding,
              borderRadius: adaptive.borderRadius,
              gap: adaptive.gap / 2 
            }]}>
              <Text style={[styles.statLabel, { fontSize: adaptive.textSize }]}>Активные сервисы</Text>
              <Text style={[styles.statValue, { fontSize: adaptive.labelSize }]}>{activeServices}</Text>
            </View>
            <View style={[styles.statCard, { 
              padding: adaptive.buttonPadding,
              borderRadius: adaptive.borderRadius,
              gap: adaptive.gap / 2 
            }]}>
              <Text style={[styles.statLabel, { fontSize: adaptive.textSize }]}>Ожидающие заказы</Text>
              <Text style={[styles.statValue, { fontSize: adaptive.labelSize }]}>{pendingOrders}</Text>
            </View>
          </View>
        </View>

        {/* Personal Info */}
        <View style={[styles.section, { marginHorizontal: adaptive.horizontal }]}>
          <Text style={[styles.sectionTitle, { fontSize: adaptive.labelSize }]}>Личная информация</Text>
          
          <View style={[styles.infoCard, { 
            padding: adaptive.cardPadding,
            borderRadius: adaptive.borderRadius 
          }]}>
            <View style={[styles.infoCardContent, { gap: adaptive.gap }]}>
              <View style={[styles.infoIconContainer, { 
                width: adaptive.avatarSize * 0.7,
                height: adaptive.avatarSize * 0.7,
                borderRadius: adaptive.borderRadius 
              }]}>
                <Ionicons name="person-outline" size={adaptive.iconSize} color="#111827" />
              </View>
              <View style={styles.infoDetails}>
                <Text style={[styles.infoLabel, { fontSize: adaptive.labelSize }]}>Полное имя</Text>
                <Text style={[styles.infoValue, { fontSize: adaptive.textSize }]} numberOfLines={1}>
                  {user?.full_name || 'Не указано'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.changeButton, { 
              paddingHorizontal: adaptive.buttonPadding,
              paddingVertical: adaptive.buttonPadding / 1.5,
              borderRadius: adaptive.borderRadius 
            }]}>
              <Text style={[styles.changeButtonText, { fontSize: adaptive.textSize }]}>Изм.</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.infoCard, { 
            padding: adaptive.cardPadding,
            borderRadius: adaptive.borderRadius 
          }]}>
            <View style={[styles.infoCardContent, { gap: adaptive.gap }]}>
              <View style={[styles.infoIconContainer, { 
                width: adaptive.avatarSize * 0.7,
                height: adaptive.avatarSize * 0.7,
                borderRadius: adaptive.borderRadius 
              }]}>
                <Ionicons name="mail-outline" size={adaptive.iconSize} color="#111827" />
              </View>
              <View style={styles.infoDetails}>
                <Text style={[styles.infoLabel, { fontSize: adaptive.labelSize }]}>Email</Text>
                <Text style={[styles.infoValue, { fontSize: adaptive.textSize }]} numberOfLines={1} ellipsizeMode="middle">
                  {user?.email || 'Не указано'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.changeButton, { 
              paddingHorizontal: adaptive.buttonPadding,
              paddingVertical: adaptive.buttonPadding / 1.5,
              borderRadius: adaptive.borderRadius 
            }]}>
              <Text style={[styles.changeButtonText, { fontSize: adaptive.textSize }]}>Изм.</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.infoCard, { 
            padding: adaptive.cardPadding,
            borderRadius: adaptive.borderRadius 
          }]}>
            <View style={[styles.infoCardContent, { gap: adaptive.gap }]}>
              <View style={[styles.infoIconContainer, { 
                width: adaptive.avatarSize * 0.7,
                height: adaptive.avatarSize * 0.7,
                borderRadius: adaptive.borderRadius 
              }]}>
                <Ionicons name="call-outline" size={adaptive.iconSize} color="#111827" />
              </View>
              <View style={styles.infoDetails}>
                <Text style={[styles.infoLabel, { fontSize: adaptive.labelSize }]}>Телефон</Text>
                <Text style={[styles.infoValue, { fontSize: adaptive.textSize }]} numberOfLines={1}>
                  {user?.phone || 'Не указано'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.changeButton, { 
              paddingHorizontal: adaptive.buttonPadding,
              paddingVertical: adaptive.buttonPadding / 1.5,
              borderRadius: adaptive.borderRadius 
            }]}>
              <Text style={[styles.changeButtonText, { fontSize: adaptive.textSize }]}>Изм.</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Security Section */}
        {!isGoogleUser && (
          <View style={[styles.section, { marginHorizontal: adaptive.horizontal }]}>
            <Text style={[styles.sectionTitle, { fontSize: adaptive.labelSize }]}>Безопасность</Text>
            
            <View style={[styles.infoCard, { 
              padding: adaptive.cardPadding,
              borderRadius: adaptive.borderRadius 
            }]}>
              <View style={[styles.infoCardContent, { gap: adaptive.gap }]}>
                <View style={[styles.infoIconContainer, { 
                  width: adaptive.avatarSize * 0.7,
                  height: adaptive.avatarSize * 0.7,
                  borderRadius: adaptive.borderRadius 
                }]}>
                  <Ionicons name="lock-closed-outline" size={adaptive.iconSize} color="#111827" />
                </View>
                <View style={styles.infoDetails}>
                  <Text style={[styles.infoLabel, { fontSize: adaptive.labelSize }]}>Пароль</Text>
                  <Text style={[styles.infoValue, { fontSize: adaptive.textSize }]} numberOfLines={2}>
                    {dimensions.width < 360 ? 'Изменен 2 мес. назад' : 'Последнее изменение 2 месяца назад'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity style={[styles.changeButton, { 
                paddingHorizontal: adaptive.buttonPadding,
                paddingVertical: adaptive.buttonPadding / 1.5,
                borderRadius: adaptive.borderRadius 
              }]}>
                <Text style={[styles.changeButtonText, { fontSize: adaptive.textSize }]}>Обн.</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.infoCard, { 
              padding: adaptive.cardPadding,
              borderRadius: adaptive.borderRadius 
            }]}>
              <View style={[styles.infoCardContent, { gap: adaptive.gap }]}>
                <View style={[styles.infoIconContainer, { 
                  width: adaptive.avatarSize * 0.7,
                  height: adaptive.avatarSize * 0.7,
                  borderRadius: adaptive.borderRadius 
                }]}>
                  <Ionicons name="shield-checkmark-outline" size={adaptive.iconSize} color="#111827" />
                </View>
                <View style={styles.infoDetails}>
                  <Text style={[styles.infoLabel, { fontSize: adaptive.labelSize }]} numberOfLines={2}>
                    {dimensions.width < 360 ? '2FA' : 'Двухфакторная аутентификация'}
                  </Text>
                  <Text style={[styles.infoValue, { fontSize: adaptive.textSize }]}>Включена</Text>
                </View>
              </View>
              <View style={[styles.secureBadge, { 
                paddingHorizontal: adaptive.buttonPadding,
                paddingVertical: adaptive.buttonPadding / 1.8,
                borderRadius: adaptive.borderRadius / 2 
              }]}>
                <Text style={[styles.secureBadgeText, { fontSize: adaptive.textSize }]}>
                  {dimensions.width < 360 ? '✓' : 'Безопасно'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Billing Section */}
        <View style={[styles.sectionCard, { 
          marginHorizontal: adaptive.horizontal,
          padding: adaptive.cardPadding,
          borderRadius: adaptive.borderRadius 
        }]}>
          <Text style={[styles.sectionTitle, { fontSize: adaptive.labelSize }]}>Платежи</Text>
          
          <View style={[styles.infoCard, { 
            padding: adaptive.cardPadding,
            borderRadius: adaptive.borderRadius 
          }]}>
            <View style={[styles.infoCardContent, { gap: adaptive.gap }]}>
              <View style={[styles.infoIconContainer, { 
                width: adaptive.avatarSize * 0.7,
                height: adaptive.avatarSize * 0.7,
                borderRadius: adaptive.borderRadius 
              }]}>
                <Ionicons name="card-outline" size={adaptive.iconSize} color="#111827" />
              </View>
              <View style={styles.infoDetails}>
                <Text style={[styles.infoLabel, { fontSize: adaptive.labelSize }]}>Способ оплаты</Text>
                <Text style={[styles.infoValue, { fontSize: adaptive.textSize }]}>Visa •••• 4242</Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.changeButton, { 
              paddingHorizontal: adaptive.buttonPadding,
              paddingVertical: adaptive.buttonPadding / 1.5,
              borderRadius: adaptive.borderRadius 
            }]}>
              <Text style={[styles.changeButtonText, { fontSize: adaptive.textSize }]}>
                {dimensions.width < 360 ? 'Упр.' : 'Управлять'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.infoCard, { 
            padding: adaptive.cardPadding,
            borderRadius: adaptive.borderRadius 
          }]}>
            <View style={[styles.infoCardContent, { gap: adaptive.gap }]}>
              <View style={[styles.infoIconContainer, { 
                width: adaptive.avatarSize * 0.7,
                height: adaptive.avatarSize * 0.7,
                borderRadius: adaptive.borderRadius 
              }]}>
                <Ionicons name="receipt-outline" size={adaptive.iconSize} color="#111827" />
              </View>
              <View style={styles.infoDetails}>
                <Text style={[styles.infoLabel, { fontSize: adaptive.labelSize }]}>Счета</Text>
                <Text style={[styles.infoValue, { fontSize: adaptive.textSize }]} numberOfLines={1}>
                  {dimensions.width < 360 
                    ? new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
                    : `Последний выдан: ${new Date().toLocaleDateString('ru-RU')}`
                  }
                </Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.changeButton, { 
              paddingHorizontal: adaptive.buttonPadding,
              paddingVertical: adaptive.buttonPadding / 1.5,
              borderRadius: adaptive.borderRadius 
            }]}>
              <Text style={[styles.changeButtonText, { fontSize: adaptive.textSize }]}>
                {dimensions.width < 360 ? 'См.' : 'Просмотр'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity 
          style={[styles.logoutButton, { 
            marginHorizontal: adaptive.horizontal,
            padding: adaptive.cardPadding,
            borderRadius: adaptive.borderRadius,
            gap: adaptive.gap 
          }]} 
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={adaptive.iconSize} color="#FFFFFF" />
          <Text style={[styles.logoutButtonText, { fontSize: adaptive.labelSize }]}>Выйти</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </Animated.ScrollView>
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
    paddingBottom: 13,
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
    height: 80,
  },
});

