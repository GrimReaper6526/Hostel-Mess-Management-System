-- ============================================================
--   UNIHOSTEL MANAGEMENT SYSTEM
--   FILE 02 — SEED DATA (INSERT STATEMENTS)
--   DBMS Concepts: DML INSERT, Referential Integrity order,
--                  Identity columns, NULL values
-- ============================================================

USE HostelManagement;
GO

-- ── DEPARTMENTS ──────────────────────────────────────────────
INSERT INTO Departments (DeptName, DeptCode, Faculty) VALUES
('Computer Science',        'CS',   'Faculty of Computing'),
('Software Engineering',    'SE',   'Faculty of Computing'),
('Electrical Engineering',  'EE',   'Faculty of Engineering'),
('Mechanical Engineering',  'ME',   'Faculty of Engineering'),
('Civil Engineering',       'CE',   'Faculty of Engineering'),
('Business Administration', 'BBA',  'Faculty of Management'),
('Mathematics',             'MTH',  'Faculty of Sciences'),
('Physics',                 'PHY',  'Faculty of Sciences'),
('Chemistry',               'CHM',  'Faculty of Sciences'),
('Economics',               'ECO',  'Faculty of Social Sciences');
GO

-- ── HALL TIERS ───────────────────────────────────────────────
INSERT INTO HallTiers (TierName, MinCGPA, MaxCGPA, Description) VALUES
('Premium',  3.50, 4.00, 'High achievers — CGPA 3.50 and above. Fully air-conditioned.'),
('Standard', 2.50, 3.49, 'Good standing — CGPA 2.50 to 3.49. WiFi and common room.'),
('Basic',    0.00, 2.49, 'Open to all students — CGPA below 2.50. Basic amenities.');
GO

-- ── ROOM TYPES ───────────────────────────────────────────────
INSERT INTO RoomTypes (TypeName, Capacity, Description) VALUES
('2-Seater', 2, 'Shared room for two students'),
('5-Seater', 5, 'Shared room for five students');
GO

-- ── COMPLAINT CATEGORIES ─────────────────────────────────────
INSERT INTO ComplaintCategories (CategoryName, Icon, Priority) VALUES
('Maintenance',  '🔧', 'Medium'),
('Electricity',  '⚡', 'High'),
('Water',        '💧', 'High'),
('Internet',     '📶', 'Medium'),
('Mess',         '🍽️', 'Low'),
('Security',     '🔒', 'High'),
('Cleanliness',  '🧹', 'Low'),
('Other',        '📌', 'Low');
GO

-- ── PAYMENT METHODS ──────────────────────────────────────────
INSERT INTO PaymentMethods (MethodName) VALUES
('Cash'),
('Bank Transfer'),
('JazzCash'),
('EasyPaisa'),
('Credit/Debit Card'),
('Cheque');
GO

-- ── HALLS ────────────────────────────────────────────────────
INSERT INTO Halls (HallName, TierID, TotalRooms, Location, Facilities, EstYear, TargetYear) VALUES
('I Hall',  1, 100, 'North Campus Block A', 'AC, WiFi, Study Room, Gym, 24/7 Power', 2010, 4),
('Q Hall',  2, 100, 'Central Campus Block B','WiFi, Common Room, Laundry, Cafeteria', 2005, 2),
('AB Hall', 3, 100, 'South Campus Block C',  'Common Room, Cafeteria, Parking',       1998, 3),
('JB Hall', 2, 100, 'Central Campus Block D', 'WiFi, Common Room, Study Area',         2015, 1);
GO

-- ── FLOORS ───────────────────────────────────────────────────
INSERT INTO Floors (HallID, FloorNumber, FloorName, WardenRoom) VALUES
(1, 0, 'Ground Floor', 'G-00'), (1, 1, 'First Floor',  'A-100'), (1, 2, 'Second Floor', 'A-200'),
(2, 0, 'Ground Floor', 'G-00'), (2, 1, 'First Floor',  'B-100'), (2, 2, 'Second Floor', 'B-200'),
(3, 0, 'Ground Floor', 'G-00'), (3, 1, 'First Floor',  'C-100'), (3, 2, 'Second Floor', 'C-200'),
(4, 0, 'Ground Floor', 'G-00'), (4, 1, 'First Floor',  'D-100'), (4, 2, 'Second Floor', 'D-200');
GO

-- ── ROOM GENERATION (100 rooms per hall, 2-Seater & 5-Seater) ────────────────
DECLARE @HallID INT = 1;
DECLARE @HallName VARCHAR(100);
DECLARE @RoomCounter INT;
DECLARE @FloorNumber INT;
DECLARE @FloorID INT;
DECLARE @RoomTypeID INT;
DECLARE @MonthlyFee DECIMAL(10,2);
DECLARE @FloorPrefix VARCHAR(5);
DECLARE @RoomNumber VARCHAR(20);

