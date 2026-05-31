import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import Button from "../Button/Button";
import Input from "../Input/Input";
import Pagination from "../Pagination/Pagination";
import Select from "../Select/Select";
import "./DataListTable.css";

/** 欄位設定 */
export interface DataListColumn<T> {
  key: string;
  header: ReactNode;
  width?: string;
  /** 此欄是否可作為排序欄；點擊 header 切換升降冪 */
  sortable?: boolean;
  /** 自訂排序比較器；未提供時對該欄 render 結果套用 String localeCompare（適用日期字串、英文字串） */
  sortComparator?: (a: T, b: T) => number;
  /** 套用於 <th> 的額外 className */
  headerClassName?: string;
  /** 套用於該欄資料儲存格的額外 className */
  cellClassName?: string;
  /** 欄位渲染函式 */
  render: (row: T) => ReactNode;
}

/** 單一篩選欄位設定 */
export type DataListFilterField =
  | {
      type: "input";
      id?: string;
      label: ReactNode;
      placeholder?: string;
      value: string;
      onChange: (next: string) => void;
      inputClassName?: string;
    }
  | {
      type: "select";
      id?: string;
      label: ReactNode;
      value: string;
      onChange: (next: string) => void;
      options: { label: ReactNode; value: string }[];
    };

/** 點選整列導向設定 */
export interface DataListRowLink {
  to: string;
  search?: Record<string, unknown>;
}

interface DataListTableProps<T extends { id: string }> {
  items: T[];
  columns: DataListColumn<T>[];
  /** 篩選列欄位設定；空陣列或 undefined 時不顯示篩選列 */
  filters?: DataListFilterField[];
  /** 點擊「查詢」按鈕觸發；篩選欄位的 value 由外部維護，本元件僅統一觸發查詢 */
  onSearch?: () => void;
  /** 查詢按鈕文字 */
  searchButtonText?: ReactNode;
  /** 預設排序：key 對應 columns 的 key */
  defaultSort?: { key: string; desc: boolean };
  /** 排序狀態改變時觸發（受控可選） */
  onSortChange?: (sort: { key: string; desc: boolean } | null) => void;
  /** 分頁設定；不傳則不分頁 */
  pagination?: {
    pageSize?: number;
    defaultPage?: number;
    pageSizeOptions?: number[];
  };
  /** 無資料文字 */
  emptyText?: ReactNode;
  /** 取得列的 className */
  getRowClassName?: (row: T) => string | undefined;
  /** 給定後整列可點擊導向 */
  getRowLink?: (row: T) => DataListRowLink | undefined;
  /** 列點擊事件（與 getRowLink 擇一） */
  onRowClick?: (row: T) => void;
  /** 表格上方額外工具列（批次操作等） */
  toolbar?: ReactNode;
  /** 套用於外層 wrapper 的額外 className */
  className?: string;
  /** 套用於 <table> 的額外 className */
  tableClassName?: string;
  /** Pagination summary 文字模板取值 */
  paginationLabels?: {
    summary?: (info: { count: number; pages: number }) => ReactNode;
    toPage?: ReactNode;
    pageUnit?: ReactNode;
    perPage?: ReactNode;
    perPageUnit?: ReactNode;
    prevPageAriaLabel?: string;
    nextPageAriaLabel?: string;
  };
}

const DEFAULT_PAGE_SIZE = 30;

/**
 * 泛用列表資料表元件
 * 提供「篩選列 + 可排序表頭 + 表格主體 + 分頁列」整合，
 * 適用 task / 公告 / 外出登記 等多種列表頁。
 */
