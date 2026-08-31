import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Bell, Home, Plus, UserRound, Wrench } from './src/components/AliIcon';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import type {
  MainTabParamList,
  RootStackParamList,
} from './src/navigation/types';
import { AuthScreen } from './src/screens/AuthScreen';
import { AccountSettingsScreen } from './src/screens/AccountSettingsScreen';
import { AIScreen } from './src/screens/AIScreen';
import { AnnouncementsScreen } from './src/screens/AnnouncementsScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { ComposeScreen } from './src/screens/ComposeScreen';
import { ContentListScreen } from './src/screens/ContentListScreen';
import { EditProfileScreen } from './src/screens/EditProfileScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { MessagesScreen } from './src/screens/MessagesScreen';
import { PostDetailScreen } from './src/screens/PostDetailScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { ToolsScreen } from './src/screens/ToolsScreen';
import { VerificationScreen } from './src/screens/VerificationScreen';
import { useAppTheme } from './src/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 20_000 },
    mutations: { retry: 0 },
  },
});

function MainTabs() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 58 + insets.bottom,
          paddingTop: 7,
          paddingBottom: Math.max(insets.bottom, 6),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarIcon: ({ color, focused }) => {
          const common = { size: 21, color };
          if (route.name === 'Compose')
            return (
              <View
                style={[
                  styles.composeIcon,
                  {
                    backgroundColor: theme.colors.primary,
                    borderColor: theme.colors.surface,
                  },
                ]}
              >
                <Plus size={25} color="#FFFFFF" strokeWidth={2.8} />
              </View>
            );
          const Icon =
            route.name === 'Home'
              ? Home
              : route.name === 'Tools'
              ? Wrench
              : route.name === 'Messages'
              ? Bell
              : UserRound;
          return (
            <View
              style={[
                styles.tabIcon,
                focused && { backgroundColor: theme.colors.primarySoft },
              ]}
            >
              <Icon {...common} />
            </View>
          );
        },
        lazy: true,
        freezeOnBlur: true,
      })}
    >
      <Tabs.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: '首页' }}
      />
      <Tabs.Screen
        name="Tools"
        component={ToolsScreen}
        options={{ title: '工具' }}
      />
      <Tabs.Screen
        name="Compose"
        component={ComposeScreen}
        options={{
          title: '发布',
          tabBarLabelStyle: { fontSize: 11, fontWeight: '800' },
        }}
      />
      <Tabs.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ title: '消息' }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: '个人页' }}
      />
    </Tabs.Navigator>
  );
}

function AppNavigator() {
  const theme = useAppTheme();
  const { account, loading } = useAuth();
  const navigationTheme = useMemo<NavigationTheme>(
    () => ({
      ...(theme.dark ? DarkTheme : DefaultTheme),
      colors: {
        ...(theme.dark ? DarkTheme.colors : DefaultTheme.colors),
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.text,
        border: theme.colors.border,
        notification: theme.colors.primary,
      },
    }),
    [theme],
  );

  if (loading) {
    return (
      <View
        style={[styles.splash, { backgroundColor: theme.colors.background }]}
        accessibilityRole="progressbar"
      >
        <View
          style={[styles.splashMark, { backgroundColor: theme.colors.primary }]}
        >
          <Text style={styles.splashLetter}>x</Text>
        </View>
        <Text style={[styles.splashName, { color: theme.colors.text }]}>
          xsnbb
        </Text>
        <ActivityIndicator
          color={theme.colors.primary}
          style={styles.splashSpinner}
        />
      </View>
    );
  }

  if (!account) {
    return <AuthScreen />;
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.surface },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontSize: 17, fontWeight: '800' },
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PostDetail"
          component={PostDetailScreen}
          options={{ title: '帖子详情' }}
        />
        <Stack.Screen
          name="Search"
          component={SearchScreen}
          options={{ title: '搜索' }}
        />
        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={({ route }) => ({ title: route.params.title })}
        />
        <Stack.Screen
          name="ContentList"
          component={ContentListScreen}
          options={({ route }) => ({ title: route.params.title })}
        />
        <Stack.Screen
          name="EditProfile"
          component={EditProfileScreen}
          options={{ title: '编辑资料' }}
        />
        <Stack.Screen
          name="Verification"
          component={VerificationScreen}
          options={{ title: '学生认证' }}
        />
        <Stack.Screen
          name="AccountSettings"
          component={AccountSettingsScreen}
          options={{ title: '账号设置' }}
        />
        <Stack.Screen
          name="AI"
          component={AIScreen}
          options={{ title: '校园 AI 助手' }}
        />
        <Stack.Screen
          name="Announcements"
          component={AnnouncementsScreen}
          options={{ title: '平台公告' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const theme = useAppTheme();
  return (
    <SafeAreaProvider>
      <StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    width: 38,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composeIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -22,
  },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  splashMark: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLetter: {
    fontSize: 40,
    lineHeight: 47,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  splashName: { fontSize: 24, fontWeight: '900', marginTop: 12 },
  splashSpinner: { marginTop: 24 },
});
