import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client'; // Убедитесь, что это соответствует названию модели в Prisma схеме

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
