import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import BrowseScreen from '../features/browse/screens/BrowseScreen';
import ProfileScreen from '../features/profile/screens/ProfileScreen';
import ChatListScreen from '../features/chat/screens/ChatListScreen';
import { colors } from '../../theme/colors';

export type AppTabsParamList = {
  Browse: undefined;
  Chats: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<AppTabsParamList>();
const icons = {
  Browse: ['search', 'search-outline'],
  Chats: ['chatbubbles', 'chatbubbles-outline'],
  Profile: ['person', 'person-outline'],
} as const;

export default function AppTabs() {
  return (
    <Tab.Navigator initialRouteName="Browse" backBehavior="initialRoute"
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={icons[route.name][focused ? 0 : 1]} color={color} size={size} />
        ),
      })}>
      <Tab.Screen name="Browse" component={BrowseScreen} />
      <Tab.Screen name="Chats" component={ChatListScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
