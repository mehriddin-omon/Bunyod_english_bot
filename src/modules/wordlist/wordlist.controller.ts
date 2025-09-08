// import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
// import { WordlistService } from './wordlist.service';
// import { CreateWordlistDto } from './dto/create-wordlist.dto';
// import { UpdateWordlistDto } from './dto/update-wordlist.dto';

// @Controller('wordlist')
// export class WordlistController {
//   constructor(private readonly wordlistService: WordlistService) {}

//   @Post()
//   create(@Body() createWordlistDto: CreateWordlistDto) {
//     return this.wordlistService.create(createWordlistDto);
//   }

//   @Get()
//   findAll() {
//     return this.wordlistService.findAll();
//   }

//   @Get(':id')
//   findOne(@Param('id') id: string) {
//     return this.wordlistService.findOne(+id);
//   }

//   @Patch(':id')
//   update(@Param('id') id: string, @Body() updateWordlistDto: UpdateWordlistDto) {
//     return this.wordlistService.update(+id, updateWordlistDto);
//   }

//   @Delete(':id')
//   remove(@Param('id') id: string) {
//     return this.wordlistService.remove(+id);
//   }
// }
