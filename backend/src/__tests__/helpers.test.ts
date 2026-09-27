import { generateIdempotencyKey, normalizeAndDeduplicateEmails, getNextAvailableUTC_HourMs, getCurrentUTCHourString, validateIdempotencyKeyHeader, isProcessingStale } from '../utils/helpers';

describe('Helpers', () => {
  describe('generateIdempotencyKey', () => {
    it('should generate deterministic key', () => {
      const key = generateIdempotencyKey('camp-1', '  Test@EXAMPLE.com  ');
      expect(key).toBe('camp-1:test@example.com');
    });
  });

  describe('normalizeAndDeduplicateEmails', () => {
    it('should remove duplicates and invalid emails', () => {
      const input = [
        'test1@example.com',
        ' TEST1@example.com ',
        'invalid-email',
        'test2@example.com'
      ];
      const result = normalizeAndDeduplicateEmails(input);
      expect(result).toEqual(['test1@example.com', 'test2@example.com']);
    });
  });

  describe('Date Helpers', () => {
    it('should return a valid timestamp for next UTC hour', () => {
      const nextHourMs = getNextAvailableUTC_HourMs();
      expect(typeof nextHourMs).toBe('number');
      expect(nextHourMs).toBeGreaterThan(Date.now());
    });

    it('should return current UTC hour string', () => {
      const str = getCurrentUTCHourString();
      expect(typeof str).toBe('string');
      const parts = str.split('-');
      expect(parts.length).toBe(4); // year, month, date, hour
    });
  });

  describe('Idempotency Key Validation', () => {
    it('should normalize and return valid key', () => {
      expect(validateIdempotencyKeyHeader('  my-key  ')).toBe('my-key');
    });

    it('should return undefined for empty or missing key', () => {
      expect(validateIdempotencyKeyHeader(undefined)).toBeUndefined();
      expect(validateIdempotencyKeyHeader('   ')).toBeUndefined();
      expect(validateIdempotencyKeyHeader('')).toBeUndefined();
    });

    it('should throw error if key is too long', () => {
      const longKey = 'a'.repeat(101);
      expect(() => validateIdempotencyKeyHeader(longKey)).toThrow('Idempotency-Key header is too long');
    });
  });

  describe('Stale Processing Logic', () => {
    it('should return false if processingAt is null', () => {
      expect(isProcessingStale(null)).toBe(false);
    });

    it('should return true if processing started more than 5 minutes ago', () => {
      const nowMs = Date.now();
      const sixMinutesAgo = new Date(nowMs - 6 * 60 * 1000);
      expect(isProcessingStale(sixMinutesAgo, nowMs)).toBe(true);
    });

    it('should return false if processing started less than 5 minutes ago', () => {
      const nowMs = Date.now();
      const fourMinutesAgo = new Date(nowMs - 4 * 60 * 1000);
      expect(isProcessingStale(fourMinutesAgo, nowMs)).toBe(false);
    });
  });
});
