import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, Timestamp, where } from 'firebase/firestore';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotification } from '../../../contexts/NotificationContext';
import { db } from '../../../firebase';

interface User {
  id: string;
  name: string;
  handle: string;
  email: string;
}

interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: any;
  fromUser?: User;
  toUser?: User;
}

interface Friendship {
  id: string;
  user1Id: string;
  user2Id: string;
  createdAt: any;
  friend?: User;
}

export default function Friends() {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'friends' | 'search' | 'requests'>('friends');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Friends data
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchFriends();
        fetchFriendRequests();
      }
    }, [user])
  );

  const fetchFriends = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Get friendships where current user is either user1 or user2
      const friendshipsSnapshot = await getDocs(
        query(collection(db, 'friendships'))
      );
      
      const userFriendships: Friendship[] = [];
      
      for (const docSnap of friendshipsSnapshot.docs) {
        const data = docSnap.data();
        if (data.user1Id === user.uid || data.user2Id === user.uid) {
          // Get the friend's user data
          const friendId = data.user1Id === user.uid ? data.user2Id : data.user1Id;
          const friendDoc = await getDoc(doc(db, 'users', friendId));
          
          if (friendDoc.exists()) {
            userFriendships.push({
              id: docSnap.id,
              user1Id: data.user1Id,
              user2Id: data.user2Id,
              createdAt: data.createdAt,
              friend: {
                id: friendDoc.id,
                name: friendDoc.data().name,
                handle: friendDoc.data().handle,
                email: friendDoc.data().email
              }
            });
          }
        }
      }
      
      setFriends(userFriendships);
    } catch (error) {
      console.error('Error fetching friends:', error);
      showNotification('error', 'Failed to load friends');
    } finally {
      setLoading(false);
    }
  };

  const fetchFriendRequests = async () => {
    if (!user) return;

    try {
      // Get incoming friend requests
      const incomingSnapshot = await getDocs(
        query(
          collection(db, 'friend_requests'),
          where('toUserId', '==', user.uid),
          where('status', '==', 'pending')
        )
      );
      
      const incoming: FriendRequest[] = [];
      for (const docSnap of incomingSnapshot.docs) {
        const data = docSnap.data();
        const fromUserDoc = await getDoc(doc(db, 'users', data.fromUserId));
        
        if (fromUserDoc.exists()) {
          incoming.push({
            id: docSnap.id,
            fromUserId: data.fromUserId,
            toUserId: data.toUserId,
            status: data.status,
            createdAt: data.createdAt,
            fromUser: {
              id: fromUserDoc.id,
              name: fromUserDoc.data().name,
              handle: fromUserDoc.data().handle,
              email: fromUserDoc.data().email
            }
          });
        }
      }
      
      // Get sent friend requests
      const outgoingSnapshot = await getDocs(
        query(
          collection(db, 'friend_requests'),
          where('fromUserId', '==', user.uid),
          where('status', '==', 'pending')
        )
      );
      
      const outgoing: FriendRequest[] = [];
      for (const docSnap of outgoingSnapshot.docs) {
        const data = docSnap.data();
        const toUserDoc = await getDoc(doc(db, 'users', data.toUserId));
        
        if (toUserDoc.exists()) {
          outgoing.push({
            id: docSnap.id,
            fromUserId: data.fromUserId,
            toUserId: data.toUserId,
            status: data.status,
            createdAt: data.createdAt,
            toUser: {
              id: toUserDoc.id,
              name: toUserDoc.data().name,
              handle: toUserDoc.data().handle,
              email: toUserDoc.data().email
            }
          });
        }
      }
      
      setFriendRequests(incoming);
      setSentRequests(outgoing);
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query.trim() || !user) {
      setSearchResults([]);
      return;
    }

    try {
      setLoading(true);
      
      const cleanQuery = query.replace('@', '').toLowerCase().trim();
      
      // Search by handle
      const usersSnapshot = await getDocs(
        collection(db, 'users')
      );
      
      const results: User[] = [];
      usersSnapshot.forEach(doc => {
        const userData = doc.data() as User;
        if (
          doc.id !== user.uid && // Don't show current user
          (userData.handle?.toLowerCase().includes(cleanQuery) ||
           userData.name?.toLowerCase().includes(cleanQuery))
        ) {
          results.push({
            id: doc.id,
            name: userData.name,
            handle: userData.handle,
            email: userData.email
          });
        }
      });
      
      setSearchResults(results.slice(0, 20)); // Limit to 20 results
    } catch (error) {
      console.error('Error searching users:', error);
      showNotification('error', 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (toUserId: string) => {
    if (!user) return;

    try {
      // Check if they're already friends first
      const friendshipSnapshot = await getDocs(
        query(collection(db, 'friendships'))
      );
      
      const isAlreadyFriend = friendshipSnapshot.docs.some(doc => {
        const data = doc.data();
        return (data.user1Id === user.uid && data.user2Id === toUserId) ||
               (data.user1Id === toUserId && data.user2Id === user.uid);
      });

      if (isAlreadyFriend) {
        showNotification('error', 'You are already friends with this user');
        return;
      }

      // Check if there's a pending request (only check pending ones)
      const existingSnapshot = await getDocs(
        query(
          collection(db, 'friend_requests'),
          where('fromUserId', '==', user.uid),
          where('toUserId', '==', toUserId),
          where('status', '==', 'pending')
        )
      );

      if (!existingSnapshot.empty) {
        showNotification('error', 'Friend request already sent');
        return;
      }

      // Check if there's a pending request from them to you
      const incomingSnapshot = await getDocs(
        query(
          collection(db, 'friend_requests'),
          where('fromUserId', '==', toUserId),
          where('toUserId', '==', user.uid),
          where('status', '==', 'pending')
        )
      );

      if (!incomingSnapshot.empty) {
        showNotification('error', 'This user has already sent you a friend request. Check your requests tab!');
        return;
      }

      // Create new friend request
      await setDoc(doc(collection(db, 'friend_requests')), {
        fromUserId: user.uid,
        toUserId,
        status: 'pending',
        createdAt: Timestamp.now()
      });

      showNotification('success', 'Friend request sent!');
      fetchFriendRequests();
    } catch (error) {
      console.error('Error sending friend request:', error);
      showNotification('error', 'Failed to send friend request');
    }
  };

  const respondToFriendRequest = async (requestId: string, action: 'accept' | 'decline') => {
    if (!user) return;

    try {
      const requestDoc = await getDoc(doc(db, 'friend_requests', requestId));
      if (!requestDoc.exists()) return;

      const requestData = requestDoc.data();

      if (action === 'accept') {
        // Create friendship
        await setDoc(doc(collection(db, 'friendships')), {
          user1Id: requestData.fromUserId,
          user2Id: user.uid,
          createdAt: Timestamp.now()
        });

        // Update request status
        await setDoc(doc(db, 'friend_requests', requestId), {
          ...requestData,
          status: 'accepted',
          updatedAt: Timestamp.now()
        }, { merge: true });

        fetchFriends();
        showNotification('success', 'Friend request accepted!');
      } else {
        // Update request status to declined
        await setDoc(doc(db, 'friend_requests', requestId), {
          ...requestData,
          status: 'declined',
          updatedAt: Timestamp.now()
        }, { merge: true });
        
        showNotification('success', 'Friend request declined');
      }

      fetchFriendRequests();
    } catch (error) {
      console.error('Error responding to friend request:', error);
      showNotification('error', 'Failed to respond to friend request');
    }
  };

  const removeFriend = async (friendshipId: string) => {
    if (!user) return;
    
    try {
      // First, get the friendship details to know who the friend is
      const friendshipDoc = await getDoc(doc(db, 'friendships', friendshipId));
      if (!friendshipDoc.exists()) {
        showNotification('error', 'Friendship not found');
        return;
      }
      
      const friendshipData = friendshipDoc.data();
      const friendUserId = friendshipData.user1Id === user.uid ? friendshipData.user2Id : friendshipData.user1Id;
      
      // Delete the friendship
      await deleteDoc(doc(db, 'friendships', friendshipId));
      
      // Clean up any pending friend requests between these users (in both directions)
      const friendRequestsSnapshot = await getDocs(
        query(collection(db, 'friend_requests'))
      );
      
      const requestsToDelete: string[] = [];
      friendRequestsSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        // Check for requests in either direction between these two users
        if (
          (data.fromUserId === user.uid && data.toUserId === friendUserId) ||
          (data.fromUserId === friendUserId && data.toUserId === user.uid)
        ) {
          requestsToDelete.push(docSnap.id);
        }
      });
      
      // Delete all related friend requests
      for (const requestId of requestsToDelete) {
        await deleteDoc(doc(db, 'friend_requests', requestId));
      }
      
      showNotification('success', 'Friend removed');
      fetchFriends();
      fetchFriendRequests(); // Refresh requests to update UI
    } catch (error) {
      console.error('Error removing friend:', error);
      showNotification('error', 'Failed to remove friend');
    }
  };

  const cancelFriendRequest = async (toUserId: string) => {
    if (!user) return;

    try {
      // Find the friend request to cancel
      const requestsSnapshot = await getDocs(
        query(
          collection(db, 'friend_requests'),
          where('fromUserId', '==', user.uid),
          where('toUserId', '==', toUserId),
          where('status', '==', 'pending')
        )
      );

      if (!requestsSnapshot.empty) {
        // Delete the friend request
        await deleteDoc(doc(db, 'friend_requests', requestsSnapshot.docs[0].id));
        showNotification('success', 'Friend request cancelled');
        fetchFriendRequests();
      }
    } catch (error) {
      console.error('Error cancelling friend request:', error);
      showNotification('error', 'Failed to cancel friend request');
    }
  };

  const renderFriendItem = ({ item }: { item: Friendship }) => (
    <Pressable
      onPress={() => {
        router.push({
          pathname: '/(protected)/friend-profile',
          params: { 
            friendId: item.friend?.id,
            friendName: item.friend?.name,
            friendHandle: item.friend?.handle
          }
        });
      }}
      className="bg-surface rounded-2xl p-4 mb-3 border border-[#1f2937]"
    >
      <View className="flex-row items-center">
        <View className="w-12 h-12 rounded-full bg-brand/20 items-center justify-center mr-3">
          <Text className="text-brand font-bold text-lg">
            {item.friend?.name?.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-tprimary font-semibold text-lg">{item.friend?.name}</Text>
          <Text className="text-tmuted">@{item.friend?.handle}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#6b7280" />
      </View>
    </Pressable>
  );

  const renderSearchItem = ({ item }: { item: User }) => {
    const hasSentRequest = sentRequests.some(req => req.toUserId === item.id);
    const isFriend = friends.some(f => f.friend?.id === item.id);
    
    return (
      <View className="bg-surface rounded-2xl p-4 mb-3 border border-[#1f2937]">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <View className="flex-row items-center">
              <View className="w-12 h-12 rounded-full bg-brand/20 items-center justify-center mr-3">
                <Text className="text-brand font-bold text-lg">
                  {item.name?.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-tprimary font-semibold text-lg">{item.name}</Text>
                <Text className="text-tmuted">@{item.handle}</Text>
              </View>
            </View>
          </View>
          {isFriend ? (
            <View className="bg-brand/20 rounded-xl px-3 py-2">
              <Text className="text-brand font-medium">Friends</Text>
            </View>
          ) : hasSentRequest ? (
            <Pressable
              onPress={() => cancelFriendRequest(item.id)}
              className="bg-yellow-500/20 rounded-xl px-3 py-2 border border-yellow-500/30"
            >
              <Text className="text-yellow-500 font-medium">Pending</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => sendFriendRequest(item.id)}
              className="bg-brand rounded-xl px-3 py-2"
            >
              <Text className="text-background font-medium">Add Friend</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  const renderRequestItem = ({ item }: { item: FriendRequest }) => (
    <View className="bg-surface rounded-2xl p-4 mb-3 border border-[#1f2937]">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <View className="flex-row items-center">
            <View className="w-12 h-12 rounded-full bg-brand/20 items-center justify-center mr-3">
              <Text className="text-brand font-bold text-lg">
                {item.fromUser?.name?.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-tprimary font-semibold text-lg">{item.fromUser?.name}</Text>
              <Text className="text-tmuted">@{item.fromUser?.handle}</Text>
            </View>
          </View>
        </View>
        <View className="flex-row space-x-2">
          <Pressable
            onPress={() => respondToFriendRequest(item.id, 'decline')}
            className="bg-red-500/20 rounded-xl px-3 py-2"
          >
            <Text className="text-red-400 font-medium">Decline</Text>
          </Pressable>
          <Pressable
            onPress={() => respondToFriendRequest(item.id, 'accept')}
            className="bg-brand rounded-xl px-3 py-2"
          >
            <Text className="text-background font-medium">Accept</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-appbg">
      {/* Header */}
      <View className="px-6 pt-4 pb-6">
        <View className="flex-row items-center">
          <View className="w-12 h-12 rounded-2xl bg-brand items-center justify-center mr-3">
            <Ionicons name="people" size={24} color="#0a0f0f" />
          </View>
          <View>
            <Text className="text-tprimary text-xl font-timmana text-2xl -mb-5">Friends</Text>
          </View>
        </View>
      </View>

      {/* Tab Navigation */}
      <View className="flex-row px-6 mb-6">
        <Pressable
          onPress={() => setActiveTab('friends')}
          className={`flex-1 py-3 px-4 rounded-xl mr-2 ${
            activeTab === 'friends' ? 'bg-brand' : 'bg-surface border border-[#1f2937]'
          }`}
        >
          <Text className={`text-center font-semibold ${
            activeTab === 'friends' ? 'text-background' : 'text-tmuted'
          }`}>
            Friends
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('search')}
          className={`flex-1 py-3 px-4 rounded-xl mx-1 ${
            activeTab === 'search' ? 'bg-brand' : 'bg-surface border border-[#1f2937]'
          }`}
        >
          <Text className={`text-center font-semibold ${
            activeTab === 'search' ? 'text-background' : 'text-tmuted'
          }`}>
            Search
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('requests')}
          className={`flex-1 py-3 px-4 rounded-xl ml-2 ${
            activeTab === 'requests' ? 'bg-brand' : 'bg-surface border border-[#1f2937]'
          }`}
        >
          <Text className={`text-center font-semibold ${
            activeTab === 'requests' ? 'text-background' : 'text-tmuted'
          }`}>
            Requests
          </Text>
        </Pressable>
      </View>

      {/* Tab Content */}
      <View className="flex-1 px-6">
        {activeTab === 'search' && (
          <View className="mb-4">
            <View className="flex-row items-center bg-surface rounded-2xl px-4 py-1 border border-[#1f2937]">
              <Ionicons name="search" size={20} color="#6b7280" />
              <Input
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  searchUsers(text);
                }}
                placeholder="Search by name or @username..."
                className="flex-1 ml-3 bg-transparent border-0 text-white shadow-none"
                style={{ color: '#ffffff', fontSize: 16 }}
                placeholderTextColor="#6b7280"
              />
            </View>
          </View>
        )}

        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        ) : (
          <>
            {activeTab === 'friends' && (
              <>
                {friends.length > 0 && (
                  <View className="mb-4">
                    <Text className="text-tmuted font-semibold text-sm uppercase tracking-wide">
                      MY FRIENDS ({friends.length})
                    </Text>
                  </View>
                )}
                <FlatList<Friendship>
                  data={friends}
                  renderItem={renderFriendItem}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View className="flex-1 justify-center items-center py-12">
                      <View className="w-16 h-16 rounded-2xl bg-surface items-center justify-center mb-4">
                        <Ionicons name="people-outline" size={32} color="#6b7280" />
                      </View>
                      <Text className="text-tprimary text-lg font-semibold mb-2">No Friends Yet</Text>
                      <Text className="text-tmuted text-center">Start by searching for friends to connect with!</Text>
                    </View>
                  }
                />
              </>
            )}
            {activeTab === 'search' && (
              <FlatList<User>
                data={searchResults}
                renderItem={renderSearchItem}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                  <View className="flex-1 justify-center items-center py-12">
                    <View className="w-16 h-16 rounded-2xl bg-surface items-center justify-center mb-4">
                      <Ionicons name="search-outline" size={32} color="#6b7280" />
                    </View>
                    <Text className="text-tprimary text-lg font-semibold mb-2">
                      {searchQuery ? 'No Results' : 'Search for Friends'}
                    </Text>
                    <Text className="text-tmuted text-center">
                      {searchQuery ? 'Try a different search term' : 'Search by name or username to find friends'}
                    </Text>
                  </View>
                }
              />
            )}
            {activeTab === 'requests' && (
              <>
                {friendRequests.length > 0 && (
                  <View className="mb-4">
                    <Text className="text-tmuted font-semibold text-sm uppercase tracking-wide">
                      FRIEND REQUESTS ({friendRequests.length})
                    </Text>
                  </View>
                )}
                <FlatList<FriendRequest>
                  data={friendRequests}
                  renderItem={renderRequestItem}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View className="flex-1 justify-center items-center py-12">
                      <View className="w-16 h-16 rounded-2xl bg-surface items-center justify-center mb-4">
                        <Ionicons name="person-add-outline" size={32} color="#6b7280" />
                      </View>
                      <Text className="text-tprimary text-lg font-semibold mb-2">No Friend Requests</Text>
                      <Text className="text-tmuted text-center">No pending friend requests</Text>
                    </View>
                  }
                />
              </>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}