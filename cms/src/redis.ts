// No-op module — Redis dependency removed for serverless deployment.
// All real-time updates are handled via polling.

export function isRedisConnected(): boolean {
  return false;
}

export async function queueBid(
  _productId: number,
  _bidderId: number,
  _amount: number,
  _censorName: boolean = false
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  return { success: false, error: 'Redis not available' };
}

export async function queueAcceptBid(
  _productId: number,
  _sellerId: number,
  _highestBidderId: number,
  _amount: number
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  return { success: false, error: 'Redis not available' };
}

export async function publishMessageNotification(
  _userId: number,
  _data: {
    type: string;
    messageId: number | string;
    productId: number | string;
    senderId: number | string;
    preview?: string;
    message?: any;
  }
): Promise<boolean> {
  return false;
}

export async function publishProductUpdate(
  _productId: number,
  _data: {
    type: string;
    status?: string;
    currentBid?: number;
    [key: string]: any;
  }
): Promise<boolean> {
  return false;
}

export async function publishTypingStatus(
  _productId: number,
  _userId: number,
  _isTyping: boolean
): Promise<boolean> {
  return false;
}

export async function closeRedis(): Promise<void> {
  // no-op
}
