import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBusinessDto {
  @IsString() @MaxLength(200) name!: string;
  @IsString() @MaxLength(100) category!: string;
  @IsString() @MaxLength(100) city!: string;
  @IsString() @MaxLength(50) state!: string;
  @IsOptional() @IsString() website?: string;
}
