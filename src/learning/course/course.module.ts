import { Module } from '@nestjs/common';
import { CourseService } from './course.service';
import { CourseController } from './course.controller';
import { RoleModule } from '@user/role/role.module';

@Module({
	providers: [CourseService],
	controllers: [CourseController],
	imports: [RoleModule],
})
export class CourseModule {}
