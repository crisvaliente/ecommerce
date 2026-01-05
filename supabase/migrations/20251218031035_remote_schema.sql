

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;




ALTER SCHEMA "public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'rol_membresia'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.rol_membresia AS ENUM (
      'owner',
      'admin',
      'empleado',
      'invitado'
    );
  END IF;
END
$$;



ALTER TYPE "public"."rol_membresia" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_producto"("p_producto" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM producto pr
    JOIN empresa e ON e.id = pr.empresa_id
    WHERE pr.id = p_producto AND e.owner_auth = auth.uid()
  );
$$;


ALTER FUNCTION "public"."can_manage_producto"("p_producto" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_personal_org"() RETURNS TABLE("empresa_id" "uuid", "rol" "public"."rol_membresia")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_empresa uuid;
  v_rol_out rol_membresia;
  v_slug text;
  v_uid_exists boolean;
  v_has_owner_auth boolean;
begin
  if v_uid is null then
    raise exception 'Debe estar autenticado';
  end if;

  -- validar que el uid exista en auth.users
  select exists(select 1 from auth.users where id = v_uid) into v_uid_exists;
  if not v_uid_exists then
    raise exception 'El usuario % no existe en auth.users', v_uid;
  end if;

  -- ¿ya tiene membresía?
  select m.empresa_id, m.rol
  into v_empresa, v_rol_out
  from public.membresia m
  where m.usuario_id = v_uid
  limit 1;

  if v_empresa is not null then
    empresa_id := v_empresa; rol := v_rol_out; return next; return;
  end if;

  -- verificar si la tabla empresa tiene columna owner_auth
  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='empresa' and column_name='owner_auth'
  ) into v_has_owner_auth;

  v_slug := 'personal-' || substr(replace(v_uid::text, '-', ''), 1, 8);

  if v_has_owner_auth then
    insert into public.empresa (nombre, slug, created_by, owner_auth)
    values ('Mi empresa', v_slug, v_uid, v_uid)
    returning id into v_empresa;
  else
    insert into public.empresa (nombre, slug, created_by)
    values ('Mi empresa', v_slug, v_uid)
    returning id into v_empresa;
  end if;

  -- crear membresía owner (sin RETURNING para evitar ambigüedad)
  insert into public.membresia (empresa_id, usuario_id, rol)
  values (v_empresa, v_uid, 'owner');

  v_rol_out := 'owner';

  empresa_id := v_empresa;
  rol := v_rol_out;
  return next;
end
$$;


ALTER FUNCTION "public"."ensure_personal_org"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_nombre text;
begin
  v_nombre := coalesce(
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1),
    'Usuario'
  );

  begin
    insert into public.usuario (id, supabase_uid, correo, nombre, rol, fecha_registro)
    values (new.id, new.id, new.email, v_nombre, 'cliente', now());
  exception
    when unique_violation then
      -- Si la violación es por el correo (usuario ya existía con ese email),
      -- lo adoptamos asignando el nuevo id/supabase_uid y refrescamos nombre.
      update public.usuario
         set id = new.id,
             supabase_uid = new.id,
             nombre = coalesce(public.usuario.nombre, v_nombre),
             rol = coalesce(public.usuario.rol, 'cliente')
       where correo = new.email;
  end;

  return new;
end
$$;


