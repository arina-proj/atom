const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Функция для проверки опозданий и ранних уходов
const checkScheduleViolations = async (employeeId, type, timestamp) => {
  try {
    const schedule = await prisma.schedule.findFirst({
      where: { employeeId: parseInt(employeeId) },
    });

    if (!schedule) return null;

    const recordTime = new Date(timestamp);
    const recordHours = recordTime.getHours();
    const recordMinutes = recordTime.getMinutes();
    const recordTimeString = `${recordHours
      .toString()
      .padStart(2, "0")}:${recordMinutes.toString().padStart(2, "0")}`;

    let violations = {
      isLate: false,
      isEarlyLeave: false,
      notes: null,
    };

    if (type === "приход") {
      // Проверяем опоздание
      if (recordTimeString > schedule.workStart) {
        violations.isLate = true;
        violations.notes = `Опоздание на ${calculateTimeDifference(
          schedule.workStart,
          recordTimeString
        )}`;
      }
    } else if (type === "уход") {
      // Проверяем ранний уход
      if (recordTimeString < schedule.workEnd) {
        violations.isEarlyLeave = true;
        violations.notes = `Ранний уход на ${calculateTimeDifference(
          recordTimeString,
          schedule.workEnd
        )}`;
      }
    }

    return violations;
  } catch (error) {
    console.error("Error checking schedule violations:", error);
    return null;
  }
};

// Функция для расчета разницы во времени
const calculateTimeDifference = (startTime, endTime) => {
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);

  const startTotal = startHours * 60 + startMinutes;
  const endTotal = endHours * 60 + endMinutes;

  const diff = endTotal - startTotal;
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;

  return `${hours}ч ${minutes}м`;
};

// Функция для проверки повторных входов/выходов
const checkReentry = async (employeeId, type, timestamp) => {
  try {
    const today = new Date(timestamp);
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Ищем записи за сегодня
    const todayRecords = await prisma.attendance.findMany({
      where: {
        employeeId: parseInt(employeeId),
        timestamp: {
          gte: today,
          lt: tomorrow,
        },
      },
      orderBy: { timestamp: "asc" },
    });

    // Если это не первая запись за сегодня - это повторный вход/выход
    const sameTypeRecords = todayRecords.filter(
      (record) => record.type === type
    );
    return sameTypeRecords.length > 0;
  } catch (error) {
    console.error("Error checking reentry:", error);
    return false;
  }
};

// Функция для определения нового статуса сотрудника
const getNewStatus = (type, reason) => {
  if (type === "приход") {
    return "на объекте";
  } else if (type === "уход") {
    // Для ухода используем причину как статус
    return reason || "ушёл";
  }
  return "ушёл";
};

// Функция для проверки, находится ли сотрудник на объекте
const isEmployeeOnSite = (status) => {
  return status === "на объекте" || status === "working";
};

// Создать или обновить расписание сотрудника
app.post("/api/schedules", async (req, res) => {
  try {
    const { employeeId, workStart, workEnd, lunchStart, lunchEnd } = req.body;

    console.log("Creating schedule for employee:", employeeId, req.body);

    // Валидация
    if (!employeeId || !workStart || !workEnd) {
      return res.status(400).json({
        success: false,
        error: "Отсутствуют обязательные поля",
        details: "Не указан ID сотрудника или время работы",
      });
    }

    // Проверяем существование сотрудника
    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(employeeId) },
    });

    console.log("Employee found:", employee);

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: "Сотрудник не найден",
        details: `Сотрудник с ID ${employeeId} не существует`,
      });
    }

    // Создаем или обновляем расписание
    const schedule = await prisma.schedule.upsert({
      where: {
        employeeId: parseInt(employeeId),
      },
      update: {
        workStart,
        workEnd,
        lunchStart: lunchStart || "13:00",
        lunchEnd: lunchEnd || "14:00",
      },
      create: {
        employeeId: parseInt(employeeId),
        workStart,
        workEnd,
        lunchStart: lunchStart || "13:00",
        lunchEnd: lunchEnd || "14:00",
      },
    });

    console.log("Schedule created:", schedule);

    res.json({
      success: true,
      schedule,
      message: "Расписание успешно сохранено",
    });
  } catch (error) {
    console.error("Error creating schedule:", error);
    console.error("Error details:", error.message);

    res.status(500).json({
      success: false,
      error: "Системная ошибка",
      details: error.message,
    });
  }
});

// Получить расписание сотрудника
app.get("/api/employees/:id/schedule", async (req, res) => {
  try {
    const schedule = await prisma.schedule.findFirst({
      where: { employeeId: parseInt(req.params.id) },
      include: {
        employee: {
          select: {
            fullName: true,
            position: true,
          },
        },
      },
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: "Расписание не найдено",
      });
    }

    res.json(schedule);
  } catch (error) {
    console.error("Error fetching schedule:", error);
    res.status(500).json({ error: "Error fetching schedule" });
  }
});

app.get("/api/profile/:id", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`GET /api/profile/${id} - Fetching detailed employee profile`);

    const profile = await prisma.employee.findUnique({
      where: {
        id: parseInt(id),
      },
      include: {
        attendances: {
          orderBy: { timestamp: "desc" },
          take: 10,
        },
        schedules: {
          select: {
            workStart: true,
            workEnd: true,
            lunchStart: true,
            lunchEnd: true,
          },
        },
      },
    });

    if (!profile) {
      console.log(`Employee with ID ${id} not found`);
      return res.status(404).json({
        success: false,
        error: "Сотрудник не найден",
      });
    }

    // Форматируем статус
    const formattedProfile = {
      ...profile,
      status: profile.status === "working" ? "на объекте" : profile.status,
    };

    console.log(`Employee profile found: ${formattedProfile.fullName}`);
    console.log(
      `- Attendances: ${formattedProfile.attendances.length} records`
    );
    console.log(
      `- Schedule: ${
        formattedProfile.schedules.length > 0 ? "exists" : "not set"
      }`
    );

    res.json(formattedProfile);
  } catch (error) {
    console.error("Error fetching employee profile:", error);
    res.status(500).json({
      success: false,
      error: "Error fetching employee profile",
      details: error.message,
    });
  }
});
// Получить всех сотрудников
app.get("/api/employees", async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Преобразуем статусы для единообразия
    const formattedEmployees = employees.map((emp) => ({
      ...emp,
      status: emp.status === "working" ? "на объекте" : emp.status,
    }));

    res.json(formattedEmployees);
  } catch (error) {
    res.status(500).json({ error: "Error fetching employees" });
  }
});

// Получить статистику посещений
app.get("/api/attendance/stats", async (req, res) => {
  try {
    const { employeeId, startDate, endDate, limit = 100 } = req.query;

    let where = {};

    if (employeeId) {
      where.employeeId = parseInt(employeeId);
    }

    if (startDate && endDate) {
      where.timestamp = {
        gte: new Date(startDate),
        lte: new Date(endDate + "T23:59:59.999Z"),
      };
    }

    const attendance = await prisma.attendance.findMany({
      where,
      include: {
        employee: {
          select: {
            fullName: true,
            position: true,
          },
        },
      },
      orderBy: { timestamp: "desc" },
      take: parseInt(limit),
    });

    res.json(attendance);
  } catch (error) {
    console.error("Error fetching attendance stats:", error);
    res.status(500).json({ error: "Error fetching attendance statistics" });
  }
});

// Создать сотрудника
app.post("/api/employees", async (req, res) => {
  try {
    const { fullName, position, department, hireDate, status } = req.body;

    const employee = await prisma.employee.create({
      data: {
        fullName,
        position,
        department,
        hireDate: new Date(hireDate),
        status: status || "ушёл",
      },
    });

    res.json(employee);
  } catch (error) {
    res.status(500).json({ error: "Error creating employee" });
  }
});

