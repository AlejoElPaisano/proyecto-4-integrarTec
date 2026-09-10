import { Throttle } from '@nestjs/throttler';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserEntity } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import {
  AuthResponseEntity,
  TokenResponseEntity,
} from './entities/auth-response.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { JwtPayload } from './interfaces/jwt-payload.interface';

type AuthenticatedRefreshRequest = Request & {
  user: JwtPayload;
};

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return AuthResponseEntity.from(await this.authService.register(dto));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return AuthResponseEntity.from(await this.authService.login(dto));
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() request: AuthenticatedRefreshRequest) {
    const refreshToken = request.headers.authorization?.split(' ')[1];
    return TokenResponseEntity.from(
      await this.authService.refresh(request.user.sub, refreshToken ?? ''),
    );
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser('sub') userId: string): Promise<void> {
    await this.authService.logout(userId);
  }

  @Get('me')
  async me(@CurrentUser('sub') userId: string) {
    return UserEntity.from(await this.authService.getCurrentUser(userId));
  }
}
