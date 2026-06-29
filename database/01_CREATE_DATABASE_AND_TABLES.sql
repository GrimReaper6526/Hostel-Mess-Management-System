-- ============================================================
--   UNIHOSTEL MANAGEMENT SYSTEM
--   FILE 01 — DATABASE, TABLES, KEYS & CONSTRAINTS
--   DBMS Concepts: DDL, Primary Key, Foreign Key, Unique,
--                  Check, Default, Not Null, Identity,
--                  Composite Key, Self-Reference, 3NF
-- ============================================================

USE master;
GO

-- Drop and recreate database
IF EXISTS (SELECT name FROM sys.databases WHERE name = 'HostelManagement')
BEGIN
    ALTER DATABASE HostelManagement SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE HostelManagement;
END
GO

CREATE DATABASE HostelManagement;
GO
USE HostelManagement;
GO

PRINT '====================================================';
PRINT ' HOSTEL MANAGEMENT SYSTEM — DATABASE INITIALIZED';
PRINT '====================================================';

-- ============================================================
-- SECTION 1: LOOKUP / REFERENCE TABLES (Master Data)
-- CONCEPT: Normalization — separating repeating groups
-- ============================================================

-- 1.1 DEPARTMENTS
CREATE TABLE Departments (
    DeptID      INT IDENTITY(1,1) PRIMARY KEY,      -- Identity column (auto-increment)
    DeptName    VARCHAR(100) NOT NULL UNIQUE,        -- Unique constraint
    DeptCode    CHAR(4)      NOT NULL UNIQUE,        -- Fixed-length, unique
    Faculty     VARCHAR(100),
    IsActive    BIT          NOT NULL DEFAULT 1      -- Default constraint
);
GO

-- 1.3 ROOM TYPES
CREATE TABLE RoomTypes (
    RoomTypeID  INT IDENTITY(1,1) PRIMARY KEY,
    TypeName    VARCHAR(20) NOT NULL UNIQUE CHECK (TypeName IN ('Single','Double','Triple','Suite','2-Seater','5-Seater')),
    Capacity    INT NOT NULL CHECK (Capacity BETWEEN 1 AND 6),
    Description VARCHAR(200)
);
GO

-- 1.4 COMPLAINT CATEGORIES
CREATE TABLE ComplaintCategories (
    CategoryID  INT IDENTITY(1,1) PRIMARY KEY,
    CategoryName VARCHAR(50) NOT NULL UNIQUE,
    Icon        VARCHAR(10),
    Priority    VARCHAR(10) DEFAULT 'Medium' CHECK (Priority IN ('Low','Medium','High'))
);
GO

-- 1.5 PAYMENT METHODS
CREATE TABLE PaymentMethods (
    MethodID    INT IDENTITY(1,1) PRIMARY KEY,
    MethodName  VARCHAR(50) NOT NULL UNIQUE,  -- e.g. Cash, Bank Transfer, JazzCash
    IsActive    BIT DEFAULT 1
);
GO

-- ============================================================
-- SECTION 2: CORE ENTITY TABLES
-- CONCEPT: Entity, Attributes, Primary Key
-- ============================================================

-- 2.1 HALLS
CREATE TABLE Halls (
    HallID      INT IDENTITY(1,1) PRIMARY KEY,
    HallName    VARCHAR(100) NOT NULL UNIQUE,
    TotalRooms  INT NOT NULL CHECK (TotalRooms > 0),
    Location    VARCHAR(100),
    Facilities  VARCHAR(500),
    EstYear     INT CHECK (EstYear BETWEEN 1900 AND 2100),
    IsActive    BIT DEFAULT 1,
    TargetYear  INT NULL CHECK (TargetYear BETWEEN 1 AND 4),
    CreatedAt   DATETIME DEFAULT GETDATE()
);
GO

-- 2.2 FLOORS (child of Halls — 1-to-many)
CREATE TABLE Floors (
    FloorID     INT IDENTITY(1,1) PRIMARY KEY,
    HallID      INT NOT NULL,
    FloorNumber INT NOT NULL CHECK (FloorNumber >= 0),
    FloorName   VARCHAR(50),  -- e.g. "Ground Floor", "First Floor"
    WardenRoom  VARCHAR(10),
    CONSTRAINT fk_floors_hall FOREIGN KEY (HallID)
        REFERENCES Halls(HallID) ON DELETE CASCADE, -- CASCADE delete
    CONSTRAINT uq_floor_in_hall UNIQUE (HallID, FloorNumber) -- Composite unique constraint
);
GO