// Отметить приход/уход с валидацией
app.post("/api/attendance", async (req, res) => {
  try {
    const { employeeId, type, reason } = req.body;

    // Валидация входных данных
    if (!employeeId || !type) {
      return res.status(400).json({
        success: false,
        error: "Отсутствуют обязательные поля",
        details: "Не указан ID сотрудника или тип действия",
      });
    }

    // Проверяем существование сотрудника
    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(employeeId) },
    });

    if (!employee) {
      await prisma.accessLog.create({
        data: {
          employeeId: null,
          type: "ошибка",
          action: type,
          reason: "Сотрудник не найден",
        },
      });

      return res.status(404).json({
        success: false,
        error: "Сотрудник не найден",
        details: `Сотрудник с ID ${employeeId} не существует`,
      });
    }

    // Проверяем логику доступа
    let validationError = null;

    if (type === "приход") {
      if (isEmployeeOnSite(employee.status)) {
        validationError = "Сотрудник уже находится на объекте";
      }
    } else if (type === "уход") {
      if (!isEmployeeOnSite(employee.status)) {
        validationError = "Сотрудник не находится на объекте";
      }
    }

    // Если есть ошибка валидации
    if (validationError) {
      await prisma.accessLog.create({
        data: {
          employeeId: parseInt(employeeId),
          type: "ошибка",
          action: type,
          reason: validationError,
        },
      });

      return res.status(400).json({
        success: false,
        error: "Доступ запрещен",
        details: validationError,
      });
    }

    // ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ - регистрируем действие

    // Проверяем нарушения расписания
    const violations = await checkScheduleViolations(
      employeeId,
      type,
      new Date()
    );
    const isReentry = await checkReentry(employeeId, type, new Date());

    // Находим последний незакрытый приход для связывания (только для ухода)
    let lastArrival = null;
    if (type === "уход") {
      lastArrival = await prisma.attendance.findFirst({
        where: {
          employeeId: parseInt(employeeId),
          type: "приход",
          pairedAttendanceId: null,
        },
        orderBy: { timestamp: "desc" },
      });
    }

    // Создаем запись о посещении с дополнительными флагами
    const attendance = await prisma.attendance.create({
      data: {
        employeeId: parseInt(employeeId),
        type,
        reason: type === "уход" ? reason : null,
        pairedAttendanceId:
          type === "уход" && lastArrival ? lastArrival.id : null,
        isLate: violations?.isLate || false,
        isEarlyLeave: violations?.isEarlyLeave || false,
        isReentry: isReentry,
        notes: violations?.notes || (isReentry ? "Повторный вход/выход" : null),
      },
    });

    // Обновляем статус сотрудника
    const newStatus = getNewStatus(type, reason);

    await prisma.employee.update({
      where: { id: parseInt(employeeId) },
      data: { status: newStatus },
    });

    // Логируем успешное действие
    await prisma.accessLog.create({
      data: {
        employeeId: parseInt(employeeId),
        type: "успех",
        action: type,
        reason: null,
      },
    });

    res.json({
      success: true,
      attendance,
      message:
        type === "приход"
          ? "Приход успешно зарегистрирован"
          : "Уход успешно зарегистрирован",
      employee: {
        id: employee.id,
        name: employee.fullName,
        newStatus: newStatus,
      },
      violations: violations || {},
      isReentry: isReentry,
    });
  } catch (error) {
    console.error("Error recording attendance:", error);

    let logEmployeeId = null;
    if (req.body.employeeId) {
      try {
        const employee = await prisma.employee.findUnique({
          where: { id: parseInt(req.body.employeeId) },
        });
        if (employee) {
          logEmployeeId = parseInt(req.body.employeeId);
        }
      } catch (e) {
        // Игнорируем ошибку проверки
      }
    }

    await prisma.accessLog.create({
      data: {
        employeeId: logEmployeeId,
        type: "ошибка",
        action: req.body.type || "неизвестно",
        reason: "Системная ошибка: " + error.message,
      },
    });

    res.status(500).json({
      success: false,
      error: "Системная ошибка",
      details: "Произошла ошибка при обработке запроса",
    });
  }
});

// Получить все записи о посещениях с пагинацией и фильтрами
app.get("/api/attendance/records", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      employeeId,
      startDate,
      endDate,
      type,
    } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let where = {};

    if (employeeId) {
      where.employeeId = parseInt(employeeId);
    }

    if (type) {
      where.type = type;
    }

    if (startDate && endDate) {
      where.timestamp = {
        gte: new Date(startDate),
        lte: new Date(endDate + "T23:59:59.999Z"),
      };
    }

    const [attendance, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        include: {
          employee: {
            select: {
              fullName: true,
              position: true,
              department: true,
            },
          },
          pairedAttendance: {
            include: {
              employee: {
                select: {
                  fullName: true,
                },
              },
            },
          },
        },
        orderBy: { timestamp: "desc" },
        skip,
        take: parseInt(limit),
      }),
      prisma.attendance.count({ where }),
    ]);

    res.json({
      attendance,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching attendance records:", error);
    res.status(500).json({ error: "Error fetching attendance records" });
  }
});

// Ручное добавление записи о входе/выходе
app.post("/api/attendance/manual", async (req, res) => {
  try {
    const { employeeId, type, timestamp, reason, notes, correctedBy } =
      req.body;

    // Валидация
    if (!employeeId || !type || !timestamp || !correctedBy) {
      return res.status(400).json({
        success: false,
        error: "Отсутствуют обязательные поля",
        details: "Не указан ID сотрудника, тип, время или автор корректировки",
      });
    }

    // Проверяем существование сотрудника
    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(employeeId) },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: "Сотрудник не найден",
        details: `Сотрудник с ID ${employeeId} не существует`,
      });
    }

    // Проверяем нарушения расписания для указанного времени
    const violations = await checkScheduleViolations(
      employeeId,
      type,
      new Date(timestamp)
    );

    // Для ухода ищем соответствующий приход
    let lastArrival = null;
    let pairedAttendanceId = null;

    if (type === "уход") {
      // Ищем незакрытый приход перед этим уходом
      lastArrival = await prisma.attendance.findFirst({
        where: {
          employeeId: parseInt(employeeId),
          type: "приход",
          timestamp: {
            lte: new Date(timestamp),
          },
          pairedAttendanceId: null,
        },
        orderBy: { timestamp: "desc" },
      });

      if (lastArrival) {
        pairedAttendanceId = lastArrival.id;
      }
    }

    // Создаем запись
    const attendance = await prisma.attendance.create({
      data: {
        employeeId: parseInt(employeeId),
        type,
        timestamp: new Date(timestamp),
        reason: type === "уход" ? reason : null,
        pairedAttendanceId,
        isLate: violations?.isLate || false,
        isEarlyLeave: violations?.isEarlyLeave || false,
        isReentry: false, // Ручные записи не считаются повторными
        notes: violations?.notes || notes,
        isManual: true,
        correctedBy,
        correctionReason: "Ручное добавление записи",
      },
    });

    // Обновляем статус сотрудника, если это последняя запись
    await updateEmployeeStatus(parseInt(employeeId));

    // Логируем действие
    await prisma.accessLog.create({
      data: {
        employeeId: parseInt(employeeId),
        type: "корректировка",
        action: `Ручное добавление: ${type}`,
        reason: `Автор: ${correctedBy}`,
        details: JSON.stringify({
          timestamp: new Date(timestamp),
          reason,
          notes,
        }),
      },
    });

    res.json({
      success: true,
      attendance,
      message: "Запись успешно добавлена",
    });
  } catch (error) {
    console.error("Error creating manual attendance:", error);
    res.status(500).json({
      success: false,
      error: "Системная ошибка",
      details: error.message,
    });
  }
});

