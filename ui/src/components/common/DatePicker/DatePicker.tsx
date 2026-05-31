import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import "./DatePicker.css";

/** DatePicker 元件 Props */
export interface DatePickerProps {
  /** 選中日期，格式 YYYY-MM-DD（可搭配 react-hook-form） */
  value?: string;
  /** 日期變更回呼，回傳 YYYY-MM-DD 格式 */
  onChange?: (dateStr: string) => void;
  /** 觸發按鈕佔位符文字，預設「選擇日期」 */
  placeholder?: string;
  /** 自訂 className */
  className?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否顯示錯誤狀態 */
  error?: boolean;
}

/** 日曆視圖模式 */
type View = "days" | "months" | "years";

/** 年份視圖顯示筆數 */
const YEARS_COUNT = 12;
const DROPDOWN_WIDTH = 340;
const DROPDOWN_MARGIN = 12;

/**
 * 將 YYYY-MM-DD 字串解析為本地 Date 物件。
 *
 * @param v - 日期字串
 * @returns Date 物件，無效則回傳 null
 */
function parseYmd(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 格式化 Date 物件為 `YYYY / MM / DD` 顯示字串。
 *
 * @param d - Date 物件
 * @returns 格式化顯示字串
 */
function formatDisplay(d: Date): string {
  return `${d.getFullYear()} / ${String(d.getMonth() + 1).padStart(2, "0")} / ${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 格式化 Date 物件為 `YYYY-MM-DD` 值字串。
 *
 * @param year - 年
 * @param month - 月（0-indexed）
 * @param day - 日
 * @returns YYYY-MM-DD 字串
 */
function formatValue(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      className="date-picker-icon"
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path
        d="M8 2.75v3.5M16 2.75v3.5M4.75 9.25h14.5M6.75 4.75h10.5a2 2 0 0 1 2 2v10.5a2 2 0 0 1-2 2H6.75a2 2 0 0 1-2-2V6.75a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  const path = direction === "left" ? "M15 18 9 12l6-6" : "m9 18 6-6-6-6";

  return (
    <svg
      aria-hidden="true"
      className="date-picker-chevron"
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path
        d={path}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

/**
 * 自訂日期選擇器元件，支援日 / 月 / 年三層導覽，
 * 可直接受控或搭配 react-hook-form 整合。
 *
 * @example
 * ```tsx
 * // 受控用法
 * const [date, setDate] = useState("");
 * <DatePicker value={date} onChange={setDate} />
 *
 * // 搭配 react-hook-form（Controller）
 * <Controller
 *   control={control}
 *   name="startDate"
 *   render={({ field }) => (
 *     <DatePicker value={field.value} onChange={field.onChange} />
 *   )}
 * />
 * ```
 */
export default function DatePicker({
  value,
  onChange,
  placeholder,
  className = "",
  disabled = false,
  error = false,
}: DatePickerProps) {
  const { t } = useTranslation();
  const today = new Date();
  const effectivePlaceholder = placeholder ?? t("datePicker.selectDate");
  const monthNames = Array.from({ length: 12 }, (_, i) =>
    t(`datePicker.months.${i + 1}` as const),
  );
  const weekdayNames = Array.from({ length: 7 }, (_, i) =>
    t(`datePicker.weekdays.${i}` as const),
  );

  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<View>("days");
  const [selectedDate, setSelectedDate] = useState<Date | null>(parseYmd(value));
  const [viewYear, setViewYear] = useState(selectedDate?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate?.getMonth() ?? today.getMonth());
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 同步外部 value 變更
  useEffect(() => {
    const d = parseYmd(value);
    setSelectedDate(d);
    if (d) {
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  // 點擊外部關閉下拉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const outsideWrapper = !wrapperRef.current?.contains(target);
      const outsideDropdown = !dropdownRef.current?.contains(target);
      if (outsideWrapper && outsideDropdown) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 捲動或視窗縮放時，彈窗跟隨觸發按鈕重新定位（不關閉）
  useEffect(() => {
    if (!isOpen) return;
    const reposition = () => {
      const style = computeDropdownStyle();
      if (style) setDropdownStyle(style);
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [isOpen]);

  /**
   * 依據觸發按鈕位置計算下拉面板座標。
   */
  const computeDropdownStyle = (): React.CSSProperties | null => {
    if (!wrapperRef.current) return null;
    const rect = wrapperRef.current.getBoundingClientRect();
    const gap = DROPDOWN_MARGIN;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const dropdownHeight = 420;
    const goUp = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
    const width = Math.min(DROPDOWN_WIDTH, window.innerWidth - DROPDOWN_MARGIN * 2);
    const maxLeft = window.innerWidth - width - DROPDOWN_MARGIN;
    const left = Math.min(Math.max(rect.left, DROPDOWN_MARGIN), Math.max(maxLeft, DROPDOWN_MARGIN));

    const style: React.CSSProperties = { position: "fixed", left, width };

    if (goUp) {
      style.bottom = window.innerHeight - rect.top + gap;
      style.top = "auto";
      if (spaceAbove < dropdownHeight) {
        style.maxHeight = Math.max(spaceAbove, 180);
        style.overflowY = "auto";
      }
    } else {
      style.top = rect.bottom + gap;
      if (spaceBelow < dropdownHeight) {
        style.maxHeight = Math.max(spaceBelow, 180);
        style.overflowY = "auto";
      }
    }
    return style;
  };

  /**
   * 切換下拉開關，並計算 portal 定位座標。
   */
  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      const style = computeDropdownStyle();
      if (style) setDropdownStyle(style);
      setView("days");
    }
    setIsOpen((prev) => !prev);
  };

  /**
   * 選擇指定日期，關閉下拉並觸發 onChange。
   *
   * @param year - 年
   * @param month - 月（0-indexed）
   * @param day - 日
   */
  const handleSelectDay = (year: number, month: number, day: number) => {
    const date = new Date(year, month, day);
    setSelectedDate(date);
    setViewYear(year);
    setViewMonth(month);
    onChange?.(formatValue(year, month, day));
    setIsOpen(false);
  };

  /** 跳至今天並選取。 */
  const handleToday = () => {
    handleSelectDay(today.getFullYear(), today.getMonth(), today.getDate());
  };

  /**
   * 在月份視圖中選取月份，切回日期視圖。
   *
   * @param month - 月（0-indexed）
   */
  const handleSelectMonth = (month: number) => {
    setViewMonth(month);
    setView("days");
  };

  /**
   * 在年份視圖中選取年份，切至月份視圖。
   *
   * @param year - 年
   */
  const handleSelectYear = (year: number) => {
    setViewYear(year);
    setView("months");
  };

  /** 切換標題點擊：日 → 月 → 年 → 日。 */
  const handleHeaderClick = () => {
    setView((v) => (v === "days" ? "months" : v === "months" ? "years" : "days"));
  };

  /** 導覽至上一期（月 / 年 / 年份組）。 */
  const handlePrev = () => {
    if (view === "days") {
      if (viewMonth === 0) {
        setViewMonth(11);
        setViewYear((y) => y - 1);
      } else {
        setViewMonth((m) => m - 1);
      }
    } else if (view === "months") {
      setViewYear((y) => y - 1);
    } else {
      setViewYear((y) => y - YEARS_COUNT);
    }
  };

  /** 導覽至下一期（月 / 年 / 年份組）。 */
  const handleNext = () => {
    if (view === "days") {
      if (viewMonth === 11) {
        setViewMonth(0);
        setViewYear((y) => y + 1);
      } else {
        setViewMonth((m) => m + 1);
      }
    } else if (view === "months") {
      setViewYear((y) => y + 1);
    } else {
      setViewYear((y) => y + YEARS_COUNT);
    }
  };

  // 日期視圖：渲染日格
  const renderDays = () => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
    const cells: React.ReactNode[] = [];

    // 前月補位
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push(
        <div key={`prev-${i}`} className="picker-day outside">
          {daysInPrevMonth - i}
        </div>
      );
    }

    // 本月日格
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday =
        viewYear === today.getFullYear() &&
        viewMonth === today.getMonth() &&
        d === today.getDate();
      const isActive =
        selectedDate !== null &&
        viewYear === selectedDate.getFullYear() &&
        viewMonth === selectedDate.getMonth() &&
        d === selectedDate.getDate();

      cells.push(
        <div
          key={d}
          className={["picker-day", isToday ? "today" : "", isActive ? "active" : ""]
            .filter(Boolean)
            .join(" ")}
          onClick={() => handleSelectDay(viewYear, viewMonth, d)}
        >
          {d}
        </div>
      );
    }

    // 後月補位（補至 42 格）
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      cells.push(
        <div key={`next-${d}`} className="picker-day outside">
          {d}
        </div>
      );
    }

    return cells;
  };

  // 月份視圖：渲染月格
  const renderMonths = () =>
    monthNames.map((name, idx) => {
      const isCurrent = today.getFullYear() === viewYear && today.getMonth() === idx;
      const isActive =
        selectedDate?.getFullYear() === viewYear && selectedDate?.getMonth() === idx;
      return (
        <div
          key={idx}
          className={["picker-month", isCurrent ? "current" : "", isActive ? "active" : ""]
            .filter(Boolean)
            .join(" ")}
          onClick={() => handleSelectMonth(idx)}
        >
          {name}
        </div>
      );
    });

  // 年份視圖：渲染年格
  const renderYears = () => {
    const startYear = Math.floor(viewYear / YEARS_COUNT) * YEARS_COUNT;
    return Array.from({ length: YEARS_COUNT }, (_, i) => {
      const year = startYear + i;
      const isCurrent = today.getFullYear() === year;
      const isActive = selectedDate?.getFullYear() === year;
      return (
        <div
          key={year}
          className={["picker-year", isCurrent ? "current" : "", isActive ? "active" : ""]
            .filter(Boolean)
            .join(" ")}
          onClick={() => handleSelectYear(year)}
        >
          {year}
        </div>
      );
    });
  };

  // 標題文字
  const headerTitle =
    view === "days"
      ? t("datePicker.headerMonth", { year: viewYear, month: monthNames[viewMonth] })
      : view === "months"
        ? t("datePicker.headerYear", { year: viewYear })
        : (() => {
            const startYear = Math.floor(viewYear / YEARS_COUNT) * YEARS_COUNT;
            return `${startYear} – ${startYear + YEARS_COUNT - 1}`;
          })();

  return (
    <div
      ref={wrapperRef}
      className={["date-picker-wrapper", className].filter(Boolean).join(" ")}
    >
      {/* 觸發按鈕 */}
      <button
        type="button"
        className={[
          "date-picker-trigger-btn",
          error ? "date-picker-trigger-btn--error" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={handleToggle}
        disabled={disabled}
        aria-invalid={error}
      >
        <CalendarIcon />
        <span
          className={[
            "picker-display-text",
            !selectedDate ? "date-picker-placeholder" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {selectedDate ? formatDisplay(selectedDate) : effectivePlaceholder}
        </span>
      </button>

      {/* 下拉日曆面板（透過 Portal 渲染至 body，脫離表單 stacking context） */}
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="date-picker-dropdown active"
            style={dropdownStyle}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* 標題與導覽 */}
            <div className="picker-header">
              <button type="button" className="picker-nav-btn prev" onClick={handlePrev}>
                <ChevronIcon direction="left" />
              </button>
              <div className="picker-month-year" onClick={handleHeaderClick}>
                {headerTitle}
              </div>
              <button type="button" className="picker-nav-btn next" onClick={handleNext}>
                <ChevronIcon direction="right" />
              </button>
            </div>

            {/* 星期標題列（日曆視圖） */}
            {view === "days" && (
              <div className="picker-weekdays">
                {weekdayNames.map((d, idx) => (
                  <span key={idx}>{d}</span>
                ))}
              </div>
            )}

            {/* 日期格 */}
            {view === "days" && <div className="picker-days">{renderDays()}</div>}

            {/* 月份格 */}
            {view === "months" && <div className="picker-months">{renderMonths()}</div>}

            {/* 年份格 */}
            {view === "years" && <div className="picker-years">{renderYears()}</div>}

            {/* 底部「今天」按鈕 */}
            <div className="picker-footer">
              <button type="button" className="picker-today-btn" onClick={handleToday}>
                {t("datePicker.today")}
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
