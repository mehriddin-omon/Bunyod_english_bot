import { Ctx, Hears, Update } from "nestjs-telegraf";
import { ExtraReplyMessage } from "node_modules/telegraf/typings/telegram-types";
import type { BotContext } from "src/common";

@Update()
export class HelpCommand {
    constructor(
    ) { }

    @Hears("ℹ️ Yordam")
    async showHelpers(@Ctx() ctx: BotContext) {
        await ctx.reply(
            '👨‍🏫 Teacher: <a href="https://t.me/shamsiddinov_1347">Bunyod Shamsiddinov</a>\n' +
            '👨🏾‍💻 Programmer: <a href="https://t.me/mehriddin_amonboyev">Mehriddin Omon</a>',
            {
                parse_mode: "HTML",
                disable_web_page_preview: true
            } as ExtraReplyMessage
        );
    }
}