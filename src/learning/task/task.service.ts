import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { Task } from '@prisma/client';
import { CreateTaskDto, UpdateTaskDto } from './dto/';
import { RoleService } from '@role/role.service';
import { JwtPayload } from '@auth/interfaces';
import axios from 'axios';

@Injectable()
export class TaskService {
	constructor(private prismaService: PrismaService, private roleService: RoleService) {}

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

	async findOne(id: number, userJP: JwtPayload): Promise<Task | null> {
		const isTeacherOrAdmin = await this.roleService.isTeacherOrAdmin(userJP);
		let task;
		if (isTeacherOrAdmin) {
			task = await this.prismaService.task.findUnique({
				where: { id },
				include: {
					TaskTest: true,
				},
			});
		} else {
			task = await this.prismaService.task.findUnique({
				where: { id },
			});
		}

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

	async executeRequest(code: string, input: string, task: Partial<Task>) {
		const data = {
			language: 'c#',
			version: 'x',
			files: [
				{
					name: 'my_cool_code.cs',
					content: code,
				},
			],
			stdin: input,
			compile_timeout: task.compileTimeout,
			run_timeout: task.runTimeout,
			compile_memory_limit: task.compileMemoryLimit,
			run_memory_limit: task.runMemoryLimit,
		};

		try {
			const response = await axios.post('http://193.233.80.138:2000/api/v2/execute/', data);

			return response.data;
		} catch (error) {
			console.error('Error executing request:', error);
			throw error;
		}
	}

	async executeTestsForTask(userId: string, taskId: number, code: string): Promise<TestResultsSummary> {
		const task = await this.prismaService.task.findUnique({
			where: { id: taskId },
			include: { TaskTest: true },
		});

		if (!task || !task.TaskTest) {
			throw new Error('Task or task tests not found');
		}

		const buildDate = new Date();

		const build = await this.prismaService.build.create({
			data: {
				userId,
				taskId,
				userCode: code,
				buildDate: buildDate,
				lang: 'c#',
			},
		});

		let passedTestsCount = 0;

		for (const test of task.TaskTest) {
			const output = await this.executeRequest(code, test.input, task);
			console.log(output);

			await this.prismaService.solution.create({
				data: {
					buildId: build.id,
					input: test.input,
					output: output.run.output.trim(),
					statusCode: output.run.code,
					isPassed: test.output === output.run.output.trim(),
				},
			});

			if (output.run.code === 0 && test.output === output.run.output.trim()) {
				passedTestsCount++;
			}
		}

		return {
			taskId: taskId,
			passedTests: passedTestsCount,
			totalTests: task.TaskTest.length,
			executionDate: buildDate,
		};
	}

	async getTestResultsByTaskAndUser(userId: string, taskId: number): Promise<TestResultsSummary[]> {
		// Найти все сборки (builds), соответствующие заданному пользователю и задаче
		const builds = await this.prismaService.build.findMany({
			where: {
				userId: userId,
				taskId: taskId,
			},
			include: {
				Solution: true, // Включить связанные решения для доступа к результатам тестов
			},
		});

		// Преобразовать каждую сборку в TestResultsSummary
		return builds.map((build) => {
			const passedTests = build.Solution.filter((solution) => solution.isPassed === true).length;
			const totalTests = build.Solution.length;

			return {
				taskId: taskId,
				passedTests: passedTests,
				totalTests: totalTests,
				executionDate: build.buildDate,
			};
		});
	}
}
