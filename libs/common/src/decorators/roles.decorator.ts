import { SetMetadata } from '@nestjs/common';
import { Role as AppRoles } from '@user/enum/role';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AppRoles[]) => SetMetadata(ROLES_KEY, roles);
