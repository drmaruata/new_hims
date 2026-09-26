import { Module } from '@nestjs/common';
import { CommandCenterController } from './command-center.controller.js';
import { CommandCenterService } from './command-center.service.js';

@Module({
  controllers: [CommandCenterController],
  providers: [CommandCenterService],
  exports: [CommandCenterService],
})
export class CommandCenterModule {}
