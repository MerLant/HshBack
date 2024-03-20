import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class ExecuteTaskDto {
	@IsNotEmpty()
	@IsString()
	code: string;

	@IsNotEmpty()
	@IsInt()
	taskId: number;
}