-- 2.3 ROOMS
-- CONCEPT: Composite Foreign Key, Multiple Constraints
CREATE TABLE Rooms (
    RoomID      INT IDENTITY(1,1) PRIMARY KEY,
    HallID      INT NOT NULL,
    FloorID     INT NOT NULL,
    RoomTypeID  INT NOT NULL,
    RoomNumber  VARCHAR(20) NOT NULL,
    MonthlyFee  DECIMAL(10,2) NOT NULL CHECK (MonthlyFee > 0),
    IsAvailable BIT NOT NULL DEFAULT 1,
    HallName    VARCHAR(100) NULL,
    CONSTRAINT fk_rooms_hall FOREIGN KEY (HallID)
        REFERENCES Halls(HallID),
    CONSTRAINT fk_rooms_floor FOREIGN KEY (FloorID)
        REFERENCES Floors(FloorID),
    CONSTRAINT fk_rooms_type FOREIGN KEY (RoomTypeID)
        REFERENCES RoomTypes(RoomTypeID),
    CONSTRAINT uq_room_in_hall UNIQUE (HallID, RoomNumber) -- Unique within hall
);
GO

-- 2.4 STUDENTS
-- CONCEPT: Entity Integrity, Domain Constraints, Referential Integrity
CREATE TABLE Students (
    StudentID   INT IDENTITY(1,1) PRIMARY KEY,
    RegNumber   VARCHAR(30) NOT NULL UNIQUE,
    FullName    VARCHAR(100) NOT NULL,
    Email       VARCHAR(120) NOT NULL UNIQUE,
    PasswordHash VARCHAR(255) NOT NULL,
    Phone       VARCHAR(15),
    DateOfBirth DATE CHECK (DateOfBirth < GETDATE()),
    CGPA        DECIMAL(3,2) NOT NULL CHECK (CGPA >= 0.00 AND CGPA <= 4.00),
    DeptID      INT NOT NULL,
    Semester    INT NOT NULL CHECK (Semester BETWEEN 1 AND 12),
    IsActive    BIT DEFAULT 1,
    CreatedAt   DATETIME DEFAULT GETDATE(),
    UpdatedAt   DATETIME DEFAULT GETDATE(),
    CONSTRAINT fk_students_dept FOREIGN KEY (DeptID)
        REFERENCES Departments(DeptID)
);
GO

-- 2.5 ADMINS (Wardens, Sub-Wardens)
-- CONCEPT: Role-based table structure
CREATE TABLE AdminRoles (
    RoleID      INT IDENTITY(1,1) PRIMARY KEY,
    RoleName    VARCHAR(50) NOT NULL UNIQUE  -- Chief Warden, Warden, Sub-Warden
);
GO

CREATE TABLE Admins (
    AdminID     INT IDENTITY(1,1) PRIMARY KEY,
    FullName    VARCHAR(100) NOT NULL,
    Email       VARCHAR(120) NOT NULL UNIQUE,
    PasswordHash VARCHAR(255) NOT NULL,
    Phone       VARCHAR(15),
    RoleID      INT NOT NULL DEFAULT 1,
    IsActive    BIT DEFAULT 1,
    CONSTRAINT fk_admins_role FOREIGN KEY (RoleID)
        REFERENCES AdminRoles(RoleID)
);
GO

-- ============================================================
-- SECTION 3: RELATIONSHIP / JUNCTION TABLES
-- CONCEPT: Many-to-Many, Junction Tables, Composite PKs
-- ============================================================

-- 3.1 BOOKINGS (Student ↔ Room — Many-to-Many via time)
CREATE TABLE Bookings (
    BookingID      INT IDENTITY(1,1) PRIMARY KEY,
    StudentID      INT NOT NULL,
    RoomID         INT NOT NULL,
    HallID         INT NOT NULL,
    HallName       VARCHAR(100) NULL,
    StartDate      DATE NOT NULL,
    EndDate        DATE,
    DurationMonths INT NOT NULL DEFAULT 12,
    Status         VARCHAR(20) NOT NULL DEFAULT 'Pending'
                   CHECK (Status IN ('Pending','Approved','Rejected','Active','Vacated','Cancelled')),
    ApprovedBy     VARCHAR(100),           -- Stores Admin/Warden FullName
    BookingDate    DATETIME DEFAULT GETDATE(),
    CONSTRAINT fk_bookings_student FOREIGN KEY (StudentID)
        REFERENCES Students(StudentID) ON DELETE CASCADE,
    CONSTRAINT fk_bookings_room FOREIGN KEY (RoomID)
        REFERENCES Rooms(RoomID),
    CONSTRAINT fk_bookings_hall FOREIGN KEY (HallID)
        REFERENCES Halls(HallID),
    CONSTRAINT chk_dates CHECK (EndDate IS NULL OR EndDate > StartDate)
);
GO

