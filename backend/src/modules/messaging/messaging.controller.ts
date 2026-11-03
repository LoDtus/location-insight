import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { RequirePermission } from '../../common/decorators/access.decorator.js';
import type { RequestWithPrincipal } from '../auth/auth.guard.js';
import {
  CompleteAttachmentDto,
  ConversationSearchQueryDto,
  CreateAttachmentDto,
  CreateConversationDto,
  ListConversationsQueryDto,
  ListMessagesQueryDto,
  MuteDto,
  NicknameDto,
  PinDto,
  PreferencesDto,
  ReactionDto,
  ReadDto,
  RecipientsQueryDto,
  ReportMessageDto,
  SendMessageDto,
  SharedQueryDto,
} from './dto/messaging.dto.js';
import { MessagingAttachmentsService } from './messaging-attachments.service.js';
import { MessagingConversationsService } from './messaging-conversations.service.js';
import { MessagingHistoryService } from './messaging-history.service.js';
import { MessagingMessagesService } from './messaging-messages.service.js';
import { MessagingSafetyService } from './messaging-safety.service.js';
import { MessagingSharedService } from './messaging-shared.service.js';

@Controller('messaging')
export class MessagingController {
  constructor(
    private readonly conversations: MessagingConversationsService,
    private readonly messages: MessagingMessagesService,
    private readonly attachments: MessagingAttachmentsService,
    private readonly safety: MessagingSafetyService,
    private readonly shared: MessagingSharedService,
    private readonly historyService: MessagingHistoryService,
  ) {}

  @RequirePermission('message:read')
  @Get('conversations')
  list(
    @Query() query: ListConversationsQueryDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.conversations.list(this.userId(request), query);
  }

  @RequirePermission('message:write')
  @Post('conversations')
  async open(
    @Body() body: CreateConversationDto,
    @Req() request: RequestWithPrincipal,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { view, created } = await this.conversations.findOrCreate(
      this.userId(request),
      body.userId,
    );
    response.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return view;
  }

  @RequirePermission('message:read')
  @Get('unread-count')
  unread(@Req() request: RequestWithPrincipal) {
    return this.conversations.unreadCount(this.userId(request));
  }

  @RequirePermission('message:write')
  @Get('recipients')
  recipients(
    @Query() query: RecipientsQueryDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.safety.searchRecipients(this.userId(request), query.q);
  }

  @RequirePermission('message:read')
  @Get('conversations/:id')
  detail(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.conversations.get(this.userId(request), id);
  }

