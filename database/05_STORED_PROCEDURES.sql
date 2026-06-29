-- ============================================================
--   UNIHOSTEL MANAGEMENT SYSTEM
--   FILE 05 — STORED PROCEDURES
--   DBMS Concepts: Stored Procedure, Parameters (IN/OUT),
--                  Error Handling (TRY/CATCH), Transaction,
--                  Dynamic SQL, EXEC, Return values
-- ============================================================

USE HostelManagement;
GO

-- ────────────────────────────────────────────────────────────
-- SP 1: Register New Student
-- CONCEPT: INPUT parameters, INSERT + validation
-- ────────────────────────────────────────────────────────────
CREATE PROCEDURE sp_RegisterStudent
    @RegNumber    VARCHAR(30),
    @FullName     VARCHAR(100),
    @Email        VARCHAR(120),
    @PasswordHash VARCHAR(255),
    @Phone        VARCHAR(15),
    @Gender       CHAR(1),
    @CGPA         DECIMAL(3,2),
    @DeptID       INT,
    @Semester     INT,
    @NewStudentID INT OUTPUT    -- OUTPUT parameter
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Check duplicate email
        IF EXISTS (SELECT 1 FROM Students WHERE Email = @Email)
            THROW 50001, 'Email already registered.', 1;

        -- Check duplicate reg number
        IF EXISTS (SELECT 1 FROM Students WHERE RegNumber = @RegNumber)
            THROW 50002, 'Registration number already exists.', 1;

        -- Validate department
        IF NOT EXISTS (SELECT 1 FROM Departments WHERE DeptID = @DeptID)
            THROW 50003, 'Invalid department ID.', 1;

        -- Insert student
        INSERT INTO Students (RegNumber,FullName,Email,PasswordHash,Phone,Gender,CGPA,DeptID,Semester)
        VALUES (@RegNumber,@FullName,@Email,@PasswordHash,@Phone,@Gender,@CGPA,@DeptID,@Semester);

        SET @NewStudentID = SCOPE_IDENTITY();  -- Get last inserted ID

        COMMIT TRANSACTION;
        PRINT 'Student registered: ' + @FullName + ' (ID: ' + CAST(@NewStudentID AS VARCHAR) + ')';
        RETURN 0;  -- Success

    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        PRINT 'Error: ' + ERROR_MESSAGE();
        SET @NewStudentID = -1;
        RETURN -1;  -- Failure
    END CATCH
END;
GO

-- ────────────────────────────────────────────────────────────
-- SP 2: Apply for Room Booking (with CGPA validation)
-- CONCEPT: Multi-step transaction, business rules
-- ────────────────────────────────────────────────────────────
CREATE PROCEDURE sp_ApplyBooking
    @StudentID  INT,
    @RoomID     INT,
    @StartDate  DATE,
    @NewBookingID INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @StudentCGPA DECIMAL(3,2);
    DECLARE @RoomHallID  INT;
    DECLARE @RoomTierID  INT;
    DECLARE @TierMinCGPA DECIMAL(3,2);
    DECLARE @TierMaxCGPA DECIMAL(3,2);

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Get student CGPA
        SELECT @StudentCGPA = CGPA FROM Students WHERE StudentID = @StudentID;
        IF @StudentCGPA IS NULL
            THROW 50010, 'Student not found.', 1;

        -- Get room's hall and tier info
        SELECT @RoomHallID = r.HallID, @RoomTierID = h.TierID
        FROM Rooms r
        INNER JOIN Halls h ON r.HallID = h.HallID
        WHERE r.RoomID = @RoomID;
        IF @RoomHallID IS NULL
            THROW 50011, 'Room not found.', 1;

        -- Check room availability
        IF NOT EXISTS (SELECT 1 FROM Rooms WHERE RoomID = @RoomID AND IsAvailable = 1)
            THROW 50012, 'Room is not available.', 1;

        -- Check CGPA eligibility
        SELECT @TierMinCGPA = t.MinCGPA, @TierMaxCGPA = t.MaxCGPA
        FROM HallTiers t WHERE t.TierID = @RoomTierID;

        IF @StudentCGPA < @TierMinCGPA OR @StudentCGPA > @TierMaxCGPA
            THROW 50013, 'Your CGPA does not meet the requirement for this hall tier.', 1;

        -- Check no existing active booking
        IF EXISTS (
            SELECT 1 FROM Bookings
            WHERE StudentID = @StudentID AND Status IN ('Active','Approved','Pending')
        )
            THROW 50014, 'Student already has an active booking.', 1;

        -- Insert booking
        INSERT INTO Bookings (StudentID, RoomID, HallID, StartDate, Status)
        VALUES (@StudentID, @RoomID, @RoomHallID, @StartDate, 'Pending');

        SET @NewBookingID = SCOPE_IDENTITY();

        COMMIT TRANSACTION;
        PRINT 'Booking application submitted. ID: ' + CAST(@NewBookingID AS VARCHAR);
        RETURN 0;

    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        PRINT 'Booking failed: ' + ERROR_MESSAGE();
        SET @NewBookingID = -1;
        RETURN -1;
    END CATCH
