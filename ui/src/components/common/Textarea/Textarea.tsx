import React, { forwardRef } from "react";
import "./Textarea.css";

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  error?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className = "", error, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={["form-textarea", error && "form-textarea--error", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";

export default Textarea;
