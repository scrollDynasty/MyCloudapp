import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
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
  created_at: string;
  updated_at: string;
}

export default function ServiceGroupsScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState<ServiceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/service-groups-admin?_t=${Date.now()}`, {
        headers: getHeaders(token || undefined),
        cache: 'no-store',
      });

      const data = await response.json();
      if (data.success) {
        setGroups(data.data);
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadGroups();
  };

  const handleDelete = async (group: ServiceGroup) => {
    const confirmDelete = Platform.OS === 'web' 
      ? window.confirm(`Вы уверены, что хотите удалить "${group.name_ru}"?`)
      : await new Promise((resolve) => {
          Alert.alert(
            'Удалить группу',
            `Вы уверены, что хотите удалить "${group.name_ru}"?`,
            [
              { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Удалить', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmDelete) return;

    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/service-groups-admin/${group.id}`, {
        method: 'DELETE',
        headers: getHeaders(token || undefined),
      });

      const data = await response.json();
      
      if (data.success) {
        if (Platform.OS === 'web') {
          alert('Группа успешно удалена');
        } else {
          Alert.alert('Успешно', 'Группа удалена');
        }
        loadGroups();
      } else {
        if (Platform.OS === 'web') {
          alert('Ошибка: ' + (data.error || 'Не удалось удалить группу'));
        } else {
          Alert.alert('Ошибка', data.error || 'Не удалось удалить группу');
        }
      }
    } catch (error) {
      console.error('Delete error:', error);
      if (Platform.OS === 'web') {
        alert('Ошибка при удалении группы');
      } else {
        Alert.alert('Ошибка', 'Не удалось удалить группу');
      }
    }
  };

  const toggleActive = async (group: ServiceGroup) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/service-groups-admin/${group.id}`, {
        method: 'PUT',
        headers: getHeaders(token || undefined),
        body: JSON.stringify({
          is_active: !group.is_active,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        loadGroups();
      }
    } catch (error) {
      console.error('Toggle error:', error);
    }
  };

  const renderGroupCard = ({ item }: { item: ServiceGroup }) => {
    return (
      <View style={styles.groupCard}>
        <View style={styles.groupHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.groupName}>{item.name_ru}</Text>
            <Text style={styles.groupNameUz}>{item.name_uz}</Text>
            <Text style={styles.slugText}>🔗 {item.slug}</Text>
            <Text style={styles.plansCount}>📋 Тарифов: {item.plans_count}</Text>
          </View>
          <TouchableOpacity
            style={[styles.activeBadge, { backgroundColor: item.is_active ? '#4caf50' : '#f44336' }]}
            onPress={() => toggleActive(item)}
          >
            <Text style={styles.activeText}>
              {item.is_active ? 'Активна' : 'Неактивна'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.groupFooter}>
          <Text style={styles.orderText}>Порядок: {item.display_order}</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.viewPlansButton}
              onPress={() => router.push(`/(admin)/service-plans?group_id=${item.id}&group_name=${encodeURIComponent(item.name_ru)}`)}
            >
              <Ionicons name="list" size={20} color="#667eea" />
              <Text style={styles.viewPlansText}>Тарифы</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => router.push(`/(admin)/service-group-form?id=${item.id}`)}
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
        <TouchableOpacity onPress={() => router.push('/(admin)/dashboard')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Группы сервисов</Text>
        <TouchableOpacity 
          onPress={() => router.push('/(admin)/service-group-form')} 
          style={styles.addButton}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Groups List */}
      <FlatList
        data={groups}
        renderItem={renderGroupCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#667eea']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="folder-open-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>Нет групп сервисов</Text>
            <Text style={styles.emptySubtext}>Создайте первую группу</Text>
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  addButton: {
    padding: 4,
  },
  listContent: {
    padding: 16,
  },
  groupCard: {
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
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  groupNameUz: {
    fontSize: 14,
    color: '#667eea',
    marginBottom: 4,
  },
  slugText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  plansCount: {
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
  groupFooter: {
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
    alignItems: 'center',
  },
  viewPlansButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
  },
  viewPlansText: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '600',
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
