import { Module } from '@nestjs/common';
import { ThemeService } from './theme.service';
import { ThemeController } from './theme.controller';
import { RoleModule } from '@role/role.module';

@Module({
	providers: [ThemeService],
	controllers: [ThemeController],
	imports: [RoleModule],
})
export class ThemeModule {}
