import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { API_URL } from '../../config/api';
import { getHeaders } from '../../config/fetch';
import { useAuth } from '../../lib/AuthContext';

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
  const [serviceGroups, setServiceGroups] = useState<ServiceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
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
    // Используем данные из AuthContext
    if (authUser) {
      setUser(authUser);
    }
    loadData();
  }, [authUser]);

  const loadData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');

      // Load service groups
      const groupsResponse = await fetch(`${API_URL}/api/service-groups`, {
        headers: getHeaders(token || undefined),
      });
      const groupsData = await groupsResponse.json();
      if (groupsData.success) {
        setServiceGroups(groupsData.data);
      }
    } catch (error) {
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
      Alert.alert('Ошибка', 'Не удалось выйти. Попробуйте еще раз.');
    }
  };

  const handleOpenServiceGroup = (group: ServiceGroup) => {
    router.push({
      pathname: '/(user)/service-group-details',
      params: { groupId: group.id, groupName: group.name_ru },
    });
  };
  
  const handleCategorySelect = (category: string | null) => {
    setSelectedCategory(category);
  };

  // Фильтрация групп сервисов по категории
  const filteredServiceGroups = selectedCategory
    ? serviceGroups.filter((group) => {
        const groupName = group.name_ru.toLowerCase();
        const groupNameUz = group.name_uz.toLowerCase();
        const groupSlug = group.slug.toLowerCase();
        const categoryMap: { [key: string]: string[] } = {
          video: ['video', 'видео'],
          drive: ['drive', 'драйв', 'хранилище', 'storage'],
          cctv: ['cctv', 'камера', 'видеонаблюдение'],
          vps: ['vps', 'впс', 'виртуальный'],
          'vps-new': ['vps new', 'vps-new', 'новый vps', 'новый впс'],
          colocation: ['colocation', 'колокация', 'колокейшн'],
          ssl: ['ssl', 'сертификат', 'certificate'],
          temp: ['temp', 'временный', 'temporary'],
          nvr: ['nvr', 'нвр', 'видеорегистратор'],
        };
        const searchTerms = categoryMap[selectedCategory] || [];
        return searchTerms.some((term) => 
          groupName.includes(term) || 
          groupNameUz.includes(term) || 
          groupSlug.includes(term)
        );
      })
    : serviceGroups;

  // Категории с иконками и цветами
  const categories = [
    { id: 'video', name: 'Video', icon: 'videocam', color: '#EF4444' },
    { id: 'drive', name: 'Drive', icon: 'folder', color: '#3B82F6' },
    { id: 'cctv', name: 'CCTV', icon: 'camera', color: '#10B981' },
    { id: 'vps', name: 'VPS', icon: 'cloud', color: '#8B5CF6' },
    { id: 'vps-new', name: 'Vps new', icon: 'sparkles', color: '#06B6D4' },
    { id: 'colocation', name: 'Colocation', icon: 'server', color: '#F59E0B' },
    { id: 'ssl', name: 'SSL', icon: 'lock-closed', color: '#84CC16' },
    { id: 'temp', name: 'Temp', icon: 'time', color: '#A78BFA' },
    { id: 'nvr', name: 'NVR', icon: 'tv', color: '#EC4899' },
  ];

  // Компонент карточки группы сервисов с анимацией
  const ServiceGroupCard = React.memo(({ item, index }: { item: ServiceGroup; index: number }) => {
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
          style={styles.groupCard}
          onPress={() => handleOpenServiceGroup(item)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.9}
        >
      <View style={styles.groupHeader}>
        <View style={styles.groupIconContainer}>
          <Ionicons name="apps" size={24} color="#6366F1" />
        </View>
        <View style={styles.groupInfo}>
          <Text style={styles.groupName}>{item.name_ru}</Text>
          <Text style={styles.groupDescription} numberOfLines={2}>
            {item.description_ru || item.name_uz || 'Доступные тарифы и услуги'}
          </Text>
          <View style={styles.plansCountBadge}>
            <Text style={styles.plansCountText}>
              {item.plans_count} {item.plans_count === 1 ? 'тариф' : 'тарифов'}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </View>
        </TouchableOpacity>
      </Animated.View>
    );
  });

  // Функция рендеринга для FlatList
  const renderServiceGroupCard = ({ item, index }: { item: ServiceGroup; index: number }) => (
    <ServiceGroupCard item={item} index={index} />
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
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconContainer}>
              <Ionicons name="home" size={28} color="#6366F1" />
            </View>
            {user?.role === 'legal_entity' && user?.company_name && (
              <View style={styles.companyBadge}>
                <Ionicons name="business" size={12} color="#6366F1" />
                <Text style={styles.companyName}>{user.company_name}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity 
            onPress={() => router.push('/(user)/orders')} 
            style={styles.iconButton}
            activeOpacity={0.6}
          >
            <Ionicons name="cart-outline" size={24} color="#1F2937" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Category Buttons */}
      <View style={styles.categoriesContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScrollContent}
        >
          <TouchableOpacity
            style={[
              styles.categoryButton,
              selectedCategory === null && styles.categoryButtonActive
            ]}
            onPress={() => handleCategorySelect(null)}
            activeOpacity={0.7}
          >
            <View style={[
              styles.categoryIconContainer,
              selectedCategory === null && styles.categoryIconContainerActive
            ]}>
              <Ionicons 
                name="apps" 
                size={20} 
                color={selectedCategory === null ? '#4F46E5' : '#6B7280'} 
              />
            </View>
            <Text style={[
              styles.categoryText,
              selectedCategory === null && styles.categoryTextActive
            ]}>
              Все
            </Text>
          </TouchableOpacity>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryButton,
                selectedCategory === category.id && styles.categoryButtonActive
              ]}
              onPress={() => handleCategorySelect(category.id)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.categoryIconContainer,
                selectedCategory === category.id && styles.categoryIconContainerActive
              ]}>
                <Ionicons 
                  name={category.icon as any} 
                  size={20} 
                  color={selectedCategory === category.id ? '#4F46E5' : '#6B7280'} 
                />
              </View>
              <Text style={[
                styles.categoryText,
                selectedCategory === category.id && styles.categoryTextActive
              ]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      <View style={styles.contentSection}>
        <FlatList
          ListHeaderComponent={
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Сервисы</Text>
            </View>
          }
          data={filteredServiceGroups}
          renderItem={renderServiceGroupCard}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#6366F1']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="apps-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyText}>Нет доступных сервисов</Text>
            </View>
          }
        />
      </View>

      {/* Bottom Navigation Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={() => {}}
          activeOpacity={0.7}
        >
          <Ionicons name="home" size={24} color="#6366F1" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={() => router.push('/(user)/orders')}
          activeOpacity={0.7}
        >
          <Ionicons name="cart-outline" size={24} color="#9CA3AF" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.bottomNavItem}
          onPress={handleLogout}
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
    backgroundColor: '#F9FAFB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    fontFamily: Platform.OS === 'ios' ? '-apple-system, BlinkMacSystemFont, "SF Pro Display"' : 'Roboto, sans-serif',
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  companyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    gap: 4,
  },
  companyName: {
    fontSize: 11,
    color: '#6366F1',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  iconButton: {
    padding: 6,
    marginLeft: 8,
  },
  tabsContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tabsWrapper: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#6366F1',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    transform: [{ scale: 1.02 }],
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: Platform.OS === 'ios' ? '-apple-system, BlinkMacSystemFont, "SF Pro Display"' : 'Roboto, sans-serif',
    letterSpacing: 0.1,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  contentSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: '#F9FAFB',
  },
  sectionHeader: {
    marginBottom: 16,
    paddingHorizontal: 0,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 0,
    fontFamily: Platform.OS === 'ios' ? '-apple-system, BlinkMacSystemFont, "SF Pro Display"' : 'Roboto, sans-serif',
    letterSpacing: -0.5,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#94A3B8',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
    letterSpacing: 0,
  },
  listContent: {
    paddingBottom: 20,
  },
  // VPS Plan Card Styles
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  providerName: {
    fontSize: 11,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.8,
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
    marginBottom: 4,
  },
  planName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    fontFamily: Platform.OS === 'ios' ? '-apple-system, BlinkMacSystemFont, "SF Pro Display"' : 'Roboto, sans-serif',
    letterSpacing: -0.5,
  },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  regionText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  specsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    gap: 8,
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  specText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  priceText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    fontFamily: Platform.OS === 'ios' ? '-apple-system, BlinkMacSystemFont, "SF Pro Display"' : 'Roboto, sans-serif',
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  priceLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  // Service Group Card Styles
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  groupIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? '-apple-system, BlinkMacSystemFont, "SF Pro Display"' : 'Roboto, sans-serif',
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  groupDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 10,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
    letterSpacing: 0,
  },
  plansCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 0,
  },
  plansCountText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
    letterSpacing: 0,
  },
  orderButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  orderButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? '-apple-system, BlinkMacSystemFont, "SF Pro Display"' : 'Roboto, sans-serif',
    letterSpacing: 0.2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 16,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? '-apple-system' : 'Roboto',
  },
  categoriesContainer: {
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  categoriesScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 84,
    gap: 8,
  },
  categoryButtonActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
    borderWidth: 1,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
  },
  categoryIconContainerActive: {
    backgroundColor: '#FFFFFF',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    fontFamily: Platform.OS === 'ios' ? '-apple-system, BlinkMacSystemFont, "SF Pro Display"' : 'Roboto, sans-serif',
    letterSpacing: 0,
  },
  categoryTextActive: {
    fontWeight: '600',
    color: '#4F46E5',
  },
  // Bottom Navigation
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 8,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
});
