import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { API_URL } from '../../config/api';
import { getHeaders } from '../../config/fetch';

export default function PaymentSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = params.order_id as string;

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orderId) {
      checkOrderStatus();
    } else {
      setError('Order ID not provided');
      setLoading(false);
    }
  }, [orderId]);

  const checkOrderStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/orders/${orderId}`, {
        headers: getHeaders(token || undefined),
      });

      const data = await response.json();
      if (data.success) {
        setOrder(data.data);
      } else {
        setError('Failed to load order details');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToOrders = () => {
    router.replace('/(user)/orders');
  };

  const handleGoToHome = () => {
    router.replace('/(user)/home');
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Проверка статуса платежа...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle" size={80} color="#f44336" />
        <Text style={styles.errorTitle}>Ошибка</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={handleGoToHome}>
          <Text style={styles.buttonText}>На главную</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isPaid = order?.payment_status === 'paid';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.iconContainer}>
        {isPaid ? (
          <Ionicons name="checkmark-circle" size={100} color="#4caf50" />
        ) : (
          <Ionicons name="time" size={100} color="#ff9800" />
        )}
      </View>

      <Text style={styles.title}>
        {isPaid ? 'Оплата успешна!' : 'Платёж обрабатывается'}
      </Text>

      <Text style={styles.subtitle}>
        {isPaid
          ? 'Ваш заказ успешно оплачен и будет обработан в ближайшее время.'
          : 'Ваш платёж находится в обработке. Это может занять несколько минут.'}
      </Text>

      <View style={styles.orderCard}>
        <View style={styles.orderRow}>
          <Text style={styles.orderLabel}>Номер заказа:</Text>
          <Text style={styles.orderValue}>#{orderId}</Text>
        </View>

        {order?.amount && (
          <View style={styles.orderRow}>
            <Text style={styles.orderLabel}>Сумма:</Text>
            <Text style={styles.orderValue}>
              {order.amount} {order.currency || 'UZS'}
            </Text>
          </View>
        )}

        <View style={styles.orderRow}>
          <Text style={styles.orderLabel}>Статус:</Text>
          <View style={[styles.statusBadge, isPaid ? styles.statusPaid : styles.statusPending]}>
            <Text style={styles.statusText}>
              {isPaid ? 'Оплачен' : 'В обработке'}
            </Text>
          </View>
        </View>
      </View>

      {!isPaid && (
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#2196f3" />
          <Text style={styles.infoText}>
            Платёж может обрабатываться до 15 минут. Вы получите уведомление на email после завершения.
          </Text>
        </View>
      )}

      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleGoToHome}
        >
          <Text style={styles.secondaryButtonText}>На главную</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={handleGoToOrders}>
          <Ionicons name="list" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.buttonText}>Мои заказы</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  contentContainer: {
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    padding: 20,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  orderLabel: {
    fontSize: 16,
    color: '#666',
  },
  orderValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusPaid: {
    backgroundColor: '#e8f5e9',
  },
  statusPending: {
    backgroundColor: '#fff3e0',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  infoCard: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1976d2',
    marginLeft: 12,
    lineHeight: 20,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#667eea',
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    shadowOpacity: 0,
    elevation: 0,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f44336',
    marginTop: 20,
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
});
