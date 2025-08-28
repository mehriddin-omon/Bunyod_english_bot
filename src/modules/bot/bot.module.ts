import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BotService } from './bot.service';
import { BotUpdate } from './bot.update';
import { ChannelGuard } from 'src/common/guard/channel.guard';

import { LessonModule } from 'src/modules/lesson/lesson.module';
import { UserModule } from 'src/modules/user/user.module';

import { User } from 'src/modules/entitys/user.entity';
import { Lesson } from 'src/modules/entitys/lesson.entity';
import { LessonCreateCommand } from '../lesson/lesson-create.command';
import { LessonService } from '../lesson/lesson.service';
import { UserService } from '../user/user.service';
// import { TelegrafModule } from 'nestjs-telegraf';

@Module({
    imports: [
        forwardRef(() => LessonModule),
        UserModule,
        // TelegrafModule.forRoot({ token: '8435780765:AAFk72cVVINvrEH1-MRRexNdEkyKttjB1uw' }),
        TypeOrmModule.forFeature([User, Lesson]),
    ],
    providers: [
        BotUpdate,
        BotService,
        ChannelGuard,
        // LessonCreateCommand,
        // LessonService,
        // UserService,
    ],
    exports:[
        BotService
    ]
})
export class BotModule { }