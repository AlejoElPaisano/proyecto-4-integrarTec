import { createHash } from 'node:crypto';
import * as bcrypt from 'bcrypt';

const REFRESH_TOKEN_BCRYPT_ROUNDS = 10;

export function digestRefreshToken(refreshToken: string): string {
  return createHash('sha256').update(refreshToken, 'utf8').digest('hex');
}

export function hashRefreshToken(refreshToken: string): Promise<string> {
  return bcrypt.hash(
    digestRefreshToken(refreshToken),
    REFRESH_TOKEN_BCRYPT_ROUNDS,
  );
}

export function compareRefreshToken(
  refreshToken: string,
  hashedRefreshToken: string,
): Promise<boolean> {
  return bcrypt.compare(digestRefreshToken(refreshToken), hashedRefreshToken);
}
