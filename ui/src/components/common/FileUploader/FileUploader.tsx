import { useState, DragEvent } from "react";
import { useTranslation } from "react-i18next";
import Button from "../Button/Button";
import Input from "../Input/Input";
import {
  useFileUploader,
  type ExistingFileItem,
  type UploadedPreviewFile,
} from "./useFileUploader";
import "./FileUploader.css";

/** FileUploader 元件 Props */
export interface FileUploaderProps {
  /** 初始既有附件 */
  initialFiles?: ExistingFileItem[];
  /** 允許的檔案類型（MIME 或副檔名） */
  accept?: string;
  /** 是否允許多選，預設 true */
  multiple?: boolean;
  /** 區塊標題，預設「附件清單」 */
  title?: string;
  /** 右側格式提示文字，預設「支援 pdf、jpg、png、docx、xlsx」 */
  supportedFormatsText?: string;
  /** 上傳檔案變更回呼 */
  onChange?: (files: UploadedPreviewFile[]) => void;
  /** 單檔最大容量（MB） */
  maxFileSizeMB?: number;
  /** 重置訊號：值變動時清空清單（用於表單「重填」） */
  resetSignal?: number | string;
}

/**
 * 標準檔案上傳元件，包含：
 * - 外層容器（附件清單標題 + 格式提示）
 * - 上傳按鈕區塊
 * - 新上傳的預覽清單
 * - 既有附件清單
 * - 空狀態提示（無檔案時）
 *
 * @example
 * ```tsx
 * <FileUploader
 *   initialFiles={existingAttachments}
 *   accept=".pdf,.xlsx,.jpg,.png"
 * />
 * ```
 */