  @RequirePermission('message:write')
  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: RequestWithPrincipal,
  ) {
    await this.conversations.deleteForMe(this.userId(request), id);
  }

  @RequirePermission('message:write')
  @Post('conversations/:id/accept')
  @HttpCode(HttpStatus.OK)
  accept(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.conversations.accept(this.userId(request), id);
  }

  @RequirePermission('message:write')
  @Post('conversations/:id/decline')
  @HttpCode(HttpStatus.NO_CONTENT)
  async decline(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: RequestWithPrincipal,
  ) {
    await this.conversations.decline(this.userId(request), id);
  }

  @RequirePermission('message:read')
  @Put('conversations/:id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async read(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReadDto,
    @Req() request: RequestWithPrincipal,
  ) {
    await this.conversations.markRead(this.userId(request), id, body.seq);
  }

  @RequirePermission('message:write')
  @Put('conversations/:id/mute')
  @HttpCode(HttpStatus.NO_CONTENT)
  async mute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: MuteDto,
    @Req() request: RequestWithPrincipal,
  ) {
    await this.conversations.mute(this.userId(request), id, body.until);
  }

  @RequirePermission('message:write')
  @Put('conversations/:id/pin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async pin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: PinDto,
    @Req() request: RequestWithPrincipal,
  ) {
    await this.conversations.pin(this.userId(request), id, body.pinned);
  }

  @RequirePermission('message:write')
  @Put('conversations/:id/nickname')
  async nickname(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: NicknameDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return {
      nickname: await this.conversations.setNickname(
        this.userId(request),
        id,
        body.nickname,
      ),
    };
  }

  @RequirePermission('message:read')
  @Get('conversations/:id/shared')
  sharedContent(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: SharedQueryDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.shared.list(this.userId(request), id, query);
  }

  @RequirePermission('message:read')
  @Get('conversations/:id/search')
  searchInConversation(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ConversationSearchQueryDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.shared.search(this.userId(request), id, query);
  }

  @RequirePermission('message:write')
  @Post('conversations/:id/delete-request')
  requestDeleteHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.historyService.request(this.userId(request), id);
  }

  @RequirePermission('message:write')
  @Delete('conversations/:id/delete-request')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelDeleteHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: RequestWithPrincipal,
  ) {
    await this.historyService.cancel(this.userId(request), id);
  }

  @RequirePermission('message:write')
  @Post('conversations/:id/delete-request/accept')
  @HttpCode(HttpStatus.NO_CONTENT)
  async acceptDeleteHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: RequestWithPrincipal,
  ) {
    await this.historyService.accept(this.userId(request), id);
  }

  @RequirePermission('message:write')
  @Post('conversations/:id/delete-request/decline')
  @HttpCode(HttpStatus.NO_CONTENT)
  async declineDeleteHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: RequestWithPrincipal,
  ) {
    await this.historyService.decline(this.userId(request), id);
  }

  @RequirePermission('message:read')
  @Get('conversations/:id/messages')
  history(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListMessagesQueryDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.messages.list(this.userId(request), id, query);
  }

  @RequirePermission('message:write')
  @Post('conversations/:id/messages')
  async send(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SendMessageDto,
    @Req() request: RequestWithPrincipal,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { message, created } = await this.messages.send(
      this.userId(request),
      id,
      body,
    );
    response.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return message;
  }

  @RequirePermission('message:write')
  @Delete('conversations/:id/messages/:messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unsend(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Req() request: RequestWithPrincipal,
  ) {
    await this.messages.unsend(this.userId(request), id, messageId);
  }

  @RequirePermission('message:write')
  @Put('conversations/:id/messages/:messageId/reaction')
  @HttpCode(HttpStatus.NO_CONTENT)
  async react(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() body: ReactionDto,
    @Req() request: RequestWithPrincipal,
  ) {
    await this.messages.react(this.userId(request), id, messageId, body.emoji);
  }

  @RequirePermission('message:write')
  @Delete('conversations/:id/messages/:messageId/reaction')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unreact(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Req() request: RequestWithPrincipal,
  ) {
    await this.messages.unreact(this.userId(request), id, messageId);
  }

  @RequirePermission('message:write')
  @Post('conversations/:id/messages/:messageId/report')
  async report(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() body: ReportMessageDto,
    @Req() request: RequestWithPrincipal,
  ) {
    await this.safety.report(this.userId(request), id, messageId, body);
    return { reported: true };
  }

  @RequirePermission('message:write')
  @Post('attachments')
  prepareAttachment(
    @Body() body: CreateAttachmentDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.attachments.prepare(this.userId(request), body);
  }

  @RequirePermission('message:write')
  @Post('attachments/:id/complete')
  @HttpCode(HttpStatus.OK)
  completeAttachment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CompleteAttachmentDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.attachments.complete(this.userId(request), id, body);
  }

  @RequirePermission('message:read')
  @Get('preferences')
  preferences(@Req() request: RequestWithPrincipal) {
    return this.safety.getPreferences(this.userId(request));
  }

  @RequirePermission('message:write')
  @Patch('preferences')
  updatePreferences(
    @Body() body: PreferencesDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.safety.updatePreferences(this.userId(request), body);
  }

  @RequirePermission('message:read')
  @Get('blocks')
  blocks(@Req() request: RequestWithPrincipal) {
    return this.safety.listBlocks(this.userId(request));
  }

  @RequirePermission('message:write')
  @Put('blocks/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async block(
    @Param('userId', ParseUUIDPipe) target: string,
    @Req() request: RequestWithPrincipal,
  ) {
    await this.safety.block(this.userId(request), target);
  }

  @RequirePermission('message:write')
  @Delete('blocks/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unblock(
    @Param('userId', ParseUUIDPipe) target: string,
    @Req() request: RequestWithPrincipal,
  ) {
    await this.safety.unblock(this.userId(request), target);
  }

  private userId(request: RequestWithPrincipal): string {
    return request.principal?.userId as string;
  }
}
