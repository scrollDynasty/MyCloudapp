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

export default function ServiceGroupFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const groupId = params.id as string | undefined;
  const isEditMode = !!groupId;

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name_uz: '',
    name_ru: '',
    description_uz: '',
    description_ru: '',
    slug: '',
    icon: '',
    display_order: '0',
    is_active: true,
  });

  useEffect(() => {
    if (isEditMode) {
      loadGroup();
    }
  }, [groupId]);

  const loadGroup = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/service-groups-admin/${groupId}`, {
        headers: getHeaders(token || undefined),
      });

      const data = await response.json();
      if (data.success) {
        const group = data.data;
        setFormData({
          name_uz: group.name_uz,
          name_ru: group.name_ru,
          description_uz: group.description_uz || '',
          description_ru: group.description_ru || '',
          slug: group.slug,
          icon: group.icon || '',
          display_order: group.display_order.toString(),
          is_active: group.is_active,
        });
      }
    } catch (error) {
      console.error('Error loading group:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleNameRuChange = (text: string) => {
    setFormData({ ...formData, name_ru: text });
    // Auto-generate slug from Russian name if not in edit mode
    if (!isEditMode && !formData.slug) {
      setFormData(prev => ({ ...prev, name_ru: text, slug: generateSlug(text) }));
    }
  };

  const handleSave = async () => {
    // Validate
    const missingFields = [];
    if (!formData.name_uz) missingFields.push('Название (узбекский)');
    if (!formData.name_ru) missingFields.push('Название (русский)');
    if (!formData.slug) missingFields.push('Slug');
    
    if (missingFields.length > 0) {
      const message = `Пожалуйста, заполните обязательные поля:\n${missingFields.join('\n')}`;
      if (Platform.OS === 'web') {
        alert(message);
      } else {
        Alert.alert('Ошибка', message);
      }
      return;
    }

    setSaving(true);

    try {
      const requestBody = {
        name_uz: formData.name_uz,
        name_ru: formData.name_ru,
        description_uz: formData.description_uz || null,
        description_ru: formData.description_ru || null,
        slug: formData.slug,
        icon: formData.icon || null,
        display_order: parseInt(formData.display_order) || 0,
        is_active: formData.is_active,
      };

      const token = await AsyncStorage.getItem('token');
      const url = isEditMode 
        ? `${API_URL}/api/service-groups-admin/${groupId}`
        : `${API_URL}/api/service-groups-admin`;
      
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: getHeaders(token || undefined),
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();
      
      if (data.success) {
        if (Platform.OS === 'web') {
          alert(isEditMode ? 'Группа обновлена' : 'Группа создана');
        } else {
          Alert.alert('Успешно', isEditMode ? 'Группа обновлена' : 'Группа создана');
        }
        router.back();
      } else {
        if (Platform.OS === 'web') {
          alert('Ошибка: ' + (data.error || 'Не удалось сохранить группу'));
        } else {
          Alert.alert('Ошибка', data.error || 'Не удалось сохранить группу');
        }
      }
    } catch (error) {
      console.error('Save error:', error);
      if (Platform.OS === 'web') {
        alert('Ошибка при сохранении группы');
      } else {
        Alert.alert('Ошибка', 'Не удалось сохранить группу');
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
          {isEditMode ? 'Редактировать группу' : 'Новая группа'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Name Russian */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Название (русский) *</Text>
          <TextInput
            style={styles.input}
            value={formData.name_ru}
            onChangeText={handleNameRuChange}
            placeholder="MC Video"
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
            placeholder="MC Video"
            placeholderTextColor="#999"
          />
        </View>

        {/* Slug */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Slug (URL) *</Text>
          <TextInput
            style={styles.input}
            value={formData.slug}
            onChangeText={(text) => setFormData({ ...formData, slug: generateSlug(text) })}
            placeholder="mc-video"
            placeholderTextColor="#999"
            autoCapitalize="none"
          />
          <Text style={styles.hint}>Используется в URL. Только латиница, цифры и дефис</Text>
        </View>

        {/* Description Russian */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Описание (русский)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description_ru}
            onChangeText={(text) => setFormData({ ...formData, description_ru: text })}
            placeholder="Описание группы сервисов"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Description Uzbek */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Описание (узбекский)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description_uz}
            onChangeText={(text) => setFormData({ ...formData, description_uz: text })}
            placeholder="Xizmatlar guruhi tavsifi"
            placeholderTextColor="#999"
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Icon */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Иконка</Text>
          <TextInput
            style={styles.input}
            value={formData.icon}
            onChangeText={(text) => setFormData({ ...formData, icon: text })}
            placeholder="📹 или URL иконки"
            placeholderTextColor="#999"
          />
          <Text style={styles.hint}>Эмодзи или URL изображения</Text>
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
          <Text style={styles.hint}>Меньшее число = выше в списке</Text>
        </View>

        {/* Active Toggle */}
        <TouchableOpacity
          style={styles.toggleRow}
          onPress={() => setFormData({ ...formData, is_active: !formData.is_active })}
        >
          <Text style={styles.toggleLabel}>Активна</Text>
          <View style={[styles.toggle, formData.is_active && styles.toggleActive]}>
            <View style={[styles.toggleCircle, formData.is_active && styles.toggleCircleActive]} />
          </View>
        </TouchableOpacity>

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
              {isEditMode ? 'Сохранить изменения' : 'Создать группу'}
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
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
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
