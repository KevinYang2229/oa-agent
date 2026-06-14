import { useEffect, useRef, useState, type ChangeEvent } from "react";

/** 檔案分類（決定縮圖圖示） */
export type FileKind = "pdf" | "excel" | "word" | "image" | "other";

/** 已成功上傳、可持久化的附件 metadata（對外 onChange 的單位） */
export interface CommittedFile {
  id: string;
  name: string;
  mime?: string;
  size?: number;
  description?: string;
}

/** 上傳成功後，後端回傳的識別資料 */
export interface UploadResult {
  id: string;
  mime?: string;
  size?: number;
}

/** 元件內部的工作項（含上傳中／失敗等暫態，不會對外 emit） */
export interface UploaderItem extends CommittedFile {
  kind: FileKind;
  /** 影像新上傳時的本地預覽 URL（object URL） */
  previewUrl?: string;
  status: "uploading" | "done" | "error";
  error?: string;
}

interface UseFileUploaderOptions {
  /** 初始（已上傳）清單；用來 seed 內部狀態，並於重新掛載時還原 */
  initialFiles?: CommittedFile[];
  /** 已成功上傳的清單變更時通知（新增完成／刪除／改說明）；不含上傳中與失敗項 */
  onChange?: (files: CommittedFile[]) => void;
  /** 真正把檔案送到後端，回傳伺服器識別資料 */
  onUpload: (file: File) => Promise<UploadResult>;
  /** 從後端刪除一個附件 */
  onDelete?: (id: string) => Promise<void>;
  /** 單檔上限（MB） */
  maxFileSizeMB?: number;
  /** 附件數量上限 */
  maxFiles?: number;
  /** 驗證／上傳／刪除失敗時的訊息回呼 */
  onError?: (message: string, ctx: { fileName?: string }) => void;
}

/** 由 MIME／檔名推斷檔案分類 */
export function getFileKind(name: string, mime = ""): FileKind {
  const n = name.toLowerCase();
  const m = mime.toLowerCase();
  if (m === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (/sheet|excel/.test(m) || /\.(xls|xlsx)$/.test(n)) return "excel";
  if (/word|document/.test(m) || /\.(doc|docx)$/.test(n)) return "word";
  if (m.startsWith("image/") || /\.(jpe?g|png|gif|webp)$/.test(n)) return "image";
  return "other";
}

function toCommitted(item: UploaderItem): CommittedFile {
  return {
    id: item.id,
    name: item.name,
    mime: item.mime,
    size: item.size,
    description: item.description,
  };
}

function seedItems(files: CommittedFile[]): UploaderItem[] {
  return files.map((f) => ({
    ...f,
    kind: getFileKind(f.name, f.mime),
    status: "done" as const,
  }));
}

let tempSeq = 0;
const nextTempId = (): string => `tmp-${Date.now()}-${++tempSeq}`;

/**
 * 檔案上傳 hook：封裝選檔／拖放、逐檔非同步上傳、刪除、說明編輯與預覽。
 *
 * 設計：內部以 items 維護工作集（含上傳中／失敗暫態），只把「已完成」清單
 * 透過 onChange 對外 emit；故表單可持有 metadata 為唯一真實來源，元件負責暫態。
 */
export function useFileUploader(options: UseFileUploaderOptions) {
  const { initialFiles = [], onChange, onUpload, onDelete, maxFileSizeMB, maxFiles, onError } =
    options;

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploaderItem[]>(() => seedItems(initialFiles));

  // 對外 emit：只在「已完成」清單實際變動時呼叫一次 onChange（JSON 比對去重，避免迴圈）
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastEmit = useRef<string>(JSON.stringify(initialFiles.map((f) => ({ ...f }))));
  useEffect(() => {
    const committed = items.filter((i) => i.status === "done").map(toCommitted);
    const key = JSON.stringify(committed);
    if (key !== lastEmit.current) {
      lastEmit.current = key;
      onChangeRef.current?.(committed);
    }
  }, [items]);

  // 卸載時釋放所有本地預覽 URL
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(
    () => () => {
      itemsRef.current.forEach((i) => i.previewUrl && URL.revokeObjectURL(i.previewUrl));
    },
    [],
  );

  const patch = (id: string, next: Partial<UploaderItem>): void =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...next } : i)));

  /** 統一新增檔案：逐檔驗證 → 樂觀加入「上傳中」項 → 非同步上傳 → 完成／失敗回填 */
  const addFiles = (fileList: FileList | File[]): void => {
    const picked = Array.from(fileList ?? []);
    if (picked.length === 0) return;

    let count = itemsRef.current.length;
    for (const file of picked) {
      if (maxFiles && count >= maxFiles) {
        onError?.(`最多只能上傳 ${maxFiles} 個附件`, {});
        break;
      }
      if (maxFileSizeMB && file.size > maxFileSizeMB * 1024 * 1024) {
        onError?.(`檔案超過上限 ${maxFileSizeMB}MB`, { fileName: file.name });
        continue;
      }
      count += 1;

      const tempId = nextTempId();
      const kind = getFileKind(file.name, file.type);
      const previewUrl = kind === "image" ? URL.createObjectURL(file) : undefined;
      const working: UploaderItem = {
        id: tempId,
        name: file.name,
        mime: file.type,
        size: file.size,
        kind,
        previewUrl,
        status: "uploading",
      };
      setItems((prev) => [...prev, working]);

      onUpload(file)
        .then((res) =>
          patch(tempId, {
            id: res.id,
            mime: res.mime ?? file.type,
            size: res.size ?? file.size,
            status: "done",
          }),
        )
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : "上傳失敗";
          patch(tempId, { status: "error", error: message });
          onError?.(message, { fileName: file.name });
        });
    }
  };

  const handleOpenFilePicker = (): void => uploadInputRef.current?.click();

  const handleUploadFiles = (event: ChangeEvent<HTMLInputElement>): void => {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = "";
  };

  /** 移除一個項目：已上傳完成者先打後端刪除，再從清單移除並釋放預覽 URL */
  const handleRemove = async (id: string): Promise<void> => {
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item) return;
    if (item.status === "done" && onDelete) {
      try {
        await onDelete(item.id);
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "刪除失敗", { fileName: item.name });
        return;
      }
    }
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  /** 更新某項目的附件說明 */
  const updateDescription = (id: string, description: string): void =>
    patch(id, { description });

  const previewImage = (url?: string): void => {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return {
    uploadInputRef,
    items,
    hasFiles: items.length > 0,
    handleOpenFilePicker,
    handleUploadFiles,
    addFiles,
    handleRemove,
    updateDescription,
    previewImage,
  };
}
