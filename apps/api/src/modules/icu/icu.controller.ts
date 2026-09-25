import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/auth.guard.js';
import { CurrentUser } from '../../core/decorators/current-user.decorator.js';
import { IcuService } from './icu.service.js';

@ApiTags('ICU')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('icu')
export class IcuController {
  constructor(private readonly icuService: IcuService) {}

  @Get('episodes')
  @ApiOperation({ summary: 'Get active ICU patient episodes, flowsheet data and ventilator monitoring' })
  async getEpisodes(@CurrentUser() user: any) {
    const episodes = await this.icuService.getEpisodes(user.tenantId, user.facilityId);
    return { data: episodes };
  }
}
