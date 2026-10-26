export const QUOTA_RESERVE_LUA = `
if redis.call('EXISTS', KEYS[2]) == 1 then
  return {1, tonumber(redis.call('GET', KEYS[1]) or '0')}
end
local used = tonumber(redis.call('GET', KEYS[1]) or '0')
if used >= tonumber(ARGV[1]) then
  return {0, used}
end
used = redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], ARGV[3], 'EX', ARGV[4])
return {1, used}
`;

export const QUOTA_RELEASE_LUA = `
local day = redis.call('GET', KEYS[1])
if not day then return 0 end
redis.call('DEL', KEYS[1])
local used = tonumber(redis.call('GET', KEYS[2]) or '0')
if used > 0 then redis.call('DECR', KEYS[2]) end
return 1
`;
