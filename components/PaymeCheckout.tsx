import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { API_URL } from '../config/api';
import { getHeaders } from '../config/fetch';

interface PaymeCheckoutProps {
  visible: boolean;
  onClose: () => void;
  onCardAdded: () => void;
}

export default function PaymeCheckout({
  visible,
  onClose,
  onCardAdded,
}: PaymeCheckoutProps) {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(false);
  const [paymeUrl, setPaymeUrl] = useState<string>('');

  // Загружаем URL при открытии модального окна
  useEffect(() => {
    if (visible) {
      loadPaymeUrl();
    }
  }, [visible]);

  const loadPaymeUrl = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        Alert.alert('Ошибка', 'Необходима авторизация');
        onClose();
        return;
      }

      const response = await fetch(`${API_URL}/api/cards/payme-checkout-url`, {
        method: 'POST',
        headers: getHeaders(token),
      });

      const data = await response.json();

      if (data.success && data.data.url) {
        setPaymeUrl(data.data.url);
      } else {
        Alert.alert('Ошибка', data.message || 'Не удалось создать страницу оплаты');
        onClose();
      }
    } catch (error) {
      console.error('Error loading Payme URL:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить страницу оплаты');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleNavigationStateChange = async (navState: WebViewNavigation) => {
    const { url } = navState;
    
    console.log('🔵 WebView URL:', url);

    // Проверяем, вернулся ли пользователь с успешной привязкой
    if (url.includes('/payment-success') || url.includes('success=true')) {
      setLoading(true);
      
      try {
        // Извлекаем параметры из URL
        const urlParams = new URLSearchParams(url.split('?')[1]);
        const cardToken = urlParams.get('card_token');
        const cardLast4 = urlParams.get('card_last4');
        
        if (cardToken) {
          // Сохраняем карту через API
          const token = await AsyncStorage.getItem('token');
          const response = await fetch(`${API_URL}/api/cards/save`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              card_token: cardToken,
              card_last4: cardLast4,
            }),
          });

          const data = await response.json();
          
          if (data.success) {
            Alert.alert('Успех', 'Карта успешно привязана', [
              {
                text: 'OK',
                onPress: () => {
                  onCardAdded();
                  onClose();
                },
              },
            ]);
          } else {
            Alert.alert('Ошибка', data.message || 'Не удалось сохранить карту');
          }
        }
      } catch (error) {
        console.error('Error saving card:', error);
        Alert.alert('Ошибка', 'Не удалось сохранить карту');
      } finally {
        setLoading(false);
      }
    } else if (url.includes('/payment-error') || url.includes('error=true')) {
      Alert.alert('Ошибка', 'Не удалось привязать карту');
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Привязка карты Payme</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Loading Indicator */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={styles.loadingText}>Загрузка...</Text>
          </View>
        )}

        {/* WebView */}
        {paymeUrl ? (
          <WebView
            ref={webViewRef}
            source={{ uri: paymeUrl }}
            style={styles.webView}
            onNavigationStateChange={handleNavigationStateChange}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4F46E5" />
              </View>
            )}
          />
        ) : (
          !loading && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Загрузка страницы оплаты...</Text>
            </View>
          )
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  webView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#4F46E5',
  },
});

