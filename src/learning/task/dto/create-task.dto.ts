import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TaskTestDto } from './task-test.dto';

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
	@Type(() => TaskTestDto)
	tests: TaskTestDto[];
}
