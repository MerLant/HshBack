/**
 * Основной модуль приложения, который инициализирует и конфигурирует все необходимые модули и сервисы.
 * @module AppModule
 */
import { JwtAuthGuard } from '@auth/guargs/jwt-auth.guard';
import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { CheckModule } from './check/check.module';
import { PrismaService } from '@prisma/prisma.service';
import { ThrottlerModule } from '@nestjs/throttler';
import { Role } from '@user/enum/role';
import { ProviderTypes } from '@auth/enum/provider.types';
import { LearningModule } from './learning/learning.module';

@Module({
	imports: [
		UserModule,
		PrismaModule,
		AuthModule,
		ConfigModule.forRoot({ isGlobal: true }),
		CheckModule,
		ThrottlerModule.forRoot([
			{
				ttl: 60000,
				limit: 100,
			},
		]),
		LearningModule,
	],
	providers: [
		{
			provide: APP_GUARD,
			useClass: JwtAuthGuard,
		},
	],
})
export class AppModule implements OnModuleInit {
	constructor(private readonly prismaService: PrismaService) {}

	/**
	 * Инициализирует модуль, создавая необходимые типы провайдеров и роли при первом запуске.
	 */
	async onModuleInit(): Promise<void> {
		await this.createProviderTypes();
		await this.createRoles();
	}

	/**
	 * Создает типы провайдеров, если они еще не существуют в базе данных.
	 */
	private async createProviderTypes(): Promise<void> {
		const providerTypeKeys = Object.values(ProviderTypes);
		for (const providerTypeName of providerTypeKeys) {
			const providerTypeExists = await this.prismaService.providerType.findUnique({
				where: { name: providerTypeName },
			});

			if (!providerTypeExists) {
				await this.prismaService.providerType.create({
					data: { name: providerTypeName },
				});
			}
		}
	}

	/**
	 * Создает роли в системе, если они еще не существуют.
	 */
	private async createRoles(): Promise<void> {
		const roleKeys = Object.values(Role);
		for (const roleName of roleKeys) {
			const roleExists = await this.prismaService.role.findUnique({
				where: { name: roleName },
			});

			if (!roleExists) {
				await this.prismaService.role.create({
					data: { name: roleName },
				});
			}
		}
	}
}
