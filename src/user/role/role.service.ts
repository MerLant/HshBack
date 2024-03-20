import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { Role, User } from '@prisma/client';
import { JwtPayload } from '@auth/interfaces';
import { Role as RoleEnum } from './enum';

@Injectable()
export class RoleService {
	constructor(private prismaService: PrismaService) {}

	/**
	 * Получает объект роли по ее названию.
	 * @param roleName - Название роли, которую необходимо получить.
	 * @returns {Promise<Role | null>} Объект роли или null, если роль не найдена.
	 */
	async getRoleByName(roleName: string): Promise<Role | null> {
		return this.prismaService.role.findUnique({
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
		return this.prismaService.role.findUnique({
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
		const userWithRole = await this.prismaService.user.findUnique({
			where: { id: userId },
			include: { Role: true },
		});

		if (!userWithRole || !userWithRole.Role) {
			throw new NotFoundException(`User with ID ${userId} or user's role not found`);
		}

		return userWithRole.Role;
	}

	/**
	 * Определяет, имеет ли пользователь роль учителя (TEACHER) или администратора (ADMIN).
	 *
	 * @param {JwtPayload | null} userJP - Объект с данными пользователя, полученный из JWT.
	 * @returns {Promise<boolean>} Возвращает `true`, если пользователь имеет роль TEACHER или ADMIN.
	 * В противном случае возвращает `false`.
	 *
	 * Функция выполняет следующие шаги:
	 * 1. Устанавливает начальное значение роли пользователя как USER.
	 * 2. Если объект `userJP` предоставлен и содержит идентификатор пользователя (`id`),
	 *    функция запрашивает данные пользователя из базы данных, включая связанную роль.
	 * 3. Если пользователь найден и его роль определена, обновляет значение `userRoleName` на имя роли пользователя.
	 * 4. Проверяет, соответствует ли роль пользователя одной из ролей: TEACHER или ADMIN.
	 */
	async isTeacherOrAdmin(userJP: JwtPayload | null): Promise<boolean> {
		let userRoleName: string = RoleEnum.USER.toString();

		if (userJP && userJP.id) {
			const user = await this.prismaService.user.findUnique({
				where: { id: userJP.id },
				include: { Role: true },
			});

			if (user && user.Role) {
				userRoleName = user.Role.name;
			}
		}

		return [RoleEnum.TEACHER.toString(), RoleEnum.ADMIN.toString()].includes(userRoleName);
	}
}
