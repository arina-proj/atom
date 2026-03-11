import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./Profile.module.scss";
import API_URL from "../../config/api";

const Profile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [presenceIntervals, setPresenceIntervals] = useState([]);
  const [currentInterval, setCurrentInterval] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [isAdminVerified, setIsAdminVerified] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/profile/${id}` } });
      return;
    }
    fetchEmployeeData();
  }, [id, isAuthenticated, navigate]);

  const fetchEmployeeData = async () => {
    try {
      // Получаем данные сотрудника
      const employeeResponse = await fetch(
        `${API_URL}/api/profile/${id}`
      );
      const employeeData = await employeeResponse.json();
      setEmployee(employeeData);

      // Получаем историю посещений
      const attendanceResponse = await fetch(
        `${API_URL}/api/employees/${id}/attendance`
      );
      const attendanceData = await attendanceResponse.json();
      setAttendanceHistory(attendanceData);

      // Получаем интервалы присутствия
      await fetchPresenceIntervals();
      await fetchCurrentInterval();
    } catch (error) {
      console.error("Error fetching employee data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPresenceIntervals = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/employees/${id}/presence-intervals`
      );
      const data = await response.json();
      setPresenceIntervals(data);
    } catch (error) {
      console.error("Error fetching intervals:", error);
    }
  };

  const fetchCurrentInterval = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/employees/${id}/current-interval`
      );
      const data = await response.json();
      setCurrentInterval(data);
    } catch (error) {
      console.error("Error fetching current interval:", error);
    }
  };

  const handleDeleteClick = () => {
    if (isAdminVerified) {
      setDeleteModal(true);
    } else {
      setShowAdminPrompt(true);
    }
  };

  const verifyAdmin = () => {
    if (adminPassword === "admin123") {
      setIsAdminVerified(true);
      setShowAdminPrompt(false);
      setAdminPassword("");
      setDeleteModal(true);
    } else {
      alert("Неверный пароль администратора");
      setAdminPassword("");
    }
  };

  const closeDeleteModal = () => {
    setDeleteModal(false);
    setIsAdminVerified(false);
  };

  const closeAdminPrompt = () => {
    setShowAdminPrompt(false);
    setAdminPassword("");
  };

  const confirmDelete = async () => {
    try {
      const response = await fetch(`${API_URL}/api/employees/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        alert("Сотрудник успешно удален!");
        navigate("/employees");
      } else {
        alert(`Ошибка: ${result.error}\n${result.details || ""}`);
        closeDeleteModal();
      }
    } catch (error) {
      console.error("Error deleting employee:", error);
      alert("Произошла ошибка при удалении сотрудника");
      closeDeleteModal();
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "working":
        return "#27ae60";
      case "left":
        return "#e74c3c";
      case "lunch":
        return "#f39c12";
      case "break":
        return "#3498db";
      default:
        return "#95a5a6";
    }
  };

  if (loading) {
    return <div className={styles.loading}>Загрузка...</div>;
  }

  if (!employee) {
    return <div className={styles.error}>Сотрудник не найден</div>;
  }

  return (
    <div className={styles.profile}>
      {/* Модальное окно ввода пароля администратора */}
      {showAdminPrompt && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Требуется подтверждение</h3>
            <p>Для удаления сотрудника введите пароль администратора:</p>
            <div className={styles.passwordInput}>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Введите пароль администратора"
                className={styles.passwordField}
              />
            </div>
            <div className={styles.modalActions}>
              <button className={styles.confirmButton} onClick={verifyAdmin}>
                Подтвердить
              </button>
              <button
                className={styles.cancelButton}
                onClick={closeAdminPrompt}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно подтверждения удаления */}
      {deleteModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Подтверждение удаления</h3>
            <p>Вы уверены, что хотите удалить этого сотрудника?</p>
            <div className={styles.employeeInfo}>
              <p>
                <strong>Сотрудник:</strong> {employee.fullName}
              </p>
              <p>
                <strong>Должность:</strong> {employee.position}
              </p>
              <p>
                <strong>Отдел:</strong> {employee.department}
              </p>
              <p className={styles.warning}>⚠️ Это действие нельзя отменить!</p>
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.deleteConfirmButton}
                onClick={confirmDelete}
              >
                Да, удалить
              </button>
              <button
                className={styles.cancelButton}
                onClick={closeDeleteModal}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.header}>
        
        <h1>Профиль сотрудника</h1>
        <button className={styles.deleteButton} onClick={handleDeleteClick}>
          🗑️ Удалить сотрудника
        </button>
      </div>

      {/* Остальной код профиля без изменений */}
      <div className={styles.profileCard}>
        <div className={styles.employeeInfo}>
          <div className={styles.details}>
            <h2>{employee.fullName}</h2>
            <div className={styles.meta}>
              <span className={styles.position}>{employee.position}</span>
              <span className={styles.department}>{employee.department}</span>
            </div>
            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Дата приема:</span>
                <span className={styles.statValue}>
                  {new Date(employee.hireDate).toLocaleDateString("ru-RU")}
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>Статус:</span>
                <span
                  className={styles.statusBadge}
                  style={{ backgroundColor: getStatusColor(employee.status) }}
                >
                  {employee.status === "working"
                    ? "На объекте"
                    : employee.status === "left"
                    ? "Не на объекте"
                    : employee.status === "lunch"
                    ? "Обед"
                    : "Перерыв"}
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statLabel}>ID:</span>
                <span className={styles.statValue}>{employee.id}</span>
              </div>
            </div>

            {/* Секция интервалов присутствия */}
            <div className={styles.intervalsSection}>
              <h3>Интервалы присутствия</h3>

              {currentInterval?.hasActiveInterval && (
                <div className={styles.currentInterval}>
                  <h4>Текущее присутствие</h4>
                  <div className={styles.intervalInfo}>
                    <span>
                      Начало: {formatDate(currentInterval.arrivalTime)}
                    </span>
                    <span>Прошло: {currentInterval.formattedDuration}</span>
                  </div>
                </div>
              )}

              {presenceIntervals.length === 0 ? (
                <p className={styles.noData}>Нет данных о присутствии</p>
              ) : (
                <div className={styles.intervalsList}>
                  {presenceIntervals.map((interval) => (
                    <div key={interval.id} className={styles.intervalItem}>
                      <div className={styles.intervalTime}>
                        <span>🟢 {formatDate(interval.arrivalTime)}</span>
                        <span>🔴 {formatDate(interval.departureTime)}</span>
                      </div>
                      <div className={styles.intervalDuration}>
                        <strong>{interval.formattedDuration}</strong>
                        {interval.reason && <span>({interval.reason})</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.attendanceSection}>
        <h3>История посещений</h3>
        {attendanceHistory.length === 0 ? (
          <p className={styles.noData}>Нет данных о посещениях</p>
        ) : (
          <div className={styles.attendanceList}>
            {attendanceHistory.map((record) => (
              <div key={record.id} className={styles.attendanceItem}>
                <div className={styles.attendanceType}>
                  <span
                    className={
                      record.type === "приход"
                        ? styles.arrival
                        : styles.departure
                    }
                  >
                    {record.type === "приход" ? "🟢 Приход" : "🔴 Уход"}
                  </span>
                  {record.reason && record.type === "уход" && (
                    <span className={styles.reason}>({record.reason})</span>
                  )}
                </div>
                <div className={styles.attendanceTime}>
                  {formatDate(record.timestamp)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
