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

const providersToCreate = ['YANDEX'];

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

	async onModuleInit(): Promise<void> {
		await this.createProviderTypes();
	}

	private async createProviderTypes(): Promise<void> {
		const existingProviderTypes = await this.prismaService.providerType.findMany({
			where: {
				name: {
					in: providersToCreate,
				},
			},
		});

		const namesToCreate = providersToCreate.filter(
			(name) => !existingProviderTypes.some((providerType) => providerType.name === name),
		);

		if (namesToCreate.length === 0) {
			console.log('Все ProvidersType уже существуют');
			return;
		}

		await this.prismaService.providerType.createMany({
			data: namesToCreate.map((name) => ({ name })),
		});

		console.log(`ProvidersType "${namesToCreate.join(', ')}" созданы`);
	}
}
