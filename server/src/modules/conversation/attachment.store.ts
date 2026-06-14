/**
 * 附件儲存區（MVP）：記憶體 Map，保管上傳檔案的「二進位內容」。
 *
 * 設計取捨：
 * - 表單值（session.values.attachments）只存輕量 metadata（id/name/mime/size），會隨
 *   conversation.store 持久化到磁碟 JSON；檔案 bytes 不該進那份 JSON，故獨立放這裡。
 * - 純記憶體：dev 重啟會清空（與真實 OA 串接時改為磁碟／S3／物件儲存只換這層即可）。
 * - 以 sessionId 分群，方便對話取消／送出後一次清掉該對話的所有暫存附件。
 */
import { randomUUID } from 'node:crypto';
import type { Attachment } from '@oa-agent/shared';

export type { Attachment };

/** 儲存區內單一附件（metadata + 內容） */
interface StoredAttachment extends Attachment {
  sessionId: string;
  buffer: Buffer;
}

const files = new Map<string, StoredAttachment>();

export const attachmentStore = {
  /** 存入一個檔案，回傳對外的 metadata（不含 buffer） */
  save(
    sessionId: string,
    input: { name: string; mime: string; buffer: Buffer },
  ): Attachment {
    const id = randomUUID();
    const stored: StoredAttachment = {
      id,
      sessionId,
      name: input.name,
      mime: input.mime,
      size: input.buffer.length,
      buffer: input.buffer,
    };
    files.set(id, stored);
    return toMeta(stored);
  },

  /** 取單一附件（含內容）；不存在或不屬於該對話則回 undefined */
  get(sessionId: string, id: string): StoredAttachment | undefined {
    const item = files.get(id);
    if (!item || item.sessionId !== sessionId) return undefined;
    return item;
  },

  /** 刪除單一附件；回傳是否刪除成功（存在且屬於該對話） */
  remove(sessionId: string, id: string): boolean {
    const item = files.get(id);
    if (!item || item.sessionId !== sessionId) return false;
    return files.delete(id);
  },

  /** 清掉某對話的所有暫存附件（取消／送出後呼叫，避免記憶體累積） */
  clearSession(sessionId: string): void {
    for (const [id, item] of files) {
      if (item.sessionId === sessionId) files.delete(id);
    }
  },
};

function toMeta(item: StoredAttachment): Attachment {
  return { id: item.id, name: item.name, mime: item.mime, size: item.size };
}
