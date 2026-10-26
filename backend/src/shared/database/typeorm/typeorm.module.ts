import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';

export const typeOrmConfig = (config: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: config.getOrThrow<string>('DATABASE_HOST'),
  port: Number(config.getOrThrow<string>('DATABASE_PORT')),
  username: config.getOrThrow<string>('DATABASE_USER'),
  password: config.getOrThrow<string>('DATABASE_PASSWORD'),
  database: config.getOrThrow<string>('DATABASE_NAME'),
  autoLoadEntities: true,
  synchronize: config.get<string>('TYPEORM_SYNCHRONIZE') === 'true',
  logging: config.get<string>('TYPEORM_LOGGING') === 'true',
  retryAttempts: 10,
  retryDelay: 3000,
});

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: typeOrmConfig,
    }),
  ],
})
export class TypeOrmDatabaseModule {}
