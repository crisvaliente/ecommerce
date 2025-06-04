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
