import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const API_URL = 'http://localhost:5000';

interface VPSPlan {
  id: number;
  plan_name: string;
  provider_name: string;
  provider_id: number;
  cpu_cores: number;
  memory_gb: number;
  storage_gb: number;
  bandwidth_tb: number;
  price_per_month: number;
  currency: string;
  region: string;
  available: boolean;
}

interface Provider {
  id: number;
  name: string;
  country: string;
}

export default function AdminPlansScreen() {
  const router = useRouter();
  const [plans, setPlans] = useState<VPSPlan[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<VPSPlan | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    plan_name: '',
    provider_id: '',
    cpu_cores: '',
    memory_gb: '',
    storage_gb: '',
    bandwidth_tb: '',
    price_per_month: '',
    currency: 'UZS',
    region: '',
    available: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([loadPlans(), loadProviders()]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadPlans = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/vps?limit=100&_t=${Date.now()}`, {
        headers: { 
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      const data = await response.json();
      if (data.success) {
        setPlans(data.data);
      }
    } catch (error) {
      console.error('Error loading plans:', error);
    }
  };

  const loadProviders = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/providers`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setProviders(data.data);
      }
    } catch (error) {
      console.error('Error loading providers:', error);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const openAddModal = () => {
    setEditMode(false);
    setSelectedPlan(null);
    setFormData({
      plan_name: '',
      provider_id: providers[0]?.id.toString() || '',
      cpu_cores: '',
      memory_gb: '',
      storage_gb: '',
      bandwidth_tb: '',
      price_per_month: '',
      currency: 'UZS',
      region: 'Узбекистан',
      available: true,
    });
    setModalVisible(true);
  };

  const openEditModal = (plan: VPSPlan) => {
    setEditMode(true);
    setSelectedPlan(plan);
    setFormData({
      plan_name: plan.plan_name,
      provider_id: plan.provider_id?.toString() || '',
      cpu_cores: plan.cpu_cores?.toString() || '',
      memory_gb: plan.memory_gb?.toString() || '',
      storage_gb: plan.storage_gb?.toString() || '',
      bandwidth_tb: plan.bandwidth_tb?.toString() || '',
      price_per_month: plan.price_per_month?.toString() || '',
      currency: plan.currency || 'UZS',
      region: plan.region || '',
      available: plan.available ?? true,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      // Validate
      const missingFields = [];
      if (!formData.plan_name) missingFields.push('plan_name');
      if (!formData.provider_id) missingFields.push('provider_id');
      if (!formData.cpu_cores) missingFields.push('cpu_cores');
      if (!formData.memory_gb) missingFields.push('memory_gb');
      if (!formData.storage_gb) missingFields.push('storage_gb');
      if (!formData.price_per_month) missingFields.push('price_per_month');
      
      if (missingFields.length > 0) {
        console.error('❌ Validation failed. Missing fields:', missingFields);
        alert(`Пожалуйста, заполните обязательные поля: ${missingFields.join(', ')}`);
        return;
      }

      const requestBody = {
        plan_name: formData.plan_name,
        provider_id: parseInt(formData.provider_id),
        cpu_cores: parseInt(formData.cpu_cores),
        memory_gb: parseFloat(formData.memory_gb),
        storage_gb: parseFloat(formData.storage_gb),
        bandwidth_tb: parseFloat(formData.bandwidth_tb || '0'),
        price_per_month: parseFloat(formData.price_per_month),
        currency: formData.currency,
        region: formData.region,
        available: formData.available,
      };

      const token = await AsyncStorage.getItem('token');
      const url = editMode 
        ? `${API_URL}/api/vps-admin/${selectedPlan?.id}`
        : `${API_URL}/api/vps-admin`;
      
      const method = editMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      
      if (data.success) {
        Alert.alert('Успешно', editMode ? 'План обновлен' : 'План создан');
        setModalVisible(false);
        loadPlans();
      } else {
        Alert.alert('Ошибка', data.error || 'Не удалось сохранить план');
      }
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Ошибка', 'Не удалось сохранить план');
    }
  };

  const handleDelete = async (plan: VPSPlan) => {
    // Use native confirm for web, Alert for mobile
    const confirmDelete = Platform.OS === 'web' 
      ? window.confirm(`Вы уверены, что хотите удалить "${plan.plan_name}"?`)
      : await new Promise((resolve) => {
          Alert.alert(
            'Удалить план',
            `Вы уверены, что хотите удалить "${plan.plan_name}"?`,
            [
              { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Удалить', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmDelete) return;

    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/vps-admin/${plan.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      
      if (data.success) {
        if (Platform.OS === 'web') {
          alert('План успешно удален');
        } else {
          Alert.alert('Успешно', 'План удален');
        }
        loadPlans();
      } else {
        if (Platform.OS === 'web') {
          alert('Ошибка: ' + (data.error || 'Не удалось удалить план'));
        } else {
          Alert.alert('Ошибка', data.error || 'Не удалось удалить план');
        }
      }
    } catch (error) {
      console.error('Delete error:', error);
      if (Platform.OS === 'web') {
        alert('Ошибка при удалении плана');
      } else {
        Alert.alert('Ошибка', 'Не удалось удалить план');
      }
    }
  };

  const toggleAvailability = async (plan: VPSPlan) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/vps-admin/${plan.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          available: !plan.available,
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

  const renderPlanCard = ({ item }: { item: VPSPlan }) => {
    return (
    <View style={styles.planCard}>
      <View style={styles.planHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.planName}>{item.plan_name}</Text>
          <Text style={styles.providerName}>{item.provider_name}</Text>
          <Text style={styles.regionText}>📍 {item.region}</Text>
        </View>
        <TouchableOpacity
          style={[styles.availabilityBadge, { backgroundColor: item.available ? '#4caf50' : '#f44336' }]}
          onPress={() => toggleAvailability(item)}
        >
          <Text style={styles.availabilityText}>
            {item.available ? 'Доступен' : 'Недоступен'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.specsGrid}>
        <View style={styles.specItem}>
          <Ionicons name="hardware-chip" size={16} color="#667eea" />
          <Text style={styles.specText}>{item.cpu_cores} CPU</Text>
        </View>
        <View style={styles.specItem}>
          <Ionicons name="server" size={16} color="#667eea" />
          <Text style={styles.specText}>{item.memory_gb} GB RAM</Text>
        </View>
        <View style={styles.specItem}>
          <Ionicons name="save" size={16} color="#667eea" />
          <Text style={styles.specText}>{item.storage_gb} GB</Text>
        </View>
        <View style={styles.specItem}>
          <Ionicons name="swap-horizontal" size={16} color="#667eea" />
          <Text style={styles.specText}>{item.bandwidth_tb} TB</Text>
        </View>
      </View>

      <View style={styles.planFooter}>
        <Text style={styles.priceText}>
          {item.price_per_month} {item.currency}/мес
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => openEditModal(item)}
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
        <Text style={styles.headerTitle}>Управление VPS планами</Text>
        <TouchableOpacity onPress={openAddModal} style={styles.addButton}>
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
      />

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editMode ? 'Редактировать план' : 'Добавить план'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
              {/* Provider Selector */}
              <Text style={styles.label}>Провайдер *</Text>
              <View style={styles.pickerContainer}>
                {providers.map((provider) => (
                  <TouchableOpacity
                    key={provider.id}
                    style={[
                      styles.providerOption,
                      formData.provider_id === provider.id.toString() && styles.providerOptionSelected
                    ]}
                    onPress={() => setFormData({ ...formData, provider_id: provider.id.toString() })}
                  >
                    <Text style={[
                      styles.providerOptionText,
                      formData.provider_id === provider.id.toString() && styles.providerOptionTextSelected
                    ]}>
                      {provider.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Plan Name */}
              <Text style={styles.label}>Название плана *</Text>
              <TextInput
                style={styles.input}
                value={formData.plan_name}
                onChangeText={(text) => setFormData({ ...formData, plan_name: text })}
                placeholder="VPS Basic"
                placeholderTextColor="#999"
              />

              {/* CPU Cores */}
              <Text style={styles.label}>CPU ядра *</Text>
              <TextInput
                style={styles.input}
                value={formData.cpu_cores}
                onChangeText={(text) => setFormData({ ...formData, cpu_cores: text })}
                placeholder="2"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />

              {/* Memory */}
              <Text style={styles.label}>RAM (GB) *</Text>
              <TextInput
                style={styles.input}
                value={formData.memory_gb}
                onChangeText={(text) => setFormData({ ...formData, memory_gb: text })}
                placeholder="4"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />

              {/* Storage */}
              <Text style={styles.label}>Хранилище (GB) *</Text>
              <TextInput
                style={styles.input}
                value={formData.storage_gb}
                onChangeText={(text) => setFormData({ ...formData, storage_gb: text })}
                placeholder="80"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />

              {/* Bandwidth */}
              <Text style={styles.label}>Пропускная способность (TB)</Text>
              <TextInput
                style={styles.input}
                value={formData.bandwidth_tb}
                onChangeText={(text) => setFormData({ ...formData, bandwidth_tb: text })}
                placeholder="1"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />

              {/* Price */}
              <Text style={styles.label}>Цена в месяц *</Text>
              <View style={styles.priceRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={formData.price_per_month}
                  onChangeText={(text) => setFormData({ ...formData, price_per_month: text })}
                  placeholder="50000"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
                <View style={styles.currencySelector}>
                  {['UZS', 'USD'].map((curr) => (
                    <TouchableOpacity
                      key={curr}
                      style={[
                        styles.currencyButton,
                        formData.currency === curr && styles.currencyButtonSelected
                      ]}
                      onPress={() => setFormData({ ...formData, currency: curr })}
                    >
                      <Text style={[
                        styles.currencyButtonText,
                        formData.currency === curr && styles.currencyButtonTextSelected
                      ]}>
                        {curr}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Region */}
              <Text style={styles.label}>Регион</Text>
              <TextInput
                style={styles.input}
                value={formData.region}
                onChangeText={(text) => setFormData({ ...formData, region: text })}
                placeholder="Узбекистан"
                placeholderTextColor="#999"
              />

              {/* Available Toggle */}
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setFormData({ ...formData, available: !formData.available })}
              >
                <Text style={styles.toggleLabel}>Доступен для заказа</Text>
                <View style={[styles.toggle, formData.available && styles.toggleActive]}>
                  <View style={[styles.toggleCircle, formData.available && styles.toggleCircleActive]} />
                </View>
              </TouchableOpacity>
            </ScrollView>

            {/* Save Button */}
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>
                {editMode ? 'Сохранить изменения' : 'Создать план'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  providerName: {
    fontSize: 14,
    color: '#667eea',
    marginBottom: 4,
  },
  regionText: {
    fontSize: 12,
    color: '#999',
  },
  availabilityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  availabilityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  specItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  specText: {
    fontSize: 14,
    color: '#666',
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
  priceText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#667eea',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  form: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  providerOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  providerOptionSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#667eea',
  },
  providerOptionText: {
    fontSize: 14,
    color: '#666',
  },
  providerOptionTextSelected: {
    color: '#667eea',
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  currencySelector: {
    flexDirection: 'row',
    gap: 8,
  },
  currencyButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  currencyButtonSelected: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  currencyButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  currencyButtonTextSelected: {
    color: '#fff',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  toggleLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ccc',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: '#4caf50',
  },
  toggleCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  toggleCircleActive: {
    transform: [{ translateX: 22 }],
  },
  saveButton: {
    backgroundColor: '#667eea',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
