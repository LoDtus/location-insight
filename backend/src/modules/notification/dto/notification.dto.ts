import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class NotificationListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @IsIn(['all', 'unread'])
  filter?: 'all' | 'unread';
}

export class ReadAllDto {
  @IsOptional()
  @IsUUID()
  upToId?: string;
}

export class ReadBatchDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  ids: string[];
}

export class ChannelPrefDto {
  @IsBoolean()
  inApp: boolean;

  @IsBoolean()
  push: boolean;
}

export class PreferenceGroupsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelPrefDto)
  social?: ChannelPrefDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelPrefDto)
  messages?: ChannelPrefDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelPrefDto)
  billing?: ChannelPrefDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelPrefDto)
  moderation?: ChannelPrefDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ChannelPrefDto)
  system?: ChannelPrefDto;
}

export class PreferencesPatchDto {
  @IsOptional()
  @IsBoolean()
  hideContentOnLockScreen?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => PreferenceGroupsDto)
  groups?: PreferenceGroupsDto;
}

export class PushKeysDto {
  @IsString()
  @MaxLength(120)
  p256dh: string;

  @IsString()
  @MaxLength(40)
  auth: string;
}

export class PushSubscribeDto {
  @IsString()
  @MaxLength(1000)
  endpoint: string;

  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;

  @IsUUID()
  deviceId: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;

  @IsOptional()
  @IsBoolean()
  installedPwa?: boolean;

  @IsOptional()
  expirationTime?: number | null;

  @IsOptional()
  @IsString()
  vapidPublicKey?: string;
}

export class PushDevicePatchDto {
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  label?: string;
}

export class SuspendDeviceDto {
  @IsUUID()
  deviceId: string;
}

export class EndpointDto {
  @IsString()
  @MaxLength(1000)
  endpoint: string;
}

export class DeviceQueryDto {
  @IsOptional()
  @IsUUID()
  deviceId?: string;
}
