import { HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ProviderType, Token, User } from '@prisma/client';
import { PrismaService } from '@prisma/prisma.service';
import { UserService } from '@user/user.service';
import { add } from 'date-fns';
import { v4 } from 'uuid';
import { Tokens } from './interfaces';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { REFRESH_TOKEN } from '@auth/auth.controller';
import { YandexUserResponseDto } from '@auth/dto';

@Injectable()
export class AuthService {
	/**
	 * @private
	 * @description Instance of the Logger class for logging purposes.
	 */
	private readonly logger = new Logger(AuthService.name);

	/**
	 * @constructor
	 * @param {UserService} userService - An instance of the UserService for user operations.
	 * @param {JwtService} jwtService - An instance of the JwtService for generating and verifying JWTs.
	 * @param {PrismaService} prismaService - An instance of the PrismaService for interacting with the database.
	 * @param configService
	 */
	constructor(
		private readonly userService: UserService,
		private readonly jwtService: JwtService,
		private readonly prismaService: PrismaService,
		private readonly configService: ConfigService,
	) {}

	/**
	 * Refreshes access and refresh tokens based on a provided refresh token.
	 * @param {string} refreshToken - The refresh token to use for refreshing.
	 * @param {string} userAgent - The user agent making the request.
	 * @returns {Promise<Tokens>} An object containing the new access and refresh tokens.
	 * @throws {UnauthorizedException} If the refresh token is invalid or expired.
	 */
	async refreshTokens(refreshToken: string, userAgent: string): Promise<Tokens> {
		// Находим рефреш-токен в базе данных
		const token = await this.prismaService.token.findFirst({
			where: {
				token: refreshToken,
				userAgent,
			},
			include: {
				user: true,
			},
		});

		// Если рефреш-токена нет, то возвращаем ошибку 401 Unauthorized
		if (!token) {
			throw new UnauthorizedException();
		}

		// Если рефреш-токен истек, то удаляем его из базы данных и возвращаем ошибку 401 Unauthorized
		if (new Date(token.exp) < new Date()) {
			await this.prismaService.token.delete({ where: { id: token.id } });
			throw new UnauthorizedException();
		}

		// Генерируем новый токен и рефреш-токен
		const tokens = await this.generateTokens(token.user, userAgent);

		// Обновляем рефреш-токен в базе данных
		await this.prismaService.token.update({
			where: {
				id: token.id,
			},
			data: {
				token: tokens.refreshToken.token,
				exp: tokens.refreshToken.exp,
			},
		});

		// Возвращаем новый токен и рефреш-токен
		return tokens;
	}

	/**
	 * Generates access and refresh tokens for a given user.
	 * @private
	 * @param {User} user - The user for whom to generate tokens.
	 * @param {string} userAgent - The user agent making the request.
	 * @returns {Promise<Tokens>} An object containing the access and refresh tokens.
	 */
	private async generateTokens(user: User, userAgent: string): Promise<Tokens> {
		const accessToken =
			'Bearer ' +
			this.jwtService.sign({
				id: user.id,
			});
		const refreshToken = await this.getRefreshToken(user.id, userAgent);
		return { accessToken, refreshToken };
	}

	/**
	 * Retrieves or creates a refresh token for a user based on user ID and agent.
	 * @private
	 * @param {string} userId - The ID of the user.
	 * @param {string} agent - The user agent making the request.
	 * @returns {Promise<Token>} The retrieved or created refresh token.
	 */
	private async getRefreshToken(userId: string, agent: string): Promise<Token> {
		const existingToken = await this.prismaService.token.findFirst({
			where: {
				userId,
				userAgent: agent,
			},
		});

		if (existingToken) {
			return this.prismaService.token.update({
				where: {
					id: existingToken.id,
				},
				data: {
					exp: add(new Date(), { months: 1 }),
				},
			});
		}

		return this.prismaService.token.create({
			data: {
				token: v4(),
				exp: add(new Date(), { months: 1 }),
				userId,
				userAgent: agent,
			},
		});
	}