export default function FileUploader({
  initialFiles = [],
  accept,
  multiple = true,
  title,
  supportedFormatsText,
  onChange,
  maxFileSizeMB,
  resetSignal,
}: FileUploaderProps) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t("fileUploader.defaultTitle");
  const resolvedFormats = supportedFormatsText ?? t("fileUploader.defaultFormats");
  const handleValidationError = (fileName: string, sizeLimitMB: number): void => {
    alert(
      t("fileUploader.fileTooLarge", {
        fileName,
        sizeLimitMB,
      }),
    );
  };

  const {
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
  } = useFileUploader({
    initialFiles,
    onChange,
    maxFileSizeMB,
    onValidationError: handleValidationError,
    resetSignal,
  });

  const [isDragging, setIsDragging] = useState(false);

  /** 處理拖曳進入 */
  const handleDragOver = (e: DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  /** 處理拖曳離開 */
  const handleDragLeave = (e: DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  /** 處理放開檔案 */
  const handleDrop = (e: DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      addFiles(files);
    }
  };

  return (
    <div className="attachment-section">
      {/* 標題列：左側標題 + 右側格式提示 */}
      <div className="attachment-section__header">
        <span className="attachment-section__title">{resolvedTitle}</span>
        <span className="attachment-section__formats">
          {resolvedFormats}
        </span>
      </div>

      {/* 內容容器：有檔案時整塊為拖曳區，並於拖曳中顯示 active 外框 */}
      <div
        className={`attachment-section__body ${hasFiles && isDragging ? "is-drop-active" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* 隱藏的 file input */}
        <input
          type="file"
          ref={uploadInputRef}
          onChange={handleUploadFiles}
          accept={accept}
          multiple={multiple}
          style={{ display: "none" }}
        />

        {/* 空狀態：顯示 dashed 上傳按鈕 */}
        {!hasFiles && (
          <Button
            type="button"
            variant="uploader"
            className={isDragging ? "is-dragging" : ""}
            onClick={handleOpenFilePicker}
          >
            <i className="fa-solid fa-cloud-arrow-up"></i>
            <div className="uploader-copy">
              <span className="uploader-line-main">{t("fileUploader.pickOrDrop")}</span>
              <span className="uploader-line-sub">{t("fileUploader.emptyHint")}</span>
            </div>
          </Button>
        )}

        {/* 附件列表 (包含既有與新上傳) */}
        {hasFiles && (
          <>
            <div className="attachment-add-row">
              <Button
                type="button"
                variant="form-inline"
                onClick={handleOpenFilePicker}
              >
                <i className="fa-solid fa-plus"></i>
                {t("fileUploader.addMore")}
              </Button>
            </div>
            <div className="existing-files-list">
              {[...uploadedFiles, ...existingFiles].map((file) => {
                const isUploaded = "previewUrl" in file;

                return (
                  <div key={file.id} className="existing-file-item">
                    {renderFileThumb(
                      file.type,
                      isUploaded ? (file as UploadedPreviewFile).previewUrl : (file as ExistingFileItem).imageSrc,
                      (file as ExistingFileItem).iconClass,
                      file.name,
                      handlePreviewImage
                    )}
                    <div className="file-info">
                      <div className="file-name-container">
                        <span
                          className="file-name"
                          style={
                            file.type === "image" ? { cursor: "pointer" } : undefined
                          }
                          onClick={() => {
                            const src = isUploaded ? (file as UploadedPreviewFile).previewUrl : (file as ExistingFileItem).imageSrc;
                            if (src) handlePreviewImage(src);
                          }}
                        >
                          {file.name}
                        </span>
                      </div>
                      <span className="file-date">{file.date}</span>
                      <div className="file-description">
                        <Input
                          placeholder={t("fileUploader.descriptionPlaceholder")}
                          value={file.description || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (isUploaded) {
                              updateUploadedFileDescription(file.id, val);
                            } else {
                              updateExistingFileDescription(file.id, val);
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div className="file-actions">
                      <Button
                        type="button"
                        variant="delete"
                        size="sm"
                        onClick={() =>
                          isUploaded
                            ? handleRemoveUploadedFile(file.id)
                            : handleRemoveExistingFile(file.id)
                        }
                        title={t("fileUploader.deleteFile")}
                      >
                        <i className="fa-solid fa-trash"></i>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

/**
 * 根據檔案類型渲染不同的縮圖區塊。
 */
function renderFileThumb(
  type: string,
  url?: string,
  iconClass?: string,
  name?: string,
  onPreview?: (src: string) => void,
) {
  const handleClick = () => {
    if (url && onPreview) onPreview(url);
  };

  if (type === "pdf") {
    return (
      <div className="file-thumb" onClick={handleClick} role="button" tabIndex={0}>
        <i
          className={iconClass ?? "fa-solid fa-file-pdf"}
          style={{ fontSize: "1.5rem", color: "#f44336" }}
        ></i>
        <div className="thumb-overlay">
          <i className="fa-solid fa-download"></i>
        </div>
      </div>
    );
  }

  if (type === "excel") {
    return (
      <div className="file-thumb" onClick={handleClick} role="button" tabIndex={0}>
        <i
          className={iconClass ?? "fa-solid fa-file-excel"}
          style={{ fontSize: "1.5rem", color: "#2e7d32" }}
        ></i>
        <div className="thumb-overlay">
          <i className="fa-solid fa-download"></i>
        </div>
      </div>
    );
  }

  if (type === "image" && url) {
    return (
      <div
        className="file-thumb"
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") handleClick();
        }}
      >
        <img src={url} alt={name} />
        <div className="thumb-overlay">
          <i className="fa-solid fa-magnifying-glass"></i>
        </div>
      </div>
    );
  }

  /* other types */
  return (
    <div className="file-thumb" onClick={handleClick} role="button" tabIndex={0}>
      <i
        className="fa-solid fa-file"
        style={{ fontSize: "1.5rem", color: "var(--text-secondary)" }}
      ></i>
      <div className="thumb-overlay">
        <i className="fa-solid fa-download"></i>
      </div>
    </div>
  );
}
