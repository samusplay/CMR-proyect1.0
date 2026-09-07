import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { cleanDatabase } from '../src/utils/database.util';


describe('Auth y Guard (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const testEmail = `test-${Date.now()}@econexium.com`;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();

    prisma = app.get(PrismaService);
    console.log('🔍 DATABASE_URL usada:', process.env.DATABASE_URL);
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  it('GET /campaigns sin token devuelve 401', () => {
    return request(app.getHttpServer())
      .get('/campaigns')
      .expect(401);
  });

  it('POST /users registra un usuario nuevo sin exponer el password', async () => {
    const response = await request(app.getHttpServer())
      .post('/users')
      .send({
        name: 'Usuario de Prueba',
        email: testEmail,
        password: 'Segura123',
        role: 'admin',
      })
      .expect(201);

    expect(response.body).not.toHaveProperty('password');
    expect(response.body.email).toBe(testEmail);
  });

  it('POST /auth/login con credenciales correctas devuelve un accessToken', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testEmail, password: 'Segura123' })
      .expect(201);

    expect(response.body).toHaveProperty('accessToken');
    accessToken = response.body.accessToken;
  });

  it('POST /auth/login con password incorrecto devuelve 401', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testEmail, password: 'ClaveIncorrecta' })
      .expect(401);
  });

  it('GET /campaigns CON token válido devuelve 200', () => {
    return request(app.getHttpServer())
      .get('/campaigns')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  });

  it('GET /campaigns con token inválido devuelve 401', () => {
    return request(app.getHttpServer())
      .get('/campaigns')
      .set('Authorization', 'Bearer token-inventado-falso')
      .expect(401);
  });
});