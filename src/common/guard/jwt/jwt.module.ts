import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { config } from '@my/config';
import { GuardService } from './jwt-auth.guard';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from '../roles.guard';
import { TokenService } from './jwt.service';

@Module({
    imports: [
        JwtModule.registerAsync({
            global: true,
            useFactory: () => ({
                secret: config.JWT_ACCESS_SECRET,
                signOptions: {
                    expiresIn: config.JWT_ACCESS_TIME,
                },
            }),
        }),
    ],
    providers: [
        GuardService,
        TokenService,
        {
            provide: APP_GUARD,
            useClass: GuardService
        },
        {
            provide: APP_GUARD,
            useClass: RolesGuard
        }
    ],
    exports: [JwtModule, TokenService],
})
export class GuardModule { }