END;
GO

-- ────────────────────────────────────────────────────────────
-- SP 3: Approve or Reject Booking
-- CONCEPT: UPDATE with transaction, OUTPUT param
-- ────────────────────────────────────────────────────────────
CREATE PROCEDURE sp_ProcessBooking
    @BookingID INT,
    @AdminID   INT,
    @Action    VARCHAR(10),    -- 'Approve' or 'Reject'
    @Reason    VARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Action NOT IN ('Approve','Reject')
        THROW 50020, 'Invalid action. Use Approve or Reject.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Validate booking exists and is Pending
        IF NOT EXISTS (SELECT 1 FROM Bookings WHERE BookingID = @BookingID AND Status = 'Pending')
            THROW 50021, 'Booking not found or is not in Pending status.', 1;

        -- Validate admin
        IF NOT EXISTS (SELECT 1 FROM Admins WHERE AdminID = @AdminID AND IsActive = 1)
            THROW 50022, 'Admin not found.', 1;

        -- Update booking
        UPDATE Bookings
        SET Status = CASE @Action WHEN 'Approve' THEN 'Active' ELSE 'Rejected' END,
            ApprovedBy = @AdminID,
            RejectionReason = CASE @Action WHEN 'Reject' THEN @Reason ELSE NULL END
        WHERE BookingID = @BookingID;

        COMMIT TRANSACTION;
        PRINT 'Booking ' + @Action + 'd successfully.';
        RETURN 0;

    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        PRINT 'Error processing booking: ' + ERROR_MESSAGE();
        RETURN -1;
    END CATCH
END;
GO

-- ────────────────────────────────────────────────────────────
-- SP 4: Generate Monthly Fee Records for All Active Students
-- CONCEPT: Cursor usage, WHILE loop, DATEADD/EOMONTH
-- ────────────────────────────────────────────────────────────
CREATE PROCEDURE sp_GenerateMonthlyFees
    @Month INT,
    @Year  INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @StudentID  INT;
    DECLARE @BookingID  INT;
    DECLARE @Amount     DECIMAL(10,2);
    DECLARE @DueDate    DATE;
    DECLARE @Count      INT = 0;

    -- Due date = last day of the given month
    SET @DueDate = EOMONTH(DATEFROMPARTS(@Year, @Month, 1));

    -- CURSOR — iterate over all active bookings
    DECLARE fee_cursor CURSOR FOR
        SELECT b.StudentID, b.BookingID, r.MonthlyFee
        FROM Bookings b
        INNER JOIN Rooms r ON b.RoomID = r.RoomID
        WHERE b.Status = 'Active';

    OPEN fee_cursor;
    FETCH NEXT FROM fee_cursor INTO @StudentID, @BookingID, @Amount;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- Only insert if not already exists for this period
        IF NOT EXISTS (
            SELECT 1 FROM RoomFeeRecords
            WHERE StudentID = @StudentID AND BookingID = @BookingID
              AND Month = @Month AND Year = @Year
        )
        BEGIN
            INSERT INTO RoomFeeRecords (StudentID, BookingID, Month, Year, Amount, DueDate)
            VALUES (@StudentID, @BookingID, @Month, @Year, @Amount, @DueDate);
            SET @Count = @Count + 1;
        END

        FETCH NEXT FROM fee_cursor INTO @StudentID, @BookingID, @Amount;
    END

    CLOSE fee_cursor;
    DEALLOCATE fee_cursor;

    PRINT CAST(@Count AS VARCHAR) + ' fee records generated for ' +
          DATENAME(MONTH, DATEFROMPARTS(@Year, @Month, 1)) + ' ' + CAST(@Year AS VARCHAR);
END;
GO

-- ────────────────────────────────────────────────────────────
-- SP 5: Record Fee Payment (with Transaction)
-- CONCEPT: Multi-table update, transaction, error handling
-- ────────────────────────────────────────────────────────────
CREATE PROCEDURE sp_RecordFeePayment
    @StudentID   INT,
    @FeeID       INT,
    @FeeType     VARCHAR(10),   -- 'Room' or 'Mess'
    @MethodID    INT,
    @ReferenceNo VARCHAR(100),
    @AdminID     INT
