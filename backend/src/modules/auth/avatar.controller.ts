import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  StreamableFile,
} from '@nestjs/common';
import { Public } from '../../common/decorators/access.decorator.js';
import { ProfileService } from './profile.service.js';

@Controller('media/avatars')
export class AvatarController {
  constructor(private readonly profiles: ProfileService) {}

  @Public()
  @Get(':userId/:fileId')
  @Header('Content-Type', 'image/webp')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  async read(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
  ): Promise<StreamableFile> {
    const bytes = await this.profiles.readAvatar(userId, fileId);
    return new StreamableFile(bytes);
  }
}