-- ============================================================
-- SECTION 4: MESS / FOOD TABLES
-- CONCEPT: Normalization (2NF — no partial dependency)
-- ============================================================

-- 4.1 MESS CATEGORIES
CREATE TABLE MessCategories (
    MessCatID   INT IDENTITY(1,1) PRIMARY KEY,
    CategoryName VARCHAR(30) NOT NULL UNIQUE  -- e.g. Breakfast, Lunch, Dinner, Snack
);
GO

-- 4.2 FOOD ITEMS (master list of all foods)
CREATE TABLE FoodItems (
    FoodID      INT IDENTITY(1,1) PRIMARY KEY,
    FoodName    VARCHAR(150) NOT NULL UNIQUE,
    IsVeg       BIT DEFAULT 0,
    IsHalal     BIT DEFAULT 1,
    Calories    INT CHECK (Calories >= 0),
    Price       DECIMAL(10,2) NOT NULL DEFAULT 150.00
);
GO

-- 4.3 WEEKLY MESS MENU
-- CONCEPT: Junction table — FoodItems linked to day+mealtype
CREATE TABLE MessMenu (
    MenuID      INT IDENTITY(1,1) PRIMARY KEY,
    DayOfWeek   VARCHAR(10) NOT NULL CHECK (DayOfWeek IN
                ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
    MessCatID   INT NOT NULL,
    FoodID      INT NOT NULL,
    IsActive    BIT DEFAULT 1,
    CONSTRAINT fk_menu_cat  FOREIGN KEY (MessCatID) REFERENCES MessCategories(MessCatID),
    CONSTRAINT fk_menu_food FOREIGN KEY (FoodID)    REFERENCES FoodItems(FoodID),
    CONSTRAINT uq_menu_slot UNIQUE (DayOfWeek, MessCatID, FoodID) -- no duplicates
);
GO

-- ============================================================
-- SECTION 5: FEE & PAYMENT TABLES
-- CONCEPT: Transitive dependency (3NF), cascading records
-- ============================================================

-- 5.1 FEE STRUCTURE (what fees exist)
CREATE TABLE FeeStructure (
    FeeStructureID INT IDENTITY(1,1) PRIMARY KEY,
    FeeType        VARCHAR(50) NOT NULL,  -- Room Fee, Mess Fee, etc.
    Amount         DECIMAL(10,2) NOT NULL CHECK (Amount >= 0),
    EffectiveFrom  DATE NOT NULL,
    Description    VARCHAR(300)
);
GO

-- 5.2 ROOM FEE RECORDS
CREATE TABLE RoomFeeRecords (
    FeeID       INT IDENTITY(1,1) PRIMARY KEY,
    StudentID   INT NOT NULL,
    BookingID   INT NOT NULL,
    Month       INT NOT NULL CHECK (Month BETWEEN 1 AND 12),
    Year        INT NOT NULL CHECK (Year BETWEEN 2000 AND 2100),
    Amount      DECIMAL(10,2) NOT NULL CHECK (Amount >= 0),
    DueDate     DATE NOT NULL,
    IsPaid      BIT DEFAULT 0,
    PaidOn      DATETIME,
    LatePenalty DECIMAL(10,2) DEFAULT 0,
    TotalAmount AS (Amount + LatePenalty),  -- Computed column
    CONSTRAINT fk_roomfee_student FOREIGN KEY (StudentID) REFERENCES Students(StudentID),
    CONSTRAINT fk_roomfee_booking FOREIGN KEY (BookingID) REFERENCES Bookings(BookingID),
    CONSTRAINT uq_room_fee_period UNIQUE (StudentID, BookingID, Month, Year)
);
GO

-- 5.3 MESS BILL RECORDS
CREATE TABLE MessBillRecords (
    BillID      INT IDENTITY(1,1) PRIMARY KEY,
    StudentID   INT NOT NULL,
    Month       INT NOT NULL CHECK (Month BETWEEN 1 AND 12),
    Year        INT NOT NULL CHECK (Year BETWEEN 2000 AND 2100),
    Amount      DECIMAL(10,2) NOT NULL CHECK (Amount >= 0),
    DueDate     DATE NOT NULL,
    IsPaid      BIT DEFAULT 0,
    PaidOn      DATETIME,
    CONSTRAINT fk_messbill_student FOREIGN KEY (StudentID) REFERENCES Students(StudentID),
    CONSTRAINT uq_mess_bill_period UNIQUE (StudentID, Month, Year)
);
GO

-- 5.4 PAYMENT TRANSACTIONS (General ledger for all payments)
-- CONCEPT: Aggregation — links to multiple parent entities
CREATE TABLE PaymentTransactions (
    TransactionID   INT IDENTITY(1,1) PRIMARY KEY,
    StudentID       INT NOT NULL,
    MethodID        INT NOT NULL,
    Amount          DECIMAL(10,2) NOT NULL CHECK (Amount > 0),
    TransactionDate DATETIME DEFAULT GETDATE(),
    ReferenceNo     VARCHAR(100) UNIQUE,          -- e.g. bank transaction ID
    PaymentFor      VARCHAR(20) NOT NULL CHECK (PaymentFor IN ('Room','Mess','Security','Fine','Other')),
    RelatedFeeID    INT,                           -- nullable — links to specific fee
    RelatedBillID   INT,                           -- nullable — links to specific bill
    Notes           VARCHAR(300),
    VerifiedBy      INT,                           -- FK to Admins
    CONSTRAINT fk_pay_student FOREIGN KEY (StudentID) REFERENCES Students(StudentID),
    CONSTRAINT fk_pay_method  FOREIGN KEY (MethodID)  REFERENCES PaymentMethods(MethodID),
    CONSTRAINT fk_pay_admin   FOREIGN KEY (VerifiedBy) REFERENCES Admins(AdminID)
);
GO

-- ============================================================
-- SECTION 6: COMPLAINT MANAGEMENT TABLES
-- ============================================================

-- 6.1 COMPLAINTS
CREATE TABLE Complaints (
    ComplaintID INT IDENTITY(1,1) PRIMARY KEY,
    StudentID   INT NOT NULL,
    HallID      INT,
    RoomID      INT,
    HallName    VARCHAR(100) NULL,
    CategoryID  INT NOT NULL,
    Title       VARCHAR(200) NOT NULL,
    Description VARCHAR(2000),
    Priority    VARCHAR(10) NOT NULL DEFAULT 'Medium'
                CHECK (Priority IN ('Low','Medium','High','Critical')),
    Status      VARCHAR(20) NOT NULL DEFAULT 'Open'
                CHECK (Status IN ('Open','In Progress','Resolved','Closed','Escalated')),
    SubmittedAt DATETIME DEFAULT GETDATE(),
    ResolvedAt  DATETIME,
    AssignedTo  INT,                    -- FK to Admins
    AdminNote   VARCHAR(1000),
    CONSTRAINT fk_comp_student  FOREIGN KEY (StudentID)  REFERENCES Students(StudentID),
    CONSTRAINT fk_comp_hall     FOREIGN KEY (HallID)     REFERENCES Halls(HallID),
    CONSTRAINT fk_comp_room     FOREIGN KEY (RoomID)     REFERENCES Rooms(RoomID),
    CONSTRAINT fk_comp_category FOREIGN KEY (CategoryID) REFERENCES ComplaintCategories(CategoryID),
    CONSTRAINT fk_comp_admin    FOREIGN KEY (AssignedTo)  REFERENCES Admins(AdminID)
);
GO

-- 6.2 COMPLAINT HISTORY (audit trail of status changes) (REMOVED - UNUSED)
GO

-- ============================================================
-- SECTION 7: MESS ATTENDANCE
-- ============================================================

CREATE TABLE MessAttendance (
    AttendanceID    INT IDENTITY(1,1) PRIMARY KEY,
    StudentID       INT NOT NULL,
    StudentName     VARCHAR(100) NULL,
    MenuID          INT NOT NULL,
    MealType        VARCHAR(20) NOT NULL,
    PriceAtTime     DECIMAL(10,2) NOT NULL,
    MealUnit        DECIMAL(5,2) NOT NULL,
    FinalPrice      DECIMAL(10,2) NOT NULL,
    AttendanceDate  DATETIME DEFAULT GETDATE(),
    CONSTRAINT fk_messatt_student FOREIGN KEY (StudentID) REFERENCES Students(StudentID),
    CONSTRAINT fk_messatt_menu    FOREIGN KEY (MenuID) REFERENCES MessMenu(MenuID)
);
GO

PRINT 'All tables created successfully!';
PRINT 'Tables: Departments, RoomTypes, ComplaintCategories,';
PRINT '        PaymentMethods, Halls, Floors, Rooms, Students, AdminRoles,';
PRINT '        Admins, Bookings, MessCategories, FoodItems,';
PRINT '        MessMenu, FeeStructure, RoomFeeRecords,';
PRINT '        MessBillRecords, PaymentTransactions, Complaints,';
PRINT '        MessAttendance';
GO
