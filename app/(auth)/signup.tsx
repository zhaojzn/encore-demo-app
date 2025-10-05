import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { router } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore';
import React, { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../../firebase';

export default function SignUp() {  
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [focus, setFocus] = useState<"email" | "name" | "handle" | "password" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const onSignUp = async () => {
    setError(''); // Clear any previous errors
    
    // Validation
    if (!email.trim() || !password.trim() || !name.trim() || !handle.trim()) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    // Clean handle (remove @ if user typed it)
    const cleanHandle = handle.replace('@', '').toLowerCase().trim();
    
    if (cleanHandle.length < 3) {
      setError('Username must be at least 3 characters long');
      return;
    }

    // Check if handle contains only valid characters (letters, numbers, underscores)
    const validHandleRegex = /^[a-zA-Z0-9_]+$/;
    if (!validHandleRegex.test(cleanHandle)) {
      setError('Username can only contain letters, numbers, and underscores');
      return;
    }

    try {
      setIsLoading(true);
      
      // Check if handle is already taken
      const handleQuery = query(
        collection(db, 'users'),
        where('handle', '==', cleanHandle)
      );
      const handleSnapshot = await getDocs(handleQuery);
      
      if (!handleSnapshot.empty) {
        setError('This username is already taken. Please choose a different one.');
        return;
      }
      
      // Create user with Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // Update the user's display name
      await updateProfile(user, {
        displayName: name.trim()
      });

      // Save additional user data to Firestore
      await setDoc(doc(db, 'users', user.uid), {
        name: name.trim(),
        handle: cleanHandle,
        email: email.trim().toLowerCase(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Navigate to home
      router.replace('/(protected)/(tabs)');
      
    } catch (error: any) {
      console.error('Signup error:', error);
      let errorMessage = 'Account creation failed. Please try again.';
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'An account with this email address already exists.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Please enter a valid email address.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak. Please choose a stronger password.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection and try again.';
          break;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const goToLogin = () => {
    router.push('/(auth)/login');
  };

  return (
    <SafeAreaView className="flex-1 bg-appbg">
      <View className="flex-1 px-6">
        {/* Logo */}
        <View className="items-center mt-12 mb-8">
          <Image 
            source={require('../../assets/images/encorelogin.png')} 
            style={{ width: 225, height: 75 }}
            className="mb-3"
          />
        </View>

        {/* name */}
        <Label nativeID="nameLabel" className="text-tprimary/95 mb-2 text-sm">
          Full Name
        </Label>
        <Input
          aria-labelledby="nameLabel"
          value={name}
          onChangeText={setName}
          placeholder="John Doe"
          autoCapitalize="words"
          className={[
            "h-12 rounded-2xl border px-4 bg-surface text-base",
            focus === "name" ? "border-brand-accent" : "border-[#1f2937]",
          ].join(" ")}
          style={{
            color: '#f0fdfa', // tprimary color
            fontSize: 16,
          }}
          onFocus={() => setFocus("name")}
          onBlur={() => setFocus(null)}
          placeholderTextColor="#6b7280"
        />

        <View className="h-4" />

        {/* handle */}
        <Label nativeID="handleLabel" className="text-tprimary/95 mb-2 text-sm">
          Username
        </Label>
        <Input
          aria-labelledby="handleLabel"
          value={handle}
          onChangeText={setHandle}
          placeholder="@username"
          autoCapitalize="none"
          className={[
            "h-12 rounded-2xl border px-4 bg-surface text-base",
            focus === "handle" ? "border-brand-accent" : "border-[#1f2937]",
          ].join(" ")}
          style={{
            color: '#f0fdfa', // tprimary color
            fontSize: 16,
          }}
          onFocus={() => setFocus("handle")}
          onBlur={() => setFocus(null)}
          placeholderTextColor="#6b7280"
        />

        <View className="h-4" />

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

        <View className="h-4" />

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

        {/* Error Display */}
        {error ? (
          <View className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
            <Text className="text-red-400 text-sm text-center">{error}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={onSignUp}
          disabled={isLoading}
          className={`mt-8 rounded-2xl p-4 items-center justify-center bg-brand min-h-[56px] ${isLoading ? 'opacity-70' : ''}`}
        >
          <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '600' }}>
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </Text>
        </Pressable>

        <View className="mt-auto mb-6 flex-row justify-center">
          <Text className="text-tmuted/85">Already have an account? </Text>
          <Pressable onPress={goToLogin}>
            <Text className="text-brand-accent font-semibold">Sign in</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}