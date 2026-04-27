import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

const LOCATION_COORDINATES_PATTERN = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class WeatherQueryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(LOCATION_COORDINATES_PATTERN, {
    message: 'location must be in "latitude,longitude" format',
  })
  location!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(ISO_DATE_PATTERN, {
    message: 'start must be in YYYY-MM-DD format',
  })
  start!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Matches(ISO_DATE_PATTERN, {
    message: 'end must be in YYYY-MM-DD format',
  })
  end!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(366)
  pageSize?: number;
}
