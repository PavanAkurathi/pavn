export interface PushNotificationPayload {
    workerId: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    sound?: 'default' | null;
    badge?: number;
    channelId?: string;  // Android notification channel
}

export interface SendResult {
    success: boolean;
    ticketId?: string;
    error?: string;
}
