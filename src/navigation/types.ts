import type { UserRole } from '../api/types';

export type AuthStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Login: undefined;
  EmailLogin: undefined;
  BuyerSignup: undefined;
  HelperSignup: undefined;
  Otp: { phone: string; role: UserRole; devOtp?: string | null };
};

export type BuyerStackParamList = {
  BuyerHome: undefined;
  BuyerTask: { taskId: string };
  Menu: undefined;
  Profile: undefined;
  History: undefined;
  Payments: undefined;
  Settings: undefined;
  SupportTickets: undefined;
  SupportNewTicket: undefined;
  SupportTicket: { ticketId: string };
};

export type HelperStackParamList = {
  HelperHome: undefined;
  HelperKyc: undefined;
  HelperTask: { taskId: string };
  Menu: undefined;
  Profile: undefined;
  History: undefined;
  Payments: undefined;
  Settings: undefined;
  SupportTickets: undefined;
  SupportNewTicket: undefined;
  SupportTicket: { ticketId: string };
};
