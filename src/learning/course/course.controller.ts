import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, ParseIntPipe } from '@nestjs/common';
import { CourseService } from './course.service';
import { CreateCourseDto, UpdateCourseDto } from './dto/';
import { Role } from '@role/enum/role';
import { CurrentUser, Roles } from '@common/decorators';
import { RolesGuard } from '@auth/guargs/role.guard';
import { JwtPayload } from '@auth/interfaces';

@Controller('learning/course')
export class CourseController {
	constructor(private readonly courseService: CourseService) {}

	@Get()
	findAll(@CurrentUser() user: JwtPayload) {
		return this.courseService.findAll(user.id);
	}

	@Post()
	@UseGuards(RolesGuard)
	@Roles(Role.TEACHER, Role.ADMIN)
	create(@Body() createCourseDto: CreateCourseDto) {
		return this.courseService.create(createCourseDto);
	}

	@Get(':id')
	findOne(@Param('id', ParseIntPipe) id: number) {
		return this.courseService.findOne(+id);
	}

	@Put(':id')
	@UseGuards(RolesGuard)
	@Roles(Role.TEACHER, Role.ADMIN)
	update(@Param('id', ParseIntPipe) id: number, @Body() updateCourse: UpdateCourseDto) {
		return this.courseService.update(id, updateCourse);
	}

	@Delete(':id')
	@UseGuards(RolesGuard)
	@Roles(Role.TEACHER, Role.ADMIN)
	remove(@Param('id') id: string) {
		return this.courseService.remove(+id);
	}
}
