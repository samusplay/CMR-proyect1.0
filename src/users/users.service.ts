import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword } from '../utils/password.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) { }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException(`Ya existe un usuario con el email ${dto.email}`);
    }

    const hashedPassword = await hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: { ...dto, password: hashedPassword },
    });

    return this.excludePassword(user);
  }

  // uso interno (lo va a llamar AuthService más adelante) — sin endpoint público
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException(`Usuario ${id} no encontrado`);
    }

    return user; // OJO: aquí SÍ devuelve el password completo, ver nota abajo
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);

    const data = { ...dto };

    if (dto.password) {
      data.password = await hashPassword(dto.password);
    }

    const user = await this.prisma.user.update({ where: { id }, data });

    return this.excludePassword(user);
  }

  //Nuevo metodo para buscar Por email
  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  private excludePassword(user: User) {
    const { password, ...rest } = user;
    return rest;
  }
}