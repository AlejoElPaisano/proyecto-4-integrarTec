import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreateServiceDto } from './dto/create-service.dto';
import { FindServicesQueryDto } from './dto/find-services-query.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServiceEntity } from './entities/service.entity';
import { ServicesService } from './services.service';

@Controller({ path: 'services', version: '1' })
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @Public()
  async findAll(@Query() query: FindServicesQueryDto) {
    return ServiceEntity.fromMany(await this.servicesService.findAll(query));
  }

  @Get('mine')
  async findMine(@CurrentUser('sub') providerId: string) {
    return ServiceEntity.fromMany(await this.servicesService.findMine(providerId));
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return ServiceEntity.from(await this.servicesService.findOne(id));
  }

  @Post()
  async create(
    @Body() dto: CreateServiceDto,
    @CurrentUser('sub') providerId: string,
  ) {
    return ServiceEntity.from(await this.servicesService.create(dto, providerId));
  }

  @Patch(':id/deactivate')
  async deactivate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ) {
    return ServiceEntity.from(await this.servicesService.deactivate(id, user));
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateServiceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return ServiceEntity.from(await this.servicesService.update(id, dto, user));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    await this.servicesService.remove(id, user);
  }
}
