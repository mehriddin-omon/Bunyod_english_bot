import { Injectable } from '@nestjs/common';
import { Message } from 'telegraf/types';

@Injectable()
export class ListeningService {

  
  extractAudioData(message: Message, sentMessageId: number) {
    if ('audio' in message) {
      return {
        type: 'audio',
        fileId: message.audio.file_id,
        title: message.audio.title,
        channelMessageId: sentMessageId,
      };
    }
    if ('voice' in message) {
      return {
        type: 'voice',
        fileId: message.voice.file_id,
        channelMessageId: sentMessageId,
      };
    }
    return { type: 'unknown' };
  }
}