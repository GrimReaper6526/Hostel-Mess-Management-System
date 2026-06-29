-- ============================================================
--   UNIHOSTEL MANAGEMENT SYSTEM
--   FILE 03 — TRIGGERS
--   DBMS Concepts: AFTER Trigger, INSTEAD OF Trigger,
--                  DDL Trigger, inserted/deleted tables,
--                  Trigger chaining, Audit trail
-- ============================================================

USE HostelManagement;
GO

-- ────────────────────────────────────────────────────────────
-- TRIGGER 1: Auto-Assign Hall Based on CGPA
-- CONCEPT: AFTER INSERT trigger, business rule enforcement
-- ────────────────────────────────────────────────────────────
CREATE TRIGGER trg_AutoAssignHallOnBooking
ON Bookings
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;

    -- Update HallID to match the Room's HallID to ensure consistency
    UPDATE b
    SET b.HallID = r.HallID
    FROM Bookings b
    INNER JOIN inserted i ON b.BookingID = i.BookingID
    INNER JOIN Rooms r ON r.RoomID = i.RoomID;

    PRINT 'Trigger: Hall auto-assigned from Room definition.';
END;
GO

-- ────────────────────────────────────────────────────────────
-- TRIGGER 2: Mark Room Unavailable Only When FULL
-- CONCEPT: AFTER UPDATE trigger with capacity check
-- ────────────────────────────────────────────────────────────
CREATE TRIGGER trg_UpdateRoomAvailability
ON Bookings
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Re-evaluate availability for all rooms affected by this update
    UPDATE Rooms
    SET IsAvailable = CASE 
        WHEN (SELECT COUNT(*) FROM Bookings b 
              WHERE b.RoomID = r.RoomID 
              AND b.Status IN ('Approved','Active','Pending')) >= rt.Capacity 
        THEN 0 ELSE 1 END
    FROM Rooms r
    JOIN RoomTypes rt ON r.RoomTypeID = rt.RoomTypeID
    INNER JOIN (
        SELECT DISTINCT RoomID FROM inserted
        UNION
        SELECT DISTINCT RoomID FROM deleted
    ) i ON r.RoomID = i.RoomID;

    PRINT 'Trigger: Room availability updated based on capacity.';
END;
GO

-- ────────────────────────────────────────────────────────────
-- TRIGGER 3: Auto-Generate Fee Record When Booking Approved
-- CONCEPT: AFTER UPDATE, INSERT into another table
-- ────────────────────────────────────────────────────────────
CREATE TRIGGER trg_GenerateFeeOnApproval
ON Bookings
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Only fires when Status changes TO Active
    IF UPDATE(Status)
    BEGIN
        INSERT INTO RoomFeeRecords (StudentID, BookingID, Month, Year, Amount, DueDate)
        SELECT
            i.StudentID,
            i.BookingID,
            MONTH(GETDATE()),
            YEAR(GETDATE()),
            r.MonthlyFee,
            EOMONTH(GETDATE())   -- Last day of current month as due date
        FROM inserted i
        INNER JOIN deleted  d ON d.BookingID = i.BookingID
        INNER JOIN Rooms    r ON r.RoomID    = i.RoomID
        WHERE i.Status = 'Active'
          AND d.Status = 'Pending'
          -- Avoid duplicate fee
          AND NOT EXISTS (
              SELECT 1 FROM RoomFeeRecords f
              WHERE f.StudentID = i.StudentID
                AND f.BookingID = i.BookingID
                AND f.Month = MONTH(GETDATE())
                AND f.Year  = YEAR(GETDATE())
          );

        PRINT 'Trigger: Fee record auto-generated for approved booking.';
    END
END;
GO

-- ────────────────────────────────────────────────────────────
-- TRIGGER 4: Complaint Resolved Timestamp Update
-- ────────────────────────────────────────────────────────────
CREATE TRIGGER trg_ComplaintStatusAudit
ON Complaints
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF UPDATE(Status)
    BEGIN
        -- Set ResolvedAt timestamp if marked Resolved
        UPDATE Complaints
        SET ResolvedAt = GETDATE()
        FROM Complaints c
        INNER JOIN inserted i ON c.ComplaintID = i.ComplaintID
        WHERE i.Status = 'Resolved' AND c.ResolvedAt IS NULL;
    END
END;
GO

-- ────────────────────────────────────────────────────────────
-- TRIGGER 5: INSTEAD OF DELETE — Prevent room deletion if booked
-- CONCEPT: INSTEAD OF trigger — replaces the delete action
-- ────────────────────────────────────────────────────────────
CREATE TRIGGER trg_PreventRoomDeletion
ON Rooms
INSTEAD OF DELETE
AS
BEGIN
    SET NOCOUNT ON;

    -- Check if any being-deleted room has active bookings
    IF EXISTS (
        SELECT 1
        FROM deleted d
        INNER JOIN Bookings b ON b.RoomID = d.RoomID
        WHERE b.Status IN ('Active','Approved','Pending')
    )
    BEGIN
        RAISERROR('Cannot delete room — it has active or pending bookings.', 16, 1);
        RETURN;
    END

    -- Safe to delete — proceed
    DELETE FROM Rooms
    WHERE RoomID IN (SELECT RoomID FROM deleted);

    PRINT 'Trigger: Room deletion checked and completed.';
