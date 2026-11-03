import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v7 as uuidv7 } from 'uuid';
import { StorageService } from '../../integrations/storage/storage.service.js';
import { sniffMedia } from '../discussions/discussion-text.js';
import {
  CompleteAttachmentDto,
  CreateAttachmentDto,
} from './dto/messaging.dto.js';
import { MessagingAccessService } from './messaging-access.service.js';
import { invalid, notFound } from './messaging-errors.js';
import {
  attachmentDisposition,
  fileExtension,
  isFileType,
  isImageType,
  sanitizeFileName,
  sniffFile,
} from './messaging-files.js';
import { MessagingRateLimitService } from './messaging-rate-limit.service.js';
import { pixelsOk, pngSize, sendGate } from './messaging-rules.js';
import { MESSAGING_LIMITS } from './messaging.constants.js';
import { MessageAttachmentEntity } from './entities/message-attachment.entity.js';

const IMAGE_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export interface AttachmentFileView {
  id: string;
  kind: 'image' | 'file';
  contentType: string;
  width: number;
  height: number;
  fileName: string | null;
  byteSize: number;
  url: string;
}

/** URL đọc có hạn: ảnh hiển thị trực tiếp, tệp buộc tải xuống với tên đã làm sạch. */
export function readOptionsFor(
  row: Pick<MessageAttachmentEntity, 'kind' | 'fileName' | 'contentType'>,
) {
  if (row.kind !== 'file') return undefined;
  return {
    responseContentType: row.contentType,
    responseContentDisposition: attachmentDisposition(row.fileName ?? 'tep'),
  };
}

@Injectable()
export class MessagingAttachmentsService {
  constructor(
    private readonly access: MessagingAccessService,
    private readonly rate: MessagingRateLimitService,
    private readonly storage: StorageService,
    @InjectRepository(MessageAttachmentEntity)
    private readonly attachments: Repository<MessageAttachmentEntity>,
  ) {}

  async prepare(userId: string, input: CreateAttachmentDto) {
    const isFile = isFileType(input.contentType);
    if (!isFile && !isImageType(input.contentType))
      invalid('Loại tệp này không được hỗ trợ.');
    const limit = isFile
      ? MESSAGING_LIMITS.fileMaxBytes
      : MESSAGING_LIMITS.imageMaxBytes;
    if (input.byteSize > limit) {
      invalid(isFile ? 'Tệp lớn hơn 20 MB.' : 'Ảnh lớn hơn 8 MB.');
    }
    if (isFile && !input.fileName?.trim()) invalid('Thiếu tên tệp.');

    const m = await this.access.membership(userId, input.conversationId);
    await this.access.assertSenderAllowed(userId);
    await this.access.assertPeerReachable(userId, m.peerId);
    const gate = sendGate({
      state: m.conversation.state,
      iAmInitiator: m.conversation.initiatorId === userId,
      lastSeq: m.conversation.lastSeq,
      kind: isFile ? 'file' : 'image',
    });
    if (gate !== 'ok')
      invalid('Chưa gửi được tệp trước khi người này chấp nhận.');
    await this.rate.consume('attach', `user_${userId}`);

    const id = uuidv7();
    const extension = isFile
      ? fileExtension(input.contentType)
      : IMAGE_EXTENSION[input.contentType];
    const objectKey = `messaging/${input.conversationId}/${id}.${extension}`;
    await this.attachments.save(
      this.attachments.create({
        id,
        conversationId: input.conversationId,
        messageSeq: null,
        uploaderId: userId,
        objectKey,
        kind: isFile ? 'file' : 'image',
        contentType: input.contentType,
        fileName: isFile
          ? sanitizeFileName(input.fileName as string, input.contentType)
          : null,
        byteSize: input.byteSize,
        status: 'pending',
      }),
    );
    const uploadUrl = await this.storage.getPresignedPutUrl(
      objectKey,
      input.contentType,
      MESSAGING_LIMITS.uploadTtlSeconds,
    );
    return {
      attachmentId: id,
      uploadUrl,
      expiresAt: new Date(
        Date.now() + MESSAGING_LIMITS.uploadTtlSeconds * 1000,
      ).toISOString(),
    };
  }

  async complete(
    userId: string,
    attachmentId: string,
    input: CompleteAttachmentDto,
  ) {
    const row = await this.attachments.findOne({
      where: { id: attachmentId, uploaderId: userId },
    });
    if (!row) notFound('Không tìm thấy tệp.');
    const found = row as MessageAttachmentEntity;
    if (found.status === 'ready') return this.toView(found);
    if (found.status === 'rejected')
      invalid('Tệp đã bị từ chối.', { code: 'attachment_rejected' });

    const reject = async (): Promise<never> => {
      await this.storage.deleteObject(found.objectKey).catch(() => undefined);
      await this.attachments.update({ id: found.id }, { status: 'rejected' });
      return invalid('Tệp không hợp lệ.', { code: 'attachment_rejected' });
    };

    const isFile = found.kind === 'file';
    const limit = isFile
      ? MESSAGING_LIMITS.fileMaxBytes
      : MESSAGING_LIMITS.imageMaxBytes;
    const size = await this.storage.objectSize(found.objectKey);
    if (!size || size > limit) return reject();
    const head = await this.storage
      .getObjectRange(found.objectKey, isFile ? 512 : 32)
      .catch(() => Buffer.alloc(0));

    if (isFile) {
      if (!sniffFile(head, found.contentType)) return reject();
      found.byteSize = size;
      found.status = 'ready';
      await this.attachments.save(found);
      return this.toView(found);
    }

    if (!sniffMedia(head, found.contentType)) return reject();
    let width = input.width;
    let height = input.height;
    if (found.contentType === 'image/png') {
      const real = pngSize(head);
      if (!real) return reject();
      width = real.width;
      height = real.height;
    }
    if (width === undefined || height === undefined || !pixelsOk(width, height))
      return reject();

    found.byteSize = size;
    found.width = width;
    found.height = height;
    found.status = 'ready';
    await this.attachments.save(found);
    return this.toView(found);
  }

  private async toView(
    row: MessageAttachmentEntity,
  ): Promise<AttachmentFileView> {
    return {
      id: row.id,
      kind: row.kind,
      contentType: row.contentType,
      width: row.width ?? 0,
      height: row.height ?? 0,
      fileName: row.fileName,
      byteSize: row.byteSize,
      url: await this.storage.getPresignedUrl(
        row.objectKey,
        MESSAGING_LIMITS.readUrlTtlSeconds,
        readOptionsFor(row),
      ),
    };
  }
}
