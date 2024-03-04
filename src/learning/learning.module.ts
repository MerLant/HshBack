import { Module } from '@nestjs/common';
import { CourseModule } from './course/course.module';
import { ThemeModule } from './theme/theme.module';
import { TaskModule } from './task/task.module';
import { LearningController } from './learning.controller';

@Module({
	imports: [CourseModule, ThemeModule, TaskModule],
	controllers: [LearningController],
})
export class LearningModule {}
