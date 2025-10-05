import { Text } from '@/components/ui/text';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';

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

interface Concert {
  id: string;
  ticketmasterId?: string;
  name?: string;
  seatmap?: string;
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
}

interface VenueSection {
  id: string;
  name: string;
  friendsInSection: AttendeeInfo[];
}

interface VenueSeatingData {
  sections: Array<{
    id: string;
    name: string;
    level: string;
    color: string;
    coordinates?: {
      x: number;
      y: number;
    };
  }>;
  venueImage?: string;
}

export default function VenueView() {
  const router = useRouter();
  const { user } = useAuth();
  const { concertId } = useLocalSearchParams();
  
  const [concert, setConcert] = useState<Concert | null>(null);
  const [attendees, setAttendees] = useState<AttendeeInfo[]>([]);
  const [venueSections, setVenueSections] = useState<VenueSection[]>([]);
  const [venueSeatingData, setVenueSeatingData] = useState<VenueSeatingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (concertId && user) {
      fetchConcertAndAttendees();
    }
  }, [concertId, user]);

  const fetchConcertAndAttendees = async () => {
    try {
      setLoading(true);
      
      // Fetch concert details
      const concertDoc = await getDoc(doc(db, 'concerts', concertId as string));
      if (concertDoc.exists()) {
        const concertData = {
          id: concertDoc.id,
          ...concertDoc.data()
        } as Concert;
        setConcert(concertData);
        
        // Use the stored seatmap URL from our database instead of making API calls
        if (concertData.seatmap) {
          console.log('✅ Using stored seatmap URL:', concertData.seatmap);
          const seatingData: VenueSeatingData = {
            sections: [],
            venueImage: concertData.seatmap
          };
          setVenueSeatingData(seatingData);
        } else {
          console.log('❌ No seatmap URL stored for this concert');
        }
      }

      // Get current user's friends
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
      
      // Don't include the current user in the list - only friends
      
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
        
        // Only include friends (not the current user)
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
      
      // Group attendees by venue sections
      const sectionsMap = new Map<string, AttendeeInfo[]>();
      
      attendeeList.forEach(attendee => {
        if (attendee.seatDetails?.section) {
          const sectionName = attendee.seatDetails.section.toUpperCase();
          if (!sectionsMap.has(sectionName)) {
            sectionsMap.set(sectionName, []);
          }
          sectionsMap.get(sectionName)!.push(attendee);
        }
      });
      
      const sections: VenueSection[] = Array.from(sectionsMap.entries()).map(([name, friends]) => ({
        id: name,
        name,
        friendsInSection: friends
      }));
      
      setVenueSections(sections);
      
    } catch (error) {
      console.error('Error fetching concert and attendees:', error);
    } finally {
      setLoading(false);
    }
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
          <Text className="text-tmuted mt-4">Loading venue information...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
            <Text className="text-tprimary text-xl font-bold">Venue View</Text>
            <Text className="text-tmuted text-sm">
              {concert?.venue?.name || 'Concert Venue'}
            </Text>
          </View>
        </View>
        
        {concert && (
          <View className="bg-surface rounded-2xl p-4 border border-[#1f2937]">
            <Text className="text-tprimary text-lg font-bold mb-1">
              {getArtistName(concert)}
            </Text>
            <Text className="text-tmuted">
              {concert.venue?.name}
              {concert.venue?.city?.name && `, ${concert.venue.city.name}`}
              {concert.venue?.state?.stateCode && `, ${concert.venue.state.stateCode}`}
            </Text>
          </View>
        )}
      </View>

      <ScrollView className="flex-1">
        {/* Venue Layout */}
        <View className="px-6 mb-6">
          <Text className="text-tprimary text-lg font-bold mb-4">Seating Chart</Text>
          
          {/* Stage */}
          <View className="mb-8">
            {venueSeatingData?.venueImage ? (
              /* Real Ticketmaster Seating Chart */
              <View>
                <Text className="text-tprimary text-sm mb-3 text-center">
                  Official {concert?.venue?.name} Seating Chart
                </Text>
                <View className="bg-white rounded-lg p-2">
                  <Image
                    source={{ uri: venueSeatingData.venueImage }}
                    className="w-full h-64 rounded"
                    style={{ resizeMode: 'contain' }}
                  />
                </View>
                {/* Overlay friend locations if we have coordinates */}
                {venueSections.length > 0 && (
                  <View className="mt-4 bg-brand/10 rounded-lg p-3">
                    <Text className="text-brand font-semibold text-center mb-2">
                      🎯 Your Friends' Sections
                    </Text>
                    <View className="flex-row flex-wrap justify-center">
                      {venueSections.map((section) => (
                        <View
                          key={section.id}
                          className="bg-brand rounded-full px-3 py-1 m-1"
                        >
                          <Text className="text-white font-bold text-xs">
                            Section {section.name}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ) : (
              /* No Venue Preview Available */
              <View className="relative items-center py-12">
                <View className="bg-surface rounded-2xl p-8 items-center border border-[#1f2937]">
                  <Ionicons name="location-outline" size={48} color="#6b7280" className="mb-4" />
                  <Text className="text-tprimary text-lg font-semibold mb-2 text-center">
                    No Venue Preview Available
                  </Text>
                  <Text className="text-tmuted text-sm text-center leading-relaxed">
                    We couldn't load the seating chart for this venue.{'\n'}
                    Check your tickets for seating details.
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Venue Sections Grid */}
          {venueSections.length > 0 && (
            <View className="mt-6">
              <Text className="text-tprimary font-semibold mb-3">
                📍 Your Friends' Sections
              </Text>
              <Text className="text-tmuted text-sm mb-4">
                Sections highlighted above show where your friends are sitting
              </Text>
              
              <View className="space-y-3">
                {venueSections.map((section) => (
                  <View
                    key={section.id}
                    className="bg-brand/10 border border-brand/30 rounded-2xl p-4"
                  >
                    <View className="flex-row items-center justify-between mb-3">
                      <View>
                        <Text className="text-tprimary font-bold text-lg">
                          Section {section.name}
                        </Text>
                        <Text className="text-tmuted text-sm">
                          {section.friendsInSection.length} {section.friendsInSection.length === 1 ? 'friend' : 'friends'} here
                        </Text>
                      </View>
                      
                      {/* Friend avatars */}
                      <View className="flex-row">
                        {section.friendsInSection.slice(0, 3).map((friend, index) => (
                          <View
                            key={friend.userId}
                            className={`w-8 h-8 rounded-full bg-brand items-center justify-center border-2 border-white ${
                              index > 0 ? '-ml-2' : ''
                            }`}
                          >
                            <Text className="text-white font-bold text-xs">
                              {friend.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        ))}
                        {section.friendsInSection.length > 3 && (
                          <View className="w-8 h-8 rounded-full bg-gray-500 items-center justify-center border-2 border-white -ml-2">
                            <Text className="text-white font-bold text-xs">
                              +{section.friendsInSection.length - 3}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    
                    {/* Friend details */}
                    {/* <View className="space-y-2">
                      {section.friendsInSection.map((friend) => (
                        <View key={friend.userId} className="flex-row items-center">
                          <View className="w-6 h-6 rounded-full bg-brand/20 items-center justify-center mr-3">
                            <Text className="text-brand font-bold text-xs">
                              {friend.userId === user?.uid ? 'Y' : friend.name.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                          <View className="flex-1">
                            <Text className="text-tprimary text-sm font-medium">
                              {friend.userId === user?.uid ? 'You' : friend.name}
                            </Text>
                            {friend.seatDetails && (friend.seatDetails.row || friend.seatDetails.seatNumber) && (
                              <Text className="text-tmuted text-xs">
                                {[friend.seatDetails.row, friend.seatDetails.seatNumber].filter(Boolean).join(', Seat ')}
                              </Text>
                            )}
                          </View>
                        </View>
                      ))}
                    </View> */}
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Friends List */}
        <View className="px-6 mb-6">
          <Text className="text-tprimary text-lg font-bold mb-4">
            Friends Going ({attendees.length})
          </Text>
          
          {attendees.map((attendee) => (
            <View key={attendee.userId} className="bg-surface rounded-2xl p-4 mb-3 border border-[#1f2937]">
              <View className="flex-row items-center">
                <View className="w-12 h-12 rounded-full bg-brand/20 items-center justify-center mr-3">
                  <Text className="text-brand font-bold">
                    {attendee.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-tprimary font-medium">
                    {attendee.name}
                  </Text>
                  <Text className="text-tmuted text-sm">@{attendee.handle}</Text>
                  
                  {attendee.seatDetails && (attendee.seatDetails.section || attendee.seatDetails.row || attendee.seatDetails.seatNumber) ? (
                    <View className="flex-row items-center mt-1">
                      <Ionicons name="location" size={14} color="#0d9488" />
                      <Text className="text-brand text-sm ml-1">
                        {[attendee.seatDetails.section, attendee.seatDetails.row, attendee.seatDetails.seatNumber]
                          .filter(Boolean)
                          .join(' - ')}
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-tmuted text-sm mt-1">No seat details</Text>
                  )}
                </View>
              </View>
              
              {attendee.notes && (
                <View className="mt-3 pt-3 border-t border-[#374151]">
                  <Text className="text-tmuted text-sm">{attendee.notes}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Bottom spacing */}
        <View className="h-6" />
      </ScrollView>
    </SafeAreaView>
  );
}