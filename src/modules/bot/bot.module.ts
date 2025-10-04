import { forwardRef, Module, Param } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BotService } from './bot.service';
import { BotUpdate } from './bot.update';
import { ChannelGuard } from 'src/common/guard/channel.guard';

import { LessonModule } from 'src/modules/lesson/lesson.module';
import { UserModule } from 'src/modules/user/user.module';
import { User } from 'src/common/core/entitys/user.entity';
import { Lesson } from 'src/common/core/entitys/lesson.entity';
import { LessonCreateCommand } from '../lesson/lesson-create.command';
import { LessonViewCommand } from '../lesson/lesson-view.command';
import { WordlistModule } from '../wordlist/wordlist.module';
import { UserService } from '../user/user.service';
import { TestsModule } from '../tests/tests.module';
import { StatsCommand } from '../stats/stats.command';
import { HelpCommand } from '../help/help.command';
import { ParamsCommand } from '../params/params.command';

@Module({
    imports: [
        forwardRef(() => LessonModule),
        UserModule,
        WordlistModule,
        // TestsModule,
        TypeOrmModule.forFeature([User, Lesson]),
    ],
    providers: [
        BotUpdate,
        StatsCommand,
        HelpCommand,
        ParamsCommand,
        BotService,
        LessonViewCommand,
        LessonCreateCommand,
        ChannelGuard,
        UserService,
    ],
    exports: [
        BotService,
        BotUpdate
    ]
})
export class BotModule { }