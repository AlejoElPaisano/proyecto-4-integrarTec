import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';

@Controller({ path: 'health', version: '1' })
export class HealthController {
  @Get()
  @Public()
  @SkipThrottle()
  getHealth(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
