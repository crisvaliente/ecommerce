import React from "react";

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  muted?: boolean;
};

const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className = "", muted = false, ...props },
  ref
) {
  const tone = muted
    ? "bg-surface/85"
    : "bg-surface";

  return (
    <div
      ref={ref}
      className={`rounded-lg border border-dark/10 ${tone} shadow-soft ring-1 ring-black/[0.02] ${className}`.trim()}
      {...props}
    />
  );
});

export default Card;
