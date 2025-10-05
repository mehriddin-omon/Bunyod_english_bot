import { Ctx, Hears, Update } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { LessonService } from './lesson.service';
import type { BotContext } from 'src/common/utils/bot.context';
import { ResourceType } from 'src/common/utils/enum';
import { assertSession, initSession } from 'src/common/utils/session.utils';
import { SAVED_TELEGRAM_CHANNEL_ID } from 'src/common/utils/const';
import { UserService } from '../user/user.service';
import { BotService } from '../bot/bot.service';

@Update()
export class LessonViewCommand {
    constructor(
        private readonly botService: BotService,
        private readonly lessonService: LessonService,
        private readonly userService: UserService,
    ) { }

    @Hears("📚 Darslar ro'yxati")
    async showTeacherLessons(@Ctx() ctx: BotContext) {
        const lessons = await this.lessonService.getAllLessons(ctx.from?.id!);
        if (!lessons.length) {
            await ctx.reply("📚 Hali darslar mavjud emas.");
            return;
        }

        const keyboard = lessons.map((lesson, index) => [`✏️ ${lesson.lesson_name}`]);
        keyboard.push(["⬅️ Asosiy menyu"]);

        ctx.session ??= {
            data: {},
            awaiting: null,
            currentLessonId: null,
            prevPage: 'mainMenu',
            lessons: [],
        };

        ctx.session.lessons = lessons;
        await ctx.reply("📚 Darslar ro'yxati (teacher uchun):", Markup.keyboard(keyboard).resize());
    }

    @Hears(/^✏️ (.+)$/)
    async editLesson(@Ctx() ctx: BotContext) {
        const lessonName = ctx.match?.[1];
        let lessons = ctx.session?.lessons;
        // Sessionni kafolatlash
        ctx.session ??= {
            data: {},
            awaiting: null,
            currentLessonId: null,
            prevPage: 'mainMenu',
            lessons: [],
        };
        // Agar sessionda yo‘q bo‘lsa, bazadan olib kelish
        if (!lessons || !lessons.length) {
            lessons = await this.lessonService.getAllLessons(ctx.from?.id!);
            ctx.session.lessons = lessons;
        }

        if (!lessonName) {
            await ctx.reply("❌ Dars nomi noto‘g‘ri.");
            return;
        }
        const selected = lessons.find(l => l.lesson_name.trim() === lessonName.trim());
        if (!selected) {
            await ctx.reply("❌ Dars topilmadi.");
            return;
        }

        ctx.session.currentLessonId = selected.id;

        await ctx.reply(`✏️ Dars tanlandi: ${selected.lesson_name}`, Markup.keyboard([
            ["📌 Nomini o‘zgartirish"],
            ["🎧 Listening qo‘shish", "📖 Reading qo‘shish"],
            ["📚 Vocabulary qo‘shish", "❓️ Test qo‘shish"],
            ["🔄 Update status"],
            ["✅ Saqlash", "⬅️ Asosiy menyu"]
        ]).resize());
    }

    // Student menu
    @Hears("📚 Darslar")
    async showLessons(@Ctx() ctx: BotContext) {
        const lessons = await this.lessonService.getAllLessons(ctx.from?.id!);
        if (!lessons.length) {
            await ctx.reply("📚 Hali darslar mavjud emas.");
            return;
        }

        // Keyboardni har 2ta darsdan iborat qilib tuzish
        const keyboard: string[][] = [];
        for (let i = 0; i < lessons.length; i += 2) {
            const row: string[] = [];
            row.push(`📗 Lesson ${i + 1}`);
            if (lessons[i + 1]) row.push(`📗 Lesson ${i + 2}`);
            keyboard.push(row);
        }

        ctx.session ??= {
            data: {},
            awaiting: null,
            currentLessonId: null,
            prevPage: 'lessons',
            lessons: [],
        };

        ctx.session.lessons = lessons;
        keyboard.push(["⬅️ Asosiy menyu"]);
        await ctx.reply("📚 Mavjud darslar:", Markup.keyboard(keyboard).resize());
    }

