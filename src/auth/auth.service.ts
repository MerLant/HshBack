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
	private readonly logger = new Logger(AuthService.name);

	constructor(
		private readonly userService: UserService,
		private readonly jwtService: JwtService,
		private readonly prismaService: PrismaService,
	) {}

	async refreshTokens(refreshToken: string, agent: string): Promise<Tokens> {
		const token = await this.prismaService.token.delete({ where: { token: refreshToken } });
		if (!token || new Date(token.exp) < new Date()) {
			throw new UnauthorizedException();
		}
		const user = await this.userService.findOne(token.userId);
		return this.generateTokens(user, agent);
	}

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

	private async getRefreshToken(userId: string, agent: string): Promise<Token> {
		const _token = await this.prismaService.token.findFirst({
			where: {
				userId,
				userAgent: agent,
			},
		});
		let token = _token?.token ?? null;
		// if (!token) {
		// 	// Если токен не найден, генерируем новый
		// 	token = v4();
		// }
		return this.prismaService.token.upsert({
			where: {
				id: userId
			},
			create: {
				token: v4(),
				exp: add(new Date(), { months: 1 }),
				userId,
				userAgent: agent,
			},
			update: {
				token: v4(),
				exp: add(new Date(), { months: 1 }),
			},
		});
	}

	deleteRefreshToken(token: string) {
		return this.prismaService.token.delete({ where: { token } });
	}

	async providerAuth(email: string, agent: string, provider: Provider) {
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
			throw new HttpException(
				`Не получилось создать пользователя с email ${email} в Google auth`,
				HttpStatus.BAD_REQUEST,
			);
		}
		return this.generateTokens(user, agent);
	}
}
