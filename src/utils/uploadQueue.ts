/**
 * Upload queue with retry logic for resilient file uploads.
 * Queues failed uploads and retries with exponential backoff.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'superheroo.uploadQueue';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export type UploadItem = {
    id: string;
    url: string;
    file: { uri: string; name: string; type: string };
    formFields: Record<string, string>;
    accessToken: string;
    retries: number;
    createdAt: number;
};

export type UploadResult = {
    success: boolean;
    response?: any;
    error?: string;
};

async function loadQueue(): Promise<UploadItem[]> {
    try {
        const raw = await AsyncStorage.getItem(QUEUE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

async function saveQueue(queue: UploadItem[]): Promise<void> {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function attemptUpload(item: UploadItem): Promise<UploadResult> {
    const body = new FormData();
    for (const [key, value] of Object.entries(item.formFields)) {
        body.append(key, value);
    }
    body.append('selfie', {
        uri: item.file.uri,
        name: item.file.name,
        type: item.file.type,
    } as any);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    try {
        const res = await fetch(item.url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${item.accessToken}` },
            body,
            signal: controller.signal,
        });

        const text = await res.text();
        const parsed = text ? JSON.parse(text) : null;

        if (!res.ok) {
            return { success: false, error: parsed?.message || `Upload failed (${res.status})` };
        }
        return { success: true, response: parsed };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Upload failed';
        return { success: false, error: msg };
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Enqueue an upload with retry support.
 * Returns true if uploaded successfully immediately.
 * If it fails, it's added to the persistent queue for later retry.
 */
export async function enqueueUpload(item: Omit<UploadItem, 'retries' | 'createdAt'>): Promise<UploadResult> {
    const fullItem: UploadItem = {
        ...item,
        retries: 0,
        createdAt: Date.now(),
    };

    const result = await attemptUpload(fullItem);
    if (result.success) return result;

    // Queue for retry
    const queue = await loadQueue();
    queue.push(fullItem);
    await saveQueue(queue);

    return result;
}

/**
 * Process any queued uploads with exponential backoff.
 * Call this on app foreground or network reconnect.
 */
export async function processQueue(): Promise<void> {
    const queue = await loadQueue();
    if (queue.length === 0) return;

    const remaining: UploadItem[] = [];

    for (const item of queue) {
        if (item.retries >= MAX_RETRIES) continue; // Drop after max retries

        const delay = BASE_DELAY_MS * Math.pow(2, item.retries);
        await sleep(delay);

        const result = await attemptUpload(item);
        if (!result.success) {
            remaining.push({ ...item, retries: item.retries + 1 });
        }
    }

    await saveQueue(remaining);
}

/**
 * Get current queue size for debugging/UI.
 */
export async function getQueueSize(): Promise<number> {
    const queue = await loadQueue();
    return queue.length;
}

/**
 * Clear the entire upload queue.
 */
export async function clearQueue(): Promise<void> {
    await AsyncStorage.removeItem(QUEUE_KEY);
}
