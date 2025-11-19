import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Registration.module.scss';

const Registration = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    position: '',
    department: '',
    hireDate: ''
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          hireDate: new Date(formData.hireDate).toISOString(),
          status: 'ушёл' // Новые сотрудники по умолчанию не на объекте
        })
      });

      if (response.ok) {
        alert('Сотрудник успешно зарегистрирован!');
        setFormData({
          fullName: '',
          position: '',
          department: '',
          hireDate: ''
        });
        navigate('/'); // Возвращаем на главную
      } else {
        alert('Ошибка при регистрации сотрудника');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Ошибка при регистрации сотрудника');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.registration}>
      <div className={styles.header}>
       
        <h1>Регистрация сотрудника</h1>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label htmlFor="fullName">ФИО сотрудника *</label>
          <input
            type="text"
            id="fullName"
            name="fullName"
            value={formData.fullName}
            onChange={handleInputChange}
            placeholder="Введите ФИО"
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="position">Должность *</label>
          <input
            type="text"
            id="position"
            name="position"
            value={formData.position}
            onChange={handleInputChange}
            placeholder="Введите должность"
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="department">Отдел *</label>
          <select
            id="department"
            name="department"
            value={formData.department}
            onChange={handleInputChange}
            required
          >
            <option value="">Выберите отдел</option>
            <option value="Строительный">Строительный</option>
            <option value="Проектный">Проектный</option>
            <option value="Технический">Технический</option>
            <option value="IT">IT</option>
            <option value="Администрация">Администрация</option>
          </select>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="hireDate">Дата приема на работу *</label>
          <input
            type="date"
            id="hireDate"
            name="hireDate"
            value={formData.hireDate}
            onChange={handleInputChange}
            required
          />
        </div>

        <button 
          type="submit" 
          className={styles.submitButton}
          disabled={loading}
        >
          {loading ? 'Регистрация...' : 'Зарегистрировать сотрудника'}
        </button>
      </form>
    </div>
  );
};

export default Registration;