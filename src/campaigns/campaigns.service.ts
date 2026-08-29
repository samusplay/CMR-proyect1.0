import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCampaignDto } from './dtos/create-campaign.dto';
import { UpdateCampaignDto } from './dtos/update-campaign.dto';
//Canales Permitidos

const ALLOWED_CHANNELS = ['facebook', 'google', 'instagram', 'referido'];
@Injectable()
export class CampaignsService {
    constructor(private prisma: PrismaService) { }

    create(dto: CreateCampaignDto) {
        //lo normalizamos
        const channel = dto.channel.toLowerCase().trim();

        //manejo de error
        if (!ALLOWED_CHANNELS.includes(channel)) {
            throw new BadRequestException(`Canal inválido: ${dto.channel}`);
        }
        //
        return this.prisma.campaign.create({
            data: {
                //Recuperamos los datos  sin tener que rescribirlos
                ...dto,
                channel,
                utmSource: dto.utmSource?.toLowerCase().trim(),
            },
        });

    }

    findAll() {
        //Econtrar por Campañas activas
        return this.prisma.campaign.findMany({ where: { active: true } });
    }

    findOne(id: string) {
        return this.prisma.campaign.findUnique({ where: { id } });
    }

    update(id: string, dto: UpdateCampaignDto) {
        return this.prisma.campaign.update({ where: { id }, data: dto });
    }

    remove(id: string) {
        return this.prisma.campaign.update({
            where: { id },
            data: { active: false },
        });
    }
}