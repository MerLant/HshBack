import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateCourseDto {
	@IsString()
	@IsOptional()
	name?: string;

	@IsString()
	@IsOptional()
	description?: string;

	@IsBoolean()
	@IsOptional()
	isDisable?: boolean;
}
