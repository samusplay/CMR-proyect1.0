import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MaterialCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MaterialsService } from './materials.service';

describe('MaterialsService', () => {
  let service: MaterialsService;
  let prisma: any;

  const material = {
    id: 'mat-1',
    code: 'CAB-001',
    description: 'Cable THHN 8 AWG',
    category: MaterialCategory.CABLEADO,
    unitCode: 'ML',
    unitPrice: 5200,
    active: true,
  };

  // Es el error que lanza Prisma cuando se viola un campo unique (el código repetido)
  const duplicateError = () =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });

  beforeEach(async () => {
    prisma = {
      material: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [MaterialsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<MaterialsService>(MaterialsService);
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const dto = () => ({
      code: '  cab-001 ',
      description: '  Cable THHN 8 AWG ',
      category: MaterialCategory.CABLEADO,
      unitCode: ' ml ',
      unitPrice: 5200,
    });

    it('guarda el código y la unidad en mayúsculas y sin espacios sobrantes', async () => {
      prisma.material.create.mockResolvedValue(material);

      await service.create(dto());

      expect(prisma.material.create).toHaveBeenCalledWith({
        data: {
          code: 'CAB-001',
          description: 'Cable THHN 8 AWG',
          category: MaterialCategory.CABLEADO,
          unitCode: 'ML',
          unitPrice: 5200,
        },
      });
    });

    it('devuelve el material creado', async () => {
      prisma.material.create.mockResolvedValue(material);

      await expect(service.create(dto())).resolves.toEqual(material);
    });

    it('lanza ConflictException con el código normalizado si ya existe', async () => {
      prisma.material.create.mockRejectedValue(duplicateError());

      await expect(service.create(dto())).rejects.toThrow(
        new ConflictException('Ya existe un material con el código CAB-001'),
      );
    });

    it('no esconde otros errores de la base como si fueran un código repetido', async () => {
      prisma.material.create.mockRejectedValue(new Error('db caída'));

      await expect(service.create(dto())).rejects.toThrow('db caída');
      await expect(service.create(dto())).rejects.not.toBeInstanceOf(ConflictException);
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      prisma.material.findMany.mockResolvedValue([material]);
    });

    it('sin filtros no restringe nada y ordena por categoría y luego por código', async () => {
      await service.findAll({});

      const args = prisma.material.findMany.mock.calls[0][0];
      expect(args.where).toEqual({});
      expect(args.where).not.toHaveProperty('OR');
      expect(args.orderBy).toEqual([{ category: 'asc' }, { code: 'asc' }]);
    });

    it('filtra por categoría', async () => {
      await service.findAll({ category: MaterialCategory.SOLAR });

      const { where } = prisma.material.findMany.mock.calls[0][0];
      expect(where.category).toBe(MaterialCategory.SOLAR);
    });

    it("convierte active 'true' y 'false' (texto de la URL) en booleanos", async () => {
      await service.findAll({ active: 'true' });
      await service.findAll({ active: 'false' });

      expect(prisma.material.findMany.mock.calls[0][0].where.active).toBe(true);
      expect(prisma.material.findMany.mock.calls[1][0].where.active).toBe(false);
    });

    it('busca por código o descripción sin distinguir mayúsculas', async () => {
      await service.findAll({ search: '  thhn ' });

      const { where } = prisma.material.findMany.mock.calls[0][0];
      expect(where.OR).toEqual([
        { code: { contains: 'thhn', mode: 'insensitive' } },
        { description: { contains: 'thhn', mode: 'insensitive' } },
      ]);
    });

    it('ignora una búsqueda que son solo espacios', async () => {
      await service.findAll({ search: '   ' });

      const { where } = prisma.material.findMany.mock.calls[0][0];
      expect(where).not.toHaveProperty('OR');
    });

    it('combina filtros: categoría, activo y búsqueda a la vez', async () => {
      await service.findAll({ category: MaterialCategory.CABLEADO, active: 'true', search: 'cable' });

      const { where } = prisma.material.findMany.mock.calls[0][0];
      expect(where.category).toBe(MaterialCategory.CABLEADO);
      expect(where.active).toBe(true);
      expect(where.OR).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('devuelve el material si existe', async () => {
      prisma.material.findUnique.mockResolvedValue(material);

      await expect(service.findOne('mat-1')).resolves.toEqual(material);
      expect(prisma.material.findUnique).toHaveBeenCalledWith({ where: { id: 'mat-1' } });
    });

    it('lanza NotFoundException si no existe', async () => {
      prisma.material.findUnique.mockResolvedValue(null);

      await expect(service.findOne('no-existe')).rejects.toThrow(
        new NotFoundException('Material no-existe no encontrado'),
      );
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.material.findUnique.mockResolvedValue(material);
      prisma.material.update.mockResolvedValue(material);
    });

    it('lanza NotFoundException si el material no existe, y nunca actualiza', async () => {
      prisma.material.findUnique.mockResolvedValue(null);

      await expect(service.update('no-existe', { unitPrice: 6000 })).rejects.toThrow(
        new NotFoundException('Material no-existe no encontrado'),
      );

      expect(prisma.material.update).not.toHaveBeenCalled();
    });

    it('actualiza solo lo que viene en el body', async () => {
      await service.update('mat-1', { unitPrice: 6000 });

      const args = prisma.material.update.mock.calls[0][0];
      expect(args.where).toEqual({ id: 'mat-1' });
      expect(args.data).toEqual({ unitPrice: 6000 });
    });

    it('normaliza código y unidad al editarlos', async () => {
      await service.update('mat-1', { code: ' cab-002 ', unitCode: ' mt ', description: ' Cable 10 AWG ' });

      const { data } = prisma.material.update.mock.calls[0][0];
      expect(data).toEqual({ code: 'CAB-002', unitCode: 'MT', description: 'Cable 10 AWG' });
    });

    it('desactiva el material con active false (no se borra)', async () => {
      await service.update('mat-1', { active: false });

      const { data } = prisma.material.update.mock.calls[0][0];
      expect(data).toEqual({ active: false });
    });

    it('devuelve el material actualizado', async () => {
      const actualizado = { ...material, unitPrice: 6000 };
      prisma.material.update.mockResolvedValue(actualizado);

      await expect(service.update('mat-1', { unitPrice: 6000 })).resolves.toEqual(actualizado);
    });

    it('lanza ConflictException si el código nuevo ya lo usa otro material', async () => {
      prisma.material.update.mockRejectedValue(duplicateError());

      await expect(service.update('mat-1', { code: 'cab-002' })).rejects.toThrow(
        new ConflictException('Ya existe un material con el código CAB-002'),
      );
    });

    it('no esconde otros errores de la base como si fueran un código repetido', async () => {
      prisma.material.update.mockRejectedValue(new Error('db caída'));

      await expect(service.update('mat-1', { unitPrice: 6000 })).rejects.toThrow('db caída');
    });
  });
});