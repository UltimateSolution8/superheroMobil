import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import { useUploadQueueProcessor } from '../hooks/useUploadQueueProcessor';
import { SocketProvider } from '../realtime/SocketProvider';
import { ActiveTaskProvider } from '../state/ActiveTaskContext';
import { HelperPresenceProvider } from '../state/HelperPresenceContext';
import { LoginScreen } from '../screens/LoginScreen';
import { EmailLoginScreen } from '../screens/EmailLoginScreen';
import { BuyerSignupScreen } from '../screens/BuyerSignupScreen';
import { HelperSignupScreen } from '../screens/HelperSignupScreen';
import { OtpScreen } from '../screens/OtpScreen';
import { SplashScreen } from '../screens/SplashScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { RoleSelectionScreen } from '../screens/RoleSelectionScreen';
import { BuyerLandingScreen } from '../screens/buyer/BuyerLandingScreen';
import { BuyerHomeScreen } from '../screens/buyer/BuyerHomeScreen';
import { BuyerBulkTasksScreen } from '../screens/buyer/BuyerBulkTasksScreen';
import { BuyerBulkRequestScreen } from '../screens/buyer/BuyerBulkRequestScreen';
import { BuyerHelperIdCardScreen } from '../screens/buyer/BuyerHelperIdCardScreen';
import { BuyerTaskScreen } from '../screens/buyer/BuyerTaskScreen';
import { HelperLandingScreen } from '../screens/helper/HelperLandingScreen';
import { HelperHomeScreen } from '../screens/helper/HelperHomeScreen';
import { HelperIdCardScreen } from '../screens/helper/HelperIdCardScreen';
import { HelperLearnScreen } from '../screens/helper/HelperLearnScreen';
import { HelperAssessmentScreen } from '../screens/helper/HelperAssessmentScreen';
import { HelperKycScreen } from '../screens/helper/HelperKycScreen';
import { HelperVideoKycScreen } from '../screens/helper/HelperVideoKycScreen';
import { HelperLiveKycCallScreen } from '../screens/helper/HelperLiveKycCallScreen';
import { HelperTaskScreen } from '../screens/helper/HelperTaskScreen';
import { SupportTicketsScreen } from '../screens/support/SupportTicketsScreen';
import { SupportNewTicketScreen } from '../screens/support/SupportNewTicketScreen';
import { SupportTicketScreen } from '../screens/support/SupportTicketScreen';
import { MenuScreen } from '../screens/common/MenuScreen';
import { ProfileScreen } from '../screens/common/ProfileScreen';
import { HistoryScreen } from '../screens/common/HistoryScreen';
import { PaymentsScreen } from '../screens/common/PaymentsScreen';
import { SettingsScreen } from '../screens/common/SettingsScreen';
import { DiagnosticsScreen } from '../screens/common/DiagnosticsScreen';
import { PinLockScreen } from '../screens/common/PinLockScreen';
import { SosScreen } from '../screens/common/SosScreen';
import { TermsScreen } from '../screens/common/TermsScreen';
import type { AuthStackParamList, BuyerStackParamList, BuyerTabParamList, HelperStackParamList, HelperTabParamList } from './types';
import { theme } from '../ui/theme';
import { useI18n } from '../i18n/I18nProvider';
import { LOCKED_ROLE } from '../config';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const BuyerStack = createNativeStackNavigator<BuyerStackParamList>();
const HelperStack = createNativeStackNavigator<HelperStackParamList>();
const BuyerTab = createBottomTabNavigator<BuyerTabParamList>();
const HelperTab = createBottomTabNavigator<HelperTabParamList>();

function BuyerTabsNavigator() {
  const { user } = useAuth();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const tabBarBottom = Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 6);
  const showBuyerBulkTab = Boolean(user?.bulkCsvEnabled);
  return (
    <BuyerTab.Navigator
      initialRouteName="BuyerLanding"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: 56 + tabBarBottom,
          paddingBottom: tabBarBottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <BuyerTab.Screen
        name="BuyerLanding"
        component={BuyerLandingScreen as any}
        options={{
          tabBarLabel: t('tabs.home'),
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home-variant-outline" size={size} color={color} />,
        }}
      />
      <BuyerTab.Screen
        name="BuyerCreate"
        component={BuyerHomeScreen as any}
        options={{
          tabBarLabel: t('tabs.create_task'),
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="plus-circle-outline" size={size} color={color} />,
        }}
      />
      {showBuyerBulkTab ? (
        <BuyerTab.Screen
          name="BuyerBulk"
          component={BuyerBulkTasksScreen as any}
          options={{
            tabBarLabel: t('tabs.bulk'),
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="file-delimited-outline" size={size} color={color} />,
          }}
        />
      ) : null}
      <BuyerTab.Screen
        name="BuyerProfile"
        component={ProfileScreen as any}
        options={{
          tabBarLabel: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-circle-outline" size={size} color={color} />,
        }}
      />
    </BuyerTab.Navigator>
  );
}

function HelperTabsNavigator() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const tabBarBottom = Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 6);
  return (
    <HelperTab.Navigator
      initialRouteName="HelperLanding"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: 56 + tabBarBottom,
          paddingBottom: tabBarBottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <HelperTab.Screen
        name="HelperLanding"
        component={HelperLandingScreen as any}
        options={{
          tabBarLabel: t('tabs.home'),
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home-variant-outline" size={size} color={color} />,
        }}
      />
      <HelperTab.Screen
        name="HelperTasks"
        component={HelperHomeScreen as any}
        options={{
          tabBarLabel: t('tabs.tasks'),
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="briefcase-outline" size={size} color={color} />,
        }}
      />
      <HelperTab.Screen
        name="HelperLearnTab"
        component={HelperLearnScreen as any}
        options={{
          tabBarLabel: t('tabs.learn'),
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="school-outline" size={size} color={color} />,
        }}
      />
      <HelperTab.Screen
        name="HelperProfile"
        component={ProfileScreen as any}
        options={{
          tabBarLabel: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account-circle-outline" size={size} color={color} />,
        }}
      />
    </HelperTab.Navigator>
  );
}

