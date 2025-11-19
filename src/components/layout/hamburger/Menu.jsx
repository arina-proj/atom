import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts/AuthContext";
import styles from "./Menu.module.scss";

const Menu = ({ isShow, setIsShow }) => {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();

  const handleMenuItemClick = (path) => {
    navigate(path);
    setIsShow(false);
  };

  const handleLogout = () => {
    logout();
    setIsShow(false);
    navigate("/");
  };

  if (!isShow) return null;

  return (
    <div className={styles.menu}>
      <div className={styles.menuItem} onClick={() => handleMenuItemClick("/")}>
        🏠 Главная
      </div>

      {isAuthenticated ? (
        <>
          <div
            className={styles.menuItem}
            onClick={() => handleMenuItemClick("/registration")}
          >
            📝 Новый сотрудник
          </div>

          <div
            className={styles.menuItem}
            onClick={() => handleMenuItemClick("/employees")}
          >
            👥 Список сотрудников
          </div>
          <div
            className={styles.menuItem}
            onClick={() => handleMenuItemClick("/logs")}
          >
            📊 Журнал проходов
          </div>
          <div
            className={styles.menuItem}
            onClick={() => handleMenuItemClick("/stats")}
          >
            📈 Статистика
          </div>
          <div
            className={styles.menuItem}
            onClick={() => handleMenuItemClick("/reports/daily-attendance")}
          >
            📊 Ежедневный отчет
          </div>

          <div
            className={styles.menuItem}
            onClick={() => handleMenuItemClick("/reports/work-time")}
          >
            ⏱️ Отчет по времени
          </div>
          <div
            className={styles.menuItem}
            onClick={() => handleMenuItemClick("/reports/violations")}
          >
            ⚠️ Отчет по нарушениям
          </div>
          <div className={styles.menuItem} onClick={handleLogout}>
            🚪 Выйти
          </div>
        </>
      ) : (
        <div
          className={styles.menuItem}
          onClick={() => handleMenuItemClick("/login")}
        >
          🔐 Вход для администрации
        </div>
      )}
    </div>
  );
};

export default Menu;
