import { useEffect, useRef, type ReactNode } from "react";
import "./InfiniteScrollTable.css";

export interface InfiniteScrollTableColumn<T> {
  key: string;
  header: ReactNode;
  width?: string;
  cellClassName?: string;
  render: (row: T, index: number) => ReactNode;
}

interface InfiniteScrollTableProps<T extends { id: string | number }> {
  items: T[];
  columns: InfiniteScrollTableColumn<T>[];
  /** 滑到底部時觸發；由外部負責載入下一批資料 */
  onLoadMore: () => void;
  /** 是否還有更多資料；false 時不再觸發 onLoadMore，並顯示結束文字 */
  hasMore: boolean;
  /** 是否正在載入中；為 true 時顯示載入指示且不重複觸發 onLoadMore */
  loading?: boolean;
  /** 捲動容器最大高度（CSS 值），預設 480px */
  maxHeight?: string;
  /** 觸發載入下一批的捲動緩衝距離（px），預設 80 */
  threshold?: number;
  /** 載入中顯示文字 */
  loadingText?: ReactNode;
  /** 已載入完所有資料時顯示文字 */
  endText?: ReactNode;
  /** 還有更多資料且未在載入中時的提示文字 */
  hasMoreText?: ReactNode;
  /** 無資料時顯示文字 */
  emptyText?: ReactNode;
  /** 列點擊事件 */
  onRowClick?: (row: T) => void;
  /** 取得列的 className */
  rowClassName?: (row: T) => string | undefined;
}

/**
 * 無限捲動資料表元件
 * 以 IntersectionObserver 觀察底部 sentinel；進入視窗時呼叫 onLoadMore
 */
export function InfiniteScrollTable<T extends { id: string | number }>({
  items,
  columns,
  onLoadMore,
  hasMore,
  loading = false,
  maxHeight = "480px",
  threshold = 80,
  loadingText = "載入中…",
  endText = "已載入全部資料",
  hasMoreText = "向下捲動以載入更多",
  emptyText = "尚無資料",
  onRowClick,
  rowClassName,
}: InfiniteScrollTableProps<T>) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !loading) {
          onLoadMore();
        }
      },
      {
        root,
        rootMargin: `0px 0px ${threshold}px 0px`,
        threshold: 0,
      },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore, loading, threshold]);

  const colSpan = columns.length;

  return (
    <div
      ref={scrollRef}
      className="infinite-scroll-table-container table-container"
      style={{ maxHeight }}
    >
      <table className="hy-table infinite-scroll-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && !loading ? (
            <tr>
              <td colSpan={colSpan} className="infinite-scroll-table-empty">
                {emptyText}
              </td>
            </tr>
          ) : (
            items.map((row, index) => {
              const extra = rowClassName?.(row) ?? "";
              const cls = [
                extra,
                onRowClick ? "infinite-scroll-table-row--clickable" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <tr
                  key={row.id}
                  className={cls}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={col.cellClassName}>
                      {col.render(row, index)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      <div ref={sentinelRef} aria-hidden="true" style={{ height: "1px" }} />

      <div className="infinite-scroll-table-footer" role="status" aria-live="polite">
        {loading ? (
          <span className="infinite-scroll-table-loading">
            <i className="fa-solid fa-spinner fa-spin" />
            {loadingText}
          </span>
        ) : !hasMore && items.length > 0 ? (
          <span className="infinite-scroll-table-end">{endText}</span>
        ) : hasMore && items.length > 0 ? (
          <span className="infinite-scroll-table-hint">
            <i className="fa-solid fa-chevron-down" />
            {hasMoreText}
          </span>
        ) : null}
      </div>
    </div>
  );
}
