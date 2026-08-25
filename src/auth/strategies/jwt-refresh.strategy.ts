import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { compareRefreshToken } from '../utils/refresh-token-hash';

type RefreshRequest = Request & { refreshToken?: string };

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      passReqToCallback: true,
      secretOrKey: config.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });
  }

  async validate(
    request: RefreshRequest,
    payload: JwtPayload,
  ): Promise<JwtPayload> {
    const refreshToken = ExtractJwt.fromAuthHeaderAsBearerToken()(request);
    const user = await this.usersService.findByIdWithRefreshToken(payload.sub);

    if (!user?.isActive || !user.hashedRefreshToken || !refreshToken) {
      throw new ForbiddenException('Refresh token inválido');
    }

    const matches = await compareRefreshToken(
      refreshToken,
      user.hashedRefreshToken,
    );
    if (!matches) {
      await this.usersService.updateRefreshToken(user.id, null);
      throw new ForbiddenException('Refresh token inválido');
    }

    request.refreshToken = refreshToken;
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
  }
}
