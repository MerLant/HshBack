import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
	private logger = new Logger('HTTP');

	use(request: Request, response: Response, next: NextFunction): void {
		const { method, path } = request;
		const userAgent = request.get('user-agent') || '';

		response.on('finish', () => {
			const { statusCode } = response;
			const contentLength = response.get('content-length');

			this.logger.log(`${method} ${path} ${statusCode} ${contentLength} - ${userAgent}`);
		});

		next();
	}
}
