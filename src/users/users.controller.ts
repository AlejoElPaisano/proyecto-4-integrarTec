import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../generated/prisma/client';
import { BalanceGrantDto } from './dto/balance-grant.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  AdminUserEntity,
  BalanceGrantResponseEntity,
  UserEntity,
  UserProfileEntity,
} from './entities/user.entity';
import { UsersService } from './users.service';

@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.COORDINATOR, Role.ADMIN)
  async getAll() {
    return AdminUserEntity.fromMany(await this.usersService.findAll());
  }

  @Get('me')
  async getMe(@CurrentUser('sub') userId: string) {
    return UserProfileEntity.from(await this.usersService.findProfile(userId));
  }

  @Patch('me')
  async updateMe(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return UserProfileEntity.from(
      await this.usersService.updateProfile(userId, dto),
    );
  }

  @Patch(':id/role')
  @Roles(Role.ADMIN)
  async updateRole(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return AdminUserEntity.from(await this.usersService.updateRole(userId, dto));
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  async updateStatus(
    @Param('id', ParseUUIDPipe) userId: string,
    @CurrentUser('sub') issuerId: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return AdminUserEntity.from(
      await this.usersService.updateStatus(userId, issuerId, dto),
    );
  }

  @Patch(':id/balance')
  @Roles(Role.ADMIN)
  async grantBalance(
    @Param('id', ParseUUIDPipe) recipientId: string,
    @CurrentUser('sub') issuerId: string,
    @Body() dto: BalanceGrantDto,
  ) {
    return BalanceGrantResponseEntity.from(
      await this.usersService.grantBalance(recipientId, issuerId, dto),
    );
  }

  @Get(':id')
  async getById(@Param('id', ParseUUIDPipe) userId: string) {
    return UserEntity.from(await this.usersService.findPublicProfile(userId));
  }
}
