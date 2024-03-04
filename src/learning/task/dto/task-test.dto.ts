import { IsNotEmpty, IsString } from 'class-validator';

export class TaskTestDto {
	@IsString()
	@IsNotEmpty()
	input: string;

	@IsString()
	@IsNotEmpty()
	output: string;
}
