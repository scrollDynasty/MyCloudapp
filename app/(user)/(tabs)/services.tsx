import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Platform,
  RefreshControl,
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

interface User {
  user_id: number;
  full_name: string;
  email: string;
  role: string;
  company_name?: string;
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

export default function ServicesScreen() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [serviceGroups, setServiceGroups] = useState<ServiceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'pending'>('all');

  // Анимации
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    if (authUser) {
      setUser(authUser);
    }
    loadServices();
  }, [authUser]);

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

  const loadServices = async (forceRefresh = false) => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      if (!token) {
        // Тихо перенаправляем на логин без показа алерта
        router.replace('/auth/login');
        return;
      }

      // Загрузить группы сервисов с кешированием и rate limiting
      const groupsData = await getCachedOrFetch(
        'service_groups',
        () => rateLimitedFetch('service_groups', async () => {
          const groupsResponse = await fetch(`${API_URL}/api/service-groups`, {
            headers: getHeaders(token || undefined),
          });
          return await groupsResponse.json();
        }),
        forceRefresh
      );

      if (groupsData && groupsData.success && Array.isArray(groupsData.data)) {
        setServiceGroups(groupsData.data || []);
      } else {
        setServiceGroups([]);
      }
    } catch (error: any) {
      console.error('Error loading services:', error);
      setServiceGroups([]);
      if (!error.message?.includes('Rate limit')) {
        Alert.alert('Ошибка', 'Не удалось загрузить данные');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadServices(true); // Принудительное обновление
  };

  const handleOpenServiceGroup = (group: ServiceGroup) => {
    router.push({
      pathname: '/(user)/service-group-details',
      params: { groupId: group.id, groupName: group.name_ru },
    });
  };

  // Фильтрация групп сервисов
  const filteredGroups = serviceGroups.filter((group) => {
    // Фильтр по статусу
    if (filter === 'active' && !group.is_active) return false;
    if (filter === 'pending' && group.is_active) return false;
    
    // Поиск
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const nameRu = group.name_ru?.toLowerCase() || '';
      const nameUz = group.name_uz?.toLowerCase() || '';
      const descRu = group.description_ru?.toLowerCase() || '';
      const descUz = group.description_uz?.toLowerCase() || '';
      const slug = group.slug?.toLowerCase() || '';
      
      return nameRu.includes(query) || 
             nameUz.includes(query) || 
             descRu.includes(query) || 
             descUz.includes(query) ||
             slug.includes(query);
    }
    
    return true;
  });

  // Активные и ожидающие сервисы
  const activeServices = serviceGroups.filter(g => g.is_active).length;
  const pendingServices = serviceGroups.filter(g => !g.is_active).length;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  const userName = user?.full_name?.split(' ')[0] || 'Пользователь';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft} />
          <Text style={styles.headerTitle}>Сервисы</Text>
          <TouchableOpacity 
            style={styles.profileButton} 
            onPress={() => router.replace('/(user)/(tabs)/profile')}
          >
            <View style={styles.avatar}>
              <Ionicons name="person" size={20} color="#111827" />
            </View>
          </TouchableOpacity>
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
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeText}>
            <Text style={styles.welcomeTitle}>Мои сервисы</Text>
            <Text style={styles.welcomeSubtitle}>Быстрый доступ к активным ресурсам</Text>
          </View>
          <View style={styles.avatarLarge}>
            <Ionicons name="person" size={20} color="#111827" />
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Поиск сервисов"
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
            onPress={() => setFilter('all')}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterTabText, filter === 'all' && styles.filterTabTextActive]}>
              Все
            </Text>
          </TouchableOpacity>
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
              Ожидают
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Серверы</Text>
            <Text style={styles.statValue}>{activeServices} активных</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Хранилище</Text>
            <Text style={styles.statValue}>1 бакет</Text>
          </View>
        </View>

        {/* List Section */}
        <View style={styles.listSection}>
          <Text style={styles.listTitle}>Список</Text>
          
          {filteredGroups.length > 0 ? (
            filteredGroups.map((group) => (
              <TouchableOpacity
                key={group.id}
                style={styles.serviceItemCard}
                onPress={() => handleOpenServiceGroup(group)}
                activeOpacity={0.7}
              >
                <View style={styles.serviceItemContent}>
                  <View style={styles.serviceItemIconContainer}>
                    <Ionicons name="server" size={18} color="#111827" />
                  </View>
                  <View style={styles.serviceItemInfo}>
                    <Text style={styles.serviceItemName}>{group.name_ru}</Text>
                    <Text style={styles.serviceItemDescription}>
                      {group.plans_count} {group.plans_count === 1 ? 'тариф' : 'тарифов'}
                    </Text>
                  </View>
                </View>
                <View style={styles.serviceItemActions}>
                  <View style={styles.serviceItemStatusBadge}>
                    <Text style={styles.serviceItemStatusText}>
                      {group.is_active ? 'Активен' : 'Ожидает'}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.serviceItemOpenButton}>
                    <Text style={styles.serviceItemOpenText}>Открыть</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Нет доступных сервисов</Text>
            </View>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </Animated.ScrollView>
    </View>
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
  profileButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  avatarLarge: {
    width: 32,
    height: 32,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  content: {
    flex: 1,
  },
  welcomeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 11,
  },
  welcomeText: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: 0,
    lineHeight: 21.78,
  },
  welcomeSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '400',
    color: '#111827',
    lineHeight: 15.73,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  filterTab: {
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterTabActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
    lineHeight: 15.73,
  },
  filterTabTextActive: {
    color: '#EEF2FF',
  },
  statsCard: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 17,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 3,
    gap: 6,
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
  listSection: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
    marginBottom: 8,
    lineHeight: 16.94,
  },
  serviceItemCard: {
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
  serviceItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  serviceItemIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  serviceItemInfo: {
    flex: 1,
    gap: 2,
  },
  serviceItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    lineHeight: 16.94,
  },
  serviceItemDescription: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  serviceItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceItemStatusBadge: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  serviceItemStatusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
    lineHeight: 14.52,
  },
  serviceItemOpenButton: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  serviceItemOpenText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    lineHeight: 14.52,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  bottomSpacer: {
    height: 80,
  },
});

