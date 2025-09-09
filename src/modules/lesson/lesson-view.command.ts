import { Ctx, Hears, Update } from 'nestjs-telegraf';
import { Markup } from 'telegraf';
import { LessonService } from './lesson.service';
import type { BotContext } from 'src/common/utils/bot.context';
import { ResourceType } from 'src/common/utils/enum';
import { initSession } from 'src/common/utils/session.utils';
import { SAVED_TELEGRAM_CHANNEL_ID } from 'src/common/utils/const';

@Update()
export class LessonViewCommand {
    constructor(private readonly lessonService: LessonService) { }

    @Hears("📚 Darslar")
    async showLessons(@Ctx() ctx: BotContext) {
        const lessons = await this.lessonService.getAllLessons();
        if (!lessons.length) {
            return ctx.reply("📚 Hali darslar mavjud emas.");
        }

        const keyboard = lessons.map((lesson, index) => [`📗 Unit ${index + 1}`]);
        keyboard.push(["⬅️ Asosiy menyu"]);

        ctx.session ??= {
            data: {},
            awaiting: null,
            currentLessonId: null,
            lessons: [],
        };
        ctx.session.lessons = lessons;

        await ctx.reply("📚 Mavjud darslar:", Markup.keyboard(keyboard).resize());
    }

    @Hears(/^📗 Unit (\d+)$/)
    async selectLesson(@Ctx() ctx: BotContext) {
        const unitNumber = parseInt(ctx.match?.[1] ?? '', 10);
        if (isNaN(unitNumber)) {
            return ctx.reply("❌ Unit raqami noto‘g‘ri.");
        }

        initSession(ctx);
        const lessons = ctx.session?.lessons ?? await this.lessonService.getAllLessons();
        const baseLesson = lessons[unitNumber - 1];

        if (!baseLesson) {
            return ctx.reply("❌ Dars topilmadi.");
        }

        const lesson = await this.lessonService.getLessonWithRelations(baseLesson.id);
        if (!lesson) {
            return ctx.reply("❌ Dars topilmadi.");
        }

        ctx.session!.currentLessonId = lesson.id;

        let message = `📖 ${lesson.lesson_name}\n\n`;
        const keyboard: string[][] = [];

        const sections = [
            { label: "🎧 Listening", data: lesson.listening },
            { label: "📖 Reading", data: lesson.readings },
            { label: "📝 Test", data: lesson.tests },
            { label: "📚 WordList", data: lesson.wordList },
        ];

        const availableSections = sections.filter(section => section.data?.length);

        if (availableSections.length) {
            message += "📎 Materiallar:\n";
            for (const section of availableSections) {
                message += `${section.label} (${section.data.length} ta)\n`;
                keyboard.push([section.label]);
            }
        } else {
            message += "❌ Bu darsda materiallar mavjud emas.";
        }

        keyboard.push(["🔙 Orqaga"]);

        await ctx.reply(message, Markup.keyboard(keyboard).resize());
    }

    @Hears(/^🎧 Listening$|^📖 Reading$|^📝 Test$|^📚 WordList$/)
    async sendLessonResource(@Ctx() ctx: BotContext) {
        initSession(ctx);
        const lessonId = ctx.session?.currentLessonId;
        if (!lessonId) return ctx.reply("❌ Dars tanlanmagan.");

        const typeText =
            ctx.message && 'text' in ctx.message && typeof ctx.message.text === 'string'
                ? ctx.message.text.trim()
                : '';

        const sectionMap = {
            "🎧 Listening": "listening",
            "📖 Reading": "readings",
            "📝 Test": "tests",
            "📚 WordList": "wordList",
        } as const;

        const relationKey = sectionMap[typeText as keyof typeof sectionMap];
        if (!relationKey) return ctx.reply("❌ Noto‘g‘ri material turi.");

        const lesson = await this.lessonService.getLessonWithRelations(lessonId);
        const resources = lesson?.[relationKey];

        if (!resources || !Array.isArray(resources) || resources.length === 0) {
            return ctx.reply(`❌ ${typeText} materiali mavjud emas.`);
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
    async backToLessons(@Ctx() ctx: BotContext) {
        return this.showLessons(ctx);
    }

    @Hears("⬅️ Asosiy menyu")
    async backToMain(@Ctx() ctx: BotContext) {
        await ctx.reply("🏠 Asosiy menyu:", Markup.keyboard([
            ["📚 Darslar"],
            ["ℹ️ Yordam"]
        ]).resize());
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