ALTER FUNCTION "public"."handle_new_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.usuario (id, correo, nombre, rol, empresa_id, supabase_uid)
  values (
    new.id,                                   -- id del auth.user
    new.email,                                -- correo
    coalesce(new.raw_user_meta_data->>'name', ''),
    'cliente',
    null,
    new.id                                    -- mantenemos también supabase_uid por consistencia
  )
  on conflict (id) do nothing;

  -- log (si creaste event_log)
  insert into public.event_log (event_type, user_id, email, details)
  values (
    'auth_user_created',
    new.id,
    new.email,
    jsonb_build_object('raw_metadata', new.raw_user_meta_data, 'created_auth_at', new.created_at, 'inserted_at', now())
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_empresa_owner"("p_empresa" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM empresa e
    WHERE e.id = p_empresa AND e.owner_auth = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_empresa_owner"("p_empresa" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."owns_carrito"("p_carrito" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM carrito c
    WHERE c.id = p_carrito AND c.usuario_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."owns_carrito"("p_carrito" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."owns_pedido"("p_pedido" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM pedido p
    WHERE p.id = p_pedido AND p.usuario_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."owns_pedido"("p_pedido" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_supabase_uid_from_jwt"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE sub text;
BEGIN
  sub := current_setting('request.jwt.claim.sub', true);
  IF NEW.supabase_uid IS NULL AND sub IS NOT NULL THEN
    NEW.supabase_uid := sub::uuid;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_supabase_uid_from_jwt"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_is_member_of"("p_empresa" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists(
    select 1
    from public.membresia m
    where m.empresa_id = p_empresa
      and m.usuario_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."user_is_member_of"("p_empresa" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."carrito" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "usuario_id" "uuid",
    "creado_en" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."carrito" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."carrito_producto" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "carrito_id" "uuid",
    "producto_id" "uuid",
    "cantidad" integer NOT NULL,
    CONSTRAINT "chk_cp_cantidad_pos" CHECK (("cantidad" > 0))
);


ALTER TABLE "public"."carrito_producto" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categoria" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "nombre" character varying(255) NOT NULL,
    "descripcion" "text",
    "empresa_id" "uuid",
    "slug" "text",
    "orden" integer DEFAULT 0,
    "parent_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."categoria" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comprobante_pago" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "pedido_id" "uuid" NOT NULL,
    "monto" numeric(10,2) NOT NULL,
    "fecha_pago" timestamp without time zone DEFAULT "now"(),
    "metodo_pago" character varying(50),
    "estado_pago" character varying(50) DEFAULT 'Pendiente'::character varying,
    CONSTRAINT "chk_estado_pago" CHECK ((("estado_pago")::"text" = ANY ((ARRAY['Pendiente'::character varying, 'Aprobado'::character varying, 'Rechazado'::character varying, 'Reembolsado'::character varying])::"text"[])))
);


ALTER TABLE "public"."comprobante_pago" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."direccion_usuario" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "direccion" character varying(255) NOT NULL,
    "ciudad" character varying(100) NOT NULL,
    "pais" character varying(100) NOT NULL,
    "codigo_postal" character varying(20),
    "tipo_direccion" character varying(50),
    "fecha_creacion" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "chk_tipo_direccion" CHECK ((("tipo_direccion")::"text" = ANY ((ARRAY['hogar'::character varying, 'trabajo'::character varying, 'otro'::character varying])::"text"[])))
);


ALTER TABLE "public"."direccion_usuario" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."empresa" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "nombre" character varying(255) NOT NULL,
    "descripcion" "text",
    "fecha_creacion" timestamp without time zone DEFAULT "now"(),
    "owner_auth" "uuid",
    "slug" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."empresa" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."envio" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "pedido_id" "uuid" NOT NULL,
    "direccion_envio_id" "uuid",
    "fecha_envio" timestamp without time zone DEFAULT "now"(),
    "estado_envio" character varying(50) DEFAULT 'En preparación'::character varying,
    CONSTRAINT "chk_estado_envio" CHECK ((("estado_envio")::"text" = ANY ((ARRAY['En preparación'::character varying, 'En tránsito'::character varying, 'Entregado'::character varying, 'Cancelado'::character varying])::"text"[])))
);


ALTER TABLE "public"."envio" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_log" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "event_type" "text" NOT NULL,
    "user_id" "uuid",
    "email" "text",
    "details" "jsonb"
);


ALTER TABLE "public"."event_log" OWNER TO "postgres";


DO $$
BEGIN
  -- si la columna ya es IDENTITY, no hacemos nada
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'event_log'
      AND column_name = 'id'
      AND is_identity = 'YES'
  ) THEN
    RETURN;
  END IF;

  -- si el sequence ya existe, no intentamos recrearlo con el mismo nombre
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'S'
      AND c.relname = 'event_log_id_seq'
      AND n.nspname = 'public'
  ) THEN
    RETURN;
  END IF;

  -- caso “nuevo”: creamos identity + sequence con nombre fijo
  ALTER TABLE public.event_log
  ALTER COLUMN id
  ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.event_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
  );
