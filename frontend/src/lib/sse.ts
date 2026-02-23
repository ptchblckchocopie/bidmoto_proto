import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';

// Connection states
export type SSEConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

// Event types
export interface BidEvent {
  type: 'bid';
  success: boolean;
  bidId?: number;
  amount?: number;
  bidderId?: number;
  bidderName?: string;
  censorName?: boolean;
  bidTime?: string;
  error?: string;
  timestamp: number;
}

export interface MessageEvent {
  type: 'new_message';
  messageId: number;
  productId: number;
  senderId: number;
  preview?: string;
  timestamp: number;
  message?: {
    id: string;
    message: string;
    sender: { id: string; name?: string; email?: string };
    receiver: { id: string };
    product: { id: string };
    read: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

export interface RedisStatusEvent {
  type: 'redis_status';
  connected: boolean;
}

export interface ConnectedEvent {
  type: 'connected';
  productId?: string;
  userId?: string;
  redis?: 'connected' | 'disconnected';
  fallbackPolling?: boolean;
}

export interface AcceptedEvent {
  type: 'accepted';
  success: boolean;
  status: 'sold';
  winnerId?: number;
  amount?: number;
  error?: string;
  timestamp: number;
}

export interface TypingEvent {
  type: 'typing';
  productId: number;
  userId: number;
  isTyping: boolean;
  timestamp: number;
}

export type SSEEvent = BidEvent | MessageEvent | RedisStatusEvent | ConnectedEvent | AcceptedEvent | TypingEvent;

// Smart polling interval based on auction end time
function getPollingInterval(auctionEndDate?: string): number {
  if (!auctionEndDate) return 5000;

  const now = Date.now();
  const endTime = new Date(auctionEndDate).getTime();
  const timeLeft = endTime - now;

  if (timeLeft <= 0) return 10000; // Auction ended, slow poll
  if (timeLeft < 60_000) return 3000; // < 1 minute: fast poll
  if (timeLeft < 3_600_000) return 5000; // < 1 hour: normal poll
  return 10000; // > 1 hour: slow poll
}

// Product polling client (replaces SSE)
class ProductSSEClient {
  private productId: string;
  private listeners: Set<(event: SSEEvent) => void> = new Set();
  private pollingTimer: ReturnType<typeof setTimeout> | null = null;
  private active = false;
  private lastBidAmount: number | null = null;
  private lastStatus: string | null = null;
  private auctionEndDate: string | undefined;

  public state: Writable<SSEConnectionState> = writable('disconnected');
  public lastBid: Writable<BidEvent | null> = writable(null);
  public redisConnected: Writable<boolean> = writable(false);

  constructor(productId: string) {
    this.productId = productId;
  }

  connect(): void {
    if (!browser) return;
    if (this.active) return;

    this.active = true;
    this.state.set('connected');

    // Start polling immediately
    this.poll();
    this.scheduleNextPoll();

    // Pause polling when tab is hidden
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private handleVisibilityChange = () => {
    if (document.hidden) {
      this.stopPolling();
    } else if (this.active) {
      this.poll();
      this.scheduleNextPoll();
    }
  };

  private scheduleNextPoll(): void {
    this.stopPolling();
    if (!this.active || document.hidden) return;

    const interval = getPollingInterval(this.auctionEndDate);
    this.pollingTimer = setTimeout(() => {
      if (this.active && !document.hidden) {
        this.poll();
        this.scheduleNextPoll();
      }
    }, interval);
  }

  private stopPolling(): void {
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  private async poll(): Promise<void> {
    try {
      const response = await fetch(`/api/bridge/products/${this.productId}/status`);

      if (response.ok) {
        const data = await response.json();

        // Store auction end date for smart polling
        if (data.auctionEndDate) {
          this.auctionEndDate = data.auctionEndDate;
        }

        // Detect bid changes
        if (data.currentBid !== this.lastBidAmount) {
          const event: BidEvent = {
            type: 'bid',
            success: true,
            amount: data.currentBid,
            timestamp: Date.now(),
          };
          this.lastBid.set(event);
          this.listeners.forEach((listener) => listener(event));
          this.lastBidAmount = data.currentBid;
        }

        // Detect status changes (e.g., sold, ended)
        if (data.status !== this.lastStatus && this.lastStatus !== null) {
          if (data.status === 'sold') {
            const event: AcceptedEvent = {
              type: 'accepted',
              success: true,
              status: 'sold',
              amount: data.currentBid,
              timestamp: Date.now(),
            };
            this.listeners.forEach((listener) => listener(event));
          }
        }
        this.lastStatus = data.status;
      }
    } catch {
      // Silently ignore polling errors
    }
  }

  subscribe(callback: (event: SSEEvent) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  disconnect(): void {
    this.active = false;
    this.stopPolling();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.state.set('disconnected');
    this.listeners.clear();
  }
}

// User notification polling client (replaces SSE)
class UserSSEClient {
  private userId: string;
  private listeners: Set<(event: SSEEvent) => void> = new Set();
  private pollingTimer: ReturnType<typeof setTimeout> | null = null;
  private active = false;
  private lastUnreadCount = -1;

  public state: Writable<SSEConnectionState> = writable('disconnected');
  public lastMessage: Writable<MessageEvent | null> = writable(null);
  public unreadCount: Writable<number> = writable(0);

  constructor(userId: string) {
    this.userId = userId;
  }

  connect(): void {
    if (!browser) return;
    if (this.active) return;

    this.active = true;
    this.state.set('connected');

    // Start polling
    this.poll();
    this.scheduleNextPoll();

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private handleVisibilityChange = () => {
    if (document.hidden) {
      this.stopPolling();
    } else if (this.active) {
      this.poll();
      this.scheduleNextPoll();
    }
  };

  private scheduleNextPoll(): void {
    this.stopPolling();
    if (!this.active || document.hidden) return;

    this.pollingTimer = setTimeout(() => {
      if (this.active && !document.hidden) {
        this.poll();
        this.scheduleNextPoll();
      }
    }, 15000); // Poll every 15 seconds for notifications
  }

  private stopPolling(): void {
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  private async poll(): Promise<void> {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      const response = await fetch('/api/bridge/notifications/poll', {
        headers: {
          ...(token ? { Authorization: `JWT ${token}` } : {}),
        },
      });

      if (response.ok) {
        const data = await response.json();

        if (data.unreadCount !== this.lastUnreadCount && this.lastUnreadCount !== -1) {
          if (data.unreadCount > this.lastUnreadCount) {
            const event: MessageEvent = {
              type: 'new_message',
              messageId: 0,
              productId: 0,
              senderId: 0,
              timestamp: Date.now(),
            };
            this.lastMessage.set(event);
            this.listeners.forEach((listener) => listener(event));
          }
        }

        this.unreadCount.set(data.unreadCount);
        this.lastUnreadCount = data.unreadCount;
      }
    } catch {
      // Silently ignore polling errors
    }
  }

  subscribe(callback: (event: SSEEvent) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  resetUnreadCount(): void {
    this.unreadCount.set(0);
    this.lastUnreadCount = 0;
  }

  disconnect(): void {
    this.active = false;
    this.stopPolling();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.state.set('disconnected');
    this.listeners.clear();
  }
}

// Singleton managers
const productClients = new Map<string, ProductSSEClient>();
const userClients = new Map<string, UserSSEClient>();

export function getProductSSE(productId: string): ProductSSEClient {
  if (!productClients.has(productId)) {
    productClients.set(productId, new ProductSSEClient(productId));
  }
  return productClients.get(productId)!;
}

export function getUserSSE(userId: string): UserSSEClient {
  if (!userClients.has(userId)) {
    userClients.set(userId, new UserSSEClient(userId));
  }
  return userClients.get(userId)!;
}

export function disconnectProductSSE(productId: string): void {
  const client = productClients.get(productId);
  if (client) {
    client.disconnect();
    productClients.delete(productId);
  }
}

export function disconnectUserSSE(userId: string): void {
  const client = userClients.get(userId);
  if (client) {
    client.disconnect();
    userClients.delete(userId);
  }
}

export function disconnectAll(): void {
  productClients.forEach((client) => client.disconnect());
  productClients.clear();
  userClients.forEach((client) => client.disconnect());
  userClients.clear();
}

// Queue bid helper
export async function queueBid(
  productId: string | number,
  amount: number,
  censorName: boolean = false
): Promise<{ success: boolean; jobId?: string; bidId?: number; error?: string; fallback?: boolean }> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  try {
    const response = await fetch('/api/bridge/bid/queue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `JWT ${token}` } : {}),
      },
      body: JSON.stringify({
        productId: typeof productId === 'string' ? parseInt(productId, 10) : productId,
        amount,
        censorName,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || 'Failed to place bid' };
    }

    return data;
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
