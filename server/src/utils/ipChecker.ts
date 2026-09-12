/**
 * ipChecker.ts — IP Allowlisting and CIDR Subnet Matcher
 * 
 * Verifies whether a client IP address matches any of the allowed IP ranges (CIDR or single IP).
 * If the allowed ranges array is empty or contains null/all-allowed entries, access is granted to all IPs.
 */

import { logger } from './logger';

function parseIpv4(ipStr: string): number | null {
  const normalized = ipStr.startsWith('::ffff:') ? ipStr.substring(7) : ipStr;
  const parts = normalized.split('.');
  if (parts.length !== 4) return null;
  
  let num = 0;
  for (let i = 0; i < 4; i++) {
    const octet = parseInt(parts[i], 10);
    if (isNaN(octet) || octet < 0 || octet > 255) return null;
    num = (num << 8) + octet;
  }
  return num >>> 0;
}

export function isIpAllowed(clientIp: string | undefined | null, allowedRanges: string[] | undefined | null): boolean {
  // If no allowed ranges specified, or empty list, default to ALLOW ALL (opt-in security behavior)
  if (!allowedRanges || allowedRanges.length === 0) {
    return true;
  }

  if (!clientIp) {
    logger.warn('[IPAllowlist]: Client IP missing from request headers; rejecting IP-restricted access');
    return false;
  }

  // Normalize IPv6 mapped IPv4 address
  const cleanClientIp = clientIp.startsWith('::ffff:') ? clientIp.substring(7) : clientIp.trim();

  // Allow localhost / loopback during dev/testing if loopback explicitly allowed or unrestricted
  if (cleanClientIp === '127.0.0.1' || cleanClientIp === '::1') {
    const localhostInList = allowedRanges.some(r => r.trim() === '127.0.0.1' || r.trim() === '::1' || r.trim() === 'localhost');
    if (localhostInList) return true;
  }

  const clientIpNum = parseIpv4(cleanClientIp);

  for (const rawRange of allowedRanges) {
    const range = rawRange.trim();
    if (!range) continue;

    // Wildcard allow all
    if (range === '*' || range === '0.0.0.0/0' || range === '::/0') {
      return true;
    }

    // Direct string match
    const cleanRange = range.startsWith('::ffff:') ? range.substring(7) : range;
    if (cleanClientIp === cleanRange) {
      return true;
    }

    // CIDR range match (IPv4)
    if (range.includes('/') && clientIpNum !== null) {
      const [subnetStr, bitsStr] = range.split('/');
      const bits = parseInt(bitsStr, 10);
      const subnetNum = parseIpv4(subnetStr);

      if (subnetNum !== null && !isNaN(bits) && bits >= 0 && bits <= 32) {
        if (bits === 0) return true;
        const mask = (0xFFFFFFFF << (32 - bits)) >>> 0;
        if ((clientIpNum & mask) === (subnetNum & mask)) {
          return true;
        }
      }
    }
  }

  return false;
}
