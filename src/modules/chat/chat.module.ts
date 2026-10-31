import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuardModule } from '@my/common';
import {
  ChatMessage,
  ChatRead,
  ChatReport,
  ChatRestriction,
  ChatUserBlock,
  GroupChat,
} from 'src/common/core/entitys/group-chat.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ChatController, TeacherChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatBus, ChatPresence } from './chat-realtime';
import { ChatService } from './chat.service';

@Module({
  imports: [
    GuardModule,
    NotificationsModule,
    TypeOrmModule.forFeature([GroupChat, ChatMessage, ChatRead, ChatRestriction, ChatReport, ChatUserBlock]),
  ],
  providers: [ChatService, ChatGateway, ChatPresence, ChatBus],
  controllers: [ChatController, TeacherChatController],
})
export class ChatModule {}
