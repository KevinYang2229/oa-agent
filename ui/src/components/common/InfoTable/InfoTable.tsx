import type { CSSProperties, ReactNode } from "react";

export type InfoTableVariant =
  | "card"
  | "card-scroll"
  | "card-shadow"
  | "plain";

interface InfoTableProps {
  /** 第一欄（標籤欄）寬度（px）；未設定時由 CSS `.col-label` 提供預設（220px） */
  labelWidth?: number;
  /**
   * 外層容器樣式變體：
   * - card：`workflow-table-card`（預設）
   * - card-scroll：`workflow-table-card-scroll`（內容過寬時可水平捲動）
   * - card-shadow：`workflow-table-card-shadow`（含淺陰影）
   * - plain：不套外層樣式（自行包裝）
   */
  variant?: InfoTableVariant;
  /** 自訂外層 className，會接在 variant class 之後 */
  wrapperClassName?: string;
  /** 自訂外層 style */
  wrapperStyle?: CSSProperties;
  /** 套用於 `<table>` 的額外 className */
  tableClassName?: string;
  /** 列內容，請使用 `<InfoTable.Row>` */
  children: ReactNode;
}

const VARIANT_CLASS: Record<InfoTableVariant, string> = {
  card: "workflow-table-card",
  "card-scroll": "workflow-table-card-scroll",
  "card-shadow": "workflow-table-card-shadow",
  plain: "",
};

/**
 * 標籤/內容兩欄資訊表
 * 將表單與預覽頁大量重複的 `<table.hy-table.compact-table>` 樣板抽出
 */
export function InfoTable({
  labelWidth,
  variant = "card",
  wrapperClassName,
  wrapperStyle,
  tableClassName,
  children,
}: InfoTableProps) {
  const wrapperCls = [VARIANT_CLASS[variant], wrapperClassName]
    .filter(Boolean)
    .join(" ");
  const tableCls = ["hy-table", "compact-table", "w-full", "table-fixed", tableClassName]
    .filter(Boolean)
    .join(" ");
  const colStyle =
    labelWidth !== undefined ? { width: `${labelWidth}px` } : undefined;

  return (
    <div className={wrapperCls || undefined} style={wrapperStyle}>
      <table className={tableCls}>
        <colgroup>
          <col className="col-label" style={colStyle} />
          <col />
        </colgroup>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

interface InfoTableRowProps {
  /** 標籤文字 */
  label: ReactNode;
  /** 是否顯示必填星號 */
  required?: boolean;
  /** 標籤垂直對齊方式；top 用於說明、附件等需上對齊的列 */
  labelAlign?: "middle" | "top";
  /** 額外的 label cell className */
  labelClassName?: string;
  /** 額外的 content cell className */
  contentClassName?: string;
  /** 額外的 row className */
  className?: string;
  /** 內容（content cell） */
  children: ReactNode;
}

/** InfoTable 列 */
function InfoTableRow({
  label,
  required,
  labelAlign = "middle",
  labelClassName,
  contentClassName,
  className,
  children,
}: InfoTableRowProps) {
  const labelCls = [
    "label-cell",
    labelAlign === "top" ? "valign-top" : "",
    labelClassName,
  ]
    .filter(Boolean)
    .join(" ");
  const contentCls = ["content-cell", contentClassName].filter(Boolean).join(" ");

  return (
    <tr className={className}>
      <td className={labelCls}>
        {required && <span className="required-star">*</span>}
        {label}
      </td>
      <td className={contentCls}>{children}</td>
    </tr>
  );
}

InfoTable.Row = InfoTableRow;
