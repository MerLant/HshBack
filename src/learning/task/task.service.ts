import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { Task } from '@prisma/client';
import { CreateTaskDto, UpdateTaskDto } from './dto/';
import { RoleService } from '@role/role.service';
import { JwtPayload } from '@auth/interfaces';
import { ExecutionResponse, TestResultsSummary } from './model/pison';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TaskService {
	private readonly logger = new Logger(TaskService.name);
	constructor(
		private prismaService: PrismaService,
		private roleService: RoleService,
		private readonly configService: ConfigService,
	) {}

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
		const existingTask = await this.prismaService.task.findUnique({
			where: { id },
			include: { TaskTest: true },
		});

		if (!existingTask) {
			throw new NotFoundException(`Task with ID ${id} not found`);
		}

		return this.prismaService.$transaction(async (prisma) => {
			const updatedTask = await prisma.task.update({
				where: { id },
				data: { ...taskData },
			});

			if (tests) {
				const existingTestIds = existingTask.TaskTest.map((test) => test.id);
				const incomingTestIds = tests.filter((test) => test.id).map((test) => test.id);

				// Удаление тестов, которых нет в входящих данных
				const testsToDelete = existingTestIds.filter((id) => !incomingTestIds.includes(id));
				await prisma.taskTest.deleteMany({ where: { id: { in: testsToDelete } } });

				// Обновление и создание тестов
				for (const test of tests) {
					if (test.id) {
						// Обновление существующего теста
						await prisma.taskTest.update({
							where: { id: test.id },
							data: { input: test.input, output: test.output },
						});
					} else {
						// Создание нового теста
						await prisma.taskTest.create({
							data: { taskId: id, input: test.input, output: test.output },
						});
					}
				}
			} else {
				// Если тесты не предоставлены, удаляем все связанные тесты
				await prisma.taskTest.deleteMany({ where: { taskId: id } });
			}

			return updatedTask;
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

	async executeRequest(code: string, input: string, task: Partial<Task>): Promise<ExecutionResponse> {
		const data = {
			language: 'c#',
			version: 'x',
			files: [
				{
					name: 'code.cs',
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
			const response = await axios.post<ExecutionResponse>(
				`${this.configService.get('PISOTN_IP')}/api/v2/execute/`,
				data,
			);

			return response.data;
		} catch (error) {
			this.logger.error('Error executing request:', error);
			throw new Error('Failed to execute code');
		}
	}

	async executeTestsForTask(userId: string, taskId: number, code: string): Promise<TestResultsSummary> {
		if (code === '') {
			throw new BadRequestException("Code can't be empty");
		}

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

		// Асинхронное выполнение всех тестов
		const testPromises = task.TaskTest.map(async (test) => {
			try {
				const output = await this.executeRequest(code, test.input, task);
				const isPassed = output.run.code === 0 && test.output === output.run.output.trim();

				await this.prismaService.solution.create({
					data: {
						buildId: build.id,
						input: test.input,
						output: output.run.output.trim(),
						statusCode: output.run.code,
						isPassed,
					},
				});

				return isPassed;
			} catch (error) {
				this.logger.error(`Error executing test input "${test.input}":`, error);
				// Решите, как обрабатывать ошибки: считать тест не пройденным или пробросить ошибку
				return false;
			}
		});

		const results = await Promise.all(testPromises);

		// Подсчет успешно пройденных тестов
		const passedTestsCount = results.filter((result) => result).length;

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
