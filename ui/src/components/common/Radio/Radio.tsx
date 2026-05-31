import React, { forwardRef } from "react";
import "./Radio.css";

export interface RadioProps extends React.ComponentProps<"input"> {
  /** 裸輸入模式：不套用 form-radio 包裝與 dot，適合自訂樣式 radio */
  bare?: boolean;
  label?: React.ReactNode;
  containerClassName?: string;
}

const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ className = "", bare, label, containerClassName = "ds-inline-check-row", ...props }, ref) => {
    if (bare) {
      return (
        <input
          ref={ref}
          type="radio"
          className={className}
          {...props}
        />
      );
    }

    const inputElement = (
      <span className="form-radio-wrap">
        <input
          ref={ref}
          type="radio"
          className={["form-radio", className].filter(Boolean).join(" ")}
          {...props}
        />
        <span aria-hidden="true" className="form-radio-dot" />
      </span>
    );

    if (label) {
      return (
        <label className={containerClassName}>
          {inputElement} {label}
        </label>
      );
    }

    return inputElement;
  }
);

Radio.displayName = "Radio";

export default Radio;
