import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Role } from '../generated/prisma/client';
import { CreateReviewDto } from './dto/create-review.dto';
import { PrivateReviewEntity } from './entities/private-review.entity';
import { PublicReviewEntity } from './entities/public-review.entity';
import { ReviewsService } from './reviews.service';

@Controller({ path: 'reviews', version: '1' })
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('mine')
  async findMine(@CurrentUser('sub') reviewerId: string) {
    return PrivateReviewEntity.fromMany(
      await this.reviewsService.findMine(reviewerId),
    );
  }

  @Public()
  @Get('by-user/:userId')
  async findByUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return PublicReviewEntity.fromMany(
      await this.reviewsService.findByUser(userId),
    );
  }

  @Post()
  async create(
    @Body() dto: CreateReviewDto,
    @CurrentUser('sub') reviewerId: string,
  ) {
    return PrivateReviewEntity.from(
      await this.reviewsService.create(dto, reviewerId),
    );
  }

  @Roles(Role.ADMIN)
  @Patch(':id/hide')
  async hide(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() admin: JwtPayload,
  ) {
    return PrivateReviewEntity.from(await this.reviewsService.hide(id, admin));
  }
}
