import React, { useState } from 'react';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';

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
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-12">
      <Card className="w-full max-w-2xl p-8">
        <h1 className="font-raleway text-3xl font-bold text-text">Contacto</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
          Contáctanos para cualquier consulta, soporte o coordinación sobre tu compra.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <Input
            type="text"
            name="nombre"
            placeholder="Nombre"
            value={formData.nombre}
            onChange={handleChange}
            required
          />
          <Input
            type="email"
            name="correo"
            placeholder="Correo"
            value={formData.correo}
            onChange={handleChange}
            required
          />
          <Input
            as="textarea"
            name="mensaje"
            placeholder="Mensaje"
            value={formData.mensaje}
            onChange={handleChange}
            className="min-h-32"
            required
          />
          <Button type="submit" variant="primary" className="w-full">
            Enviar
          </Button>
        </form>
        {successMessage && (
          <p className="mt-4 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-center text-sm font-medium text-emerald-700">
            {successMessage}
          </p>
        )}
      </Card>
    </main>
  );
};

export default ContactoPage;
