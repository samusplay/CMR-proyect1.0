import { Module } from '@nestjs/common';
import { CampaignsModule } from './campaigns/campaigns.module';
import { PrismaModule } from './prisma/prisma.module';
import { DealsModule } from './deals/deals.module';
import { LeadsModule } from './leads/leads.module';


@Module({
  imports: [PrismaModule,CampaignsModule, DealsModule, LeadsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
