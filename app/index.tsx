import { Text } from '@/components/ui/text';
import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    // Show loading screen while checking auth state
    return (
      <View className="flex-1 bg-appbg items-center justify-center">
        <Text className="text-tprimary text-lg">Loading...</Text>
      </View>
    );
  }

  // Redirect based on auth state
  if (user) {
    return <Redirect href="/(protected)/(tabs)" />;
  } else {
    return <Redirect href="/(auth)/login" />;
  }
}