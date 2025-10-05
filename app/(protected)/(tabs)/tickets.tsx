import { Text } from '@/components/ui/text';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, Timestamp, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../firebase';

interface Concert {
  id: string;
  ticketmasterId?: string;
  name?: string;
  images?: Array<{
    ratio?: string;
    url: string;
    width?: number;
    height?: number;
    fallback?: boolean;
  }>;
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
    country?: {
      countryCode?: string;
    };
  };
  attractions?: Array<{
    name?: string;
  }>;
  userStatus?: string; // 'going' or 'interested'
}

interface UserAttendance {
  userId: string;
  concertId: string;
  status: 'going' | 'interested' | 'maybe';
  seatDetails?: {
    section?: string;
    row?: string;
    seatNumber?: string;
  };
  taggedFriends?: string[];
  notes?: string;
  createdAt: any;
}

interface AttendeeInfo {
  userId: string;
  name: string;
  handle: string;
  seatDetails?: {
    section?: string;
    row?: string;
    seatNumber?: string;
  };
  taggedFriends?: string[];
  notes?: string;
}

export default function MyShows() {
  const { user } = useAuth();
  const router = useRouter();
  const [myShows, setMyShows] = useState<Concert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConcert, setSelectedConcert] = useState<Concert | null>(null);
  const [showAttendeesModal, setShowAttendeesModal] = useState(false);
  const [attendees, setAttendees] = useState<AttendeeInfo[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);

  useEffect(() => {
    if (user) {
      fetchMyShows();
    }
  }, [user]);

  // Refresh shows when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchMyShows();
      }
    }, [user])
  );

  const fetchMyShows = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Get user's attendance records where status is 'going' or 'interested'
      const attendanceSnapshot = await getDocs(
        query(
          collection(db, 'user_attendance'),
          where('userId', '==', user.uid)
        )
      );

      const concertIds: string[] = [];
      const attendanceMap = new Map<string, string>(); // concertId -> status
      
      attendanceSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.status === 'going' || data.status === 'interested') {
          concertIds.push(data.concertId);
          attendanceMap.set(data.concertId, data.status);
        }
      });

      if (concertIds.length === 0) {
        setMyShows([]);
        return;
      }

      // Fetch concert details for each concert ID
      const concerts: Concert[] = [];
      for (const concertId of concertIds) {
        const concertDoc = await getDoc(doc(db, 'concerts', concertId));
        if (concertDoc.exists()) {
          concerts.push({
            id: concertDoc.id,
            ...concertDoc.data(),
            userStatus: attendanceMap.get(concertId) // Add user's status to concert object
          } as Concert & { userStatus: string });
        }
      }

      // Sort by date
      concerts.sort((a, b) => {
        const dateA = new Date(a.dates?.start?.localDate || '');
        const dateB = new Date(b.dates?.start?.localDate || '');
        return dateA.getTime() - dateB.getTime();
      });

      setMyShows(concerts);
    } catch (error) {
      console.error('Error fetching my shows:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendees = async (concertId: string) => {
    try {
      setLoadingAttendees(true);
      
      // First, get current user's friends
      const friendshipsSnapshot = await getDocs(
        query(collection(db, 'friendships'))
      );
      
      const friendIds = new Set<string>();
      friendshipsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.user1Id === user?.uid) {
          friendIds.add(data.user2Id);
        } else if (data.user2Id === user?.uid) {
          friendIds.add(data.user1Id);
        }
      });
      
      // Always include the current user
      if (user?.uid) {
        friendIds.add(user.uid);
      }
      
      // Get all users going to this concert
      const attendanceSnapshot = await getDocs(
        query(
          collection(db, 'user_attendance'),
          where('concertId', '==', concertId),
          where('status', '==', 'going')
        )
      );

      const attendeeList: AttendeeInfo[] = [];
      
      for (const docSnap of attendanceSnapshot.docs) {
        const data = docSnap.data();
        
        // Only include friends and the current user
        if (friendIds.has(data.userId)) {
          // Get user details
          const userDoc = await getDoc(doc(db, 'users', data.userId));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            attendeeList.push({
              userId: data.userId,
              name: userData.name || 'Unknown',
              handle: userData.handle || 'unknown',
              seatDetails: data.seatDetails,
              taggedFriends: data.taggedFriends,
              notes: data.notes
            });
          }
        }
      }

      setAttendees(attendeeList);
    } catch (error) {
      console.error('Error fetching attendees:', error);
    } finally {
      setLoadingAttendees(false);
    }
  };

  const handleShowAttendees = async (concert: Concert) => {
    setSelectedConcert(concert);
    setShowAttendeesModal(true);
    await fetchAttendees(concert.id);
  };

  const handleRemoveFromList = async (concert: Concert) => {
    if (!user) return;

    const statusText = concert.userStatus === 'going' ? 'going list' : 'interested list';
    const actionText = concert.userStatus === 'going' ? 'going to' : 'interested in';

    Alert.alert(
      `Remove from ${statusText}?`,
      `Are you sure you want to remove "${getArtistName(concert)}" from your ${statusText}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive', 
          onPress: async () => {
            try {
              const userId = user.uid;
              const userAttendanceRef = doc(db, 'user_attendance', `${userId}_${concert.id}`);
              
              await deleteDoc(userAttendanceRef);
              
              // Update concert attendance summary
              await updateConcertAttendanceSummary(concert.id);
              
              // Refresh the shows list
              await fetchMyShows();
              
              Alert.alert('Success', `Removed from your ${statusText}`);
            } catch (error) {
              console.error('Error removing attendance:', error);
              Alert.alert('Error', `Failed to remove from ${statusText}. Please try again.`);
            }
          }
        }
      ]
    );
  };

  const updateConcertAttendanceSummary = async (concertId: string) => {
    try {
      // Get all attendance records for this concert
      const attendanceSnapshot = await getDocs(
        query(collection(db, 'user_attendance'))
      );
      
      const attendeeCounts = { going: 0, interested: 0, maybe: 0 };
      const attendees = { going: [] as string[], interested: [] as string[], maybe: [] as string[] };
      
      attendanceSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.concertId === concertId) {
          const status = data.status as keyof typeof attendeeCounts;
          if (attendeeCounts.hasOwnProperty(status)) {
            attendeeCounts[status]++;
            attendees[status].push(data.userId);
          }
        }
      });
      
      // Update concert attendance summary
      const concertAttendanceRef = doc(db, 'concert_attendance', concertId);
      await setDoc(concertAttendanceRef, {
        concertId,
        attendeeCounts,
        attendees,
        lastUpdated: Timestamp.now()
      }, { merge: true });
      
    } catch (error) {
      console.error('Error updating concert attendance summary:', error);
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Date TBA';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short',
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

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-appbg">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#ffffff" />
          <Text className="text-tmuted mt-4">Loading your shows...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-appbg">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="px-6 pt-4 pb-6">
          <View className="flex-row items-center">
            <View className="w-12 h-12 rounded-2xl bg-brand items-center justify-center mr-3">
              <Ionicons name="musical-notes" size={24} color="#0a0f0f" />
            </View>
            <View>
              <Text className="text-tprimary text-xl font-timmana text-2xl -mb-6">My Shows</Text>
              <Text className="text-tmuted text-sm mt-3">
                {myShows.length} {myShows.length === 1 ? 'concert' : 'concerts'} added
              </Text>
            </View>
          </View>
        </View>

        {myShows.length === 0 ? (
          <View className="flex-1 justify-center items-center px-6 py-12">
            <View className="w-16 h-16 rounded-2xl bg-surface items-center justify-center mb-4">
              <Ionicons name="musical-notes-outline" size={32} color="#6b7280" />
            </View>
            <Text className="text-tprimary text-xl font-bold mb-2">No Shows Yet</Text>
            <Text className="text-tmuted text-center mb-6">
              Start discovering concerts and mark yourself as "Going" or "Interested" to see them here!
            </Text>
          </View>
        ) : (
          myShows.map((concert) => (
            <View key={concert.id} className="px-6 mb-6">
              <View className="bg-surface rounded-3xl overflow-hidden border border-[#1f2937]">
                <View className="h-48 relative">
                  <Image
                    source={{ uri: getEventImage(concert) }}
                    className="w-full h-full"
                    style={{ resizeMode: 'cover' }}
                  />
                  <View className="absolute inset-0 bg-black/40" />
                  <View className="absolute bottom-4 left-4 right-4">
                    <Text className="text-white text-2xl font-bold mb-1" numberOfLines={1}>
                      {getArtistName(concert)}
                    </Text>
                    <View className="flex-row items-center">
                      <Text className="text-white/80 text-base" numberOfLines={1}>
                        {formatDate(concert.dates?.start?.localDate)}
                      </Text>
                      {concert.venue?.name && (
                        <Text className="text-white/60 text-sm ml-2" numberOfLines={1}>
                          • {concert.venue.name}
                        </Text>
                      )}
                    </View>
                  </View>
                  
                  {/* Status Badge */}
                  <View className="absolute top-4 right-4">
                    <View className={`rounded-full px-3 py-1 flex-row items-center ${
                      concert.userStatus === 'going' ? 'bg-brand' : 'bg-blue-500'
                    }`}>
                      <Ionicons 
                        name={concert.userStatus === 'going' ? 'checkmark-circle' : 'heart-circle'} 
                        size={14} 
                        color={concert.userStatus === 'going' ? '#000' : '#fff'} 
                      />
                      <Text className={`text-xs font-bold ml-1 ${
                        concert.userStatus === 'going' ? 'text-background' : 'text-white'
                      }`}>
                        {concert.userStatus === 'going' ? 'Going' : 'Interested'}
                      </Text>
                    </View>
                  </View>
                </View>
                
                <View className="p-4">
                  <View className="flex-row justify-between items-center mb-3">
                    <View className="flex-1">
                      {concert.venue?.city?.name && (
                        <Text className="text-tmuted text-sm">
                          {concert.venue.city.name}, {concert.venue?.state?.stateCode || concert.venue?.country?.countryCode}
                        </Text>
                      )}
                    </View>
                  </View>
                  
                  {/* Action Buttons */}
                  <View className="flex-row space-x-3">
                    {concert.userStatus === 'going' ? (
                      <Pressable 
                        className="flex-1 bg-brand/20 rounded-xl py-3 px-4 flex-row items-center justify-center"
                        onPress={() => handleShowAttendees(concert)}
                      >
                        <Ionicons name="people" size={16} color="#ffffff" />
                        <Text className="text-white font-semibold ml-2">See Attendees</Text>
                      </Pressable>
                    ) : (
                      <Pressable 
                        className="flex-1 bg-brand/20 rounded-xl py-3 px-4 flex-row items-center justify-center"
                        onPress={() => {
                          console.log('Venue View pressed for concert:', concert.id);
                          try {
                            router.push({
                              pathname: '/(protected)/venue-view',
                              params: { concertId: concert.id }
                            });
                          } catch (error) {
                            console.error('Navigation error:', error);
                            Alert.alert('Navigation Error', 'Could not open venue view');
                          }
                        }}
                        
                      >
                        <Ionicons name="people" size={16} color="#ffffff" />
                        <Text className="text-white font-semibold ml-2">See Attendees</Text>
                      </Pressable>
                    )}
                    <Pressable 
                      className="bg-red-500/20 rounded-xl py-3 px-4 flex-row items-center justify-center"
                      onPress={() => handleRemoveFromList(concert)}
                    >
                      <Ionicons name="remove-circle" size={16} color="#ef4444" />
                      <Text className="text-red-500 font-semibold ml-2">Remove</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          ))
        )}

        {/* Bottom spacing for tab bar */}
        <View className="h-6" />
      </ScrollView>

      {/* Attendees Modal */}
      <Modal
        visible={showAttendeesModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAttendeesModal(false)}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-surface rounded-t-3xl border-t border-[#1f2937] overflow-hidden max-h-[80%]">
            {/* Header */}
            <View className="px-6 pt-6 pb-4 border-b border-[#1f2937]/50">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-tprimary text-xl font-bold mb-1">
                    Who's Going 🎵
                  </Text>
                  <Text className="text-tmuted text-sm">
                    {selectedConcert ? getArtistName(selectedConcert) : ''}
                  </Text>
                </View>
                <Pressable 
                  onPress={() => setShowAttendeesModal(false)}
                  className="w-10 h-10 rounded-full bg-appbg items-center justify-center"
                >
                  <Ionicons name="close" size={20} color="#9ca3af" />
                </Pressable>
              </View>
            </View>

            {/* Content */}
            <ScrollView className="px-6 py-6">
              {loadingAttendees ? (
                <View className="py-12 items-center">
                  <ActivityIndicator size="large" color="#0d9488" />
                  <Text className="text-tmuted mt-4">Loading attendees...</Text>
                </View>
              ) : attendees.length === 0 ? (
                <View className="py-12 items-center">
                  <Text className="text-tmuted text-center">No friends are going to this concert</Text>
                </View>
              ) : (
                <View>
                  <Text className="text-tprimary text-lg font-semibold mb-4">
                    {attendees.length} {attendees.length === 1 ? 'friend is' : 'friends are'} going
                  </Text>
                  
                  {attendees.map((attendee, index) => (
                    <View key={attendee.userId} className="mb-4 p-4 bg-appbg rounded-xl border border-[#374151]">
                      <View className="flex-row items-center mb-2">
                        <View className="w-10 h-10 rounded-full bg-brand/20 items-center justify-center mr-3">
                          <Text className="text-brand font-bold">
                            {attendee.userId === user?.uid ? 'Y' : attendee.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-tprimary font-medium">
                            {attendee.userId === user?.uid ? 'You' : attendee.name}
                          </Text>
                          <Text className="text-tmuted text-sm">
                            @{attendee.handle}
                          </Text>
                        </View>
                      </View>
                      
                      {attendee.seatDetails && (attendee.seatDetails.section || attendee.seatDetails.row || attendee.seatDetails.seatNumber) && (
                        <View className="flex-row items-center mb-2">
                          <Ionicons name="location" size={14} color="#6b7280" />
                          <Text className="text-tmuted text-sm ml-2">
                            Seat: {[attendee.seatDetails.section, attendee.seatDetails.row, attendee.seatDetails.seatNumber].filter(Boolean).join(' - ')}
                          </Text>
                        </View>
                      )}
                      
                      {attendee.taggedFriends && attendee.taggedFriends.length > 0 && (
                        <View className="flex-row items-center mb-2">
                          <Ionicons name="people" size={14} color="#6b7280" />
                          <Text className="text-tmuted text-sm ml-2">
                            With: {attendee.taggedFriends.join(', ')}
                          </Text>
                        </View>
                      )}
                      
                      {attendee.notes && (
                        <View className="flex-row items-start">
                          <Ionicons name="chatbubble-outline" size={14} color="#6b7280" />
                          <Text className="text-tmuted text-sm ml-2 flex-1">
                            {attendee.notes}
                          </Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}