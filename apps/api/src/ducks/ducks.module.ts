import { Module } from '@nestjs/common';
import { DucksController } from './ducks.controller';
import { DucksService } from './ducks.service';

@Module({
  controllers: [DucksController],
  providers: [DucksService],
  // Exported so StoreModule can reuse the same CRUD and stock logic.
  exports: [DucksService],
})
export class DucksModule {}
