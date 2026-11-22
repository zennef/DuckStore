import { Module } from '@nestjs/common';
import { DucksModule } from '../ducks/ducks.module';
import { StoreDucksController } from './store-ducks.controller';

@Module({
  imports: [DucksModule],
  controllers: [StoreDucksController],
})
export class StoreModule {}
