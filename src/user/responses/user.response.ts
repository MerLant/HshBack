import { User } from '@prisma/client';
import { Exclude } from 'class-transformer';

export class UserResponse implements User {
	id: string;
	nickName: string;
	displayName: string;

	@Exclude()
	createdAt: Date;

	updatedAt: Date;

	// Исправлено название свойства с rolesId на roleId
	roleId: number;

	@Exclude()
	isBlocked: boolean;

	constructor(user: User) {
		Object.assign(this, user);
		this.roleId = user.roleId; // Убедитесь, что это значение корректно назначается из user
	}
}
