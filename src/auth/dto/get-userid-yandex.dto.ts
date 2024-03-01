import { IsString, IsNotEmpty, Matches, IsNumber, IsOptional } from 'class-validator';

export class YandexUserResponseDto {
	@IsString()
	@IsNotEmpty()
	login: string;

	@IsString()
	@IsNotEmpty()
	id: string;

	@IsString()
	@IsNotEmpty()
	client_id: string;

	@IsString()
	@IsNotEmpty()
	psuid: string;
}

export class YandexAuthResponseDto {
	@IsString()
	@Matches(/bearer/, {
		message: 'token_type must be bearer',
	})
	token_type: string;

	@IsString()
	access_token: string;

	@IsNumber()
	expires_in: number;

	@IsString()
	refresh_token: string;

	@IsString()
	@IsOptional()
	scope: string;
}
