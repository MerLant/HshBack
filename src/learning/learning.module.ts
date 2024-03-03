import { Module } from '@nestjs/common';
import { CourseModule } from './course/course.module';
import { ThemeModule } from './theme/theme.module';
import { TaskModule } from './task/task.module';

@Module({
	imports: [CourseModule, ThemeModule, TaskModule],
})
export class LearningModule {}
