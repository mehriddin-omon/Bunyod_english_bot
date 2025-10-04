import { Ctx, Hears, Update } from "nestjs-telegraf";
import type { BotContext } from "src/common";

@Update()
export class ParamsCommand {
    constructor(
    ) { }

    @Hears("⚙️ Sozlamalar")
    async showParams(@Ctx() ctx: BotContext) {
        await ctx.reply("Afsuski, bu bo'lim hozircha tayyor emas. Tez orada yangilanishlarni kuting! 🚀");
        return;
    }
}