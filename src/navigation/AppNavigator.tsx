import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../auth/AuthContext';
import { SocketProvider } from '../realtime/SocketProvider';
import { LoginScreen } from '../screens/LoginScreen';
import { EmailLoginScreen } from '../screens/EmailLoginScreen';
import { BuyerSignupScreen } from '../screens/BuyerSignupScreen';
import { HelperSignupScreen } from '../screens/HelperSignupScreen';
import { OtpScreen } from '../screens/OtpScreen';
import { BuyerHomeScreen } from '../screens/buyer/BuyerHomeScreen';
import { BuyerTaskScreen } from '../screens/buyer/BuyerTaskScreen';
import { HelperHomeScreen } from '../screens/helper/HelperHomeScreen';
import { HelperKycScreen } from '../screens/helper/HelperKycScreen';
import { HelperTaskScreen } from '../screens/helper/HelperTaskScreen';
import { SupportTicketsScreen } from '../screens/support/SupportTicketsScreen';
import { SupportNewTicketScreen } from '../screens/support/SupportNewTicketScreen';
import { SupportTicketScreen } from '../screens/support/SupportTicketScreen';
import type { AuthStackParamList, BuyerStackParamList, HelperStackParamList } from './types';
import { theme } from '../ui/theme';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const BuyerStack = createNativeStackNavigator<BuyerStackParamList>();
const HelperStack = createNativeStackNavigator<HelperStackParamList>();

export function AppNavigator() {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      {status !== 'signedIn' || !user ? (
        <AuthStack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
          <AuthStack.Screen name="Login" component={LoginScreen} />
          <AuthStack.Screen name="EmailLogin" component={EmailLoginScreen} />
          <AuthStack.Screen name="BuyerSignup" component={BuyerSignupScreen} />
          <AuthStack.Screen name="HelperSignup" component={HelperSignupScreen} />
          <AuthStack.Screen name="Otp" component={OtpScreen} />
        </AuthStack.Navigator>
      ) : (
        <SocketProvider>
          {user.role === 'BUYER' ? (
            <BuyerStack.Navigator screenOptions={{ headerShown: false }}>
              <BuyerStack.Screen name="BuyerHome" component={BuyerHomeScreen} />
              <BuyerStack.Screen name="BuyerTask" component={BuyerTaskScreen} />
              <BuyerStack.Screen name="SupportTickets" component={SupportTicketsScreen} />
              <BuyerStack.Screen name="SupportNewTicket" component={SupportNewTicketScreen} />
              <BuyerStack.Screen name="SupportTicket" component={SupportTicketScreen} />
            </BuyerStack.Navigator>
          ) : user.role === 'HELPER' ? (
            <HelperStack.Navigator screenOptions={{ headerShown: false }}>
              <HelperStack.Screen name="HelperHome" component={HelperHomeScreen} />
              <HelperStack.Screen name="HelperKyc" component={HelperKycScreen} />
              <HelperStack.Screen name="HelperTask" component={HelperTaskScreen} />
              <HelperStack.Screen name="SupportTickets" component={SupportTicketsScreen} />
              <HelperStack.Screen name="SupportNewTicket" component={SupportNewTicketScreen} />
              <HelperStack.Screen name="SupportTicket" component={SupportTicketScreen} />
            </HelperStack.Navigator>
          ) : (
            <View style={styles.loading}>
              <Text style={styles.loadingText}>Admin role is not supported in mobile app.</Text>
            </View>
          )}
        </SocketProvider>
      )}
    </NavigationContainer>
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
