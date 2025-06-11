import React, { useState } from 'react';

const ContactoPage: React.FC = () => {
  const [formData, setFormData] = useState({
    nombre: '',
    correo: '',
    mensaje: '',
  });

  const [successMessage, setSuccessMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // For now, just log the form data
    console.log('Formulario enviado:', formData);
    setSuccessMessage('Gracias por contactarnos. Pronto nos pondremos en contacto contigo.');
    setFormData({ nombre: '', correo: '', mensaje: '' });
  };

  return (
    <main className="container mx-auto p-4 flex justify-center items-center min-h-screen">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold mb-4 text-center">Contacto</h1>
        <p className="mb-6 text-center">Contáctanos para cualquier consulta o soporte.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="nombre"
            placeholder="Nombre"
            value={formData.nombre}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          />
          <input
            type="email"
            name="correo"
            placeholder="Correo"
            value={formData.correo}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          />
          <textarea
            name="mensaje"
            placeholder="Mensaje"
            value={formData.mensaje}
            onChange={handleChange}
            className="w-full p-2 border rounded h-32"
            required
          />
          <button
            type="submit"
            className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 w-full"
          >
            Enviar
          </button>
        </form>
        {successMessage && (
          <p className="mt-4 text-green-600 font-semibold text-center">{successMessage}</p>
        )}
      </div>
    </main>
  );
};

export default ContactoPage;
