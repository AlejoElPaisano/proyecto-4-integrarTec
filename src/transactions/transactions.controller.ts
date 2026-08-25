import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { FindTransactionsQueryDto } from './dto/find-transactions-query.dto';
import { TransactionsService } from './transactions.service';

@Controller({ path: 'transactions', version: '1' })
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get('mine')
  findMine(
    @CurrentUser('sub') userId: string,
    @Query() query: FindTransactionsQueryDto,
  ) {
    return this.transactionsService.findMine(userId, query);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.transactionsService.findOne(id, user);
  }

  @Post()
  create(
    @Body() dto: CreateTransactionDto,
    @CurrentUser('sub') payerId: string,
  ) {
    return this.transactionsService.create(dto, payerId);
  }

  @Patch(':id/confirm')
  confirm(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.transactionsService.confirm(id, user);
  }

  @Patch(':id/cancel')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.transactionsService.cancel(id, user);
  }
}
