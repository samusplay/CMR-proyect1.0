import { Module } from '@nestjs/common';
import { CampaignsModule } from './campaigns/campaigns.module';
import { PrismaModule } from './prisma/prisma.module';


@Module({
  imports: [PrismaModule,CampaignsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