// Редактирование времени в записи
app.put("/api/attendance/records/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { timestamp, reason, correctedBy, notes } = req.body;

    console.log("Editing record:", { id, timestamp, reason, correctedBy });

    // Валидация
    if (!timestamp || !reason || !correctedBy) {
      return res.status(400).json({
        success: false,
        error: "Отсутствуют обязательные поля",
        details: "Не указано время, причина корректировки или автор",
      });
    }

    // Находим существующую запись с ПРАВИЛЬНЫМИ полями
    const existingRecord = await prisma.attendance.findUnique({
      where: { id: parseInt(id) },
      include: {
        employee: true,
        relatedAttendances: true, // Это правильное название для связанных уходов
        pairedAttendance: true, // Это правильное название для связанного прихода
      },
    });

    if (!existingRecord) {
      return res.status(404).json({
        success: false,
        error: "Запись не найдена",
      });
    }

    // Проверяем нарушения расписания для нового времени
    const violations = await checkScheduleViolations(
      existingRecord.employeeId,
      existingRecord.type,
      new Date(timestamp)
    );

    console.log("Violations found:", violations);

    // Подготавливаем данные для обновления
    const updateData = {
      timestamp: new Date(timestamp),
      isLate: violations?.isLate || false,
      isEarlyLeave: violations?.isEarlyLeave || false,
      isManual: true,
      correctedBy,
      correctionReason: reason,
      originalTimestamp:
        existingRecord.originalTimestamp || existingRecord.timestamp,
    };

    // Добавляем заметки если есть
    if (violations?.notes || notes) {
      updateData.notes = [violations?.notes, notes].filter(Boolean).join(" | ");
    }

    // Обновляем запись
    const updatedRecord = await prisma.attendance.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    console.log("Record updated:", updatedRecord);

    // Если это уход, обновляем связанные записи
    if (existingRecord.type === "уход" && existingRecord.pairedAttendanceId) {
      await updatePresenceDuration(
        existingRecord.pairedAttendanceId,
        updatedRecord.id
      );
    }

    // Если это приход, обновляем все связанные уходы
    if (
      existingRecord.type === "приход" &&
      existingRecord.relatedAttendances.length > 0
    ) {
      for (const departure of existingRecord.relatedAttendances) {
        await updatePresenceDuration(existingRecord.id, departure.id);
      }
    }

    // Обновляем статус сотрудника
    await updateEmployeeStatus(existingRecord.employeeId);

    // Логируем действие
    await prisma.accessLog.create({
      data: {
        employeeId: existingRecord.employeeId,
        type: "корректировка",
        action: `Редактирование времени: ${existingRecord.type}`,
        reason: `Причина: ${reason}, Автор: ${correctedBy}`,
        details: JSON.stringify({
          originalTimestamp: existingRecord.timestamp,
          newTimestamp: new Date(timestamp),
          recordId: id,
          employeeName: existingRecord.employee.fullName,
        }),
      },
    });

    res.json({
      success: true,
      attendance: updatedRecord,
      message: "Время записи успешно обновлено",
    });
  } catch (error) {
    console.error("Error updating attendance:", error);
    console.error("Error stack:", error.stack);

    res.status(500).json({
      success: false,
      error: "Системная ошибка",
      details: error.message,
    });
  }
});

// Аннулирование ошибочной записи
app.delete("/api/attendance/records/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, correctedBy } = req.body;

    console.log("Cancelling record:", { id, reason, correctedBy });

    // Валидация
    if (!reason || !correctedBy) {
      return res.status(400).json({
        success: false,
        error: "Отсутствуют обязательные поля",
        details: "Не указана причина аннулирования или автор",
      });
    }

    // Находим запись с ПРАВИЛЬНЫМИ полями
    const record = await prisma.attendance.findUnique({
      where: { id: parseInt(id) },
      include: {
        employee: true,
        pairedAttendance: true,
        relatedAttendances: true, // Правильное название для связанных уходов
      },
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        error: "Запись не найдена",
      });
    }

    const employeeId = record.employeeId;

    // Проверяем, можно ли удалить запись
    if (record.type === "приход" && record.relatedAttendances.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Невозможно удалить запись",
        details: "У этого прихода есть связанные записи об уходе",
      });
    }

    if (record.type === "уход" && record.pairedAttendanceId) {
      // Разрываем связь с приходом
      await prisma.attendance.update({
        where: { id: record.pairedAttendanceId },
        data: { pairedAttendanceId: null },
      });
      console.log(
        `Unlinked arrival ${record.pairedAttendanceId} from departure ${id}`
      );
    }

    // Создаем запись об аннулировании
    await prisma.cancelledAttendance.create({
      data: {
        originalId: record.id,
        employeeId: record.employeeId,
        type: record.type,
        originalTimestamp: record.timestamp,
        reason,
        cancelledBy: correctedBy,
        cancelledAt: new Date(),
        originalData: JSON.stringify({
          id: record.id,
          employeeId: record.employeeId,
          type: record.type,
          timestamp: record.timestamp,
          reason: record.reason,
          notes: record.notes,
        }),
      },
    });

    // Удаляем запись
    await prisma.attendance.delete({
      where: { id: parseInt(id) },
    });

    console.log(`Record ${id} cancelled successfully`);

    // Обновляем статус сотрудника
    await updateEmployeeStatus(employeeId);

    // Логируем действие
    await prisma.accessLog.create({
      data: {
        employeeId,
        type: "аннулирование",
        action: `Удаление записи: ${record.type}`,
        reason: `Причина: ${reason}, Автор: ${correctedBy}`,
        details: JSON.stringify({
          originalTimestamp: record.timestamp,
          recordId: id,
          employeeName: record.employee.fullName,
        }),
      },
    });

    res.json({
      success: true,
      message: "Запись успешно аннулирована",
    });
  } catch (error) {
    console.error("Error cancelling attendance:", error);
    console.error("Error stack:", error.stack);

    res.status(500).json({
      success: false,
      error: "Системная ошибка",
      details: error.message,
    });
  }
});
// Получить аннулированные записи
app.get("/api/attendance/cancelled", async (req, res) => {
  try {
    const { page = 1, limit = 50, employeeId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let where = {};

    if (employeeId) {
      where.employeeId = parseInt(employeeId);
    }

    const cancelled = await prisma.cancelledAttendance.findMany({
      where,
      include: {
        employee: {
          select: {
            fullName: true,
            position: true,
          },
        },
      },
      orderBy: { cancelledAt: "desc" },
      skip,
      take: parseInt(limit),
    });

    res.json(cancelled);
  } catch (error) {
    console.error("Error fetching cancelled records:", error);
    res.status(500).json({ error: "Error fetching cancelled records" });
  }
});

// Вспомогательная функция для обновления статуса сотрудника
// Вспомогательная функция для обновления статуса сотрудника
async function updateEmployeeStatus(employeeId) {
  try {
    // Находим последнюю запись сотрудника
    const lastRecord = await prisma.attendance.findFirst({
      where: { employeeId },
      orderBy: { timestamp: "desc" },
    });

    let newStatus = "ушёл"; // Статус по умолчанию

    if (lastRecord && lastRecord.type === "приход") {
      // Проверяем, есть ли незакрытый приход (без ухода)
      const hasOpenArrival = await prisma.attendance.findFirst({
        where: {
          employeeId,
          type: "приход",
          pairedAttendanceId: null,
        },
      });

      if (hasOpenArrival) {
        newStatus = "на объекте";
      }
    }

    await prisma.employee.update({
      where: { id: employeeId },
      data: { status: newStatus },
    });

    return newStatus;
  } catch (error) {
    console.error("Error updating employee status:", error);
    throw error;
  }
}
// Вспомогательная функция для обновления длительности присутствия
// Вспомогательная функция для обновления длительности присутствия
async function updatePresenceDuration(arrivalId, departureId) {
  try {
    const arrival = await prisma.attendance.findUnique({
      where: { id: arrivalId },
    });
    const departure = await prisma.attendance.findUnique({
      where: { id: departureId },
    });

    if (arrival && departure) {
      const duration = Math.round(
        (new Date(departure.timestamp) - new Date(arrival.timestamp)) /
          1000 /
          60
      );

      const durationText = `Длительность: ${Math.floor(duration / 60)}ч ${
        duration % 60
      }м`;

      await prisma.attendance.update({
        where: { id: departureId },
        data: {
          notes: departure.notes
            ? `${departure.notes} | ${durationText}`
            : durationText,
        },
      });
    }
  } catch (error) {
    console.error("Error updating presence duration:", error);
  }
}

// Получить журнал событий системы
app.get("/api/access-logs", async (req, res) => {
  try {
    const { limit = 100, employeeId, type } = req.query;

    console.log("Fetching access logs with params:", {
      limit,
      employeeId,
      type,
    });

    let where = {};

    if (employeeId && employeeId !== "null" && employeeId !== "undefined") {
      where.employeeId = parseInt(employeeId);
    }

    if (type && type !== "null" && type !== "undefined") {
      where.type = type;
    }

    const logs = await prisma.accessLog.findMany({
      where,
      include: {
        employee: {
          select: {
            fullName: true,
            position: true,
            department: true,
          },
        },
      },
      orderBy: { timestamp: "desc" },
      take: parseInt(limit),
    });

    console.log(`Found ${logs.length} access logs`);
    res.json(logs);
  } catch (error) {
    console.error("Error fetching access logs:", error);
    res.status(500).json({
      error: "Error fetching access logs",
      details: error.message,
    });
  }
});

// Удалить сотрудника
app.delete("/api/employees/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Проверяем существование сотрудника
    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(id) },
      include: {
        attendances: true,
        accessLogs: true,
        schedules: true,
        cancelledAttendances: true,
      },
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: "Сотрудник не найден",
      });
    }

    // Проверяем, есть ли связанные записи
    const hasRelatedRecords =
      employee.attendances.length > 0 ||
      employee.accessLogs.length > 0 ||
      employee.cancelledAttendances.length > 0;

    if (hasRelatedRecords) {
      return res.status(400).json({
        success: false,
        error: "Невозможно удалить сотрудника",
        details: "У сотрудника есть связанные записи (посещения, логи и т.д.)",
      });
    }

    // Удаляем расписание сотрудника (если есть)
    if (employee.schedules.length > 0) {
      await prisma.schedule.deleteMany({
        where: { employeeId: parseInt(id) },
      });
    }

    // Удаляем сотрудника
    await prisma.employee.delete({
      where: { id: parseInt(id) },
    });

    // Логируем действие
    await prisma.accessLog.create({
      data: {
        employeeId: null,
        type: "аннулирование",
        action: "удаление сотрудника",
        reason: `Удален сотрудник: ${employee.fullName} (ID: ${id})`,
        details: JSON.stringify({
          employeeName: employee.fullName,
          position: employee.position,
          department: employee.department,
        }),
      },
    });

    res.json({
      success: true,
      message: "Сотрудник успешно удален",
    });
  } catch (error) {
    console.error("Error deleting employee:", error);
    res.status(500).json({
      success: false,
      error: "Системная ошибка",
      details: error.message,
    });
  }
});

