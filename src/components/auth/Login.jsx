import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import styles from './Login.module.scss';

const Login = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (login(password)) {
      navigate(from, { replace: true });
    } else {
      setError('Неверный пароль');
    }
  };

  return (
    <div className={styles.login}>
      <div className={styles.loginCard}>
        <h2>Вход для администрации</h2>
        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="password">Пароль:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              required
            />
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <button type="submit" className={styles.submitButton}>
            Войти
          </button>
        </form>
        <div className={styles.hint}>
          Подсказка: пароль - admin123
        </div>
      </div>
    </div>
  );
};

export default Login;