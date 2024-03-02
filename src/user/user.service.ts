import { JwtPayload } from '@auth/interfaces';
import { convertToSecondsUtil } from '@common/utils';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ForbiddenException, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@prisma/prisma.service';
import { Cache } from 'cache-manager';
import { Provider, ProviderType, User } from '@prisma/client';
import { isUUID } from 'class-validator';

@Injectable()
export class UserService {
	/**
	 * Creates an instance of UserService.
	 * @param {PrismaService} prismaService The Prisma service for interacting with the database.
	 * @param {Cache} cacheManager The cache manager for storing user data.
	 * @param {ConfigService} configService The configuration service for accessing application settings.
	 */
	constructor(
		private readonly prismaService: PrismaService,
		@Inject(CACHE_MANAGER) private cacheManager: Cache,
		private readonly configService: ConfigService,
	) {}

	async createUser() {
		try {
			return await this.prismaService.user.create({ data: {} });
		} catch (error) {
			throw new Error(`User creation error: ${error}`);
		}
	}

	/**
	 * Обновляет данные пользователя в базе данных.
	 *
	 * @param {Partial<User>} user - Объект пользователя с обновленными данными.
	 * @returns {Promise<User>} - Возвращает обновленный объект пользователя.
	 * @throws {HttpException} - В случае ошибки при сохранении пользователя генерируется исключение.
	 */
	async update(user: Partial<User>): Promise<User> {
		try {
			// Проверка существования пользователя перед обновлением
			const existingUser = await this.prismaService.user.findUnique({
				where: { id: user.id },
			});

			if (!existingUser) {
				throw new HttpException('User not found', HttpStatus.NOT_FOUND);
			}

			// Обновление пользователя
			const updatedUser = await this.prismaService.user.update({
				where: { id: user.id },
				data: {
					nickName: user.nickName,
					displayName: user.displayName,
					isBlocked: user.isBlocked,
					roleId: user.roleId,
				},
			});

			return updatedUser;
		} catch (error) {
			throw new HttpException('Error updating user: ' + error.message, HttpStatus.BAD_REQUEST);
		}
	}

	async findByIdentifier(identifier: string) {
		const cacheKey = `user:${identifier}`;
		// Проверяем, есть ли пользователь в кэше
		const cachedUser = await this.cacheManager.get(cacheKey);
		if (cachedUser) {
			return cachedUser;
		}

		let user;
		if (isUUID(identifier)) {
			user = await this.prismaService.user.findUnique({ where: { id: identifier } });
		} else {
			user = await this.prismaService.user.findUnique({ where: { nickName: identifier } });
		}

		// Сохраняем пользователя в кэше, если он найден
		if (user) {
			await this.cacheManager.set(cacheKey, user, 3600);
		}

		return user;
	}

	/**
	 * Deletes a user from the database and cache.
	 * @param {string} id The ID of the user to delete.
	 * @param {JwtPayload} user The authenticated user making the request.
	 * @returns {Promise<{id: string}>} The deleted user.
	 * @throws {ForbiddenException} If the user is not authorized to delete the user.
	 */
	async delete(id: string, user: JwtPayload) {
		// if (user.id !== id && !user.roles.includes(Role.ADMIN)) {
		// 	throw new ForbiddenException();
		// }
		// await Promise.all([this.cacheManager.del(id), this.cacheManager.del(user.email.toLowerCase())]);
		// return this.prismaService.user.delete({ where: { id }, select: { id: true } });
	}
}
