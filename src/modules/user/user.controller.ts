import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { LoginDto } from './dto/create-user.dto';
import { UserService } from './user.service';

@Controller('user')
class UserController {
	constructor(
		private readonly userService: UserService,
	) {}

	@HttpCode(HttpStatus.OK)
	@Post('login')
	async login(@Body() dto: LoginDto) {
		if (dto.username === 'mehriddin_amonboyev' && dto.password === 'admin') {
			return { 
                message: 'Login successful', 
                userId: 2123
            };
		}
		return { 
            status: 401,
            message: 'Invalid credentials' 
        };
	}

	@Post('register')
	async register(@Body() dto: LoginDto) {
		// Register logikasi shu yerda bo'ladi
		// Hozircha faqat misol uchun
		return { message: 'User registered', user: { username: dto.username } };
	}
}

export { UserController };
