import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
//Ncesario tener el Prisma Module para poder accer al Orm
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}