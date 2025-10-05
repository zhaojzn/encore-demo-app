import { Text } from '@/components/ui/text';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { db } from '../../firebase';

interface User {
  id: string;
  name: string;
  handle: string;
  email: string;
}

interface Concert {
  id: string;
  ticketmasterId?: string;
  name?: string;
  dates?: {
    start?: {
      localDate?: string;
      localTime?: string;
    };
  };
  venue?: {
    name?: string;
    city?: {
      name?: string;
    };
    state?: {
      stateCode?: string;
    };
  };
  attractions?: Array<{
    name?: string;
  }>;
  images?: Array<{
    url: string;
    width?: number;
    height?: number;
  }>;
}

interface AttendanceRecord {
  id: string;
  concertId: string;
  status: 'going' | 'interested';
  seatDetails?: {
    section?: string;
    row?: string;
    seatNumber?: string;
  };
  notes?: string;
  concert?: Concert;
}

export default function FriendProfile() {
  const router = useRouter();
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const { friendId, friendName, friendHandle } = useLocalSearchParams();
  
  const [friendData, setFriendData] = useState<User | null>(null);
  const [goingConcerts, setGoingConcerts] = useState<AttendanceRecord[]>([]);
  const [interestedConcerts, setInterestedConcerts] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'going' | 'interested'>('going');

  useEffect(() => {
    if (friendId) {
      fetchFriendData();
      fetchFriendShows();
    }
  }, [friendId]);

  const fetchFriendData = async () => {
    if (!friendId) return;

    try {
      const friendDoc = await getDoc(doc(db, 'users', friendId as string));
      if (friendDoc.exists()) {
        setFriendData({
          id: friendDoc.id,
          ...friendDoc.data()
        } as User);
      }
    } catch (error) {
      console.error('Error fetching friend data:', error);
    }
  };

  const fetchFriendShows = async () => {
    if (!friendId) return;

    try {
      setLoading(true);
      
      // Get friend's attendance records
      const attendanceSnapshot = await getDocs(
        query(
          collection(db, 'user_attendance'),
          where('userId', '==', friendId)
        )
      );

      const goingShows: AttendanceRecord[] = [];
      const interestedShows: AttendanceRecord[] = [];

      // Fetch concert details for each attendance record
      for (const docSnap of attendanceSnapshot.docs) {
        const attendanceData = docSnap.data();
        
        // Get concert details
        const concertDoc = await getDoc(doc(db, 'concerts', attendanceData.concertId));
        if (concertDoc.exists()) {
          const concert = {
            id: concertDoc.id,
            ...concertDoc.data()
          } as Concert;

          const attendanceRecord: AttendanceRecord = {
            id: docSnap.id,
            concertId: attendanceData.concertId,
            status: attendanceData.status,
            seatDetails: attendanceData.seatDetails,
            notes: attendanceData.notes,
            concert
          };

          if (attendanceData.status === 'going') {
            goingShows.push(attendanceRecord);
          } else if (attendanceData.status === 'interested') {
            interestedShows.push(attendanceRecord);
          }
        }
      }

      // Sort by date
      const sortByDate = (a: AttendanceRecord, b: AttendanceRecord) => {
        const dateA = a.concert?.dates?.start?.localDate || '';
        const dateB = b.concert?.dates?.start?.localDate || '';
        return dateA.localeCompare(dateB);
      };

      setGoingConcerts(goingShows.sort(sortByDate));
      setInterestedConcerts(interestedShows.sort(sortByDate));
      
    } catch (error) {
      console.error('Error fetching friend shows:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeFriend = async () => {
    if (!user || !friendId) return;
    
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friendData?.name || friendName} from your friends?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive', 
          onPress: async () => {
            try {
              // Find the friendship
              const friendshipsSnapshot = await getDocs(
                query(collection(db, 'friendships'))
              );
              
              let friendshipId = '';
              friendshipsSnapshot.forEach(docSnap => {
                const data = docSnap.data();
                if (
                  (data.user1Id === user.uid && data.user2Id === friendId) ||
                  (data.user1Id === friendId && data.user2Id === user.uid)
                ) {
                  friendshipId = docSnap.id;
                }
              });
              
              if (friendshipId) {
                // Delete the friendship
                await deleteDoc(doc(db, 'friendships', friendshipId));
                
                // Clean up any pending friend requests between these users
                const friendRequestsSnapshot = await getDocs(
                  query(collection(db, 'friend_requests'))
                );
                
                const requestsToDelete: string[] = [];
                friendRequestsSnapshot.forEach(docSnap => {
                  const data = docSnap.data();
                  if (
                    (data.fromUserId === user.uid && data.toUserId === friendId) ||
                    (data.fromUserId === friendId && data.toUserId === user.uid)
                  ) {
                    requestsToDelete.push(docSnap.id);
                  }
                });
                
                // Delete all related friend requests
                for (const requestId of requestsToDelete) {
                  await deleteDoc(doc(db, 'friend_requests', requestId));
                }
                
                showNotification('success', 'Friend removed');
                router.back(); // Go back to friends list
              } else {
                showNotification('error', 'Friendship not found');
              }
            } catch (error) {
              console.error('Error removing friend:', error);
              showNotification('error', 'Failed to remove friend');
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Date TBA';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const getEventImage = (concert: Concert) => {
    if (concert.images && concert.images.length > 0) {
      const highResImage = concert.images.find(img => img.width && img.width >= 640) || concert.images[0];
      return highResImage.url;
    }
    return 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80';
  };

  const getArtistName = (concert: Concert) => {
    if (concert.attractions && concert.attractions.length > 0) {
      return concert.attractions[0].name;
    }
    return concert.name;
  };

  const renderConcertCard = (record: AttendanceRecord) => {
    const concert = record.concert!;
    
    return (
      <View key={record.id} className="mb-4">
        <View className="bg-surface rounded-3xl overflow-hidden border border-[#1f2937]">
          <View className="h-36 relative">
            <Image
              source={{ uri: getEventImage(concert) }}
              className="w-full h-full"
              style={{ resizeMode: 'cover' }}
            />
            <View className="absolute inset-0 bg-black/40" />
            <View className="absolute bottom-3 left-3 right-3">
              <Text className="text-white text-base font-bold mb-1 leading-tight" numberOfLines={2}>
                {getArtistName(concert)}
              </Text>
              <View className="flex-row items-center">
                <Text className="text-white/80 text-xs mr-2 flex-shrink-0">
                  {formatDate(concert.dates?.start?.localDate)}
                </Text>
                {concert.venue?.name && (
                  <Text className="text-white/60 text-xs flex-1" numberOfLines={1}>
                    • {concert.venue.name}
                  </Text>
                )}
              </View>
            </View>
          </View>
          
          <View className="p-3">
            {/* Date and Location Info */}
            <View className="flex-row items-center mb-3">
              <View className="flex-row items-center flex-1 flex-wrap">
                <Ionicons name="calendar-outline" size={14} color="#6b7280" />
                <Text className="text-tmuted ml-1 mr-3 text-xs">{formatDate(concert.dates?.start?.localDate)}</Text>
                <Ionicons name="location-outline" size={14} color="#6b7280" />
                <Text className="text-tmuted ml-1 text-xs flex-1" numberOfLines={1}>
                  {concert.venue?.name || 'Venue TBA'}
                </Text>
              </View>
            </View>



            {/* Notes */}
            {record.notes && (
              <View className="mb-3 bg-appbg rounded-xl p-3">
                <Text className="text-tmuted text-sm">{record.notes}</Text>
              </View>
            )}

            {/* View Venue Button */}
            <Pressable 
              className="bg-tbutton rounded-xl px-3 py-2 self-start"
              onPress={() => {
                router.push({
                  pathname: '/(protected)/venue-view',
                  params: { concertId: concert.id }
                });
              }}
            >
              <Text className="text-white text-sm font-semibold">View Venue</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-appbg">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#0d9488" />
          <Text className="text-tmuted mt-4">Loading {friendName || 'friend'}'s shows...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentShows = activeTab === 'going' ? goingConcerts : interestedConcerts;

  return (
    <SafeAreaView className="flex-1 bg-appbg">
      {/* Header */}
      <View className="px-6 pt-4 pb-6">
        <View className="flex-row items-center mb-4">
          <Pressable 
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3"
          >
            <Ionicons name="arrow-back" size={20} color="#f0fdfa" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-tprimary text-xl font-bold">
              {friendData?.name || friendName || 'Friend'}'s Shows
            </Text>
            <Text className="text-tmuted text-sm">
              @{friendData?.handle || friendHandle}
            </Text>
          </View>
          <Pressable
            onPress={removeFriend}
            className="w-10 h-10 rounded-full bg-red-500/20 items-center justify-center"
          >
            <Ionicons name="person-remove-outline" size={20} color="#ef4444" />
          </Pressable>
        </View>

        {/* Friend Info Card */}
        <View className="bg-surface rounded-2xl p-4 border border-[#1f2937]">
          <View className="flex-row items-center">
            <View className="w-16 h-16 rounded-full bg-brand/20 items-center justify-center mr-4">
              <Text className="text-brand font-bold text-xl">
                {((friendData?.name || friendName || 'F') as string).charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-tprimary text-lg font-bold">
                {friendData?.name || friendName}
              </Text>
              <Text className="text-tmuted">@{friendData?.handle || friendHandle}</Text>
              <Text className="text-tmuted text-sm mt-1">
                {goingConcerts.length} going • {interestedConcerts.length} interested
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Tab Navigation */}
      <View className="flex-row px-6 mb-6">
        <Pressable
          onPress={() => setActiveTab('going')}
          className={`flex-1 py-3 px-4 rounded-xl mr-2 ${
            activeTab === 'going' ? 'bg-brand' : 'bg-surface border border-[#1f2937]'
          }`}
        >
          <Text className={`text-center font-semibold ${
            activeTab === 'going' ? 'text-background' : 'text-tmuted'
          }`}>
            Going ({goingConcerts.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('interested')}
          className={`flex-1 py-3 px-4 rounded-xl ml-2 ${
            activeTab === 'interested' ? 'bg-brand' : 'bg-surface border border-[#1f2937]'
          }`}
        >
          <Text className={`text-center font-semibold ${
            activeTab === 'interested' ? 'text-background' : 'text-tmuted'
          }`}>
            Interested ({interestedConcerts.length})
          </Text>
        </Pressable>
      </View>

      {/* Shows List */}
      <ScrollView className="flex-1 px-6">
        {currentShows.length === 0 ? (
          <View className="flex-1 justify-center items-center py-12">
            <View className="w-16 h-16 rounded-2xl bg-surface items-center justify-center mb-4">
              <Ionicons 
                name={activeTab === 'going' ? 'checkmark-circle-outline' : 'star-outline'} 
                size={32} 
                color="#6b7280" 
              />
            </View>
            <Text className="text-tprimary text-lg font-semibold mb-2">
              No {activeTab === 'going' ? 'confirmed' : 'interested'} shows
            </Text>
            <Text className="text-tmuted text-center">
              {friendData?.name || friendName} hasn't marked any shows as {activeTab} yet.
            </Text>
          </View>
        ) : (
          currentShows.map(renderConcertCard)
        )}

        {/* Bottom spacing */}
        <View className="h-6" />
      </ScrollView>
    </SafeAreaView>
  );
}