import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { Course, Task, Theme } from '@prisma/client';
import { CreateThemeDto, UpdateThemeDto } from './dto';
import { JwtPayload } from '@auth/interfaces';
import { RoleService } from '@role/role.service';

@Injectable()
export class ThemeService {
	constructor(private prismaService: PrismaService, private roleService: RoleService) {}

	async findAll(userJP: JwtPayload): Promise<Course[]> {
		const isTeacherOrAdmin = await this.roleService.isTeacherOrAdmin(userJP);

		if (isTeacherOrAdmin) {
			// Если пользователь - учитель или админ, возвращаем все курсы
			return this.prismaService.theme.findMany();
		} else {
			// Если пользователь не учитель и не админ, возвращаем только активные курсы
			return this.prismaService.theme.findMany({
				where: { isDisable: false },
			});
		}
	}

	async create(createThemeDto: CreateThemeDto): Promise<Theme> {
		return this.prismaService.theme.create({
			data: createThemeDto,
		});
	}

	async findOne(id: number): Promise<Theme | null> {
		const theme = await this.prismaService.theme.findUnique({
			where: { id },
		});

		if (!theme) {
			throw new NotFoundException(`Theme with ID ${id} not found`);
		}

		return theme;
	}

	async update(id: number, updateThemeDto: UpdateThemeDto): Promise<Theme> {
		try {
			return await this.prismaService.theme.update({
				where: { id },
				data: updateThemeDto,
			});
		} catch (error) {
			throw new NotFoundException(`Could not find theme with ID ${id} to update`);
		}
	}

	async remove(id: number): Promise<Theme> {
		try {
			return await this.prismaService.theme.delete({
				where: { id },
			});
		} catch (error) {
			throw new NotFoundException(`Could not find theme with ID ${id} to delete`);
		}
	}

	async findThemeTasks(themeId: number): Promise<Task[]> {
		const theme = await this.prismaService.theme.findUnique({
			where: { id: themeId },
			include: {
				Task: true,
			},
		});

		if (!theme) {
			throw new NotFoundException(`Theme with ID ${themeId} not found`);
		}

		return theme.Task;
	}
}
