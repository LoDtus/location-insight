import { Expose } from 'class-transformer';
import { IsArray, IsString } from 'class-validator';

export class DeleteResDto {
  @Expose()
  @IsArray()
  @IsString({ each: true })
  requestedIds!: string[];

  @Expose()
  @IsArray()
  @IsString({ each: true })
  deletedIds!: string[];

  @Expose()
  @IsArray()
  @IsString({ each: true })
  notDeletedIds!: string[];
}
