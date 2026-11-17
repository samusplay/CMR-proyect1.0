import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { buildOfferLinesFromInspection, InspectionForOffer, normalizeCode } from './domain/offer-rules';
import { canTransition, isEditable } from './domain/offer-status';
import { calculateOfferTotals, hasUnpricedLines } from './domain/offer-totals';
import { ChangeOfferStatusDto } from './dto/change-offer-status.dto';
import { FindOffersQueryDto } from './dto/find-offers-query.dto';
import { GenerateOfferDto } from './dto/generate-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { OFFER_STATUS_CHANGED_EVENT, OfferStatusChangedEvent } from './events/offer-status-changed.event';

// Las líneas siempre se devuelven en orden
const offerInclude = {
  items: { orderBy: { lineNumber: 'asc' } },
} satisfies Prisma.OfferInclude;

type OfferWithItems = Prisma.OfferGetPayload<{ include: typeof offerInclude }>;

const MAX_NUMBER_ATTEMPTS = 3;

@Injectable()
export class OffersService {
  constructor(private prisma: PrismaService,  private eventEmitter: EventEmitter2,) {}

  // Genera el borrador de oferta a partir de la inspección aprobada del deal
  async generateFromInspection(dto: GenerateOfferDto) {
    const deal = await this.findDealReadyForOffer(dto.dealId);
    const { items, warnings } = await this.buildItemsFromInspection(deal.inspection);

    const offer = await this.createWithNumber({
      dealId: deal.id,
      title: `Oferta de instalación para ${deal.lead.name}`,
      items: { create: items },
    });

    return { ...this.withTotals(offer), warnings };
  }

  async findAll(query: FindOffersQueryDto) {
    const offers = await this.prisma.offer.findMany({
      where: { status: query.status, dealId: query.dealId },
      include: offerInclude,
      orderBy: { createdAt: 'desc' }, // las más recientes primero
    });

    return offers.map((offer) => this.withTotals(offer));
  }

  async findOne(id: string) {
    const offer = await this.prisma.offer.findUnique({
      where: { id },
      include: offerInclude,
    });

    if (!offer) {
      throw new NotFoundException(`Oferta ${id} no encontrada`);
    }

    return this.withTotals(offer);
  }

