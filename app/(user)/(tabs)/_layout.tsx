import { Ionicons } from '@expo/vector-icons';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { withLayoutContext } from 'expo-router';
import { Dimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { Navigator } = createMaterialTopTabNavigator();

export const MaterialTopTabs = withLayoutContext(Navigator);

export default function UserLayout() {
  const { width } = Dimensions.get('window');
  const insets = useSafeAreaInsets();
  
  return (
    <MaterialTopTabs
      tabBarPosition="bottom"
      initialLayout={{ width }}
      screenOptions={{
        lazy: true,
        lazyPreloadDistance: 1,
        lazyPlaceholder: () => null,
        swipeEnabled: true,
        animationEnabled: true,
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          paddingTop: 9,
          paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 10 : 8),
          height: 58 + Math.max(insets.bottom, Platform.OS === 'ios' ? 10 : 8),
          elevation: 8,
        },
        tabBarItemStyle: {
          paddingVertical: 8,
          flexDirection: 'column',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
          textTransform: 'none',
        },
        tabBarIndicatorStyle: {
          display: 'none',
        },
        tabBarPressColor: 'transparent',
        tabBarShowIcon: true,
      }}
    >
      <MaterialTopTabs.Screen 
        name="home" 
        options={{
          title: 'Главная',
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
            <Ionicons 
              name={focused ? 'home' : 'home-outline'} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      <MaterialTopTabs.Screen 
        name="services" 
        options={{
          title: 'Сервисы',
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
            <Ionicons 
              name={focused ? 'grid' : 'grid-outline'} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      <MaterialTopTabs.Screen 
        name="orders" 
        options={{
          title: 'Заказы',
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
            <Ionicons 
              name={focused ? 'cart' : 'cart-outline'} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
      <MaterialTopTabs.Screen 
        name="profile" 
        options={{
          title: 'Профиль',
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
            <Ionicons 
              name={focused ? 'person' : 'person-outline'} 
              size={24} 
              color={color} 
            />
          ),
        }}
      />
    </MaterialTopTabs>
  );
}
