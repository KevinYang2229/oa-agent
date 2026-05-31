import { ChangeEvent, useEffect, useRef, useState } from "react";

/** 既有附件項目 */
export interface ExistingFileItem {
  /** 唯一識別 ID */
  id: string;
  /** 檔案類型 */
  type: "pdf" | "excel" | "image";
  /** 檔案名稱 */
  name: string;
  /** 上傳日期 */
  date: string;
  /** PDF 圖示 class（type="pdf" 時使用） */
  iconClass?: string;
  /** 圖片來源（type="image" 時使用） */
  imageSrc?: string;
  /** 附件說明 */
  description?: string;
}

/** 已上傳預覽檔案 */
export interface UploadedPreviewFile {
  /** 唯一識別 ID */
  id: string;
  /** 檔案名稱 */
  name: string;
  /** 檔案類型 */
  type: "pdf" | "excel" | "image" | "other";
  /** 上傳日期/狀態文字 */
  date: string;
  /** 附件說明 */
  description?: string;
  /** 預覽用 Object URL */
  previewUrl: string;
}

/** useFileUploader 設定選項 */
interface UseFileUploaderOptions {
  /** 初始既有附件 */
  initialFiles?: ExistingFileItem[];
  /** 上傳檔案變更回呼 */
  onChange?: (files: UploadedPreviewFile[]) => void;
  /** 單檔最大容量（MB） */
  maxFileSizeMB?: number;
  /** 檔案驗證失敗回呼 */
  onValidationError?: (fileName: string, sizeLimitMB: number) => void;
  /** 重置訊號：值變動時清空已上傳清單並還原既有附件（用於表單重填） */
  resetSignal?: number | string;
}

/**
 * 檔案上傳 hook，封裝所有上傳、預覽、刪除邏輯。
 *
 * @param options - 設定選項
 * @returns 狀態與操作方法
 */
export function useFileUploader(options: UseFileUploaderOptions = {}) {
  const {
    initialFiles = [],
    onChange,
    maxFileSizeMB,
    onValidationError,
    resetSignal,
  } = options;

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [existingFiles, setExistingFiles] =
    useState<ExistingFileItem[]>(initialFiles);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedPreviewFile[]>([]);

  // resetSignal 變動：清空已上傳檔案並還原既有附件，供「重填」清除附件清單使用
  useEffect(() => {
    if (resetSignal === undefined) return;
    setUploadedFiles((current) => {
      current.forEach((file) => URL.revokeObjectURL(file.previewUrl));
      return [];
    });
    setExistingFiles(initialFiles);
    onChange?.([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  /** 是否有任何檔案（既有或新上傳） */
  const hasFiles = existingFiles.length > 0 || uploadedFiles.length > 0;

  /** 開啟檔案選擇器 */
  const handleOpenFilePicker = (): void => {
    uploadInputRef.current?.click();
  };

  /** 統一新增檔案邏輯 */
  const addFiles = (fileList: FileList | File[]): void => {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const validFiles = Array.from(fileList).filter((file) => {
      if (!maxFileSizeMB) {
        return true;
      }

      const maxBytes = maxFileSizeMB * 1024 * 1024;
      const isValid = file.size <= maxBytes;
      if (!isValid) {
        onValidationError?.(file.name, maxFileSizeMB);
      }
      return isValid;
    });

    if (validFiles.length === 0) {
      return;
    }

    const nextFiles = validFiles.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random().toString(16).slice(2)}`,
      name: file.name,
      type: getFileType(file),
      date: getCurrentDateTime(),
      description: "",
      previewUrl: URL.createObjectURL(file),
    }));

    const updated = [...uploadedFiles, ...nextFiles];
    setUploadedFiles(updated);
    onChange?.(updated);
  };

  /** 處理檔案選擇器變更 */
  const handleUploadFiles = (event: ChangeEvent<HTMLInputElement>): void => {
    const fileList = event.target.files;
    if (fileList) {
      addFiles(fileList);
    }
    event.target.value = "";
  };

  /** 移除已上傳的預覽檔案並釋放 URL 資源 */
  const handleRemoveUploadedFile = (fileId: string): void => {
    setUploadedFiles((current) => {
      const target = current.find((item) => item.id === fileId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }

      const updated = current.filter((item) => item.id !== fileId);
      onChange?.(updated);
      return updated;
    });
  };

  /** 移除既有附件項目 */
  const handleRemoveExistingFile = (fileId: string): void => {
    setExistingFiles((current) => current.filter((item) => item.id !== fileId));
  };

  /** 更新上傳檔案說明 */
  const updateUploadedFileDescription = (fileId: string, description: string): void => {
    setUploadedFiles((current) => {
      const updated = current.map((file) =>
        file.id === fileId ? { ...file, description } : file
      );
      onChange?.(updated);
      return updated;
    });
  };

  /** 更新既有檔案說明 */
  const updateExistingFileDescription = (fileId: string, description: string): void => {
    setExistingFiles((current) =>
      current.map((file) =>
        file.id === fileId ? { ...file, description } : file
      )
    );
  };

  /** 以新分頁預覽圖片附件 */
  const handlePreviewImage = (imageSrc: string): void => {
    window.open(imageSrc, "_blank", "noopener,noreferrer");
  };

  return {
    uploadInputRef,
    existingFiles,
    uploadedFiles,
    hasFiles,
    handleOpenFilePicker,
    handleUploadFiles,
    addFiles,
    handleRemoveUploadedFile,
    handleRemoveExistingFile,
    updateUploadedFileDescription,
    updateExistingFileDescription,
    handlePreviewImage,
  };
}

/**
 * 根據 File 物件推斷檔案類型
 *
 * @param file - File 物件
 * @returns 檔案類型字串
 */
function getFileType(
  file: File,
): "pdf" | "excel" | "image" | "other" {
  const name = file.name.toLowerCase();
  const mime = file.type.toLowerCase();

  if (name.endsWith(".pdf") || mime === "application/pdf") {
    return "pdf";
  }

  if (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel"
  ) {
    return "excel";
  }

  if (mime.startsWith("image/")) {
    return "image";
  }

  return "other";
}

/**
 * 取得當前日期時間字串 (格式: YYYY/MM/DD HH:mm)
 */
function getCurrentDateTime(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");

  return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
}
