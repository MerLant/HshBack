import { JwtPayload } from '@auth/interfaces';
import { convertToSecondsUtil } from '@common/utils';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ForbiddenException, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role, User } from '@prisma/client';
import { PrismaService } from '@prisma/prisma.service';
import { Cache } from 'cache-manager';

@Injectable()
export class UserService {
	constructor(
		private readonly prismaService: PrismaService,
		@Inject(CACHE_MANAGER) private cacheManager: Cache,
		private readonly configService: ConfigService,
	) {}

	async save(user: Partial<User>): Promise<User> {
		try {
			const savedUser = await this.prismaService.user.upsert({
				where: {
					email: user.email,
				},
				update: {
					provider: user.provider,
					roles: user.roles,
					isBlocked: user.isBlocked,
				},
				create: {
					email: user.email,
					provider: user.provider,
					roles: ['USER'],
				},
			});
			await this.cacheManager.set(savedUser.id, savedUser);

			return savedUser;
		} catch (error) {
			console.log(error);
			throw new HttpException('Error saving user', HttpStatus.BAD_REQUEST);
		}
	}

	async findOne(idOrEmail: string, isReset = false): Promise<User | null> {
		if (isReset) {
			await this.cacheManager.del(idOrEmail);
		}

		const cachedUser = await this.cacheManager.get<User>(idOrEmail);
		if (cachedUser) {
			return cachedUser;
		}

		const user = await this.prismaService.user.findFirst({
			where: {
				OR: [{ id: idOrEmail }, { email: idOrEmail }],
			},
		});

		if (user) {
			await this.cacheManager.set(idOrEmail, user, convertToSecondsUtil(this.configService.get('JWT_EXP')));
		}

		return user;
	}

	async delete(id: string, user: JwtPayload) {
		if (user.id !== id && !user.roles.includes(Role.ADMIN)) {
			throw new ForbiddenException();
		}
		await Promise.all([this.cacheManager.del(id), this.cacheManager.del(user.email)]);
		return this.prismaService.user.delete({ where: { id }, select: { id: true } });
	}
}