END
$$;



CREATE TABLE IF NOT EXISTS "public"."favorito" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "usuario_id" "uuid",
    "producto_id" "uuid"
);


ALTER TABLE "public"."favorito" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."historial_stock" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "producto_id" "uuid",
    "cantidad" integer NOT NULL,
    "fecha" timestamp without time zone DEFAULT "now"(),
    "motivo" "text",
    CONSTRAINT "chk_hs_cantidad_nonzero" CHECK (("cantidad" <> 0))
);


ALTER TABLE "public"."historial_stock" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."imagen_producto" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "producto_id" "uuid",
    "url_imagen" character varying(255) NOT NULL,
    "descripcion" character varying(255),
    "creado_en" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."imagen_producto" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."log_actividad" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "usuario_id" "uuid",
    "actividad" "text" NOT NULL,
    "fecha" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."log_actividad" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."membresia" (
    "empresa_id" "uuid" NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "rol" "public"."rol_membresia" DEFAULT 'invitado'::"public"."rol_membresia" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."membresia" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notificacion" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "usuario_id" "uuid",
    "mensaje" "text" NOT NULL,
    "fecha" timestamp without time zone DEFAULT "now"(),
    "leido" boolean DEFAULT false
);


ALTER TABLE "public"."notificacion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pedido" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "usuario_id" "uuid",
    "fecha_pedido" timestamp without time zone DEFAULT "now"(),
    "direccion_envio_id" "uuid",
    "estado" character varying(50) DEFAULT 'Pendiente'::character varying
);


ALTER TABLE "public"."pedido" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."producto" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "nombre" character varying(255) NOT NULL,
    "descripcion" "text",
    "precio" numeric(10,2) NOT NULL,
    "stock" integer NOT NULL,
    "tipo" character varying(50),
    "categoria_id" "uuid",
    "empresa_id" "uuid",
    "creado_en" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."producto" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usuario" (
    "id" "uuid" NOT NULL,
    "nombre" character varying(255) NOT NULL,
    "correo" character varying(255) NOT NULL,
    "rol" character varying(50) DEFAULT 'cliente'::character varying NOT NULL,
    "empresa_id" "uuid",
    "telefono" character varying(15),
    "direccion" character varying(255),
    "fecha_registro" timestamp without time zone DEFAULT "now"(),
    "supabase_uid" "uuid" NOT NULL
);


ALTER TABLE "public"."usuario" OWNER TO "postgres";


ALTER TABLE ONLY "public"."carrito"
    ADD CONSTRAINT "carrito_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."carrito_producto"
    ADD CONSTRAINT "carrito_producto_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categoria"
    ADD CONSTRAINT "categoria_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comprobante_pago"
    ADD CONSTRAINT "comprobante_pago_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."direccion_usuario"
    ADD CONSTRAINT "direccion_usuario_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."empresa"
    ADD CONSTRAINT "empresa_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."envio"
    ADD CONSTRAINT "envio_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_log"
    ADD CONSTRAINT "event_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."favorito"
    ADD CONSTRAINT "favorito_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."historial_stock"
    ADD CONSTRAINT "historial_stock_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."imagen_producto"
    ADD CONSTRAINT "imagen_producto_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."log_actividad"
    ADD CONSTRAINT "log_actividad_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."membresia"
    ADD CONSTRAINT "membresia_pkey" PRIMARY KEY ("empresa_id", "usuario_id");



