import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  MAP_CATS_PATTERN,
  MAP_MAX_SUGGESTIONS,
  MAP_PLACE_KINDS,
  type MapPlaceKind,
  MAP_RADIUS_RANGE,
  MAP_REF_ID_MAX,
  MAP_REF_ID_PATTERN,
  MAP_SCOPE_PATTERN,
  MAP_TEXT_MAX,
  ROUTE_AVOID,
  ROUTE_VEHICLES,
  VN_BOUNDS,
} from '../map.constants.js';

const [MIN_LNG, MIN_LAT, MAX_LNG, MAX_LAT] = VN_BOUNDS;

function toBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return value;
}

export class SearchQueryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(MAP_TEXT_MAX)
  text: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(MIN_LAT)
  @Max(MAX_LAT)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(MIN_LNG)
  @Max(MAX_LNG)
  lng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAP_MAX_SUGGESTIONS)
  limit?: number;

  @IsOptional()
  @Matches(MAP_CATS_PATTERN, { message: 'cats không hợp lệ.' })
  cats?: string;

  @IsOptional()
  @Matches(MAP_SCOPE_PATTERN, { message: 'scope không hợp lệ.' })
  scope?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999999999)
  cityId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999999999)
  distId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999999999)
  wardId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MAP_RADIUS_RANGE.min)
  @Max(MAP_RADIUS_RANGE.max)
  radius?: number;
}

export class ResolveQueryDto {
  @IsString()
  @MaxLength(MAP_REF_ID_MAX)
  @Matches(MAP_REF_ID_PATTERN, { message: 'refId không hợp lệ.' })
  refId: string;
}

export class ReverseQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(MIN_LAT)
  @Max(MAX_LAT)
  lat: number;

  @Type(() => Number)
  @IsNumber()
  @Min(MIN_LNG)
  @Max(MAX_LNG)
  lng: number;
}

export class RouteQueryDto {
  @IsString()
  @MaxLength(40)
  from: string;

  @IsString()
  @MaxLength(40)
  to: string;

  @IsOptional()
  @IsIn(ROUTE_VEHICLES)
  vehicle?: (typeof ROUTE_VEHICLES)[number];

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  alternatives?: boolean;

  @IsOptional()
  @IsIn(ROUTE_AVOID)
  avoid?: (typeof ROUTE_AVOID)[number];

  @IsOptional()
  @IsString()
  @MaxLength(30)
  time?: string;
}

/** Tọa độ của một địa điểm trong thân yêu cầu. */
class PlacePointDto {
  @Type(() => Number)
  @IsNumber()
  @Min(MIN_LAT)
  @Max(MAX_LAT)
  lat: number;

  @Type(() => Number)
  @IsNumber()
  @Min(MIN_LNG)
  @Max(MAX_LNG)
  lng: number;
}

export class SavePlaceDto extends PlacePointDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsIn(MAP_PLACE_KINDS)
  kind?: MapPlaceKind;
}

export class CriterionOverrideDto extends PlacePointDto {
  @IsOptional()
  @IsBoolean()
  skipped?: boolean;

  /** null = bỏ điểm tự đặt, quay về điểm tự động. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(10)
  score?: number | null;
}

export class CriterionResetQueryDto extends PlacePointDto {}

export class EvaluationQueryDto extends PlacePointDto {}
