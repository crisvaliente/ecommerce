import {
  resolveStorefrontTenant,
  type DirectHostRequest,
  type TenantDomainLookup,
} from "./storefrontTenant.ts";

const BUCKET_PRODUCTO_IMAGENES = "producto-imagenes";

type ProductoRow = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  estado: "draft" | "published";
  stock: number | null;
};

type StockResumenRow = { producto_id: string; stock_total: number; usa_variantes: boolean };
type ProductoVarianteRow = { id: string; producto_id: string; talle: string; stock: number };
export type ImagenProductoRow = {
  producto_id: string;
  path: string | null;
  url_imagen: string | null;
  es_principal?: boolean | null;
  creado_en?: string | null;
};

export type ProductoStorefront = {
  producto_id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  stock_efectivo: number;
  usa_variantes: boolean;
  variantes: Array<{ variante_id: string; talle: string; stock: number }>;
  imagen_url: string | null;
};

type StorefrontClient = Pick<
  typeof import("./supabaseServer").supabaseServer,
  "from" | "storage"
>;

type ServerContext = {
  req: DirectHostRequest;
  res: { statusCode: number; setHeader(name: string, value: string): void };
};

type ServerDependencies = {
  findByHostname: TenantDomainLookup;
  loadCatalog: (empresaId: string) => Promise<ProductoStorefront[]>;
  logLookupFailure: (hostname: string) => void;
};

export function resolveStorefrontImageObjectPath(
  empresaId: string,
  scopedProductIds: ReadonlySet<string>,
  row: ImagenProductoRow,
): string | null {
  if (!scopedProductIds.has(row.producto_id)) return null;

  const pathPresent = row.path !== null;
  const legacyPresent = row.url_imagen !== null;
  if (pathPresent && legacyPresent && row.path !== row.url_imagen) return null;

  const candidate = pathPresent ? row.path : row.url_imagen;
  if (!candidate) return null;

  const allowedPrefix = `empresa/${empresaId}/producto/${row.producto_id}/`;
  if (!candidate.startsWith(allowedPrefix)) return null;

  const filename = candidate.slice(allowedPrefix.length);
  if (!filename || filename === "." || filename === ".." || /[\\/?#\x00-\x1f\x7f]/.test(filename)) {
    return null;
  }
  return candidate;
}

export async function loadStorefrontCatalog(
  empresaId: string,
  client: StorefrontClient,
): Promise<ProductoStorefront[]> {
  const { data: productosData, error: productosError } = await client
    .from("producto")
    .select("id, nombre, descripcion, precio, estado, stock")
    .eq("empresa_id", empresaId)
    .eq("estado", "published")
    .order("nombre", { ascending: true })
    .returns<ProductoRow[]>();

  if (productosError) throw new Error("product_read_failed");

  const productos = productosData ?? [];
  const productoIds = productos.map((producto) => producto.id);
  const scopedProductIds = new Set(productoIds);

  const { data: resumenData } = await client
    .from("producto_stock_resumen")
    .select("producto_id, stock_total, usa_variantes")
    .eq("empresa_id", empresaId)
    .returns<StockResumenRow[]>();
  const resumenMap = new Map<string, StockResumenRow>(
    (resumenData ?? []).filter((row: StockResumenRow) => scopedProductIds.has(row.producto_id)).map((row: StockResumenRow) => [row.producto_id, row]),
  );

  let variantesData: ProductoVarianteRow[] = [];
  let imagenesData: ImagenProductoRow[] = [];
  if (productoIds.length > 0) {
    const variantesResult = await client
      .from("producto_variante")
      .select("id, producto_id, talle, stock")
      .eq("empresa_id", empresaId)
      .in("producto_id", productoIds)
      .eq("activo", true)
      .order("talle", { ascending: true })
      .returns<ProductoVarianteRow[]>();
    variantesData = variantesResult.data ?? [];

    const imagenesResult = await client
      .from("imagen_producto")
      .select("producto_id, path, url_imagen, es_principal, creado_en")
      .in("producto_id", productoIds)
      .is("deleted_at", null)
      .order("es_principal", { ascending: false })
      .order("creado_en", { ascending: true })
      .returns<ImagenProductoRow[]>();
    imagenesData = imagenesResult.data ?? [];
  }

  const variantesMap = new Map<string, ProductoStorefront["variantes"]>();
  for (const variante of variantesData) {
    if (!scopedProductIds.has(variante.producto_id) || !(variante.stock > 0)) continue;
    const current = variantesMap.get(variante.producto_id) ?? [];
    current.push({ variante_id: variante.id, talle: variante.talle, stock: variante.stock });
    variantesMap.set(variante.producto_id, current);
  }

  const imageMap = new Map<string, string>();
  for (const imagen of imagenesData) {
    if (imageMap.has(imagen.producto_id)) continue;
    const objectPath = resolveStorefrontImageObjectPath(empresaId, scopedProductIds, imagen);
    if (!objectPath) continue;
    try {
      const { data } = await client.storage
        .from(BUCKET_PRODUCTO_IMAGENES)
        .createSignedUrl(objectPath, 60 * 60);
      if (data?.signedUrl) imageMap.set(imagen.producto_id, data.signedUrl);
    } catch {
      // A failed signature omits this image and preserves catalog availability.
    }
  }

  return productos.map((producto: ProductoRow) => {
    const resumen = resumenMap.get(producto.id);
    const variantes = variantesMap.get(producto.id) ?? [];
    const stockBase = typeof producto.stock === "number" ? producto.stock : 0;
    return {
      producto_id: producto.id,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      precio: Number(producto.precio),
      stock_efectivo: resumen?.usa_variantes
        ? variantes.reduce((total, variante) => total + variante.stock, 0)
        : typeof resumen?.stock_total === "number" ? resumen.stock_total : stockBase,
      usa_variantes: resumen?.usa_variantes ?? false,
      variantes,
      imagen_url: imageMap.get(producto.id) ?? null,
    };
  });
}

export async function resolveStorefrontServerSideProps(
  context: ServerContext,
  dependencies: ServerDependencies,
) {
  const resolution = await resolveStorefrontTenant(context.req, dependencies.findByHostname);
  if (resolution.ok === false) {
    if (resolution.reason === "invalid_host" || resolution.reason === "unknown_host") {
      return { notFound: true as const };
    }
    context.res.statusCode = 503;
    context.res.setHeader("Cache-Control", "no-store");
    dependencies.logLookupFailure(resolution.hostname);
    return { props: { empresaId: null, productos: [], error: "storefront_unavailable" as const } };
  }

  try {
    const productos = await dependencies.loadCatalog(resolution.tenant.empresaId);
    return { props: { empresaId: resolution.tenant.empresaId, productos, error: null } };
  } catch {
    return {
      props: {
        empresaId: resolution.tenant.empresaId,
        productos: [],
        error: "product_read_failed" as const,
      },
    };
  }
}
