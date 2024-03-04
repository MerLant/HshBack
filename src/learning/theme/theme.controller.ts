// theme.controller.ts
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { ThemeService } from './theme.service';
import { CreateThemeDto, UpdateThemeDto } from './dto';
import { Role } from '@role/enum';
import { CurrentUser, Roles } from '@common/decorators';
import { RolesGuard } from '@auth/guargs/role.guard';
import { JwtPayload } from '@auth/interfaces';

@Controller('learning/theme')
@UseGuards(RolesGuard)
export class ThemeController {
	constructor(private readonly themeService: ThemeService) {}

	@Get()
	findAll(@CurrentUser() user: JwtPayload) {
		return this.themeService.findAll(user);
	}

	@Post()
	@Roles(Role.TEACHER, Role.ADMIN)
	create(@Body() createTheme: CreateThemeDto) {
		return this.themeService.create(createTheme);
	}

	@Get(':id')
	findOne(@Param('id', ParseIntPipe) id: number) {
		return this.themeService.findOne(id);
	}

	@Put(':id')
	@Roles(Role.TEACHER, Role.ADMIN)
	update(@Param('id', ParseIntPipe) id: number, @Body() updateTheme: UpdateThemeDto) {
		return this.themeService.update(id, updateTheme);
	}

	@Delete(':id')
	@Roles(Role.TEACHER, Role.ADMIN)
	remove(@Param('id', ParseIntPipe) id: number) {
		return this.themeService.remove(id);
	}

	@Get(':id/tasks')
	findThemeTasks(@Param('id', ParseIntPipe) id: number) {
		return this.themeService.findThemeTasks(id);
	}
}
