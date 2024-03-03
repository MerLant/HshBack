import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { CourseService } from './course.service';
import { CreateCourseDto, UpdateCourseDto } from './dto/';
import { Role } from '@user/enum/role';
import { Roles } from '@common/decorators';
import { RolesGuard } from '@auth/guargs/role.guard';

@Controller('course')
export class CourseController {
	constructor(private readonly courseService: CourseService) {}

	@Get()
	findAll() {
		return this.courseService.findAll();
	}

	@Post()
	@UseGuards(RolesGuard)
	@Roles(Role.TEACHER, Role.ADMIN)
	create(@Body() createCourseDto: CreateCourseDto) {
		return this.courseService.create(createCourseDto);
	}

	@Get(':id')
	findOne(@Param('id') id: string) {
		return this.courseService.findOne(+id);
	}

	@Put(':id')
	@UseGuards(RolesGuard)
	@Roles(Role.TEACHER, Role.ADMIN)
	update(@Param('id') id: string, @Body() updateCourseDto: UpdateCourseDto) {
		return this.courseService.update(+id, updateCourseDto);
	}

	@Delete(':id')
	@UseGuards(RolesGuard)
	@Roles(Role.TEACHER, Role.ADMIN)
	remove(@Param('id') id: string) {
		return this.courseService.remove(+id);
	}
}
