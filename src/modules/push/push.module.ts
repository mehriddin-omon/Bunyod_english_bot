import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushToken } from 'src/common/core/entitys/push-token.entity';
import { PushService } from './push.service';

@Module({
  imports: [TypeOrmModule.forFeature([PushToken])],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