AS
BEGIN
    SET NOCOUNT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @Amount DECIMAL(10,2);

        IF @FeeType = 'Room'
        BEGIN
            SELECT @Amount = Amount FROM RoomFeeRecords WHERE FeeID = @FeeID AND StudentID = @StudentID;
            IF @Amount IS NULL THROW 50030, 'Room fee record not found.', 1;

            UPDATE RoomFeeRecords
            SET IsPaid = 1, PaidOn = GETDATE()
            WHERE FeeID = @FeeID;
        END
        ELSE IF @FeeType = 'Mess'
        BEGIN
            SELECT @Amount = Amount FROM MessBillRecords WHERE BillID = @FeeID AND StudentID = @StudentID;
            IF @Amount IS NULL THROW 50031, 'Mess bill not found.', 1;

            UPDATE MessBillRecords
            SET IsPaid = 1, PaidOn = GETDATE()
            WHERE BillID = @FeeID;
        END
        ELSE
            THROW 50032, 'Invalid FeeType. Use Room or Mess.', 1;

        -- Record the transaction
        INSERT INTO PaymentTransactions (StudentID, MethodID, Amount, ReferenceNo, PaymentFor, VerifiedBy)
        VALUES (@StudentID, @MethodID, @Amount, @ReferenceNo, @FeeType, @AdminID);

        COMMIT TRANSACTION;
        PRINT 'Payment of PKR ' + CAST(@Amount AS VARCHAR) + ' recorded successfully.';
        RETURN 0;

    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        PRINT 'Payment failed: ' + ERROR_MESSAGE();
        RETURN -1;
    END CATCH
END;
GO

-- ────────────────────────────────────────────────────────────
-- SP 6: Search Students (Dynamic SQL)
-- CONCEPT: Dynamic SQL with EXEC / sp_executesql
-- ────────────────────────────────────────────────────────────
CREATE PROCEDURE sp_SearchStudents
    @SearchTerm VARCHAR(100) = NULL,
    @DeptID     INT          = NULL,
    @MinCGPA    DECIMAL(3,2) = NULL,
    @MaxCGPA    DECIMAL(3,2) = NULL,
    @Semester   INT          = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @SQL   NVARCHAR(2000);
    DECLARE @Params NVARCHAR(500);

    SET @SQL = N'
        SELECT s.StudentID, s.RegNumber, s.FullName, s.Email, s.CGPA,
               d.DeptName, s.Semester, t.TierName AS HallTier
        FROM Students s
        INNER JOIN Departments d ON s.DeptID = d.DeptID
        INNER JOIN HallTiers   t ON s.CGPA BETWEEN t.MinCGPA AND t.MaxCGPA
        WHERE s.IsActive = 1';

    IF @SearchTerm IS NOT NULL
        SET @SQL = @SQL + N' AND (s.FullName LIKE ''%'' + @SearchTerm + ''%'' 
                              OR s.RegNumber LIKE ''%'' + @SearchTerm + ''%''
                              OR s.Email LIKE ''%'' + @SearchTerm + ''%'')';
    IF @DeptID IS NOT NULL
        SET @SQL = @SQL + N' AND s.DeptID = @DeptID';
    IF @MinCGPA IS NOT NULL
        SET @SQL = @SQL + N' AND s.CGPA >= @MinCGPA';
    IF @MaxCGPA IS NOT NULL
        SET @SQL = @SQL + N' AND s.CGPA <= @MaxCGPA';
    IF @Semester IS NOT NULL
        SET @SQL = @SQL + N' AND s.Semester = @Semester';

    SET @SQL = @SQL + N' ORDER BY s.CGPA DESC';

    SET @Params = N'@SearchTerm VARCHAR(100), @DeptID INT, @MinCGPA DECIMAL(3,2), @MaxCGPA DECIMAL(3,2), @Semester INT';

    EXEC sp_executesql @SQL, @Params,
        @SearchTerm = @SearchTerm,
        @DeptID     = @DeptID,
        @MinCGPA    = @MinCGPA,
        @MaxCGPA    = @MaxCGPA,
        @Semester   = @Semester;
END;
GO

