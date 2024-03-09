import { JwtPayload } from '@auth/interfaces';
import { CurrentUser } from '@common/decorators';
import {
	Body,
	ClassSerializerInterceptor,
	Controller,
	Delete,
	Get,
	Param,
	ParseUUIDPipe,
	Put,
	UseInterceptors,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { UserResponse } from './responses';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
	constructor(private readonly userService: UserService) {}

	@Get()
	async me(@CurrentUser() userJP: JwtPayload) {
		const user = await this.userService.findByIdentifier(userJP.id);
		console.log(user);
		return new UserResponse(user);
	}

	@Get(':id/role')
	async getRoleByUserId(@Param('id') id: string) {
		return this.userService.getRoleByUserId(id);
	}
	@Get('/role')
	async getRoleCurrentUser(@CurrentUser() userJP: JwtPayload) {
		return this.userService.getRoleByUserId(userJP.id);
	}

	@UseInterceptors(ClassSerializerInterceptor)
	@Get(':id')
	async findOneUser(@Param('id') id: string) {
		const user = await this.userService.findByIdentifier(id);
		return new UserResponse(user);
	}

	@Delete(':id')
	async deleteUser(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
		return this.userService.delete(id, user);
	}

	@UseInterceptors(ClassSerializerInterceptor)
	@Put()
	async updateUser(@Body() body: Partial<User>) {
		const user = await this.userService.update(body);
		return new UserResponse(user);
	}
}
