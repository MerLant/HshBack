import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class TestTaskDto {
	@IsString()
	@IsOptional()
	id?: string;

	@IsString()
	input: string;

	@IsString()
	@IsNotEmpty()
	output: string;
}
