import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../../core/auth/auth.types.js';
import { AiGatewayService } from './ai.service.js';

@ApiTags('AI Gateway')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiGatewayService) {}

  @Post('copilot/doctor')
  @ApiOperation({
    summary: 'Execute Doctor Copilot clinical summary & differential diagnosis suggestion',
  })
  async doctorCopilot(
    @Body() promptDto: { patientId: string; chiefComplaint: string },
    @CurrentUser() user: AuthenticatedUser
  ) {
    const response = await this.aiService.executeDoctorCopilot(
      promptDto.patientId,
      promptDto.chiefComplaint,
      user.userId
    );
    return response;
  }

  @Post('copilot/nursing-handover')
  @ApiOperation({ summary: 'Generate structured SBAR nursing shift handover summary' })
  async nursingHandover(@Body() body: { wardId: string }, @CurrentUser() user: AuthenticatedUser) {
    const response = await this.aiService.generateNursingHandover(body.wardId, user.userId);
    return response;
  }
}
