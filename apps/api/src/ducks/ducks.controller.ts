import { Controller } from '@nestjs/common';
import { DuckCrudController } from './duck-crud.controller';

/** Warehouse duck CRUD at /api/ducks. Handlers live in DuckCrudController. */
@Controller('ducks')
export class DucksController extends DuckCrudController {}
