import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AppointmentsService } from './appointments.service';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { FindAppointmentsQueryDto } from './dto/find-appointments-query.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';

// Passport tipa request.user como un objeto vacío; esto le dice a TypeScript
// qué forma tiene después de pasar por JwtAuthGuard
type AuthenticatedRequest = Request & {
  user: { userId: string; email: string; role: string };
};

@Controller('appointments')
@UseGuards(JwtAuthGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  create(@Body() dto: CreateAppointmentDto, @Req() req: AuthenticatedRequest) {
    return this.appointmentsService.create(dto, req.user.userId);
  }

  @Get()
  findAll(@Query() query: FindAppointmentsQueryDto) {
    return this.appointmentsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.appointmentsService.findOne(id);
  }

  @Patch(':id/reschedule')
  reschedule(
    @Param('id') id: string,
    @Body() dto: RescheduleAppointmentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.appointmentsService.reschedule(id, dto, req.user.userId);
  }

 @Patch(':id/cancel')
cancel(
  @Param('id') id: string,
  @Body() dto: CancelAppointmentDto,
  @Req() req: AuthenticatedRequest,
) {
  return this.appointmentsService.cancel(id, dto, req.user.userId);
}
}