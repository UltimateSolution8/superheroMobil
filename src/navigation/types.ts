import type { UserRole } from '../api/types';

export type AuthStackParamList = {
  Login: undefined;
  EmailLogin: undefined;
  BuyerSignup: undefined;
  HelperSignup: undefined;
  Otp: { phone: string; role: UserRole; devOtp?: string | null };
};

export type BuyerStackParamList = {
  BuyerHome: undefined;
  BuyerTask: { taskId: string };
  SupportTickets: undefined;
  SupportNewTicket: undefined;
  SupportTicket: { ticketId: string };
};

export type HelperStackParamList = {
  HelperHome: undefined;
  HelperKyc: undefined;
  HelperTask: { taskId: string };
  SupportTickets: undefined;
  SupportNewTicket: undefined;
  SupportTicket: { ticketId: string };
};
