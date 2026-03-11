import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./AccessLogs.module.scss";
import API_URL from "../../config/api";

const AccessLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: "/logs" } });
      return;
    }
    fetchLogs();
  }, [isAuthenticated, navigate]);

  const fetchLogs = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/access-logs?limit=100`
      );
      const data = await response.json();
      setLogs(data);
    } catch (error) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getLogColor = (type) => {
    const colors = {
      успех: "#27ae60",
      ошибка: "#e74c3c",
      корректировка: "#f39c12",
      аннулирование: "#8e44ad",
    };
    return colors[type] || "#95a5a6";
  };

  const getActionEmoji = (action) => {
    const emojis = {
      приход: "🟢",
      уход: "🔴",
      редактирование: "✏️",
      удаление: "🗑️",
    };

    if (action.includes("приход")) return "🟢";
    if (action.includes("уход")) return "🔴";
    if (action.includes("редактирование") || action.includes("корректировка"))
      return "✏️";
    if (action.includes("удаление") || action.includes("аннулирование"))
      return "🗑️";

    return emojis[action] || "📝";
  };

  const getTypeDisplay = (type) => {
    const types = {
      успех: "✅ УСПЕХ",
      ошибка: "❌ ОШИБКА",
      корректировка: "✏️ КОРРЕКТИРОВКА",
      аннулирование: "🗑️ АННУЛИРОВАНИЕ",
    };
    return types[type] || type.toUpperCase();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString("ru-RU");
  };

  // Статистика для всех типов логов
  const stats = {
    total: logs.length,
    success: logs.filter((log) => log.type === "успех").length,
    error: logs.filter((log) => log.type === "ошибка").length,
    correction: logs.filter((log) => log.type === "корректировка").length,
    cancellation: logs.filter((log) => log.type === "аннулирование").length,
  };

  if (loading) {
    return <div className={styles.loading}>Загрузка журнала...</div>;
  }

  return (
    <div className={styles.logs}>
      <div className={styles.header}>
        <h1>Журнал событий системы</h1>
      </div>

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statNumber}>{stats.success}</span>
          <span className={styles.statLabel}>Успешных проходов</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statNumber}>{stats.error}</span>
          <span className={styles.statLabel}>Ошибок доступа</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statNumber}>
            {stats.correction + stats.cancellation}
          </span>
          <span className={styles.statLabel}>Операций с записями</span>
        </div>
      </div>

      <div className={styles.logsList}>
        {logs.length === 0 ? (
          <div className={styles.emptyState}>Нет записей в журнале</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className={styles.logItem}>
              <div className={styles.logHeader}>
                <span
                  className={styles.logType}
                  style={{ color: getLogColor(log.type) }}
                >
                  {getTypeDisplay(log.type)}
                </span>
                <span className={styles.logTime}>
                  {formatDate(log.timestamp)}
                </span>
              </div>

              <div className={styles.logDetails}>
                <div className={styles.employeeInfo}>
                  <strong>
                    {log.employee?.fullName ||
                      `ID: ${log.employeeId || "неизвестен"}`}
                  </strong>
                  {log.employee && (
                    <span className={styles.employeePosition}>
                      {log.employee.position}
                    </span>
                  )}
                </div>

                <div className={styles.actionInfo}>
                  <span className={styles.action}>
                    {getActionEmoji(log.action)} {log.action}
                  </span>
                  {log.reason && (
                    <div className={styles.reason}>• {log.reason}</div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AccessLogs;
