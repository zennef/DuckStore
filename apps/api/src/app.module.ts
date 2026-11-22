import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DucksModule } from './ducks/ducks.module';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { StoreModule } from './store/store.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, DucksModule, StoreModule],
  controllers: [HealthController],
})
export class AppModule {}
