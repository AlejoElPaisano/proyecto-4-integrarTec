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
import { UsersService } from './users.service';

@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.COORDINATOR, Role.ADMIN)
  getAll() {
    return this.usersService.findAll();
  }

  @Get('me')
  getMe(@CurrentUser('sub') userId: string) {
    return this.usersService.findProfile(userId);
  }

  @Patch('me')
  updateMe(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Patch(':id/role')
  @Roles(Role.ADMIN)
  updateRole(
    @Param('id', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.usersService.updateRole(userId, dto);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  updateStatus(
    @Param('id', ParseUUIDPipe) userId: string,
    @CurrentUser('sub') issuerId: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.usersService.updateStatus(userId, issuerId, dto);
  }

  @Patch(':id/balance')
  @Roles(Role.ADMIN)
  grantBalance(
    @Param('id', ParseUUIDPipe) recipientId: string,
    @CurrentUser('sub') issuerId: string,
    @Body() dto: BalanceGrantDto,
  ) {
    return this.usersService.grantBalance(recipientId, issuerId, dto);
  }

  @Get(':id')
  getById(@Param('id', ParseUUIDPipe) userId: string) {
    return this.usersService.findPublicProfile(userId);
  }
}
