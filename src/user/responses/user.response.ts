import { User } from '@prisma/client';
import { Exclude } from 'class-transformer';

export class UserResponse implements User {
	id: string;
	nickName: string;
	displayName: string;

	@Exclude()
	createdAt: Date;

	@Exclude()
	updatedAt: Date;

	@Exclude()
	roleId: number;

	@Exclude()
	isBlocked: boolean;

	constructor(user: User) {
		Object.assign(this, user);
	}
}
