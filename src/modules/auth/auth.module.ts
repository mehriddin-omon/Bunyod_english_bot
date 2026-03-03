import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/common/core/entitys/user.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { GuardModule } from '@my/common';

@Module({
  imports: [TypeOrmModule.forFeature([User]), GuardModule],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule { }