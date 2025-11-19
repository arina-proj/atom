import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import styles from './Stats.module.scss';

const Stats = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [attendanceData, setAttendanceData] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('records');
  const [records, setRecords] = useState([]);
  const [cancelledRecords, setCancelledRecords] = useState([]);
  const [showManualForm, setShowManualForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [cancelModal, setCancelModal] = useState({
    show: false,
    recordId: null,
    recordInfo: null
  });
  const [editReasonModal, setEditReasonModal] = useState({
    show: false,
    recordId: null,
    newTimestamp: null
  });
  const [manualForm, setManualForm] = useState({
    employeeId: '',
    type: 'приход',
    timestamp: new Date().toISOString().slice(0, 16),
    reason: '',
    notes: ''
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/stats' } });
      return;
    }
    fetchEmployees();
    if (activeTab === 'stats') {
      fetchAttendanceData();
    } else if (activeTab === 'records') {
      fetchAttendanceRecords();
    } else if (activeTab === 'cancelled') {
      fetchCancelledRecords();
    }
  }, [isAuthenticated, navigate, activeTab]);

  const fetchEmployees = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/employees');
      const data = await response.json();
      setEmployees(data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      let url = 'http://localhost:3001/api/attendance/stats';
      const params = new URLSearchParams();
      
      if (selectedEmployee) {
        params.append('employeeId', selectedEmployee);
      }
      if (dateRange.startDate) {
        params.append('startDate', dateRange.startDate);
      }
      if (dateRange.endDate) {
        params.append('endDate', dateRange.endDate);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      setAttendanceData(data);
    } catch (error) {
      console.error('Error fetching attendance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceRecords = async () => {
    try {
      setLoading(true);
      let url = 'http://localhost:3001/api/attendance/records';
      const params = new URLSearchParams();
      
      if (selectedEmployee) {
        params.append('employeeId', selectedEmployee);
      }
      if (dateRange.startDate) {
        params.append('startDate', dateRange.startDate);
      }
      if (dateRange.endDate) {
        params.append('endDate', dateRange.endDate);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      setRecords(data.attendance || []);
    } catch (error) {
      console.error('Error fetching attendance records:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCancelledRecords = async () => {
    try {
      setLoading(true);
      let url = 'http://localhost:3001/api/attendance/cancelled';
      const params = new URLSearchParams();
      
      if (selectedEmployee) {
        params.append('employeeId', selectedEmployee);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      setCancelledRecords(data);
    } catch (error) {
      console.error('Error fetching cancelled records:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = () => {
    if (activeTab === 'stats') {
      fetchAttendanceData();
    } else if (activeTab === 'records') {
      fetchAttendanceRecords();
    } else if (activeTab === 'cancelled') {
      fetchCancelledRecords();
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:3001/api/attendance/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...manualForm,
          correctedBy: user?.username || 'Администратор'
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert('Запись успешно добавлена');
        setShowManualForm(false);
        setManualForm({
          employeeId: '',
          type: 'приход',
          timestamp: new Date().toISOString().slice(0, 16),
          reason: '',
          notes: ''
        });
        fetchAttendanceRecords();
      } else {
        alert(`Ошибка: ${result.error}`);
      }
    } catch (error) {
      console.error('Error creating manual record:', error);
      alert('Произошла ошибка при создании записи');
    }
  };

  const handleEditRecord = async (recordId, newTimestamp, reason) => {
    try {
      const response = await fetch(`http://localhost:3001/api/attendance/records/${recordId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timestamp: newTimestamp,
          reason,
          correctedBy: user?.username || 'Администратор'
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert('Время записи успешно обновлено');
        setEditingRecord(null);
        setEditReasonModal({ show: false, recordId: null, newTimestamp: null });
        fetchAttendanceRecords();
      } else {
        alert(`Ошибка: ${result.error}`);
      }
    } catch (error) {
      console.error('Error updating record:', error);
      alert('Произошла ошибка при обновлении записи');
    }
  };

  const handleCancelRecord = async (recordId, reason) => {
    if (!reason) {
      alert('Укажите причину аннулирования');
      return;
    }

    try {
      const response = await fetch(`http://localhost:3001/api/attendance/records/${recordId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason,
          correctedBy: user?.username || 'Администратор'
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert('Запись успешно аннулирована');
        setCancelModal({ show: false, recordId: null, recordInfo: null });
        fetchAttendanceRecords();
        fetchCancelledRecords();
      } else {
        alert(`Ошибка: ${result.error}`);
      }
    } catch (error) {
      console.error('Error cancelling record:', error);
      alert('Произошла ошибка при аннулировании записи');
    }
  };

  const openCancelModal = (recordId, recordInfo) => {
    setCancelModal({
      show: true,
      recordId,
      recordInfo
    });
  };

  const closeCancelModal = () => {
    setCancelModal({
      show: false,
      recordId: null,
      recordInfo: null
    });
  };

  const openEditReasonModal = (recordId, newTimestamp) => {
    setEditReasonModal({
      show: true,
      recordId,
      newTimestamp
    });
  };

  const closeEditReasonModal = () => {
    setEditReasonModal({
      show: false,
      recordId: null,
      newTimestamp: null
    });
    setEditingRecord(null);
  };

  const confirmCancelRecord = () => {
    const reason = prompt('Укажите причину аннулирования записи:');
    if (reason) {
      handleCancelRecord(cancelModal.recordId, reason);
    } else {
      closeCancelModal();
    }
  };

  const confirmEditRecord = () => {
    const reason = document.getElementById('editReason').value;
    if (reason) {
      handleEditRecord(editReasonModal.recordId, editReasonModal.newTimestamp, reason);
    } else {
      alert('Укажите причину корректировки');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ru-RU');
  };

  const getStatusBadge = (record) => {
    if (record.isLate) return <span className={styles.lateBadge}>⚠️ Опоздание</span>;
    if (record.isEarlyLeave) return <span className={styles.earlyBadge}>🚪 Ранний уход</span>;
    if (record.isReentry) return <span className={styles.reentryBadge}>🔄 Повторный</span>;
    if (record.isManual) return <span className={styles.manualBadge}>✏️ Ручная</span>;
    return <span className={styles.normalBadge}>✅ Норма</span>;
  };

  const renderStatsTab = () => (
    <>
      <div className={styles.tableContainer}>
        {loading ? (
          <div className={styles.loading}>Загрузка...</div>
        ) : (
          <table className={styles.statsTable}>
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Должность</th>
                <th>Тип</th>
                <th>Время</th>
                <th>Причина</th>
                <th>Статус</th>
                <th>Заметки</th>
              </tr>
            </thead>
            <tbody>
              {attendanceData.length === 0 ? (
                <tr>
                  <td colSpan="7" className={styles.noData}>
                    Нет данных за выбранный период
                  </td>
                </tr>
              ) : (
                attendanceData.map(record => (
                  <tr key={record.id}>
                    <td className={styles.employeeName}>
                      {record.employee?.fullName || `ID: ${record.employeeId}`}
                    </td>
                    <td>{record.employee?.position || '-'}</td>
                    <td>
                      <span className={
                        record.type === 'приход' ? styles.arrival : styles.departure
                      }>
                        {record.type === 'приход' ? '🟢 Приход' : '🔴 Уход'}
                      </span>
                    </td>
                    <td>{formatDate(record.timestamp)}</td>
                    <td>{record.reason || '-'}</td>
                    <td>{getStatusBadge(record)}</td>
                    <td>{record.notes || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {attendanceData.length > 0 && (
        <div className={styles.summary}>
          <h3>Сводка</h3>
          <div className={styles.summaryStats}>
            <div className={styles.summaryItem}>
              <span className={styles.summaryNumber}>{attendanceData.length}</span>
              <span className={styles.summaryLabel}>Всего записей</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryNumber}>
                {attendanceData.filter(r => r.type === 'приход').length}
              </span>
              <span className={styles.summaryLabel}>Приходов</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryNumber}>
                {attendanceData.filter(r => r.type === 'уход').length}
              </span>
              <span className={styles.summaryLabel}>Уходов</span>
            </div>
            <div className={styles.summaryItem}>
              <span className={styles.summaryNumber}>
                {attendanceData.filter(r => r.isLate || r.isEarlyLeave || r.isReentry).length}
              </span>
              <span className={styles.summaryLabel}>Нарушений</span>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const renderRecordsTab = () => (
    <>
      <div className={styles.recordsHeader}>
        <button 
          className={styles.addButton}
          onClick={() => setShowManualForm(true)}
        >
          + Добавить запись вручную
        </button>
      </div>

      {showManualForm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Добавление записи вручную</h3>
            <form onSubmit={handleManualSubmit}>
              <div className={styles.formGroup}>
                <label>Сотрудник:</label>
                <select 
                  value={manualForm.employeeId}
                  onChange={(e) => setManualForm(prev => ({...prev, employeeId: e.target.value}))}
                  required
                >
                  <option value="">Выберите сотрудника</option>
                  {employees.map(employee => (
                    <option key={employee.id} value={employee.id}>
                      {employee.fullName} ({employee.position})
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Тип:</label>
                <select 
                  value={manualForm.type}
                  onChange={(e) => setManualForm(prev => ({...prev, type: e.target.value}))}
                >
                  <option value="приход">Приход</option>
                  <option value="уход">Уход</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Дата и время:</label>
                <input 
                  type="datetime-local"
                  value={manualForm.timestamp}
                  onChange={(e) => setManualForm(prev => ({...prev, timestamp: e.target.value}))}
                  required
                />
              </div>

              {manualForm.type === 'уход' && (
                <div className={styles.formGroup}>
                  <label>Причина ухода:</label>
                  <select 
                    value={manualForm.reason}
                    onChange={(e) => setManualForm(prev => ({...prev, reason: e.target.value}))}
                  >
                    <option value="уход">Уход</option>
                    <option value="обед">Обед</option>
                    <option value="перерыв">Перерыв</option>
                  </select>
                </div>
              )}

              <div className={styles.formGroup}>
                <label>Заметки:</label>
                <textarea 
                  value={manualForm.notes}
                  onChange={(e) => setManualForm(prev => ({...prev, notes: e.target.value}))}
                  rows="3"
                />
              </div>

              <div className={styles.modalActions}>
                <button type="submit" className={styles.saveButton}>
                  Сохранить
                </button>
                <button 
                  type="button" 
                  className={styles.cancelButton}
                  onClick={() => setShowManualForm(false)}
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {cancelModal.show && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Подтверждение аннулирования</h3>
            <p>Вы уверены, что хотите аннулировать эту запись?</p>
            {cancelModal.recordInfo && (
              <div className={styles.recordInfo}>
                <p><strong>Сотрудник:</strong> {cancelModal.recordInfo.employeeName}</p>
                <p><strong>Тип:</strong> {cancelModal.recordInfo.type === 'приход' ? 'Приход' : 'Уход'}</p>
                <p><strong>Время:</strong> {formatDate(cancelModal.recordInfo.timestamp)}</p>
              </div>
            )}
            <div className={styles.modalActions}>
              <button 
                className={styles.deleteButton}
                onClick={confirmCancelRecord}
              >
                Да, аннулировать
              </button>
              <button 
                className={styles.cancelButton}
                onClick={closeCancelModal}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {editReasonModal.show && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Причина корректировки</h3>
            <div className={styles.formGroup}>
              <label>Укажите причину изменения времени:</label>
              <textarea 
                id="editReason"
                rows="3"
                placeholder="Введите причину корректировки..."
                className={styles.reasonTextarea}
              />
            </div>
            <div className={styles.modalActions}>
              <button 
                className={styles.saveButton}
                onClick={confirmEditRecord}
              >
                Сохранить
              </button>
              <button 
                className={styles.cancelButton}
                onClick={closeEditReasonModal}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.tableContainer}>
        {loading ? (
          <div className={styles.loading}>Загрузка...</div>
        ) : (
          <table className={styles.statsTable}>
            <thead>
              <tr>
                <th>Сотрудник</th>
                <th>Тип</th>
                <th>Время</th>
                <th>Причина</th>
                <th>Статус</th>
                <th>Заметки</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan="7" className={styles.noData}>
                    Нет записей за выбранный период
                  </td>
                </tr>
              ) : (
                records.map(record => (
                  <tr key={record.id}>
                    <td className={styles.employeeName}>
                      {record.employee?.fullName || `ID: ${record.employeeId}`}
                    </td>
                    <td>
                      <span className={
                        record.type === 'приход' ? styles.arrival : styles.departure
                      }>
                        {record.type === 'приход' ? '🟢 Приход' : '🔴 Уход'}
                      </span>
                    </td>
                    <td>
                      {editingRecord === record.id ? (
                        <input 
                          type="datetime-local"
                          defaultValue={new Date(record.timestamp).toISOString().slice(0, 16)}
                          onBlur={(e) => {
                            openEditReasonModal(record.id, e.target.value);
                          }}
                          autoFocus
                        />
                      ) : (
                        <span 
                          className={styles.editableTime}
                          onClick={() => setEditingRecord(record.id)}
                          title="Нажмите для редактирования времени"
                        >
                          {formatDate(record.timestamp)}
                        </span>
                      )}
                    </td>
                    <td>{record.reason || '-'}</td>
                    <td>{getStatusBadge(record)}</td>
                    <td>{record.notes || '-'}</td>
                    <td>
                      <button 
                        className={styles.cancelRecordButton}
                        onClick={() => openCancelModal(record.id, {
                          employeeName: record.employee?.fullName || `ID: ${record.employeeId}`,
                          type: record.type,
                          timestamp: record.timestamp
                        })}
                        title="Аннулировать запись"
                      >
                        ❌
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );

  const renderCancelledTab = () => (
    <div className={styles.tableContainer}>
      {loading ? (
        <div className={styles.loading}>Загрузка...</div>
      ) : (
        <table className={styles.statsTable}>
          <thead>
            <tr>
              <th>Сотрудник</th>
              <th>Тип</th>
              <th>Оригинальное время</th>
              <th>Причина аннулирования</th>
              <th>Кто аннулировал</th>
              <th>Когда аннулировано</th>
            </tr>
          </thead>
          <tbody>
            {cancelledRecords.length === 0 ? (
              <tr>
                <td colSpan="6" className={styles.noData}>
                  Нет аннулированных записей
                </td>
              </tr>
            ) : (
              cancelledRecords.map(record => (
                <tr key={record.id}>
                  <td className={styles.employeeName}>
                    {record.employee?.fullName || `ID: ${record.employeeId}`}
                  </td>
                  <td>
                    <span className={
                      record.type === 'приход' ? styles.arrival : styles.departure
                    }>
                      {record.type === 'приход' ? '🟢 Приход' : '🔴 Уход'}
                    </span>
                  </td>
                  <td>{formatDate(record.originalTimestamp)}</td>
                  <td>{record.reason}</td>
                  <td>{record.cancelledBy}</td>
                  <td>{formatDate(record.cancelledAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className={styles.stats}>
      <div className={styles.header}>
        
        <h1>Управление записями посещений</h1>
      </div>

      <div className={styles.tabs}>
        
        <button 
          className={`${styles.tab} ${activeTab === 'records' ? styles.active : ''}`}
          onClick={() => setActiveTab('records')}
        >
          📝 Все записи
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'cancelled' ? styles.active : ''}`}
          onClick={() => setActiveTab('cancelled')}
        >
          🗑️ Аннулированные
        </button>
      </div>

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label>Сотрудник:</label>
          <select 
            value={selectedEmployee} 
            onChange={(e) => setSelectedEmployee(e.target.value)}
          >
            <option value="">Все сотрудники</option>
            {employees.map(employee => (
              <option key={employee.id} value={employee.id}>
                {employee.fullName} ({employee.position})
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label>С:</label>
          <input 
            type="date" 
            value={dateRange.startDate}
            onChange={(e) => setDateRange(prev => ({...prev, startDate: e.target.value}))}
          />
        </div>

        <div className={styles.filterGroup}>
          <label>По:</label>
          <input 
            type="date" 
            value={dateRange.endDate}
            onChange={(e) => setDateRange(prev => ({...prev, endDate: e.target.value}))}
          />
        </div>

        <button 
          className={styles.applyButton}
          onClick={handleFilterChange}
        >
          Применить
        </button>
      </div>

      {activeTab === 'stats' && renderStatsTab()}
      {activeTab === 'records' && renderRecordsTab()}
      {activeTab === 'cancelled' && renderCancelledTab()}
    </div>
  );
};

export default Stats;