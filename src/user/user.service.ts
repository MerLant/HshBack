import { JwtPayload } from '@auth/interfaces';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ForbiddenException, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@prisma/prisma.service';
import { Cache } from 'cache-manager';
import { User } from '@prisma/client';
import { isUUID } from 'class-validator';
import { Role } from '@role/enum';
import { RoleService } from './role/role.service';

@Injectable()
export class UserService {
	/**
	 * Creates an instance of UserService.
	 * @param {PrismaService} prismaService The Prisma service for interacting with the database.
	 * @param {Cache} cacheManager The cache manager for storing user data.
	 * @param {ConfigService} configService The configuration service for accessing application settings.
	 * @param roleService
	 */
	constructor(
		private readonly prismaService: PrismaService,
		@Inject(CACHE_MANAGER) private cacheManager: Cache,
		private readonly configService: ConfigService,
		private roleService: RoleService,
	) {}

	async createUser(userRole: Role = Role.USER) {
		const roleId = await this.roleService.getRoleByName(userRole);
		try {
			return await this.prismaService.user.create({
				data: {
					roleId: roleId.id,
				},
			});
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
			user = await this.prismaService.user.findUnique({
				where: {
					id: identifier,
				},
			});
		} else {
			user = await this.prismaService.user.findUnique({
				where: {
					nickName: identifier,
				},
			});
		}

		// Сохраняем пользователя в кэше, если он найден
		if (user) {
			await this.cacheManager.set(cacheKey, user, 3600);
		}

		return user;
	}

	async getRoleByUserId(id: string) {
		const user = await this.findByIdentifier(id);

		if (!user) {
			throw new HttpException('User not found', HttpStatus.NOT_FOUND);
		}

		const userRole = await this.roleService.getUserRole(user);
		return { name: userRole.name };
	}

	/**
	 * Удаляет пользователя из базы данных.
	 *
	 * @param {string} deletedUser - Идентификатор пользователя, которого нужно удалить.
	 * @param {JwtPayload} user - Данные пользователя, выполняющего запрос.
	 * @returns {Promise<{id: string}>} - Возвращает объект с идентификатором удаленного пользователя.
	 * @throws {ForbiddenException} - Выбрасывает исключение, если пользователь не имеет права на удаление.
	 */
	async delete(deletedUser: string, user: JwtPayload): Promise<{ id: string }> {
		const senderRole = await this.roleService.getUserRoleById(user.id);

		if (user.id !== deletedUser && senderRole.name !== 'ADMIN') {
			throw new ForbiddenException('You do not have permission to delete this user.');
		}

		await Promise.all([this.cacheManager.del(deletedUser)]);

		await this.prismaService.user.delete({ where: { id: deletedUser } });

		return { id: deletedUser };
	}
}
