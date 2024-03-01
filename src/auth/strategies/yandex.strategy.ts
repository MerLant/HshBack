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
}
