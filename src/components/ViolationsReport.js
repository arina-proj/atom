import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import styles from './ViolationsReport.module.scss';

const ViolationsReport = () => {
  const { isAuthenticated } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(getStartOfMonth());
  const [endDate, setEndDate] = useState(getEndOfMonth());
  const [filters, setFilters] = useState({
    violationType: 'all',
    department: 'all',
    minSeverity: 0
  });
  const [expandedEmployee, setExpandedEmployee] = useState(null);

  // Функции для дат
  function getStartOfMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  }

  function getEndOfMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchReport();
    }
  }, [startDate, endDate, filters, isAuthenticated]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        violationType: filters.violationType,
        department: filters.department,
        minSeverity: filters.minSeverity
      });

      const response = await fetch(
        `http://localhost:3001/api/reports/violations?${params}`
      );
      const data = await response.json();
      
      if (data.success) {
        setReport(data);
      } else {
        console.error('Error fetching violations report:', data.error);
        alert('Ошибка при загрузке отчета');
      }
    } catch (error) {
      console.error('Error fetching violations report:', error);
      alert('Ошибка при загрузке отчета');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  const getViolationTypeText = (type) => {
    const types = {
      'all': 'Все нарушения',
      'late': 'Опоздания',
      'early_leave': 'Ранние уходы',
      'absence': 'Неучтенные отсутствия',
      'missing_records': 'Пропущенные записи'
    };
    return types[type] || type;
  };

  const getSeverityText = (severity) => {
    const levels = {
      0: 'Все нарушения',
      1: 'Легкие',
      2: 'Средние', 
      3: 'Серьезные'
    };
    return levels[severity] || severity;
  };

  const getSeverityBadge = (severity) => {
    const classes = {
      1: styles.lowSeverity,
      2: styles.mediumSeverity,
      3: styles.highSeverity
    };
    const texts = {
      1: 'Легкое',
      2: 'Среднее',
      3: 'Серьезное'
    };
    return <span className={`${styles.severityBadge} ${classes[severity]}`}>{texts[severity]}</span>;
  };

  const getViolationIcon = (type) => {
    const icons = {
      'late': '⏰',
      'early_leave': '🚪',
      'absence': '❌',
      'missing_records': '📝'
    };
    return icons[type] || '⚠️';
  };

  const exportToCSV = () => {
    if (!report?.data) return;

    const headers = [
      'Сотрудник',
      'Должность',
      'Отдел',
      'Всего нарушений',
      'Штрафные баллы',
      'Опоздания',
      'Ранние уходы',
      'Неучтенные отсутствия',
      'Пропущенные записи',
      'Уровень серьезности'
    ];

    const csvData = report.data.map(item => [
      item.employee.fullName,
      item.employee.position,
      item.employee.department,
      item.summary.totalViolations,
      item.summary.totalPenaltyPoints,
      item.violations.byType.late.length,
      item.violations.byType.early_leave.length,
      item.violations.byType.absence.length,
      item.violations.byType.missing_records.length,
      getSeverityText(item.summary.severityLevel)
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `violations_report_${startDate}_to_${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleEmployeeDetails = (employeeId) => {
    setExpandedEmployee(expandedEmployee === employeeId ? null : employeeId);
  };

  if (!isAuthenticated) {
    return <div className={styles.error}>Требуется авторизация</div>;
  }

  return (
    <div className={styles.report}>
      <div className={styles.header}>
        <h1>Отчет по нарушениям</h1>
        <div className={styles.controls}>
          <div className={styles.dateInputs}>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={styles.dateInput}
            />
            <span className={styles.dateSeparator}>—</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={styles.dateInput}
            />
          </div>

          <div className={styles.filters}>
            <select
              value={filters.violationType}
              onChange={(e) => handleFilterChange('violationType', e.target.value)}
              className={styles.filter}
            >
              <option value="all">Все нарушения</option>
              <option value="late">Опоздания</option>
              <option value="early_leave">Ранние уходы</option>
              <option value="absence">Неучтенные отсутствия</option>
              <option value="missing_records">Пропущенные записи</option>
            </select>

            <select
              value={filters.minSeverity}
              onChange={(e) => handleFilterChange('minSeverity', e.target.value)}
              className={styles.filter}
            >
              <option value="0">Все нарушения</option>
              <option value="1">Легкие и выше</option>
              <option value="2">Средние и выше</option>
              <option value="3">Только серьезные</option>
            </select>

            <select
              value={filters.department}
              onChange={(e) => handleFilterChange('department', e.target.value)}
              className={styles.filter}
            >
              <option value="all">Все отделы</option>
              <option value="IT">IT</option>
              <option value="HR">HR</option>
              <option value="Бухгалтерия">Бухгалтерия</option>
              <option value="Продажи">Продажи</option>
            </select>
          </div>

          <button onClick={fetchReport} className={styles.refreshButton}>
            🔄 Обновить
          </button>
          <button onClick={exportToCSV} className={styles.exportButton}>
            📊 Экспорт в CSV
          </button>
        </div>
      </div>

      {loading && <div className={styles.loading}>Загрузка отчета...</div>}

      {report && (
        <>
          <div className={styles.periodInfo}>
            <h2>Период: {startDate} — {endDate}</h2>
            <div className={styles.activeFilters}>
              <span>Тип: <strong>{getViolationTypeText(filters.violationType)}</strong></span>
              <span>Серьезность: <strong>{getSeverityText(parseInt(filters.minSeverity))}</strong></span>
              <span>Отдел: <strong>{filters.department === 'all' ? 'Все' : filters.department}</strong></span>
            </div>
          </div>

          <div className={styles.stats}>
            <div className={styles.statCard}>
              <span className={styles.statNumber}>{report.statistics.totalEmployeesWithViolations}</span>
              <span className={styles.statLabel}>Сотрудников с нарушениями</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statNumber}>{report.statistics.totalViolations}</span>
              <span className={styles.statLabel}>Всего нарушений</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statNumber}>{report.statistics.violationRate}%</span>
              <span className={styles.statLabel}>Процент нарушителей</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statNumber}>{report.statistics.avgViolationsPerEmployee}</span>
              <span className={styles.statLabel}>Нарушений на человека</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statNumber}>{report.statistics.totalPenaltyPoints}</span>
              <span className={styles.statLabel}>Штрафных баллов</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statNumber}>{report.statistics.workingDays}</span>
              <span className={styles.statLabel}>Рабочих дней</span>
            </div>
          </div>

          {/* Статистика по типам нарушений */}
          <div className={styles.violationTypes}>
            <h3>Распределение по типам нарушений</h3>
            <div className={styles.typesGrid}>
              <div className={styles.typeItem}>
                <span className={styles.typeIcon}>⏰</span>
                <span className={styles.typeCount}>{report.statistics.byType.late}</span>
                <span className={styles.typeLabel}>Опоздания</span>
              </div>
              <div className={styles.typeItem}>
                <span className={styles.typeIcon}>🚪</span>
                <span className={styles.typeCount}>{report.statistics.byType.early_leave}</span>
                <span className={styles.typeLabel}>Ранние уходы</span>
              </div>
              <div className={styles.typeItem}>
                <span className={styles.typeIcon}>❌</span>
                <span className={styles.typeCount}>{report.statistics.byType.absence}</span>
                <span className={styles.typeLabel}>Неучтенные отсутствия</span>
              </div>
              <div className={styles.typeItem}>
                <span className={styles.typeIcon}>📝</span>
                <span className={styles.typeCount}>{report.statistics.byType.missing_records}</span>
                <span className={styles.typeLabel}>Пропущенные записи</span>
              </div>
            </div>
          </div>

          {/* Основная таблица */}
          <div className={styles.tableContainer}>
            <table className={styles.reportTable}>
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>Отдел</th>
                  <th>Нарушения</th>
                  <th>Штрафные баллы</th>
                  <th>Распределение</th>
                  <th>Уровень серьезности</th>
                  <th>Детали</th>
                </tr>
              </thead>
              <tbody>
                {report.data.map((item) => (
                  <React.Fragment key={item.employee.id}>
                    <tr className={styles.tableRow}>
                      <td className={styles.employeeCell}>
                        <div className={styles.employeeName}>
                          {item.employee.fullName}
                        </div>
                        <div className={styles.employeePosition}>
                          {item.employee.position}
                        </div>
                      </td>
                      <td>
                        <span className={styles.department}>{item.employee.department}</span>
                      </td>
                      <td>
                        <div className={styles.violationsCount}>
                          {item.summary.totalViolations}
                        </div>
                      </td>
                      <td>
                        <div className={styles.penaltyPoints}>
                          {item.summary.totalPenaltyPoints}
                        </div>
                      </td>
                      <td>
                        <div className={styles.violationDistribution}>
                          {item.violations.byType.late.length > 0 && (
                            <span className={styles.distributionItem}>
                              ⏰ {item.violations.byType.late.length}
                            </span>
                          )}
                          {item.violations.byType.early_leave.length > 0 && (
                            <span className={styles.distributionItem}>
                              🚪 {item.violations.byType.early_leave.length}
                            </span>
                          )}
                          {item.violations.byType.absence.length > 0 && (
                            <span className={styles.distributionItem}>
                              ❌ {item.violations.byType.absence.length}
                            </span>
                          )}
                          {item.violations.byType.missing_records.length > 0 && (
                            <span className={styles.distributionItem}>
                              📝 {item.violations.byType.missing_records.length}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {getSeverityBadge(item.summary.severityLevel)}
                      </td>
                      <td>
                        <button 
                          className={styles.detailsButton}
                          onClick={() => toggleEmployeeDetails(item.employee.id)}
                        >
                          {expandedEmployee === item.employee.id ? '▲' : '▼'}
                        </button>
                      </td>
                    </tr>
                    
                    {expandedEmployee === item.employee.id && (
                      <tr className={styles.detailsRow}>
                        <td colSpan="7">
                          <div className={styles.employeeDetailsPanel}>
                            <h4>Детали нарушений:</h4>
                            <div className={styles.dailyViolations}>
                              {item.violations.dailyViolations.map((day, dayIndex) => (
                                <div key={dayIndex} className={styles.dayViolations}>
                                  <div className={styles.dayHeader}>
                                    <strong>{day.date}</strong>
                                    <span className={styles.violationsCount}>
                                      {day.violations.length} нарушений
                                    </span>
                                  </div>
                                  <div className={styles.violationsList}>
                                    {day.violations.map((violation, violationIndex) => (
                                      <div key={violationIndex} className={styles.violationItem}>
                                        <span className={styles.violationIcon}>
                                          {getViolationIcon(violation.type)}
                                        </span>
                                        <span className={styles.violationDescription}>
                                          {violation.description}
                                        </span>
                                        {getSeverityBadge(violation.severity)}
                                        {violation.time && (
                                          <span className={styles.violationTime}>
                                            {new Date(violation.time).toLocaleTimeString('ru-RU')}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {report.data.length === 0 && (
            <div className={styles.noData}>
              🎉 Нарушений не найдено по выбранным фильтрам!
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ViolationsReport;