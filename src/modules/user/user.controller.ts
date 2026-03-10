import {
	Controller,
	Post, Put,
	Param, Body,
	HttpCode, HttpStatus,
	NotFoundException, UnauthorizedException,
} from '@nestjs/common';
import { LoginDto } from './dto/create-user.dto';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { Public } from 'src/common/decorators/jwt-public.decorator';

@Controller('user')
export class UserController {
	constructor(
		private readonly userService: UserService,
	) { }

	@Public()
	@HttpCode(HttpStatus.OK)
	@Post('login')
	async login(@Body() dto: LoginDto) {
		const user = await this.userService.getmyInfo(dto.username);
		if (!user) {
			throw new NotFoundException('User not found');
		}
		// if (dto.username === user.username && dto.password === user.password) {
			return {
				message: 'Login successful',
				user
			};
		// }
		throw new UnauthorizedException('Invalid credentials');
	}

	@Put(':id')
	async updateMyProfile(@Param('id') id: string, @Body() dto: UpdateUserDto) {
		const update = this.userService.updateMyProfile(id, dto);
		return {
			message: "Malumot yangilandi",
			data: update
		}
	}
}
