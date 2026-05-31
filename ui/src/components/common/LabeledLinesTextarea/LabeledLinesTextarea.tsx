import { forwardRef, Fragment, useEffect, type ChangeEvent } from "react";
import Textarea, { type TextareaProps } from "../Textarea/Textarea";
import {
  buildLabeledText,
  isLabeledTextValid,
  parseLabeledValues,
} from "./labeledLines";
import "./LabeledLinesTextarea.css";

export interface LabeledLinesTextareaProps
  extends Omit<TextareaProps, "value" | "onChange" | "defaultValue"> {
  /** 每行行首的固定標籤（依序，一行一個）；使用者無法刪除或修改 */
  labels: string[];
  /** 完整內容（含標籤）；建議以 initLabeledText(labels) 初始化 */
  value?: string;
  /** 內容變動時回傳整個多行字串（已保證每行標籤完整） */
  onChange?: (value: string) => void;
}

/**
 * 單一 textarea、每行行首帶固定標籤的輸入。
 *
 * 標籤就在文字內，但透過「行數鎖定 + 每行需以對應標籤開頭」的對帳邏輯保護：
 * 任何會刪改標籤或增刪行的編輯都會被還原，使用者只能編輯各行標籤後方的值。
 *
 * 行首標籤以次要色（text-secondary）顯示、與使用者輸入值（text-primary）區隔：
 * textarea 文字設為透明、只留游標，底層疊一個相同盒模型的著色層負責呈現顏色。
 * 兩層以 grid 疊在同格自動等高並隨內容增高。
 *
 * 注意：此為單一 textarea 的折衷做法，極端的貼上／輸入法／復原情境下
 * 仍可能短暫不如預期，無法像「框外固定文字」那樣 100% 保證。
 */
const LabeledLinesTextarea = forwardRef<
  HTMLTextAreaElement,
  LabeledLinesTextareaProps
>(function LabeledLinesTextarea(
  { labels, value = "", onChange, className = "", style, ...rest },
  ref,
) {
  // 以標籤為準自我修復，畫面一定帶著完整標籤
  const values = parseLabeledValues(labels, value);
  const display = buildLabeledText(labels, values);

  // 外部值若缺漏標籤（例如初次為空字串），同步回正規化後的內容
  useEffect(() => {
    if (value !== display) {
      onChange?.(display);
    }
  }, [value, display, onChange]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    // 違反結構（刪改標籤、增刪行）直接忽略，受控值會把內容還原
    if (!isLabeledTextValid(labels, next)) return;
    onChange?.(next);
  };

  // className／style 同時套到兩層，確保盒模型與文字度量一致、疊加對齊
  return (
    <div className="labeled-lines">
      <div
        className={`form-textarea labeled-lines__backdrop ${className}`.trim()}
        style={style}
        aria-hidden="true"
      >
        {labels.map((label, i) => (
          <Fragment key={i}>
            {i > 0 && "\n"}
            <span className="labeled-lines__label">{label}</span>
            <span className="labeled-lines__value">{values[i]}</span>
          </Fragment>
        ))}
      </div>
      <Textarea
        ref={ref}
        {...rest}
        className={`labeled-lines__input ${className}`.trim()}
        style={style}
        value={display}
        onChange={handleChange}
      />
    </div>
  );
});

LabeledLinesTextarea.displayName = "LabeledLinesTextarea";

export default LabeledLinesTextarea;
