import { IsInt, Min } from 'class-validator';

export class FindCourseDto {
	@IsInt({ message: 'ID must be an integer' })
	@Min(1, { message: 'ID must be a positive integer' })
	id: number;
}
