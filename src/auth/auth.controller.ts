import { Cookie, Public, UserAgent } from '@common/decorators';
import {
	Controller,
	Get,
	HttpException,
	HttpStatus,
	Logger,
	Req,
	Res,
	UnauthorizedException,
	UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { YandexGuard } from './guargs/yandex.guard';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

export const REFRESH_TOKEN = 'refreshToken';

@Public()
@Controller('auth')
export class AuthController {
	/**
	 * @private
	 * @description Instance of the Logger class for logging purposes.
	 */
	private readonly logger = new Logger(AuthService.name);

	constructor(private readonly authService: AuthService, private readonly configService: ConfigService) {}

	@Get('logout')
	async logout(@Cookie(REFRESH_TOKEN) refreshToken: string, @Res() res: Response) {
		await this.authService.logout(refreshToken, res);
	}

	@UseGuards(ThrottlerGuard)
	@Throttle({ default: { limit: 1, ttl: 10 } })
	@Get('refresh-tokens')
	async refreshTokens(@Cookie(REFRESH_TOKEN) refreshToken: string, @Res() res: Response, @UserAgent() agent: string) {
		if (refreshToken) {
			const tokens = await this.authService.refreshTokens(refreshToken, agent);
			await this.authService.setRefreshTokenToCookies(tokens, res);
		} else {
			throw new UnauthorizedException();
		}
	}

	@Get('check-auth')
	async checkAuthToken(@Req() request): Promise<{ accessToken?: string; status: boolean }> {
		const accessToken = request.headers.authorization?.split(' ')[1];
		const refreshToken = request.cookies?.refreshToken;

		if (!accessToken) {
			throw new HttpException('No access token provided', HttpStatus.BAD_REQUEST);
		}

		const result = await this.authService.checkAuth(accessToken, refreshToken);

		if (typeof result === 'string') {
			// Возвращаем новый accessToken
			return { accessToken: result, status: true };
		} else {
			// Возвращаем статус текущего accessToken
			return { status: result };
		}
	}

	@UseGuards(YandexGuard)
	@Get('yandex')
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	yandexAuth() {}

	@UseGuards(YandexGuard)
	@Get('yandex/callback')
	async yandexAuthCallback(@Req() req: Request, @Res() res: Response) {
		try {
			const token = req.user['accessToken'];

			const tokens = await this.authService.authYandexUser(token, req.headers['user-agent']);

			await this.authService.setRefreshTokenToCookies(tokens, res, true);

			res.redirect(this.configService.get('FRONTEND_URL'));
		} catch (error) {
			this.logger.error(error);
			return res.sendStatus(HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}
}
