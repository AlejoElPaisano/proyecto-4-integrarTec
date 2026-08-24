import {
  compareRefreshToken,
  hashRefreshToken,
} from './refresh-token-hash';

describe('refresh token hashing', () => {
  it('distinguishes tokens sharing the first 72 bytes', async () => {
    const sharedPrefix = 'a'.repeat(72);
    const refreshToken = `${sharedPrefix}.original-refresh-token`;
    const differentRefreshToken = `${sharedPrefix}.different-refresh-token`;

    const hashedRefreshToken = await hashRefreshToken(refreshToken);

    await expect(
      compareRefreshToken(refreshToken, hashedRefreshToken),
    ).resolves.toBe(true);
    await expect(
      compareRefreshToken(differentRefreshToken, hashedRefreshToken),
    ).resolves.toBe(false);
  });
});
