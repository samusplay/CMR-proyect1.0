import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ClientsModule } from './clients/clients.module';
import { DealsModule } from './deals/deals.module';
import { LeadsModule } from './leads/leads.module';
import { PrismaModule } from './prisma/prisma.module';


@Module({
  imports: [
    PrismaModule,
    //eventos
    EventEmitterModule.forRoot(),
    CampaignsModule,
    LeadsModule,
    DealsModule,
   ClientsModule
  ],
})
export class AppModule {}