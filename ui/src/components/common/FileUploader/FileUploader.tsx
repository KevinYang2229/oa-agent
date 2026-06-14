import { useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import Button from "../Button/Button";
import Input from "../Input/Input";
import {
  useFileUploader,
  type CommittedFile,
  type FileKind,
  type UploaderItem,
  type UploadResult,
} from "./useFileUploader";
import {
  CloudUploadIcon,
  DownloadIcon,
  FileIcon,
  PlusIcon,
  SearchIcon,
  SpinnerIcon,
  TrashIcon,
  WarningIcon,
} from "./icons";
import "./FileUploader.css";

export type { CommittedFile, UploadResult } from "./useFileUploader";

/** FileUploader 元件 Props */
export interface FileUploaderProps {
  /** 初始（已上傳）附件清單 */
  initialFiles?: CommittedFile[];
  /** 已完成清單變更回呼（新增完成／刪除／改說明） */
  onChange?: (files: CommittedFile[]) => void;
  /** 真正把檔案送到後端，回傳伺服器識別資料 */
  onUpload: (file: File) => Promise<UploadResult>;
  /** 從後端刪除一個附件 */
  onDelete?: (id: string) => Promise<void>;
  /** 允許的檔案類型（傳入 input accept） */
  accept?: string;
  /** 是否允許多選，預設 true */
  multiple?: boolean;
  /** 單檔最大容量（MB） */
  maxFileSizeMB?: number;
  /** 附件數量上限 */
  maxFiles?: number;
  /** 唯讀（如表單送出後）：只列清單、不可增刪改 */
  readOnly?: boolean;
  /** 停用（如表單送出中） */
  disabled?: boolean;
  /** 區塊標題，預設取 i18n fileUploader.defaultTitle */
  title?: string;
  /** 右側格式提示文字，預設取 i18n fileUploader.defaultFormats */
  supportedFormatsText?: string;
  /** 是否顯示內建標題列（標題＋格式提示）；預設 true。
   *  設為 false 時由外層自行提供標籤（如表單以 form-label 呈現，與其他欄位一致） */
  showHeader?: boolean;
}

/** 各分類縮圖的圖示與顏色 */
const KIND_VISUAL: Record<FileKind, { color: string }> = {
  pdf: { color: "#e53935" },
  excel: { color: "#2e7d32" },
  word: { color: "#1565c0" },
  image: { color: "#1e88e5" },
  other: { color: "var(--text-secondary)" },
};

/**
 * 標準檔案上傳元件：選檔／拖放上傳到後端，含預覽縮圖、上傳中／失敗狀態、
 * 附件說明與刪除。透過 onUpload／onDelete 串接後端，onChange 回傳已完成的 metadata。
 */
export default function FileUploader({
  initialFiles = [],
  onChange,
  onUpload,
  onDelete,
  accept,
  multiple = true,
  maxFileSizeMB,
  maxFiles,
  readOnly = false,
  disabled = false,
  title,
  supportedFormatsText,
  showHeader = true,
}: FileUploaderProps) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t("fileUploader.defaultTitle");
  const resolvedFormats = supportedFormatsText ?? t("fileUploader.defaultFormats");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    uploadInputRef,
    items,
    hasFiles,
    handleOpenFilePicker,
    handleUploadFiles,
    addFiles,
    handleRemove,
    updateDescription,
    previewImage,
  } = useFileUploader({
    initialFiles,
    onChange,
    onUpload,
    onDelete,
    maxFileSizeMB,
    maxFiles,
    onError: (message) => setErrorMsg(message),
  });

  const [isDragging, setIsDragging] = useState(false);
  const locked = disabled || readOnly;

  const handleDragOver = (e: DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    if (!locked) setIsDragging(true);
  };
  const handleDragLeave = (e: DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDrop = (e: DragEvent): void => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (locked) return;
    if (e.dataTransfer.files?.length) {
      setErrorMsg(null);
      addFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="attachment-section">
      {showHeader && (
        <div className="attachment-section__header">
          <span className="attachment-section__title">{resolvedTitle}</span>
          <span className="attachment-section__formats">{resolvedFormats}</span>
        </div>
      )}

      <div
        className={`attachment-section__body ${hasFiles && isDragging ? "is-drop-active" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={uploadInputRef}
          onChange={(e) => {
            setErrorMsg(null);
            handleUploadFiles(e);
          }}
          accept={accept}
          multiple={multiple}
          disabled={locked}
          style={{ display: "none" }}
        />

        {/* 標題列隱藏時（由外層提供 label），格式提示改顯示於框內頂部 */}
        {!showHeader && resolvedFormats && (
          <p className="attachment-body-formats">{resolvedFormats}</p>
        )}

        {/* 空狀態：dashed 上傳按鈕（唯讀時改顯示無附件） */}
        {!hasFiles &&
          (readOnly ? (
            <p className="attachment-empty-text">{t("fileUploader.none")}</p>
          ) : (
            <Button
              type="button"
              variant="uploader"
              className={isDragging ? "is-dragging" : ""}
              disabled={locked}
              onClick={handleOpenFilePicker}
            >
              <CloudUploadIcon />
              <div className="uploader-copy">
                <span className="uploader-line-main">{t("fileUploader.pickOrDrop")}</span>
                <span className="uploader-line-sub">{t("fileUploader.emptyHint")}</span>
              </div>
            </Button>
          ))}

        {hasFiles && (
          <>
            {!readOnly && (
              <div className="attachment-add-row">
                <Button
                  type="button"
                  variant="form-inline"
                  disabled={locked}
                  onClick={handleOpenFilePicker}
                >
                  <PlusIcon />
                  {t("fileUploader.addMore")}
                </Button>
              </div>
            )}

            <div className="existing-files-list">
              {items.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  readOnly={readOnly}
                  locked={locked}
                  onPreview={previewImage}
                  onRemove={() => void handleRemove(file.id)}
                  onDescription={(val) => updateDescription(file.id, val)}
                  descriptionPlaceholder={t("fileUploader.descriptionPlaceholder")}
                  deleteLabel={t("fileUploader.deleteFile")}
                  uploadingLabel={t("fileUploader.uploading")}
                  errorLabel={t("fileUploader.uploadError")}
                />
              ))}
            </div>
          </>
        )}

        {errorMsg && <p className="attachment-error">{errorMsg}</p>}
      </div>
    </div>
  );
}

interface FileRowProps {
  file: UploaderItem;
  readOnly: boolean;
  locked: boolean;
  onPreview: (url?: string) => void;
  onRemove: () => void;
  onDescription: (value: string) => void;
  descriptionPlaceholder: string;
  deleteLabel: string;
  uploadingLabel: string;
  errorLabel: string;
}

/** 單列附件：縮圖 + 檔名/狀態/說明 + 刪除 */
function FileRow({
  file,
  readOnly,
  locked,
  onPreview,
  onRemove,
  onDescription,
  descriptionPlaceholder,
  deleteLabel,
  uploadingLabel,
  errorLabel,
}: FileRowProps) {
  const isImage = file.kind === "image" && file.previewUrl;
  const visual = KIND_VISUAL[file.kind];

  return (
    <div className={`existing-file-item ${file.status === "error" ? "is-error" : ""}`}>
      <div
        className="file-thumb"
        role={isImage ? "button" : undefined}
        tabIndex={isImage ? 0 : undefined}
        onClick={() => isImage && onPreview(file.previewUrl)}
        onKeyDown={(e) => {
          if (isImage && (e.key === "Enter" || e.key === " ")) onPreview(file.previewUrl);
        }}
      >
        {isImage ? (
          <>
            <img src={file.previewUrl} alt={file.name} />
            <div className="thumb-overlay">
              <SearchIcon />
            </div>
          </>
        ) : (
          <>
            <FileIcon color={visual.color} />
            <div className="thumb-overlay">
              <DownloadIcon />
            </div>
          </>
        )}
      </div>

      <div className="file-info">
        <div className="file-name-container">
          <span className="file-name">{file.name}</span>
        </div>

        {file.status === "uploading" && (
          <span className="file-status">
            <SpinnerIcon /> {uploadingLabel}
          </span>
        )}
        {file.status === "error" && (
          <span className="file-status file-status--error">
            <WarningIcon /> {file.error ?? errorLabel}
          </span>
        )}

        {!readOnly && file.status === "done" && (
          <div className="file-description">
            <Input
              placeholder={descriptionPlaceholder}
              value={file.description ?? ""}
              disabled={locked}
              onChange={(e) => onDescription(e.target.value)}
            />
          </div>
        )}
        {readOnly && file.description && (
          <span className="file-date">{file.description}</span>
        )}
      </div>

      {!readOnly && (
        <div className="file-actions">
          <Button
            type="button"
            variant="delete"
            size="sm"
            disabled={locked}
            onClick={onRemove}
            title={deleteLabel}
          >
            <TrashIcon />
          </Button>
        </div>
      )}
    </div>
  );
}