ALTER TABLE ONLY "public"."notificacion"
    ADD CONSTRAINT "notificacion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pedido"
    ADD CONSTRAINT "pedido_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."producto"
    ADD CONSTRAINT "producto_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuario"
    ADD CONSTRAINT "usuario_correo_key" UNIQUE ("correo");



ALTER TABLE ONLY "public"."usuario"
    ADD CONSTRAINT "usuario_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuario"
    ADD CONSTRAINT "usuario_supabase_uid_unique" UNIQUE ("supabase_uid");



CREATE UNIQUE INDEX "empresa_slug_key" ON "public"."empresa" USING "btree" ("slug");



CREATE INDEX "idx_cp_carrito" ON "public"."carrito_producto" USING "btree" ("carrito_id");



CREATE INDEX "idx_cp_pedido" ON "public"."comprobante_pago" USING "btree" ("pedido_id");



CREATE INDEX "idx_cp_producto" ON "public"."carrito_producto" USING "btree" ("producto_id");



CREATE INDEX "idx_du_usuario" ON "public"."direccion_usuario" USING "btree" ("usuario_id");



CREATE INDEX "idx_empresa_owner_auth" ON "public"."empresa" USING "btree" ("owner_auth");



CREATE INDEX "idx_envio_estado" ON "public"."envio" USING "btree" ("estado_envio");



CREATE INDEX "idx_envio_pedido" ON "public"."envio" USING "btree" ("pedido_id");



CREATE INDEX "idx_event_log_created_at" ON "public"."event_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_event_log_event_type" ON "public"."event_log" USING "btree" ("event_type");



CREATE INDEX "idx_hs_producto" ON "public"."historial_stock" USING "btree" ("producto_id");



CREATE INDEX "idx_ip_producto" ON "public"."imagen_producto" USING "btree" ("producto_id");



CREATE INDEX "idx_membresia_empresa" ON "public"."membresia" USING "btree" ("empresa_id");



CREATE INDEX "idx_membresia_usuario" ON "public"."membresia" USING "btree" ("usuario_id");



CREATE INDEX "idx_pedido_usuario" ON "public"."pedido" USING "btree" ("usuario_id");



CREATE INDEX "idx_producto_categoria" ON "public"."producto" USING "btree" ("categoria_id");



CREATE INDEX "idx_producto_empresa" ON "public"."producto" USING "btree" ("empresa_id");



CREATE UNIQUE INDEX "ux_cp_carrito_producto" ON "public"."carrito_producto" USING "btree" ("carrito_id", "producto_id");



CREATE UNIQUE INDEX "ux_du_usuario_direccion" ON "public"."direccion_usuario" USING "btree" ("usuario_id", "direccion", "ciudad", "pais");



CREATE OR REPLACE TRIGGER "usuario_set_uid" BEFORE INSERT ON "public"."usuario" FOR EACH ROW EXECUTE FUNCTION "public"."set_supabase_uid_from_jwt"();



ALTER TABLE ONLY "public"."carrito_producto"
    ADD CONSTRAINT "carrito_producto_carrito_id_fkey" FOREIGN KEY ("carrito_id") REFERENCES "public"."carrito"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carrito_producto"
    ADD CONSTRAINT "carrito_producto_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categoria"
    ADD CONSTRAINT "categoria_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categoria"
    ADD CONSTRAINT "categoria_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categoria"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."comprobante_pago"
    ADD CONSTRAINT "comprobante_pago_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedido"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."empresa"
    ADD CONSTRAINT "empresa_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."empresa"
    ADD CONSTRAINT "empresa_owner_auth_fkey" FOREIGN KEY ("owner_auth") REFERENCES "auth"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."envio"
    ADD CONSTRAINT "envio_direccion_envio_id_fkey" FOREIGN KEY ("direccion_envio_id") REFERENCES "public"."direccion_usuario"("id");



