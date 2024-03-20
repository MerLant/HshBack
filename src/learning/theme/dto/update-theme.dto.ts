import { IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class UpdateThemeDto {
	@IsString()
	@IsOptional()
	@Length(3, 32, { message: 'Name should not be longer than 32 characters' })
	name?: string;

	@IsString()
	@IsOptional()
	@MaxLength(65535, { message: 'Description too long' })
	description?: string;

	@IsBoolean()
	@IsOptional()
	isDisable?: boolean;
}
