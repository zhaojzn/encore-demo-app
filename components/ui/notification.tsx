import { Text } from '@/components/ui/text';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Animated, Pressable, View } from 'react-native';
import { useNotification } from '../../contexts/NotificationContext';

const NotificationItem: React.FC<{ 
  notification: { id: string; type: 'success' | 'error' | 'info'; message: string }; 
  onHide: (id: string) => void;
}> = ({ notification, onHide }) => {
  const [slideAnim] = React.useState(new Animated.Value(-100));
  const [opacity] = React.useState(new Animated.Value(0));

  React.useEffect(() => {
    // Slide in animation
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleHide = () => {
    // Slide out animation
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide(notification.id);
    });
  };

  const getBackgroundColor = () => {
    switch (notification.type) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'info':
        return 'bg-blue-500';
      default:
        return 'bg-neutral-500';
    }
  };

  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return 'checkmark-circle';
      case 'error':
        return 'close-circle';
      case 'info':
        return 'information-circle';
      default:
        return 'ellipse';
    }
  };

  return (
    <Animated.View
      style={{
        transform: [{ translateY: slideAnim }],
        opacity: opacity,
      }}
      className={`mx-4 mb-2 rounded-2xl ${getBackgroundColor()} shadow-lg`}
    >
      <Pressable
        onPress={handleHide}
        className="flex-row items-center justify-between px-4 py-3"
      >
        <View className="flex-row items-center flex-1">
          <Ionicons name={getIcon() as any} size={20} color="white" />
          <Text className="text-white font-medium ml-3 flex-1">{notification.message}</Text>
        </View>
        <Ionicons name="close" size={16} color="white" className="ml-2" />
      </Pressable>
    </Animated.View>
  );
};

export const NotificationContainer: React.FC = () => {
  const { notifications, hideNotification } = useNotification();

  if (notifications.length === 0) {
    return null;
  }

  return (
    <View className="absolute top-0 left-0 right-0 z-50 pt-12">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onHide={hideNotification}
        />
      ))}
    </View>
  );
};