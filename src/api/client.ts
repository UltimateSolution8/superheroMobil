import { API_BASE_URL } from '../config';
import { fetchJson } from './http';
import type {
  AuthResponse,
  CreateTaskRequest,
  CreateTaskResponse,
  HelperProfile,
  OtpStartResponse,
  SupportMessage,
  SupportTicket,
  SupportTicketCategory,
  SupportTicketDetail,
  Task,
  TaskStatus,
  UserRole,
} from './types';
import { ApiError } from './http';

function url(path: string) {
  return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
}

function authHeaders(accessToken: string | null): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) {
    h.Authorization = `Bearer ${accessToken}`;
  }
  return h;
}

export async function otpStart(phone: string, role: UserRole): Promise<OtpStartResponse> {
  return fetchJson(url('/api/v1/auth/otp/start'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, role }),
  });
}

export async function otpVerify(
  phone: string,
  otp: string,
  role: UserRole,
): Promise<AuthResponse> {
  return fetchJson(url('/api/v1/auth/otp/verify'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp, role }),
  });
}

export async function refresh(refreshToken: string): Promise<AuthResponse> {
  return fetchJson(url('/api/v1/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
}

export async function passwordLogin(email: string, password: string): Promise<AuthResponse> {
  return fetchJson(url('/api/v1/auth/password/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export async function passwordSignup(req: {
  email: string;
  password: string;
  phone?: string | null;
  displayName?: string | null;
  role: UserRole;
}): Promise<AuthResponse> {
  return fetchJson(url('/api/v1/auth/password/signup'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
}

export async function helperSetOnline(
  accessToken: string,
  online: boolean,
  lat?: number,
  lng?: number,
): Promise<void> {
  await fetchJson(url('/api/v1/helper/online'), {
    method: 'PUT',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ online, lat, lng }),
  });
}

export async function helperGetProfile(accessToken: string): Promise<HelperProfile> {
  return fetchJson(url('/api/v1/helper/profile'), {
    method: 'GET',
    headers: authHeaders(accessToken),
  });
}

export async function helperSubmitKyc(
  accessToken: string,
  req: {
    fullName: string;
    idNumber: string;
    idFront: { uri: string; name: string; type: string };
    idBack: { uri: string; name: string; type: string };
    selfie: { uri: string; name: string; type: string };
  },
): Promise<HelperProfile> {
  const body = new FormData();
  body.append('fullName', req.fullName);
  body.append('idNumber', req.idNumber);
  body.append('idFront', req.idFront as unknown as Blob);
  body.append('idBack', req.idBack as unknown as Blob);
  body.append('selfie', req.selfie as unknown as Blob);

  const res = await fetch(url('/api/v1/helper/kyc/submit'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  });

  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    const message = parsed?.message || `Request failed (${res.status})`;
    throw new ApiError(message, { status: res.status, code: parsed?.code, details: parsed?.details });
  }
  return parsed as HelperProfile;
}

export async function createTask(accessToken: string, req: CreateTaskRequest): Promise<CreateTaskResponse> {
  return fetchJson(url('/api/v1/tasks'), {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(req),
  });
}

export async function acceptTask(accessToken: string, taskId: string): Promise<Task> {
  return fetchJson(url(`/api/v1/tasks/${taskId}/accept`), {
    method: 'POST',
    headers: authHeaders(accessToken),
  });
}

export async function updateTaskStatus(
  accessToken: string,
  taskId: string,
  status: TaskStatus,
): Promise<Task> {
  return fetchJson(url(`/api/v1/tasks/${taskId}/status`), {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ status }),
  });
}

export async function uploadTaskSelfie(
  accessToken: string,
  taskId: string,
  req: {
    stage: 'ARRIVAL' | 'COMPLETION';
    lat: number;
    lng: number;
    addressText?: string | null;
    capturedAt?: string;
    selfie: { uri: string; name: string; type: string };
  },
): Promise<Task> {
  const body = new FormData();
  body.append('stage', req.stage);
  body.append('lat', String(req.lat));
  body.append('lng', String(req.lng));
  if (req.addressText) body.append('addressText', req.addressText);
  if (req.capturedAt) body.append('capturedAt', req.capturedAt);
  body.append('selfie', req.selfie as unknown as Blob);

  const res = await fetch(url(`/api/v1/tasks/${taskId}/selfie`), {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  });

  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!res.ok) {
    const message = parsed?.message || `Request failed (${res.status})`;
    throw new ApiError(message, { status: res.status, code: parsed?.code, details: parsed?.details });
  }
  return parsed as Task;
}

export async function getTask(accessToken: string, taskId: string): Promise<Task> {
  return fetchJson(url(`/api/v1/tasks/${taskId}`), {
    method: 'GET',
    headers: authHeaders(accessToken),
  });
}

export async function listSupportTickets(accessToken: string): Promise<SupportTicket[]> {
  return fetchJson(url('/api/v1/support/tickets'), {
    method: 'GET',
    headers: authHeaders(accessToken),
  });
}

export async function getSupportTicket(accessToken: string, ticketId: string): Promise<SupportTicketDetail> {
  return fetchJson(url(`/api/v1/support/tickets/${encodeURIComponent(ticketId)}`), {
    method: 'GET',
    headers: authHeaders(accessToken),
  });
}

export async function createSupportTicket(
  accessToken: string,
  req: { category: SupportTicketCategory; subject?: string | null; message: string; relatedTaskId?: string | null },
): Promise<SupportTicketDetail> {
  return fetchJson(url('/api/v1/support/tickets'), {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify(req),
  });
}

export async function addSupportMessage(
  accessToken: string,
  ticketId: string,
  message: string,
): Promise<SupportMessage> {
  return fetchJson(url(`/api/v1/support/tickets/${encodeURIComponent(ticketId)}/messages`), {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: JSON.stringify({ message }),
  });
}