ALTER TABLE ONLY "public"."envio"
    ADD CONSTRAINT "envio_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedido"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."favorito"
    ADD CONSTRAINT "favorito_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carrito"
    ADD CONSTRAINT "fk_carrito_usuario" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carrito_producto"
    ADD CONSTRAINT "fk_cp_carrito" FOREIGN KEY ("carrito_id") REFERENCES "public"."carrito"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comprobante_pago"
    ADD CONSTRAINT "fk_cp_pedido" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedido"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."carrito_producto"
    ADD CONSTRAINT "fk_cp_producto" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."direccion_usuario"
    ADD CONSTRAINT "fk_du_usuario" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."envio"
    ADD CONSTRAINT "fk_envio_direccion" FOREIGN KEY ("direccion_envio_id") REFERENCES "public"."direccion_usuario"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."envio"
    ADD CONSTRAINT "fk_envio_pedido" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedido"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."historial_stock"
    ADD CONSTRAINT "fk_hs_producto" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."imagen_producto"
    ADD CONSTRAINT "fk_ip_producto" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."log_actividad"
    ADD CONSTRAINT "fk_log_usuario" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pedido"
    ADD CONSTRAINT "fk_pedido_direccion" FOREIGN KEY ("direccion_envio_id") REFERENCES "public"."direccion_usuario"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pedido"
    ADD CONSTRAINT "fk_pedido_usuario" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."producto"
    ADD CONSTRAINT "fk_producto_categoria" FOREIGN KEY ("categoria_id") REFERENCES "public"."categoria"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."producto"
    ADD CONSTRAINT "fk_producto_empresa" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usuario"
    ADD CONSTRAINT "fk_usuario_empresa" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."historial_stock"
    ADD CONSTRAINT "historial_stock_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."imagen_producto"
    ADD CONSTRAINT "imagen_producto_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."producto"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."membresia"
    ADD CONSTRAINT "membresia_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."membresia"
    ADD CONSTRAINT "membresia_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pedido"
    ADD CONSTRAINT "pedido_direccion_envio_id_fkey" FOREIGN KEY ("direccion_envio_id") REFERENCES "public"."direccion_usuario"("id");



ALTER TABLE ONLY "public"."producto"
    ADD CONSTRAINT "producto_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "public"."categoria"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."producto"
    ADD CONSTRAINT "producto_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usuario"
    ADD CONSTRAINT "usuario_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresa"("id") ON DELETE SET NULL;



ALTER TABLE "public"."carrito" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "carrito_del_own" ON "public"."carrito" FOR DELETE TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "carrito_ins_own" ON "public"."carrito" FOR INSERT TO "authenticated" WITH CHECK (("usuario_id" = "auth"."uid"()));



ALTER TABLE "public"."carrito_producto" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "carrito_sel_own" ON "public"."carrito" FOR SELECT TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "carrito_upd_own" ON "public"."carrito" FOR UPDATE TO "authenticated" USING (("usuario_id" = "auth"."uid"())) WITH CHECK (("usuario_id" = "auth"."uid"()));



ALTER TABLE "public"."categoria" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categoria_all_true" ON "public"."categoria" USING (true) WITH CHECK (true);



ALTER TABLE "public"."comprobante_pago" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cp_del_own" ON "public"."carrito_producto" FOR DELETE TO "authenticated" USING ("public"."owns_carrito"("carrito_id"));



CREATE POLICY "cp_del_own" ON "public"."comprobante_pago" FOR DELETE TO "authenticated" USING ("public"."owns_pedido"("pedido_id"));



CREATE POLICY "cp_ins_own" ON "public"."carrito_producto" FOR INSERT TO "authenticated" WITH CHECK ("public"."owns_carrito"("carrito_id"));



CREATE POLICY "cp_ins_own" ON "public"."comprobante_pago" FOR INSERT TO "authenticated" WITH CHECK ("public"."owns_pedido"("pedido_id"));



