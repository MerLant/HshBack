import { IsNotEmpty, IsString } from 'class-validator';

export class TestTaskDto {
	@IsString()
	input: string;

	@IsString()
	@IsNotEmpty()
	output: string;
}
