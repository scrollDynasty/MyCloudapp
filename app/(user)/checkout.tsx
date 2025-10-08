import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const API_URL = 'http://localhost:5000';

interface OrderDetails {
  order_id: number;
  plan_name: string;
  provider_name: string;
  cpu_cores: number;
  memory_gb: number;
  storage_gb: number;
  bandwidth_tb: number;
  amount: number;
  currency: string;
  full_name: string;
  email: string;
}

export default function CheckoutScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  useEffect(() => {
    if (orderId) {
      loadOrderDetails();
    }
  }, [orderId]);

  const loadOrderDetails = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        setOrder(data.data);
      }
    } catch (error) {
      console.error('Error loading order:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePayWithPayme = async () => {
    try {
      setProcessing(true);
      const token = await AsyncStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/api/payments/payme`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          order_id: orderId,
          return_url: Platform.OS === 'web' 
            ? `http://localhost:8081/(user)/orders`
            : 'myapp://orders',
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setCheckoutUrl(data.data.checkout_url);
        
        // Open Payme checkout in browser
        if (Platform.OS === 'web') {
          const paymentWindow = window.open(data.data.checkout_url, '_blank');
          
          if (paymentWindow) {
            console.log('✅ Payment URL:', data.data.checkout_url);
          } else {
            // If popup blocked, show the URL
            alert('⚠️ Разрешите всплывающие окна или используйте эту ссылку:\n\n' + data.data.checkout_url);
          }
        } else {
          const canOpen = await Linking.canOpenURL(data.data.checkout_url);
          if (canOpen) {
            await Linking.openURL(data.data.checkout_url);
          } else {
            alert('Не удалось открыть страницу оплаты');
          }
        }
      } else {
        // Improved error message
        let errorMsg = 'Ошибка создания платежа: ' + data.error;
        
        if (data.error && data.error.includes('Merchant')) {
          errorMsg += '\n\n💡 Для разработки: настройте тестовый Merchant ID в .env файле.\nПодробности в backend/PAYME_SETUP.md';
        }
        
        alert(errorMsg);
        console.error('Payment error:', data);
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('Не удалось инициировать оплату. Проверьте консоль для деталей.');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Загрузка деталей заказа...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="alert-circle" size={64} color="#f44336" />
        <Text style={styles.errorText}>Заказ не найден</Text>
        <TouchableOpacity style={styles.backButton} onPress={handleCancel}>
          <Text style={styles.backButtonText}>Вернуться назад</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Оформление заказа</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Order Summary Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="server" size={32} color="#667eea" />
          <Text style={styles.cardTitle}>Детали VPS</Text>
        </View>

        <View style={styles.orderInfo}>
          <Text style={styles.providerName}>{order.provider_name}</Text>
          <Text style={styles.planName}>{order.plan_name}</Text>
        </View>

        <View style={styles.specsGrid}>
          <View style={styles.specBox}>
            <Ionicons name="hardware-chip" size={24} color="#667eea" />
            <Text style={styles.specValue}>{order.cpu_cores}</Text>
            <Text style={styles.specLabel}>CPU Cores</Text>
          </View>
          <View style={styles.specBox}>
            <Ionicons name="server" size={24} color="#667eea" />
            <Text style={styles.specValue}>{order.memory_gb} GB</Text>
            <Text style={styles.specLabel}>RAM</Text>
          </View>
          <View style={styles.specBox}>
            <Ionicons name="save" size={24} color="#667eea" />
            <Text style={styles.specValue}>{order.storage_gb} GB</Text>
            <Text style={styles.specLabel}>Storage</Text>
          </View>
          <View style={styles.specBox}>
            <Ionicons name="swap-horizontal" size={24} color="#667eea" />
            <Text style={styles.specValue}>{order.bandwidth_tb} TB</Text>
            <Text style={styles.specLabel}>Bandwidth</Text>
          </View>
        </View>
      </View>

      {/* Customer Info */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="person" size={28} color="#667eea" />
          <Text style={styles.cardTitle}>Данные клиента</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={20} color="#666" />
          <Text style={styles.infoText}>{order.full_name}</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="mail-outline" size={20} color="#666" />
          <Text style={styles.infoText}>{order.email}</Text>
        </View>
      </View>

      {/* Price Summary */}
      <View style={styles.priceCard}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Подписка (ежемесячно)</Text>
          <Text style={styles.priceValue}>
            {order.amount} {order.currency}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>К оплате</Text>
          <Text style={styles.totalValue}>
            {order.amount} {order.currency}
          </Text>
        </View>
      </View>

      {/* Payment Instructions */}
      <View style={styles.instructionsCard}>
        <Ionicons name="information-circle" size={24} color="#2196f3" />
        <Text style={styles.instructionsText}>
          После нажатия кнопки оплаты вы будете перенаправлены на страницу Payme для завершения транзакции.
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={handleCancel}
          disabled={processing}
        >
          <Text style={styles.cancelButtonText}>Отменить</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.payButton, processing && styles.payButtonDisabled]}
          onPress={handlePayWithPayme}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="card" size={24} color="#fff" />
              <Text style={styles.payButtonText}>Оплатить через Payme</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {checkoutUrl && (
        <View style={styles.linkCard}>
          <Text style={styles.linkLabel}>Ссылка на оплату:</Text>
          <Text style={styles.linkText} numberOfLines={1}>
            {checkoutUrl}
          </Text>
        </View>
      )}
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
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 40,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 12,
  },
  orderInfo: {
    marginBottom: 20,
  },
  providerName: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
    marginBottom: 4,
  },
  planName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
  },
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  specBox: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  specValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 8,
  },
  specLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  priceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 16,
    color: '#666',
  },
  priceValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#667eea',
  },
  instructionsCard: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  instructionsText: {
    flex: 1,
    fontSize: 14,
    color: '#1976d2',
    marginLeft: 12,
    lineHeight: 20,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  payButton: {
    backgroundColor: '#667eea',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  payButtonDisabled: {
    backgroundColor: '#9e9e9e',
    shadowOpacity: 0,
    elevation: 0,
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  linkCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  linkLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  linkText: {
    fontSize: 14,
    color: '#667eea',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  errorText: {
    fontSize: 18,
    color: '#f44336',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