CREATE POLICY "cp_sel_own" ON "public"."carrito_producto" FOR SELECT TO "authenticated" USING ("public"."owns_carrito"("carrito_id"));



CREATE POLICY "cp_sel_own" ON "public"."comprobante_pago" FOR SELECT TO "authenticated" USING ("public"."owns_pedido"("pedido_id"));



CREATE POLICY "cp_upd_own" ON "public"."carrito_producto" FOR UPDATE TO "authenticated" USING ("public"."owns_carrito"("carrito_id")) WITH CHECK ("public"."owns_carrito"("carrito_id"));



CREATE POLICY "cp_upd_own" ON "public"."comprobante_pago" FOR UPDATE TO "authenticated" USING ("public"."owns_pedido"("pedido_id")) WITH CHECK ("public"."owns_pedido"("pedido_id"));



ALTER TABLE "public"."direccion_usuario" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "du_del_own" ON "public"."direccion_usuario" FOR DELETE TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "du_ins_own" ON "public"."direccion_usuario" FOR INSERT TO "authenticated" WITH CHECK (("usuario_id" = "auth"."uid"()));



CREATE POLICY "du_sel_own" ON "public"."direccion_usuario" FOR SELECT TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "du_upd_own" ON "public"."direccion_usuario" FOR UPDATE TO "authenticated" USING (("usuario_id" = "auth"."uid"())) WITH CHECK (("usuario_id" = "auth"."uid"()));



ALTER TABLE "public"."empresa" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "empresa_del_own" ON "public"."empresa" FOR DELETE TO "authenticated" USING (("owner_auth" = "auth"."uid"()));



CREATE POLICY "empresa_delete_owners" ON "public"."empresa" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."membresia" "m"
  WHERE (("m"."empresa_id" = "empresa"."id") AND ("m"."usuario_id" = "auth"."uid"()) AND ("m"."rol" = 'owner'::"public"."rol_membresia")))));



CREATE POLICY "empresa_ins_own" ON "public"."empresa" FOR INSERT TO "authenticated" WITH CHECK (("owner_auth" = "auth"."uid"()));



CREATE POLICY "empresa_insert_owner" ON "public"."empresa" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "empresa_sel_own" ON "public"."empresa" FOR SELECT TO "authenticated" USING (("owner_auth" = "auth"."uid"()));



CREATE POLICY "empresa_select_members" ON "public"."empresa" FOR SELECT USING (("public"."user_is_member_of"("id") OR ("created_by" = "auth"."uid"())));



CREATE POLICY "empresa_upd_own" ON "public"."empresa" FOR UPDATE TO "authenticated" USING (("owner_auth" = "auth"."uid"())) WITH CHECK (("owner_auth" = "auth"."uid"()));



CREATE POLICY "empresa_update_admins" ON "public"."empresa" FOR UPDATE USING ("public"."user_is_member_of"("id")) WITH CHECK ("public"."user_is_member_of"("id"));



ALTER TABLE "public"."envio" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "envio_del_own" ON "public"."envio" FOR DELETE TO "authenticated" USING ("public"."owns_pedido"("pedido_id"));



CREATE POLICY "envio_ins_own" ON "public"."envio" FOR INSERT TO "authenticated" WITH CHECK ("public"."owns_pedido"("pedido_id"));



CREATE POLICY "envio_sel_own" ON "public"."envio" FOR SELECT TO "authenticated" USING ("public"."owns_pedido"("pedido_id"));



CREATE POLICY "envio_upd_own" ON "public"."envio" FOR UPDATE TO "authenticated" USING ("public"."owns_pedido"("pedido_id")) WITH CHECK ("public"."owns_pedido"("pedido_id"));



ALTER TABLE "public"."event_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "event_log_select_admins" ON "public"."event_log" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."usuario" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND (("u"."rol")::"text" = 'admin'::"text")))));



ALTER TABLE "public"."favorito" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."historial_stock" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "hs_ins_owner" ON "public"."historial_stock" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_manage_producto"("producto_id"));



