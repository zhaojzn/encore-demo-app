import { Text } from '@/components/ui/text';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import React from 'react';
import { Alert, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../contexts/AuthContext';
import { auth } from '../../../firebase';

export default function Profile() {
  const { user } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-appbg">
      <View className="flex-1 px-6 pt-6">
        <Text className="text-tprimary text-2xl font-bold mb-6">Profile</Text>
        
        {/* Profile Picture Section */}
        <View className="items-center mb-8">
          <View className="relative">
            {/* Profile Picture with Border */}
            <View className="w-28 h-28 rounded-full bg-gradient-to-br from-brand to-brand/80 p-1">
              <View className="w-full h-full rounded-full bg-surface items-center justify-center">
                <Text className="text-brand font-bold text-4xl">
                  {user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
            </View>
            {/* Camera Button with Shadow */}
            <Pressable 
              className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-brand items-center justify-center shadow-lg border-2 border-surface"
              onPress={() => {
                // TODO: Implement profile picture functionality
                Alert.alert('Coming Soon', 'Profile picture upload will be available soon!');
              }}
            >
              <Ionicons name="camera" size={18} color="#0a0f0f" />
            </Pressable>
          </View>
          
          {/* User Info */}
          <View className="items-center mt-4">
            <Text className="text-tprimary font-bold text-xl mb-1">
              {user?.displayName || 'User'}
            </Text>
          </View>
        </View>
        
        <View className="mb-8">
          <Text className="text-tmuted text-sm mb-1">Email</Text>
          <Text className="text-tprimary text-base">{user?.email}</Text>
        </View>

        <View className="mb-8">
          <Text className="text-tmuted text-sm mb-1">Display Name</Text>
          <Text className="text-tprimary text-base">{user?.displayName || 'Not set'}</Text>
        </View>

        <Pressable
          onPress={handleLogout}
          className="rounded-2xl p-4 items-center justify-center bg-tbutton min-h-[56px]"
        >
          <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
            Logout
          </Text>
        </Pressable>

      </View>
    </SafeAreaView>
  );
}