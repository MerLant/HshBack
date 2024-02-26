import { JwtPayload } from '@auth/interfaces';
import { convertToSecondsUtil } from '@common/utils';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ForbiddenException, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role, User } from '@prisma/client';
import { PrismaService } from '@prisma/prisma.service';
import { Cache } from 'cache-manager';

@Injectable()
export class UserService {
	/**
	 * Creates an instance of UserService.
	 * @param {PrismaService} prismaService The Prisma service for interacting with the database.
	 * @param {Cache} cacheManager The cache manager for storing user data.
	 * @param {ConfigService} configService The configuration service for accessing application settings.
	 */
	constructor(
		private readonly prismaService: PrismaService,
		@Inject(CACHE_MANAGER) private cacheManager: Cache,
		private readonly configService: ConfigService,
	) {}

	/**
	 * Saves a user to the database and cache.
	 * @param {Partial<User>} user The user data to save.
	 * @returns {Promise<User>} The saved user.
	 * @throws {HttpException} If an error occurs while saving the user.
	 */
	async save(user: Partial<User>): Promise<User> {
		try {
			const savedUser = await this.prismaService.user.upsert({
				where: {
					email: user.email.toLowerCase(),
				},
				update: {
					provider: user.provider,
					roles: user.roles,
					isBlocked: user.isBlocked,
				},
				create: {
					email: user.email.toLowerCase(),
					provider: user.provider,
					roles: ['USER'],
				},
			});
			await this.cacheManager.set(savedUser.id.toLowerCase(), savedUser);

			return savedUser;
		} catch (error) {
			throw new HttpException('Error saving user', HttpStatus.BAD_REQUEST);
		}
	}

	/**
	 * Finds a user by ID or email.
	 * @param {string} idOrEmail The ID or email of the user to find.
	 * @param {boolean} [isReset=false] Whether to reset the cache for the user.
	 * @returns {Promise<User | null>} The found user, or null if not found.
	 */
	async findOne(idOrEmail: string, isReset = false): Promise<User | null> {
		if (isReset) {
			await Promise.all([this.cacheManager.del(idOrEmail), this.cacheManager.del(idOrEmail.toLowerCase())]);
		}

		const cachedUser = await this.cacheManager.get<User>(idOrEmail.toLowerCase());
		if (cachedUser) {
			return cachedUser;
		}

		const user = await this.prismaService.user.findFirst({
			where: {
				OR: [{ id: idOrEmail.toLowerCase() }, { email: idOrEmail.toLowerCase() }],
			},
		});

		if (user) {
			await this.cacheManager.set(
				user.id.toLowerCase(),
				user,
				convertToSecondsUtil(this.configService.get('JWT_EXP')),
			);
		}

		return user;
	}

	/**
	 * Deletes a user from the database and cache.
	 * @param {string} id The ID of the user to delete.
	 * @param {JwtPayload} user The authenticated user making the request.
	 * @returns {Promise<User>} The deleted user.
	 * @throws {ForbiddenException} If the user is not authorized to delete the user.
	 */
	async delete(id: string, user: JwtPayload) {
		if (user.id !== id && !user.roles.includes(Role.ADMIN)) {
			throw new ForbiddenException();
		}
		await Promise.all([this.cacheManager.del(id), this.cacheManager.del(user.email.toLowerCase())]);
		return this.prismaService.user.delete({ where: { id }, select: { id: true } });
	}
}