export function AppNavigator() {
  const { status, user, pinRequired, pinVerified, authNotice } = useAuth();
  const { t } = useI18n();
  useUploadQueueProcessor();

  if (status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <ActiveTaskProvider>
      <NavigationContainer>
        {status !== 'signedIn' || !user ? (
          <AuthStack.Navigator
            screenOptions={{ headerShown: false, animation: 'fade' }}
            initialRouteName={authNotice ? 'Login' : 'Splash'}
          >
            <AuthStack.Screen name="Splash" component={SplashScreen} />
            <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
            {!LOCKED_ROLE ? <AuthStack.Screen name="RoleSelection" component={RoleSelectionScreen} /> : null}
            <AuthStack.Screen name="Login" component={LoginScreen} />
            <AuthStack.Screen name="EmailLogin" component={EmailLoginScreen} />
            {LOCKED_ROLE !== 'HELPER' ? <AuthStack.Screen name="BuyerSignup" component={BuyerSignupScreen} /> : null}
            {LOCKED_ROLE !== 'BUYER' ? <AuthStack.Screen name="HelperSignup" component={HelperSignupScreen} /> : null}
            <AuthStack.Screen name="Otp" component={OtpScreen} />
            <AuthStack.Screen name="Diagnostics" component={DiagnosticsScreen} />
          </AuthStack.Navigator>
        ) : pinRequired && !pinVerified ? (
          <PinLockScreen />
        ) : (
          <SocketProvider>
            <HelperPresenceProvider>
              {user.role === 'BUYER' ? (
                <BuyerStack.Navigator
                  screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: theme.colors.bg } }}
                >
                  <BuyerStack.Screen name="BuyerTabs" component={BuyerTabsNavigator} />
                  <BuyerStack.Screen name="BuyerHome" component={BuyerHomeScreen} />
                  <BuyerStack.Screen name="BuyerBulkTasks" component={BuyerBulkTasksScreen} />
                  <BuyerStack.Screen name="BuyerBulkRequest" component={BuyerBulkRequestScreen} />
                  <BuyerStack.Screen name="BuyerHelperIdCard" component={BuyerHelperIdCardScreen} />
                  <BuyerStack.Screen name="BuyerTask" component={BuyerTaskScreen} />
                  <BuyerStack.Screen name="Menu" component={MenuScreen} />
                  <BuyerStack.Screen name="Profile" component={ProfileScreen} />
                  <BuyerStack.Screen name="History" component={HistoryScreen} />
                  <BuyerStack.Screen name="Payments" component={PaymentsScreen} />
                  <BuyerStack.Screen name="Settings" component={SettingsScreen} />
                  <BuyerStack.Screen name="SOS" component={SosScreen} />
                  <BuyerStack.Screen name="Terms" component={TermsScreen} />
                  <BuyerStack.Screen name="Diagnostics" component={DiagnosticsScreen} />
                  <BuyerStack.Screen name="SupportTickets" component={SupportTicketsScreen} />
                  <BuyerStack.Screen name="SupportNewTicket" component={SupportNewTicketScreen} />
                  <BuyerStack.Screen name="SupportTicket" component={SupportTicketScreen} />
                </BuyerStack.Navigator>
              ) : user.role === 'HELPER' ? (
                <HelperStack.Navigator
                  screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: theme.colors.bg } }}
                >
                  <HelperStack.Screen name="HelperTabs" component={HelperTabsNavigator} />
                  <HelperStack.Screen name="HelperHome" component={HelperHomeScreen} />
                  <HelperStack.Screen name="HelperIdCard" component={HelperIdCardScreen} />
                  <HelperStack.Screen name="HelperLearn" component={HelperLearnScreen} />
                  <HelperStack.Screen name="HelperAssessment" component={HelperAssessmentScreen} />
                  <HelperStack.Screen name="HelperKyc" component={HelperKycScreen} />
                  <HelperStack.Screen name="HelperVideoKyc" component={HelperVideoKycScreen} />
                  <HelperStack.Screen name="HelperLiveKycCall" component={HelperLiveKycCallScreen} />
                  <HelperStack.Screen name="HelperTask" component={HelperTaskScreen} />
                  <HelperStack.Screen name="Menu" component={MenuScreen} />
                  <HelperStack.Screen name="Profile" component={ProfileScreen} />
                  <HelperStack.Screen name="History" component={HistoryScreen} />
                  <HelperStack.Screen name="Payments" component={PaymentsScreen} />
                  <HelperStack.Screen name="Settings" component={SettingsScreen} />
                  <HelperStack.Screen name="SOS" component={SosScreen} />
                  <HelperStack.Screen name="Terms" component={TermsScreen} />
                  <HelperStack.Screen name="Diagnostics" component={DiagnosticsScreen} />
                  <HelperStack.Screen name="SupportTickets" component={SupportTicketsScreen} />
                  <HelperStack.Screen name="SupportNewTicket" component={SupportNewTicketScreen} />
                  <HelperStack.Screen name="SupportTicket" component={SupportTicketScreen} />
                </HelperStack.Navigator>
              ) : (
                <View style={styles.loading}>
                  <Text style={styles.loadingText}>{t('app.admin_not_supported')}</Text>
                </View>
              )}
            </HelperPresenceProvider>
          </SocketProvider>
        )}
      </NavigationContainer>
    </ActiveTaskProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: theme.colors.muted, fontWeight: '700' },
});
