import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import styles from "./WorkTimeReport.module.scss";
import { CiExport } from "react-icons/ci";
import { MdOutlineKeyboardDoubleArrowDown, MdKeyboardDoubleArrowUp} from "react-icons/md";

const WorkTimeReport = () => {
  const { isAuthenticated } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [periodType, setPeriodType] = useState("week"); // week, month, custom
  const [startDate, setStartDate] = useState(getStartOfWeek());
  const [endDate, setEndDate] = useState(getEndOfWeek());
  const [expandedEmployee, setExpandedEmployee] = useState(null);

  // Функции для расчета дат
  function getStartOfWeek() {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(now.setDate(diff));
    return start.toISOString().split("T")[0];
  }

  function getEndOfWeek() {
    const start = new Date(getStartOfWeek());
    start.setDate(start.getDate() + 6);
    return start.toISOString().split("T")[0];
  }

  function getStartOfMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];
  }

  function getEndOfMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0];
  }

  useEffect(() => {
    if (periodType === "week") {
      setStartDate(getStartOfWeek());
      setEndDate(getEndOfWeek());
    } else if (periodType === "month") {
      setStartDate(getStartOfMonth());
      setEndDate(getEndOfMonth());
    }
  }, [periodType]);

  useEffect(() => {
    if (isAuthenticated && startDate && endDate) {
      fetchReport();
    }
  }, [startDate, endDate, isAuthenticated]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:3001/api/reports/work-time?startDate=${startDate}&endDate=${endDate}&periodType=${periodType}`
      );
      const data = await response.json();

      if (data.success) {
        setReport(data);
      } else {
        console.error("Error fetching work time report:", data.error);
        alert("Ошибка при загрузке отчета");
      }
    } catch (error) {
      console.error("Error fetching work time report:", error);
      alert("Ошибка при загрузке отчета");
    } finally {
      setLoading(false);
    }
  };

  const handlePeriodChange = (type) => {
    setPeriodType(type);
  };

  const exportToCSV = () => {
    if (!report?.data) return;

    const headers = [
      "Сотрудник",
      "Должность",
      "Отдел",
      "Рабочих дней в периоде",
      "Фактически отработано дней",
      "Отсутствовал дней",
      "Общее время работы",
      "Переработка",
      "Недоработка",
      "Сумма опозданий",
      "Количество опозданий",
      "Отклонение от плана",
      "Статус отклонения",
    ];

    const csvData = report.data.map((item) => [
      item.employee.fullName,
      item.employee.position,
      item.employee.department,
      item.periodSummary.totalWorkingDays,
      item.periodSummary.actualWorkDays,
      item.periodSummary.absentDays,
      item.timeTracking.formattedWorkedTime,
      item.timeTracking.formattedOvertime,
      item.timeTracking.formattedUndertime,
      item.violations.formattedLateTime,
      item.violations.lateCount,
      item.deviations.formattedDeviation,
      getDeviationStatusText(item.deviations.status),
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map((row) => row.map((field) => `"${field}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `work_time_report_${startDate}_to_${endDate}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getDeviationStatusText = (status) => {
    const statusMap = {
      normal: "В норме",
      overtime: "Переработка",
      undertime: "Недоработка",
      critical: "Критическая недороработка",
    };
    return statusMap[status] || status;
  };

  const getDeviationStatusClass = (status) => {
    const classMap = {
      normal: styles.normal,
      overtime: styles.overtime,
      undertime: styles.undertime,
      critical: styles.critical,
    };
    return classMap[status] || styles.normal;
  };

  const toggleEmployeeDetails = (employeeId) => {
    setExpandedEmployee(expandedEmployee === employeeId ? null : employeeId);
  };

  const formatPeriodTitle = () => {
    if (!report) return "";

    const start = new Date(report.reportPeriod.startDate);
    const end = new Date(report.reportPeriod.endDate);

    if (periodType === "week") {
      return `Неделя ${start.getDate()}-${end.getDate()} ${start.toLocaleDateString(
        "ru-RU",
        { month: "long" }
      )} ${start.getFullYear()}`;
    } else if (periodType === "month") {
      return start.toLocaleDateString("ru-RU", {
        month: "long",
        year: "numeric",
      });
    } else {
      return `${start.toLocaleDateString("ru-RU")} - ${end.toLocaleDateString(
        "ru-RU"
      )}`;
    }
  };

  if (!isAuthenticated) {
    return <div className={styles.error}>Требуется авторизация</div>;
  }

  return (
    <div className={styles.report}>
      <div className={styles.header}>
        <h1>Отчет по рабочему времени</h1>
        <div className={styles.controls}>
          <div className={styles.periodSelector}>
            <button
              className={`${styles.periodButton} ${
                periodType === "week" ? styles.active : ""
              }`}
              onClick={() => handlePeriodChange("week")}
            >
              Неделя
            </button>
            <button
              className={`${styles.periodButton} ${
                periodType === "month" ? styles.active : ""
              }`}
              onClick={() => handlePeriodChange("month")}
            >
              Месяц
            </button>
            <button
              className={`${styles.periodButton} ${
                periodType === "custom" ? styles.active : ""
              }`}
              onClick={() => handlePeriodChange("custom")}
            >
              Произвольный
            </button>
          </div>

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

          <button onClick={exportToCSV} className={styles.exportButton}>
            <CiExport />
            <div>Экспорт в CSV</div>
          </button>
        </div>
      </div>

      {loading && <div className={styles.loading}>Загрузка отчета...</div>}

      {report && (
        <>
          <div className={styles.periodInfo}>
            <h2>{formatPeriodTitle()}</h2>
            <div className={styles.periodStats}>
              <span>
                Рабочих дней: <strong>{report.reportPeriod.workingDays}</strong>
              </span>
              <span>
                Всего дней: <strong>{report.reportPeriod.totalDays}</strong>
              </span>
              <span>
                Период:{" "}
                <strong>
                  {report.reportPeriod.startDate} -{" "}
                  {report.reportPeriod.endDate}
                </strong>
              </span>
            </div>
          </div>

          <div className={styles.stats}>
            <div className={styles.statCard}>
              <span className={styles.statNumber}>
                {report.statistics.totalEmployees}
              </span>
              <span className={styles.statLabel}>Всего сотрудников</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statNumber}>
                {report.statistics.employeesWithWork}
              </span>
              <span className={styles.statLabel}>Работали в периоде</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statNumber}>
                {report.statistics.totalWorkedHours}ч
              </span>
              <span className={styles.statLabel}>Всего отработано</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statNumber}>
                {report.statistics.avgWorkHours}ч
              </span>
              <span className={styles.statLabel}>В среднем на сотрудника</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statNumber}>
                {report.statistics.overtimeEmployees}
              </span>
              <span className={styles.statLabel}>С переработкой</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statNumber}>
                {report.statistics.attendanceRate}%
              </span>
              <span className={styles.statLabel}>Уровень явки</span>
            </div>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.reportTable}>
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>Отработано дней</th>
                  <th>Общее время</th>
                  <th>Переработка</th>
                  <th>Опоздания</th>
                  <th>Отклонение от плана</th>
                  <th>Статус</th>
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
                        <div className={styles.employeeDetails}>
                          {item.employee.position} • {item.employee.department}
                          {item.schedule.isDefault && (
                            <span className={styles.defaultSchedule}>
                              (стандартное расписание)
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className={styles.daysInfo}>
                          <span className={styles.workDays}>
                            {item.periodSummary.actualWorkDays}
                          </span>
                          <span className={styles.daysSeparator}>/</span>
                          <span className={styles.totalDays}>
                            {item.periodSummary.totalWorkingDays}
                          </span>
                        </div>
                        {item.periodSummary.absentDays > 0 && (
                          <div className={styles.absentDays}>
                            ❌ {item.periodSummary.absentDays} д. отсутствия
                          </div>
                        )}
                      </td>
                      <td>
                        <div className={styles.timeValue}>
                          {item.timeTracking.formattedWorkedTime}
                        </div>
                        <div className={styles.timeDetails}>
                          ({item.timeTracking.totalWorkedHours} ч)
                        </div>
                      </td>
                      <td>
                        {item.timeTracking.totalOvertimeMinutes > 0 ? (
                          <div className={styles.overtime}>
                            +{item.timeTracking.formattedOvertime}
                          </div>
                        ) : (
                          <span className={styles.noOvertime}>—</span>
                        )}
                      </td>
                      <td>
                        {item.violations.lateCount > 0 ? (
                          <div className={styles.violationInfo}>
                            <div className={styles.lateTime}>
                              {item.violations.formattedLateTime}
                            </div>
                            <div className={styles.lateCount}>
                              {item.violations.lateCount} раз
                            </div>
                          </div>
                        ) : (
                          <span className={styles.noViolations}>—</span>
                        )}
                      </td>
                      <td>
                        <div
                          className={`${
                            styles.deviation
                          } ${getDeviationStatusClass(item.deviations.status)}`}
                        >
                          {item.deviations.formattedDeviation}
                          <div className={styles.deviationPercent}>
                            ({item.deviations.deviationPercentage}%)
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`${
                            styles.status
                          } ${getDeviationStatusClass(item.deviations.status)}`}
                        >
                          {getDeviationStatusText(item.deviations.status)}
                        </span>
                      </td>
                      <td>
                        <button
                          className={styles.detailsButton}
                          onClick={() =>
                            toggleEmployeeDetails(item.employee.id)
                          }
                        >
                          {expandedEmployee === item.employee.id ? <MdKeyboardDoubleArrowUp/> : <MdOutlineKeyboardDoubleArrowDown/>}
                        </button>
                      </td>
                    </tr>

                    {expandedEmployee === item.employee.id && (
                      <tr className={styles.detailsRow}>
                        <td colSpan="8">
                          <div className={styles.employeeDetailsPanel}>
                            <h4>Детали по дням:</h4>
                            <div className={styles.dailyDetails}>
                              {item.dailyDetails.map((day, index) => (
                                <div key={index} className={styles.dayDetail}>
                                  <div className={styles.dayHeader}>
                                    <span className={styles.dayDate}>
                                      {day.date} ({day.weekday})
                                    </span>
                                    <span
                                      className={`${styles.dayStatus} ${
                                        styles[day.summary.status]
                                      }`}
                                    >
                                      {getDayStatusText(day.summary.status)}
                                    </span>
                                  </div>
                                  <div className={styles.dayStats}>
                                    <span>
                                      Отработано:{" "}
                                      {day.summary.formattedWorkedTime}
                                    </span>
                                    <span>
                                      План: {day.summary.formattedPlannedTime}
                                    </span>
                                    {day.summary.lateMinutes > 0 && (
                                      <span className={styles.dayLate}>
                                        Опоздание:{" "}
                                        {formatHoursMinutes(
                                          day.summary.lateMinutes
                                        )}
                                      </span>
                                    )}
                                    {day.summary.earlyLeaveMinutes > 0 && (
                                      <span className={styles.dayEarly}>
                                        Ранний уход:{" "}
                                        {formatHoursMinutes(
                                          day.summary.earlyLeaveMinutes
                                        )}
                                      </span>
                                    )}
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
              Нет данных для отображения за выбранный период
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Вспомогательные функции
function formatHoursMinutes(totalMinutes) {
  const absMinutes = Math.abs(totalMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  const sign = totalMinutes < 0 ? "-" : "";
  return `${sign}${hours}ч ${minutes}м`;
}

function getDayStatusText(status) {
  const statusMap = {
    absent: "Отсутствовал",
    no_work: "Нет рабочих записей",
    overtime: "Переработка",
    normal: "Норма",
    partial: "Неполный день",
    short: "Короткий день",
  };
  return statusMap[status] || status;
}

export default WorkTimeReport;
