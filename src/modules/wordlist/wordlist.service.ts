import { Injectable } from '@nestjs/common';
import { CreateWordlistDto } from './dto/create-wordlist.dto';
import { UpdateWordlistDto } from './dto/update-wordlist.dto';

@Injectable()
export class WordlistService {
  create(createWordlistDto: CreateWordlistDto) {
    return 'This action adds a new wordlist';
  }

  findAll() {
    return `This action returns all wordlist`;
  }

  findOne(id: number) {
    return `This action returns a #${id} wordlist`;
  }

  update(id: number, updateWordlistDto: UpdateWordlistDto) {
    return `This action updates a #${id} wordlist`;
  }

  remove(id: number) {
    return `This action removes a #${id} wordlist`;
  }
}
