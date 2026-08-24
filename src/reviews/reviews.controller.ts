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
import { ReviewsService } from './reviews.service';

@Controller({ path: 'reviews', version: '1' })
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('mine')
  findMine(@CurrentUser('sub') reviewerId: string) {
    return this.reviewsService.findMine(reviewerId);
  }

  @Public()
  @Get('by-user/:userId')
  findByUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.reviewsService.findByUser(userId);
  }

  @Post()
  create(
    @Body() dto: CreateReviewDto,
    @CurrentUser('sub') reviewerId: string,
  ) {
    return this.reviewsService.create(dto, reviewerId);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/hide')
  hide(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.reviewsService.hide(id, admin);
  }
}
