import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { RoleModule } from '@role/role.module';

@Module({
	providers: [TaskService],
	controllers: [TaskController],
	imports: [RoleModule],
})
export class TaskModule {}
