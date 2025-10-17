import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

interface PlanField {
  id?: number;
  field_key: string;
  field_label_uz: string;
  field_label_ru: string;
  field_value_uz: string;
  field_value_ru: string;
  field_type: string;
  display_order: number;
}

export default function ServicePlanFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const planId = params.id as string | undefined;
  const groupId = params.group_id as string;
  const isEditMode = !!planId;

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    group_id: groupId,
    name_uz: '',
    name_ru: '',
    description_uz: '',
    description_ru: '',
    price: '',
    discount_price: '',
    currency: 'UZS',
    billing_period: 'monthly',
    display_order: '0',
    is_active: true,
  });

  const [fields, setFields] = useState<PlanField[]>([]);

  useEffect(() => {
    if (isEditMode) {
      loadPlan();
    }
  }, [planId]);

  const loadPlan = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/service-plans-admin/${planId}`, {
        headers: getHeaders(token || undefined),
      });

      const data = await response.json();
      if (data.success) {
        const plan = data.data;
        setFormData({
          group_id: plan.group_id.toString(),
          name_uz: plan.name_uz,
          name_ru: plan.name_ru,
          description_uz: plan.description_uz || '',
          description_ru: plan.description_ru || '',
          price: plan.price.toString(),
          discount_price: plan.discount_price?.toString() || '',
          currency: plan.currency,
          billing_period: plan.billing_period,
          display_order: plan.display_order.toString(),
          is_active: plan.is_active,
        });
        setFields(plan.fields || []);
      }
    } catch (error) {
      console.error('Error loading plan:', error);
    } finally {
      setLoading(false);
    }
  };

  const addField = () => {
    setFields([
      ...fields,
      {
        field_key: '',
        field_label_uz: '',
        field_label_ru: '',
        field_value_uz: '',
        field_value_ru: '',
        field_type: 'text',
        display_order: fields.length,
      },
    ]);
  };

  const updateField = (index: number, key: keyof PlanField, value: string | number) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], [key]: value };
    setFields(newFields);
  };

  const removeField = (index: number) => {
    const newFields = fields.filter((_, i) => i !== index);
    // Reorder remaining fields
    newFields.forEach((field, i) => {
      field.display_order = i;
    });
    setFields(newFields);
  };

  const moveFieldUp = (index: number) => {
    if (index === 0) return;
    const newFields = [...fields];
    [newFields[index - 1], newFields[index]] = [newFields[index], newFields[index - 1]];
    // Update display order
    newFields.forEach((field, i) => {
      field.display_order = i;
    });
    setFields(newFields);
  };

  const moveFieldDown = (index: number) => {
    if (index === fields.length - 1) return;
    const newFields = [...fields];
    [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
    // Update display order
    newFields.forEach((field, i) => {
      field.display_order = i;
    });
    setFields(newFields);
  };

  const handleSave = async () => {
    // Validate
    const missingFields = [];
    if (!formData.name_uz) missingFields.push('Название (узбекский)');
    if (!formData.name_ru) missingFields.push('Название (русский)');
    if (!formData.price) missingFields.push('Цена');
    
    if (missingFields.length > 0) {
      const message = `Пожалуйста, заполните обязательные поля:\n${missingFields.join('\n')}`;
      if (Platform.OS === 'web') {
        alert(message);
      } else {
        Alert.alert('Ошибка', message);
      }
      return;
    }

    // Validate fields
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      if (!field.field_key || !field.field_label_uz || !field.field_label_ru) {
        const message = `Поле ${i + 1}: заполните ключ и названия на обоих языках`;
        if (Platform.OS === 'web') {
          alert(message);
        } else {
          Alert.alert('Ошибка', message);
        }
        return;
      }
    }

    setSaving(true);

    try {
      const requestBody = {
        group_id: parseInt(formData.group_id),
        name_uz: formData.name_uz,
        name_ru: formData.name_ru,
        description_uz: formData.description_uz || null,
        description_ru: formData.description_ru || null,
        price: parseFloat(formData.price),
        discount_price: formData.discount_price ? parseFloat(formData.discount_price) : null,
        currency: formData.currency,
        billing_period: formData.billing_period,
        display_order: parseInt(formData.display_order) || 0,
        is_active: formData.is_active,
        fields: fields,
      };

      const token = await AsyncStorage.getItem('token');
      const url = isEditMode 
        ? `${API_URL}/api/service-plans-admin/${planId}`
        : `${API_URL}/api/service-plans-admin`;
      
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: getHeaders(token || undefined),
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      
      if (data.success) {
        if (Platform.OS === 'web') {
          alert(isEditMode ? 'Тариф обновлен' : 'Тариф создан');
        } else {
          Alert.alert('Успешно', isEditMode ? 'Тариф обновлен' : 'Тариф создан');
        }
        router.back();
      } else {
        if (Platform.OS === 'web') {
          alert('Ошибка: ' + (data.error || 'Не удалось сохранить тариф'));
        } else {
          Alert.alert('Ошибка', data.error || 'Не удалось сохранить тариф');
        }
      }
    } catch (error) {
      console.error('Save error:', error);
      if (Platform.OS === 'web') {
        alert('Ошибка при сохранении тарифа');
      } else {
        Alert.alert('Ошибка', 'Не удалось сохранить тариф');
      }
    } finally {
      setSaving(false);
    }
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditMode ? 'Редактировать тариф' : 'Новый тариф'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Basic Info Section */}
        <Text style={styles.sectionTitle}>Основная информация</Text>

        {/* Name Russian */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Название (русский) *</Text>
          <TextInput
            style={styles.input}
            value={formData.name_ru}
            onChangeText={(text) => setFormData({ ...formData, name_ru: text })}
            placeholder="VPS-25"
            placeholderTextColor="#999"
          />
        </View>

        {/* Name Uzbek */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Название (узбекский) *</Text>
          <TextInput
            style={styles.input}
            value={formData.name_uz}
            onChangeText={(text) => setFormData({ ...formData, name_uz: text })}
            placeholder="VPS-25"
            placeholderTextColor="#999"
          />
        </View>

        {/* Price */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Цена *</Text>
          <View style={styles.priceRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={formData.price}
              onChangeText={(text) => setFormData({ ...formData, price: text })}
              placeholder="142500"
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
            <View style={styles.currencyBox}>
              <Text style={styles.currencyText}>{formData.currency}</Text>
            </View>
          </View>
        </View>

        {/* Discount Price */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Цена со скидкой</Text>
          <TextInput
            style={styles.input}
            value={formData.discount_price}
            onChangeText={(text) => setFormData({ ...formData, discount_price: text })}
            placeholder="120000"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
        </View>

        {/* Billing Period */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Период оплаты</Text>
          <View style={styles.periodRow}>
            {[
              { value: 'monthly', label: 'Месяц' },
              { value: 'yearly', label: 'Год' },
              { value: 'once', label: 'Единоразово' },
            ].map((period) => (
              <TouchableOpacity
                key={period.value}
                style={[
                  styles.periodButton,
                  formData.billing_period === period.value && styles.periodButtonActive
                ]}
                onPress={() => setFormData({ ...formData, billing_period: period.value })}
              >
                <Text style={[
                  styles.periodButtonText,
                  formData.billing_period === period.value && styles.periodButtonTextActive
                ]}>
                  {period.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Display Order */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Порядок отображения</Text>
          <TextInput
            style={styles.input}
            value={formData.display_order}
            onChangeText={(text) => setFormData({ ...formData, display_order: text })}
            placeholder="0"
            placeholderTextColor="#999"
            keyboardType="numeric"
          />
        </View>

        {/* Active Toggle */}
        <TouchableOpacity
          style={styles.toggleRow}
          onPress={() => setFormData({ ...formData, is_active: !formData.is_active })}
        >
          <Text style={styles.toggleLabel}>Активен</Text>
          <View style={[styles.toggle, formData.is_active && styles.toggleActive]}>
            <View style={[styles.toggleCircle, formData.is_active && styles.toggleCircleActive]} />
          </View>
        </TouchableOpacity>

        {/* Fields Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Характеристики</Text>
          <TouchableOpacity onPress={addField} style={styles.addFieldButton}>
            <Ionicons name="add-circle" size={24} color="#667eea" />
            <Text style={styles.addFieldText}>Добавить поле</Text>
          </TouchableOpacity>
        </View>

        {fields.map((field, index) => (
          <View key={index} style={styles.fieldCard}>
            <View style={styles.fieldCardHeader}>
              <Text style={styles.fieldCardTitle}>Поле {index + 1}</Text>
              <View style={styles.fieldActions}>
                {index > 0 && (
                  <TouchableOpacity onPress={() => moveFieldUp(index)} style={styles.fieldActionButton}>
                    <Ionicons name="arrow-up" size={20} color="#667eea" />
                  </TouchableOpacity>
                )}
                {index < fields.length - 1 && (
                  <TouchableOpacity onPress={() => moveFieldDown(index)} style={styles.fieldActionButton}>
                    <Ionicons name="arrow-down" size={20} color="#667eea" />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => removeField(index)} style={styles.fieldActionButton}>
                  <Ionicons name="trash-outline" size={20} color="#f44336" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Field Key */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Ключ (латиница) *</Text>
              <TextInput
                style={styles.input}
                value={field.field_key}
                onChangeText={(text) => updateField(index, 'field_key', text.toLowerCase())}
                placeholder="cpu, ram, disk"
                placeholderTextColor="#999"
                autoCapitalize="none"
              />
            </View>

            {/* Field Label RU */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Название (русский) *</Text>
              <TextInput
                style={styles.input}
                value={field.field_label_ru}
                onChangeText={(text) => updateField(index, 'field_label_ru', text)}
                placeholder="Процессор"
                placeholderTextColor="#999"
              />
            </View>

            {/* Field Label UZ */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Название (узбекский) *</Text>
              <TextInput
                style={styles.input}
                value={field.field_label_uz}
                onChangeText={(text) => updateField(index, 'field_label_uz', text)}
                placeholder="Protsessor"
                placeholderTextColor="#999"
              />
            </View>

            {/* Field Value RU */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Значение (русский)</Text>
              <TextInput
                style={styles.input}
                value={field.field_value_ru}
                onChangeText={(text) => updateField(index, 'field_value_ru', text)}
                placeholder="Intel Xeon Gold CPU"
                placeholderTextColor="#999"
              />
            </View>

            {/* Field Value UZ */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Значение (узбекский)</Text>
              <TextInput
                style={styles.input}
                value={field.field_value_uz}
                onChangeText={(text) => updateField(index, 'field_value_uz', text)}
                placeholder="Intel Xeon Gold CPU"
                placeholderTextColor="#999"
              />
            </View>
          </View>
        ))}

        {fields.length === 0 && (
          <View style={styles.emptyFields}>
            <Text style={styles.emptyFieldsText}>Нет характеристик</Text>
            <Text style={styles.emptyFieldsSubtext}>Добавьте характеристики тарифа</Text>
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]} 
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>
              {isEditMode ? 'Сохранить изменения' : 'Создать тариф'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  content: {
    flex: 1,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  addFieldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addFieldText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  priceRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  currencyBox: {
    backgroundColor: '#667eea',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  currencyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: '#e3f2fd',
    borderColor: '#667eea',
  },
  periodButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  periodButtonTextActive: {
    color: '#667eea',
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
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
  fieldCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  fieldCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  fieldCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
  },
  fieldActions: {
    flexDirection: 'row',
    gap: 8,
  },
  fieldActionButton: {
    padding: 4,
  },
  emptyFields: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 20,
  },
  emptyFieldsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
  },
  emptyFieldsSubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: '#667eea',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
