import {
  Body,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
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

/**
 * The duck CRUD routes, shared by the Warehouse (/api/ducks) and Store (/api/store/ducks)
 * controllers. Each subclass only adds @Controller with its path, so both expose the
 * same handlers, status codes and response shapes with no duplicated logic. Nest
 * inherits route decorators from the base class.
 */
export abstract class DuckCrudController {
  // Explicit @Inject: TypeScript only emits constructor type metadata for decorated
  // classes, so without it the subclasses would get an undefined DucksService.
  constructor(@Inject(DucksService) private readonly ducks: DucksService) {}

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
