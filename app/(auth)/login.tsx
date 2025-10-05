import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { router } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import React, { useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../../firebase';

export default function Login() {  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [focus, setFocus] = useState<"email" | "password" | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const onLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setIsLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // Navigation will be handled by auth state listener
      router.replace('/(protected)/(tabs)');
    } catch (error: any) {
      console.error('Login error:', error);
      let errorMessage = 'Login failed. Please try again.';
      
      switch (error.code) {
        case 'auth/invalid-email':
          errorMessage = 'Please enter a valid email address.';
          break;
        case 'auth/user-disabled':
          errorMessage = 'This account has been disabled.';
          break;
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email address.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password.';
          break;
        case 'auth/invalid-credential':
          errorMessage = 'Invalid email or password.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed attempts. Please try again later.';
          break;
      }
      
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const goToSignUp = () => {
    router.push('/(auth)/signup');
  };

  return (
    <SafeAreaView className="flex-1 bg-appbg">
      <View className="flex-1 px-6">
        {/* Logo */}
        <View className="items-center mt-16 mb-12">
          <Image 
            source={require('../../assets/images/encorelogin.png')} 
            style={{ width: 225, height: 75 }}
            className="mb-4"
          />
        </View>

        {/* email */}
        <Label nativeID="emailLabel" className="text-tprimary/95 mb-2 text-sm">
          Email
        </Label>
        <Input
          aria-labelledby="emailLabel"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          className={[
            "h-12 rounded-2xl border px-4 bg-surface text-base",
            focus === "email" ? "border-brand-accent" : "border-[#1f2937]",
          ].join(" ")}
          style={{
            color: '#f0fdfa', // tprimary color
            fontSize: 16,
          }}
          inputMode="email"
          onFocus={() => setFocus("email")}
          onBlur={() => setFocus(null)}
          placeholderTextColor="#6b7280"
        />

        <View className="h-5" />

        {/* password */}
        <Label nativeID="passwordLabel" className="text-tprimary/95 mb-2 text-sm">
          Password
        </Label>
        <Input
          aria-labelledby="passwordLabel"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          className={[
            "h-12 rounded-2xl border px-4 bg-surface text-base",
            focus === "password" ? "border-brand-accent" : "border-[#1f2937]",
          ].join(" ")}
          style={{
            color: '#f0fdfa', // tprimary color
            fontSize: 16,
          }}
          onFocus={() => setFocus("password")}
          onBlur={() => setFocus(null)}
          placeholderTextColor="#6b7280"
        />

        <Pressable onPress={() => {/* TODO: Forgot password */}} className="mt-3 self-start">
          <Text className="text-brand-accent font-semibold">Forgot password?</Text>
        </Pressable>

        <Pressable
          onPress={onLogin}
          disabled={isLoading}
          className={`mt-6 rounded-2xl p-4 items-center justify-center bg-brand min-h-[56px] ${isLoading ? 'opacity-70' : ''}`}
        >
          <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '600' }}>
            {isLoading ? 'Signing In...' : 'Log In'}
          </Text>
        </Pressable>

        <View className="mt-auto mb-6 flex-row justify-center">
          <Text className="text-tmuted/85">Don&apos;t have an account? </Text>
          <Pressable onPress={goToSignUp}>
            <Text className="text-brand-accent font-semibold">Sign up</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}