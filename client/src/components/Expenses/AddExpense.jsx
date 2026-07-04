import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { expenseAPI } from '../../services/api';
import './Expenses.css';

function AddExpense() {
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: 'Food',
    date: new Date().toISOString().split('T')[0],
    description: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const { title, amount, category, date, description } = formData;

  const onChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      await expenseAPI.create({
        ...formData,
        amount: parseFloat(amount)
      });
      setSuccess('Expense added successfully!');
      setTimeout(() => {
        navigate('/expenses');
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add expense');
    }
  };

  return (
    <div className="container">
      <div className="add-expense-container">
        <div className="card add-expense-card">
          <h2>Add New Expense</h2>
          <form onSubmit={onSubmit}>
            <div className="form-group">
              <label htmlFor="title">Title</label>
              <input
                type="text"
                className="form-control"
                id="title"
                name="title"
                value={title}
                onChange={onChange}
                required
                placeholder="e.g., Grocery Shopping"
              />
            </div>

            <div className="form-group">
              <label htmlFor="amount">Amount ($)</label>
              <input
                type="number"
                className="form-control"
                id="amount"
                name="amount"
                value={amount}
                onChange={onChange}
                required
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </div>

            <div className="form-group">
              <label htmlFor="category">Category</label>
              <select
                className="form-control"
                id="category"
                name="category"
                value={category}
                onChange={onChange}
                required
              >
                <option value="Food">Food</option>
                <option value="Transport">Transport</option>
                <option value="Entertainment">Entertainment</option>
                <option value="Shopping">Shopping</option>
                <option value="Bills">Bills</option>
                <option value="Healthcare">Healthcare</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="date">Date</label>
              <input
                type="date"
                className="form-control"
                id="date"
                name="date"
                value={date}
                onChange={onChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description (Optional)</label>
              <textarea
                className="form-control"
                id="description"
                name="description"
                value={description}
                onChange={onChange}
                rows="3"
                placeholder="Add any additional notes..."
              />
            </div>

            {error && <div className="error">{error}</div>}
            {success && <div className="success">{success}</div>}

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Add Expense
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => navigate('/expenses')}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AddExpense;
