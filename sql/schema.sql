-- Crear extensiones necesarias para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Crear tabla de Usuarios
CREATE TABLE Usuario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL,
    correo VARCHAR(255) UNIQUE NOT NULL,
    contrasena VARCHAR(255) NOT NULL,
    telefono VARCHAR(15),
    direccion VARCHAR(255),
    fecha_registro TIMESTAMP DEFAULT NOW()
);

-- Crear tabla de Direcciones de Usuario
CREATE TABLE Direccion_Usuario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES Usuario(id) ON DELETE CASCADE,
    direccion VARCHAR(255) NOT NULL,
    ciudad VARCHAR(100) NOT NULL,
    pais VARCHAR(100) NOT NULL,
    codigo_postal VARCHAR(20),
    tipo_direccion VARCHAR(50),
    fecha_creacion TIMESTAMP DEFAULT NOW()
);

-- Crear tabla de Categorias de Producto
CREATE TABLE Categoria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT
);

-- Crear tabla de Productos
CREATE TABLE Producto (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10,2) NOT NULL,
    stock INT NOT NULL,
    tipo VARCHAR(50), -- prenda/outfit
    categoria_id UUID REFERENCES Categoria(id) ON DELETE SET NULL,
    creado_en TIMESTAMP DEFAULT NOW()
);

-- Crear tabla de Imágenes de Producto
CREATE TABLE Imagen_Producto (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    producto_id UUID REFERENCES Producto(id) ON DELETE CASCADE,
    url_imagen VARCHAR(255) NOT NULL,
    descripcion VARCHAR(255)
);

-- Crear tabla de Carrito
CREATE TABLE Carrito (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES Usuario(id) ON DELETE CASCADE,
    creado_en TIMESTAMP DEFAULT NOW()
);

-- Crear tabla intermedia entre Carrito y Producto
CREATE TABLE Carrito_Producto (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    carrito_id UUID REFERENCES Carrito(id) ON DELETE CASCADE,
    producto_id UUID REFERENCES Producto(id) ON DELETE CASCADE,
    cantidad INT NOT NULL
);

-- Crear tabla de Pedido
CREATE TABLE Pedido (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES Usuario(id) ON DELETE CASCADE,
    fecha_pedido TIMESTAMP DEFAULT NOW(),
    direccion_envio_id UUID REFERENCES Direccion_Usuario(id),
    estado VARCHAR(50) DEFAULT 'Pendiente'
);

-- Crear tabla de Envíos
CREATE TABLE Envio (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pedido_id UUID REFERENCES Pedido(id) ON DELETE CASCADE,
    direccion_envio_id UUID REFERENCES Direccion_Usuario(id),
    fecha_envio TIMESTAMP DEFAULT NOW(),
    estado_envio VARCHAR(50) DEFAULT 'En preparación'
);

-- Crear tabla de Comprobante de Pago
CREATE TABLE Comprobante_Pago (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pedido_id UUID REFERENCES Pedido(id) ON DELETE CASCADE,
    monto DECIMAL(10,2) NOT NULL,
    fecha_pago TIMESTAMP DEFAULT NOW(),
    metodo_pago VARCHAR(50),
    estado_pago VARCHAR(50) DEFAULT 'Pendiente'
);

-- Crear tabla de Favoritos
CREATE TABLE Favorito (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES Usuario(id) ON DELETE CASCADE,
    producto_id UUID REFERENCES Producto(id) ON DELETE CASCADE
);

-- Crear tabla de Notificaciones
CREATE TABLE Notificacion (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES Usuario(id) ON DELETE CASCADE,
    mensaje TEXT NOT NULL,
    fecha TIMESTAMP DEFAULT NOW(),
    leido BOOLEAN DEFAULT FALSE
);

-- Crear tabla de Logs de Actividad
CREATE TABLE Log_Actividad (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES Usuario(id) ON DELETE CASCADE,
    actividad TEXT NOT NULL,
    fecha TIMESTAMP DEFAULT NOW()
);

-- Crear tabla de Historial de Stock de Producto
CREATE TABLE Historial_Stock (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    producto_id UUID REFERENCES Producto(id) ON DELETE CASCADE,
    cantidad INT NOT NULL,
    fecha TIMESTAMP DEFAULT NOW(),
    motivo TEXT
);
