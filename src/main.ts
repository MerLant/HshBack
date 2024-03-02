import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	const configService = app.get(ConfigService);
	app.use(cookieParser());
	app.setGlobalPrefix('api');
	app.useGlobalInterceptors();
	app.useGlobalPipes(new ValidationPipe());
	const frontendUrl = configService.get('FRONTEND_URL') || '*';
	app.enableCors({
		origin: frontendUrl,
		credentials: true,
		allowedHeaders: ['Content-Type', 'Authorization'],
	});

	app.use(helmet());

	// Используем Rate Limit для предотвращения атак типа DDoS/brute-forc

	// Включаем глобально ValidationPipe для валидации входящих данных на всех маршрутах
	app.useGlobalPipes(new ValidationPipe());
	const startPort = configService.get<number>('START_PORT') || 3000;
	await app.listen(startPort);
}

bootstrap();
