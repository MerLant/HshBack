import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	const configService = app.get(ConfigService);
	app.use(cookieParser());
	app.setGlobalPrefix('api');
	app.useGlobalInterceptors();
	app.useGlobalPipes(new ValidationPipe());
	app.enableCors({
		origin: '*',
		credentials: true,
	});
	const startPort = configService.get<number>('START_PORT') || 3000;
	await app.listen(startPort);
}
bootstrap();
