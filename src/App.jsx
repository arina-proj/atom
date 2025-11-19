import React from "react";
import { Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Layout from "./components/layout/Layout";
import Home from "./components/home/Home";
import Registration from "./components/registration/Registration";

import Employees from "./components/employees/Employees";
import Profile from "./components/profile/Profile";
import Login from "./components/auth/Login";
import ProtectedRoute from "./components/ProtectedRoute";
import AccessLogs from "./components/logs/AccessLogs";
import Stats from "./components/stats/Stats";
import DailyAttendanceReport from "./components/DailyAttendanceReport";
import WorkTimeReport from "./components/WorkTimeReport";
import ViolationsReport from "./components/ViolationsReport";

function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/registration"
            element={
              <ProtectedRoute>
                <Registration />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employees"
            element={
              <ProtectedRoute>
                <Employees />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/:id"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/daily-attendance"
            element={<DailyAttendanceReport />}
          />
          <Route path="/reports/work-time" element={<WorkTimeReport />} />
          <Route
            path="/logs"
            element={
              <ProtectedRoute>
                <AccessLogs />
              </ProtectedRoute>
            }
          />
          <Route path="/reports/violations" element={<ViolationsReport />} />
          <Route
            path="/stats"
            element={
              <ProtectedRoute>
                <Stats />
              </ProtectedRoute>
            }
          />
          <Route path="/settings" element={<ProtectedRoute></ProtectedRoute>} />
        </Routes>
      </Layout>
    </AuthProvider>
  );
}

export default App;
