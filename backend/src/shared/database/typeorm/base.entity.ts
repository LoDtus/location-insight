import { Exclude, Expose } from 'class-transformer';
import {
  BeforeInsert,
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { IsoDate } from '../../../common/decorators/iso-date.decorator.js';

export abstract class AppBaseEntity {
  @Expose()
  @PrimaryColumn('uuid')
  id: string;

  @Expose()
  @IsoDate()
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @Expose()
  @IsoDate()
  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @Exclude()
  @DeleteDateColumn({
    type: 'timestamptz',
    name: 'deleted_at',
    nullable: true,
  })
  deletedAt: Date | null;

  @BeforeInsert()
  setId(): void {
    if (!this.id) {
      this.id = uuidv7();
    }
  }
}