	/**
	 * Deletes a refresh token from the database.
	 * @param {string} refreshToken - The refresh token to delete.
	 * @returns {Promise<Token>} The deleted token (for logging purposes).
	 */
	async deleteRefreshToken(refreshToken: string): Promise<void> {
		// Удаляем рефреш-токен из базы данных
		await this.prismaService.token.delete({ where: { token: refreshToken } });
	}

	/**
	 * Handles authentication using a third-party provider (e.g., Google).
	 * @param user
	 * @param {string} userAgent - The user agent making the request.
	 * @returns {Promise<Tokens>} An object containing the access and refresh tokens.
	 */
	async auth(user: User, userAgent: string): Promise<Tokens> {
		return await this.generateTokens(user, userAgent);
	}

	async registerUser(providerToken: string, providerUserId: string, providerType: Partial<ProviderType>) {
		try {
			const registeredUser = await this.userService.createUser();
			await this.addProviderToUser(registeredUser, providerToken, providerUserId, providerType);
			return registeredUser;
		} catch (error) {
			throw new Error(`User registration error: ${error}`);
		}
	}

	async authYandexUser(yandexToken: string, userAgent: string) {
		const yandexUserId = await this.getUserIdFromYandex(yandexToken);
		const yandexProvider = await this.prismaService.providerType.findFirst({
			where: {
				name: 'YANDEX',
			},
		});

		let user: User | undefined;
		if (await this.isRegistered(yandexUserId, yandexProvider)) {
			user = await this.getUser(yandexUserId, yandexProvider);
		} else {
			user = await this.registerUser(yandexToken, yandexUserId, yandexProvider);
		}

		if (!user) {
			this.logger.error('Authorization error via Yandex');
			throw new HttpException('Authorization error via Yandex', HttpStatus.INTERNAL_SERVER_ERROR);
		}

		return await this.auth(user, userAgent);
	}

	async isRegistered(providerUserId: string, providerType: ProviderType): Promise<boolean> {
		const existingProvider = await this.prismaService.provider.findFirst({
			where: {
				providerUserId: providerUserId,
				providerTypeId: providerType.id,
			},
		});

		return !!existingProvider;
	}

	async getUser(providerUserId: string, providerType: ProviderType) {
		try {
			// Извлекаем пользователя напрямую через связь в provider
			const userProvider = await this.prismaService.provider.findFirst({
				where: {
					providerUserId: providerUserId,
					providerTypeId: providerType.id,
				},
				include: {
					User: true,
				},
			});

			return userProvider.User;
		} catch (error) {
			this.logger.error('Error getting a user:', error);
			throw new HttpException('Error getting a user', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	async addProviderToUser(
		user: Partial<User>,
		providerToken: string,
		providerUserId: string,
		providerType: Partial<ProviderType>,
	) {
		try {
			return await this.prismaService.provider.create({
				data: {
					userId: user.id,
					providerToken: providerToken,
					providerUserId: providerUserId,
					providerTypeId: providerType.id,
				},
			});
		} catch (error) {
			this.logger.error('Error adding a new provider to the user:', error);
			throw new HttpException('Error adding a new provider to the user', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	async setRefreshTokenToCookies(tokens: Tokens, res: Response, noBody: boolean = false) {
		res.cookie(REFRESH_TOKEN, tokens.refreshToken.token, {
			httpOnly: true,
			sameSite: 'lax',
			expires: new Date(tokens.refreshToken.exp),
			secure: this.configService.get('NODE_ENV', 'development') === 'production',
			path: '/',
		});

		if (!noBody) {
			res.status(HttpStatus.CREATED).json({ accessToken: tokens.accessToken });
		}
	}

	async getUserIdFromYandex(token: string) {
		try {
			const response = await axios.get<YandexUserResponseDto>(
				'https://login.yandex.ru/info?format=json&oauth_token=' + token,
			);
			if (!response.data || !response.data.id) {
				throw new HttpException('No user id in response', HttpStatus.BAD_GATEWAY);
			}

			return response.data.id;
		} catch (error) {
			this.logger.error('Failed to get user info from Yandex:', error);

			throw new HttpException(`Failed to get user info from Yandex`, HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}
}
