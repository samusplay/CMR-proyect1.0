import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChangeOfferStatusDto } from './dto/change-offer-status.dto';
import { FindOffersQueryDto } from './dto/find-offers-query.dto';
import { GenerateOfferDto } from './dto/generate-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { OffersService } from './offers.service';
@Controller('offers')
@UseGuards(JwtAuthGuard)
export class OffersController {
  constructor(private readonly offersService: OffersService) { }

  // Genera el borrador de oferta a partir de la inspección aprobada del deal
  @Post('generate')
  generate(@Body() dto: GenerateOfferDto) {
    return this.offersService.generateFromInspection(dto);
  }
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOfferDto) {
    return this.offersService.update(id, dto);
  }
    // Enviar, aceptar, rechazar o reabrir. Las reglas viven en el servicio
  @Patch(':id/status')
  changeStatus(@Param('id') id: string, @Body() dto: ChangeOfferStatusDto) {
    return this.offersService.changeStatus(id, dto);
  }

  @Get()
  findAll(@Query() query: FindOffersQueryDto) {
    return this.offersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.offersService.findOne(id);
  }

}