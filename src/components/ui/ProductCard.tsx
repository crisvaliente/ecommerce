import React from "react";
import Link from "next/link";
import Button from "./Button";
import Card from "./Card";

type ProductCardAction =
  | {
      label: string;
      onClick: () => void;
      disabled?: boolean;
    }
  | {
      label: string;
      href: string;
      disabled?: boolean;
    };

type ProductCardProps = {
  nombre: string;
  descripcion?: string | null;
  precio: number;
  stockLabel: string;
  disponible: boolean;
  canBuy?: boolean;
  imageUrl?: string | null;
  imageAlt?: string;
  helperText?: string | null;
  action: ProductCardAction;
  className?: string;
};

const ProductCard: React.FC<ProductCardProps> = ({
  nombre,
  descripcion,
  precio,
  stockLabel,
  disponible,
  canBuy = true,
  imageUrl,
  imageAlt,
  helperText,
  action,
  className = "",
}) => {
  const availabilityLabel = canBuy ? (disponible ? "En stock" : "Sin stock") : "No disponible";

  return (
    <Card
      className={`group overflow-hidden rounded-[28px] border-stone-200 bg-surface p-0 transition hover:-translate-y-0.5 hover:shadow-md ${className}`.trim()}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-[#e7e2d3]">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={imageAlt ?? nombre}
            className="h-full w-full object-cover object-center transition duration-500 ease-out group-hover:scale-[1.03] group-hover:brightness-[1.03]"
          />
        ) : (
          <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[linear-gradient(180deg,rgba(13,13,14,0.02),rgba(13,13,14,0.08))]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(227,11,19,0.12),transparent_34%)]" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(13,13,14,0.06))]" />
            <div className="relative flex flex-col items-center text-center">
              <span className="font-raleway text-4xl font-black uppercase tracking-[0.28em] text-dark/90">
                RAEYZ
              </span>
              <span className="mt-2 text-[10px] uppercase tracking-[0.34em] text-dark/45">
                Producto destacado
              </span>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-[linear-gradient(180deg,transparent,rgba(13,13,14,0.2))]" />

        <div className="absolute left-4 top-4">
          <span
            className={
              "inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] shadow-sm backdrop-blur-sm " +
              (canBuy && disponible
                ? "border-white/18 bg-black/62 text-white"
                : "border-stone-500/20 bg-[#f5f1e8]/92 text-stone-800")
            }
          >
            {canBuy ? (disponible ? "Disponible" : "Sin stock") : "No disponible"}
          </span>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="space-y-3">
          <h2 className="font-raleway text-lg font-semibold leading-6 text-text sm:text-xl">
            {nombre}
          </h2>

          <p className="text-2xl font-black leading-none text-dark sm:text-[1.9rem]">
            {precio.toLocaleString("es-UY", {
              style: "currency",
              currency: "UYU",
            })}
          </p>

          {descripcion && (
            <p className="line-clamp-2 text-sm leading-6 text-muted">{descripcion}</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
          <span className="text-muted">Estado</span>
          <span className={"font-semibold " + (canBuy && disponible ? "text-emerald-700" : "text-rose-700")}>
            {availabilityLabel}
          </span>
        </div>

        <div className="space-y-3">
          {"href" in action ? (
            <Link href={action.href} className="block">
              <Button as="span" variant="primary" className="w-full rounded-full">
                {action.label}
              </Button>
            </Link>
          ) : (
            <Button
              variant="secondary"
              onClick={action.onClick}
              disabled={action.disabled}
              className="w-full rounded-full text-sm font-semibold"
            >
              {action.label}
            </Button>
          )}

          {helperText && <p className="text-xs leading-5 text-muted">{helperText}</p>}
        </div>
      </div>
    </Card>
  );
};

export default ProductCard;
