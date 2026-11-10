import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardModule } from '@my/common';
import { Phrase } from 'src/common/core/entitys/phrase.entity';
import { PhraseLike } from 'src/common/core/entitys/phrase-like.entity';
import { PhraseComment } from 'src/common/core/entitys/phrase-comment.entity';
import { PhraseCommentLike } from 'src/common/core/entitys/phrase-comment-like.entity';
import { User } from 'src/common/core/entitys/user.entity';
import { PhrasesService } from './phrases.service';
import { PhrasesController, PhrasesTeacherController } from './phrases.controller';

/**
 * KUN IBORASI (2026-11): o'qituvchi ibora yuklaydi (matn + ixtiyoriy rasm/video),
 * o'quvchi Bosh sahifadagi karuseldan ko'radi, like bosadi va «qay holatda
 * ishlatgansiz?» savoliga izoh yozadi. Coin yo'q, dars balliga kirmaydi.
 */
@Module({
  imports: [
    GuardModule,
    TypeOrmModule.forFeature([Phrase, PhraseLike, PhraseComment, PhraseCommentLike, User]),
  ],
  providers: [PhrasesService],
  controllers: [PhrasesController, PhrasesTeacherController],
  exports: [PhrasesService],
})
export class PhrasesModule {}
