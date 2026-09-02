type TenantLookupResult = {
  data: { id: string } | null;
  error: unknown;
};

type FindTenantBySlug = (slug: string) => Promise<TenantLookupResult>;

export type CanonicalStorefrontTenantResult = {
  empresaId: string | null;
  error: "storefront_tenant_not_found" | null;
};

export async function resolveCanonicalStorefrontEmpresaId(
  canonicalSlug: string,
  findTenantBySlug: FindTenantBySlug,
): Promise<CanonicalStorefrontTenantResult> {
  const { data, error } = await findTenantBySlug(canonicalSlug);

  if (error || !data?.id) {
    return {
      empresaId: null,
      error: "storefront_tenant_not_found",
    };
  }

  return {
    empresaId: data.id,
    error: null,
  };
}
