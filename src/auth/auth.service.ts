import { HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ProviderType, Session, Token, User } from '@prisma/client';
import { PrismaService } from '@prisma/prisma.service';
import { UserService } from '@user/user.service';
import { Tokens } from './interfaces';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { REFRESH_TOKEN } from '@auth/auth.controller';
import { YandexUserResponseDto } from '@auth/dto';
import { v4 } from 'uuid';

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
	) {
	}

	/**
	 * Генерирует токены доступа и обновления для пользователя.
	 *
	 * @param {User} user - Пользователь, для которого генерируются токены.
	 * @param {string} userAgent - User agent источника запроса.
	 * @returns {Promise<Tokens>} Объект, содержащий новые токены доступа и обновления.
	 */
	private async generateTokens(user: User, userAgent: string): Promise<Tokens> {
		const accessToken = 'Bearer ' + this.jwtService.sign({ id: user.id });

		// Создаем новый рефреш-токен.
		const refreshTokenObject = await this.createRefreshToken(user.id, userAgent);

		// Возвращаем объект, содержащий все необходимые данные о токенах.
		return {
			accessToken,
			refreshToken: refreshTokenObject, // Теперь возвращаем весь объект рефреш-токена.
		};
	}

	/**
	 * Создает новый рефреш-токен в базе данных.
	 *
	 * @param {string} userId - Идентификатор пользователя.
	 * @param {string} userAgent - User agent источника запроса.
	 * @returns {Promise<Token>} Объект нового рефреш-токена.
	 */
	private async createRefreshToken(userId: string, userAgent: string): Promise<Token> {
		return this.prismaService.token.create({
			data: {
				userId: userId,
				userAgent: userAgent,
				token: v4(), // Генерация уникального токена.
				exp: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // Пример: устанавливаем срок действия на 30 дней.
			},
		});
	}

	/**
	 * Обновляет токены доступа и обновления на основе предоставленного рефреш-токена.
	 *
	 * @param {string} refreshToken - Рефреш-токен, используемый для обновления.
	 * @param {string} userAgent - User agent источника запроса.
	 * @returns {Promise<Tokens>} Объект, содержащий новые токены доступа и обновления.
	 * @throws {UnauthorizedException} Если рефреш-токен недействителен или истек.
	 */
	async refreshTokens(refreshToken: string, userAgent: string): Promise<Tokens> {
		const oldToken = await this.getRefreshToken(refreshToken);

		if (!oldToken || new Date(oldToken.exp) < new Date() || oldToken.userAgent !== userAgent) {
			if (oldToken) {
				await this.deleteRefreshToken(oldToken.token);
			}
			throw new UnauthorizedException();
		}

		// Генерируем новые токены и создаем новый рефреш-токен в базе данных
		const tokens = await this.generateTokens(oldToken.user, userAgent);
		const newRefreshToken = await this.generateRefreshToken(tokens.refreshToken, oldToken.user.id, userAgent);

		// Обновляем refreshTokenId в ProviderToken, прежде чем удалять старый рефреш-токен
		await this.updateSessionRefreshTokenId(oldToken.id, newRefreshToken.id);

		// После обновления связанных записей удаляем старый рефреш-токен
		await this.deleteRefreshToken(oldToken.token);

		return tokens;
	}

	/**
	 * Обновляет refreshTokenId для связанного ProviderToken.
	 *
	 * @param {string} oldRefreshTokenId - ID старого рефреш-токена.
	 * @param {string} newRefreshTokenId - ID нового рефреш-токена.
	 */
	/**
	 * Обновляет refreshTokenId для сессии пользователя.
	 *
	 * @param {string} oldRefreshTokenId - ID старого рефреш-токена.
	 * @param {string} newRefreshTokenId - ID нового рефреш-токена.
	 * @returns {Promise<void>}
	 */
	async updateSessionRefreshTokenId(oldRefreshTokenId: string, newRefreshTokenId: string): Promise<void> {
		// Находим сессию, связанную со старым рефреш-токеном.
		const session = await this.prismaService.session.findFirst({
			where: {
				refreshTokenId: oldRefreshTokenId,
			},
		});

		// Если сессия найдена, обновляем refreshTokenId.
		if (session) {
			await this.prismaService.session.update({
				where: {
					id: session.id,
				},
				data: {
					refreshTokenId: newRefreshTokenId,
				},
			});
		}
	}

	/**
	 * Генерирует рефреш-токен в базе данных.
	 *
	 * @param {Token} refreshToken - Новый рефреш-токен.
	 * @param {string} userId - Идентификатор пользователя.
	 * @param {string} userAgent - User agent источника запроса.
	 */
	private async generateRefreshToken(refreshToken: Token, userId: string, userAgent: string) {
		return this.prismaService.token.create({
			data: {
				token: refreshToken.token,
				userId: userId,
				userAgent: userAgent,
				exp: refreshToken.exp,
			},
		});
	}

	/**
	 * Ищет и возвращает объект рефреш-токена из базы данных.
	 *
	 * @param {string} refreshToken - Рефреш-токен, который нужно найти.
	 * @returns {Promise<Token, User>} Объект рефреш-токена и юзера, если токен не найден.
	 */
	private async getRefreshToken(refreshToken: string) {
		return this.prismaService.token.findUnique({
			where: {
				token: refreshToken,
			},
			include: {
				user: true,
			},
		});
	}

	async logout(refreshToken: string, res: Response) {
		if (refreshToken === '') {
			return res.sendStatus(HttpStatus.OK);
		}
		const logoutUser = this.prismaService.token.findFirst({
			where: {
				token: refreshToken,
			},
			include: {
				user: true,
			},
		});

		if (!logoutUser) {
		}
	}

	async clearCookie(res: Response) {
		res.cookie(REFRESH_TOKEN, '', { httpOnly: true, secure: true, expires: new Date() });
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
	 * Handles authentication using a third-party provider (e.g., Yandex).
	 * @param user
	 * @param {string} userAgent - The user agent making the request.
	 * @param session
	 * @returns {Promise<Tokens>} An object containing the access and refresh tokens.
	 */
	async auth(user: User, userAgent: string, session: Partial<Session>): Promise<Tokens> {
		return await this.generateTokens(user, userAgent);
	}


	async authYandexUser(yandexToken: string, userAgent: string) {

		if () {

		}

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

		const await;
		this.createProviderToken(yandexToken, yandexUserId, yandexProvider);


		return await this.auth(user, userAgent);
	}

	private async createProviderToken(providerToken: string, providerUser: string, providerType: Partial<ProviderType>) {

	}

	private async createSession(providerTokenId: number, tokenId: number) {

	}

	private async isRegistered(providerUserId: string, providerType: ProviderType): Promise<boolean> {
		const existingProvider = await this.prismaService.provider.findFirst({
			where: {
				providerUserId: providerUserId,
				providerTypeId: providerType.id,
			},
		});

		return !!existingProvider;
	}

	private async getUser(providerUserId: string, providerType: ProviderType) {
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

	private async checkProviderToken(providerToken: string) {
		try {
			const checkedToken = this.prismaService.providerToken();
		} catch (error) {

		}
	}

	private async addProviderToken() {
	}

	async registerUser(providerToken: string, providerUserId: string, providerType: Partial<ProviderType>) {
		try {
			const registeredUser = await this.userService.createUser();
			await this.addProviderUser(registeredUser, providerUserId, providerType);
			return registeredUser;
		} catch (error) {
			throw new Error(`User registration error: ${error}`);
		}
	}

	private async addProviderUser(user: Partial<User>, providerUserId: string, providerType: Partial<ProviderType>) {
		try {
			return this.prismaService.provider.create({
				data: {
					userId: user.id,
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

	private async getUserIdFromYandex(token: string) {
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
