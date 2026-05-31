import type { ReactNode } from "react";
import Select from "../Select/Select";
import "./Pagination.css";

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  pageSizeOptions?: number[];
  summary: ReactNode;
  toPageLabel: ReactNode;
  pageUnitLabel: ReactNode;
  perPageLabel: ReactNode;
  perPageUnitLabel: ReactNode;
  prevPageAriaLabel: string;
  nextPageAriaLabel: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export default function Pagination({
  currentPage,
  totalPages,
  pageSize,
  pageSizeOptions = [10, 20, 30, 50, 100],
  summary,
  toPageLabel,
  pageUnitLabel,
  perPageLabel,
  perPageUnitLabel,
  prevPageAriaLabel,
  nextPageAriaLabel,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const pageOptions = Array.from({ length: totalPages }, (_, i) => i + 1);
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  return (
    <div className="table-footer">
      <div className="pagination-info">
        <span>{summary}</span>
      </div>
      <div className="pagination-controls">
        <button
          type="button"
          className="page-link"
          aria-label={prevPageAriaLabel}
          disabled={!canGoPrev}
          onClick={() => {
            if (canGoPrev) onPageChange(currentPage - 1);
          }}
        >
          <i className="fa-solid fa-chevron-left" />
        </button>
        <span>{toPageLabel} </span>
        <Select
          className="form-select-sm"
          value={currentPage}
          onChange={(e) => onPageChange(Number(e.target.value))}
        >
          {pageOptions.map((page) => (
            <option key={page} value={page}>
              {page}
            </option>
          ))}
        </Select>
        <span> {pageUnitLabel}</span>
        <button
          type="button"
          className="page-link"
          aria-label={nextPageAriaLabel}
          disabled={!canGoNext}
          onClick={() => {
            if (canGoNext) onPageChange(currentPage + 1);
          }}
        >
          <i className="fa-solid fa-chevron-right" />
        </button>
      </div>
      <div className="page-size">
        <span>{perPageLabel} </span>
        <Select
          className="form-select-sm"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>
        <span> {perPageUnitLabel}</span>
      </div>
    </div>
  );
}
