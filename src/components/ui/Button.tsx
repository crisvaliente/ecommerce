import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  as?: "button" | "span";
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-text-inverse shadow-strong hover:-translate-y-px hover:bg-[#b80810] active:translate-y-0 active:bg-[#8f060d] focus-visible:ring-primary/35",
  secondary:
    "border border-dark/12 bg-dark text-text-inverse shadow-soft hover:border-primary/45 hover:bg-black active:bg-[#1a1a1c] focus-visible:ring-primary/20",
  ghost:
    "bg-transparent text-text hover:bg-dark/6 active:bg-dark/10 focus-visible:ring-primary/20",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", className = "", type = "button", as = "button", ...props },
  ref
) {
  const baseClasses =
    "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium tracking-[0.01em] transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-45";

  const composedClassName = `${baseClasses} ${variantClasses[variant]} ${className}`.trim();

  if (as === "span") {
    return <span className={composedClassName}>{props.children}</span>;
  }

  return (
    <button
      ref={ref}
      type={type}
      className={composedClassName}
      {...props}
    />
  );
});

export default Button;