END;
GO

-- ────────────────────────────────────────────────────────────
-- TRIGGER 6: Late Penalty — Add 5% if fee paid after due date
-- CONCEPT: AFTER UPDATE, conditional logic in trigger
-- ────────────────────────────────────────────────────────────
CREATE TRIGGER trg_ApplyLatePenalty
ON RoomFeeRecords
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF UPDATE(IsPaid)
    BEGIN
        UPDATE RoomFeeRecords
        SET LatePenalty = CASE
            WHEN i.IsPaid = 1 AND GETDATE() > r.DueDate
            THEN r.Amount * 0.05   -- 5% late penalty
            ELSE 0
            END
        FROM RoomFeeRecords r
        INNER JOIN inserted i ON r.FeeID = i.FeeID
        WHERE i.IsPaid = 1;

        PRINT 'Trigger: Late penalty applied if payment overdue.';
    END
END;
GO

-- ────────────────────────────────────────────────────────────
-- TRIGGER 7: Prevent Double Active Booking for Same Student
-- CONCEPT: INSTEAD OF INSERT — business rule at DB level
-- ────────────────────────────────────────────────────────────
CREATE TRIGGER trg_PreventDoubleBooking
ON Bookings
INSTEAD OF INSERT
AS
BEGIN
    SET NOCOUNT ON;

    -- Check if any inserting student already has an active booking
    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN Bookings b ON b.StudentID = i.StudentID
        WHERE b.Status IN ('Active','Approved','Pending')
    )
    BEGIN
        RAISERROR('Student already has an active or pending booking. Cancel existing booking first.', 16, 1);
        RETURN;
    END

    -- Safe to insert
    INSERT INTO Bookings (StudentID,RoomID,HallID,StartDate,EndDate,Status,ApprovedBy,BookingDate,RejectionReason)
    SELECT StudentID,RoomID,HallID,StartDate,EndDate,Status,ApprovedBy,BookingDate,RejectionReason
    FROM inserted;

    PRINT 'Trigger: Booking inserted — no duplicate found.';
END;
GO

-- ────────────────────────────────────────────────────────────
-- TRIGGER 8: UpdatedAt timestamp on Students
-- CONCEPT: AFTER UPDATE, GETDATE() auto-stamp
-- ────────────────────────────────────────────────────────────
CREATE TRIGGER trg_StudentUpdatedAt
ON Students
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE Students
    SET UpdatedAt = GETDATE()
    FROM Students s
    INNER JOIN inserted i ON s.StudentID = i.StudentID;
END;
GO

-- ────────────────────────────────────────────────────────────
-- TRIGGER 9: DDL Trigger — Log table alterations (schema protection)
-- CONCEPT: DDL Trigger — fires on schema change events
-- ────────────────────────────────────────────────────────────
CREATE TABLE SchemaChangeLog (
    LogID       INT IDENTITY(1,1) PRIMARY KEY,
    EventType   VARCHAR(50),
    ObjectName  VARCHAR(100),
    ChangedBy   VARCHAR(100),
    ChangedAt   DATETIME DEFAULT GETDATE(),
    EventData   XML
);
GO

CREATE TRIGGER trg_SchemaProtection
ON DATABASE
FOR DROP_TABLE, ALTER_TABLE
AS
BEGIN
    INSERT INTO SchemaChangeLog (EventType, ObjectName, ChangedBy, EventData)
    VALUES (
        EVENTDATA().value('(/EVENT_INSTANCE/EventType)[1]',   'NVARCHAR(50)'),
        EVENTDATA().value('(/EVENT_INSTANCE/ObjectName)[1]',  'NVARCHAR(100)'),
        EVENTDATA().value('(/EVENT_INSTANCE/LoginName)[1]',   'NVARCHAR(100)'),
        EVENTDATA()
    );

    PRINT 'DDL Trigger: Schema change logged!';
END;
GO

PRINT '9 Triggers created successfully!';
PRINT 'trg_AutoAssignHallOnBooking, trg_UpdateRoomAvailability,';
PRINT 'trg_GenerateFeeOnApproval, trg_ComplaintStatusAudit,';
PRINT 'trg_PreventRoomDeletion, trg_ApplyLatePenalty,';
PRINT 'trg_PreventDoubleBooking, trg_StudentUpdatedAt,';
PRINT 'trg_SchemaProtection (DDL Trigger)';



GO
