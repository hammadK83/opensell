import { tokenStorage } from '../../storage/token.storage';
import { refreshToken } from '../../../features/auth/api/auth.api';

export async function performTokenRefresh() {
  const storedRefreshToken = await tokenStorage.getRefreshToken();

  if (!storedRefreshToken) {
    throw new Error('Refresh token missing');
  }

  const data = await refreshToken({
    refreshToken: storedRefreshToken,
  });

  await tokenStorage.setTokens(data.accessToken, data.refreshToken);

  return data.accessToken;
}
