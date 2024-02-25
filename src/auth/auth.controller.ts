import { Cookie, Public, UserAgent } from '@common/decorators';
import { HttpService } from '@nestjs/axios';
import { Controller, Get, HttpStatus, Query, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { map, mergeMap } from 'rxjs';
import { AuthService } from './auth.service';
import { Tokens } from './interfaces';
import { handleTimeoutAndErrors } from '@common/helpers';
import { YandexGuard } from './guargs/yandex.guard';
import { Provider } from '@prisma/client';

const REFRESH_TOKEN = 'refreshtoken';

@Public()
@Controller('auth')
export class AuthController {
	constructor(
		private readonly authService: AuthService,
		private readonly configService: ConfigService,
		private readonly httpService: HttpService,
	) {}

	@Get('logout')
	async logout(@Cookie(REFRESH_TOKEN) refreshToken: string, @Res() res: Response) {
		if (!refreshToken) {
			res.sendStatus(HttpStatus.OK);
			return;
		}
		await this.authService.deleteRefreshToken(refreshToken);
		res.cookie(REFRESH_TOKEN, '', { httpOnly: true, secure: true, expires: new Date() });
		res.sendStatus(HttpStatus.OK);
	}

	@Get('refresh-tokens')
	async refreshTokens(@Cookie(REFRESH_TOKEN) refreshToken: string, @Res() res: Response, @UserAgent() agent: string) {
		if (!refreshToken) {
			throw new UnauthorizedException();
		}
		const tokens = await this.authService.refreshTokens(refreshToken, agent);
		if (!tokens) {
			throw new UnauthorizedException();
		}
		this.setRefreshTokenToCookies(tokens, res);
	}

	private setRefreshTokenToCookies(tokens: Tokens, res: Response) {
		if (!tokens) {
			throw new UnauthorizedException();
		}
		res.cookie(REFRESH_TOKEN, tokens.refreshToken.token, {
			httpOnly: true,
			sameSite: 'lax',
			expires: new Date(tokens.refreshToken.exp),
			secure: this.configService.get('NODE_ENV', 'development') === 'production',
			path: '/',
		});
		res.status(HttpStatus.CREATED).json({ accessToken: tokens.accessToken });
	}

	@UseGuards(YandexGuard)
	@Get('yandex')
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	yandexAuth() {}

	@UseGuards(YandexGuard)
	@Get('yandex/callback')
	yandexAuthCallback(@Req() req: Request, @Res() res: Response) {
		const token = req.user['accessToken'];
		console.log(token);
		return res.redirect(`http://localhost:3001/api/auth/success-yandex?token=${token}`);
	}

	@Get('success-yandex')
	// eslint-disable-next-line @typescript-eslint/no-empty-function
	successYandex(@Query('token') token: string, @UserAgent() agent: string, @Res() res: Response) {
		return this.httpService.get(`https://login.yandex.ru/info?format=json&oauth_token=${token}`).pipe(
			mergeMap(({ data: { default_email } }) =>
				this.authService.providerAuth(default_email, agent, Provider.YANDEX),
			),
			map((data) => this.setRefreshTokenToCookies(data, res)),
			handleTimeoutAndErrors(),
		);
	}
}
