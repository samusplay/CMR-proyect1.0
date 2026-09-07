import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import * as passwordUtil from '../utils/password.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

// Mockeamos el módulo completo de utils
jest.mock('../utils/password.util');

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      user: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);

    jest.clearAllMocks(); // aquí SÍ es correcto: limpia el mock de passwordUtil entre tests
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('hashea la contraseña antes de guardar', async () => {
      const dto = { name: 'Samuel', email: 'samuel@test.com', password: 'Segura123' } as CreateUserDto;

      prisma.user.findUnique.mockResolvedValue(null); // no hay email duplicado
      (passwordUtil.hashPassword as jest.Mock).mockResolvedValue('hash-falso-123');
      prisma.user.create.mockResolvedValue({
        id: '1',
        name: 'Samuel',
        email: 'samuel@test.com',
        password: 'hash-falso-123',
        role: 'vendedor',
      });

      await service.create(dto);

      expect(passwordUtil.hashPassword).toHaveBeenCalledWith('Segura123');
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ password: 'hash-falso-123' }),
      });
    });

    it('nunca devuelve el password en la respuesta', async () => {
      const dto = { name: 'Samuel', email: 'samuel@test.com', password: 'Segura123' } as CreateUserDto;

      prisma.user.findUnique.mockResolvedValue(null);
      (passwordUtil.hashPassword as jest.Mock).mockResolvedValue('hash-falso-123');
      prisma.user.create.mockResolvedValue({
        id: '1',
        name: 'Samuel',
        email: 'samuel@test.com',
        password: 'hash-falso-123',
        role: 'vendedor',
      });

      const result = await service.create(dto);

      expect(result).not.toHaveProperty('password');
    });

    it('lanza ConflictException si el email ya existe, y nunca hashea ni crea', async () => {
      const dto = { name: 'Samuel', email: 'ya-existe@test.com', password: 'Segura123' } as CreateUserDto;
      prisma.user.findUnique.mockResolvedValue({ id: 'otro-user' });

      await expect(service.create(dto)).rejects.toThrow(
        new ConflictException('Ya existe un usuario con el email ya-existe@test.com'),
      );

      expect(passwordUtil.hashPassword).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('hashea el password solo si viene en el DTO', async () => {
      const id = '1';
      prisma.user.findUnique.mockResolvedValue({ id, email: 'samuel@test.com' });
      (passwordUtil.hashPassword as jest.Mock).mockResolvedValue('nuevo-hash');
      prisma.user.update.mockResolvedValue({ id, password: 'nuevo-hash' });

      await service.update(id, { password: 'NuevaClave123' } as any);

      expect(passwordUtil.hashPassword).toHaveBeenCalledWith('NuevaClave123');
    });

    it('NO llama a hashPassword si el update no incluye password', async () => {
      const id = '1';
      prisma.user.findUnique.mockResolvedValue({ id, email: 'samuel@test.com' });
      prisma.user.update.mockResolvedValue({ id, name: 'Nuevo nombre' });

      await service.update(id, { name: 'Nuevo nombre' } as any);

      expect(passwordUtil.hashPassword).not.toHaveBeenCalled();
    });
  });

  describe('findOne (uso interno)', () => {
    it('lanza NotFoundException si el usuario no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('no-existe')).rejects.toThrow(NotFoundException);
    });

    it('SÍ incluye el password (es uso interno para Auth, no se expone)', async () => {
      const mockUser = { id: '1', email: 'samuel@test.com', password: 'hash-real' };
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOne('1');

      expect(result).toHaveProperty('password', 'hash-real');
    });
  });
});