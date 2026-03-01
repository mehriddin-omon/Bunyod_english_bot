import {
	Controller,
	Post, Body, Get,
	HttpCode, HttpStatus,
	NotFoundException,  UnauthorizedException,
	Put,
	Param
} from '@nestjs/common';
import { LoginDto } from './dto/create-user.dto';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('user')
class UserController {
	constructor(
		private readonly userService: UserService,
	) { }

	@HttpCode(HttpStatus.OK)
	@Post('login')
	async login(@Body() dto: LoginDto) {
		const user = await this.userService.getmyInfo(dto.username);
		if (!user) {
			throw new NotFoundException('User not found');
		}
		if (dto.username === user.username && dto.password === user.password) {
			return {
				message: 'Login successful',
				user
			};
		}
		throw new UnauthorizedException('Invalid credentials');
	}

	@Post('register')
	async register(@Body() dto: LoginDto) {
		const user = await this.register(dto);
		if(!user)
			throw new Error('User topilmadi')
		return { 
			message: 'User registered', 
			user: { username: dto.username } };
	}

	@Put(':id')
	async updateMyProfile(@Param('id') id: string, @Body() dto: UpdateUserDto){
		const update = this.userService.updateMyProfile(id, dto);
		return {
			message: "Malumot yangilandi",
			data: update
		}
	}
}

export { UserController };
