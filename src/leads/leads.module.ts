import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DealsModule } from '../deals/deals.module';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';

@Module({
   imports: [AuthModule,DealsModule],
  controllers: [LeadsController],
  providers: [LeadsService],
   exports: [LeadsService],
})
export class LeadsModule {}
