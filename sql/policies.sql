-- Activar RLS
ALTER TABLE Categoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE Producto ENABLE ROW LEVEL SECURITY;
ALTER TABLE Imagen_Producto ENABLE ROW LEVEL SECURITY;
ALTER TABLE Pedido ENABLE ROW LEVEL SECURITY;

-- Políticas para Categoria
-- Permitir lectura a cualquier usuario autenticado
CREATE POLICY "read_categoria"
  ON Categoria
  FOR SELECT
  TO authenticated
  USING (true);

-- Políticas para Producto
-- Permitir lectura a cualquier usuario autenticado
CREATE POLICY "read_producto"
  ON Producto
  FOR SELECT
  TO authenticated
  USING (true);

-- Políticas para Imagen_Producto
-- Permitir lectura a cualquier usuario autenticado
CREATE POLICY "read_imagen_producto"
  ON Imagen_Producto
  FOR SELECT
  TO authenticated
  USING (true);

-- Políticas para Pedido
-- Permitir que un usuario vea solo sus pedidos
CREATE POLICY "solo_duenio_puede_ver_sus_pedidos"
  ON Pedido
  FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

-- También podés agregar INSERT/UPDATE/DELETE si corresponde.
-- Por ejemplo:
-- CREATE POLICY "usuario_crea_pedido"
--   ON Pedido
--   FOR INSERT
--   TO authenticated
--   WITH CHECK (usuario_id = auth.uid());



-- Activar RLS para Favorito y Carrito
ALTER TABLE Favorito ENABLE ROW LEVEL SECURITY;
ALTER TABLE Carrito ENABLE ROW LEVEL SECURITY;

-- Políticas para Favorito
-- Permitir que un usuario vea solo sus favoritos
CREATE POLICY "solo_duenio_puede_ver_sus_favoritos"
  ON Favorito
  FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

-- Permitir que un usuario inserte solo en su lista de favoritos
CREATE POLICY "usuario_agrega_favorito"
  ON Favorito
  FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

-- Políticas para Carrito
-- Permitir que un usuario vea solo su carrito
CREATE POLICY "solo_duenio_puede_ver_su_carrito"
  ON Carrito
  FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

-- Permitir que un usuario inserte solo en su carrito
CREATE POLICY "usuario_crea_carrito"
  ON Carrito
  FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

-- Políticas para Carrito_Producto
-- Permitir que un usuario vea solo los productos en su carrito
CREATE POLICY "solo_duenio_puede_ver_sus_productos_carrito"
  ON Carrito_Producto
  FOR SELECT
  TO authenticated
  USING (carrito_id IN (SELECT id FROM Carrito WHERE usuario_id = auth.uid()));

-- Permitir que un usuario inserte solo productos en su carrito
CREATE POLICY "usuario_agrega_producto_a_carrito"
  ON Carrito_Producto
  FOR INSERT
  TO authenticated
  WITH CHECK (carrito_id IN (SELECT id FROM Carrito WHERE usuario_id = auth.uid()));
-- Activar RLS en las tablas clave
ALTER TABLE Usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE Producto ENABLE ROW LEVEL SECURITY;
ALTER TABLE Categoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE Pedido ENABLE ROW LEVEL SECURITY;
ALTER TABLE Carrito ENABLE ROW LEVEL SECURITY;
ALTER TABLE Favorito ENABLE ROW LEVEL SECURITY;
ALTER TABLE Direccion_Usuario ENABLE ROW LEVEL SECURITY;

-- ------------------------------
-- POLÍTICAS PARA LA TABLA USUARIO
-- ------------------------------

-- Permitir que un usuario lea su propia info
CREATE POLICY "read_own_user"
  ON Usuario
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Permitir que un usuario actualice su propia info
CREATE POLICY "update_own_user"
  ON Usuario
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

-- Permitir a admins ver todos los usuarios de su empresa
CREATE POLICY "admin_read_users_in_company"
  ON Usuario
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM Usuario u
      WHERE u.id = auth.uid()
      AND u.rol = 'admin'
      AND u.empresa_id = Usuario.empresa_id
    )
  );

-- ------------------------------
-- POLÍTICAS PARA PRODUCTO
-- ------------------------------

-- Leer productos de la misma empresa
CREATE POLICY "read_productos_empresa"
  ON Producto
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM Usuario u
      WHERE u.id = auth.uid()
      AND u.empresa_id = Producto.empresa_id
    )
  );

-- Insertar productos si es admin o vendedor
CREATE POLICY "insert_productos_empresa"
  ON Producto
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM Usuario u
      WHERE u.id = auth.uid()
      AND u.empresa_id = Producto.empresa_id
      AND u.rol IN ('admin', 'vendedor')
    )
  );

-- Editar productos si es admin
CREATE POLICY "update_productos_admin"
  ON Producto
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM Usuario u
      WHERE u.id = auth.uid()
      AND u.empresa_id = Producto.empresa_id
      AND u.rol = 'admin'
    )
  );

-- ------------------------------
-- POLÍTICAS PARA PEDIDO
-- ------------------------------

-- Leer pedidos propios
CREATE POLICY "read_own_pedidos"
  ON Pedido
  FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

-- Insertar pedidos propios
CREATE POLICY "insert_own_pedidos"
  ON Pedido
  FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

-- ------------------------------
-- POLÍTICAS PARA CARRITO
-- ------------------------------

-- Leer carrito propio
CREATE POLICY "read_own_carrito"
  ON Carrito
  FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

-- Insertar carrito propio
CREATE POLICY "insert_own_carrito"
  ON Carrito
  FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

-- ------------------------------
-- POLÍTICAS PARA FAVORITOS
-- ------------------------------

-- Leer favoritos propios
CREATE POLICY "read_own_favoritos"
  ON Favorito
  FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

-- Insertar favoritos propios
CREATE POLICY "insert_own_favoritos"
  ON Favorito
  FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

-- ------------------------------
-- POLÍTICAS PARA CATEGORIA
-- ------------------------------

-- Leer categorías de la empresa
CREATE POLICY "read_categoria_empresa"
  ON Categoria
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM Usuario u
      WHERE u.id = auth.uid()
      AND u.empresa_id = Categoria.empresa_id
    )
  );

-- Insertar si es admin o vendedor
CREATE POLICY "insert_categoria_empresa"
  ON Categoria
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM Usuario u
      WHERE u.id = auth.uid()
      AND u.empresa_id = Categoria.empresa_id
      AND u.rol IN ('admin', 'vendedor')
    )
  );
