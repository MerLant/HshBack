import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ROLES_KEY } from '@common/decorators';
import { Reflector } from '@nestjs/core';
import { RoleService } from '@user/role/role.service';
import { JwtPayload } from '@auth/interfaces';

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private reflector: Reflector, private roleService: RoleService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		if (!requiredRoles) {
			return true;
		}

		const request = context.switchToHttp().getRequest();
		const user: JwtPayload = request.user;

		const userRole = await this.roleService.getUserRoleById(user.id);

		return requiredRoles.includes(userRole.name);
	}
}
