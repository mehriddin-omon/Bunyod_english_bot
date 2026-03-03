import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { Public } from 'src/common/decorators/jwt-public.decorator';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 📝 Register (public)
  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return await this.authService.register(dto);
  }

  // 🔑 Login (public)
  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return await this.authService.login(dto);
  }

  // ♻️ Refresh token (public)
  @Public()
  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    return await this.authService.refresh(refreshToken);
  }

  // 🚪 Logout (protected)
  @UseGuards(GuardService)
  @Post('logout')
  async logout(@Req() req: any) {
    const userId = req.user.sub;
    return await this.authService.logout(userId);
  }
}