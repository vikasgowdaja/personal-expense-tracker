import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * ProtectedRoute – wraps a route that requires a specific role.
 * Employees attempting to access superadmin-only pages are redirected to /dashboard.
 */
function ProtectedRoute({ user, requiredRole, requiredRoles, children }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const allowedRoles = Array.isArray(requiredRoles)
    ? requiredRoles
    : requiredRole
      ? [requiredRole]
      : [];

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export default ProtectedRoute;
