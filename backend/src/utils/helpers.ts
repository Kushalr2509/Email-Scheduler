export function generateIdempotencyKey(campaignId: string, emailAddress: string): string {
  const normalized = emailAddress.trim().toLowerCase();
  return `${campaignId}:${normalized}`;
}

export function getNextAvailableUTC_HourMs(): number {
  const now = new Date();
  const nextHour = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours() + 1,
    0,
    0,
    0
  ));
  return nextHour.getTime();
}

export function getCurrentUTCHourString(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}-${now.getUTCHours()}`;
}

export function normalizeAndDeduplicateEmails(emails: string[]): string[] {
  const validRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const normalized = emails
    .map(e => e.trim().toLowerCase())
    .filter(e => validRegex.test(e));
  
  return Array.from(new Set(normalized));
}

export function validateIdempotencyKeyHeader(rawKey: string | undefined): string | undefined {
  if (!rawKey) return undefined;
  const trimmed = rawKey.trim();
  if (trimmed.length > 100) {
    throw new Error('Idempotency-Key header is too long (max 100 characters)');
  }
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isProcessingStale(processingAt: Date | null, nowMs: number = Date.now()): boolean {
  if (!processingAt) return false;
  const fiveMinutesMs = 5 * 60 * 1000;
  return nowMs - processingAt.getTime() >= fiveMinutesMs;
}
