import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import { Duck } from '@prisma/client';
import type { Response } from 'express';
import { CreateDuckDto } from './dto/create-duck.dto';
import { UpdateDuckDto } from './dto/update-duck.dto';
import { DucksService, DuckWriteResult } from './ducks.service';

@Controller('ducks')
export class DucksController {
  constructor(private readonly ducks: DucksService) {}

  @Get()
  findAll(): Promise<Duck[]> {
    return this.ducks.findAll();
  }

  /** 201 when a new record was created, 200 when the quantity merged into an existing one. */
  @Post()
  async create(
    @Body() dto: CreateDuckDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<DuckWriteResult> {
    const result = await this.ducks.create(dto);
    res.status(result.merged ? HttpStatus.OK : HttpStatus.CREATED);
    return result;
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDuckDto,
  ): Promise<DuckWriteResult> {
    return this.ducks.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.ducks.remove(id);
  }
}
