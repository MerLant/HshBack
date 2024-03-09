import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	ParseIntPipe,
	ParseUUIDPipe,
	Post,
	Put,
	UseGuards,
} from '@nestjs/common';
import { TaskService } from './task.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/';
import { Role } from '@role/enum/role';
import { CurrentUser, Roles } from '@common/decorators';
import { RolesGuard } from '@auth/guargs/role.guard';
import { JwtPayload } from '@auth/interfaces';
import { ExecuteTaskDto } from 'src/learning/task/dto/execute-task.dto';

@Controller('learning/task')
export class TaskController {
	constructor(private readonly taskService: TaskService) {}

	@Post()
	@UseGuards(RolesGuard)
	@Roles(Role.TEACHER, Role.ADMIN)
	create(@Body() createTaskDto: CreateTaskDto) {
		return this.taskService.create(createTaskDto);
	}

	@Get(':id')
	findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() userJP: JwtPayload) {
		return this.taskService.findOne(+id, userJP);
	}

	@Put(':id')
	@UseGuards(RolesGuard)
	@Roles(Role.TEACHER, Role.ADMIN)
	update(@Param('id', ParseIntPipe) id: number, @Body() updateTaskDto: UpdateTaskDto) {
		return this.taskService.update(id, updateTaskDto);
	}

	@Delete(':id')
	@UseGuards(RolesGuard)
	@Roles(Role.TEACHER, Role.ADMIN)
	remove(@Param('id') id: string) {
		return this.taskService.remove(+id);
	}

	/**
	 * Возвращает все задачи для указанной темы.
	 * @param {number} themeId - Идентификатор темы.
	 * @returns Все задачи, связанные с темой.
	 */
	@Get()
	async findAllByThemeId(@Param('themeId', ParseIntPipe) themeId: number) {
		return await this.taskService.findAllByThemeId(themeId);
	}

	@Get(':userId/:taskId')
	async getResultsByUserAndTask(@Param('userId', ParseUUIDPipe) userId: string, @Param('taskId') taskId: string) {
		return this.taskService.getTestResultsByTaskAndUser(userId, +taskId);
	}

	@Post(':id/execute')
	async executeTestsForTask(@Body() executeTask: ExecuteTaskDto, @CurrentUser() userJP: JwtPayload) {
		return this.taskService.executeTestsForTask(userJP.id, executeTask.taskId, executeTask.code);
	}
}
