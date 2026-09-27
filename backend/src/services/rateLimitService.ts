import { redisClient } from '../utils/redis';
import { getCurrentUTCHourString, getNextAvailableUTC_HourMs } from '../utils/helpers';
import { logger } from '../utils/logger';

export type RateLimitResult = 
  | { status: 'ALLOWED' }
  | { status: 'RATE_LIMITED'; retryAt: number }
  | { status: 'DELAYED'; retryAt: number }
  | { status: 'INFRASTRUCTURE_ERROR'; error: any };

/**
 * Atomic operation using a Lua script to check and increment the rate limit counter.
 * If the limit is reached, it rejects.
 *
 * return 1 for ALLOWED
 * return 0 for REJECTED
 * 
 * Note: The hourly limit counts outbound send attempts.
 * We do not refund Redis counters after SMTP failures to avoid race conditions and abuse.
 */
const rateLimitLuaScript = `
  local rateKey = KEYS[1]
  local delayKey = KEYS[2]
  local hourlyLimit = tonumber(ARGV[1])
  local nowMs = tonumber(ARGV[2])
  local delayMs = tonumber(ARGV[3])
  
  local nextAllowedMs = tonumber(redis.call('get', delayKey) or "0")
  if nowMs < nextAllowedMs then
    return nextAllowedMs
  end

  local currentRate = tonumber(redis.call('get', rateKey) or "0")
  if currentRate >= hourlyLimit then
    return -1
  end

  redis.call('incr', rateKey)
  if currentRate == 0 then
    redis.call('expire', rateKey, 3600)
  end

  redis.call('set', delayKey, nowMs + delayMs)
  redis.call('pexpire', delayKey, delayMs + 1000)

  return 1
`;

export async function checkRateLimit(senderId: string, hourlyLimit: number, delayMs: number = 5000): Promise<RateLimitResult> {
  const currentHour = getCurrentUTCHourString();
  const rateKey = `rate:${senderId}:${currentHour}`;
  const delayKey = `delay:${senderId}`;
  const nowMs = Date.now();

  try {
    const result = await redisClient.eval(rateLimitLuaScript, 2, rateKey, delayKey, hourlyLimit, nowMs, delayMs);
    
    if (result === 1) {
      return { status: 'ALLOWED' };
    } else if (result === -1) {
      return { 
        status: 'RATE_LIMITED', 
        retryAt: getNextAvailableUTC_HourMs() 
      };
    } else {
      return {
        status: 'DELAYED',
        retryAt: result as number
      };
    }
  } catch (error) {
    logger.error('Error executing rate limit Lua script', error);
    return { status: 'INFRASTRUCTURE_ERROR', error };
  }
}
