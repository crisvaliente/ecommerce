import React from "react";

type SharedProps = {
  className?: string;
};

type InputProps = React.InputHTMLAttributes<HTMLInputElement> &
  SharedProps & {
    as?: "input";
  };

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> &
  SharedProps & {
    as: "select";
  };

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> &
  SharedProps & {
    as: "textarea";
  };

type Props = InputProps | SelectProps | TextareaProps;

const baseClasses =
  "w-full rounded-md border border-dark/15 bg-surface px-3 py-2 text-sm text-text shadow-sm outline-none transition duration-150 placeholder:text-muted/90 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:shadow-soft disabled:cursor-not-allowed disabled:opacity-60";

const Input = React.forwardRef<
  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  Props
>(function Input(props, ref) {
  const { className = "", as = "input", ...rest } = props as Props & {
    as: "input" | "select" | "textarea";
  };

  if (as === "select") {
    return (
      <select
        ref={ref as React.ForwardedRef<HTMLSelectElement>}
        className={`${baseClasses} ${className}`.trim()}
        {...(rest as React.SelectHTMLAttributes<HTMLSelectElement>)}
      />
    );
  }

  if (as === "textarea") {
    return (
      <textarea
        ref={ref as React.ForwardedRef<HTMLTextAreaElement>}
        className={`${baseClasses} ${className}`.trim()}
        {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
      />
    );
  }

  return (
    <input
      ref={ref as React.ForwardedRef<HTMLInputElement>}
      className={`${baseClasses} ${className}`.trim()}
      {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
    />
  );
});

export default Input;
