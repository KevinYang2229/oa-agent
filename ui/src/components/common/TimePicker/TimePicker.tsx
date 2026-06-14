import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import "./TimePicker.css";

/** TimePicker 元件 Props */
export interface TimePickerProps {
  /** 選中時間，格式 HH:mm（可搭配 react-hook-form） */
  value?: string;
  /** 時間變更回呼，回傳 HH:mm 格式 */
  onChange?: (timeStr: string) => void;
  /** 觸發按鈕佔位符文字，預設「選擇時間」 */
  placeholder?: string;
  /** 自訂 className */
  className?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否顯示錯誤狀態 */
  error?: boolean;
  /** 分鐘間隔，預設 5（off-step 的既有值仍會顯示） */
  minuteStep?: number;
}

const DROPDOWN_WIDTH = 208;
const DROPDOWN_MARGIN = 12;
const DROPDOWN_HEIGHT = 320;

/** 解析 HH:mm 字串為時/分；無效回 null。 */
function parseHm(v?: string): { h: number; m: number } | null {
  if (!v) return null;
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(v.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

const pad = (n: number): string => String(n).padStart(2, "0");

function ClockIcon() {
  return (
    <svg
      aria-hidden="true"
      className="time-picker-icon"
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 7.75V12l3 1.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

/**
 * 自訂時間選擇器：時 / 分兩欄可捲動選取，風格對齊 DatePicker。
 * 可直接受控或搭配 react-hook-form 整合。
 *
 * @example
 * ```tsx
 * const [time, setTime] = useState("");
 * <TimePicker value={time} onChange={setTime} />
 * ```
 */
export default function TimePicker({
  value,
  onChange,
  placeholder,
  className = "",
  disabled = false,
  error = false,
  minuteStep = 5,
}: TimePickerProps) {
  const { t } = useTranslation();
  const effectivePlaceholder = placeholder ?? t("timePicker.selectTime");
  const parsed = parseHm(value);
  const selHour = parsed?.h ?? null;
  const selMinute = parsed?.m ?? null;

  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const hourListRef = useRef<HTMLDivElement>(null);
  const minuteListRef = useRef<HTMLDivElement>(null);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = (() => {
    const step = minuteStep > 0 ? minuteStep : 5;
    const arr: number[] = [];
    for (let m = 0; m < 60; m += step) arr.push(m);
    // 既有值若不在間隔上，仍補入清單以便顯示/選取
    if (selMinute != null && !arr.includes(selMinute)) {
      arr.push(selMinute);
      arr.sort((a, b) => a - b);
    }
    return arr;
  })();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // 開啟時把目前選取的時/分捲到欄位中央（在欄位容器內捲動，不影響整頁）
  useEffect(() => {
    if (!isOpen) return;
    const center = (list: HTMLDivElement | null) => {
      const active = list?.querySelector<HTMLElement>(".tp-active");
      if (list && active) {
        list.scrollTop = active.offsetTop - list.clientHeight / 2 + active.clientHeight / 2;
      }
    };
    requestAnimationFrame(() => {
      center(hourListRef.current);
      center(minuteListRef.current);
    });
  }, [isOpen]);

  /** 依觸發按鈕位置計算下拉面板座標（fixed 定位，避開視窗邊界）。 */
  const computeDropdownStyle = (): React.CSSProperties | null => {
    if (!wrapperRef.current) return null;
    const rect = wrapperRef.current.getBoundingClientRect();
    const gap = DROPDOWN_MARGIN;
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const goUp = spaceBelow < DROPDOWN_HEIGHT && spaceAbove > spaceBelow;
    const width = Math.min(DROPDOWN_WIDTH, window.innerWidth - DROPDOWN_MARGIN * 2);
    const maxLeft = window.innerWidth - width - DROPDOWN_MARGIN;
    const left = Math.min(Math.max(rect.left, DROPDOWN_MARGIN), Math.max(maxLeft, DROPDOWN_MARGIN));

    const style: React.CSSProperties = { position: "fixed", left, width };
    if (goUp) {
      style.bottom = window.innerHeight - rect.top + gap;
      style.top = "auto";
    } else {
      style.top = rect.bottom + gap;
    }
    return style;
  };

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      const style = computeDropdownStyle();
      if (style) setDropdownStyle(style);
    }
    setIsOpen((prev) => !prev);
  };

  const emit = (h: number, m: number) => onChange?.(`${pad(h)}:${pad(m)}`);
  /** 選時：分未選時預設 00，立即產生有效時間 */
  const handlePickHour = (h: number) => emit(h, selMinute ?? 0);
  /** 選分：時未選時預設 00 */
  const handlePickMinute = (m: number) => emit(selHour ?? 0, m);
  /** 帶入目前時間 */
  const handleNow = () => {
    const now = new Date();
    emit(now.getHours(), now.getMinutes());
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className={["time-picker-wrapper", className].filter(Boolean).join(" ")}>
      {/* 觸發按鈕 */}
      <button
        type="button"
        className={["time-picker-trigger-btn", error ? "time-picker-trigger-btn--error" : ""]
          .filter(Boolean)
          .join(" ")}
        onClick={handleToggle}
        disabled={disabled}
        aria-invalid={error}
      >
        <ClockIcon />
        <span
          className={["picker-display-text", !parsed ? "time-picker-placeholder" : ""]
            .filter(Boolean)
            .join(" ")}
        >
          {parsed ? `${pad(parsed.h)} : ${pad(parsed.m)}` : effectivePlaceholder}
        </span>
      </button>

      {/* 下拉面板（透過 Portal 渲染至 body，脫離表單 stacking context） */}
      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="time-picker-dropdown active"
            style={dropdownStyle}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="tp-columns">
              <div className="tp-col">
                <div className="tp-col-head">{t("timePicker.hour")}</div>
                <div className="tp-col-list" ref={hourListRef}>
                  {hours.map((h) => (
                    <div
                      key={h}
                      className={["tp-cell", h === selHour ? "tp-active" : ""]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => handlePickHour(h)}
                    >
                      {pad(h)}
                    </div>
                  ))}
                </div>
              </div>
              <div className="tp-col">
                <div className="tp-col-head">{t("timePicker.minute")}</div>
                <div className="tp-col-list" ref={minuteListRef}>
                  {minutes.map((m) => (
                    <div
                      key={m}
                      className={["tp-cell", m === selMinute ? "tp-active" : ""]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => handlePickMinute(m)}
                    >
                      {pad(m)}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="tp-footer">
              <button type="button" className="tp-now-btn" onClick={handleNow}>
                {t("timePicker.now")}
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
