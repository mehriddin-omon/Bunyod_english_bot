import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { LessonGatingService } from 'src/common/services/lesson-gating.service';
import { Role } from 'src/common/utils/enum';

/**
 * Dars kontenti va javob yuborish endpointlarining darvozasi (talaba uchun):
 *  1) mehmon faqat birinchi GUEST_LESSON_LIMIT ta darsni oladi;
 *  2) KETMA-KET QULF — oldingi dars tugatilmagan bo'lsa keyingisi yopiq (403 `LESSON_LOCKED`). `:lessonId` parametri bor endpointlarga qo'yiladi
 * (`GuardService` dan KEYIN — req.user kerak). Modulda `LessonGatingModule` import qilinadi.
 */
@Injectable()
export class LessonAccessGuard implements CanActivate {
  constructor(private readonly gating: LessonGatingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId: string | undefined = req.user?.sub;
    const lessonId: string | undefined = req.params?.lessonId;
    // Mehmon faqat student bo'ladi — teacher/admin uchun so'rov ham qilinmaydi
    if (!userId || !lessonId || req.user?.role !== Role.student) return true;
    await this.gating.assertGuestLessonAccess(userId, lessonId);
    await this.gating.assertSequentialAccess(userId, lessonId);
    return true;
  }
}
