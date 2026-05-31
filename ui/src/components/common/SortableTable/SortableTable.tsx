import { useEffect, useState, type ReactNode } from "react";
import "./SortableTable.css";

export interface SortableTableColumn<T> {
  key: string;
  header: ReactNode;
  width?: string;
  cellClassName?: string;
  render: (row: T, index: number) => ReactNode;
}

interface SortableTableProps<T extends { id: string }> {
  items: T[];
  columns: SortableTableColumn<T>[];
  /** 排序變動時觸發，回傳新順序 */
  onReorder?: (next: T[]) => void;
  /** 受控模式：由外部維護順序，搭配 onReorder 使用 */
  controlled?: boolean;
  /** 點擊整列觸發 */
  onRowClick?: (row: T) => void;
  /** 取得列的 className */
  rowClassName?: (row: T) => string | undefined;
  /** 無資料時顯示文字 */
  emptyText?: ReactNode;
}

/**
 * 可拖曳排序表格元件
 * 預設左側顯示拖曳把手欄，整列可拖曳；放置時插入到目標列前方
 */
export function SortableTable<T extends { id: string }>({
  items,
  columns,
  onReorder,
  controlled = false,
  onRowClick,
  rowClassName,
  emptyText = "尚無資料",
}: SortableTableProps<T>) {
  const [internalItems, setInternalItems] = useState<T[]>(items);
  useEffect(() => {
    if (!controlled) setInternalItems(items);
  }, [items, controlled]);

  const displayItems = controlled ? items : internalItems;

  const [dragSrcId, setDragSrcId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const reorder = (srcId: string, targetId: string) => {
    if (srcId === targetId) return;
    const base = controlled ? items : internalItems;
    const next = [...base];
    const srcIdx = next.findIndex((it) => it.id === srcId);
    if (srcIdx === -1) return;
    const [moved] = next.splice(srcIdx, 1);
    const tgtIdx = next.findIndex((it) => it.id === targetId);
    if (tgtIdx === -1) return;
    next.splice(tgtIdx, 0, moved);
    if (!controlled) setInternalItems(next);
    onReorder?.(next);
  };

  const colSpan = columns.length + 1;

  return (
    <div className="table-container">
      <table className="hy-table sortable-table">
        <thead>
          <tr>
            <th style={{ width: "36px" }} aria-label="拖曳排序" />
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
          {displayItems.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="sortable-table-empty-cell">
                {emptyText}
              </td>
            </tr>
          ) : (
            displayItems.map((row, index) => {
              const extra = rowClassName?.(row) ?? "";
              const cls = [
                extra,
                onRowClick ? "sortable-table-row--clickable" : "",
                dragSrcId === row.id ? "sortable-table-row--dragging" : "",
                dragOverId === row.id && dragSrcId !== row.id
                  ? "sortable-table-row--drop-target"
                  : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <tr
                  key={row.id}
                  className={cls}
                  draggable
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onDragStart={(e) => {
                    setDragSrcId(row.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", row.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverId !== row.id) setDragOverId(row.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverId === row.id) setDragOverId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragSrcId) reorder(dragSrcId, row.id);
                    setDragSrcId(null);
                    setDragOverId(null);
                  }}
                  onDragEnd={() => {
                    setDragSrcId(null);
                    setDragOverId(null);
                  }}
                >
                  <td
                    className="sortable-table-drag-handle"
                    onClick={(e) => e.stopPropagation()}
                    aria-label="拖曳列"
                  >
                    <i className="fa-solid fa-grip-vertical" />
                  </td>
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
    </div>
  );
}
