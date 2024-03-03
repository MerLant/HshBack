import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCourseDto {
	@IsString()
	@IsNotEmpty()
	name: string;

	@IsString()
	@IsOptional()
	description?: string;

	@IsBoolean()
	@IsOptional()
	isDisable?: boolean;
}
