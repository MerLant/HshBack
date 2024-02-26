import { Module } from '@nestjs/common';
import { CheckController } from './check.controller';
import { CheckService } from './check.service';

@Module({
	controllers: [CheckController],
	providers: [CheckService],
})
export class CheckModule {}