// Получить историю посещений сотрудника
app.get("/api/employees/:id/attendance", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(
      `GET /api/employees/${id}/attendance - Fetching attendance history`
    );

    const attendance = await prisma.attendance.findMany({
      where: { employeeId: parseInt(id) },
      orderBy: { timestamp: "desc" },
      take: 20, // последние 20 записей
    });

    console.log(
      `Found ${attendance.length} attendance records for employee ${id}`
    );
    res.json(attendance);
  } catch (error) {
    console.error(
      `Error fetching attendance for employee ${req.params.id}:`,
      error
    );
    res.status(500).json({
      error: "Error fetching attendance history",
    });
  }
});

// Получить интервалы присутствия сотрудника
app.get("/api/employees/:id/presence-intervals", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(
      `GET /api/employees/${id}/presence-intervals - Fetching presence intervals`
    );

    const intervals = await prisma.attendance.findMany({
      where: {
        employeeId: parseInt(id),
        type: "уход",
        pairedAttendanceId: { not: null },
      },
      include: {
        pairedAttendance: true,
        employee: {
          select: {
            fullName: true,
            position: true,
          },
        },
      },
      orderBy: { timestamp: "desc" },
    });

    // Форматируем интервалы
    const formattedIntervals = intervals.map((interval) => {
      const arrival = interval.pairedAttendance;
      const departure = interval;
      const duration = Math.round(
        (new Date(departure.timestamp) - new Date(arrival.timestamp)) /
          1000 /
          60
      );

      return {
        id: interval.id,
        employee: interval.employee,
        arrivalTime: arrival.timestamp,
        departureTime: departure.timestamp,
        duration: duration,
        formattedDuration: `${Math.floor(duration / 60)}ч ${duration % 60}м`,
        reason: departure.reason,
      };
    });

    console.log(
      `Found ${formattedIntervals.length} presence intervals for employee ${id}`
    );
    res.json(formattedIntervals);
  } catch (error) {
    console.error(
      `Error fetching presence intervals for employee ${req.params.id}:`,
      error
    );
    res.status(500).json({
      error: "Error fetching presence intervals",
    });
  }
});

// Получить текущий незавершенный интервал
app.get("/api/employees/:id/current-interval", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(
      `GET /api/employees/${id}/current-interval - Fetching current interval`
    );

    const lastArrival = await prisma.attendance.findFirst({
      where: {
        employeeId: parseInt(id),
        type: "приход",
        pairedAttendanceId: null,
      },
      orderBy: { timestamp: "desc" },
      include: {
        employee: {
          select: {
            fullName: true,
            position: true,
          },
        },
      },
    });

    let result = { hasActiveInterval: false };

    if (lastArrival) {
      const currentDuration = Math.round(
        (new Date() - new Date(lastArrival.timestamp)) / 1000 / 60
      );

      result = {
        hasActiveInterval: true,
        arrival: lastArrival,
        currentDuration: currentDuration,
        formattedDuration: `${Math.floor(currentDuration / 60)}ч ${
          currentDuration % 60
        }м`,
        arrivalTime: lastArrival.timestamp,
      };
    }

    console.log(
      `Current interval for employee ${id}: ${
        result.hasActiveInterval ? "active" : "none"
      }`
    );
    res.json(result);
  } catch (error) {
    console.error(
      `Error fetching current interval for employee ${req.params.id}:`,
      error
    );
    res.status(500).json({
      error: "Error fetching current interval",
    });
  }
});

// Генерация ежедневного отчета
app.get("/api/reports/daily-attendance", async (req, res) => {
  try {
    const { date = new Date().toISOString().split("T")[0] } = req.query;
    console.log(`Generating daily attendance report for date: ${date}`);

    // Получаем всех сотрудников
    const employees = await prisma.employee.findMany({
      include: {
        schedules: true,
      },
      orderBy: { fullName: "asc" },
    });

    // Получаем записи посещений за указанную дату
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        employee: {
          select: {
            fullName: true,
            position: true,
            department: true,
          },
        },
        pairedAttendance: true,
      },
      orderBy: { timestamp: "asc" },
    });

    // Формируем отчет по каждому сотруднику
    const report = await Promise.all(
      employees.map(async (employee) => {
        const employeeRecords = attendanceRecords.filter(
          (record) => record.employeeId === employee.id
        );

        const schedule = employee.schedules[0];
        const workStartTime = schedule?.workStart || "09:00";
        const workEndTime = schedule?.workEnd || "18:00";

        // Анализируем интервалы присутствия
        const intervals = analyzePresenceIntervals(employeeRecords);
        const totalPresence = calculateTotalPresence(intervals);

        // Определяем статусы
        const status = determineEmployeeStatus(employeeRecords, intervals);
        const isLate = checkIfLate(employeeRecords, workStartTime);
        const isAbsent = checkIfAbsent(employeeRecords, schedule);
        const isEarlyLeave = checkIfEarlyLeave(employeeRecords, workEndTime);

        return {
          employee: {
            id: employee.id,
            fullName: employee.fullName,
            position: employee.position,
            department: employee.department,
          },
          schedule: schedule
            ? {
                workStart: schedule.workStart,
                workEnd: schedule.workEnd,
              }
            : null,
          attendance: {
            firstArrival: getFirstArrival(employeeRecords),
            lastDeparture: getLastDeparture(employeeRecords),
            totalPresenceMinutes: totalPresence,
            formattedPresence: formatDuration(totalPresence),
            intervals: intervals,
          },
          status: {
            isPresent: status.isPresent,
            isAbsent: isAbsent,
            isLate: isLate,
            isEarlyLeave: isEarlyLeave,
            currentStatus: status.currentStatus,
          },
          violations: {
            lateMinutes: calculateLateMinutes(employeeRecords, workStartTime),
            earlyLeaveMinutes: calculateEarlyLeaveMinutes(
              employeeRecords,
              workEndTime
            ),
            missingRecords: checkMissingRecords(employeeRecords),
          },
        };
      })
    );

    // Статистика отчета
    const stats = calculateReportStats(report);

    res.json({
      success: true,
      reportDate: date,
      generatedAt: new Date().toISOString(),
      statistics: stats,
      data: report,
    });
  } catch (error) {
    console.error("Error generating daily report:", error);
    res.status(500).json({
      success: false,
      error: "Error generating daily report",
      details: error.message,
    });
  }
});

