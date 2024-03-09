import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TestTaskDto } from 'src/learning/task/dto/test-task.dto';

export class CreateTaskDto {
	@IsString()
	@IsNotEmpty()
	name: string;

	@IsString()
	@IsOptional()
	description?: string;

	@IsInt()
	runTimeout: number;

	@IsInt()
	runMemoryLimit: number;

	@IsInt()
	compileTimeout: number;

	@IsInt()
	compileMemoryLimit: number;

	@IsInt()
	themeId: number;

	@IsBoolean()
	@IsOptional()
	isDisable?: boolean = false;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => TestTaskDto)
	tests: TestTaskDto[];
}
