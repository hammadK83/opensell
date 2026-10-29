function isPrivateDevelopmentHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true;

  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  return octets[0] === 10
    || octets[0] === 127
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

export function resolveApiBaseUrl(value: string | undefined, isDevelopment: boolean): string {
  if (!value?.trim()) {
    throw new Error('EXPO_PUBLIC_API_URL is required. Set it to your API origin before starting the app.');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL must be an absolute HTTP or HTTPS URL.');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('EXPO_PUBLIC_API_URL must use HTTP or HTTPS.');
  }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('EXPO_PUBLIC_API_URL must be an origin without credentials, a path, a query, or a fragment.');
  }
  if (url.protocol === 'http:' && (!isDevelopment || !isPrivateDevelopmentHost(url.hostname))) {
    throw new Error('EXPO_PUBLIC_API_URL must use HTTPS except for a private development address.');
  }

  return url.origin;
}
