import { Cookie, Public, UserAgent } from '@common/decorators';
import { Controller, Get, HttpStatus, Logger, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { YandexGuard } from './guargs/yandex.guard';

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
		if (refreshToken) {
			await this.authService.deleteRefreshToken(refreshToken);
		}

		res.sendStatus(HttpStatus.OK);
	}

	@Get('refresh-tokens')
	async refreshTokens(@Cookie(REFRESH_TOKEN) refreshToken: string, @Res() res: Response, @UserAgent() agent: string) {
		if (refreshToken) {
			const tokens = await this.authService.refreshTokens(refreshToken, agent);
			await this.authService.setRefreshTokenToCookies(tokens, res);
		} else {
			throw new UnauthorizedException();
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

			await this.authService.setRefreshTokenToCookies(tokens, res);

			res.redirect(this.configService.get('FRONTEND_URL'));
		} catch (error) {
			this.logger.error(error);
			return res.sendStatus(HttpStatus.INTERNAL_SERVER_ERROR);
		}
	}
}
