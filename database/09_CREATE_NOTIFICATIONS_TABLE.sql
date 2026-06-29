-- ============================================================
--   UNIHOSTEL MANAGEMENT SYSTEM
--   FILE 09 — NOTIFICATIONS SYSTEM
--   Persistent database-backed notifications for students
-- ============================================================

USE HostelManagement;
GO

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Notifications' AND xtype='U')
BEGIN
    CREATE TABLE Notifications (
        NotificationID INT IDENTITY(1,1) PRIMARY KEY,
        StudentID      INT NOT NULL,
        Message        NVARCHAR(500) NOT NULL,
        Icon           NVARCHAR(10) DEFAULT N'🔔',
        IsRead         BIT NOT NULL DEFAULT 0,
        CreatedAt      DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT fk_notifications_student FOREIGN KEY (StudentID) 
            REFERENCES Students(StudentID) ON DELETE CASCADE
    );
    PRINT 'Notifications table created successfully!';
END
ELSE
BEGIN
    -- Ensure columns are updated to NVARCHAR
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Notifications') AND name = 'Icon' AND system_type_id = (SELECT system_type_id FROM sys.types WHERE name = 'varchar'))
    BEGIN
        ALTER TABLE Notifications ALTER COLUMN Icon NVARCHAR(10);
        ALTER TABLE Notifications ALTER COLUMN Message NVARCHAR(500);
        PRINT 'Notifications table columns updated to NVARCHAR.';
    END
    ELSE
    BEGIN
        PRINT 'Notifications table already exists with correct types.';
    END
END
GO
