import { Controller, Post, Get, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RegisterDto,
  RefreshTokenDto,
  UpdateProfileDto,
  DeleteAccountDto,
  DeleteAccountByCredentialsDto,
} from './dto/auth.dto';
import { Public } from 'src/common/decorators/jwt-public.decorator';
import { GuardService } from 'src/common/guard/jwt/jwt-auth.guard';

@Controller('auth')
@UseGuards(GuardService)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  async logout(@Req() req: any) {
    return this.authService.logout(req.user.sub);
  }

  @Get('me')
  async getMe(@Req() req: any) {
    return this.authService.getMe(req.user.sub);
  }

  @Patch('me')
  async updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.sub, dto);
  }

  /** Ilova ichidan: joriy foydalanuvchi parolini tasdiqlab akkauntini o'chiradi */
  @Post('me/delete')
  async deleteMe(@Req() req: any, @Body() dto: DeleteAccountDto) {
    return this.authService.deleteOwnAccount(req.user.sub, dto.password);
  }

  /** Veb-sahifadan (bunyod-english.uz/delete-account): login + parol bilan o'chirish */
  @Public()
  @Post('delete-account')
  async deleteByCredentials(@Body() dto: DeleteAccountByCredentialsDto) {
    return this.authService.deleteAccountByCredentials(dto.username, dto.password);
  }
}