    @Hears(/^📗 Lesson (\d+)$/)
    async selectLesson(@Ctx() ctx: BotContext) {

        const unitNumber = parseInt(ctx.match?.[1] ?? '', 10);
        if (isNaN(unitNumber)) {
            await ctx.reply("❌ Lesson raqami noto‘g‘ri.");
            return;
        }

        initSession(ctx);
        assertSession(ctx);
        ctx.session.prevPage = 'lessonDetail';
        const lessons = ctx.session?.lessons ?? await this.lessonService.getAllLessons(ctx.from?.id!);
        const baseLesson = lessons[unitNumber - 1];

        if (!baseLesson) {
            await ctx.reply("❌ Dars topilmadi.");
            return;
        }

        const lesson = await this.lessonService.getLessonWithRelations(baseLesson.id);
        if (!lesson) {
            await ctx.reply("❌ Dars topilmadi.");
            return;
        }

        ctx.session.currentLessonId = lesson.id;

        let message = `📖 ${lesson.lesson_name}\n\n`;
        const keyboard: string[][] = [];

        const sections = [
            { label: "🎧 Listening", data: lesson.listening },
            { label: "📖 Reading", data: lesson.reading },
            { label: "📝 Test", data: lesson.test },
            { label: "📚 Vocabulary", data: lesson.vocabulary },
        ];

        const availableSections = sections.filter(section => section.data?.length);

        if (availableSections.length) {
            message += "📎 Materiallar:\n";
            for (const section of availableSections) {
                message += `${section.label} (${section.data.length} ta)\n`;
            }
            // Keyboardni har 2ta elementdan iborat qilib tuzish
            for (let i = 0; i < availableSections.length; i += 2) {
                const row: string[] = [];
                row.push(availableSections[i].label);
                if (availableSections[i + 1]) row.push(availableSections[i + 1].label);
                keyboard.push(row);
            }
        } else {
            message += "❌ Bu darsda materiallar mavjud emas.";
        }

        keyboard.push(["🔙 Orqaga"]);

        await ctx.reply(message, Markup.keyboard(keyboard).resize());
    }

    @Hears(/^🎧 Listening$|^📖 Reading$|^📝 Test$|^📚 Vocablary$/)
    async sendLessonResource(@Ctx() ctx: BotContext) {
        initSession(ctx);
        const lessonId = ctx.session?.currentLessonId;
        if (!lessonId) {
            await ctx.reply("❌ Dars tanlanmagan.");
            return;
        }

        const typeText =
            ctx.message && 'text' in ctx.message && typeof ctx.message.text === 'string'
                ? ctx.message.text.trim()
                : '';

        const sectionMap = {
            "🎧 Listening": "listening",
            "📖 Reading": "reading",
            "📝 Test": "test",
            "📚 Vocabulary": "word_list",
        } as const;

        const relationKey = sectionMap[typeText as keyof typeof sectionMap];
        if (!relationKey) await ctx.reply("❌ Noto‘g‘ri material turi.");

        const lesson = await this.lessonService.getLessonWithRelations(lessonId);
        const resources = lesson?.[relationKey];

        if (!resources || !Array.isArray(resources) || resources.length === 0) {
            await ctx.reply(`❌ ${typeText} materiali mavjud emas.`);
            return;
        }

        for (const item of resources) {
            if (typeof item.message_id === 'string') {
                try {
                    await ctx.telegram.copyMessage(
                        ctx.chat!.id,
                        SAVED_TELEGRAM_CHANNEL_ID,
                        parseInt(item.message_id, 10)
                    );
                } catch (error) {
                    console.error(`❌ Fayl yuborishda xatolik (${item.id}):`, error);
                }
            } else {
                console.warn(`⚠️ Fayl channelga saqlanmagan (${item.id})`);
            }
        }
    }

    @Hears("🔙 Orqaga")
    async backUniversal(@Ctx() ctx: BotContext) {
        const prevPage = ctx.session?.prevPage;

        switch (prevPage) {
            case 'lessonDetail':
                return this.showLessons(ctx);
            case 'lessons':
                return this.backToMain(ctx);
            case 'mainMenu':
            default:
                return this.backToMain(ctx);
        }
    }

    @Hears("⬅️ Asosiy menyu")
    async backToMain(@Ctx() ctx: BotContext) {
        const userId = ctx.from?.id;
        if (!userId) return;
        const role = await this.userService.getRole(userId);
        if (role === 'admin' || role === 'teacher') {
            return this.botService.showTeacherMenu(ctx, "🏠 Asosiy menyu: Amallarni tanlang 👇");
        }
        return this.botService.showStudentMenu(ctx);
    }

    private getResourceEmoji(type: ResourceType): string {
        switch (type) {
            case ResourceType.AUDIO: return "🎧";
            case ResourceType.PDF: return "📄";
            case ResourceType.DOCUMENT: return "📋";
            default: return "📎";
        }
    }

    private getResourceTypeFromText(text: string): ResourceType | null {
        const normalized = text.toUpperCase().trim();
        if (normalized.includes("AUDIO")) return ResourceType.AUDIO;
        if (normalized.includes("PDF")) return ResourceType.PDF;
        if (normalized.includes("DOCUMENT")) return ResourceType.DOCUMENT;
        return null;
    }
}