  // Corrige el encabezado de la oferta. Solo mientras está en BORRADOR
  async update(id: string, dto: UpdateOfferDto) {
    const current = await this.findOne(id);

    if (!isEditable(current.status)) {
      throw new ConflictException(`Solo se puede editar una oferta en BORRADOR (actual: ${current.status})`);
    }

    const offer = await this.prisma.offer.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        aiuPercentage: dto.aiuPercentage,
        ivaPercentage: dto.ivaPercentage,
        deliveryTime: dto.deliveryTime,
        deliveryCondition: dto.deliveryCondition,
        warranty: dto.warranty,
        paymentTerms: dto.paymentTerms,
        validityDays: dto.validityDays,
      },
      include: offerInclude,
    });

    return this.withTotals(offer);
  }

  // Mueve la oferta por su ciclo de vida: BORRADOR → ENVIADA → ACEPTADA o RECHAZADA
  async changeStatus(id: string, dto: ChangeOfferStatusDto) {
    const current = await this.findOne(id);

    if (!canTransition(current.status, dto.status)) {
      throw new ConflictException(`No se puede pasar una oferta de ${current.status} a ${dto.status}`);
    }

    if (dto.status === 'ENVIADA' && hasUnpricedLines(current.items)) {
      throw new ConflictException('La oferta tiene líneas con precio 0. Complétalas antes de enviarla');
    }

    // Solo cambia si nadie la movió mientras tanto: si otra persona se adelantó, count será 0
    const { count } = await this.prisma.offer.updateMany({
      where: { id, status: current.status },
      data: { status: dto.status },
    });
    if (count === 0) {
      throw new ConflictException('La oferta fue modificada por otra persona. Actualiza e intenta de nuevo');
    }
    // Avisa al resto del sistema; el módulo de deals decide cómo reacciona
    // Avisa al resto del sistema; el módulo de deals decide cómo reacciona
    this.eventEmitter.emit(
      OFFER_STATUS_CHANGED_EVENT,
      new OfferStatusChangedEvent(id, current.dealId, dto.status),
    );
    return this.findOne(id);
  }

  // --- privados ---

  // Comprueba que el deal pueda recibir una oferta y lo devuelve con su inspección
  private async findDealReadyForOffer(dealId: string) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: {
        inspection: true,
        offer: { select: { id: true } },
        lead: { select: { name: true } },
      },
    });

    if (!deal) {
      throw new NotFoundException(`El deal ${dealId} no existe`);
    }
    if (deal.offer) {
      throw new ConflictException(`El deal ${dealId} ya tiene una oferta`);
    }
    if (!deal.inspection) {
      throw new ConflictException(`El deal ${dealId} no tiene una inspección registrada`);
    }
    if (deal.inspection.status !== 'APROBADA') {
      throw new ConflictException(
        `La inspección debe estar APROBADA para generar la oferta (actual: ${deal.inspection.status})`,
      );
    }

    return { ...deal, inspection: deal.inspection };
  }

  // Convierte la inspección en líneas de oferta, con el precio del catálogo cuando encuentra el material
  private async buildItemsFromInspection(inspection: InspectionForOffer) {
    const drafts = buildOfferLinesFromInspection(inspection);
    const catalog = await this.loadCatalog();
    const warnings: string[] = [];

    const items = drafts.map((draft, index) => {
      const material = draft.materialCode ? catalog.get(normalizeCode(draft.materialCode)) : undefined;

      if (!material) {
        const searched = draft.materialCode ?? 'ninguno: falta un dato en la inspección';
        warnings.push(
          `Sin material en el catálogo para "${draft.description}" (código buscado: ${searched}). Quedó con precio 0.`,
        );
      }

      return {
        lineNumber: index + 1,
        materialId: material?.id,
        unitCode: material?.unitCode ?? draft.unitCode,
        description: material?.description ?? draft.description,
        quantity: draft.quantity,
        unitPrice: material?.unitPrice ?? 0, // precio copiado del catálogo en este momento
        groupLabel: draft.groupLabel,
      };
    });

    return { items, warnings };
  }

  // Materiales activos, indexados por código normalizado para encontrarlos aunque cambien mayúsculas o guiones
  private async loadCatalog() {
    const materials = await this.prisma.material.findMany({ where: { active: true } });
    return new Map(materials.map((material) => [normalizeCode(material.code), material] as const));
  }

  // Guarda la oferta con su número. Si dos ofertas se crean a la vez y chocan, se reintenta
  private async createWithNumber(data: Omit<Prisma.OfferUncheckedCreateInput, 'offerNumber'>) {
    for (let attempt = 1; attempt <= MAX_NUMBER_ATTEMPTS; attempt++) {
      try {
        return await this.prisma.offer.create({
          data: { ...data, offerNumber: await this.nextOfferNumber() },
          include: offerInclude,
        });
      } catch (error) {
        const target = this.uniqueViolationTarget(error);
        if (target === null) {
          throw error;
        }
        if (target.includes('dealId')) {
          throw new ConflictException(`El deal ${data.dealId} ya tiene una oferta`);
        }
        // Si no fue el deal, chocó el número: otra oferta lo tomó primero y se intenta con el siguiente
      }
    }

    throw new ConflictException('No se pudo asignar un número de oferta. Intenta de nuevo');
  }

  // Número consecutivo por año: OF-2026-0001, OF-2026-0002…
  private async nextOfferNumber(): Promise<string> {
    const prefix = `OF-${new Date().getFullYear()}-`;

    const last = await this.prisma.offer.findFirst({
      where: { offerNumber: { startsWith: prefix } },
      orderBy: { offerNumber: 'desc' },
      select: { offerNumber: true },
    });

    const next = last ? Number(last.offerNumber.slice(prefix.length)) + 1 : 1;
    return `${prefix}${String(next).padStart(4, '0')}`;
  }

  // P2002 = violación de unique. Devuelve qué campo chocó, o null si fue otro tipo de error
  private uniqueViolationTarget(error: unknown): string | null {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return String(error.meta?.target ?? '');
    }
    return null;
  }

  // Los totales se calculan al responder; no se guardan, así nunca quedan desfasados de las líneas
  private withTotals(offer: OfferWithItems) {
    return {
      ...offer,
      totals: calculateOfferTotals(offer.items, offer.aiuPercentage, offer.ivaPercentage),
    };
  }
}