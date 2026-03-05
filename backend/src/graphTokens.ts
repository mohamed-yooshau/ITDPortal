type TokenEntry = {
  accessToken: string;
  expiresAt: number;
};

const tokenCache = new Map<string, TokenEntry>();

export function setGraphToken(email: string, accessToken: string, expiresOn: Date | null): void {
  const expiresAt = expiresOn ? expiresOn.getTime() : Date.now() + 50 * 60 * 1000;
  tokenCache.set(email.toLowerCase(), { accessToken, expiresAt });
}

export function getGraphToken(email: string): string | null {
  const entry = tokenCache.get(email.toLowerCase());
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    tokenCache.delete(email.toLowerCase());
    return null;
  }
  return entry.accessToken;
}