// Вспомогательные функции для анализа данных
function analyzePresenceIntervals(records) {
  const intervals = [];
  let currentArrival = null;

  for (const record of records) {
    if (record.type === "приход") {
      // Если уже есть незакрытый приход, создаем интервал с текущим временем как уходом
      if (currentArrival) {
        intervals.push({
          arrival: currentArrival.timestamp,
          departure: record.timestamp, // Используем время следующего прихода как уход
          duration: Math.round(
            (new Date(record.timestamp) - new Date(currentArrival.timestamp)) /
              60000
          ),
          isCompleted: false,
        });
      }
      currentArrival = record;
    } else if (record.type === "уход" && currentArrival) {
      intervals.push({
        arrival: currentArrival.timestamp,
        departure: record.timestamp,
        duration: Math.round(
          (new Date(record.timestamp) - new Date(currentArrival.timestamp)) /
            60000
        ),
        isCompleted: true,
      });
      currentArrival = null;
    }
  }

  // Если остался незакрытый приход
  if (currentArrival) {
    intervals.push({
      arrival: currentArrival.timestamp,
      departure: null,
      duration: Math.round(
        (new Date() - new Date(currentArrival.timestamp)) / 60000
      ),
      isCompleted: false,
    });
  }

  return intervals;
}

function calculateTotalPresence(intervals) {
  return intervals.reduce((total, interval) => total + interval.duration, 0);
}

function determineEmployeeStatus(records, intervals) {
  if (records.length === 0) {
    return { isPresent: false, currentStatus: "absent" };
  }

  const lastRecord = records[records.length - 1];
  const hasOpenInterval = intervals.some((interval) => !interval.isCompleted);

  return {
    isPresent: hasOpenInterval,
    currentStatus: hasOpenInterval ? "present" : "left",
  };
}

function checkIfLate(records, workStartTime) {
  const arrival = records.find((r) => r.type === "приход");
  if (!arrival) return false;

  const arrivalTime = new Date(arrival.timestamp);
  const [startHours, startMinutes] = workStartTime.split(":").map(Number);
  const workStart = new Date(arrivalTime);
  workStart.setHours(startHours, startMinutes, 0, 0);

  return arrivalTime > workStart;
}

function checkIfAbsent(records, schedule) {
  if (!schedule) return records.length === 0;

  // Считаем отсутствующим, если нет ни одной записи за день
  return records.length === 0;
}

function checkIfEarlyLeave(records, workEndTime) {
  const departure = records.filter((r) => r.type === "уход").pop();
  if (!departure) return false;

  const departureTime = new Date(departure.timestamp);
  const [endHours, endMinutes] = workEndTime.split(":").map(Number);
  const workEnd = new Date(departureTime);
  workEnd.setHours(endHours, endMinutes, 0, 0);

  return departureTime < workEnd;
}

function getFirstArrival(records) {
  const arrival = records.find((r) => r.type === "приход");
  return arrival ? arrival.timestamp : null;
}

function getLastDeparture(records) {
  const departures = records.filter((r) => r.type === "уход");
  return departures.length > 0 ? departures[departures.pop().timestamp] : null;
}

function calculateLateMinutes(records, workStartTime) {
  const arrival = records.find((r) => r.type === "приход");
  if (!arrival) return 0;

  const arrivalTime = new Date(arrival.timestamp);
  const [startHours, startMinutes] = workStartTime.split(":").map(Number);
  const workStart = new Date(arrivalTime);
  workStart.setHours(startHours, startMinutes, 0, 0);

  return Math.max(0, Math.round((arrivalTime - workStart) / 60000));
}

function calculateEarlyLeaveMinutes(records, workEndTime) {
  const departure = records.filter((r) => r.type === "уход").pop();
  if (!departure) return 0;

  const departureTime = new Date(departure.timestamp);
  const [endHours, endMinutes] = workEndTime.split(":").map(Number);
  const workEnd = new Date(departureTime);
  workEnd.setHours(endHours, endMinutes, 0, 0);

  return Math.max(0, Math.round((workEnd - departureTime) / 60000));
}

