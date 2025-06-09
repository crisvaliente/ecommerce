// pages/nuevo-favorito.tsx
import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function NuevoFavorito() {
  const [usuarioId, setUsuarioId] = useState('')
  const [productoId, setProductoId] = useState('')
  const [mensaje, setMensaje] = useState('')

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault()

    const { data, error } = await supabase.from('favorito').insert([
      {
        usuario_id: usuarioId,
        producto_id: productoId,
      },
    ])

    if (error) {
      console.error('Error insertando:', error)
      setMensaje('❌ Error al guardar favorito')
    } else {
      console.log('Insertado:', data)
      setMensaje('✅ Favorito guardado con éxito')
      setUsuarioId('')
      setProductoId('')
    }
  }

  return (
    <div className="p-8 font-raleway">
      <h1>Agregar Favorito</h1>
      <form onSubmit={manejarEnvio}>
        <div style={{ marginBottom: '1rem' }}>
          <label>Email del usuario:</label>
          <br />
          <input
            type="email"
            value={usuarioId}
            onChange={(e) => setUsuarioId(e.target.value)}
            required
            style={{ padding: '0.5rem', width: '100%' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>Producto:</label>
          <br />
          <input
            type="text"
            value={productoId}
            onChange={(e) => setProductoId(e.target.value)}
            required
            style={{ padding: '0.5rem', width: '100%' }}
          />
        </div>
        <button type="submit" style={{ padding: '0.5rem 1rem' }}>
          Guardar
        </button>
      </form>
      {mensaje && <p style={{ marginTop: '1rem' }}>{mensaje}</p>}
    </div>
  )
}
