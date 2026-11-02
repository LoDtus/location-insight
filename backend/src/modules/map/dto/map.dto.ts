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
  MAP_MAX_SUGGESTIONS,
  MAP_REF_ID_MAX,
  MAP_REF_ID_PATTERN,
  MAP_TEXT_MAX,
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
}