function checkMissingRecords(records) {
  const arrivals = records.filter((r) => r.type === "приход").length;
  const departures = records.filter((r) => r.type === "уход").length;

  return {
    missingArrival: arrivals === 0,
    missingDeparture: arrivals > departures,
    unbalancedRecords: arrivals !== departures,
  };
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}ч ${mins}м`;
}

function calculateReportStats(report) {
  const totalEmployees = report.length;
  const presentEmployees = report.filter((r) => r.status.isPresent).length;
  const absentEmployees = report.filter((r) => r.status.isAbsent).length;
  const lateEmployees = report.filter((r) => r.status.isLate).length;
  const earlyLeaveEmployees = report.filter(
    (r) => r.status.isEarlyLeave
  ).length;

  return {
    totalEmployees,
    presentEmployees,
    absentEmployees,
    lateEmployees,
    earlyLeaveEmployees,
    attendanceRate:
      totalEmployees > 0
        ? ((presentEmployees / totalEmployees) * 100).toFixed(1)
        : 0,
  };
}

// Еженедельный и месячный отчет по рабочему времени
app.get("/api/reports/work-time", async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      periodType = 'custom' // week, month, custom
    } = req.query;

    console.log(`Generating work time report for period: ${startDate} to ${endDate}`);

    // Валидация дат
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: "Не указаны даты периода",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    if (start > end) {
      return res.status(400).json({
        success: false,
        error: "Дата начала не может быть позже даты окончания",
      });
    }

    // Получаем всех сотрудников с расписаниями
    const employees = await prisma.employee.findMany({
      include: {
        schedules: true,
      },
      orderBy: { fullName: 'asc' }
    });

    // Получаем записи посещений за период
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        timestamp: {
          gte: start,
          lte: end,
        },
      },
      include: {
        employee: {
          select: {
            fullName: true,
            position: true,
            department: true,
          },
        },
        pairedAttendance: true,
      },
      orderBy: { timestamp: 'asc' },
    });

    // Рассчитываем рабочие дни в периоде
    const workingDays = calculateWorkingDays(start, end);
    
    // Формируем отчет по каждому сотруднику
    const report = await Promise.all(
      employees.map(async (employee) => {
        return await generateEmployeeWorkTimeReport(
          employee, 
          attendanceRecords, 
          start, 
          end, 
          workingDays
        );
      })
    );

    // Общая статистика отчета
    const stats = calculateWorkTimeStats(report, workingDays);

    res.json({
      success: true,
      reportPeriod: {
        startDate: startDate,
        endDate: endDate,
        periodType: periodType,
        workingDays: workingDays,
        totalDays: Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
      },
      generatedAt: new Date().toISOString(),
      statistics: stats,
      data: report,
    });

  } catch (error) {
    console.error('Error generating work time report:', error);
    res.status(500).json({
      success: false,
      error: 'Error generating work time report',
      details: error.message,
    });
  }
});

// Вспомогательные функции для расчета рабочего времени
function calculateWorkingDays(startDate, endDate) {
  let count = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    // Суббота (6) и Воскресенье (0) - выходные
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
}

async function generateEmployeeWorkTimeReport(employee, allRecords, startDate, endDate, totalWorkingDays) {
  const employeeRecords = allRecords.filter(
    record => record.employeeId === employee.id
  );

  const schedule = employee.schedules[0];
  const plannedHoursPerDay = schedule ? calculatePlannedHours(schedule) : 8; // 8 часов по умолчанию
  
  // Группируем записи по дням
  const dailyReports = generateDailyReports(employeeRecords, startDate, endDate, schedule);
  
  // Суммируем показатели за весь период
  const totals = calculatePeriodTotals(dailyReports);
  
  // Рассчитываем отклонения от плана
  const deviations = calculateDeviations(totals, totalWorkingDays, plannedHoursPerDay);

  return {
    employee: {
      id: employee.id,
      fullName: employee.fullName,
      position: employee.position,
      department: employee.department,
    },
    schedule: schedule ? {
      workStart: schedule.workStart,
      workEnd: schedule.workEnd,
      plannedHoursPerDay: plannedHoursPerDay,
    } : {
      workStart: '09:00',
      workEnd: '18:00',
      plannedHoursPerDay: 8,
      isDefault: true
    },
    periodSummary: {
      totalWorkingDays: totalWorkingDays,
      actualWorkDays: totals.workDays,
      absentDays: totals.absentDays,
    },
    timeTracking: {
      totalWorkedMinutes: totals.totalWorkedMinutes,
      totalWorkedHours: (totals.totalWorkedMinutes / 60).toFixed(2),
      formattedWorkedTime: formatHoursMinutes(totals.totalWorkedMinutes),
      
      totalOvertimeMinutes: totals.totalOvertimeMinutes,
      formattedOvertime: formatHoursMinutes(totals.totalOvertimeMinutes),
      
      totalUndertimeMinutes: totals.totalUndertimeMinutes,
      formattedUndertime: formatHoursMinutes(totals.totalUndertimeMinutes),
    },
    violations: {
      totalLateMinutes: totals.totalLateMinutes,
      formattedLateTime: formatHoursMinutes(totals.totalLateMinutes),
      lateCount: totals.lateCount,
      
      totalEarlyLeaveMinutes: totals.totalEarlyLeaveMinutes,
      formattedEarlyLeaveTime: formatHoursMinutes(totals.totalEarlyLeaveMinutes),
      earlyLeaveCount: totals.earlyLeaveCount,
      
      totalMissingRecords: totals.missingRecords,
    },
    deviations: {
      plannedWorkMinutes: totalWorkingDays * plannedHoursPerDay * 60,
      actualWorkMinutes: totals.totalWorkedMinutes,
      deviationMinutes: deviations.deviationMinutes,
      deviationPercentage: deviations.deviationPercentage,
      formattedDeviation: deviations.formattedDeviation,
      status: deviations.status,
    },
    dailyDetails: dailyReports
  };
}

function calculatePlannedHours(schedule) {
  const [startHours, startMinutes] = schedule.workStart.split(':').map(Number);
  const [endHours, endMinutes] = schedule.workEnd.split(':').map(Number);
  
  const startTotal = startHours * 60 + startMinutes;
  const endTotal = endHours * 60 + endMinutes;
  
  // Вычитаем обед (1 час по умолчанию)
  const lunchBreak = 60;
  
  return (endTotal - startTotal - lunchBreak) / 60;
}

function generateDailyReports(records, startDate, endDate, schedule) {
  const dailyReports = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    // Пропускаем выходные
    const dayOfWeek = current.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      current.setDate(current.getDate() + 1);
      continue;
    }
    
    const dayStr = current.toISOString().split('T')[0];
    const dayRecords = records.filter(record => 
      record.timestamp.toISOString().split('T')[0] === dayStr
    );
    
    const dayReport = analyzeDayAttendance(dayRecords, current, schedule);
    dailyReports.push(dayReport);
    
    current.setDate(current.getDate() + 1);
  }
  
  return dailyReports;
}

function analyzeDayAttendance(records, date, schedule) {
  const dayStr = date.toISOString().split('T')[0];
  const plannedHours = schedule ? calculatePlannedHours(schedule) : 8;
  const plannedMinutes = plannedHours * 60;
  
  // Анализируем интервалы присутствия
  const intervals = analyzePresenceIntervals(records);
  const totalWorked = calculateTotalPresence(intervals);
  
  // Проверяем опоздания и ранние уходы
  const firstArrival = records.find(r => r.type === 'приход');
  const lastDeparture = records.filter(r => r.type === 'уход').pop();
  
  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;
  
  if (firstArrival && schedule) {
    lateMinutes = calculateLateMinutes([firstArrival], schedule.workStart);
  }
  
  if (lastDeparture && schedule) {
    earlyLeaveMinutes = calculateEarlyLeaveMinutes([lastDeparture], schedule.workEnd);
  }
  
  // Определяем статус дня
  const status = determineDayStatus(records, totalWorked, plannedMinutes);
  
  // Рассчитываем переработку/недоработку
  const overtime = Math.max(0, totalWorked - plannedMinutes);
  const undertime = Math.max(0, plannedMinutes - totalWorked);
  
  return {
    date: dayStr,
    weekday: getRussianWeekday(date.getDay()),
    records: records,
    intervals: intervals,
    summary: {
      status: status,
      workedMinutes: totalWorked,
      formattedWorkedTime: formatHoursMinutes(totalWorked),
      plannedMinutes: plannedMinutes,
      formattedPlannedTime: formatHoursMinutes(plannedMinutes),
      overtimeMinutes: overtime,
      undertimeMinutes: undertime,
      lateMinutes: lateMinutes,
      earlyLeaveMinutes: earlyLeaveMinutes,
      hasMissingRecords: records.length === 0 || 
                         records.filter(r => r.type === 'приход').length !== 
                         records.filter(r => r.type === 'уход').length
    }
  };
}

function determineDayStatus(records, workedMinutes, plannedMinutes) {
  if (records.length === 0) {
    return 'absent'; // Отсутствовал
  }
  
  if (workedMinutes === 0) {
    return 'no_work'; // Были записи, но время работы 0
  }
  
  const completionRatio = workedMinutes / plannedMinutes;
  
  if (completionRatio >= 1.1) {
    return 'overtime'; // Переработка
  } else if (completionRatio >= 0.9) {
    return 'normal'; // Норма
  } else if (completionRatio >= 0.5) {
    return 'partial'; // Неполный день
  } else {
    return 'short'; // Короткий день
  }
}

function calculatePeriodTotals(dailyReports) {
  return dailyReports.reduce((totals, day) => {
    totals.totalWorkedMinutes += day.summary.workedMinutes;
    totals.totalOvertimeMinutes += day.summary.overtimeMinutes;
    totals.totalUndertimeMinutes += day.summary.undertimeMinutes;
    totals.totalLateMinutes += day.summary.lateMinutes;
    totals.totalEarlyLeaveMinutes += day.summary.earlyLeaveMinutes;
    
    if (day.summary.status !== 'absent') {
      totals.workDays++;
    } else {
      totals.absentDays++;
    }
    
    if (day.summary.lateMinutes > 0) {
      totals.lateCount++;
    }
    
    if (day.summary.earlyLeaveMinutes > 0) {
      totals.earlyLeaveCount++;
    }
    
    if (day.summary.hasMissingRecords) {
      totals.missingRecords++;
    }
    
    return totals;
  }, {
    totalWorkedMinutes: 0,
    totalOvertimeMinutes: 0,
    totalUndertimeMinutes: 0,
    totalLateMinutes: 0,
    totalEarlyLeaveMinutes: 0,
    workDays: 0,
    absentDays: 0,
    lateCount: 0,
    earlyLeaveCount: 0,
    missingRecords: 0
  });
}

function calculateDeviations(totals, totalWorkingDays, plannedHoursPerDay) {
  const plannedMinutes = totalWorkingDays * plannedHoursPerDay * 60;
  const deviationMinutes = totals.totalWorkedMinutes - plannedMinutes;
  const deviationPercentage = plannedMinutes > 0 ? 
    (deviationMinutes / plannedMinutes * 100) : 0;
  
  let status = 'normal';
  if (deviationPercentage > 10) status = 'overtime';
  else if (deviationPercentage < -10) status = 'undertime';
  else if (deviationPercentage < -30) status = 'critical';
  
  return {
    deviationMinutes,
    deviationPercentage: Math.abs(deviationPercentage).toFixed(1),
    formattedDeviation: `${deviationMinutes >= 0 ? '+' : ''}${formatHoursMinutes(deviationMinutes)}`,
    status
  };
}

function getRussianWeekday(dayIndex) {
  const weekdays = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
  return weekdays[dayIndex];
}

function formatHoursMinutes(totalMinutes) {
  const absMinutes = Math.abs(totalMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  const sign = totalMinutes < 0 ? '-' : '';
  return `${sign}${hours}ч ${minutes}м`;
}

function calculateWorkTimeStats(report, workingDays) {
  const totalEmployees = report.length;
  const employeesWithWork = report.filter(r => r.periodSummary.actualWorkDays > 0).length;
  
  const totalWorkedHours = report.reduce((sum, r) => 
    sum + parseFloat(r.timeTracking.totalWorkedHours), 0
  );
  
  const avgWorkHours = totalEmployees > 0 ? totalWorkedHours / totalEmployees : 0;
  
  const overtimeEmployees = report.filter(r => r.timeTracking.totalOvertimeMinutes > 0).length;
  const undertimeEmployees = report.filter(r => r.deviations.status === 'undertime' || r.deviations.status === 'critical').length;
  
  return {
    totalEmployees,
    employeesWithWork,
    totalWorkedHours: totalWorkedHours.toFixed(1),
    avgWorkHours: avgWorkHours.toFixed(1),
    overtimeEmployees,
    undertimeEmployees,
    workingDays,
    attendanceRate: ((employeesWithWork / totalEmployees) * 100).toFixed(1)
  };
}

// Отчет по нарушениям
app.get("/api/reports/violations", async (req, res) => {
  try {
    const { 
      startDate, 
      endDate,
      violationType = 'all', // all, late, early_leave, absence, missing_records
      department = 'all',
      minSeverity = 0 // 0-3: 0=все, 1=легкие, 2=средние, 3=серьезные
    } = req.query;

    console.log(`Generating violations report: ${startDate} to ${endDate}`);

    // Валидация дат
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: "Не указаны даты периода",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    if (start > end) {
      return res.status(400).json({
        success: false,
        error: "Дата начала не может быть позже даты окончания",
      });
    }

    // Получаем всех сотрудников
    const employees = await prisma.employee.findMany({
      include: {
        schedules: true,
      },
      orderBy: { fullName: 'asc' }
    });

    // Получаем записи посещений за период
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        timestamp: {
          gte: start,
          lte: end,
        },
      },
      include: {
        employee: {
          select: {
            fullName: true,
            position: true,
            department: true,
          },
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Формируем отчет по нарушениям
    const violationsReport = await generateViolationsReport(
      employees, 
      attendanceRecords, 
      start, 
      end,
      violationType,
      department,
      parseInt(minSeverity)
    );

    res.json({
      success: true,
      reportPeriod: {
        startDate: startDate,
        endDate: endDate,
        totalDays: Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
      },
      filters: {
        violationType,
        department,
        minSeverity
      },
      generatedAt: new Date().toISOString(),
      statistics: violationsReport.statistics,
      data: violationsReport.data,
    });

  } catch (error) {
    console.error('Error generating violations report:', error);
    res.status(500).json({
      success: false,
      error: 'Error generating violations report',
      details: error.message,
    });
  }
});

// Вспомогательные функции для отчета по нарушениям
async function generateViolationsReport(employees, allRecords, startDate, endDate, violationType, department, minSeverity) {
  const workingDays = calculateWorkingDays(startDate, endDate);
  
  // Анализируем нарушения по каждому сотруднику
  const employeeViolations = await Promise.all(
    employees.map(async (employee) => {
      if (department !== 'all' && employee.department !== department) {
        return null;
      }

      const employeeRecords = allRecords.filter(
        record => record.employeeId === employee.id
      );

      const violations = analyzeEmployeeViolations(employeeRecords, employee, startDate, endDate, workingDays);
      
      // Фильтруем по типу нарушения
      const filteredViolations = filterViolationsByType(violations, violationType);
      
      // Фильтруем по серьезности
      const severityViolations = filterViolationsBySeverity(filteredViolations, minSeverity);

      if (severityViolations.totalViolations === 0) {
        return null;
      }

      return {
        employee: {
          id: employee.id,
          fullName: employee.fullName,
          position: employee.position,
          department: employee.department,
        },
        violations: severityViolations,
        summary: {
          totalViolations: severityViolations.totalViolations,
          totalPenaltyPoints: severityViolations.totalPenaltyPoints,
          mostCommonViolation: severityViolations.mostCommonViolation,
          severityLevel: severityViolations.severityLevel,
        }
      };
    })
  );

  // Убираем null (сотрудников без нарушений)
  const filteredData = employeeViolations.filter(item => item !== null);
  
  // Сортируем по количеству нарушений (по убыванию)
  filteredData.sort((a, b) => b.summary.totalViolations - a.summary.totalViolations);

  // Статистика по отчету
  const stats = calculateViolationsStatistics(filteredData, employees.length, workingDays);

  return {
    data: filteredData,
    statistics: stats
  };
}

function analyzeEmployeeViolations(records, employee, startDate, endDate, totalWorkingDays) {
  const schedule = employee.schedules && employee.schedules[0];
  const workStartTime = schedule?.workStart || '09:00';
  const workEndTime = schedule?.workEnd || '18:00';

  // ЗАЩИТА: проверяем records
  const safeRecords = records || [];

  // Группируем записи по дням
  const dailyViolations = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    // Пропускаем выходные
    const dayOfWeek = current.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      current.setDate(current.getDate() + 1);
      continue;
    }
    
    const dayStr = current.toISOString().split('T')[0];
    const dayRecords = safeRecords.filter(record => 
      record && record.timestamp && 
      record.timestamp.toISOString().split('T')[0] === dayStr
    );
    
    const dayViolations = analyzeDayViolations(dayRecords, current, workStartTime, workEndTime);
    if (dayViolations && dayViolations.length > 0) {
      dailyViolations.push({
        date: dayStr,
        violations: dayViolations
      });
    }
    
    current.setDate(current.getDate() + 1);
  }

  // Анализируем общие нарушения
  const violationsAnalysis = analyzeOverallViolations(dailyViolations, totalWorkingDays);

  return {
    dailyViolations,
    ...violationsAnalysis
  };
}

function analyzeDayViolations(records, date, workStartTime, workEndTime) {
  const violations = [];
  const safeRecords = records || [];

  // Проверяем отсутствие
  if (safeRecords.length === 0) {
    violations.push({
      type: 'absence',
      description: 'Неучтенное отсутствие',
      severity: 3,
      penaltyPoints: 5,
      time: null,
      duration: null
    });
    return violations;
  }

  // Проверяем опоздание с защитой
  const firstArrival = safeRecords.find(r => r && r.type === 'приход');
  if (firstArrival) {
    const lateMinutes = calculateLateMinutesForRecord(firstArrival, workStartTime);
    if (lateMinutes > 0) {
      const severity = calculateLateSeverity(lateMinutes);
      violations.push({
        type: 'late',
        description: `Опоздание на ${lateMinutes} минут`,
        severity: severity,
        penaltyPoints: severity,
        time: firstArrival.timestamp,
        duration: lateMinutes
      });
    }
  } else {
    // Нет записи прихода
    violations.push({
      type: 'missing_records',
      description: 'Отсутствует запись прихода',
      severity: 2,
      penaltyPoints: 3,
      time: null,
      duration: null
    });
  }

  // Проверяем ранний уход с защитой
  const departures = safeRecords.filter(r => r && r.type === 'уход');
  const lastDeparture = departures.length > 0 ? departures[departures.length - 1] : null;
  
  if (lastDeparture) {
    const earlyMinutes = calculateEarlyLeaveMinutesForRecord(lastDeparture, workEndTime);
    if (earlyMinutes > 0) {
      const severity = calculateEarlyLeaveSeverity(earlyMinutes);
      violations.push({
        type: 'early_leave',
        description: `Ранний уход на ${earlyMinutes} минут`,
        severity: severity,
        penaltyPoints: severity,
        time: lastDeparture.timestamp,
        duration: earlyMinutes
      });
    }
  } else if (safeRecords.length > 0) {
    // Есть приход, но нет ухода
    violations.push({
      type: 'missing_records',
      description: 'Отсутствует запись ухода',
      severity: 1,
      penaltyPoints: 2,
      time: null,
      duration: null
    });
  }

  // Проверяем несбалансированные записи
  const arrivals = safeRecords.filter(r => r && r.type === 'приход').length;
  const departuresCount = departures.length;
  if (arrivals !== departuresCount) {
    violations.push({
      type: 'missing_records',
      description: `Несбалансированные записи: ${arrivals} приходов, ${departuresCount} уходов`,
      severity: 1,
      penaltyPoints: 1,
      time: null,
      duration: null
    });
  }

  return violations;
}


function calculateLateSeverity(lateMinutes) {
  if (lateMinutes <= 15) return 1;      // Легкое
  if (lateMinutes <= 30) return 2;      // Среднее
  return 3;                             // Серьезное
}

function calculateEarlyLeaveSeverity(earlyMinutes) {
  if (earlyMinutes <= 30) return 1;     // Легкое
  if (earlyMinutes <= 60) return 2;     // Среднее
  return 3;                             // Серьезное
}

function analyzeOverallViolations(dailyViolations, totalWorkingDays) {
  // ЗАЩИТА: проверяем входные данные
  const safeDailyViolations = dailyViolations || [];
  
  const allViolations = safeDailyViolations.flatMap(day => 
    (day && day.violations) ? day.violations : []
  );
  
  const byType = {
    late: allViolations.filter(v => v && v.type === 'late'),
    early_leave: allViolations.filter(v => v && v.type === 'early_leave'),
    absence: allViolations.filter(v => v && v.type === 'absence'),
    missing_records: allViolations.filter(v => v && v.type === 'missing_records')
  };

  const totalViolations = allViolations.length;
  const totalPenaltyPoints = allViolations.reduce((sum, v) => 
    sum + (v && v.penaltyPoints ? v.penaltyPoints : 0), 0
  );
  
  // Определяем самый частый тип нарушения
  const violationCounts = {
    late: byType.late.length,
    early_leave: byType.early_leave.length,
    absence: byType.absence.length,
    missing_records: byType.missing_records.length
  };
  
  const mostCommonViolation = Object.keys(violationCounts).reduce((a, b) => 
    violationCounts[a] > violationCounts[b] ? a : b, 'none'
  );

  // Определяем общий уровень серьезности
  const severities = allViolations.map(v => v && v.severity ? v.severity : 0);
  const maxSeverity = severities.length > 0 ? Math.max(...severities) : 0;

  return {
    byType,
    totalViolations,
    totalPenaltyPoints,
    mostCommonViolation,
    severityLevel: maxSeverity,
    violationDays: safeDailyViolations.length,
    absenceRate: totalWorkingDays > 0 ? 
      ((byType.absence.length / totalWorkingDays) * 100).toFixed(1) : "0"
  };
}

function filterViolationsByType(violations, violationType) {
  if (violationType === 'all') return violations;
  
  // ЗАЩИТА: проверяем наличие dailyViolations
  const dailyViolations = violations?.dailyViolations;
  if (!dailyViolations || !Array.isArray(dailyViolations)) {
    return {
      dailyViolations: [],
      byType: { late: [], early_leave: [], absence: [], missing_records: [] },
      totalViolations: 0,
      totalPenaltyPoints: 0,
      mostCommonViolation: 'none',
      severityLevel: 0,
      violationDays: 0,
      absenceRate: "0"
    };
  }
  
  const filteredDailyViolations = dailyViolations
    .map(day => ({
      ...day,
      violations: (day.violations || []).filter(v => v && v.type === violationType)
    }))
    .filter(day => day.violations && day.violations.length > 0);

  return analyzeOverallViolations(filteredDailyViolations, dailyViolations.length);
}

function filterViolationsBySeverity(violations, minSeverity) {
  if (minSeverity === 0) return violations;
  
  // ЗАЩИТА: проверяем наличие dailyViolations
  const dailyViolations = violations?.dailyViolations;
  if (!dailyViolations || !Array.isArray(dailyViolations)) {
    return {
      dailyViolations: [],
      byType: { late: [], early_leave: [], absence: [], missing_records: [] },
      totalViolations: 0,
      totalPenaltyPoints: 0,
      mostCommonViolation: 'none',
      severityLevel: 0,
      violationDays: 0,
      absenceRate: "0"
    };
  }
  
  const filteredDailyViolations = dailyViolations
    .map(day => ({
      ...day,
      violations: (day.violations || []).filter(v => v && v.severity >= minSeverity)
    }))
    .filter(day => day.violations && day.violations.length > 0);

  return analyzeOverallViolations(filteredDailyViolations, dailyViolations.length);
}

function calculateViolationsStatistics(data, totalEmployees, workingDays) {
  // ЗАЩИТА: проверяем входные данные
  const safeData = data || [];
  
  const totalViolations = safeData.reduce((sum, item) => 
    sum + (item?.summary?.totalViolations || 0), 0
  );
  
  const totalPenaltyPoints = safeData.reduce((sum, item) => 
    sum + (item?.summary?.totalPenaltyPoints || 0), 0
  );
  
  const byType = {
    late: safeData.reduce((sum, item) => 
      sum + (item?.violations?.byType?.late?.length || 0), 0),
    early_leave: safeData.reduce((sum, item) => 
      sum + (item?.violations?.byType?.early_leave?.length || 0), 0),
    absence: safeData.reduce((sum, item) => 
      sum + (item?.violations?.byType?.absence?.length || 0), 0),
    missing_records: safeData.reduce((sum, item) => 
      sum + (item?.violations?.byType?.missing_records?.length || 0), 0)
  };

  const byDepartment = safeData.reduce((acc, item) => {
    const dept = item?.employee?.department || 'Неизвестно';
    if (!acc[dept]) acc[dept] = 0;
    acc[dept] += item?.summary?.totalViolations || 0;
    return acc;
  }, {});

  return {
    totalEmployeesWithViolations: safeData.length,
    totalEmployees: totalEmployees || 0,
    violationRate: totalEmployees > 0 ? 
      ((safeData.length / totalEmployees) * 100).toFixed(1) : "0",
    totalViolations,
    totalPenaltyPoints,
    avgViolationsPerEmployee: safeData.length > 0 ? 
      (totalViolations / safeData.length).toFixed(1) : "0",
    byType,
    byDepartment,
    workingDays: workingDays || 0
  };
}


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


function calculateLateMinutesForRecord(record, workStartTime) {
  if (!record || !record.timestamp) return 0;
  
  const arrivalTime = new Date(record.timestamp);
  const [startHours, startMinutes] = workStartTime.split(':').map(Number);
  const workStart = new Date(arrivalTime);
  workStart.setHours(startHours, startMinutes, 0, 0);

  return Math.max(0, Math.round((arrivalTime - workStart) / 60000));
}

function calculateEarlyLeaveMinutesForRecord(record, workEndTime) {
  if (!record || !record.timestamp) return 0;
  
  const departureTime = new Date(record.timestamp);
  const [endHours, endMinutes] = workEndTime.split(':').map(Number);
  const workEnd = new Date(departureTime);
  workEnd.setHours(endHours, endMinutes, 0, 0);

  return Math.max(0, Math.round((workEnd - departureTime) / 60000));
}