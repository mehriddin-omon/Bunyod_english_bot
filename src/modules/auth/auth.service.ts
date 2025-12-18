import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
    constructor(
        
    ){}

	async validateUser(username: string, password: string): Promise<any> {
		// Bu yerda foydalanuvchini tekshirish logikasi bo'ladi
		// Hozircha faqat misol uchun
		if (username === 'admin' && password === 'admin') {
			return { userId: 1, username: 'admin' };
		}
		return null;
	}

    async login(user: any): Promise<any> {

    }
}
export class AuthModule {}