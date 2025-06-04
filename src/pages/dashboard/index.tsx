import ProtectedRoute from '../../components/ProtectedRoute';

function Dashboard() {
  return (
    <div>
      <h1>Dashboard</h1>
      <p>Contenido protegido para usuarios autenticados.</p>
    </div>
  );
}

export default function ProtectedDashboard() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}
