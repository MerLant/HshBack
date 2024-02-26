import { Body, Controller, Post, Inject } from '@nestjs/common';
import { CheckService } from './check.service';

@Controller('check')
export class CheckController {
	constructor(@Inject(CheckService) private executionService: CheckService) {}

	@Post('execute')
	async executeRequest(@Body('code') code: string) {
		const result = await this.executionService.executeRequest(code);
		return result;
	}
}
