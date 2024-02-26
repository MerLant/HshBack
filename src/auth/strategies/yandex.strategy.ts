import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-yandex';

/**
 * @classdesc Yandex OAuth2 strategy for Passport.
 * @see https://passportjs.org/packages/passport-yandex/
 */
@Injectable()
export class YandexStrategy extends PassportStrategy(Strategy, 'yandex') {
	/**
	 * @constructor
	 * @param {ConfigService} configService - An instance of the ConfigService for accessing application settings.
	 */
	constructor(private readonly configService: ConfigService) {
		super({
			clientID: configService.get('YANDEX_APP_ID'), // Replace with your APP_ID
			clientSecret: configService.get('YANDEX_APP_SECRET'), // Replace with your APP_SECRET
			callbackURL: configService.get('YANDEX_APP_CALLBACK'), // Replace with your callback URL
		});
	}

	/**
	 * Validates the user profile and returns it.
	 * @param {string} accessToken - The access token provided by Yandex.
	 * @param {string} refreshToken - The refresh token provided by Yandex.
	 * @param {any} profile - The user profile returned by Yandex.
	 * @param {(err: any, user: any, info?: any) => void} done - The callback function to call with the user data.
	 * @returns {Promise<any>} The user data.
	 */
	async validate(
		accessToken: string,
		refreshToken: string,
		profile: { id: any; emails: any },
		done: (err: any, user: any, info?: any) => void,
	): Promise<any> {
		const { id, emails } = profile;
		const user = {
			id,
			email: emails[0].value,
			accessToken,
		};
		done(null, user);
	}
}
