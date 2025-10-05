import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, setDoc, Timestamp, where } from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../contexts/AuthContext';
import { db } from '../../../firebase';

interface Concert {
  id: string;
  ticketmasterId?: string;
  name?: string;
  url?: string;
  info?: string;
  pleaseNote?: string;
  priceRanges?: any[];
  seatmap?: string;
  accessibility?: any;
  ticketLimit?: any;
  ageRestrictions?: any;
  dates?: {
    start?: {
      localDate?: string;
      localTime?: string;
      dateTime?: string;
      dateTBD?: boolean;
      dateTBA?: boolean;
      timeTBA?: boolean;
      noSpecificTime?: boolean;
    };
    timezone?: string;
    status?: {
      code?: string;
    };
    spanMultipleDays?: boolean;
  };
  classification?: {
    primary?: boolean;
    segment?: {
      id?: string;
      name?: string;
    };
    genre?: {
      id?: string;
      name?: string;
    };
    subGenre?: {
      id?: string;
      name?: string;
    };
    type?: {
      id?: string;
      name?: string;
    };
    subType?: {
      id?: string;
      name?: string;
    };
    family?: boolean;
  };
  promoter?: {
    id?: string;
    name?: string;
    description?: string;
  };
  promoters?: any[];
  images?: Array<{
    ratio?: string;
    url: string;
    width?: number;
    height?: number;
    fallback?: boolean;
  }>;
  sales?: {
    public?: {
      startDateTime?: string;
      startTBD?: boolean;
      startTBA?: boolean;
      endDateTime?: string;
    };
    presales?: any[];
  };
  venue?: {
    name?: string;
    type?: string;
    id?: string;
    url?: string;
    locale?: string;
    images?: any[];
    postalCode?: string;
    timezone?: string;
    city?: {
      name?: string;
    };
    state?: {
      name?: string;
      stateCode?: string;
    };
    country?: {
      name?: string;
      countryCode?: string;
    };
    address?: {
      line1?: string;
      line2?: string;
    };
    location?: {
      longitude: string;
      latitude: string;
    };
    markets?: any[];
    dmas?: any[];
    social?: any;
    boxOfficeInfo?: any;
    parkingDetail?: any;
    accessibleSeatingDetail?: any;
    generalInfo?: any;
  };
  attractions?: Array<{
    name?: string;
    type?: string;
    id?: string;
    url?: string;
    locale?: string;
    images?: any[];
    classifications?: any[];
    upcomingEvents?: any;
    externalLinks?: any;
  }>;
  lastUpdated?: any;
}

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [allConcerts, setAllConcerts] = useState<Concert[]>([]); // Store all concerts for filtering
  const [filteredConcerts, setFilteredConcerts] = useState<Concert[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreConcerts, setHasMoreConcerts] = useState(true);
  const [displayedCount, setDisplayedCount] = useState(15);
  
  // Modal state
  const [showGoingModal, setShowGoingModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedConcert, setSelectedConcert] = useState<Concert | null>(null);
  const [seatSection, setSeatSection] = useState('');
  const [seatRow, setSeatRow] = useState('');
  const [seatNumber, setSeatNumber] = useState('');
  const [taggedFriend, setTaggedFriend] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Filter state
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedDateRange, setSelectedDateRange] = useState<'week' | 'month' | 'quarter' | 'all'>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');
  
  // Attendance tracking
  const [userAttendance, setUserAttendance] = useState<{[concertId: string]: 'going' | 'interested' | null}>({});
  const [concertAttendees, setConcertAttendees] = useState<{[concertId: string]: { userId: string; name: string; handle: string }[]}>({});

  // Refs for scrolling
  const modalScrollViewRef = useRef<ScrollView>(null);

  const handleGoingPress = async (concert: Concert) => {
    if (!user) {
      Alert.alert('Error', 'Please make sure you are logged in.');
      return;
    }

    const currentStatus = userAttendance[concert.id];
    
    if (currentStatus === 'going') {
      // If already going, show confirmation to remove
      Alert.alert(
        'Remove from Going?',
        `Are you sure you want to remove "${getArtistName(concert)}" from your going list?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => removeAttendance(concert.id) }
        ]
      );
    } else {
      // If not going, show the modal to add details
      setSelectedConcert(concert);
      setShowGoingModal(true);
    }
  };

  const handleInterestedPress = async (concert: Concert) => {
    if (!user) {
      Alert.alert('Error', 'Please make sure you are logged in.');
      return;
    }

    const currentStatus = userAttendance[concert.id];
    
    if (currentStatus === 'interested') {
      // If already interested, remove it
      await removeAttendance(concert.id);
    } else {
      // If not interested, mark as interested
      await setAttendanceStatus(concert.id, 'interested');
    }
  };

  const setAttendanceStatus = async (concertId: string, status: 'going' | 'interested') => {
    if (!user) return;

    try {
      const userId = user.uid;
      const userAttendanceRef = doc(db, 'user_attendance', `${userId}_${concertId}`);
      
      const attendanceData = {
        userId,
        concertId,
        status,
        seatDetails: status === 'interested' ? null : {
          section: null,
          row: null,
          seatNumber: null
        },
        taggedFriends: [],
        notes: null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await setDoc(userAttendanceRef, attendanceData, { merge: true });
      
      // Update local state
      setUserAttendance(prev => ({
        ...prev,
        [concertId]: status
      }));

      // Update concert attendance summary
      await updateConcertAttendanceSummary(concertId);
      
      // Refresh attendees display
      fetchConcertAttendees();
      
    } catch (error) {
      console.error('Error setting attendance status:', error);
      Alert.alert('Error', 'Failed to update your attendance. Please try again.');
    }
  };

  const removeAttendance = async (concertId: string) => {
    if (!user) return;

    try {
      const userId = user.uid;
      const userAttendanceRef = doc(db, 'user_attendance', `${userId}_${concertId}`);
      
      await deleteDoc(userAttendanceRef);
      
      // Update local state
      setUserAttendance(prev => ({
        ...prev,
        [concertId]: null
      }));

      // Update concert attendance summary
      await updateConcertAttendanceSummary(concertId);
      
      // Refresh attendees display
      fetchConcertAttendees();
      
    } catch (error) {
      console.error('Error removing attendance:', error);
      Alert.alert('Error', 'Failed to remove your attendance. Please try again.');
    }
  };

  const handleSubmitGoing = async () => {
    if (!user || !selectedConcert) {
      Alert.alert('Error', 'Please make sure you are logged in and have selected a concert.');
      return;
    }

    try {
      setSubmitting(true);
      
      const userId = user.uid;
      const concertId = selectedConcert.id;
      
      // Create user attendance document
      const userAttendanceRef = doc(db, 'user_attendance', `${userId}_${concertId}`);
      const attendanceData = {
        userId,
        concertId,
        status: 'going',
        seatDetails: {
          section: seatSection.trim() || null,
          row: seatRow.trim() || null,
          seatNumber: seatNumber.trim() || null
        },
        taggedFriends: taggedFriend.trim() ? [taggedFriend.trim()] : [],
        notes: notes.trim() || null,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await setDoc(userAttendanceRef, attendanceData, { merge: true });

      // Update local state
      setUserAttendance(prev => ({
        ...prev,
        [concertId]: 'going'
      }));

      // Update concert attendance summary
      await updateConcertAttendanceSummary(concertId);

      // Refresh attendees display
      fetchConcertAttendees();

      // Show success message
      Alert.alert(
        'Success! 🎉', 
        `You're now going to ${getArtistName(selectedConcert)}!`,
        [{ text: 'Awesome!', style: 'default' }]
      );

      // Reset form and close modal
      handleCloseModal();
      
    } catch (error) {
      console.error('Error saving attendance:', error);
      Alert.alert('Error', 'Failed to save your attendance. Please try again.');
    } finally {
      setSubmitting(false);
    }
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

  const handleCloseModal = () => {
    if (submitting) return; // Prevent closing while submitting
    
    setSeatSection('');
    setSeatRow('');
    setSeatNumber('');
    setTaggedFriend('');
    setNotes('');
    setShowGoingModal(false);
    setSelectedConcert(null);
  };

  useEffect(() => {
    fetchConcerts();
  }, []);

  // Refresh user attendance when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchUserAttendance();
        fetchConcertAttendees();
      }
    }, [user])
  );

  const fetchUserAttendance = async () => {
    if (!user) return;

    try {
      const attendanceSnapshot = await getDocs(
        query(
          collection(db, 'user_attendance'),
          where('userId', '==', user.uid)
        )
      );
      
      const attendance: {[concertId: string]: 'going' | 'interested' | null} = {};
      attendanceSnapshot.forEach(doc => {
        const data = doc.data();
        attendance[data.concertId] = data.status;
      });
      
      setUserAttendance(attendance);
    } catch (error) {
      console.error('Error fetching user attendance:', error);
    }
  };

  const fetchConcertAttendees = async () => {
    if (!user) return;

    try {
      // Get current user's friends
      const friendshipsSnapshot = await getDocs(
        query(collection(db, 'friendships'))
      );
      
      const friendIds = new Set<string>();
      friendshipsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.user1Id === user.uid) {
          friendIds.add(data.user2Id);
        } else if (data.user2Id === user.uid) {
          friendIds.add(data.user1Id);
        }
      });

      // Get all attendance records for "going" status
      const attendanceSnapshot = await getDocs(
        query(
          collection(db, 'user_attendance'),
          where('status', '==', 'going')
        )
      );

      const attendeesByConcert: {[concertId: string]: { userId: string; name: string; handle: string }[]} = {};

      // Group attendees by concert, only including friends
      for (const docSnap of attendanceSnapshot.docs) {
        const data = docSnap.data();
        const concertId = data.concertId;
        const userId = data.userId;

        // Only include friends (not the current user)
        if (friendIds.has(userId)) {
          // Get user details
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            
            if (!attendeesByConcert[concertId]) {
              attendeesByConcert[concertId] = [];
            }
            
            attendeesByConcert[concertId].push({
              userId: userId,
              name: userData.name || 'Unknown',
              handle: userData.handle || 'unknown'
            });
          }
        }
      }

      setConcertAttendees(attendeesByConcert);
    } catch (error) {
      console.error('Error fetching concert attendees:', error);
    }
  };

  const fetchConcerts = async () => {
    try {
      setLoading(true);
      
      // Get today's date in YYYY-MM-DD format
      const today = new Date();
      const todayString = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
      
      const concertsRef = collection(db, 'concerts');
      const q = query(
        concertsRef, 
        where('dates.start.localDate', '>=', todayString), // Only show concerts from today onwards
        orderBy('dates.start.localDate', 'asc'),
        limit(100) // Fetch more for better pagination
      );
      
      const snapshot = await getDocs(q);
      const concertData: Concert[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Concert));
      
      setAllConcerts(concertData);
      
      const initialConcerts = concertData.slice(0, 15);
      setConcerts(initialConcerts);
      setFilteredConcerts(initialConcerts);
      setDisplayedCount(15);
      setHasMoreConcerts(concertData.length > 15);
    } catch (error) {
      console.error('Error fetching concerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterConcerts = (query: string) => {
    if (!query.trim()) {
      const initialConcerts = allConcerts.slice(0, 15);
      setConcerts(initialConcerts);
      setFilteredConcerts(allConcerts);
      setDisplayedCount(15);
      setHasMoreConcerts(allConcerts.length > 15);
      return;
    }

    const searchTerm = query.toLowerCase().trim();
    const filtered = allConcerts.filter(concert => {
      // Search in artist/attraction names
      const artistMatch = concert.attractions?.some(attraction => 
        attraction.name?.toLowerCase().includes(searchTerm)
      ) || concert.name?.toLowerCase().includes(searchTerm);

      // Search in venue name
      const venueMatch = concert.venue?.name?.toLowerCase().includes(searchTerm);

      // Search in genre
      const genreMatch = concert.classification?.genre?.name?.toLowerCase().includes(searchTerm);

      // Search in city
      const cityMatch = concert.venue?.city?.name?.toLowerCase().includes(searchTerm);

      return artistMatch || venueMatch || genreMatch || cityMatch;
    });

    const initialResults = filtered.slice(0, 15);
    setConcerts(initialResults);
    setFilteredConcerts(filtered);
    setDisplayedCount(15);
    setHasMoreConcerts(filtered.length > 15);
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    filterConcerts(text);
  };

  const applyFilters = () => {
    let filtered = [...allConcerts];

    // Apply search filter
    if (searchQuery.trim()) {
      const searchTerm = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(concert => {
        const artistMatch = concert.attractions?.some(attraction => 
          attraction.name?.toLowerCase().includes(searchTerm)
        ) || concert.name?.toLowerCase().includes(searchTerm);
        const venueMatch = concert.venue?.name?.toLowerCase().includes(searchTerm);
        const genreMatch = concert.classification?.genre?.name?.toLowerCase().includes(searchTerm);
        const cityMatch = concert.venue?.city?.name?.toLowerCase().includes(searchTerm);
        return artistMatch || venueMatch || genreMatch || cityMatch;
      });
    }

    // Apply genre filter
    if (selectedGenres.length > 0) {
      filtered = filtered.filter(concert => 
        selectedGenres.includes(concert.classification?.genre?.name || '')
      );
    }

    // Apply date range filter
    if (selectedDateRange !== 'all') {
      const today = new Date();
      let endDate = new Date(today);
      
      switch (selectedDateRange) {
        case 'week':
          endDate.setDate(today.getDate() + 7);
          break;
        case 'month':
          endDate.setMonth(today.getMonth() + 1);
          break;
        case 'quarter':
          endDate.setMonth(today.getMonth() + 3);
          break;
      }
      
      const endDateString = endDate.toISOString().split('T')[0];
      filtered = filtered.filter(concert => 
        concert.dates?.start?.localDate && concert.dates.start.localDate <= endDateString
      );
    }

    // Apply city filter
    if (selectedCity !== 'all') {
      filtered = filtered.filter(concert => 
        concert.venue?.city?.name === selectedCity
      );
    }

    const initialResults = filtered.slice(0, 15);
    setConcerts(initialResults);
    setFilteredConcerts(filtered);
    setDisplayedCount(15);
    setHasMoreConcerts(filtered.length > 15);
  };

  const clearFilters = () => {
    setSelectedGenres([]);
    setSelectedDateRange('all');
    setSelectedCity('all');
    setSearchQuery('');
    const initialConcerts = allConcerts.slice(0, 15);
    setConcerts(initialConcerts);
    setFilteredConcerts(allConcerts);
    setDisplayedCount(15);
    setHasMoreConcerts(allConcerts.length > 15);
  };

  const getUniqueGenres = () => {
    const genres = new Set<string>();
    allConcerts.forEach(concert => {
      if (concert.classification?.genre?.name) {
        genres.add(concert.classification.genre.name);
      }
    });
    return Array.from(genres).sort();
  };

  const getUniqueCities = () => {
    const cities = new Set<string>();
    allConcerts.forEach(concert => {
      if (concert.venue?.city?.name) {
        cities.add(concert.venue.city.name);
      }
    });
    return Array.from(cities).sort();
  };

  const loadMoreConcerts = () => {
    if (loadingMore || !hasMoreConcerts) return;

    setLoadingMore(true);
    
    // Determine which dataset to use (filtered or all)
    const sourceData = searchQuery.trim() || selectedGenres.length > 0 || selectedDateRange !== 'all' || selectedCity !== 'all' 
      ? filteredConcerts 
      : allConcerts;
    
    const nextCount = displayedCount + 15;
    const nextConcerts = sourceData.slice(0, nextCount);
    
    setTimeout(() => {
      setConcerts(nextConcerts);
      setDisplayedCount(nextCount);
      setHasMoreConcerts(nextCount < sourceData.length);
      setLoadingMore(false);
    }, 500); // Small delay for better UX
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;
    
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
      loadMoreConcerts();
    }
  };

  const formatDate = (dateString: string | number | Date | undefined) => {
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
      // Find the best quality image
      const highResImage = concert.images.find(img => img.width && img.width >= 640) || concert.images[0];
      return highResImage.url;
    }
    return 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&q=80'; // Fallback
  };

  const getArtistName = (concert: Concert) => {
    if (concert.attractions && concert.attractions.length > 0) {
      return concert.attractions[0].name;
    }
    return concert.name;
  };

  const renderAttendanceButton = (concert: Concert, type: 'going' | 'interested') => {
    const isActive = userAttendance[concert.id] === type;
    const isDisabled = userAttendance[concert.id] && userAttendance[concert.id] !== type;
    
    const handlePress = type === 'going' ? () => handleGoingPress(concert) : () => handleInterestedPress(concert);
    
    return (
      <Pressable 
        className={`flex-1 rounded-xl py-2.5 px-3 flex-row items-center justify-center border min-w-0 ${
          isActive 
            ? (type === 'going' ? 'bg-[#589f63] border-[#589f63]' : 'bg-yellow-500 border-yellow-500')
            : isDisabled 
              ? 'bg-tbutton border-[#1f2937]/50' 
              : 'bg-tbutton border-[#1f2937]'
        }`}
        onPress={handlePress}
        disabled={isDisabled}
      >
        {/* <Ionicons 
          name={
            type === 'going' 
              ? (isActive ? "checkmark-circle" : "add")
              : (isActive ? "star" : "star-outline")
          } 
          size={14} 
          color={
            isActive 
              ? "#000" 
              : isDisabled 
                ? "#ffffff" 
                : "#ffffff"
          } 
        /> */}
        <Text className={`ml-1.5 font-medium text-xs text-center flex-1 ${
          isActive 
            ? 'text-background' 
            : isDisabled 
              ? 'text-tmuted/50' 
              : 'text-tmuted'
        }`}>
          {type === 'going' ? 'Going' : 'Interested'}
        </Text>
      </Pressable>
    );
  };

  const renderConcertAttendees = (concertId: string) => {
    const attendees = concertAttendees[concertId] || [];
    
    if (attendees.length === 0) {
      return (
        <View className="flex-row items-center mb-3">
          <Text className="text-tmuted text-xs">
            No friends going yet
          </Text>
        </View>
      );
    }

    const displayedAttendees = attendees.slice(0, 3);
    const remainingCount = Math.max(0, attendees.length - 3);

    return (
      <View className="flex-row items-center mb-3">
        <View className="flex-row">
          {displayedAttendees.map((attendee, index) => (
            <View 
              key={attendee.userId}
              className={`w-6 h-6 rounded-full border border-surface overflow-hidden bg-[#ffc0cb] ${index > 0 ? '-ml-1' : ''}`}
            >
              <View className="w-full h-full items-center justify-center">
                <Text className="text-black text-xs font-bold ">
                  {attendee.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            </View>
          ))}
          {remainingCount > 0 && (
            <View className="w-6 h-6 rounded-full border border-surface overflow-hidden bg-gray-500 -ml-1">
              <View className="w-full h-full items-center justify-center">
                <Text className="text-white text-xs font-bold">
                  +{remainingCount}
                </Text>
              </View>
            </View>
          )}
        </View>
        <Text className="text-tmuted ml-2 text-xs">
          {attendees.length === 1 
            ? `${attendees[0].name} is going`
            : attendees.length === 2
              ? `${attendees[0].name} and ${attendees[1].name} are going`
              : `${attendees[0].name} and ${attendees.length - 1} other${attendees.length - 1 > 1 ? 's' : ''} are going`
          }
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-appbg">
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#ffffff" />
          <Text className="text-tmuted mt-4">Loading concerts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-appbg">
      <ScrollView 
        className="flex-1"
        onScroll={handleScroll}
        scrollEventThrottle={400}
      >
        {/* Header */}
        <View className="items-center px-6 pt-4">
          <View className="w-20 h-20 items-center justify-center mr-4">
            <Image
              source={require('../../../assets/images/encorelogo.png')}
              style={{ 
                width: 100, 
                height: 72, 
                resizeMode: 'contain' 
              }}
            />
          </View>
          {/* <View>
            <Text className="text-tprimary text-xl font-bold">Concerts</Text>
            <Text className="text-tmuted text-sm">Vancouver, BC</Text>
          </View> */}
        </View>

        {/* Search Bar */}
        <View className="px-6 mb-6">
          <View className="flex-row items-center bg-surface rounded-2xl px-4 py-1 border border-[#1f2937]">
            <Ionicons name="search" size={20} color="#6b7280" />
            <Input
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholder="Search shows"
              className="flex-1 ml-3 bg-transparent border-0 text-tprimary"
              style={{
                color: '#f0fdfa',
                fontSize: 16,
              }}
              placeholderTextColor="#6b7280"
            />
            <Pressable 
              className="ml-2 p-2"
              onPress={() => setShowFilterModal(true)}
            >
              <Ionicons name="options" size={20} color="#6b7280" />
            </Pressable>
          </View>
        </View>

        {/* Search Results Header */}
        {searchQuery.trim() && (
          <View className="px-6 mb-4">
            <Text className="text-tmuted text-sm">
              {concerts.length} {concerts.length === 1 ? 'result' : 'results'} for "{searchQuery}"
            </Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && concerts.length === 0 && (
          <View className="px-6 py-12 items-center">
            <Ionicons name="search-outline" size={48} color="#6b7280" />
            <Text className="text-tprimary text-lg font-semibold mt-4 mb-2">
              {searchQuery.trim() ? 'No concerts found' : 'No upcoming concerts'}
            </Text>
            <Text className="text-tmuted text-center text-sm leading-relaxed">
              {searchQuery.trim() 
                ? `Try searching for different artists, venues, or genres.`
                : 'Check back later for new concert announcements!'
              }
            </Text>
            {searchQuery.trim() && (
              <Pressable 
                onPress={() => handleSearchChange('')}
                className="mt-4 bg-brand/20 rounded-xl px-4 py-2"
              >
                <Text className="text-brand font-medium">Clear search</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* All Concerts */}
        {concerts.map((concert) => (
          <View key={concert.id} className="px-6 mb-6">
            <View className="bg-surface rounded-3xl overflow-hidden border border-[#1f2937]">
              <Pressable 
                className="h-44 relative"
                onPress={() => {
                  console.log('Image pressed for concert:', concert.id);
                  router.push({
                    pathname: '/(protected)/venue-view',
                    params: { concertId: concert.id }
                  });
                }}
              >
                <Image
                  source={{ uri: getEventImage(concert) }}
                  className="w-full h-full"
                  style={{ resizeMode: 'cover' }}
                />
                <View className="absolute inset-0 bg-black/40" />
                <View className="absolute bottom-3 left-3 right-3">
                  <Text className="text-white text-[25px] font-timmana -mb-2" numberOfLines={2}>
                    {getArtistName(concert)}
                  </Text>
                  <View className="flex-row items-center">
                    {concert.classification?.genre?.name && (
                      <Text className="text-white/80 text-xs mr-2 flex-shrink-0">
                        {concert.classification.genre.name}
                      </Text>
                    )}
                  </View>
                </View>
              </Pressable>
              
              <View className="p-3">
                {/* Date and Location Info */}
                <View className="flex-row items-center mb-3">
                  <View className="flex-row items-center flex-1 flex-wrap">
                    <Ionicons name="calendar-outline" size={14} color="#ffffff" />
                    <Text className="text-tmuted ml-1 mr-3 text-xs">{formatDate(concert.dates?.start?.localDate)}</Text>
                    <Ionicons name="location-outline" size={14} color="#ffffff" />
                    <Text className="text-tmuted ml-1 text-xs flex-1" numberOfLines={1}>
                      {concert.venue?.name || 'Venue TBA'}
                    </Text>
                  </View>
                </View>

                {/* Genre and City */}
                <View className="flex-row justify-between items-start mb-3">
                  <View className="flex-1">
                    {/* {concert.classification?.genre?.name && (
                      <Text className="text-tmuted text-xs mb-1">
                        {concert.classification.genre.name}
                      </Text>
                    )} */}
                    {/* {concert.venue?.city?.name && (
                      <Text className="text-tmuted text-xs">
                        {concert.venue.city.name}, {concert.venue?.state?.stateCode || concert.venue?.country?.countryCode}
                      </Text>
                    )} */}
                  </View>
                </View>

                {/* Attendees */}
                {renderConcertAttendees(concert.id)}
                
                {/* Attendance Buttons */}
                <View className={`flex-row ${userAttendance[concert.id] === 'going' ? 'justify-center' : 'space-x-2'}`}>
                  {renderAttendanceButton(concert, 'going')}
                  {userAttendance[concert.id] !== 'going' && renderAttendanceButton(concert, 'interested')}
                </View>
              </View>
            </View>
          </View>
        ))}

        {/* Load More Indicator */}
        {loadingMore && (
          <View className="px-6 py-8 items-center">
            <ActivityIndicator size="small" color="#ffffff" />
            <Text className="text-tmuted mt-2 text-sm">Loading more concerts...</Text>
          </View>
        )}

        {/* End of Results */}
        {!loadingMore && !hasMoreConcerts && concerts.length > 0 && (
          <View className="px-6 py-8 items-center">
            <Text className="text-tmuted text-sm">You've reached the end!</Text>
          </View>
        )}

        {/* Bottom spacing for tab bar */}
        <View className="h-6" />
      </ScrollView>

      {/* Going Modal */}
      <Modal
        visible={showGoingModal}
        transparent
        animationType="slide"
        onRequestClose={handleCloseModal}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-surface rounded-t-3xl border-t border-[#1f2937] overflow-hidden">
            {/* Header */}
            <View className="px-6 pt-6 pb-4 border-b border-[#1f2937]/50">
              <View className="flex-row items-center justify-between">
                <View className="flex-1">
                  <Text className="text-tprimary text-xl font-bold mb-1">
                    {selectedConcert ? getArtistName(selectedConcert) : 'Concert'} ✨
                  </Text>
                  <Text className="text-tmuted text-sm">
                    {selectedConcert?.dates?.start?.localDate && formatDate(selectedConcert.dates.start.localDate)} • {selectedConcert?.venue?.name}
                  </Text>
                </View>
                <Pressable 
                  onPress={handleCloseModal}
                  className="w-10 h-10 rounded-full bg-appbg items-center justify-center"
                >
                  <Ionicons name="close" size={20} color="#ffffff" />
                </Pressable>
              </View>
            </View>

            {/* Content */}
            <ScrollView 
              ref={modalScrollViewRef}
              className="px-6 py-6 max-h-96"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text className="text-tprimary text-lg font-semibold mb-6 text-center">
                Add some details 
              </Text>

              {/* Seat Information */}
              <View className="mb-6">
                <View className="flex-row items-center mb-3">
                  <Ionicons name="location" size={18} color="#ffffff" />
                  <Text className="text-tprimary font-medium ml-2">Seat Details</Text>
                  <Text className="text-tmuted text-sm ml-2">(optional)</Text>
                </View>
                <View className="flex-row space-x-3">
                  <View className="flex-1">
                    <TextInput
                      value={seatSection}
                      onChangeText={setSeatSection}
                      placeholder="Section"
                      placeholderTextColor="#6b7280"
                      className="bg-appbg border border-[#374151] rounded-xl px-4 py-3 text-tprimary text-center"
                      style={{ color: '#f0fdfa' }}
                    />
                  </View>
                  <View className="flex-1">
                    <TextInput
                      value={seatRow}
                      onChangeText={setSeatRow}
                      placeholder="Row"
                      placeholderTextColor="#6b7280"
                      className="bg-appbg border border-[#374151] rounded-xl px-4 py-3 text-tprimary text-center"
                      style={{ color: '#f0fdfa' }}
                    />
                  </View>
                  <View className="flex-1">
                    <TextInput
                      value={seatNumber}
                      onChangeText={setSeatNumber}
                      placeholder="Seat #"
                      placeholderTextColor="#6b7280"
                      className="bg-appbg border border-[#374151] rounded-xl px-4 py-3 text-tprimary text-center"
                      style={{ color: '#f0fdfa' }}
                    />
                  </View>
                </View>
              </View>

              {/* Tag a Friend */}
              <View className="mb-6">
                <View className="flex-row items-center mb-3">
                  <Ionicons name="people" size={18} color="#ffffff" />
                  <Text className="text-tprimary font-medium ml-2">Tag Friends</Text>
                  <Text className="text-tmuted text-sm ml-2">(optional)</Text>
                </View>
                <TextInput
                  value={taggedFriend}
                  onChangeText={setTaggedFriend}
                  placeholder="Who's going with you?"
                  placeholderTextColor="#6b7280"
                  className="bg-appbg border border-[#374151] rounded-xl px-4 py-3 text-tprimary"
                  style={{ color: '#f0fdfa' }}
                />
              </View>

              {/* Notes */}
              <View className="mb-2">
                <View className="flex-row items-center mb-3">
                  <Ionicons name="chatbubble-outline" size={18} color="#ffffff" />
                  <Text className="text-tprimary font-medium ml-2">Notes</Text>
                  <Text className="text-tmuted text-sm ml-2">(optional)</Text>
                </View>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Any special plans or notes?"
                  placeholderTextColor="#6b7280"
                  multiline={true}
                  textAlignVertical="top"
                  blurOnSubmit={false}
                  returnKeyType="default"
                  enablesReturnKeyAutomatically={false}
                  onFocus={() => {
                    // Scroll to bottom when notes input is focused
                    console.log('Notes input focused'); // Debug log
                    setTimeout(() => {
                      modalScrollViewRef.current?.scrollTo({
                        x: 0,
                        y: 500, // Try a smaller scroll distance first
                        animated: true
                      });
                    }, 200);
                  }}
                  className="bg-appbg border border-[#374151] rounded-xl px-4 py-3 text-tprimary"
                  style={{ 
                    color: '#f0fdfa',
                    minHeight: 100,
                    maxHeight: 150
                  }}
                />
              </View>
              
              {/* Extra spacing to ensure scrollable content */}
              <View className="h-32" />
            </ScrollView>

            {/* Action Buttons */}
            <View className="px-6 pb-6 pt-2 border-t border-[#1f2937]/50">
              <Pressable 
                onPress={handleSubmitGoing}
                disabled={submitting}
                className={`rounded-2xl py-4 mb-3 flex-row items-center justify-center ${
                  submitting ? 'bg-brand/50' : 'bg-brand'
                }`}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                )}
                <Text className="text-background text-center font-bold text-lg ml-2">
                  {submitting ? 'Saving...' : 'Confirm Going'}
                </Text>
              </Pressable>
              <Pressable 
                onPress={handleCloseModal}
                disabled={submitting}
                className="py-3"
              >
                <Text className={`text-center font-medium ${submitting ? 'text-tmuted/50' : 'text-tmuted'}`}>
                  Maybe later
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View className="flex-1 bg-black/70 justify-end">
          <View className="bg-surface rounded-t-3xl border-t border-[#1f2937] max-h-[80%]">
            {/* Header */}
            <View className="px-6 pt-6 pb-4 border-b border-[#1f2937]/50">
              <View className="flex-row items-center justify-between">
                <Text className="text-tprimary text-xl font-bold">Filters</Text>
                <Pressable 
                  onPress={() => setShowFilterModal(false)}
                  className="w-10 h-10 rounded-full bg-appbg items-center justify-center"
                >
                  <Ionicons name="close" size={20} color="#9ca3af" />
                </Pressable>
              </View>
            </View>

            <ScrollView className="px-6 py-6">
              {/* Genre Filter */}
              <View className="mb-6">
                <Text className="text-tprimary font-semibold mb-3">Genre</Text>
                <View className="flex-row flex-wrap">
                  {getUniqueGenres().map((genre) => (
                    <Pressable
                      key={genre}
                      onPress={() => {
                        if (selectedGenres.includes(genre)) {
                          setSelectedGenres(prev => prev.filter(g => g !== genre));
                        } else {
                          setSelectedGenres(prev => [...prev, genre]);
                        }
                      }}
                      className={`mr-2 mb-2 px-3 py-2 rounded-xl border ${
                        selectedGenres.includes(genre)
                          ? 'bg-brand border-brand'
                          : 'bg-appbg border-[#374151]'
                      }`}
                    >
                      <Text className={`text-sm ${
                        selectedGenres.includes(genre) ? 'text-background' : 'text-tprimary'
                      }`}>
                        {genre}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Date Range Filter */}
              <View className="mb-6">
                <Text className="text-tprimary font-semibold mb-3">Date Range</Text>
                <View className="space-y-2">
                  {[
                    { key: 'all', label: 'All upcoming' },
                    { key: 'week', label: 'Next 7 days' },
                    { key: 'month', label: 'Next month' },
                    { key: 'quarter', label: 'Next 3 months' }
                  ].map((option) => (
                    <Pressable
                      key={option.key}
                      onPress={() => setSelectedDateRange(option.key as any)}
                      className={`p-3 rounded-xl border ${
                        selectedDateRange === option.key
                          ? 'bg-brand/20 border-brand'
                          : 'bg-appbg border-[#374151]'
                      }`}
                    >
                      <Text className={`${
                        selectedDateRange === option.key ? 'text-white' : 'text-tprimary'
                      }`}>
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* City Filter */}
              <View className="mb-6">
                <Text className="text-tprimary font-semibold mb-3">City</Text>
                <View className="space-y-2">
                  <Pressable
                    onPress={() => setSelectedCity('all')}
                    className={`p-3 rounded-xl border ${
                      selectedCity === 'all'
                        ? 'bg-brand/20 border-brand'
                        : 'bg-appbg border-[#374151]'
                    }`}
                  >
                    <Text className={selectedCity === 'all' ? 'text-white' : 'text-tprimary'}>
                      All cities
                    </Text>
                  </Pressable>
                  {getUniqueCities().map((city) => (
                    <Pressable
                      key={city}
                      onPress={() => setSelectedCity(city)}
                      className={`p-3 rounded-xl border ${
                        selectedCity === city
                          ? 'bg-brand/20 border-brand'
                          : 'bg-appbg border-[#374151]'
                      }`}
                    >
                      <Text className={selectedCity === city ? 'text-brand' : 'text-tprimary'}>
                        {city}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View className="px-6 pb-6 pt-2 border-t border-[#1f2937]/50">
              <View className="flex-row space-x-3">
                <Pressable 
                  onPress={() => {
                    clearFilters();
                    setShowFilterModal(false);
                  }}
                  className="flex-1 rounded-2xl py-4 bg-appbg border border-[#374151] items-center"
                >
                  <Text className="text-tmuted font-medium">Clear All</Text>
                </Pressable>
                <Pressable 
                  onPress={() => {
                    applyFilters();
                    setShowFilterModal(false);
                  }}
                  className="flex-1 rounded-2xl py-4 bg-brand items-center"
                >
                  <Text className="text-background font-bold">Apply Filters</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}