export function DataListTable<T extends { id: string }>({
  items,
  columns,
  filters,
  onSearch,
  searchButtonText = "查詢",
  defaultSort,
  onSortChange,
  pagination,
  emptyText = "尚無資料",
  getRowClassName,
  getRowLink,
  onRowClick,
  toolbar,
  className,
  tableClassName,
  paginationLabels,
}: DataListTableProps<T>) {
  const navigate = useNavigate();
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(
    defaultSort ?? null,
  );

  const enablePagination = pagination !== undefined;
  const initialPageSize = pagination?.pageSize ?? DEFAULT_PAGE_SIZE;
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [currentPage, setCurrentPage] = useState(pagination?.defaultPage ?? 1);

  /** 套用排序後的清單 */
  const sortedItems = useMemo(() => {
    if (!sort) return items;
    const col = columns.find((c) => c.key === sort.key);
    if (!col || !col.sortable) return items;
    const next = [...items];
    if (col.sortComparator) {
      next.sort(col.sortComparator);
    } else {
      next.sort((a, b) => {
        const av = String(col.render(a) ?? "");
        const bv = String(col.render(b) ?? "");
        return av.localeCompare(bv);
      });
    }
    return sort.desc ? next.reverse() : next;
  }, [items, sort, columns]);

  const totalPages = enablePagination
    ? Math.max(1, Math.ceil(sortedItems.length / pageSize))
    : 1;

  useEffect(() => {
    if (enablePagination && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [enablePagination, currentPage, totalPages]);

  const pagedItems = useMemo(() => {
    if (!enablePagination) return sortedItems;
    return sortedItems.slice(
      (currentPage - 1) * pageSize,
      currentPage * pageSize,
    );
  }, [sortedItems, enablePagination, currentPage, pageSize]);

  const toggleSort = (key: string) => {
    setSort((prev) => {
      const next: { key: string; desc: boolean } | null =
        prev?.key === key ? { key, desc: !prev.desc } : { key, desc: true };
      onSortChange?.(next);
      return next;
    });
  };

  const wrapperCls = ["data-list-table", className].filter(Boolean).join(" ");
  const tableCls = ["hy-table", tableClassName].filter(Boolean).join(" ");

  return (
    <div className={wrapperCls}>
      {filters && filters.length > 0 && (
        <div className="filter-bar">
          {filters.map((f, idx) => (
            <div
              key={f.id ?? idx}
              className="filter-item data-list-table-filter-item"
            >
              <label htmlFor={f.id}>{f.label}</label>
              {f.type === "input" ? (
                <Input
                  id={f.id}
                  type="text"
                  className={f.inputClassName ?? "data-list-table-keyword-input"}
                  placeholder={f.placeholder}
                  value={f.value}
                  onChange={(e) => f.onChange(e.target.value)}
                />
              ) : (
                <Select
                  id={f.id}
                  value={f.value}
                  onChange={(e) => f.onChange(e.target.value)}
                >
                  {f.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          ))}
          {onSearch && (
            <Button
              type="button"
              variant="new"
              className="data-list-table-search-btn"
              onClick={onSearch}
            >
              {searchButtonText}
            </Button>
          )}
        </div>
      )}

      {toolbar}

      <div className="table-container">
        <table className={tableCls}>
          <thead>
            <tr>
              {columns.map((col) => {
                const isActiveSort = sort?.key === col.key;
                const thCls = [
                  col.headerClassName,
                  col.sortable ? "data-list-table-th--sortable" : "",
                  col.sortable && isActiveSort ? "active" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <th
                    key={col.key}
                    style={col.width ? { width: col.width } : undefined}
                    className={thCls || undefined}
                    onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                  >
                    {col.header}
                    {col.sortable && (
                      <>
                        {" "}
                        <i
                          className={`fa-solid ${
                            isActiveSort && !sort?.desc
                              ? "fa-caret-up"
                              : "fa-caret-down"
                          }`}
                        />
                      </>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pagedItems.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="data-list-table-empty-cell"
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              pagedItems.map((row) => {
                const link = getRowLink?.(row);
                const extra = getRowClassName?.(row) ?? "";
                const cls = [
                  extra,
                  link || onRowClick ? "data-list-table-row--link" : "",
                ]
                  .filter(Boolean)
                  .join(" ");
                const handleClick = () => {
                  if (onRowClick) {
                    onRowClick(row);
                    return;
                  }
                  if (link) {
                    navigate({
                      to: link.to,
                      search: link.search,
                    } as Parameters<typeof navigate>[0]);
                  }
                };
                return (
                  <tr
                    key={row.id}
                    className={cls || undefined}
                    onClick={link || onRowClick ? handleClick : undefined}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={col.cellClassName}>
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {enablePagination && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          pageSizeOptions={pagination?.pageSizeOptions}
          summary={
            paginationLabels?.summary?.({
              count: sortedItems.length,
              pages: totalPages,
            }) ?? `共 ${totalPages} 頁，${sortedItems.length} 筆資料`
          }
          toPageLabel={paginationLabels?.toPage ?? "到第"}
          pageUnitLabel={paginationLabels?.pageUnit ?? "頁"}
          perPageLabel={paginationLabels?.perPage ?? "每頁顯示"}
          perPageUnitLabel={paginationLabels?.perPageUnit ?? "筆"}
          prevPageAriaLabel={paginationLabels?.prevPageAriaLabel ?? "上一頁"}
          nextPageAriaLabel={paginationLabels?.nextPageAriaLabel ?? "下一頁"}
          onPageChange={setCurrentPage}
          onPageSizeChange={(next) => {
            setPageSize(next);
            setCurrentPage(1);
          }}
        />
      )}
    </div>
  );
}
