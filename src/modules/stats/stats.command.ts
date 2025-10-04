import { Ctx, Hears, Update } from "nestjs-telegraf";
import type { BotContext } from "src/common";

@Update()
export class StatsCommand {
    constructor(
    ) { }

    @Hears("📊 Statistika")
    async showStatistika(@Ctx() ctx: BotContext) {
        await ctx.reply("Afsuski, bu bo'lim hozircha tayyor emas. Tez orada yangilanishlarni kuting! 🚀");
        return;
    }
}