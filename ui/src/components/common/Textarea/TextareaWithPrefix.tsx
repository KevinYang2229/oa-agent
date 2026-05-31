import {
  forwardRef,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Textarea, { type TextareaProps } from "./Textarea";
import "./TextareaWithPrefix.css";

export interface TextareaWithPrefixProps
  extends Omit<TextareaProps, "value" | "onChange" | "defaultValue"> {
  /** 固定、不可編輯也不可刪除的前綴文字（顯示於第一行行首） */
  prefix: string;
  /** 完整內容（含前綴）；傳入時會自動去掉前綴，框內僅顯示可編輯部分 */
  value?: string;
  /** 內容變動時回傳「前綴 + 使用者輸入」的完整字串 */
  onChange?: (fullValue: string) => void;
}

/**
 * 帶固定前綴的多行輸入。
 *
 * 前綴文字以唯讀覆蓋層渲染在第一行行首（不在 textarea 內，無法選取／刪除），
 * textarea 首行以 text-indent 讓游標接在前綴之後；換行後的內容回到行首對齊。
 * 對外的 value／onChange 一律以「前綴 + 可編輯內容」的完整字串進出，
 * 因此可直接搭配 react-hook-form 的 Controller 使用。
 */
const TextareaWithPrefix = forwardRef<
  HTMLTextAreaElement,
  TextareaWithPrefixProps
>(function TextareaWithPrefix(
  { prefix, value = "", onChange, error, className, style, ...rest },
  ref,
) {
  // 框內只顯示前綴之後的可編輯部分
  const editable = value.startsWith(prefix) ? value.slice(prefix.length) : value;

  const prefixRef = useRef<HTMLSpanElement>(null);
  const [indent, setIndent] = useState(0);

  // 量測前綴實際寬度，作為 textarea 首行縮排
  useLayoutEffect(() => {
    if (prefixRef.current) {
      setIndent(prefixRef.current.offsetWidth);
    }
  }, [prefix]);

  const mergedStyle: CSSProperties = { textIndent: `${indent}px`, ...style };

  return (
    <div
      className={[
        "textarea-prefix",
        error && "textarea-prefix--error",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span ref={prefixRef} className="textarea-prefix__fixed" aria-hidden>
        {prefix}
      </span>
      <Textarea
        ref={ref}
        value={editable}
        error={error}
        onChange={(e) => onChange?.(prefix + e.target.value)}
        style={mergedStyle}
        {...rest}
      />
    </div>
  );
});

TextareaWithPrefix.displayName = "TextareaWithPrefix";

export default TextareaWithPrefix;
