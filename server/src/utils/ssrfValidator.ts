import dns from 'dns';
import net from 'net';
import { AppError } from './errorHandler';
import { logger } from './logger';

/**
 * Validates whether an IPv4 address is in a reserved/private/internal subnet.
 */
export function isPrivateOrReservedIPv4(ip: string): { isPrivate: boolean; reason?: string } {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return { isPrivate: true, reason: 'Malformed IPv4 address' };
  }

  const [a, b, c, d] = parts;

  // 0.0.0.0/8 — Current network (only valid as source)
  if (a === 0) {
    return { isPrivate: true, reason: 'Unspecified/current network address (0.0.0.0/8)' };
  }

  // 127.0.0.0/8 — Loopback addresses (localhost)
  if (a === 127) {
    return { isPrivate: true, reason: 'Loopback address (127.0.0.0/8)' };
  }

  // 10.0.0.0/8 — Private Class A
  if (a === 10) {
    return { isPrivate: true, reason: 'Private network address (10.0.0.0/8)' };
  }

  // 172.16.0.0/12 — Private Class B (172.16.0.0 to 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) {
    return { isPrivate: true, reason: 'Private network address (172.16.0.0/12)' };
  }

  // 192.168.0.0/16 — Private Class C
  if (a === 192 && b === 168) {
    return { isPrivate: true, reason: 'Private network address (192.168.0.0/16)' };
  }

  // 169.254.0.0/16 — Link-Local & Cloud Metadata Service (169.254.169.254 AWS/GCP/Azure)
  if (a === 169 && b === 254) {
    return { isPrivate: true, reason: 'Link-local / Cloud Instance Metadata address (169.254.0.0/16)' };
  }

  // 100.64.0.0/10 — Carrier-Grade NAT (CGNAT)
  if (a === 100 && b >= 64 && b <= 127) {
    return { isPrivate: true, reason: 'Carrier-grade NAT address (100.64.0.0/10)' };
  }

  // 192.0.0.0/24 — IETF Protocol Assignments
  if (a === 192 && b === 0 && c === 0) {
    return { isPrivate: true, reason: 'IETF protocol assignment address (192.0.0.0/24)' };
  }

  // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 — TEST-NETs
  if ((a === 192 && b === 0 && c === 2) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113)) {
    return { isPrivate: true, reason: 'Test/documentation network address' };
  }

  // 198.18.0.0/15 — Network benchmark tests
  if (a === 198 && (b === 18 || b === 19)) {
    return { isPrivate: true, reason: 'Benchmark testing network address (198.18.0.0/15)' };
  }

  // 224.0.0.0/4 — Multicast
  if (a >= 224 && a <= 239) {
    return { isPrivate: true, reason: 'Multicast address (224.0.0.0/4)' };
  }

  // 240.0.0.0/4 — Reserved for future use & 255.255.255.255 Broadcast
  if (a >= 240) {
    return { isPrivate: true, reason: 'Reserved / broadcast network address' };
  }

  return { isPrivate: false };
}

/**
 * Validates whether an IPv6 address is in a reserved/private/internal subnet.
 */
export function isPrivateOrReservedIPv6(ip: string): { isPrivate: boolean; reason?: string } {
  const normalized = ip.toLowerCase().trim();

  // ::1 — Loopback
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') {
    return { isPrivate: true, reason: 'IPv6 loopback address (::1)' };
  }

  // :: — Unspecified
  if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') {
    return { isPrivate: true, reason: 'IPv6 unspecified address (::)' };
  }

  // IPv4-mapped IPv6 address (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (normalized.startsWith('::ffff:')) {
    const v4Part = normalized.replace('::ffff:', '');
    if (v4Part.includes('.')) {
      return isPrivateOrReservedIPv4(v4Part);
    }
  }

  // fe80::/10 — Link-local unicast
  if (/^fe[89ab][0-9a-f]:/i.test(normalized) || normalized.startsWith('fe80:')) {
    return { isPrivate: true, reason: 'IPv6 link-local address (fe80::/10)' };
  }

  // fc00::/7 — Unique local address (ULA - private IPv6)
  if (/^f[cd][0-9a-f]{2}:/i.test(normalized)) {
    return { isPrivate: true, reason: 'IPv6 unique local address (fc00::/7)' };
  }

  // ff00::/8 — Multicast
  if (normalized.startsWith('ff')) {
    return { isPrivate: true, reason: 'IPv6 multicast address (ff00::/8)' };
  }

  // 2001:db8::/32 — Documentation
  if (normalized.startsWith('2001:db8:')) {
    return { isPrivate: true, reason: 'IPv6 documentation address (2001:db8::/32)' };
  }

  return { isPrivate: false };
}

