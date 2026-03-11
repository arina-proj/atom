import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import styles from "./DailyAttendanceReport.module.scss";
import { CiExport } from "react-icons/ci";
import { MdKeyboardArrowDown } from "react-icons/md";
import API_URL from "../config/api";
const DailyAttendanceReport = () => {
  const { isAuthenticated } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [filter, setFilter] = useState("all"); // all, present, absent, late

  useEffect(() => {
    if (isAuthenticated) {
      fetchReport();
    }
  }, [selectedDate, isAuthenticated]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/reports/daily-attendance?date=${selectedDate}`
      );
      const data = await response.json();

      if (data.success) {
        setReport(data);
      } else {
        console.error("Error fetching report:", data.error);
        alert("Ошибка при загрузке отчета");
      }
    } catch (error) {
      console.error("Error fetching report:", error);
      alert("Ошибка при загрузке отчета");
    } finally {
      setLoading(false);
    }
  };

  const filteredData = () => {
    if (!report?.data) return [];

    switch (filter) {
      case "present":
        return report.data.filter((item) => item.status.isPresent);
      case "absent":
        return report.data.filter((item) => item.status.isAbsent);
      case "late":
        return report.data.filter((item) => item.status.isLate);
      case "early":
        return report.data.filter((item) => item.status.isEarlyLeave);
      default:
        return report.data;
    }
  };

  const exportToCSV = () => {
    if (!report?.data) return;

    const headers = [
      "Сотрудник",
      "Должность",
      "Отдел",
      "Первое время прихода",
      "Последнее время ухода",
      "Общее время присутствия",
      "Статус",
      "Опоздание",
      "Ранний уход",
      "Примечания",
    ];

    const csvData = report.data.map((item) => [
      item.employee.fullName,
      item.employee.position,
      item.employee.department,
      item.attendance.firstArrival
        ? new Date(item.attendance.firstArrival).toLocaleTimeString("ru-RU")
        : "Отсутствует",
      item.attendance.lastDeparture
        ? new Date(item.attendance.lastDeparture).toLocaleTimeString("ru-RU")
        : "Отсутствует",
      item.attendance.formattedPresence,
      item.status.isAbsent
        ? "Отсутствует"
        : item.status.isPresent
        ? "На месте"
        : "Ушел",
      item.status.isLate
        ? `Опоздание на ${item.violations.lateMinutes} мин`
        : "Нет",
      item.status.isEarlyLeave
        ? `Ранний уход на ${item.violations.earlyLeaveMinutes} мин`
        : "Нет",
      getViolationNotes(item),
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map((row) => row.map((field) => `"${field}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance_report_${selectedDate}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getViolationNotes = (item) => {
    const notes = [];
    if (item.status.isLate)
      notes.push(`Опоздание: ${item.violations.lateMinutes} мин`);
    if (item.status.isEarlyLeave)
      notes.push(`Ранний уход: ${item.violations.earlyLeaveMinutes} мин`);
    if (item.status.isAbsent) notes.push("Отсутствует");
    if (item.violations.missingRecords.missingArrival)
      notes.push("Нет записи прихода");
    if (item.violations.missingRecords.missingDeparture)
      notes.push("Нет записи ухода");

    return notes.join("; ");
  };

  const getStatusBadge = (item) => {
    if (item.status.isAbsent) {
      return { text: "Отсутствует", class: styles.absent };
    }
    if (item.status.isPresent) {
      return { text: "На объекте", class: styles.present };
    }
    return { text: "Ушел", class: styles.left };
  };

  if (!isAuthenticated) {
    return <div className={styles.error}>Требуется авторизация</div>;
  }

  return (
    <div className={styles.report}>
      <div className={styles.header}>
        <h1>Ежедневный отчет о явке</h1>
        <div className={styles.controls}>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={styles.datePicker}
          />
          <div className={styles.customSelect}>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className={styles.filter}
            >
              <option value="all">Все сотрудники</option>
              <option value="present">На объекте</option>
              <option value="absent">Отсутствуют</option>
              <option value="late">Опоздавшие</option>
              <option value="early">Ранние уходы</option>
            </select>
            <MdKeyboardArrowDown/>
          </div>
          <button onClick={exportToCSV} className={styles.exportButton}>
            <CiExport />
            <div>Экспорт в CSV</div>
          </button>
          <button onClick={fetchReport} className={styles.refreshButton}>
            🔄 Обновить
          </button>
        </div>
      </div>

      {loading && <div className={styles.loading}>Загрузка отчета...</div>}

      {report && (
        <>
          <div className={styles.stats}>
            <div className={styles.statCard}>
              <span className={styles.statNumber}>
                {report.statistics.totalEmployees}
              </span>
              <span className={styles.statLabel}>Всего сотрудников</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statNumber}>
                {report.statistics.presentEmployees}
              </span>
              <span className={styles.statLabel}>На объекте</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statNumber}>
                {report.statistics.absentEmployees}
              </span>
              <span className={styles.statLabel}>Отсутствуют</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statNumber}>
                {report.statistics.lateEmployees}
              </span>
              <span className={styles.statLabel}>Опоздали</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statNumber}>
                {report.statistics.earlyLeaveEmployees}
              </span>
              <span className={styles.statLabel}>Ранние уходы</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statNumber}>
                {report.statistics.attendanceRate}%
              </span>
              <span className={styles.statLabel}>Явка</span>
            </div>
          </div>

          <div className={styles.reportDate}>
            Отчет за:{" "}
            {new Date(selectedDate).toLocaleDateString("ru-RU", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.reportTable}>
              <thead>
                <tr>
                  <th>Сотрудник</th>
                  <th>Должность</th>
                  <th>Приход</th>
                  <th>Уход</th>
                  <th>Время присутствия</th>
                  <th>Статус</th>
                  <th>Нарушения</th>
                </tr>
              </thead>
              <tbody>
                {filteredData().map((item) => {
                  const status = getStatusBadge(item);
                  return (
                    <tr key={item.employee.id} className={styles.tableRow}>
                      <td className={styles.employeeCell}>
                        <div className={styles.employeeName}>
                          {item.employee.fullName}
                        </div>
                        <div className={styles.employeeDepartment}>
                          {item.employee.department}
                        </div>
                      </td>
                      <td>{item.employee.position}</td>
                      <td>
                        {item.attendance.firstArrival ? (
                          new Date(
                            item.attendance.firstArrival
                          ).toLocaleTimeString("ru-RU")
                        ) : (
                          <span className={styles.missing}>—</span>
                        )}
                        {item.status.isLate && (
                          <div className={styles.lateBadge}>
                            🕒 +{item.violations.lateMinutes}м
                          </div>
                        )}
                      </td>
                      <td>
                        {item.attendance.lastDeparture ? (
                          new Date(
                            item.attendance.lastDeparture
                          ).toLocaleTimeString("ru-RU")
                        ) : (
                          <span className={styles.missing}>—</span>
                        )}
                        {item.status.isEarlyLeave && (
                          <div className={styles.earlyBadge}>
                            🕒 -{item.violations.earlyLeaveMinutes}м
                          </div>
                        )}
                      </td>
                      <td>
                        <div className={styles.presenceTime}>
                          {item.attendance.formattedPresence}
                        </div>
                        {item.attendance.intervals.length > 1 && (
                          <div className={styles.intervalsCount}>
                            {item.attendance.intervals.length} интервалов
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          className={`${styles.statusBadge} ${status.class}`}
                        >
                          {status.text}
                        </span>
                      </td>
                      <td>
                        <div className={styles.violations}>
                          {item.status.isAbsent && (
                            <span className={styles.violation}>
                              ❌ Отсутствует
                            </span>
                          )}
                          {item.violations.missingRecords.missingArrival && (
                            <span className={styles.violation}>
                              ⚠️ Нет прихода
                            </span>
                          )}
                          {item.violations.missingRecords.missingDeparture && (
                            <span className={styles.violation}>
                              ⚠️ Нет ухода
                            </span>
                          )}
                          {!item.status.isAbsent &&
                            !item.violations.missingRecords.missingArrival &&
                            !item.violations.missingRecords.missingDeparture &&
                            !item.status.isLate &&
                            !item.status.isEarlyLeave && (
                              <span className={styles.noViolations}>
                                ✅ Нет нарушений
                              </span>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredData().length === 0 && (
            <div className={styles.noData}>
              Нет данных для отображения по выбранному фильтру
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DailyAttendanceReport;
