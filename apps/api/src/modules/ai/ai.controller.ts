import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/guards/auth.guard.js';
import { CurrentUser } from '../../core/decorators/current-user.decorator.js';
import { AiGatewayService } from './ai.service.js';

@ApiTags('AI Gateway')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiGatewayService) {}

  @Post('copilot/doctor')
  @ApiOperation({ summary: 'Execute Doctor Copilot clinical summary & differential diagnosis suggestion' })
  async doctorCopilot(@Body() promptDto: { patientId: string; chiefComplaint: string }, @CurrentUser() user: any) {
    const response = await this.aiService.executeDoctorCopilot(promptDto.patientId, promptDto.chiefComplaint, user.userId);
    return { data: response };
  }

  @Post('copilot/nursing-handover')
  @ApiOperation({ summary: 'Generate structured SBAR nursing shift handover summary' })
  async nursingHandover(@Body() body: { wardId: string }, @CurrentUser() user: any) {
    const response = await this.aiService.generateNursingHandover(body.wardId, user.userId);
    return { data: response };
  }
}
