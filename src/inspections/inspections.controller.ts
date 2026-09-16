import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { InspectionsService } from './inspections.service';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateInspectionDto } from './dtos/create-inspection.dto';
import { InspectionResponseDto } from './dtos/inspection-response.dto';
import { UpdateInspectionDto } from './dtos/update-inspection.dto';

@Controller('inspections')
@UseGuards(JwtAuthGuard)
export class InspectionsController {
  constructor(private readonly inspectionsService: InspectionsService) {}

  @Post()
  create(@Body() dto: CreateInspectionDto): Promise<InspectionResponseDto> {
    return this.inspectionsService.create(dto);
  }

  @Get()
  findAll(): Promise<InspectionResponseDto[]> {
    return this.inspectionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<InspectionResponseDto> {
    return this.inspectionsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateInspectionDto,
  ): Promise<InspectionResponseDto> {
    return this.inspectionsService.update(id, dto);
  }
}