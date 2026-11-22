import { Controller } from '@nestjs/common';
import { DuckCrudController } from '../ducks/duck-crud.controller';

/** Store duck CRUD at /api/store/ducks, backed by the same DucksService as the Warehouse. */
@Controller('store/ducks')
export class StoreDucksController extends DuckCrudController {}
