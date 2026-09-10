import { UserEntity, UserEntityInput } from '../../users/entities/user.entity';

export interface AuthResponseEntityInput {
  user: UserEntityInput;
  access_token: string;
  refresh_token: string;
}

export class AuthResponseEntity {
  user: UserEntity;
  access_token: string;
  refresh_token: string;

  private constructor(response: AuthResponseEntityInput) {
    this.user = UserEntity.from(response.user);
    this.access_token = response.access_token;
    this.refresh_token = response.refresh_token;
  }

  static from(response: AuthResponseEntityInput): AuthResponseEntity {
    return new AuthResponseEntity(response);
  }
}

export interface TokenResponseEntityInput {
  access_token: string;
  refresh_token: string;
}

export class TokenResponseEntity {
  access_token: string;
  refresh_token: string;

  private constructor(response: TokenResponseEntityInput) {
    this.access_token = response.access_token;
    this.refresh_token = response.refresh_token;
  }

  static from(response: TokenResponseEntityInput): TokenResponseEntity {
    return new TokenResponseEntity(response);
  }
}
