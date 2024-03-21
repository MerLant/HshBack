import { HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Provider, ProviderToken, ProviderType, Session, Token, User } from '@prisma/client';
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
	) {}

	/**
	 * @namespace Auth
	 */

	/**
	 * Аутентифицирует пользователя с использованием стороннего провайдера (например, Yandex).
	 * @param user
	 * @param {string} userAgent - User agent источника запроса.
	 * @returns {Promise<Tokens>} Объект, содержащий токены доступа и обновления.
	 */
	async auth(user: User, userAgent: string): Promise<Tokens> {
		return await this.generateTokens(user, userAgent);
	}

	/**
	 * Выполняет выход пользователя, удаляя связанные сессию, токен и providerToken.
	 *
	 * @param {string} refreshToken - Рефреш-токен, который используется для идентификации сессии.
	 * @param {Response} res - Объект ответа Express, используемый для очистки куки.
	 */
	async logout(refreshToken: string, res: Response) {
		try {
			if (!refreshToken) {
				this.logger.error('No refreshToken provided.');
				throw new HttpException('Logout failed: No refresh token provided.', HttpStatus.BAD_REQUEST);
			}

			const token = await this.prismaService.token.findUnique({
				where: {
					token: refreshToken,
				},
			});

			const session = await this.prismaService.session.findFirst({
				where: {
					refreshTokenId: token.id,
				},
			});

			// Если токен не найден, прекращаем выполнение и возвращаем ошибку.
			if (!token) {
				this.logger.error('Token not found.');
				throw new HttpException('Logout failed: Token not found.', HttpStatus.NOT_FOUND);
			}

			// Проверяем наличие связанной сессии
			if (!session) {
				this.logger.error('Session not found for the token.');
				throw new HttpException('Logout failed: Session not found.', HttpStatus.NOT_FOUND);
			}

			await this.deleteRefreshTokenById(token.id);
			await this.clearCookie(res);
			return res.sendStatus(HttpStatus.OK);
		} catch (error) {
			this.logger.error('Error during logout:', error.message);
			throw new HttpException(`Logout failed: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	async checkAuth(accessToken: string, refreshToken?: string): Promise<string | boolean> {
		try {
			// Проверяем accessToken
			this.jwtService.verify(accessToken);
			return true; // accessToken действителен
		} catch (error) {
			// accessToken недействителен
			if (!refreshToken) {
				throw new HttpException('Invalid access token', HttpStatus.UNAUTHORIZED);
			}

			try {
				// Проверяем валидность refreshToken и извлекаем ID пользователя
				const decoded = this.jwtService.verify(refreshToken);
				const userId = decoded.id;

				// Ищем пользователя и его refreshToken в базе данных
				const user = await this.prismaService.user.findUnique({
					where: { id: userId },
					include: {
						Token: true, // Предполагается, что у пользователя есть связь с токенами
					},
				});

				if (!user || !user.Token || !user.Token.some((t) => t.token === refreshToken)) {
					throw new HttpException('Invalid refresh token', HttpStatus.UNAUTHORIZED);
				}

				// Генерируем новый accessToken
				const newAccessToken = this.jwtService.sign({ id: userId });
				return newAccessToken; // Возвращаем новый accessToken
			} catch (refreshError) {
				// refreshToken недействителен
				throw new HttpException('Invalid refresh token', HttpStatus.UNAUTHORIZED);
			}
		}
	}

	/**
	 * @namespace Токены
	 */

	/**
	 * Генерирует токены доступа и обновления для пользователя.
	 * @param {User} user - Пользователь, для которого генерируются токены.
	 * @param {string} userAgent - User agent источника запроса.
	 * @returns {Promise<Tokens>} Объект, содержащий новые токены доступа и обновления.
	 */
	private async generateTokens(user: User, userAgent: string): Promise<Tokens> {
		const accessToken = 'Bearer ' + this.jwtService.sign({ id: user.id });

		const refreshTokenObject: Token = await this.createRefreshToken(user.id, userAgent);

		return {
			accessToken,
			refreshToken: refreshTokenObject,
		};
	}

	/**
	 * Создает новый рефреш-токен в базе данных.
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
	 * @param {string} refreshToken - Рефреш-токен, используемый для обновления.
	 * @param {string} userAgent - User agent источника запроса.
	 * @returns {Promise<Tokens>} Объект, содержащий новые токены доступа и обновления.
	 * @throws {UnauthorizedException} Если рефреш-токен недействителен или истек.
	 */
	// Обновляем существующий рефреш-токен вместо удаления
	async refreshTokens(refreshToken: string, userAgent: string): Promise<Tokens> {
		const user = await this.getUserByRefreshToken(refreshToken);

		if (!user) {
			throw new UnauthorizedException();
		}

		const oldToken = await this.getRefreshToken(refreshToken);

		if (!oldToken || new Date(oldToken.exp) < new Date() || oldToken.userAgent !== userAgent) {
			throw new UnauthorizedException();
		}

		// Генерируем новый токен доступа
		const accessToken = 'Bearer ' + this.jwtService.sign({ id: user.id });

		// Обновляем рефреш-токен в базе данных, а не создаем новый
		const newRefreshTokenData = {
			token: v4(),
			exp: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30), // Например, срок действия 30 дней
			userAgent: userAgent, // Обновляем user agent, если это необходимо
		};

		await this.prismaService.token.update({
			where: { token: refreshToken },
			data: newRefreshTokenData,
		});

		return {
			accessToken,
			refreshToken: { ...oldToken, ...newRefreshTokenData }, // Возвращаем обновленные данные токена
		};
	}

	/**
	 * Ищет и возвращает объект рефреш-токена из базы данных.
	 *
	 * @param {string} refreshToken - Рефреш-токен, который нужно найти.
	 * @returns {Promise<Token | null>} Объект рефреш-токена, если токен найден; иначе null.
	 */
	private async getRefreshToken(refreshToken: string): Promise<Token | null> {
		return this.prismaService.token.findUnique({
			where: {
				token: refreshToken,
			},
		});
	}

	/**
	 * Удаляет рефреш-токен по ID из базы данных.
	 * @param {string} refreshTokenId - Токен, который необходимо удалить.
	 * @returns {Promise<void>} - Промис без возвращаемого значения после выполнения удаления.
	 */
	async deleteRefreshTokenById(refreshTokenId: string): Promise<void> {
		// Поиск токена в базе данных
		const token = await this.prismaService.token.findUnique({ where: { id: refreshTokenId } });

		// Если токен найден, удаляем его
		if (token) {
			await this.prismaService.token.delete({ where: { id: token.id } });
		}
	}

	/**
	 * @namespace Cookie
	 */

	/**
	 * Устанавливает куки с рефреш-токеном и, опционально, отправляет токен доступа в теле ответа.
	 * @param {Tokens} tokens - Объект токенов, содержащий рефреш-токен и токен доступа.
	 * @param {Response} res - Объект ответа Express.
	 * @param {boolean} [noBody=false] - Флаг, определяющий, следует ли включать токен доступа в тело ответа.
	 */
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

	/**
	 * Очищает куки, удаляя рефреш-токен.
	 * @param {Response} res - Объект ответа Express, который будет использоваться для удаления куки.
	 */
	async clearCookie(res: Response) {
		res.cookie(REFRESH_TOKEN, '', {
			httpOnly: true,
			secure: this.configService.get('NODE_ENV', 'development') === 'production',
			expires: new Date(),
		});
	}

	/**
	 * @namespace Сессии
	 */

	/**
	 * Обновляет refreshTokenId для сессии пользователя.
	 * @param {string} oldRefreshTokenId - ID старого рефреш-токена.
	 * @param {string} newRefreshTokenId - ID нового рефреш-токена.
	 */
	async updateSessionRefreshTokenId(oldRefreshTokenId: string, newRefreshTokenId: string) {
		// Находим сессию, связанную со старым рефреш-токеном.
		const session = await this.prismaService.session.findFirst({
			where: {
				refreshTokenId: oldRefreshTokenId,
			},
		});

		// Если сессия найдена, обновляем refreshTokenId.
		if (session) {
			return this.prismaService.session.update({
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
	 * Получает сессию по уникальному идентификатору сессии.
	 *
	 * @param {string} sessionId - Уникальный идентификатор сессии.
	 * @returns {Promise<Session | null>} Объект сессии или null, если сессия не найдена.
	 */
	private async getSessionById(sessionId: string): Promise<Session | null> {
		return this.prismaService.session.findUnique({
			where: {
				id: sessionId,
			},
		});
	}

	/**
	 * Получает сессию по уникальному идентификатору рефреш-токена.
	 *
	 * @param {string} refreshTokenId - Уникальный идентификатор рефреш-токена.
	 * @returns {Promise<Session | null>} Объект сессии или null, если сессия не найдена.
	 */
	private async getSessionByRefreshTokenId(refreshTokenId: string) {
		return this.prismaService.session.findUnique({
			where: {
				refreshTokenId: refreshTokenId,
			},
		});
	}

	/**
	 * Получает сессию по уникальному идентификатору токена провайдера.
	 *
	 * @param {string} providerTokenId - Уникальный идентификатор токена провайдера.
	 * @returns {Promise<Session | null>} Объект сессии или null, если сессия не найдена.
	 */
	private async getSessionByProviderTokenId(providerTokenId: string): Promise<Session | null> {
		return this.prismaService.session.findUnique({
			where: {
				providerTokenId: providerTokenId,
			},
		});
	}

	/**
	 * Создает новую сессию пользователя в базе данных.
	 *
	 * @param {string} providerTokenId - Идентификатор токена провайдера, связанный с создаваемой сессией.
	 * @param {string} refreshTokenId - Идентификатор рефреш-токена, связанный с создаваемой сессией.
	 * @returns {Promise<Session>} - Промис, возвращающий объект созданной сессии.
	 * @throws {HttpException} - Исключение, выбрасываемое в случае ошибки при создании сессии.
	 */
	private async createSession(providerTokenId: string, refreshTokenId: string): Promise<Session> {
		try {
			return await this.prismaService.session.create({
				data: {
					providerTokenId: providerTokenId,
					refreshTokenId: refreshTokenId,
				},
			});
		} catch (error) {
			this.logger.error('Error creating session:', error);
			throw new HttpException('Error creating session', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * Удаляет сессию пользователя по её идентификатору.
	 *
	 * @param {string} sessionId - Идентификатор сессии для удаления.
	 * @returns {Promise<void>} - Промис без возвращаемого значения, который разрешается при успешном удалении сессии.
	 * @throws {HttpException} - Исключение, если сессия не найдена или произошла ошибка при удалении.
	 */
	async deleteSessionById(sessionId: string): Promise<void> {
		try {
			// Проверяем наличие сессии перед удалением.
			const session = await this.prismaService.session.findUnique({
				where: { id: sessionId },
			});

			if (!session) {
				this.logger.error('Session not found:', sessionId);
				throw new HttpException('Session not found', HttpStatus.NOT_FOUND);
			}

			await this.prismaService.session.delete({
				where: { id: sessionId },
			});
		} catch (error) {
			this.logger.error('Error deleting session:', sessionId, error);
			throw new HttpException('Error deleting session', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * @namespace Пользователи
	 */

	/**
	 * Ищет и возвращает пользователя, связанного с рефреш-токеном.
	 * @param {string} refreshToken - Рефреш-токен, по которому нужно найти пользователя.
	 * @returns {Promise<User | null>} Объект пользователя, если он найден; иначе null.
	 */
	private async getUserByRefreshToken(refreshToken: string): Promise<User | null> {
		const token = await this.prismaService.token.findUnique({
			where: {
				token: refreshToken,
			},
			include: {
				user: true,
			},
		});

		return token ? token.user : null;
	}

	/**
	 * Регистрирует нового пользователя и ассоциирует его с конкретным провайдером и типом провайдера.
	 * Эта функция сначала создаёт пользователя через сервис UserService, а затем связывает его с провайдером.
	 *
	 * @param {string} providerToken - Токен, идентифицирующий пользователя у провайдера.
	 * @param {string} providerUserId - Уникальный идентификатор пользователя у провайдера.
	 * @param {Partial<ProviderType>} providerType - Частичный объект типа провайдера, содержащий как минимум идентификатор типа.
	 * @returns {Promise<User>} - Возвращает объект зарегистрированного пользователя.
	 * @throws {Error} - Выбрасывает ошибку, если процесс регистрации пользователя не удался.
	 */
	async registerUser(
		providerToken: string,
		providerUserId: string,
		providerType: Partial<ProviderType>,
	): Promise<User> {
		try {
			const registeredUser = await this.userService.createUser();
			await this.addProviderUser(registeredUser, providerUserId, providerType);
			return registeredUser;
		} catch (error) {
			throw new Error(`User registration error: ${error}`);
		}
	}

	/**
	 * Получает пользователя по идентификатору провайдера и типу провайдера.
	 * @param {string} providerUserId - Идентификатор пользователя у провайдера.
	 * @param {ProviderType} providerType - Тип провайдера.
	 * @returns {Promise<User>} - Объект пользователя.
	 * @throws {HttpException} - Исключение, если не удалось получить пользователя.
	 */
	private async getUser(providerUserId: string, providerType: ProviderType): Promise<User> {
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

	/**
	 * Проверяет, зарегистрирован ли пользователь с данным идентификатором у провайдера.
	 * @param {string} providerUserId - Идентификатор пользователя у провайдера.
	 * @param {ProviderType} providerType - Тип провайдера.
	 * @returns {Promise<boolean>} - Возвращает true, если пользователь зарегистрирован.
	 */
	private async isRegistered(providerUserId: string, providerType: ProviderType): Promise<boolean> {
		const existingProvider = await this.prismaService.provider.findFirst({
			where: {
				providerUserId: providerUserId,
				providerTypeId: providerType.id,
			},
		});

		return !!existingProvider;
	}

	/**
	 * @namespace Yandex Аутентификация
	 */

	/**
	 * Аутентифицирует пользователя через Yandex.
	 * @param {string} yandexToken - Токен Yandex.
	 * @param {string} userAgent - User agent источника запроса.
	 * @returns {Promise<Tokens>} Объект, содержащий токены доступа и обновления.
	 */
	async authYandexUser(yandexToken: string, userAgent: string): Promise<Tokens> {
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

		const provider: Provider | null = await this.getProvider(user, yandexProvider);
		if (!provider) {
			this.logger.error('The provider is null, where it cannot be');
			throw new HttpException('The provider is null, where it cannot be', HttpStatus.INTERNAL_SERVER_ERROR);
		}

		let providerToken: ProviderToken | null = await this.checkProviderToken(yandexToken);
		if (!providerToken) {
			providerToken = await this.createProviderToken(yandexToken, provider, yandexProvider);
		}

		const { refreshToken, accessToken } = await this.auth(user, userAgent);

		if (!(await this.getSessionByProviderTokenId(providerToken.id))) {
			await this.createSession(providerToken.id, refreshToken.id);
		}

		// Возвращаем токены
		return { accessToken, refreshToken };
	}

	/**
	 * Получает идентификатор пользователя от Яндекса.
	 * @param {string} token - OAuth-токен для доступа к данным Яндекса.
	 * @returns {Promise<string>} - Идентификатор пользователя Яндекса.
	 * @throws {HttpException} - Исключение, если не удалось получить данные.
	 */
	private async getUserIdFromYandex(token: string): Promise<string> {
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

	/**
	 * @namespace Provider
	 */

	/**
	 * Ищет и возвращает первую найденную запись провайдера на основе идентификатора пользователя и типа провайдера.
	 * @param {Partial<User>} user - Объект пользователя, содержащий по крайней мере идентификатор пользователя.
	 * @param {Partial<ProviderType>} providerType - Объект типа провайдера, содержащий по крайней мере идентификатор типа провайдера.
	 * @returns {Promise<Provider | null>} - Возвращает объект провайдера, если таковой найден, иначе null.
	 * @throws {HttpException} - Исключение выбрасывается, если возникает ошибка при поиске провайдера.
	 */
	private async getProvider(user: Partial<User>, providerType: Partial<ProviderType>): Promise<Provider | null> {
		try {
			return this.prismaService.provider.findFirst({
				where: {
					userId: user.id,
					providerTypeId: providerType.id,
				},
			});
		} catch (error) {
			this.logger.error('User provider get error:', error);
			throw new HttpException('User provider get error:', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	/**
	 * Создает токен провайдера.
	 * @param {string} providerToken - Токен провайдера.
	 * @param {Partial<Provider>} provider - Объект провайдера.
	 * @param {Partial<ProviderType>} providerType - Тип провайдера.
	 * @returns {Promise<ProviderToken>} - Созданный токен провайдера.
	 * @throws {Error} - Ошибка, если не удалось создать токен провайдера.
	 */
	private async createProviderToken(
		providerToken: string,
		provider: Partial<Provider>,
		providerType: Partial<ProviderType>,
	): Promise<ProviderToken> {
		try {
			return this.prismaService.providerToken.create({
				data: {
					providerToken: providerToken,
					providerId: provider.id,
					providerTypeId: providerType.id,
				},
			});
		} catch (error) {
			throw new Error(`User created check error: ${error}`);
		}
	}

	/**
	 * Проверяет наличие токена провайдера в базе данных.
	 * @param {string} providerToken - Токен провайдера для проверки.
	 * @returns {Promise<ProviderToken | null>} - Возвращает объект токена провайдера, если он найден, или null, если такого токена нет.
	 * @throws {HttpException} - Исключение, если произошла ошибка при получении токена из базы данных.
	 */
	private async checkProviderToken(providerToken: string): Promise<ProviderToken | null> {
		try {
			return this.prismaService.providerToken.findFirst({
				where: {
					providerToken: providerToken,
				},
			});
		} catch (error) {
			this.logger.error('Token receipt error:', error);
			throw new HttpException('Token receipt error', HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	private async addProviderToken() {}

	/**
	 * Добавляет запись провайдера пользователю.
	 * @param {Partial<User>} user - Пользователь, которому нужно добавить провайдера.
	 * @param {string} providerUserId - Идентификатор пользователя у провайдера.
	 * @param {Partial<ProviderType>} providerType - Тип провайдера.
	 * @returns {Promise<Provider>} - Объект провайдера.
	 * @throws {HttpException} - Исключение, если не удалось добавить провайдера.
	 */
	private async addProviderUser(
		user: Partial<User>,
		providerUserId: string,
		providerType: Partial<ProviderType>,
	): Promise<Provider> {
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
}