-- ────────────────────────────────────────────────────────────
-- SP 7: Transfer Student Room
-- CONCEPT: Complex transaction, multiple table updates
-- ────────────────────────────────────────────────────────────
CREATE PROCEDURE sp_TransferStudentRoom
    @StudentID  INT,
    @NewRoomID  INT,
    @AdminID    INT,
    @Reason     VARCHAR(300)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @OldBookingID INT, @OldRoomID INT, @OldHallID INT;
    DECLARE @NewHallID INT;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Get current booking
        SELECT TOP 1 @OldBookingID = BookingID, @OldRoomID = RoomID, @OldHallID = HallID
        FROM Bookings
        WHERE StudentID = @StudentID AND Status = 'Active';

        IF @OldBookingID IS NULL
            THROW 50040, 'Student has no active booking to transfer from.', 1;

        -- Get new room's hall
        SELECT @NewHallID = HallID FROM Rooms WHERE RoomID = @NewRoomID;
        IF @NewHallID IS NULL THROW 50041, 'New room not found.', 1;

        -- Check new room is available
        IF NOT EXISTS (SELECT 1 FROM Rooms WHERE RoomID = @NewRoomID AND IsAvailable = 1)
            THROW 50042, 'New room is not available.', 1;

        -- Log transfer
        INSERT INTO RoomTransfers (StudentID,OldRoomID,NewRoomID,OldHallID,NewHallID,Reason,ApprovedBy,Status)
        VALUES (@StudentID, @OldRoomID, @NewRoomID, @OldHallID, @NewHallID, @Reason, @AdminID, 'Approved');

        -- Vacate old booking
        UPDATE Bookings
        SET Status = 'Vacated', EndDate = CAST(GETDATE() AS DATE)
        WHERE BookingID = @OldBookingID;

        -- Mark old room available
        UPDATE Rooms SET IsAvailable = 1 WHERE RoomID = @OldRoomID;

        -- Create new booking
        INSERT INTO Bookings (StudentID, RoomID, HallID, StartDate, Status, ApprovedBy)
        VALUES (@StudentID, @NewRoomID, @NewHallID, CAST(GETDATE() AS DATE), 'Active', @AdminID);

        -- Mark new room unavailable
        UPDATE Rooms SET IsAvailable = 0 WHERE RoomID = @NewRoomID;

        COMMIT TRANSACTION;
        PRINT 'Room transfer completed successfully.';
        RETURN 0;

    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        PRINT 'Transfer failed: ' + ERROR_MESSAGE();
        RETURN -1;
    END CATCH
END;
GO

-- ────────────────────────────────────────────────────────────
-- SP 8: Monthly Revenue Report
-- CONCEPT: Aggregate queries, temp table, result set
-- ────────────────────────────────────────────────────────────
CREATE PROCEDURE sp_MonthlyRevenueReport
    @Month INT,
    @Year  INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Temp table
    CREATE TABLE #RevenueReport (
        HallName     VARCHAR(100),
        TierName     VARCHAR(20),
        RoomRevenue  DECIMAL(10,2),
        MessRevenue  DECIMAL(10,2),
        TotalRevenue DECIMAL(10,2),
        UnpaidCount  INT
    );

    INSERT INTO #RevenueReport
    SELECT
        h.HallName,
        t.TierName,
        ISNULL(SUM(CASE WHEN rf.IsPaid=1 THEN rf.Amount ELSE 0 END), 0) AS RoomRevenue,
        0 AS MessRevenue,
        ISNULL(SUM(CASE WHEN rf.IsPaid=1 THEN rf.Amount ELSE 0 END), 0) AS TotalRevenue,
        COUNT(CASE WHEN rf.IsPaid=0 THEN 1 END)                          AS UnpaidCount
    FROM Halls h
    LEFT JOIN HallTiers      t  ON h.TierID     = t.TierID
    LEFT JOIN Bookings        b  ON b.HallID     = h.HallID AND b.Status='Active'
    LEFT JOIN RoomFeeRecords  rf ON rf.BookingID = b.BookingID
                                 AND rf.Month = @Month AND rf.Year = @Year
    GROUP BY h.HallName, t.TierName;

    SELECT
        HallName, TierName,
        RoomRevenue, MessRevenue, TotalRevenue, UnpaidCount,
        DATENAME(MONTH, DATEFROMPARTS(@Year,@Month,1)) + ' ' + CAST(@Year AS VARCHAR) AS Period
    FROM #RevenueReport
    ORDER BY TotalRevenue DESC;

    -- Summary row
    SELECT
        'TOTAL' AS HallName,
        SUM(RoomRevenue)  AS TotalRoomRevenue,
        SUM(MessRevenue)  AS TotalMessRevenue,
        SUM(TotalRevenue) AS GrandTotal,
        SUM(UnpaidCount)  AS TotalUnpaid
    FROM #RevenueReport;

    DROP TABLE #RevenueReport;
END;
GO

PRINT '8 Stored Procedures created!';
PRINT 'sp_RegisterStudent, sp_ApplyBooking, sp_ProcessBooking,';
PRINT 'sp_GenerateMonthlyFees (cursor), sp_RecordFeePayment,';
PRINT 'sp_SearchStudents (dynamic SQL), sp_TransferStudentRoom, sp_MonthlyRevenueReport';



GO