/**
 * Validates whether a target IP address (IPv4 or IPv6) is restricted.
 */
export function isRestrictedIp(ip: string): { isRestricted: boolean; reason?: string } {
  if (ip.includes(':')) {
    const res = isPrivateOrReservedIPv6(ip);
    return { isRestricted: res.isPrivate, reason: res.reason };
  }
  const res = isPrivateOrReservedIPv4(ip);
  return { isRestricted: res.isPrivate, reason: res.reason };
}

/**
 * Authoritatively validates a URL against SSRF attacks.
 * Resolves the destination hostname via DNS and ensures all target IPs are public.
 *
 * @param urlString - The destination URL string to validate.
 * @throws AppError (400, 'SSRF_BLOCKED') if URL targets private or internal infrastructure.
 */
export async function assertSafeUrl(urlString: string): Promise<URL> {
  if (!urlString || typeof urlString !== 'string') {
    throw new AppError(400, 'INVALID_URL', 'URL parameter must be a non-empty string');
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString.trim());
  } catch {
    throw new AppError(400, 'INVALID_URL', 'Provided URL is malformed or invalid');
  }

  // 1. Enforce strict HTTP/HTTPS protocol
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError(
      400,
      'SSRF_BLOCKED',
      `Unsupported protocol '${parsed.protocol}'. Only http: and https: protocols are permitted.`
    );
  }

  // 2. Reject credentials in URL
  if (parsed.username || parsed.password) {
    throw new AppError(
      400,
      'SSRF_BLOCKED',
      'Embedded user credentials in target URLs are strictly prohibited.'
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  // 3. Reject explicit loopback/metadata hostnames
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === 'metadata.google.internal') {
    throw new AppError(
      400,
      'SSRF_BLOCKED',
      `Access to internal hostname '${hostname}' is prohibited.`
    );
  }

  // 4. If hostname is already an IP address, validate directly
  if (net.isIP(hostname)) {
    const directCheck = isRestrictedIp(hostname);
    if (directCheck.isRestricted) {
      logger.warn('SSRF defense blocked direct restricted IP target', { hostname, reason: directCheck.reason });
      throw new AppError(
        400,
        'SSRF_BLOCKED',
        `Target IP '${hostname}' is blocked: ${directCheck.reason}`
      );
    }
  }

  // 5. Authoritatively resolve DNS and verify ALL resolved IP addresses
  try {
    const lookupResults = await dns.promises.lookup(hostname, { all: true });

    if (!lookupResults || lookupResults.length === 0) {
      throw new AppError(400, 'DNS_RESOLUTION_FAILED', `Could not resolve hostname '${hostname}'`);
    }

    for (const record of lookupResults) {
      const check = isRestrictedIp(record.address);
      if (check.isRestricted) {
        logger.warn('SSRF defense blocked resolved restricted IP', {
          hostname,
          resolvedIp: record.address,
          reason: check.reason,
        });
        throw new AppError(
          400,
          'SSRF_BLOCKED',
          `Hostname '${hostname}' resolves to restricted internal IP (${record.address}): ${check.reason}`
        );
      }
    }
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      400,
      'DNS_RESOLUTION_FAILED',
      `Failed to verify destination hostname '${hostname}': ${err.message || 'DNS lookup error'}`
    );
  }

  return parsed;
}

/**
 * Boolean wrapper for assertSafeUrl.
 */
export async function isSafeUrl(urlString: string): Promise<boolean> {
  try {
    await assertSafeUrl(urlString);
    return true;
  } catch {
    return false;
  }
}
