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
import {
  TransactionEntity,
  TransactionPageEntity,
} from './entities/transaction-page.entity';
import { TransactionsService } from './transactions.service';

@Controller({ path: 'transactions', version: '1' })
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get('mine')
  async findMine(
    @CurrentUser('sub') userId: string,
    @Query() query: FindTransactionsQueryDto,
  ) {
    return TransactionPageEntity.from(
      await this.transactionsService.findMine(userId, query),
    );
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return TransactionEntity.from(await this.transactionsService.findOne(id, user));
  }

  @Post()
  async create(
    @Body() dto: CreateTransactionDto,
    @CurrentUser('sub') payerId: string,
  ) {
    return TransactionEntity.from(
      await this.transactionsService.create(dto, payerId),
    );
  }

  @Patch(':id/confirm')
  async confirm(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return TransactionEntity.from(await this.transactionsService.confirm(id, user));
  }

  @Patch(':id/cancel')
  async cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return TransactionEntity.from(await this.transactionsService.cancel(id, user));
  }
}
