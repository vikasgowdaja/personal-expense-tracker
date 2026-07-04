import React from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css';

function Navbar({ onLogout }) {
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/dashboard" className="navbar-logo">
          💰 Expense Tracker
        </Link>
        <ul className="navbar-menu">
          <li className="navbar-item">
            <Link to="/dashboard" className="navbar-link">Dashboard</Link>
          </li>
          <li className="navbar-item">
            <Link to="/expenses" className="navbar-link">Expenses</Link>
          </li>
          <li className="navbar-item">
            <Link to="/add-expense" className="navbar-link">Add Expense</Link>
          </li>
          <li className="navbar-item">
            <Link to="/upload-receipt" className="navbar-link">📷 Upload Receipt</Link>
          </li>
          <li className="navbar-item">
            <button onClick={onLogout} className="btn btn-danger navbar-btn">
              Logout
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
}

export default Navbar;
