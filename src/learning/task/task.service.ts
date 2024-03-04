import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { Task } from '@prisma/client';
import { CreateTaskDto, UpdateTaskDto } from './dto/';

@Injectable()
export class TaskService {
	constructor(private prismaService: PrismaService) {}

	async create(createTaskDto: CreateTaskDto): Promise<Task> {
		const { tests, ...taskData } = createTaskDto;
		return this.prismaService.task.create({
			data: {
				...taskData,
				TaskTest: {
					create: tests,
				},
			},
		});
	}

	async findOne(id: number): Promise<Task | null> {
		const task = await this.prismaService.task.findUnique({
			where: { id },
			include: {
				TaskTest: true,
			},
		});

		if (!task) {
			throw new NotFoundException(`Task with ID ${id} not found`);
		}

		return task;
	}

	async update(id: number, updateTaskDto: UpdateTaskDto): Promise<Task> {
		const { tests, ...taskData } = updateTaskDto;
		const existingTask = await this.prismaService.task.findUnique({ where: { id } });

		if (!existingTask) {
			throw new NotFoundException(`Task with ID ${id} not found`);
		}

		await this.prismaService.taskTest.deleteMany({ where: { taskId: id } });

		return this.prismaService.task.update({
			where: { id },
			data: {
				...taskData,
				TaskTest: {
					create: tests,
				},
			},
		});
	}

	async remove(id: number): Promise<Task> {
		const task = await this.prismaService.task.findUnique({ where: { id } });

		if (!task) {
			throw new NotFoundException(`Task with ID ${id} not found`);
		}

		await this.prismaService.taskTest.deleteMany({ where: { taskId: id } });
		await this.prismaService.task.delete({ where: { id } });

		return task;
	}

	/**
	 * Получает все задачи для указанной темы.
	 * @param {number} themeId - Идентификатор темы.
	 * @returns {Promise<Task[]>} - Массив задач, принадлежащих теме.
	 */
	async findAllByThemeId(themeId: number): Promise<Task[]> {
		const tasks = await this.prismaService.task.findMany({
			where: {
				themeId: themeId,
				isDisable: false, // Получаем только активные задачи.
			},
			include: {
				TaskTest: true, // Включаем связанные тесты для каждой задачи.
			},
		});

		if (!tasks || tasks.length === 0) {
			throw new NotFoundException(`No tasks found for theme ID ${themeId}`);
		}

		return tasks;
	}
}
