import { IsNotEmpty, IsString } from 'class-validator';

export class TestTaskDto {
	@IsString()
	@IsNotEmpty()
	input: string;

	@IsString()
	@IsNotEmpty()
	output: string;
}
