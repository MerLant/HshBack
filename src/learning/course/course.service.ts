import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { Course, User } from '@prisma/client';
import { Role } from '@role/enum';
import { CreateCourseDto, UpdateCourseDto } from './dto';

@Injectable()
export class CourseService {
	constructor(private prismaService: PrismaService) {}

	async findAll(userId: string): Promise<Course[]> {
		// Получаем пользователя и его роль из базы данных
		const user = await this.prismaService.user.findUnique({
			where: { id: userId },
			include: { Role: true },
		});

		if (!user) {
			throw new NotFoundException(`User with ID ${userId} not found`);
		}

		const isTeacherOrAdmin = [Role.TEACHER.toString(), Role.ADMIN.toString()].includes(user.Role.name);

		if (isTeacherOrAdmin) {
			// Если пользователь - учитель или админ, возвращаем все курсы
			return this.prismaService.course.findMany();
		} else {
			// Если пользователь не учитель и не админ, возвращаем только активные курсы
			return this.prismaService.course.findMany({
				where: { isDisable: false },
			});
		}
	}

	async create(createCourseDto: CreateCourseDto): Promise<Course> {
		return this.prismaService.course.create({
			data: createCourseDto,
		});
	}

	async findOne(id: number): Promise<Course | null> {
		const course = await this.prismaService.course.findUnique({
			where: { id },
		});

		if (!course) {
			throw new NotFoundException(`Course with ID ${id} not found`);
		}

		return course;
	}

	async update(id: number, updateCourseDto: UpdateCourseDto): Promise<Course> {
		try {
			// Предполагаем, что у вас есть метод для получения текущих данных курса
			const existingCourse = await this.prismaService.course.findUnique({ where: { id } });

			if (!existingCourse) {
				throw new NotFoundException(`Course with ID ${id} not found`);
			}

			return await this.prismaService.course.update({
				where: { id },
				data: updateCourseDto,
			});
		} catch (error) {
			throw new NotFoundException(`Could not find course with ID ${id} to update: ${error.message}`);
		}
	}

	async remove(id: number): Promise<Course> {
		try {
			return await this.prismaService.course.delete({
				where: { id },
			});
		} catch (error) {
			throw new NotFoundException(`Could not find course with ID ${id} to delete`);
		}
	}
}
