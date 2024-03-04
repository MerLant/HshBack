import { IsArray, IsBoolean, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { TaskTestDto } from './task-test.dto';

export class UpdateTaskDto {
	@IsString()
	@IsOptional()
	name?: string;

	@IsString()
	@IsOptional()
	description?: string;

	@IsInt()
	@IsOptional()
	runTimeout?: number;

	@IsInt()
	@IsOptional()
	runMemoryLimit?: number;

	@IsInt()
	@IsOptional()
	compileTimeout?: number;

	@IsInt()
	@IsOptional()
	compileMemoryLimit?: number;

	@IsBoolean()
	@IsOptional()
	isDisable?: boolean;

	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => TaskTestDto)
	@IsOptional()
	tests?: TaskTestDto[];
}
