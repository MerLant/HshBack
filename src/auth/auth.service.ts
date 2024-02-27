import { HttpException, HttpStatus, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Provider, Token, User } from '@prisma/client';
import { PrismaService } from '@prisma/prisma.service';
import { UserService } from '@user/user.service';
import { add } from 'date-fns';
import { v4 } from 'uuid';
import { Tokens } from './interfaces';

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
	 */
	constructor(
		private readonly userService: UserService,
		private readonly jwtService: JwtService,
		private readonly prismaService: PrismaService,
	) {}

	/**
	 * Refreshes access and refresh tokens based on a provided refresh token.
	 * @param {string} refreshToken - The refresh token to use for refreshing.
	 * @param {string} agent - The user agent making the request.
	 * @returns {Promise<Tokens>} An object containing the new access and refresh tokens.
	 * @throws {UnauthorizedException} If the refresh token is invalid or expired.
	 */
	async refreshTokens(refreshToken: string, agent: string): Promise<Tokens> {
		const token = await this.prismaService.token.delete({ where: { token: refreshToken } });
		if (!token || new Date(token.exp) < new Date()) {
			throw new UnauthorizedException();
		}
		const user = await this.userService.findOne(token.userId);
		return this.generateTokens(user, agent);
	}

	/**
	 * Generates access and refresh tokens for a given user.
	 * @private
	 * @param {User} user - The user for whom to generate tokens.
	 * @param {string} agent - The user agent making the request.
	 * @returns {Promise<Tokens>} An object containing the access and refresh tokens.
	 */
	private async generateTokens(user: User, agent: string): Promise<Tokens> {
		const accessToken =
			'Bearer ' +
			this.jwtService.sign({
				id: user.id,
				email: user.email,
				roles: user.roles,
			});
		const refreshToken = await this.getRefreshToken(user.id, agent);
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
	 * @param {string} token - The refresh token to delete.
	 * @returns {Promise<Token>} The deleted token (for logging purposes).
	 */
	deleteRefreshToken(token: string): Promise<Token> {
		return this.prismaService.token.delete({ where: { token } });
	}

	/**
	 * Handles authentication using a third-party provider (e.g., Google).
	 * @param {string} email - The user's email address.
	 * @param {string} agent - The user agent making the request.
	 * @param {Provider} provider - The third-party provider used for authentication.
	 * @returns {Promise<Tokens>} An object containing the access and refresh tokens.
	 * @throws {HttpException} If user creation fails.
	 */
	async providerAuth(email: string, agent: string, provider: Provider): Promise<Tokens> {
		const userExists = await this.userService.findOne(email);
		if (userExists) {
			const user = await this.userService.save({ email, provider }).catch((err) => {
				this.logger.error(err);
				return null;
			});
			return this.generateTokens(user, agent);
		}
		const user = await this.userService.save({ email, provider }).catch((err) => {
			this.logger.error(err);
			return null;
		});
		if (!user) {
			throw new HttpException(`Не получилось создать пользователя с email ${email}`, HttpStatus.BAD_REQUEST);
		}
		return this.generateTokens(user, agent);
	}
}