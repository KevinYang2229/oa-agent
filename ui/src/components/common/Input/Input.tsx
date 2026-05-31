import React, { forwardRef } from "react";
import "./Input.css";

export interface InputProps extends React.ComponentProps<"input"> {
  /** 裸輸入模式：不套用 form-input、不包錯誤訊息容器，適合 Header 搜尋等客製化輸入 */
  bare?: boolean;
  /** 是否顯示錯誤狀態（紅框） */
  error?: boolean;
  /** 錯誤訊息文字；提供時自動套用錯誤狀態並於下方顯示訊息 */
  errorMessage?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", bare, error, errorMessage, ...props }, ref) => {
    const hasError = error || !!errorMessage;

    if (bare) {
      return <input ref={ref} className={className} {...props} />;
    }

    const inputEl = (
      <input
        ref={ref}
        className={["form-input", hasError && "form-input--error", className]
          .filter(Boolean)
          .join(" ")}
        {...props}
      />
    );

    if (!errorMessage) {
      return inputEl;
    }

    return (
      <span className="form-input-field">
        {inputEl}
        <span className="form-error-text form-input-error-message">
          <i className="fa-solid fa-circle-exclamation" />
          {errorMessage}
        </span>
      </span>
    );
  },
);

Input.displayName = "Input";

export default Input;
