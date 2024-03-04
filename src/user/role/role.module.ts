// role.module.ts или любой другой модуль, где определен RoleService

import { Module } from '@nestjs/common';
import { RoleService } from './role.service';
import { Role } from './enum';

@Module({
	providers: [RoleService],
	exports: [RoleService],
})
export class RoleModule {}
