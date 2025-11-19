import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Violations.module.scss';

const Violations = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [violations, setViolations] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: `/employees/${id}/violations` } });
      return;
    }
    fetchViolations();
    fetchStats();
  }, [id, isAuthenticated, navigate]);

  const fetchViolations = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/employees/${id}/violations`);
      const data = await response.json();
      setViolations(data);
    } catch (error) {
      console.error('Error fetching violations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`http://localhost:3001/api/employees/${id}/violations-stats`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const getViolationType = (record) => {
    if (record.isLate) return '⚠️ Опоздание';
    if (record.isEarlyLeave) return '🚪 Ранний уход';
    if (record.isReentry) return '🔄 Повторный вход/выход';
    return 'Неизвестно';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  if (loading) return <div className={styles.loading}>Загрузка...</div>;

  return (
    <div className={styles.violations}>
      <div className={styles.header}>
        <button onClick={() => navigate(-1)}>← Назад</button>
        <h1>Нарушения расписания</h1>
      </div>

      {/* Статистика */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statNumber}>{stats.lateCount || 0}</span>
          <span className={styles.statLabel}>Опозданий</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statNumber}>{stats.earlyLeaveCount || 0}</span>
          <span className={styles.statLabel}>Ранних уходов</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statNumber}>{stats.reentryCount || 0}</span>
          <span className={styles.statLabel}>Повторных входов</span>
        </div>
      </div>

      {/* Список нарушений */}
      <div className={styles.violationsList}>
        {violations.length === 0 ? (
          <div className={styles.emptyState}>Нарушений не найдено</div>
        ) : (
          violations.map(violation => (
            <div key={violation.id} className={styles.violationItem}>
              <div className={styles.violationHeader}>
                <span className={styles.violationType}>
                  {getViolationType(violation)}
                </span>
                <span className={styles.violationTime}>
                  {formatDate(violation.timestamp)}
                </span>
              </div>
              <div className={styles.violationDetails}>
                <span className={styles.action}>
                  {violation.type === 'приход' ? '🟢 Приход' : '🔴 Уход'}
                </span>
                {violation.notes && (
                  <span className={styles.notes}>{violation.notes}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Violations;