CREATE POLICY "hs_sel_owner" ON "public"."historial_stock" FOR SELECT TO "authenticated" USING ("public"."can_manage_producto"("producto_id"));



ALTER TABLE "public"."imagen_producto" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "insert_empresa_authenticated" ON "public"."empresa" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "insert_own_carrito" ON "public"."carrito" FOR INSERT TO "authenticated" WITH CHECK (("usuario_id" = "auth"."uid"()));



CREATE POLICY "insert_own_favoritos" ON "public"."favorito" FOR INSERT TO "authenticated" WITH CHECK (("usuario_id" = "auth"."uid"()));



CREATE POLICY "insert_own_pedidos" ON "public"."pedido" FOR INSERT TO "authenticated" WITH CHECK (("usuario_id" = "auth"."uid"()));



CREATE POLICY "ip_del_owner" ON "public"."imagen_producto" FOR DELETE TO "authenticated" USING ("public"."can_manage_producto"("producto_id"));



CREATE POLICY "ip_ins_owner" ON "public"."imagen_producto" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_manage_producto"("producto_id"));



CREATE POLICY "ip_sel_public" ON "public"."imagen_producto" FOR SELECT USING (true);



CREATE POLICY "ip_upd_owner" ON "public"."imagen_producto" FOR UPDATE TO "authenticated" USING ("public"."can_manage_producto"("producto_id")) WITH CHECK ("public"."can_manage_producto"("producto_id"));



ALTER TABLE "public"."log_actividad" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "log_sel_own" ON "public"."log_actividad" FOR SELECT TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



ALTER TABLE "public"."membresia" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "membresia_delete_admins" ON "public"."membresia" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."membresia" "m2"
  WHERE (("m2"."empresa_id" = "membresia"."empresa_id") AND ("m2"."usuario_id" = "auth"."uid"()) AND ("m2"."rol" = ANY (ARRAY['owner'::"public"."rol_membresia", 'admin'::"public"."rol_membresia"]))))));



CREATE POLICY "membresia_insert_admins" ON "public"."membresia" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."membresia" "m2"
  WHERE (("m2"."empresa_id" = "membresia"."empresa_id") AND ("m2"."usuario_id" = "auth"."uid"()) AND ("m2"."rol" = ANY (ARRAY['owner'::"public"."rol_membresia", 'admin'::"public"."rol_membresia"]))))));



CREATE POLICY "membresia_select_members" ON "public"."membresia" FOR SELECT USING ("public"."user_is_member_of"("empresa_id"));



CREATE POLICY "membresia_update_admins" ON "public"."membresia" FOR UPDATE USING ("public"."user_is_member_of"("empresa_id")) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."membresia" "m2"
  WHERE (("m2"."empresa_id" = "membresia"."empresa_id") AND ("m2"."usuario_id" = "auth"."uid"()) AND ("m2"."rol" = ANY (ARRAY['owner'::"public"."rol_membresia", 'admin'::"public"."rol_membresia"]))))));



ALTER TABLE "public"."notificacion" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pedido" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pedido_del_own" ON "public"."pedido" FOR DELETE TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "pedido_ins_own" ON "public"."pedido" FOR INSERT TO "authenticated" WITH CHECK (("usuario_id" = "auth"."uid"()));



CREATE POLICY "pedido_sel_own" ON "public"."pedido" FOR SELECT TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "pedido_upd_own" ON "public"."pedido" FOR UPDATE TO "authenticated" USING (("usuario_id" = "auth"."uid"())) WITH CHECK (("usuario_id" = "auth"."uid"()));



ALTER TABLE "public"."producto" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "producto_del_owner" ON "public"."producto" FOR DELETE TO "authenticated" USING ("public"."is_empresa_owner"("empresa_id"));



CREATE POLICY "producto_ins_owner" ON "public"."producto" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_empresa_owner"("empresa_id"));



