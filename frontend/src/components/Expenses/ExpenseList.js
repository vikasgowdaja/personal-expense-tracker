import React, { useState, useEffect } from 'react';
import { expenseAPI } from '../../services/api';
import './Expenses.css';

function ExpenseList() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      const res = await expenseAPI.getAll();
      setExpenses(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error loading expenses:', err);
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        await expenseAPI.delete(id);
        setExpenses(expenses.filter(expense => expense._id !== id));
      } catch (err) {
        console.error('Error deleting expense:', err);
      }
    }
  };

  const filteredExpenses = filter === 'all' 
    ? expenses 
    : expenses.filter(expense => expense.category === filter);

  if (loading) {
    return <div className="loading">Loading expenses...</div>;
  }

  return (
    <div className="container">
      <div className="expenses-header">
        <h1>Expenses</h1>
        <div className="filter-group">
          <label htmlFor="filter">Filter by category:</label>
          <select 
            id="filter"
            className="form-control filter-select" 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            <option value="Food">Food</option>
            <option value="Transport">Transport</option>
            <option value="Entertainment">Entertainment</option>
            <option value="Shopping">Shopping</option>
            <option value="Bills">Bills</option>
            <option value="Healthcare">Healthcare</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      <div className="card">
        {filteredExpenses.length > 0 ? (
          <div className="expense-list">
            {filteredExpenses.map((expense) => (
              <div key={expense._id} className="expense-card">
                <div className="expense-details">
                  <h3>{expense.title}</h3>
                  <p className="expense-description">{expense.description}</p>
                  <div className="expense-meta">
                    <span className={`category-badge ${expense.category.toLowerCase()}`}>
                      {expense.category}
                    </span>
                    <span className="expense-date">
                      {new Date(expense.date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="expense-actions">
                  <div className="expense-amount-large">
                    ${expense.amount.toFixed(2)}
                  </div>
                  <button 
                    onClick={() => handleDelete(expense._id)} 
                    className="btn btn-danger btn-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-data">No expenses found</p>
        )}
      </div>
    </div>
  );
}

export default ExpenseList;