WHILE @HallID <= 4
BEGIN
    SELECT @HallName = HallName FROM Halls WHERE HallID = @HallID;
    
    SET @RoomCounter = 1;
    WHILE @RoomCounter <= 100
    BEGIN
        -- Map to floors: 1-34 Ground, 35-67 First, 68-100 Second
        IF @RoomCounter <= 34
        BEGIN
            SET @FloorNumber = 0;
            SET @FloorPrefix = 'G-';
        END
        ELSE IF @RoomCounter <= 67
        BEGIN
            SET @FloorNumber = 1;
            SET @FloorPrefix = '1-';
        END
        ELSE
        BEGIN
            SET @FloorNumber = 2;
            SET @FloorPrefix = '2-';
        END

        SELECT @FloorID = FloorID FROM Floors WHERE HallID = @HallID AND FloorNumber = @FloorNumber;
        
        -- Alternate room types: odd = 2-Seater, even = 5-Seater
        IF @RoomCounter % 2 = 1
        BEGIN
            SET @RoomTypeID = 1; -- 2-Seater (RoomTypeID = 1)
            SET @MonthlyFee = 8000.00;
        END
        ELSE
        BEGIN
            SET @RoomTypeID = 2; -- 5-Seater (RoomTypeID = 2)
            SET @MonthlyFee = 5000.00;
        END

        SET @RoomNumber = @FloorPrefix + RIGHT('00' + CAST(@RoomCounter AS VARCHAR(3)), 3);

        INSERT INTO Rooms (HallID, FloorID, RoomTypeID, RoomNumber, MonthlyFee, IsAvailable, HallName)
        VALUES (@HallID, @FloorID, @RoomTypeID, @RoomNumber, @MonthlyFee, 1, @HallName);

        SET @RoomCounter = @RoomCounter + 1;
    END

    SET @HallID = @HallID + 1;
END;
GO


-- ── ADMIN ROLES ──────────────────────────────────────────────
INSERT INTO AdminRoles (RoleName) VALUES
('Warden');
GO

-- ── MESS CATEGORIES ──────────────────────────────────────────
INSERT INTO MessCategories (CategoryName) VALUES
('Breakfast'),('Lunch'),('Dinner'),('Snack');
GO

-- ── FOOD ITEMS ───────────────────────────────────────────────
INSERT INTO FoodItems (FoodName, IsVeg, IsHalal, Calories, Price) VALUES
('Paratha',          1,1,320, 100.00), ('Chai',             1,1,80,  60.00),
('Fried Eggs',       0,1,150, 120.00), ('Halwa Puri',        1,1,480, 150.00),
('Daal Chawal',      1,1,420, 160.00), ('Chicken Karahi',    0,1,520, 350.00),
('Naan',             1,1,200, 40.00),  ('Biryani',           0,1,580, 280.00),
('Beef Qorma',       0,1,540, 350.00), ('Nihari',            0,1,620, 350.00),
('Chana Masala',     1,1,380, 160.00), ('Mutton Karahi',     0,1,560, 350.00),
('Pulao',            0,1,490, 280.00), ('Fish Curry',        0,1,430, 350.00),
('Raita',            1,1,90,  60.00),  ('Salad',             1,1,60,  60.00),
('French Toast',     1,1,280, 120.00), ('Aloo Gosht',        0,1,500, 350.00),
('BBQ Chicken',      0,1,510, 350.00), ('Omelette',          0,1,140, 120.00);
GO

-- ── MESS MENU (weekly schedule) ──────────────────────────────
INSERT INTO MessMenu (DayOfWeek,MessCatID,FoodID) VALUES
('Monday',1,1),('Monday',1,2),('Monday',1,3),
('Monday',2,5),('Monday',2,15),('Monday',2,16),
('Monday',3,6),('Monday',3,7),('Monday',3,15),
('Tuesday',1,4),('Tuesday',1,2),
('Tuesday',2,8),('Tuesday',2,15),('Tuesday',2,16),
('Tuesday',3,9),('Tuesday',3,7),('Tuesday',3,16),
('Wednesday',1,20),('Wednesday',1,2),
('Wednesday',2,5),('Wednesday',2,7),('Wednesday',2,15),
('Wednesday',3,14),('Wednesday',3,7),
('Thursday',1,10),('Thursday',1,7),
('Thursday',2,11),('Thursday',2,7),('Thursday',2,16),
('Thursday',3,12),('Thursday',3,7),('Thursday',3,15),
('Friday',1,4),('Friday',1,2),
('Friday',2,13),('Friday',2,15),
('Friday',3,19),('Friday',3,7),('Friday',3,16),
('Saturday',1,1),('Saturday',1,3),
('Saturday',2,18),('Saturday',2,7),('Saturday',2,16),
('Saturday',3,5),('Saturday',3,7),
('Sunday',1,17),('Sunday',1,2),
('Sunday',2,8),('Sunday',2,15),('Sunday',2,16),
('Sunday',3,6),('Sunday',3,7);
GO

-- ── FEE STRUCTURE ────────────────────────────────────────────
INSERT INTO FeeStructure (FeeType,TierID,Amount,EffectiveFrom,Description) VALUES
('Room Fee - 2-Seater',  NULL, 8000,'2024-01-01','Monthly room rental fee for 2-Seater rooms'),
('Room Fee - 5-Seater',  NULL, 5000,'2024-01-01','Monthly room rental fee for 5-Seater rooms'),
('Security Deposit',     NULL, 5000,'2024-01-01','One-time refundable security deposit'),
('Electricity Surcharge',1,    800,'2024-01-01','Monthly electricity AC surcharge');
GO

PRINT 'All lookup and configuration seed data inserted successfully!';
GO
