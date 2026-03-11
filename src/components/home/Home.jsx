import React, { useState, useEffect } from "react";
import useOnClickOutside from "../../hooks/useOnClickOutside";
import styles from "./Home.module.scss";
import API_URL from "../../config/api";

const Home = () => {
  const [activeForm, setActiveForm] = useState(null);
  const [employeeId, setEmployeeId] = useState("");
  const [leaveType, setLeaveType] = useState("уход");
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all"); // 'all' или 'working'

  // Хук для закрытия при клике вне области
  const { ref: formRef } = useOnClickOutside(() => {
    setActiveForm(null);
    setEmployeeId("");
  });

  // Загрузка сотрудников из базы данных
  const fetchEmployees = async () => {
    try {
      const response = await fetch(`${API_URL}/api/employees`);
      const data = await response.json();
      setEmployees(data);
    } catch (error) {
      console.error("Error fetching employees:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  // Функция для проверки, находится ли сотрудник на объекте
  const isEmployeeOnSite = (status) => {
    return (
      status === "на объекте" || status === "На объекте" || status === "working"
    );
  };

  // Функция для красивого отображения статуса
  const getStatusDisplay = (status) => {
    const statusMap = {
      "на объекте": "На объекте",
      "На объекте": "На объекте",
      working: "На объекте",
      ушёл: "Не на объекте",
      уход: "Не на объекте",
      обед: "Обед",
      перерыв: "Перерыв",
    };
    return statusMap[status] || status;
  };

  const handleArrivalClick = () => {
    setActiveForm(activeForm === "arrival" ? null : "arrival");
    setEmployeeId("");
  };

  const handleLeaveClick = () => {
    setActiveForm(activeForm === "leave" ? null : "leave");
    setEmployeeId("");
    setLeaveType("уход");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: parseInt(employeeId),
          type: activeForm === "arrival" ? "приход" : "уход",
          reason: activeForm === "leave" ? leaveType : null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Успех
        alert(result.message);
        fetchEmployees(); // Обновляем список
        setEmployeeId("");
        setActiveForm(null);
      } else {
        // Ошибка валидации
        alert(`Ошибка: ${result.error}\n${result.details}`);
      }
    } catch (error) {
      console.error("Error submitting attendance:", error);
      alert("Произошла ошибка при отправке данных");
    }
  };

  // Фильтруем сотрудников по активной вкладке
  const filteredEmployees =
    activeTab === "working"
      ? employees.filter((emp) => isEmployeeOnSite(emp.status))
      : employees;

  // Статистика из реальных данных
  const stats = {
    total: employees.length,
    onSite: employees.filter((emp) => isEmployeeOnSite(emp.status)).length,
  };

  if (loading) {
    return <div className={styles.loading}>Загрузка...</div>;
  }

  return (
    <div className={styles.home}>
      <div className={styles.statsSection}>
        <h1 className={styles.mainTitle}>Контроль объекта</h1>
        <p className={styles.subtitle}>Управление сотрудниками</p>

        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statNumber}>{stats.total}</div>
            <div className={styles.statLabel}>Всего сотрудников</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statNumber}>{stats.onSite}</div>
            <div className={styles.statLabel}>На объекте</div>
          </div>
        </div>

        <div className={styles.attendanceSection} ref={formRef}>
          <h2 className={styles.sectionTitle}>Отметить приход</h2>
          <div className={styles.attendanceButtons}>
            <button
              className={`${styles.attendanceButton} ${
                activeForm === "arrival" ? styles.active : ""
              }`}
              onClick={handleArrivalClick}
              type="button"
            >
              Я на объекте
            </button>
            <button
              className={`${styles.leaveButton} ${
                activeForm === "leave" ? styles.active : ""
              }`}
              onClick={handleLeaveClick}
              type="button"
            >
              Ушёл
            </button>
          </div>

          {/* Форма для прибытия */}
          {activeForm === "arrival" && (
            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label htmlFor="arrivalId">ID сотрудника:</label>
                <input
                  type="number"
                  id="arrivalId"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="Введите ваш ID"
                  required
                  autoFocus
                />
              </div>
              <button type="submit" className={styles.submitButton}>
                Отметить прибытие
              </button>
            </form>
          )}

          {/* Форма для ухода */}
          {activeForm === "leave" && (
            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label htmlFor="leaveId">ID сотрудника:</label>
                <input
                  type="number"
                  id="leaveId"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="Введите ваш ID"
                  required
                  autoFocus
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="leaveType">Причина ухода:</label>
                <select
                  id="leaveType"
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className={styles.select}
                >
                  <option value="уход">Уход</option>
                  <option value="обед">Обед</option>
                  <option value="перерыв">Перерыв</option>
                </select>
              </div>
              <button type="submit" className={styles.submitButton}>
                Отметить уход
              </button>
            </form>
          )}
        </div>
      </div>

      <div className={styles.divider}></div>

      <div className={styles.listSection}>
        {/* Вкладки */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${
              activeTab === "all" ? styles.active : ""
            }`}
            onClick={() => setActiveTab("all")}
          >
            Все сотрудники ({employees.length})
          </button>
          <button
            className={`${styles.tab} ${
              activeTab === "working" ? styles.active : ""
            }`}
            onClick={() => setActiveTab("working")}
          >
            На объекте ({stats.onSite})
          </button>
        </div>

        <div className={styles.employeesList}>
          {filteredEmployees.length === 0 ? (
            <div className={styles.emptyState}>
              {activeTab === "working"
                ? "Нет сотрудников на объекте"
                : "Нет сотрудников"}
            </div>
          ) : (
            filteredEmployees.map((employee) => (
              <div key={employee.id} className={styles.employeeCard}>
                <div className={styles.employeeMain}>
                  <div className={styles.employeeName}>{employee.fullName}</div>
                  <div className={styles.employeePosition}>
                    {employee.position}
                  </div>

                  <div className={styles.employeeDepartment}>
                    Отдел: {employee.department}
                  </div>
                </div>

                <div className={styles.statusSection}>
                  <div
                    className={
                      isEmployeeOnSite(employee.status)
                        ? styles.statusBadge
                        : `${styles.statusBadge} ${styles.away}`
                    }
                  >
                    {getStatusDisplay(employee.status)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
