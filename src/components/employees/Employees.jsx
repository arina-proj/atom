import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import styles from "./Employees.module.scss";
import API_URL from "../../config/api";

const Employees = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: "/employees" } });
      return;
    }

    fetchEmployees();
  }, [isAuthenticated, navigate]);

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

  const handleEmployeeClick = (employeeId) => {
    navigate(`/profile/${employeeId}`);
  };

  if (loading) {
    return <div className={styles.loading}>Загрузка...</div>;
  }

  return (
    <div className={styles.employees}>
      <div className={styles.header}>
        <h1>Выбор сотрудника</h1>
      </div>

      <div className={styles.employeesList}>
        {employees.map((employee) => (
          <div
            key={employee.id}
            className={styles.employeeCard}
            onClick={() => handleEmployeeClick(employee.id)}
          >
            <div className={styles.employeeAvatar}>
              {employee.fullName
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>
            <div className={styles.employeeInfo}>
              <div className={styles.employeeName}>{employee.fullName}</div>
              <div className={styles.employeePosition}>{employee.position}</div>
              <div className={styles.employeeDepartment}>
                {employee.department}
              </div>
            </div>
            <div className={styles.arrow}>→</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Employees;
