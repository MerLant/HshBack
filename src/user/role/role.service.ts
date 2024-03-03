import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { Role, User } from '@prisma/client';

@Injectable()
export class RoleService {
	constructor(private prisma: PrismaService) {}

	/**
	 * Получает объект роли по ее названию.
	 * @param roleName - Название роли, которую необходимо получить.
	 * @returns {Promise<Role | null>} Объект роли или null, если роль не найдена.
	 */
	async getRoleByName(roleName: string): Promise<Role | null> {
		return this.prisma.role.findUnique({
			where: {
				name: roleName,
			},
		});
	}

	/**
	 * Получает роль пользователя по его объекту.
	 * @param user - Объект пользователя, чью роль необходимо получить.
	 * @returns {Promise<Role | null>} Объект роли пользователя или null, если роль не назначена.
	 */
	async getUserRole(user: User): Promise<Role | null> {
		return this.prisma.role.findUnique({
			where: {
				id: user.roleId,
			},
		});
	}

	/**
	 * Определяет роль пользователя по его идентификатору.
	 *
	 * @param {string} userId - Идентификатор пользователя.
	 * @returns {Promise<Role>} - Роль пользователя.
	 * @throws {NotFoundException} - Выбрасывается, если пользователь не найден.
	 */
	async getUserRoleById(userId: string): Promise<Role> {
		const userWithRole = await this.prisma.user.findUnique({
			where: { id: userId },
			include: { Role: true },
		});

		if (!userWithRole || !userWithRole.Role) {
			throw new NotFoundException(`User with ID ${userId} or user's role not found`);
		}

		return userWithRole.Role;
	}
}
