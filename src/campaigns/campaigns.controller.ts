import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CampaignsService } from './campaigns.service';
import { CampaignResponseDto } from './dtos/campaign-response.dto';
import { CreateCampaignDto } from './dtos/create-campaign.dto';
import { UpdateCampaignDto } from './dtos/update-campaign.dto';

@Controller('campaigns')
@UseGuards(JwtAuthGuard) 
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) { }

  //Poner decorador de Post
  //Ya la ruta es campanings 
  @Post()
  //Los parametros lo que el cliente nos va enviar
  //Como promesa le pasamos los datos que le prometemos responder
  //usar el Body para la peticiond e Json
  createCampaign(@Body() dto: CreateCampaignDto): Promise<CampaignResponseDto> {
    return this.campaignsService.create(dto)
  }

  @Get()
  finAll(): Promise<CampaignResponseDto[]> {
    return this.campaignsService.findAll();
  }

  @Patch(':id')
  update(
    //Param sirbe para ponerlo en la Url 
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ): Promise<CampaignResponseDto> {
    return this.campaignsService.update(id, dto);
  }
  @Delete(':id')
  remove(@Param('id') id: string): Promise<CampaignResponseDto> {
    return this.campaignsService.remove(id);
  }

}



