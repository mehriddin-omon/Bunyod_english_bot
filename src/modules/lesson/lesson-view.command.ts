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

    @Hears("📚 Lessons list")
    async showTeacherLessons(@Ctx() ctx: BotContext) {
        const lessons = await this.lessonService.getAllLessons(ctx.from?.id!);
        if (!lessons.length) {
            await ctx.reply("📚 Sorry Lessons Not found.");
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
        await ctx.reply("📚 Lessonlar ro'yxati (teacher uchun):", Markup.keyboard(keyboard).resize());
    }

    @Hears(/^✏️ (.+)$/)
    async editLesson(@Ctx() ctx: BotContext) {
        const lessonName = ctx.match?.[1];
        let lessons = ctx.session?.lessons;
        ctx.session ??= {
            data: {},
            awaiting: null,
            currentLessonId: null,
            prevPage: 'mainMenu',
            lessons: [],
        };
        if (!lessons || !lessons.length) {
            lessons = await this.lessonService.getAllLessons(ctx.from?.id!);
            ctx.session.lessons = lessons;
        }
        if (!lessonName) {
            await ctx.reply("❌ Lesson name noto‘g‘ri.");
            return;
        }
        const selected = lessons.find(l => l.lesson_name.trim() === lessonName.trim());
        if (!selected) {
            await ctx.reply("❌ Lesson not found.");
            return;
        }
        ctx.session.currentLessonId = selected.id;

        const lessonFull = await this.lessonService.getLessonWithRelations(selected.id);
        if (!lessonFull) {
            await ctx.reply("❌ Lesson not found.");
            return;
        }
        ctx.session.data = ctx.session.data || {};
        ctx.session.data.lesson_name = {
            type: 'text',
            content: selected.lesson_name,
        };

        // Har bir bo‘lim uchun sonini chiqaramiz
        let message = `✏️ Lesson tanlandi: ${selected.lesson_name}\n\n`;
        message += `🎧 Listening: ${lessonFull.listening?.length || 0} ta\n`;
        message += `📖 Reading: ${lessonFull.reading?.length || 0} ta\n`;
        message += `📚 Vocabulary: ${lessonFull.vocabulary?.length || 0} ta\n`;
        message += `❓️ Test: ${lessonFull.test?.length || 0} ta\n`;

        await ctx.reply(message, Markup.keyboard([
            ["📌 Update lesson name", "🔄 Update status"],
            ["🎧 Listening list", "🎧 Listening create"],
            ["📖 Reading list", "📖 Reading create"],
            ["📚 Vocabulary list", "📚 Vocabulary create"],
            ["❓️ Test list", "❓️ Test create"],
            ["✅ Saqlash", "⬅️ Asosiy menyu"]
        ]).resize());
    }

    @Hears("📌 Update lesson name")
    async updateLessonName(@Ctx() ctx: BotContext) {
        assertSession(ctx);
        ctx.session.awaiting = 'lesson_name'; // faqat 'lesson_name' bo‘lishi kerak
        await ctx.reply("✏️ Yangi Lesson nomini kiriting:");
    }

    @Hears(/^[\w\s\-.,]{2,}$/)
    async saveUpdatedLessonName(@Ctx() ctx: BotContext) {
        assertSession(ctx);
        if (ctx.session.awaiting !== 'lesson_name') return;

        // ctx.message va ctx.message.text mavjudligini tekshiramiz
        const newName = ctx.message && 'text' in ctx.message && typeof ctx.message.text === 'string'
            ? ctx.message.text.trim()
            : null;
        if (!newName) {
            await ctx.reply("❌ Yangi nom aniqlanmadi.");
            return;
        }

        ctx.session.data.lesson_name = {
            type: 'text',
            content: newName,
        };
        ctx.session.awaiting = null;
        await this.lessonService.updateLessonName(ctx.session.currentLessonId!, newName);
        await ctx.reply(`✅ Lesson nomi yangilandi: ${newName}`);
    }

    // Listeninglarni chiqarish uchun handler
    @Hears("🎧 Listening list")
    async showListeningList(@Ctx() ctx: BotContext) {
        const lessonId = ctx.session?.currentLessonId;
        if (!lessonId) {
            await ctx.reply("❌ Lesson tanlanmagan.");
            return;
        }
        const lesson = await this.lessonService.getLessonWithRelations(lessonId);
        if (!lesson?.listening?.length) {
            await ctx.reply("❌ Listening materiallar yo‘q.");
            return;
        }
        const keyboard = lesson.listening.map((item, idx) => [`🎧 Listening ${idx + 1}`]);
        keyboard.push(["🔙 Orqaga"]);
        await ctx.reply("🎧 Listening materiallar:", Markup.keyboard(keyboard).resize());
    }

    // @Hears(/^🎧 Listening (\d+)$/)
    // async editListening(@Ctx() ctx: BotContext) {
    //     const idx = Number(ctx.match[1]) - 1;
    //     const lessonId = ctx.session?.currentLessonId;
    //     const lesson = await this.lessonService.getLessonWithRelations(lessonId);
    //     const listening = lesson?.listening?.[idx];
    //     if (!listening) {
    //         await ctx.reply("❌ Listening topilmadi.");
    //         return;
    //     }
    //     ctx.session.editingListeningIdx = idx;
    //     await ctx.reply(
    //         `🎧 Listening ${idx + 1} tanlandi. Nima qilmoqchisiz?`,
    //         Markup.keyboard([
    //             ["✏️ O‘zgartirish", "❌ O‘chirish"],
    //             ["⬅️ Orqaga"]
    //         ]).resize()
    //     );
    // }

    // Student menu
    @Hears("📚 Lessons")
    async showLessons(@Ctx() ctx: BotContext) {
        const lessons = await this.lessonService.getAllLessons(ctx.from?.id!);
        if (!lessons.length) {
            await ctx.reply("📚 Sorry Lessons not found");
            return;
        }

        // Keyboardni har 2ta Lessondan iborat qilib tuzish
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
        await ctx.reply("📚 Mavjud Lessonlar:", Markup.keyboard(keyboard).resize());
    }

    @Hears(/^📗 Lesson (\d+)$/)
    async selectLesson(@Ctx() ctx: BotContext) {

        const unitNumber = parseInt(ctx.match?.[1] ?? '', 10);
        if (isNaN(unitNumber)) {
            await ctx.reply("❌ Lesson number not valid.");
            return;
        }

        initSession(ctx);
        assertSession(ctx);
        ctx.session.prevPage = 'lessonDetail';
        const lessons = ctx.session?.lessons ?? await this.lessonService.getAllLessons(ctx.from?.id!);
        const baseLesson = lessons[unitNumber - 1];

        if (!baseLesson) {
            await ctx.reply("❌ Lesson not found.");
            return;
        }

        const lesson = await this.lessonService.getLessonWithRelations(baseLesson.id);
        if (!lesson) {
            await ctx.reply("❌ Lesson not found.");
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
            message += "📎 Materials:\n";
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
            message += "❌ Bu Lessonda materiallar mavjud emas.";
        }

        keyboard.push(["🔙 Orqaga"]);

        await ctx.reply(message, Markup.keyboard(keyboard).resize());
    }

    @Hears(/^🎧 Listening$|^📖 Reading$|^📝 Test$|^📚 Vocablary$/)
    async sendLessonResource(@Ctx() ctx: BotContext) {
        initSession(ctx);
        const lessonId = ctx.session?.currentLessonId;
        if (!lessonId) {
            await ctx.reply("❌ Lesson tanlanmagan.");
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
            "📚 Vocabulary": "vocabulary",
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