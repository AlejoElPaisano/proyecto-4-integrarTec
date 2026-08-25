import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  compareRefreshToken,
  hashRefreshToken,
} from './utils/refresh-token-hash';

interface TokenUser {
  id: string;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create(dto.email, dto.name, passwordHash);
    const tokens = await this.issueTokens(user);
    return { user, ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailForAuth(dto.email);
    const passwordMatches = user
      ? await bcrypt.compare(dto.password, user.passwordHash)
      : false;

    if (!user || !user.isActive || !passwordMatches) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    };
    const tokens = await this.issueTokens(user);
    return { user: safeUser, ...tokens };
  }

  async refresh(userId: string, refreshToken: string) {
    const user = await this.usersService.findByIdWithRefreshToken(userId);
    if (!user?.isActive || !user.hashedRefreshToken) {
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

    return this.issueTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.updateRefreshToken(userId, null);
  }

  async getCurrentUser(userId: string) {
    return this.usersService.findPublicProfile(userId);
  }

  private async issueTokens(user: TokenUser) {
    const accessPayload = { sub: user.id, email: user.email };
    const refreshPayload = { ...accessPayload, jti: randomUUID() };
    const refreshOptions: JwtSignOptions = {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN') as JwtSignOptions['expiresIn'],
    };

    const [access_token, refresh_token] = await Promise.all([
      this.jwtService.signAsync(accessPayload),
      this.jwtService.signAsync(refreshPayload, refreshOptions),
    ]);
    const hashedRefreshToken = await hashRefreshToken(refresh_token);
    await this.usersService.updateRefreshToken(user.id, hashedRefreshToken);

    return { access_token, refresh_token };
  }
}
