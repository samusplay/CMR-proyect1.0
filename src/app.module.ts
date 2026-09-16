import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from './auth/auth.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ClientsModule } from './clients/clients.module';
import { DealsModule } from './deals/deals.module';
import { LeadsModule } from './leads/leads.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { InspectionsModule } from './inspections/inspections.module';


@Module({
  imports: [
    PrismaModule,
    //eventos
    EventEmitterModule.forRoot(),
     ConfigModule.forRoot({ isGlobal: true }),
    CampaignsModule,
    LeadsModule,
    DealsModule,
   ClientsModule,
   UsersModule,
   AuthModule,
   InspectionsModule
  ],
})
export class AppModule {}