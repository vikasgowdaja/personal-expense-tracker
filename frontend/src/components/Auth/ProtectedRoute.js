import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * ProtectedRoute – wraps a route that requires a specific role.
 * Employees attempting to access superadmin-only pages are redirected to /dashboard.
 */
function ProtectedRoute({ user, requiredRole, children }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export default ProtectedRoute;