CREATE POLICY "producto_public_sel" ON "public"."producto" FOR SELECT USING (true);



CREATE POLICY "producto_tenant_cud" ON "public"."producto" TO "authenticated" USING ("public"."user_is_member_of"("empresa_id")) WITH CHECK ("public"."user_is_member_of"("empresa_id"));



CREATE POLICY "producto_tenant_select" ON "public"."producto" FOR SELECT USING ("public"."user_is_member_of"("empresa_id"));



CREATE POLICY "producto_upd_owner" ON "public"."producto" FOR UPDATE TO "authenticated" USING ("public"."is_empresa_owner"("empresa_id")) WITH CHECK ("public"."is_empresa_owner"("empresa_id"));



CREATE POLICY "read_own_carrito" ON "public"."carrito" FOR SELECT TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "read_own_favoritos" ON "public"."favorito" FOR SELECT TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "read_own_pedidos" ON "public"."pedido" FOR SELECT TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "select_empresa_authenticated" ON "public"."empresa" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."usuario" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "usuario puede actualizar productos de su empresa" ON "public"."producto" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."usuario" "u"
  WHERE (("u"."empresa_id" = "producto"."empresa_id") AND (("u"."correo")::"text" = "auth"."email"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."usuario" "u"
  WHERE (("u"."empresa_id" = "producto"."empresa_id") AND (("u"."correo")::"text" = "auth"."email"())))));



CREATE POLICY "usuario puede crear productos en su empresa" ON "public"."producto" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."usuario" "u"
  WHERE (("u"."empresa_id" = "producto"."empresa_id") AND (("u"."correo")::"text" = "auth"."email"())))));



CREATE POLICY "usuario puede eliminar productos de su empresa" ON "public"."producto" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."usuario" "u"
  WHERE (("u"."empresa_id" = "producto"."empresa_id") AND (("u"."correo")::"text" = "auth"."email"())))));



CREATE POLICY "usuario puede ver productos de su empresa" ON "public"."producto" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."usuario" "u"
  WHERE (("u"."empresa_id" = "producto"."empresa_id") AND (("u"."correo")::"text" = "auth"."email"())))));



CREATE POLICY "usuario_delete_own" ON "public"."usuario" FOR DELETE USING (("supabase_uid" = "auth"."uid"()));



CREATE POLICY "usuario_insert_self" ON "public"."usuario" FOR INSERT WITH CHECK (("supabase_uid" = "auth"."uid"()));



CREATE POLICY "usuario_puede_crear_empresa" ON "public"."empresa" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "usuario_select_own" ON "public"."usuario" FOR SELECT USING (("supabase_uid" = "auth"."uid"()));



CREATE POLICY "usuario_update_own" ON "public"."usuario" FOR UPDATE USING (("supabase_uid" = "auth"."uid"())) WITH CHECK (("supabase_uid" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "anon";








































































































































































GRANT SELECT ON TABLE "public"."carrito" TO "authenticated";



GRANT SELECT ON TABLE "public"."carrito_producto" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."categoria" TO "authenticated";



GRANT SELECT ON TABLE "public"."comprobante_pago" TO "authenticated";



GRANT SELECT ON TABLE "public"."direccion_usuario" TO "authenticated";



GRANT SELECT,INSERT ON TABLE "public"."empresa" TO "authenticated";



GRANT SELECT ON TABLE "public"."envio" TO "authenticated";



GRANT SELECT ON TABLE "public"."favorito" TO "authenticated";



GRANT SELECT ON TABLE "public"."historial_stock" TO "authenticated";



GRANT SELECT ON TABLE "public"."imagen_producto" TO "authenticated";



GRANT SELECT ON TABLE "public"."log_actividad" TO "authenticated";



GRANT SELECT ON TABLE "public"."notificacion" TO "authenticated";



GRANT SELECT ON TABLE "public"."pedido" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."producto" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."usuario" TO "authenticated";

































RESET ALL;
