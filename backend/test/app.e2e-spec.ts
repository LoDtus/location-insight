import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('GET / wraps the payload and stamps a UTC timestamp', async () => {
    const response = await request(app.getHttpServer()).get('/').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.status).toBe(200);
    expect(response.body.data).toBe('Hello World!');
    expect(response.body.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  afterEach(async () => {
    await app.close();
  });
});
