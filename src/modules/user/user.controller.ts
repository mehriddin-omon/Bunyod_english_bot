import { Controller, Post, Body } from '@nestjs/common';

@Controller('user')
export class UserController {
	@Post('login')
	async login(@Body() body: { username: string; password: string }) {
		// Login logikasi shu yerda bo'ladi
		// Hozircha faqat misol uchun
		if (body.username === 'admin' && body.password === 'admin') {
			return { 
                message: 'Login successful', 
                userId: 1 
            };
		}
		return { 
            status: 401,
            message: 'Invalid credentials' 
        };
	}

	@Post('register')
	async register(@Body() body: { username: string; password: string }) {
		// Register logikasi shu yerda bo'ladi
		// Hozircha faqat misol uchun
		return { message: 'User registered', user: { username: body.username } };
	}
}
