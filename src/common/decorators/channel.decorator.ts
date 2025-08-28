import { applyDecorators, UseGuards } from "@nestjs/common";
import { ChannelGuard } from "../guard/channel.guard";

export function CheckChannel(){
    return applyDecorators(UseGuards(ChannelGuard));
}