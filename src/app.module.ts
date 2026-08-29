import { Module } from '@nestjs/common';
import { CampaignsModule } from './campaigns/campaigns.module';
import { PrismaModule } from './prisma/prisma.module';
import { DealsModule } from './deals/deals.module';


@Module({
  imports: [PrismaModule,CampaignsModule, DealsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
