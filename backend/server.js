// ============================================
//   HOSTEL MANAGEMENT SYSTEM - NODE.JS BACKEND
//   server.js
// ============================================

require('dotenv').config();
const express = require('express');
const sql = require('mssql');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');

const app = express();

// ── MAIL TRANSPORTER AND DISPATCHER ──
let mailTransporter = null;

async function getMailTransporter() {
    if (mailTransporter) return mailTransporter;

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        console.log("Using SMTP configuration from environment variables.");
        mailTransporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        return mailTransporter;
    }

    console.log("No SMTP credentials in .env. Creating test Ethereal Mail account...");
    try {
        const testAccount = await nodemailer.createTestAccount();
        mailTransporter = nodemailer.createTransport({
            host: testAccount.smtp.host,
            port: testAccount.smtp.port,
            secure: testAccount.smtp.secure,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });
        console.log(`Test mail account created. User: ${testAccount.user}`);
        return mailTransporter;
    } catch (err) {
        console.error("Failed to create Ethereal Mail test account. Falling back to console-only logging:", err.message);
        return null;
    }
}

async function sendVerificationEmail(toEmail, code, purpose = 'REGISTER') {
    const isRegister = purpose === 'REGISTER';
    const subject = isRegister ? 'Verify Your UET Hostel Account' : 'Reset Your UET Hostel Password';
    
    const htmlContent = `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #eee; padding: 30px; border-radius: 10px; background: #ffffff; color: #333;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h1 style="color: #0f172a; margin: 0; font-size: 24px;">UET Hostel Portal</h1>
            </div>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 16px; line-height: 1.5;">Hello,</p>
            <p style="font-size: 16px; line-height: 1.5;">
                ${isRegister 
                    ? 'Thank you for registering at UET Hostel Management Portal. Please use the following 6-digit verification code to complete your registration:' 
                    : 'We received a request to reset your password. Use the following 6-digit verification code to proceed:'}
            </p>
            <div style="text-align: center; margin: 30px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1e293b; background: #f1f5f9; padding: 10px 20px; border-radius: 5px; border: 1px dashed #cbd5e1;">${code}</span>
            </div>
            <p style="font-size: 14px; color: #64748b; line-height: 1.5;">This verification code is valid for 5 minutes. If you did not make this request, you can safely ignore this email.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">Institutional Portal 2.0 • Security & Trust</p>
        </div>
    `;

    const transporter = await getMailTransporter();
    if (!transporter) {
        console.log(`\n======================================================`);
        console.log(`[CONSOLE-MAIL FALLBACK] Code for ${toEmail} [${purpose}]: ${code}`);
        console.log(`======================================================\n`);
        return;
    }

    try {
        const info = await transporter.sendMail({
            from: '"UET Hostel Portal" <noreply@hostel.edu.pk>',
            to: toEmail,
            subject: subject,
            html: htmlContent,
            text: `${subject}: Your code is ${code}`
        });

        console.log(`\n======================================================`);
        console.log(`[EMAIL DISPATCH] Sent to ${toEmail} [${purpose}]`);
        console.log(`[EMAIL DISPATCH] Message ID: ${info.messageId}`);
        if (nodemailer.getTestMessageUrl(info)) {
            console.log(`[EMAIL DISPATCH] Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
        } else {
            console.log(`[EMAIL DISPATCH] Code: ${code}`);
        }
        console.log(`======================================================\n`);
    } catch (err) {
        console.error(`Failed to send email to ${toEmail}:`, err.message);
        console.log(`\n[CONSOLE-MAIL FALLBACK] Code for ${toEmail}: ${code}\n`);
    }
}

// Secure HTTP Headers
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// CORS Configuration
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',');
app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) === -1) {
            const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
            return callback(new Error(msg), false);
        }
        return callback(null, true);
    },
    credentials: true
}));

app.use(express.json());
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});
app.use(express.static(path.join(__dirname, '../frontend/public')));

// ─────────────────────────────────────────────
// DATABASE CONFIG — loaded from environment variables
// ─────────────────────────────────────────────
const dbConfig = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'goblin',
    server: process.env.DB_SERVER || '127.0.0.1',
    database: process.env.DB_NAME || 'HostelManagement',
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: true
    }
};

// DB connection pool
let pool;
async function getPool() {
    if (!pool) pool = await sql.connect(dbConfig);
    return pool;
}

// ─────────────────────────────────────────────
// SECURITY & AUTH MIDDLEWARES
// ─────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET || 'uni_hostel_secret_key_2026_safe_dev_key';

// Rate limiter for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10000, // Increased limit for testing phase to prevent lockout
    message: { error: 'Too many authentication attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Middleware to authenticate JWT token
function authenticateJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { id: StudentID/AdminID, role: 'student'/'admin', email: Email }
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Forbidden: Invalid or expired token' });
    }
}

// Middleware to require specific role(s)
function requireRole(roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
        }
        next();
    };
}

// Middleware for input length and password complexity checks
function validateRegistrationInput(req, res, next) {
    const { email, password, fullName, phone } = req.body;

    if (fullName && fullName.length > 100) {
        return res.status(400).json({ error: 'Full Name exceeds limit of 100 characters' });
    }
    if (email && email.length > 100) {
        return res.status(400).json({ error: 'Email exceeds limit of 100 characters' });
    }
    if (phone && phone.length > 20) {
        return res.status(400).json({ error: 'Phone number exceeds limit of 20 characters' });
    }
    if (password && password.length > 100) {
        return res.status(400).json({ error: 'Password exceeds limit of 100 characters' });
    }

    if (req.path.includes('/register') || req.path.includes('/profile')) {
        if (password) {
            if (password.length < 8) {
                return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
            }
            const letterRegex = /[a-zA-Z]/;
            const numberRegex = /[0-9]/;
            if (!letterRegex.test(password) || !numberRegex.test(password)) {
                return res.status(400).json({ error: 'Password must contain at least one letter and one number.' });
            }
        }
    }
    next();
}

// Apply rate limiter to auth routes
app.use('/api/auth/', authLimiter);

// ─────────────────────────────────────────────
// AUTH ROUTES
// ─────────────────────────────────────────────

// Student Login
app.post('/api/auth/student/login', async (req, res) => {
    const { email, password, regNumber } = req.body;
    try {
        const db = await getPool();
        const result = await db.request()
            .input('email', sql.VarChar, email)
            .input('reg', sql.VarChar, regNumber)
            .query(`SELECT s.StudentID, s.FullName, s.Email, s.PasswordHash, s.Phone AS PhoneNumber, s.CGPA, d.DeptName AS Department, s.Semester, s.RegNumber, s.IsActive
                    FROM Students s JOIN Departments d ON s.DeptID = d.DeptID
                    WHERE s.Email = @email AND s.RegNumber = @reg`);
        if (result.recordset.length === 0)
            return res.status(401).json({ error: 'Invalid credentials' });
        
        const user = result.recordset[0];
        if (user.IsActive === false || user.IsActive === 0) {
            // Find latest unused OTP code for this student
            const otpQuery = await db.request()
                .input('email', sql.VarChar, user.Email)
                .query(`SELECT TOP 1 OtpCode FROM VerificationOTPs 
                        WHERE Email = @email AND Purpose = 'REGISTER' AND IsUsed = 0 
                        ORDER BY CreatedAt DESC`);
            
            let otpCode = otpQuery.recordset.length > 0 ? otpQuery.recordset[0].OtpCode : null;
            
            // If no active OTP exists, generate a new one
            if (!otpCode) {
                otpCode = Math.floor(100000 + Math.random() * 900000).toString();
                const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
                await db.request()
                    .input('email', sql.VarChar, user.Email)
                    .input('otp', sql.VarChar, otpCode)
                    .input('purpose', sql.VarChar, 'REGISTER')
                    .input('expiry', sql.DateTime, expiresAt)
                    .query(`INSERT INTO VerificationOTPs (Email, OtpCode, Purpose, ExpiresAt, IsUsed)
                            VALUES (@email, @otp, @purpose, @expiry, 0)`);
            }
            
            return res.status(403).json({ 
                error: 'Please verify your institutional email first.', 
                unverified: true, 
                email: user.Email, 
                autofillOtp: otpCode 
            });
        }

        const isMatch = await bcrypt.compare(password, user.PasswordHash);
        if (!isMatch)
            return res.status(401).json({ error: 'Invalid credentials' });

        delete user.PasswordHash;
        const token = jwt.sign(
            { id: user.StudentID, role: 'student', email: user.Email },
            JWT_SECRET,
            { expiresIn: '8h' }
        );
        res.json({ success: true, token, user, role: 'student' });
    } catch (err) {
        console.error('Student Login Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Admin Login
app.post('/api/auth/admin/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const db = await getPool();
        const result = await db.request()
            .input('email', sql.VarChar, email)
            .query(`SELECT AdminID, FullName, Email, PasswordHash, Phone AS PhoneNumber, RoleID, IsActive
                    FROM Admins WHERE Email = @email`);
        if (result.recordset.length === 0)
            return res.status(401).json({ error: 'Invalid credentials' });
        
        const user = result.recordset[0];
        if (user.IsActive === false || user.IsActive === 0) {
            // Find latest unused OTP code for this admin
            const otpQuery = await db.request()
                .input('email', sql.VarChar, user.Email)
                .query(`SELECT TOP 1 OtpCode FROM VerificationOTPs 
                        WHERE Email = @email AND Purpose = 'REGISTER' AND IsUsed = 0 
                        ORDER BY CreatedAt DESC`);
            
            let otpCode = otpQuery.recordset.length > 0 ? otpQuery.recordset[0].OtpCode : null;
            
            // If no active OTP exists, generate a new one
            if (!otpCode) {
                otpCode = Math.floor(100000 + Math.random() * 900000).toString();
                const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
                await db.request()
                    .input('email', sql.VarChar, user.Email)
                    .input('otp', sql.VarChar, otpCode)
                    .input('purpose', sql.VarChar, 'REGISTER')
                    .input('expiry', sql.DateTime, expiresAt)
                    .query(`INSERT INTO VerificationOTPs (Email, OtpCode, Purpose, ExpiresAt, IsUsed)
                            VALUES (@email, @otp, @purpose, @expiry, 0)`);
            }
            
            return res.status(403).json({ 
                error: 'Please verify your admin email first.', 
                unverified: true, 
                email: user.Email, 
                autofillOtp: otpCode 
            });
        }

        const isMatch = await bcrypt.compare(password, user.PasswordHash);
        if (!isMatch)
            return res.status(401).json({ error: 'Invalid credentials' });

        delete user.PasswordHash;
        const token = jwt.sign(
            { id: user.AdminID, role: 'admin', email: user.Email },
            JWT_SECRET,
            { expiresIn: '8h' }
        );
        res.json({ success: true, token, user, role: 'admin' });
    } catch (err) {
        console.error('Admin Login Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Profile Updates
app.put('/api/auth/student/profile', authenticateJWT, validateRegistrationInput, async (req, res) => {
    const { studentId, fullName, phone, password } = req.body;
    
    // Authorization Check: Student can only update their own profile, admins can update any
    if (req.user.role !== 'admin' && req.user.id !== parseInt(studentId)) {
        return res.status(403).json({ error: 'Forbidden: You can only update your own profile' });
    }

    try {
        const db = await getPool();
        let query = `UPDATE Students SET FullName = @name, Phone = @phone`;
        if (password) query += `, PasswordHash = @pass`;
        query += ` WHERE StudentID = @id`;

        const request = db.request()
            .input('name', sql.VarChar, fullName)
            .input('phone', sql.VarChar, phone)
            .input('id', sql.Int, studentId);
            
        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            request.input('pass', sql.VarChar, hashedPassword);
        }

        await request.query(query);
        res.json({ success: true });
    } catch (err) {
        console.error('Student Profile Update Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.put('/api/auth/admin/profile', authenticateJWT, requireRole(['admin']), validateRegistrationInput, async (req, res) => {
    const { adminId, fullName, phone, password } = req.body;
    
    // Authorization Check: Admins can only update their own profile
    if (req.user.id !== parseInt(adminId)) {
        return res.status(403).json({ error: 'Forbidden: You can only update your own profile' });
    }

    try {
        const db = await getPool();
        let query = `UPDATE Admins SET FullName = @name, Phone = @phone`;
        if (password) query += `, PasswordHash = @pass`;
        query += ` WHERE AdminID = @id`;

        const request = db.request()
            .input('name', sql.VarChar, fullName)
            .input('phone', sql.VarChar, phone)
            .input('id', sql.Int, adminId);
            
        if (password) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            request.input('pass', sql.VarChar, hashedPassword);
        }

        await request.query(query);
        res.json({ success: true });
    } catch (err) {
        console.error('Admin Profile Update Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Departments Endpoint
app.get('/api/departments', async (req, res) => {
    try {
        const db = await getPool();
        const result = await db.request().query('SELECT DeptID, DeptName, DeptCode FROM Departments WHERE IsActive = 1 ORDER BY DeptName');
        res.json(result.recordset);
    } catch (err) {
        console.error('Fetch Departments Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Student Register
app.post('/api/auth/student/register', validateRegistrationInput, async (req, res) => {
    const { regNumber, fullName, email, password, phone, cgpa, department, semester } = req.body;
    try {
        const studentEmail = email.trim().toLowerCase();
        if (!studentEmail.endsWith('@students.edu.pk')) {
            return res.status(400).json({ error: 'Invalid Email Domain! Students must use @students.edu.pk' });
        }

        // --- REGISTRATION NUMBER VALIDATION ---
        const regRegex = /^(\d{4})[-_]([A-Za-z]{2,4})[-_](\d{3,})$/;
        const regMatch = regNumber.match(regRegex);
        if (!regMatch) {
            return res.status(400).json({ error: 'Registration number must follow the format YYYY-DEPT-NUM (e.g., 2024-CS-012, 2023-SE_030)' });
        }
        const enteredDeptCode = regMatch[2].toUpperCase();
        // --------------------------------------

        // --- SEMESTER SESSION VALIDATION ---
        const currentMonth = new Date().getMonth() + 1;
        const isEvenMonth = (currentMonth >= 1 && currentMonth <= 6);
        const semInt = parseInt(semester);
        const isEvenSem = (semInt % 2 === 0);

        if (isEvenMonth !== isEvenSem) {
            const expected = isEvenMonth ? 'Even (2, 4, 6, 8)' : 'Odd (1, 3, 5, 7)';
            return res.status(400).json({ error: `Invalid Semester! Current session is for ${expected} semesters.` });
        }
        // ------------------------------------

        const db = await getPool();

        // Check if registration number already exists
        const regCheck = await db.request()
            .input('reg', sql.VarChar, regNumber)
            .query('SELECT 1 FROM Students WHERE RegNumber = @reg');
        if (regCheck.recordset.length > 0) {
            return res.status(400).json({ error: 'Registration failed: Registration number already exists' });
        }
        
        // Fetch active departments
        const allDeptsResult = await db.request()
            .query('SELECT DeptID, DeptName, DeptCode FROM Departments WHERE IsActive = 1');
        
        const activeDepts = allDeptsResult.recordset;
        
        // Check if the department code in the reg number is a valid, active department abbreviation
        const matchedDeptByCode = activeDepts.find(d => d.DeptCode.trim().toUpperCase() === enteredDeptCode);
        if (!matchedDeptByCode) {
            return res.status(400).json({ error: `Invalid department abbreviation '${enteredDeptCode}' in registration number!` });
        }

        // Lookup selected department from Name
        const selectedDept = activeDepts.find(d => d.DeptName === department);
        if (!selectedDept) {
            return res.status(400).json({ error: 'Selected department not found or is inactive' });
        }

        // Check if the department code in the reg number matches the selected department
        if (selectedDept.DeptCode.trim().toUpperCase() !== enteredDeptCode) {
            return res.status(400).json({ 
                error: `Department mismatch! Registration number '${regNumber}' does not match selected department '${department}'.` 
            });
        }
            
        const deptId = selectedDept.DeptID;

        // Hash the password securely using bcryptjs
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await db.request()
            .input('reg', sql.VarChar, regNumber)
            .input('name', sql.VarChar, fullName)
            .input('email', sql.VarChar, studentEmail)
            .input('pass', sql.VarChar, hashedPassword)
            .input('phone', sql.VarChar, phone)
            .input('cgpa', sql.Decimal(3, 2), cgpa)
            .input('did', sql.Int, deptId)
            .input('sem', sql.Int, semester)
            .query(`INSERT INTO Students (RegNumber,FullName,Email,PasswordHash,Phone,CGPA,DeptID,Semester,IsActive)
                    VALUES (@reg,@name,@email,@pass,@phone,@cgpa,@did,@sem, 0)`);

        // Check the database to confirm it's actually saved
        const verifyResult = await db.request()
            .input('email', sql.VarChar, studentEmail)
            .query('SELECT StudentID FROM Students WHERE Email = @email');

        if (verifyResult.recordset.length === 0) {
            return res.status(500).json({ error: 'Verification failed: Student data was not saved' });
        }

        // Generate Registration OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

        await db.request()
            .input('email', sql.VarChar, studentEmail)
            .input('otp', sql.VarChar, otpCode)
            .input('purpose', sql.VarChar, 'REGISTER')
            .input('expiry', sql.DateTime, expiresAt)
            .query(`INSERT INTO VerificationOTPs (Email, OtpCode, Purpose, ExpiresAt, IsUsed)
                    VALUES (@email, @otp, @purpose, @expiry, 0)`);

        sendVerificationEmail(studentEmail, otpCode, 'REGISTER').catch(err => {
            console.error("Email send failed inside registration:", err.message);
        });

        res.json({ success: true, message: 'Registration initial success. Please verify OTP code sent to your email.', email: studentEmail, autofillOtp: otpCode });
    } catch (err) { 
        console.error('Registration Error:', err);
        let msg = 'Registration failed';
        if (err.message && err.message.includes('UNIQUE KEY')) msg = 'Registration failed: Email or Registration Number already exists';
        res.status(500).json({ error: msg }); 
    }
});

// Check if active warden exists
app.get('/api/auth/admin/warden-check', async (req, res) => {
    try {
        const db = await getPool();
        const activeWardenCheck = await db.request()
            .query('SELECT 1 FROM Admins WHERE RoleID = 2 AND IsActive = 1');
        res.json({ exists: activeWardenCheck.recordset.length > 0 });
    } catch (err) { 
        console.error('Warden Check Error:', err);
        res.status(500).json({ error: 'Internal Server Error' }); 
    }
});

// Admin Register
app.post('/api/auth/admin/register', validateRegistrationInput, async (req, res) => {
    const { fullName, email, password, phone, roleId, hallId } = req.body;
    try {
        const adminEmail = email.trim().toLowerCase();
        if (!adminEmail.endsWith('@admin.edu.pk')) {
            return res.status(400).json({ error: 'Invalid Email Domain! Admins must use @admin.edu.pk' });
        }

        const db = await getPool();
        
        // Check if an active warden already exists in the system (RoleID = 2)
        if (parseInt(roleId) === 2) {
            const activeWardenCheck = await db.request()
                .query('SELECT 1 FROM Admins WHERE RoleID = 2 AND IsActive = 1');
            if (activeWardenCheck.recordset.length > 0) {
                return res.status(400).json({ error: 'Warden registration is closed. An active Warden already exists in the system. To transfer authority, please use the Warden Post Shift feature from within the portal.' });
            }
        }

        // Hash password securely
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        await db.request()
            .input('name', sql.VarChar, fullName)
            .input('email', sql.VarChar, adminEmail)
            .input('pass', sql.VarChar, hashedPassword)
            .input('phone', sql.VarChar, phone)
            .input('role', sql.Int, roleId || 1)
            .query(`INSERT INTO Admins (FullName,Email,PasswordHash,Phone,RoleID,IsActive)
                    VALUES (@name,@email,@pass,@phone,@role,0)`);

        // Check the database to confirm it's actually saved
        const verifyAdmin = await db.request()
            .input('email', sql.VarChar, adminEmail)
            .query('SELECT AdminID FROM Admins WHERE Email = @email');

        if (verifyAdmin.recordset.length === 0) {
            return res.status(500).json({ error: 'Verification failed: Admin data was not saved' });
        }

        // Generate Admin OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

        await db.request()
            .input('email', sql.VarChar, adminEmail)
            .input('otp', sql.VarChar, otpCode)
            .input('purpose', sql.VarChar, 'REGISTER')
            .input('expiry', sql.DateTime, expiresAt)
            .query(`INSERT INTO VerificationOTPs (Email, OtpCode, Purpose, ExpiresAt, IsUsed)
                    VALUES (@email, @otp, @purpose, @expiry, 0)`);

        sendVerificationEmail(adminEmail, otpCode, 'REGISTER').catch(err => {
            console.error("Email send failed inside admin registration:", err.message);
        });

        res.json({ success: true, message: 'Admin registered successfully. Please verify OTP code sent to your email.', email: adminEmail, autofillOtp: otpCode });
    } catch (err) { 
        console.error('Admin Registration Error:', err);
        let msg = 'Registration failed';
        if (err.message && err.message.includes('UNIQUE KEY')) msg = 'Registration failed: Email already exists';
        res.status(500).json({ error: msg }); 
    }
});

// ── OTP VERIFICATION ENDPOINT ──
app.post('/api/auth/verify-registration', async (req, res) => {
    const { email, otpCode } = req.body;
    try {
        const db = await getPool();
        
        // Find unused OTP
        const otpResult = await db.request()
            .input('email', sql.VarChar, email)
            .input('otp', sql.VarChar, otpCode)
            .query(`SELECT TOP 1 OtpID, ExpiresAt FROM VerificationOTPs 
                    WHERE Email = @email AND OtpCode = @otp AND Purpose = 'REGISTER' AND IsUsed = 0
                    ORDER BY CreatedAt DESC`);

        if (otpResult.recordset.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired OTP code.' });
        }

        const otp = otpResult.recordset[0];
        if (new Date(otp.ExpiresAt) < new Date()) {
            return res.status(400).json({ error: 'Verification code has expired. Please request a new one.' });
        }

        // Mark OTP as used
        await db.request()
            .input('id', sql.Int, otp.OtpID)
            .query('UPDATE VerificationOTPs SET IsUsed = 1 WHERE OtpID = @id');

        // Activate student or admin
        let activated = false;
        
        // Try activating in Students first
        const studentUpdate = await db.request()
            .input('email', sql.VarChar, email)
            .query('UPDATE Students SET IsActive = 1 WHERE Email = @email');
        if (studentUpdate.rowsAffected[0] > 0) activated = true;

        if (!activated) {
            // Try activating in Admins
            const adminUpdate = await db.request()
                .input('email', sql.VarChar, email)
                .query('UPDATE Admins SET IsActive = 1 WHERE Email = @email');
            if (adminUpdate.rowsAffected[0] > 0) activated = true;
        }

        if (!activated) {
            return res.status(404).json({ error: 'User account not found.' });
        }

        res.json({ success: true, message: 'Account verified successfully! You can now sign in.' });
    } catch (err) {
        console.error('OTP Verification Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ── RESEND REGISTRATION OTP ──
app.post('/api/auth/resend-otp', async (req, res) => {
    const { email } = req.body;
    try {
        const db = await getPool();
        
        // Verify user exists and is inactive
        let exists = false;
        const studentCheck = await db.request().input('email', sql.VarChar, email).query('SELECT 1 FROM Students WHERE Email = @email AND IsActive = 0');
        if (studentCheck.recordset.length > 0) exists = true;

        if (!exists) {
            const adminCheck = await db.request().input('email', sql.VarChar, email).query('SELECT 1 FROM Admins WHERE Email = @email AND IsActive = 0');
            if (adminCheck.recordset.length > 0) exists = true;
        }

        if (!exists) {
            return res.status(400).json({ error: 'Account already active or email not found.' });
        }

        // Generate new OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await db.request()
            .input('email', sql.VarChar, email)
            .input('otp', sql.VarChar, otpCode)
            .input('expiry', sql.DateTime, expiresAt)
            .query(`INSERT INTO VerificationOTPs (Email, OtpCode, Purpose, ExpiresAt, IsUsed)
                    VALUES (@email, @otp, 'REGISTER', @expiry, 0)`);

        await sendVerificationEmail(email, otpCode, 'REGISTER');

        res.json({ success: true, message: 'A new verification code has been dispatched to your email.' });
    } catch (err) {
        console.error('Resend OTP Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ── FORGOT PASSWORD (REQUEST RESET OTP) ──
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    try {
        const db = await getPool();
        
        // Check if user exists
        let exists = false;
        const studentCheck = await db.request().input('email', sql.VarChar, email).query('SELECT 1 FROM Students WHERE Email = @email');
        if (studentCheck.recordset.length > 0) exists = true;

        if (!exists) {
            const adminCheck = await db.request().input('email', sql.VarChar, email).query('SELECT 1 FROM Admins WHERE Email = @email');
            if (adminCheck.recordset.length > 0) exists = true;
        }

        if (!exists) {
            return res.status(404).json({ error: 'No account associated with this email address.' });
        }

        // Generate OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await db.request()
            .input('email', sql.VarChar, email)
            .input('otp', sql.VarChar, otpCode)
            .input('expiry', sql.DateTime, expiresAt)
            .query(`INSERT INTO VerificationOTPs (Email, OtpCode, Purpose, ExpiresAt, IsUsed)
                    VALUES (@email, @otp, 'RESET', @expiry, 0)`);

        await sendVerificationEmail(email, otpCode, 'RESET');

        res.json({ success: true, message: 'Password recovery code sent to your email.' });
    } catch (err) {
        console.error('Forgot Password Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ── RESET PASSWORD (VERIFY OTP & UPDATE) ──
app.post('/api/auth/reset-password', async (req, res) => {
    const { email, otpCode, newPassword } = req.body;
    try {
        const db = await getPool();
        
        // Find unused reset OTP
        const otpResult = await db.request()
            .input('email', sql.VarChar, email)
            .input('otp', sql.VarChar, otpCode)
            .query(`SELECT TOP 1 OtpID, ExpiresAt FROM VerificationOTPs 
                    WHERE Email = @email AND OtpCode = @otp AND Purpose = 'RESET' AND IsUsed = 0
                    ORDER BY CreatedAt DESC`);

        if (otpResult.recordset.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired recovery code.' });
        }

        const otp = otpResult.recordset[0];
        if (new Date(otp.ExpiresAt) < new Date()) {
            return res.status(400).json({ error: 'Recovery code has expired. Please try again.' });
        }

        // Validate password strength
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
        }
        const letterRegex = /[a-zA-Z]/;
        const numberRegex = /[0-9]/;
        if (!letterRegex.test(newPassword) || !numberRegex.test(newPassword)) {
            return res.status(400).json({ error: 'Password must contain at least one letter and one number.' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Mark OTP as used
        await db.request()
            .input('id', sql.Int, otp.OtpID)
            .query('UPDATE VerificationOTPs SET IsUsed = 1 WHERE OtpID = @id');

        // Update password
        let updated = false;
        
        const studentUpdate = await db.request()
            .input('pass', sql.VarChar, hashedPassword)
            .input('email', sql.VarChar, email)
            .query('UPDATE Students SET PasswordHash = @pass, IsActive = 1 WHERE Email = @email');
        if (studentUpdate.rowsAffected[0] > 0) updated = true;

        if (!updated) {
            const adminUpdate = await db.request()
                .input('pass', sql.VarChar, hashedPassword)
                .input('email', sql.VarChar, email)
                .query('UPDATE Admins SET PasswordHash = @pass, IsActive = 1 WHERE Email = @email');
            if (adminUpdate.rowsAffected[0] > 0) updated = true;
        }

        res.json({ success: true, message: 'Password updated successfully! You can now log in.' });
    } catch (err) {
        console.error('Reset Password Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ── GOOGLE / MICROSOFT SSO AUTHENTICATION MOCKS ──
app.post('/api/auth/sso-login', async (req, res) => {
    const { email, fullName, provider } = req.body;
    try {
        const db = await getPool();
        const ssoEmail = email.trim().toLowerCase();
        
        // Find existing student or admin by email
        let user = null;
        let role = null;
        
        const studentRes = await db.request()
            .input('email', sql.VarChar, ssoEmail)
            .query(`SELECT s.StudentID, s.FullName, s.Email, s.Phone AS PhoneNumber, s.CGPA, d.DeptName AS Department, s.Semester, s.RegNumber, s.IsActive
                    FROM Students s JOIN Departments d ON s.DeptID = d.DeptID
                    WHERE s.Email = @email`);
        
        if (studentRes.recordset.length > 0) {
            user = studentRes.recordset[0];
            role = 'student';
        } else {
            const adminRes = await db.request()
                .input('email', sql.VarChar, ssoEmail)
                .query('SELECT AdminID, FullName, Email, Phone AS PhoneNumber, RoleID, IsActive FROM Admins WHERE Email = @email');
            if (adminRes.recordset.length > 0) {
                user = adminRes.recordset[0];
                role = 'admin';
            }
        }

        if (!user) {
            // Autocreate account if email fits domain rules
            if (ssoEmail.endsWith('@students.edu.pk')) {
                // Autocreate Student (requires dummy registration)
                const regPrefix = new Date().getFullYear();
                const randomNum = Math.floor(100 + Math.random() * 900);
                const regNumber = `${regPrefix}-CS-${randomNum}`;
                
                // Get first department
                const deptRes = await db.request().query('SELECT TOP 1 DeptID FROM Departments WHERE IsActive = 1');
                const deptId = deptRes.recordset[0]?.DeptID || 1;
                
                await db.request()
                    .input('reg', sql.VarChar, regNumber)
                    .input('name', sql.VarChar, fullName || 'SSO User')
                    .input('email', sql.VarChar, ssoEmail)
                    .input('pass', sql.VarChar, 'SSO_PASSWORD_LOCKED')
                    .input('phone', sql.VarChar, '')
                    .input('cgpa', sql.Decimal(3,2), 3.50)
                    .input('did', sql.Int, deptId)
                    .input('sem', sql.Int, 1)
                    .query(`INSERT INTO Students (RegNumber,FullName,Email,PasswordHash,Phone,CGPA,DeptID,Semester,IsActive)
                            VALUES (@reg,@name,@email,@pass,@phone,@cgpa,@did,@sem,1)`);

                const verifyNew = await db.request().input('email', sql.VarChar, ssoEmail)
                    .query(`SELECT s.StudentID, s.FullName, s.Email, s.Phone AS PhoneNumber, s.CGPA, d.DeptName AS Department, s.Semester, s.RegNumber, s.IsActive
                            FROM Students s JOIN Departments d ON s.DeptID = d.DeptID
                            WHERE s.Email = @email`);
                user = verifyNew.recordset[0];
                role = 'student';
            } else if (ssoEmail.endsWith('@admin.edu.pk')) {
                // Autocreate Admin
                await db.request()
                    .input('name', sql.VarChar, fullName || 'SSO Admin')
                    .input('email', sql.VarChar, ssoEmail)
                    .input('pass', sql.VarChar, 'SSO_PASSWORD_LOCKED')
                    .input('phone', sql.VarChar, '')
                    .input('role', sql.Int, 1)
                    .query(`INSERT INTO Admins (FullName,Email,PasswordHash,Phone,RoleID,IsActive)
                            VALUES (@name,@email,@pass,@phone,@role,1)`);

                const verifyAdmin = await db.request().input('email', sql.VarChar, ssoEmail)
                    .query('SELECT AdminID, FullName, Email, Phone AS PhoneNumber, RoleID, IsActive FROM Admins WHERE Email = @email');
                user = verifyAdmin.recordset[0];
                role = 'admin';
            } else {
                return res.status(400).json({ error: `Domain not authorized. Please use a UET institutional email address.` });
            }
        } else {
            // Activate account since it was signed in via trusted provider
            if (user.IsActive === false || user.IsActive === 0) {
                if (role === 'student') {
                    await db.request().input('email', sql.VarChar, ssoEmail).query('UPDATE Students SET IsActive = 1 WHERE Email = @email');
                } else {
                    await db.request().input('email', sql.VarChar, ssoEmail).query('UPDATE Admins SET IsActive = 1 WHERE Email = @email');
                }
                user.IsActive = 1;
            }
        }

        const token = jwt.sign(
            { id: role === 'student' ? user.StudentID : user.AdminID, role, email: user.Email },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({ success: true, token, user, role });
    } catch (err) {
        console.error('SSO Authentication Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Warden Post Shift (authorized authority transfer)
app.post('/api/auth/admin/shift-warden', authenticateJWT, requireRole(['admin']), validateRegistrationInput, async (req, res) => {
    const { fullName, email, password, phone, currentAdminId } = req.body;
    try {
        const adminEmail = email.trim().toLowerCase();
        if (!adminEmail.endsWith('@admin.edu.pk')) {
            return res.status(400).json({ error: 'Invalid Email Domain! Admins must use @admin.edu.pk' });
        }

        if (req.user.id !== parseInt(currentAdminId)) {
            return res.status(403).json({ error: 'Unauthorized! Only the currently active Warden can transfer authority.' });
        }

        const db = await getPool();

        // 1. Verify currentAdminId is an active Warden
        const currentWardenCheck = await db.request()
            .input('cid', sql.Int, currentAdminId)
            .query('SELECT 1 FROM Admins WHERE AdminID = @cid AND RoleID = 2 AND IsActive = 1');

        if (currentWardenCheck.recordset.length === 0) {
            return res.status(403).json({ error: 'Unauthorized! Only the currently active Warden can transfer authority.' });
        }

        // 2. Check if the new Warden email already exists in the system
        const emailCheck = await db.request()
            .input('email', sql.VarChar, adminEmail)
            .query('SELECT 1 FROM Admins WHERE Email = @email');

        if (emailCheck.recordset.length > 0) {
            return res.status(400).json({ error: 'Registration failed: Email already exists' });
        }

        // Hash the new Warden's password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. Perform the shift (Deactivate all wardens first, then insert new one as active)
        await db.request().query('UPDATE Admins SET IsActive = 0 WHERE RoleID = 2');

        await db.request()
            .input('name', sql.VarChar, fullName)
            .input('email', sql.VarChar, adminEmail)
            .input('pass', sql.VarChar, hashedPassword)
            .input('phone', sql.VarChar, phone)
            .query(`INSERT INTO Admins (FullName, Email, PasswordHash, Phone, RoleID, IsActive)
                    VALUES (@name, @email, @pass, @phone, 2, 1)`);

        // Check the database to confirm it's actually saved
        const verifyAdmin = await db.request()
            .input('email', sql.VarChar, adminEmail)
            .query('SELECT AdminID FROM Admins WHERE Email = @email AND IsActive = 1');

        if (verifyAdmin.recordset.length === 0) {
            return res.status(500).json({ error: 'Verification failed: New Warden data was not saved' });
        }

        res.json({ success: true, message: 'Authority successfully shifted to the new Warden.', newAdminId: verifyAdmin.recordset[0].AdminID });
    } catch (err) {
        console.error('Warden Shifting Error:', err);
        res.status(500).json({ error: 'Warden shifting failed' });
    }
});

// Admin Roles
app.get('/api/auth/admin/roles', async (req, res) => {
    try {
        const db = await getPool();
        const result = await db.request().query('SELECT RoleID, RoleName FROM AdminRoles ORDER BY RoleID');
        res.json(result.recordset);
    } catch (err) { 
        console.error('Admin Roles Fetch Error:', err);
        res.status(500).json({ error: 'Internal Server Error' }); 
    }
});

// ─────────────────────────────────────────────
// HALLS & ROOMS
// ─────────────────────────────────────────────

// Get all halls
app.get('/api/halls', authenticateJWT, async (req, res) => {
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT h.*,
                COUNT(DISTINCT r.RoomID) AS TotalRoomCount,
                SUM(CASE WHEN ISNULL(occ.Cnt, 0) < rt.Capacity THEN 1 ELSE 0 END) AS AvailableRooms
            FROM Halls h 
            LEFT JOIN Rooms r ON h.HallID = r.HallID
            LEFT JOIN RoomTypes rt ON r.RoomTypeID = rt.RoomTypeID
            LEFT JOIN (
                SELECT RoomID, COUNT(*) AS Cnt 
                FROM Bookings 
                WHERE Status IN ('Approved','Active','Pending') 
                GROUP BY RoomID
            ) occ ON r.RoomID = occ.RoomID
            GROUP BY h.HallID, h.HallName, h.TotalRooms, h.Location, h.Facilities, h.EstYear, h.IsActive, h.CreatedAt, h.TargetYear
            ORDER BY h.HallName`);
        res.json(result.recordset);
    } catch (err) {
        console.error('Get Halls Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get rooms by hall
app.get('/api/halls/:hallId/rooms', authenticateJWT, async (req, res) => {
    try {
        const db = await getPool();
        const result = await db.request()
            .input('hallId', sql.Int, req.params.hallId)
            .query(`
                SELECT r.*, h.HallName, rt.TypeName AS RoomType, rt.Capacity,
                       (SELECT COUNT(*) FROM Bookings b WHERE b.RoomID = r.RoomID AND b.Status IN ('Approved','Active','Pending')) AS CurrentOccupancy
                FROM Rooms r
                JOIN Halls h ON r.HallID = h.HallID
                JOIN RoomTypes rt ON r.RoomTypeID = rt.RoomTypeID 
                WHERE r.HallID = @hallId 
                ORDER BY r.RoomNumber
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error('Get Rooms Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get eligible hall for student based on year and academic performance
app.get('/api/halls/eligible/:studentId', authenticateJWT, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.id !== parseInt(req.params.studentId)) {
            return res.status(403).json({ error: 'Forbidden: Access denied' });
        }

        const db = await getPool();
        const sResult = await db.request()
            .input('sid', sql.Int, req.params.studentId)
            .query(`SELECT CGPA, Semester FROM Students WHERE StudentID = @sid`);
        const s = sResult.recordset[0];
        if (!s) return res.json(null);

        const studyYear = Math.ceil(s.Semester / 2);
        const score = s.CGPA || 0.0;

        const result = await db.request()
            .input('year', sql.Int, studyYear)
            .query(`SELECT h.* FROM Halls h
                    WHERE (h.TargetYear = @year) OR (h.TargetYear IS NULL)`);
        res.json(result.recordset);
    } catch (err) {
        console.error('Get Eligible Halls Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─────────────────────────────────────────────
// BOOKINGS
// ─────────────────────────────────────────────

// Apply for room booking
app.post('/api/bookings', authenticateJWT, async (req, res) => {
    const { studentId, roomId } = req.body;
    try {
        if (req.user.role !== 'admin' && req.user.id !== parseInt(studentId)) {
            return res.status(403).json({ error: 'Forbidden: Access denied' });
        }

        // --- SESSION YEAR DETECT & BLOCK IF ENDED ---
        const bookingDate = new Date();
        const currentMonth = bookingDate.getMonth() + 1; // 1-12
        const currentDay = bookingDate.getDate();
        
        // Active Sessions:
        // Spring: Jan 1 - Jun 20
        // Fall: Aug 1 - Dec 20
        const isSpringActive = (currentMonth >= 1 && currentMonth <= 5) || (currentMonth === 6 && currentDay <= 30);
        const isFallActive = (currentMonth >= 8 && currentMonth <= 11) || (currentMonth === 12 && currentDay <= 30);
        
        if (!isSpringActive && !isFallActive) {
            return res.status(400).json({ error: 'Session has ended. Room applications are closed for now. Please apply in the new session.' });
        }
        // ---------------------------------------------

        const startDate = bookingDate.toISOString().slice(0, 10); // Auto-generate YYYY-MM-DD
        const db = await getPool();

        // Check if student already has a pending or active booking
        const existingBooking = await db.request()
            .input('sid', sql.Int, studentId)
            .query(`
                SELECT b.Status, r.RoomNumber, h.HallName 
                FROM Bookings b
                JOIN Rooms r ON b.RoomID = r.RoomID
                JOIN Halls h ON b.HallID = h.HallID
                WHERE b.StudentID = @sid AND b.Status IN ('Pending', 'Approved', 'Active')
            `);

        if (existingBooking.recordset.length > 0) {
            const b = existingBooking.recordset[0];
            if (b.Status === 'Pending') {
                return res.status(400).json({ 
                    error: 'You already have a pending room application. You cannot apply for another room until your current application is processed.' 
                });
            } else {
                return res.status(400).json({ 
                    error: `You already have an active room allotment: Room ${b.RoomNumber} in ${b.HallName}.` 
                });
            }
        }

        // Check if room is already at capacity
        const capResult = await db.request()
            .input('rid', sql.Int, roomId)
            .query(`
                SELECT rt.Capacity, 
                       (SELECT COUNT(*) FROM Bookings WHERE RoomID = @rid AND Status IN ('Approved', 'Active', 'Pending')) AS CurrentCount
                FROM Rooms r
                JOIN RoomTypes rt ON r.RoomTypeID = rt.RoomTypeID
                WHERE r.RoomID = @rid`);
        
        if (capResult.recordset.length > 0) {
            const { Capacity, CurrentCount } = capResult.recordset[0];
            if (CurrentCount >= Capacity) {
                return res.status(400).json({ error: 'This room is already at its maximum capacity.' });
            }
        }

        // Get eligible hall with Year Check
        const sResult = await db.request().input('sid', sql.Int, studentId).query('SELECT Semester, CGPA FROM Students WHERE StudentID = @sid');
        const s = sResult.recordset[0];
        const studyYear = Math.ceil(s.Semester / 2);

        const hallResult = await db.request()
            .input('year', sql.Int, studyYear)
            .query(`SELECT TOP 1 h.HallID, h.HallName FROM Halls h
                    WHERE (h.TargetYear = @year) OR (h.TargetYear IS NULL)`);

        if (!hallResult.recordset.length)
            return res.status(400).json({ error: 'No eligible hall found' });

        const { HallID: hallId, HallName: hallName } = hallResult.recordset[0];

        // EndDate = StartDate + 12 months (DurationMonths = 12)
        const endDate = new Date(bookingDate);
        endDate.setMonth(endDate.getMonth() + 12);
        const endDateStr = endDate.toISOString().slice(0, 10);

        await db.request()
            .input('sid', sql.Int, studentId)
            .input('rid', sql.Int, roomId)
            .input('hid', sql.Int, hallId)
            .input('hname', sql.VarChar, hallName)
            .input('start', sql.Date, startDate)
            .input('end', sql.Date, endDateStr)
            .input('duration', sql.Int, 12)
            .query(`INSERT INTO Bookings (StudentID, RoomID, HallID, HallName, StartDate, EndDate, DurationMonths)
                    VALUES (@sid, @rid, @hid, @hname, @start, @end, @duration)`);

        res.json({ success: true, message: 'Booking application submitted. Pending approval.' });
    } catch (err) {
        console.error('Submit Booking Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get bookings for a student
app.get('/api/bookings/student/:studentId', authenticateJWT, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.id !== parseInt(req.params.studentId)) {
            return res.status(403).json({ error: 'Forbidden: Access denied' });
        }

        const db = await getPool();
        const result = await db.request()
            .input('sid', sql.Int, req.params.studentId)
            .query(`SELECT b.*, h.HallName, r.RoomNumber, r.RoomTypeID, rmt.TypeName AS RoomType, r.MonthlyFee
                    FROM Bookings b
                    JOIN Halls h ON b.HallID = h.HallID
                    JOIN Rooms r ON b.RoomID = r.RoomID
                    JOIN RoomTypes rmt ON r.RoomTypeID = rmt.RoomTypeID
                    WHERE b.StudentID = @sid ORDER BY b.BookingDate DESC`);
        res.json(result.recordset);
    } catch (err) {
        console.error('Get Student Bookings Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get all bookings (admin)
app.get('/api/bookings/all', authenticateJWT, requireRole(['admin']), async (req, res) => {
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT b.*, s.FullName, s.RegNumber, s.CGPA,
                   h.HallName, r.RoomNumber, rt.TypeName AS RoomType, r.MonthlyFee
            FROM Bookings b
            JOIN Students s ON b.StudentID = s.StudentID
            JOIN Halls h ON b.HallID = h.HallID
            JOIN Rooms r ON b.RoomID = r.RoomID
            JOIN RoomTypes rt ON r.RoomTypeID = rt.RoomTypeID
            ORDER BY b.BookingDate DESC`);
        res.json(result.recordset);
    } catch (err) {
        console.error('Get All Bookings Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Update booking status (admin)
app.put('/api/bookings/:bookingId/status', authenticateJWT, requireRole(['admin']), async (req, res) => {
    const { status } = req.body;
    const adminId = req.user.id; // Override from token to prevent spoofing
    try {
        const db = await getPool();
        const dbStatus = status === 'Approved' ? 'Active' : status;

        if (dbStatus === 'Active') {
            // Find student ID for this booking first
            const bookingInfo = await db.request()
                .input('bid', sql.Int, req.params.bookingId)
                .query(`SELECT StudentID FROM Bookings WHERE BookingID = @bid`);
            
            if (bookingInfo.recordset.length > 0) {
                const sid = bookingInfo.recordset[0].StudentID;
                
                // Set all other active/pending bookings for this student to Rejected
                await db.request()
                    .input('sid', sql.Int, sid)
                    .input('bid', sql.Int, req.params.bookingId)
                    .query(`UPDATE Bookings 
                            SET Status = 'Rejected' 
                            WHERE StudentID = @sid AND BookingID <> @bid AND Status IN ('Pending', 'Approved', 'Active')`);
            }
        }

        // Lookup admin FullName
        const adminRes = await db.request()
            .input('aid', sql.Int, adminId)
            .query('SELECT FullName FROM Admins WHERE AdminID = @aid');
        const adminName = adminRes.recordset.length > 0 ? adminRes.recordset[0].FullName : 'System';

        await db.request()
            .input('status', sql.VarChar, dbStatus)
            .input('adminName', sql.VarChar, adminName)
            .input('bid', sql.Int, req.params.bookingId)
            .query(`UPDATE Bookings SET Status=@status, ApprovedBy=@adminName WHERE BookingID=@bid`);
        res.json({ success: true });
    } catch (err) {
        console.error('Update Booking Status Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─────────────────────────────────────────────
// MESS MENU
// ─────────────────────────────────────────────

app.get('/api/mess/menu', authenticateJWT, async (req, res) => {
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT mm.MenuID, mm.DayOfWeek, RTRIM(mc.CategoryName) AS MealType, fi.FoodName AS MenuItem, fi.Price, mm.HallID
            FROM MessMenu mm
            JOIN MessCategories mc ON mm.MessCatID = mc.MessCatID
            JOIN FoodItems fi ON mm.FoodID = fi.FoodID
            WHERE ISNULL(mm.IsActive, 1) = 1
            ORDER BY 
            CASE mm.DayOfWeek 
                WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
                WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6
                WHEN 'Sunday' THEN 7 END,
            CASE RTRIM(mc.CategoryName) WHEN 'Breakfast' THEN 1 WHEN 'Lunch' THEN 2 WHEN 'Dinner' THEN 3 END`);
        res.json(result.recordset);
    } catch (err) {
        console.error('Get Mess Menu Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Hall Occupancy Details (Admin)
app.get('/api/halls/:hallId/occupancy', authenticateJWT, requireRole(['admin']), async (req, res) => {
    try {
        const db = await getPool();
        const result = await db.request()
            .input('hid', sql.Int, req.params.hallId)
            .query(`
                SELECT r.RoomID, r.RoomNumber, r.MonthlyFee, h.HallName, rt.TypeName AS RoomType, rt.Capacity,
                       STUFF((SELECT ', ' + s2.FullName
                              FROM Bookings b2
                              JOIN Students s2 ON b2.StudentID = s2.StudentID
                              WHERE b2.RoomID = r.RoomID AND b2.Status IN ('Approved', 'Active')
                              FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS OccupantNames,
                       STUFF((SELECT ', ' + s3.RegNumber
                              FROM Bookings b3
                              JOIN Students s3 ON b3.StudentID = s3.StudentID
                              WHERE b3.RoomID = r.RoomID AND b3.Status IN ('Approved', 'Active')
                              FOR XML PATH(''), TYPE).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS OccupantRegs,
                       (SELECT COUNT(*) FROM Bookings b WHERE b.RoomID = r.RoomID AND b.Status IN ('Approved', 'Active')) AS CurrentOccupancy
                FROM Rooms r
                JOIN Halls h ON r.HallID = h.HallID
                JOIN RoomTypes rt ON r.RoomTypeID = rt.RoomTypeID
                WHERE r.HallID = @hid
                ORDER BY 
                CASE WHEN r.RoomNumber LIKE 'G-%' THEN 0 
                     WHEN r.RoomNumber LIKE '1-%' THEN 1 
                     WHEN r.RoomNumber LIKE '2-%' THEN 2 ELSE 3 END,
                r.RoomNumber`);
        res.json(result.recordset);
    } catch (err) {
        console.error('Get Hall Occupancy Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─────────────────────────────────────────────
// FEES
// ─────────────────────────────────────────────

// Get payment methods lookup — MUST be declared BEFORE /api/fees/:studentId
app.get('/api/fees/payment-methods', authenticateJWT, async (req, res) => {
    try {
        const db = await getPool();
        const result = await db.request().query('SELECT MethodID, MethodName FROM PaymentMethods WHERE IsActive = 1');
        res.json(result.recordset);
    } catch (err) {
        console.error('Get Payment Methods Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/fees/:studentId', authenticateJWT, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.id !== parseInt(req.params.studentId)) {
            return res.status(403).json({ error: 'Forbidden: Access denied' });
        }

        const db = await getPool();
        const roomFees = await db.request()
            .input('sid', sql.Int, req.params.studentId)
            .query(`SELECT f.*, r.RoomNumber, h.HallName,
                           (SELECT TOP 1 1 FROM PaymentTransactions pt WHERE pt.RelatedFeeID = f.FeeID AND pt.PaymentFor = 'Room' AND pt.VerifiedBy IS NULL) AS IsPendingVerification
                    FROM RoomFeeRecords f
                    LEFT JOIN Bookings b ON f.BookingID = b.BookingID
                    LEFT JOIN Rooms r ON b.RoomID = r.RoomID
                    LEFT JOIN Halls h ON b.HallID = h.HallID
                    WHERE f.StudentID = @sid ORDER BY f.Year DESC, f.Month DESC`);
        const messFees = await db.request()
            .input('sid', sql.Int, req.params.studentId)
            .query(`SELECT f.*,
                           (SELECT TOP 1 1 FROM PaymentTransactions pt WHERE pt.RelatedBillID = f.BillID AND pt.PaymentFor = 'Mess' AND pt.VerifiedBy IS NULL AND ISNULL(LEFT(pt.Notes, 8), '') != '[Weekly]') AS IsPendingVerification
                    FROM MessBillRecords f
                    WHERE f.StudentID = @sid ORDER BY f.Year DESC, f.Month DESC`);
        res.json({ roomFees: roomFees.recordset, messFees: messFees.recordset });
    } catch (err) {
        console.error('Get Student Fees Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Student: Submit Proof of Payment
app.post('/api/fees/submit-transaction', authenticateJWT, async (req, res) => {
    const { studentId, feeId, feeType, methodId, amount, referenceNo, notes } = req.body;
    try {
        if (req.user.role !== 'admin' && req.user.id !== parseInt(studentId)) {
            return res.status(403).json({ error: 'Forbidden: Access denied' });
        }
        
        if (referenceNo && referenceNo.length > 50) {
            return res.status(400).json({ error: 'Reference number too long' });
        }
        
        if (notes && notes.length > 500) {
            return res.status(400).json({ error: 'Notes too long' });
        }

        const db = await getPool();
        
        // Prevent duplicate ReferenceNo
        const refCheck = await db.request()
            .input('ref', sql.VarChar, referenceNo)
            .query('SELECT 1 FROM PaymentTransactions WHERE ReferenceNo = @ref');
            
        if (refCheck.recordset.length > 0) {
            return res.status(400).json({ error: 'This transaction reference number has already been submitted.' });
        }

        await db.request()
            .input('sid', sql.Int, studentId)
            .input('mid', sql.Int, methodId)
            .input('amount', sql.Decimal(10, 2), amount)
            .input('ref', sql.VarChar, referenceNo)
            .input('payFor', sql.VarChar, feeType) // 'Room' or 'Mess'
            .input('feeId', sql.Int, feeType === 'Room' ? feeId : null)
            .input('billId', sql.Int, feeType === 'Mess' ? feeId : null)
            .input('notes', sql.VarChar, notes)
            .query(`INSERT INTO PaymentTransactions (StudentID, MethodID, Amount, ReferenceNo, PaymentFor, RelatedFeeID, RelatedBillID, Notes, VerifiedBy)
                    VALUES (@sid, @mid, @amount, @ref, @payFor, @feeId, @billId, @notes, NULL)`);
        
        res.json({ success: true, message: 'Transaction submitted for Warden verification.' });
    } catch (err) {
        console.error('Submit Payment Transaction Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Admin: Get unverified transactions
app.get('/api/admin/fees/pending', authenticateJWT, requireRole(['admin']), async (req, res) => {
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT pt.*, s.FullName, s.RegNumber, pm.MethodName
            FROM PaymentTransactions pt
            JOIN Students s ON pt.StudentID = s.StudentID
            JOIN PaymentMethods pm ON pt.MethodID = pm.MethodID
            WHERE pt.VerifiedBy IS NULL
            ORDER BY pt.TransactionDate DESC`);
        res.json(result.recordset);
    } catch (err) {
        console.error('Get Pending Fees Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Admin: Verify Transaction (Executes Stored Procedure sp_RecordFeePayment)
app.put('/api/admin/fees/verify/:transactionId', authenticateJWT, requireRole(['admin']), async (req, res) => {
    const adminId = req.user.id; // Override to prevent spoofing
    try {
        const db = await getPool();
        
        // 1. Fetch transaction details
        const txnResult = await db.request()
            .input('txid', sql.Int, req.params.transactionId)
            .query('SELECT * FROM PaymentTransactions WHERE TransactionID = @txid');
            
        if (txnResult.recordset.length === 0) {
            return res.status(404).json({ error: 'Transaction not found.' });
        }
        
        const txn = txnResult.recordset[0];
        if (txn.VerifiedBy !== null) {
            return res.status(400).json({ error: 'Transaction is already verified.' });
        }

        const feeId = txn.PaymentFor === 'Room' ? txn.RelatedFeeID : txn.RelatedBillID;
        const isWeeklyMess = txn.PaymentFor === 'Mess' && txn.Notes && txn.Notes.startsWith('[Weekly]');

        // Start transaction to delete the pending request and call the SP safely (avoiding UNIQUE conflict)
        const transaction = new sql.Transaction(db);
        await transaction.begin();
        try {
            if (isWeeklyMess) {
                // Delete the student-submitted pending transaction to free up the ReferenceNo UNIQUE constraint
                await transaction.request()
                    .input('txid', sql.Int, req.params.transactionId)
                    .query('DELETE FROM PaymentTransactions WHERE TransactionID = @txid');

                // Update WeeklyMessBills
                await transaction.request()
                    .input('bid', sql.Int, txn.RelatedBillID)
                    .input('sid', sql.Int, txn.StudentID)
                    .query('UPDATE WeeklyMessBills SET IsPaid = 1 WHERE BillID = @bid AND StudentID = @sid');

                // Record the final verified transaction in PaymentTransactions
                await transaction.request()
                    .input('sid', sql.Int, txn.StudentID)
                    .input('mid', sql.Int, txn.MethodID)
                    .input('amount', sql.Decimal(10, 2), txn.Amount)
                    .input('ref', sql.VarChar, txn.ReferenceNo)
                    .input('notes', sql.VarChar, txn.Notes)
                    .input('admin', sql.Int, adminId)
                    .input('bid', sql.Int, txn.RelatedBillID)
                    .query(`INSERT INTO PaymentTransactions (StudentID, MethodID, Amount, ReferenceNo, PaymentFor, RelatedBillID, Notes, VerifiedBy)
                            VALUES (@sid, @mid, @amount, @ref, 'Mess', @bid, @notes, @admin)`);
            } else {
                // Delete the student-submitted pending transaction to free up the ReferenceNo UNIQUE constraint
                await transaction.request()
                    .input('txid', sql.Int, req.params.transactionId)
                    .query('DELETE FROM PaymentTransactions WHERE TransactionID = @txid');

                // Call the database Stored Procedure
                await transaction.request()
                    .input('StudentID', sql.Int, txn.StudentID)
                    .input('FeeID', sql.Int, feeId)
                    .input('FeeType', sql.VarChar, txn.PaymentFor) // 'Room' or 'Mess'
                    .input('MethodID', sql.Int, txn.MethodID)
                    .input('ReferenceNo', sql.VarChar, txn.ReferenceNo)
                    .input('AdminID', sql.Int, adminId)
                    .execute('sp_RecordFeePayment');
            }

            await transaction.commit();
        } catch (txnErr) {
            await transaction.rollback();
            throw txnErr;
        }

        // 3. Send Notification to student (persistent in DB)
        const notifMsg = `Your ${txn.PaymentFor} fee payment of PKR ${txn.Amount.toLocaleString()} (Ref: ${txn.ReferenceNo}) has been verified.`;
        await db.request()
            .input('sid', sql.Int, txn.StudentID)
            .input('msg', sql.VarChar, notifMsg)
            .query(`INSERT INTO Notifications (StudentID, Message, Icon, IsRead, CreatedAt)
                    VALUES (@sid, @msg, '💳', 0, GETDATE())`);

        res.json({ success: true, message: 'Payment successfully verified and settled.' });
    } catch (err) {
        console.error('Payment Verification Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Admin: Run Billing Cycle (Generate Room Fees for all active students)
app.post('/api/admin/fees/generate-room-fees', authenticateJWT, requireRole(['admin']), async (req, res) => {
    const { month, year } = req.body;
    try {
        const db = await getPool();
        await db.request()
            .input('Month', sql.Int, parseInt(month))
            .input('Year', sql.Int, parseInt(year))
            .execute('sp_GenerateMonthlyFees');
        res.json({ success: true, message: `Room fees generated successfully for ${month}/${year}.` });
    } catch (err) {
        console.error('Generate Room Fees Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─────────────────────────────────────────────
// COMPLAINTS
// ─────────────────────────────────────────────

app.post('/api/complaints', authenticateJWT, async (req, res) => {
    const { studentId, category, title, description, priority } = req.body;
    try {
        if (req.user.role !== 'admin' && req.user.id !== parseInt(studentId)) {
            return res.status(403).json({ error: 'Forbidden: Access denied' });
        }
        
        if (title && title.length > 150) {
            return res.status(400).json({ error: 'Title too long' });
        }
        
        if (description && description.length > 1000) {
            return res.status(400).json({ error: 'Description too long' });
        }

        const db = await getPool();

        // Find active/approved room booking to get HallID, HallName, and RoomID
        const bookingResult = await db.request()
            .input('sid', sql.Int, studentId)
            .query(`SELECT TOP 1 b.HallID, b.HallName, b.RoomID 
                    FROM Bookings b 
                    WHERE b.StudentID = @sid AND b.Status IN ('Approved', 'Active')
                    ORDER BY b.BookingDate DESC`);
        
        let hallId = null;
        let hallName = null;
        let roomId = null;
        
        if (bookingResult.recordset.length > 0) {
            hallId = bookingResult.recordset[0].HallID;
            hallName = bookingResult.recordset[0].HallName;
            roomId = bookingResult.recordset[0].RoomID;
        }
        
        // Lookup CategoryID
        const catResult = await db.request()
            .input('cname', sql.VarChar, category)
            .query('SELECT CategoryID FROM ComplaintCategories WHERE CategoryName = @cname');
            
        const catId = catResult.recordset.length ? catResult.recordset[0].CategoryID : 1; // Default to 1 if not found

        await db.request()
            .input('sid', sql.Int, studentId)
            .input('hid', sql.Int, hallId)
            .input('rid', sql.Int, roomId)
            .input('hname', sql.VarChar, hallName)
            .input('cid', sql.Int, catId)
            .input('title', sql.VarChar, title)
            .input('desc', sql.VarChar, description)
            .input('priority', sql.VarChar, priority || 'Medium')
            .query(`INSERT INTO Complaints (StudentID, HallID, RoomID, HallName, CategoryID, Title, Description, Priority)
                    VALUES (@sid, @hid, @rid, @hname, @cid, @title, @desc, @priority)`);
        res.json({ success: true, message: 'Complaint submitted successfully' });
    } catch (err) {
        console.error('Submit Complaint Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/complaints/student/:studentId', authenticateJWT, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.id !== parseInt(req.params.studentId)) {
            return res.status(403).json({ error: 'Forbidden: Access denied' });
        }

        const db = await getPool();
        const result = await db.request()
            .input('sid', sql.Int, req.params.studentId)
            .query(`SELECT c.*, h.HallName, cc.CategoryName AS Category
                    FROM Complaints c
                    LEFT JOIN Halls h ON c.HallID = h.HallID
                    LEFT JOIN ComplaintCategories cc ON c.CategoryID = cc.CategoryID
                    WHERE c.StudentID = @sid ORDER BY c.SubmittedAt DESC`);
        res.json(result.recordset);
    } catch (err) {
        console.error('Get Student Complaints Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/complaints/all', authenticateJWT, requireRole(['admin']), async (req, res) => {
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT c.*, s.FullName, s.RegNumber, h.HallName, r.RoomNumber, cc.CategoryName AS Category
            FROM Complaints c
            JOIN Students s ON c.StudentID = s.StudentID
            LEFT JOIN Halls h ON c.HallID = h.HallID
            LEFT JOIN Rooms r ON c.RoomID = r.RoomID
            LEFT JOIN ComplaintCategories cc ON c.CategoryID = cc.CategoryID
            ORDER BY c.SubmittedAt DESC`);
        res.json(result.recordset);
    } catch (err) {
        console.error('Get All Complaints Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─────────────────────────────────────────────
// STATS (admin dashboard)
// ─────────────────────────────────────────────
app.get('/api/stats', authenticateJWT, requireRole(['admin']), async (req, res) => {
    try {
        const db = await getPool();
        const statsQuery = await db.request().query(`
            SELECT 
                (SELECT COUNT(*) FROM Students) AS TotalStudents,
                (SELECT COUNT(*) FROM Bookings WHERE Status IN ('Approved', 'Active')) AS ActiveBookings,
                (SELECT COUNT(*) FROM Bookings WHERE Status='Pending') AS PendingBookings,
                (SELECT COUNT(*) FROM Complaints WHERE Status='Open') AS OpenComplaints,
                (SELECT COUNT(*) FROM Rooms WHERE IsAvailable=1) AS AvailableRooms,
                (SELECT COUNT(*) FROM RoomFeeRecords WHERE IsPaid=0) AS UnpaidFees,
                (SELECT ISNULL(SUM(rt.Capacity), 0) FROM Rooms r JOIN RoomTypes rt ON r.RoomTypeID = rt.RoomTypeID) AS TotalCapacity`);
        
        const stats = statsQuery.recordset[0];
        const totalCapacity = stats.TotalCapacity || 0;
        const activeBookings = stats.ActiveBookings || 0;

        stats.VacantCapacity = totalCapacity - activeBookings;
        stats.TotalOccupancyPct = totalCapacity > 0 ? Math.round((activeBookings * 100) / totalCapacity) : 0;

        // Fetch hall-wise capacity and occupancy breakdown
        const hallStats = await db.request().query(`
            SELECT 
                h.HallID,
                h.HallName,
                ISNULL(SUM(rt.Capacity), 0) AS TotalCapacity,
                ISNULL(occ.Cnt, 0) AS OccupiedCapacity
            FROM Halls h
            LEFT JOIN Rooms r ON h.HallID = r.HallID
            LEFT JOIN RoomTypes rt ON r.RoomTypeID = rt.RoomTypeID
            LEFT JOIN (
                SELECT HallID, COUNT(*) AS Cnt
                FROM Bookings
                WHERE Status IN ('Approved', 'Active')
                GROUP BY HallID
            ) occ ON h.HallID = occ.HallID
            WHERE h.IsActive = 1
            GROUP BY h.HallID, h.HallName, occ.Cnt
            ORDER BY h.HallName`);

        stats.halls = hallStats.recordset.map(h => ({
            ...h,
            OccupancyPct: h.TotalCapacity > 0 ? Math.round((h.OccupiedCapacity * 100) / h.TotalCapacity) : 0
        }));

        res.json(stats);
    } catch (err) {
        console.error('Get Admin Stats Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Public Stats for Landing Page
app.get('/api/public/stats', async (req, res) => {
    try {
        const db = await getPool();
        const stats = await db.request().query(`
            SELECT 
                (SELECT COUNT(DISTINCT StudentID) FROM Bookings WHERE Status IN ('Approved', 'Active')) AS ActiveStudents,
                (SELECT COUNT(*) FROM Rooms) AS ResidencyRooms,
                (SELECT COUNT(*) FROM Halls WHERE IsActive = 1) AS HostelHalls,
                (SELECT 98.5) AS SatisfactionRate
        `);
        res.json(stats.recordset[0]);
    } catch (err) {
        console.error('Error fetching landing page stats:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Admin View All Fees
app.get('/api/admin/fees/all', authenticateJWT, requireRole(['admin']), async (req, res) => {
    try {
        const db = await getPool();
        const roomFees = await db.request().query(`
            SELECT f.*, s.FullName, s.RegNumber, r.RoomNumber, h.HallName, 'Hall' as FeeType
            FROM RoomFeeRecords f
            JOIN Students s ON f.StudentID = s.StudentID
            LEFT JOIN Bookings b ON f.BookingID = b.BookingID
            LEFT JOIN Rooms r ON b.RoomID = r.RoomID
            LEFT JOIN Halls h ON b.HallID = h.HallID
            ORDER BY f.Year DESC, f.Month DESC`);
            
        const messFees = await db.request().query(`
            SELECT f.*, s.FullName, s.RegNumber, h.HallName, 'Mess' as FeeType
            FROM MessBillRecords f
            JOIN Students s ON f.StudentID = s.StudentID
            JOIN MessSubscriptions ms ON f.SubID = ms.SubscriptionID
            JOIN Halls h ON ms.HallID = h.HallID
            ORDER BY f.Year DESC, f.Month DESC`);
            
        res.json({ roomFees: roomFees.recordset, messFees: messFees.recordset });
    } catch (err) {
        console.error('Get All Fees Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.put('/api/complaints/:id/status', authenticateJWT, requireRole(['admin']), async (req, res) => {
    const { status, adminNote } = req.body;
    const adminId = req.user.id;
    try {
        if (adminNote && adminNote.length > 500) {
            return res.status(400).json({ error: 'Admin note exceeds limit of 500 characters' });
        }

        const db = await getPool();
        await db.request()
            .input('status', sql.VarChar, status)
            .input('note', sql.VarChar, adminNote)
            .input('id', sql.Int, req.params.id)
            .input('adminId', sql.Int, adminId)
            .query(`UPDATE Complaints SET Status=@status, AdminNote=@note, AssignedTo=@adminId,
                    ResolvedAt = CASE WHEN @status='Resolved' THEN GETDATE() ELSE NULL END
                    WHERE ComplaintID=@id`);
        res.json({ success: true });
    } catch (err) {
        console.error('Update Complaint Status Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─────────────────────────────────────────────
// STUDENTS
// ─────────────────────────────────────────────
app.get('/api/students', authenticateJWT, requireRole(['admin']), async (req, res) => {
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT s.StudentID, s.FullName, s.RegNumber, s.CGPA, d.DeptName AS Department, s.Semester, s.Email,
                   CASE 
                       WHEN s.CGPA >= 3.5 THEN 'Premium' 
                       WHEN s.CGPA >= 2.5 THEN 'Standard' 
                       ELSE 'Basic' 
                   END AS tier
            FROM Students s
            JOIN Departments d ON s.DeptID = d.DeptID
            ORDER BY s.FullName`);
        res.json(result.recordset);
    } catch (err) {
        console.error('Get Students Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─────────────────────────────────────────────
// EXPORT SYSTEM REPORT (SQL FORMAT)
// ─────────────────────────────────────────────
app.get('/api/admin/export', authenticateJWT, requireRole(['admin']), async (req, res) => {
    try {
        const db = await getPool();
        
        // 1. Get Stats
        const stats = await db.request().query(`
            SELECT 
                (SELECT COUNT(*) FROM Students) AS TotalStudents,
                (SELECT COUNT(*) FROM Bookings WHERE Status IN ('Approved', 'Active')) AS ActiveBookings,
                (SELECT COUNT(*) FROM Bookings WHERE Status='Pending') AS PendingBookings,
                (SELECT COUNT(*) FROM Complaints WHERE Status='Open') AS OpenComplaints,
                (SELECT COUNT(*) FROM Rooms WHERE IsAvailable=1) AS AvailableRooms`);
        const s = stats.recordset[0];

        // 2. Get active bookings
        const bookings = await db.request().query(`
            SELECT b.BookingID, s.FullName, s.RegNumber, h.HallName, r.RoomNumber, b.Status, b.BookingDate
            FROM Bookings b
            JOIN Students s ON b.StudentID = s.StudentID
            JOIN Halls h ON b.HallID = h.HallID
            JOIN Rooms r ON b.RoomID = r.RoomID
            WHERE b.Status IN ('Approved', 'Active')`);

        // 3. Get open complaints
        const complaints = await db.request().query(`
            SELECT c.ComplaintID, s.FullName, cc.CategoryName, c.Title, c.Status, c.SubmittedAt
            FROM Complaints c
            JOIN Students s ON c.StudentID = s.StudentID
            LEFT JOIN ComplaintCategories cc ON c.CategoryID = cc.CategoryID
            WHERE c.Status != 'Resolved'`);

        let sqlFile = `-- HOSTEL MANAGEMENT SYSTEM - STATUS REPORT\n`;
        sqlFile += `-- Generated on: ${new Date().toLocaleString()}\n\n`;
        
        sqlFile += `-- SECTION: SYSTEM OVERVIEW\n`;
        sqlFile += `-- Total Students: ${s.TotalStudents}\n`;
        sqlFile += `-- Active Bookings: ${s.ActiveBookings}\n`;
        sqlFile += `-- Pending Applications: ${s.PendingBookings}\n`;
        sqlFile += `-- Open Complaints: ${s.OpenComplaints}\n`;
        sqlFile += `-- Available Rooms: ${s.AvailableRooms}\n\n`;

        sqlFile += `-- SECTION: ACTIVE BOOKINGS SNAPSHOT\n`;
        bookings.recordset.forEach(b => {
            sqlFile += `-- Student: ${b.FullName} (${b.RegNumber}) | Hall: ${b.HallName} | Room: ${b.RoomNumber} | Approved: ${b.BookingDate?.toISOString().split('T')[0]}\n`;
        });
        sqlFile += `\n`;

        sqlFile += `-- SECTION: UNRESOLVED COMPLAINTS\n`;
        complaints.recordset.forEach(c => {
            sqlFile += `-- Title: ${c.Title} | Student: ${c.FullName} | Category: ${c.CategoryName || 'N/A'} | Status: ${c.Status}\n`;
        });

        res.setHeader('Content-Type', 'text/plain'); // Sending as text/plain so browser definitely treats it as such
        res.send(sqlFile);
    } catch (err) {
        console.error('Export Data Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─────────────────────────────────────────────
// GLOBAL SEARCH
// ─────────────────────────────────────────────
app.get('/api/search', authenticateJWT, async (req, res) => {
    const { q } = req.query;
    const role = req.user.role;
    const userId = req.user.id;

    if (!q || q.length < 2) return res.json({ students: [], rooms: [], mess: [], complaints: [], bookings: [] });

    try {
        const db = await getPool();
        const searchTerm = `%${q}%`;
        const results = { students: [], rooms: [], mess: [], complaints: [], bookings: [] };

        // 1. Students (Only admins can search students, or students can see non-sensitive listing)
        const studentRes = await db.request()
            .input('q', sql.NVarChar(200), searchTerm)
            .query(`SELECT StudentID, FullName, RegNumber, Email, Semester 
                    FROM Students 
                    WHERE FullName LIKE @q OR RegNumber LIKE @q OR Email LIKE @q`);
        results.students = studentRes.recordset;

        // 2. Search Halls & Rooms
        const roomRes = await db.request()
            .input('q', sql.NVarChar(200), searchTerm)
            .query(`SELECT r.RoomID, r.RoomNumber, h.HallName, h.HallID, rt.TypeName AS RoomType
                    FROM Rooms r
                    JOIN Halls h ON r.HallID = h.HallID
                    JOIN RoomTypes rt ON r.RoomTypeID = rt.RoomTypeID
                    WHERE r.RoomNumber LIKE @q OR h.HallName LIKE @q`);
        results.rooms = roomRes.recordset;

        // 3. Search Mess Menu
        const messRes = await db.request()
            .input('q', sql.NVarChar(200), searchTerm)
            .query(`SELECT mm.DayOfWeek, mc.CategoryName AS MealType, fi.FoodName
                    FROM MessMenu mm
                    JOIN MessCategories mc ON mm.MessCatID = mc.MessCatID
                    JOIN FoodItems fi ON mm.FoodID = fi.FoodID
                    WHERE fi.FoodName LIKE @q OR mm.DayOfWeek LIKE @q`);
        results.mess = messRes.recordset;

        // 4. Search Complaints
        let complaintRequest = db.request().input('q', sql.NVarChar(200), searchTerm);
        let complaintQuery = `SELECT c.ComplaintID, c.Title, c.Status, cc.CategoryName AS Category, s.FullName AS StudentName
                              FROM Complaints c
                              JOIN Students s ON c.StudentID = s.StudentID
                              LEFT JOIN ComplaintCategories cc ON c.CategoryID = cc.CategoryID
                              WHERE (c.Title LIKE @q OR c.Description LIKE @q OR s.FullName LIKE @q OR s.RegNumber LIKE @q)`;
        
        if (role === 'student') {
            complaintRequest.input('uid', sql.Int, userId);
            complaintQuery += ` AND c.StudentID = @uid`;
        }

        const complaintRes = await complaintRequest.query(complaintQuery);
        results.complaints = complaintRes.recordset;

        // 5. Search Bookings
        let bookingRequest = db.request().input('q', sql.NVarChar(200), searchTerm);
        let bookingQuery = `SELECT b.BookingID, s.FullName, h.HallName, r.RoomNumber, b.Status
                            FROM Bookings b
                            JOIN Students s ON b.StudentID = s.StudentID
                            JOIN Halls h ON b.HallID = h.HallID
                            JOIN Rooms r ON b.RoomID = r.RoomID
                            WHERE (s.FullName LIKE @q OR h.HallName LIKE @q OR r.RoomNumber LIKE @q)`;
        
        if (role === 'student') {
            bookingRequest.input('uid', sql.Int, userId);
            bookingQuery += ` AND b.StudentID = @uid`;
        }

        const bookingRes = await bookingRequest.query(bookingQuery);
        results.bookings = bookingRes.recordset;

        res.json(results);
    } catch (err) { 
        console.error('Search API Error:', err);
        res.status(500).json({ error: 'Internal Server Error' }); 
    }
});

// ─────────────────────────────────────────────
// DELETE OPERATIONS
// ─────────────────────────────────────────────

// Delete booking (student can cancel pending, admin can delete any)
app.delete('/api/bookings/:bookingId', authenticateJWT, async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    try {
        const db = await getPool();
        
        // Get booking details first
        const bookingResult = await db.request()
            .input('bid', sql.Int, req.params.bookingId)
            .query('SELECT StudentID, Status FROM Bookings WHERE BookingID = @bid');
            
        if (!bookingResult.recordset.length)
            return res.status(404).json({ error: 'Booking not found' });
            
        const booking = bookingResult.recordset[0];
        
        // Check permissions
        if (userRole === 'student' && booking.StudentID !== userId)
            return res.status(403).json({ error: 'Access denied' });
            
        if (userRole === 'student' && booking.Status !== 'Pending')
            return res.status(400).json({ error: 'Can only cancel pending bookings' });
            
        // Delete the booking
        await db.request()
            .input('bid', sql.Int, req.params.bookingId)
            .query('DELETE FROM Bookings WHERE BookingID = @bid');
            
        res.json({ success: true, message: 'Booking deleted successfully' });
    } catch (err) {
        console.error('Delete Booking Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Delete complaint (student can delete their own, admin can delete any)
app.delete('/api/complaints/:complaintId', authenticateJWT, async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    try {
        const db = await getPool();
        
        // Get complaint details first
        const complaintResult = await db.request()
            .input('cid', sql.Int, req.params.complaintId)
            .query('SELECT StudentID FROM Complaints WHERE ComplaintID = @cid');
            
        if (!complaintResult.recordset.length)
            return res.status(404).json({ error: 'Complaint not found' });
            
        const complaint = complaintResult.recordset[0];
        
        // Check permissions
        if (userRole === 'student' && complaint.StudentID !== userId)
            return res.status(403).json({ error: 'Access denied' });
            
        // Delete the complaint
        await db.request()
            .input('cid', sql.Int, req.params.complaintId)
            .query('DELETE FROM Complaints WHERE ComplaintID = @cid');
            
        res.json({ success: true, message: 'Complaint deleted successfully' });
    } catch (err) {
        console.error('Delete Complaint Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Delete student (admin only)
app.delete('/api/students/:studentId', authenticateJWT, requireRole(['admin']), async (req, res) => {
    try {
        const db = await getPool();
        
        // Check if student has active bookings
        const activeBookings = await db.request()
            .input('sid', sql.Int, req.params.studentId)
            .query("SELECT COUNT(*) as count FROM Bookings WHERE StudentID = @sid AND Status IN ('Approved', 'Active')");
            
        if (activeBookings.recordset[0].count > 0)
            return res.status(400).json({ error: 'Cannot delete student with active bookings' });
            
        // Delete related records first (cascade delete)
        await db.request().input('sid', sql.Int, req.params.studentId).query('DELETE FROM Complaints WHERE StudentID = @sid');
        await db.request().input('sid', sql.Int, req.params.studentId).query('DELETE FROM Bookings WHERE StudentID = @sid');
        await db.request().input('sid', sql.Int, req.params.studentId).query('DELETE FROM RoomFeeRecords WHERE StudentID = @sid');
        await db.request().input('sid', sql.Int, req.params.studentId).query('DELETE FROM MessBillRecords WHERE StudentID = @sid');
        
        // Delete the student
        await db.request()
            .input('sid', sql.Int, req.params.studentId)
            .query('DELETE FROM Students WHERE StudentID = @sid');
            
        res.json({ success: true, message: 'Student deleted successfully' });
    } catch (err) {
        console.error('Delete Student Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ── MESS ATTENDANCE & BILLING
// ─────────────────────────────────────────────

// Mark Attendance (RESTRICTED: Admin only)
app.post('/api/mess/attendance', async (req, res) => {
    res.status(403).json({ error: "Self-marking attendance is disabled. Attendance must be marked by a dining administrator." });
});

// Get today's mess attendance for a student
app.get('/api/mess/attendance/today', authenticateJWT, async (req, res) => {
    const studentId = req.query.studentId ? parseInt(req.query.studentId) : null;
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });
    if (req.user.role !== 'admin' && req.user.id !== studentId) {
        return res.status(403).json({ error: 'Forbidden: Access denied' });
    }
    try {
        const db = await getPool();
        const result = await db.request()
            .input('sid', sql.Int, studentId)
            .query(`
                SELECT RTRIM(MealType) AS MealType 
                FROM MessAttendance 
                WHERE StudentID = @sid 
                AND CAST(AttendanceDate AS DATE) = CAST(GETDATE() AS DATE)
            `);
        res.json(result.recordset);
    } catch (err) {
        console.error('Get Mess Attendance Today Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get Mess Activity Statistics
app.get('/api/mess/activity/stats', authenticateJWT, async (req, res) => {
    let studentId = req.query.studentId ? parseInt(req.query.studentId) : null;
    if (req.user.role !== 'admin') {
        studentId = req.user.id; // Enforce own statistics
    }
    try {
        const db = await getPool();
        let query = `
            SELECT 
                COALESCE(SUM(CASE WHEN AttendanceDate = CAST(GETDATE() AS DATE) THEN FinalPrice ELSE 0 END), 0) as TodayTotal,
                COALESCE(SUM(CASE WHEN AttendanceDate = CAST(DATEADD(day, -1, GETDATE()) AS DATE) THEN FinalPrice ELSE 0 END), 0) as YesterdayTotal,
                COALESCE(SUM(CASE WHEN AttendanceDate >= DATEADD(wk, DATEDIFF(wk, 0, GETDATE()), 0) THEN FinalPrice ELSE 0 END), 0) as ThisWeekTotal,
                COALESCE(SUM(CASE WHEN MONTH(AttendanceDate) = MONTH(GETDATE()) AND YEAR(AttendanceDate) = YEAR(GETDATE()) THEN FinalPrice ELSE 0 END), 0) as ThisMonthTotal,
                COALESCE(SUM(CASE WHEN MONTH(AttendanceDate) = MONTH(DATEADD(month, -1, GETDATE())) AND YEAR(AttendanceDate) = YEAR(DATEADD(month, -1, GETDATE())) THEN FinalPrice ELSE 0 END), 0) as LastMonthTotal
            FROM MessAttendance
        `;
        const reqDb = db.request();
        if (studentId) {
            query += ` WHERE StudentID = @sid`;
            reqDb.input('sid', sql.Int, studentId);
        }
        const result = await reqDb.query(query);
        res.json(result.recordset[0] || {});
    } catch (err) {
        console.error('Get Mess Stats Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get detailed Mess Activity History
app.get('/api/mess/activity/history', authenticateJWT, async (req, res) => {
    let studentId = req.query.studentId ? parseInt(req.query.studentId) : null;
    if (req.user.role !== 'admin') {
        studentId = req.user.id; // Enforce own history
    }
    try {
        const db = await getPool();
        let query = `
            SELECT a.AttendanceID, a.AttendanceDate, a.MealType, a.PriceAtTime, a.MealUnit, a.FinalPrice, s.FullName as StudentName 
            FROM MessAttendance a
            JOIN Students s ON a.StudentID = s.StudentID
        `;
        const reqDb = db.request();
        if (studentId) {
            query += ` WHERE a.StudentID = @sid`;
            reqDb.input('sid', sql.Int, studentId);
        }
        query += ` ORDER BY a.AttendanceDate DESC, a.AttendanceID DESC`;
        
        const result = await reqDb.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('Get Mess History Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Generate Weekly Mess Bill
app.post('/api/admin/mess/generate-weekly-bill', authenticateJWT, requireRole(['admin']), async (req, res) => {
    try {
        const db = await getPool();
        // Calculates bill for the previous complete week (or current week up to now)
        await db.request().query(`
            INSERT INTO WeeklyMessBills (StudentID, WeekStartDate, WeekEndDate, TotalAmount)
            SELECT 
                StudentID,
                DATEADD(wk, DATEDIFF(wk, 7, GETDATE()), 0) as WeekStart, -- Last week Monday
                DATEADD(wk, DATEDIFF(wk, 7, GETDATE()), 6) as WeekEnd,   -- Last week Sunday
                SUM(FinalPrice)
            FROM MessAttendance
            WHERE AttendanceDate >= DATEADD(wk, DATEDIFF(wk, 7, GETDATE()), 0)
              AND AttendanceDate <= DATEADD(wk, DATEDIFF(wk, 7, GETDATE()), 6)
              AND NOT EXISTS (
                  SELECT 1 FROM WeeklyMessBills wmb 
                  WHERE wmb.StudentID = MessAttendance.StudentID 
                  AND wmb.WeekStartDate = DATEADD(wk, DATEDIFF(wk, 7, GETDATE()), 0)
              )
            GROUP BY StudentID
        `);
        res.json({ success: true, message: 'Weekly bills generated' });
    } catch (err) {
        console.error('Generate Weekly Mess Bill Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Get Weekly Bills
app.get('/api/mess/bills/weekly', authenticateJWT, async (req, res) => {
    let studentId = req.query.studentId ? parseInt(req.query.studentId) : null;
    if (req.user.role !== 'admin') {
        studentId = req.user.id; // Enforce own bills
    }
    try {
        const db = await getPool();
        let query = `
            SELECT w.BillID, w.StudentID, w.WeekStartDate, w.WeekEndDate, w.TotalAmount, w.IsPaid,
                   (SELECT TOP 1 1 
                    FROM PaymentTransactions pt 
                    WHERE pt.RelatedBillID = w.BillID 
                      AND pt.PaymentFor = 'Mess' 
                      AND LEFT(pt.Notes, 8) = '[Weekly]' 
                      AND pt.VerifiedBy IS NULL) AS IsPendingVerification
            FROM WeeklyMessBills w
        `;
        const reqDb = db.request();
        if (studentId) {
            query += ` WHERE w.StudentID = @sid`;
            reqDb.input('sid', sql.Int, studentId);
        }
        query += ` ORDER BY w.WeekStartDate DESC`;
        const result = await reqDb.query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('Get Weekly Bills Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Admin Mess Report (Marksheet)
app.get('/api/admin/mess/report', authenticateJWT, requireRole(['admin']), async (req, res) => {
    try {
        const db = await getPool();
        const month = new Date().getMonth() + 1;
        const year = new Date().getFullYear();
        console.log(`Fetching Mess Report for Month: ${month}, Year: ${year}`);
        const result = await db.request()
            .input('m', sql.Int, month)
            .input('y', sql.Int, year)
            .query(`
            SELECT 
                s.FullName, s.RegNumber, s.StudentID,
                @m as [Month], @y as [Year],
                (SELECT ISNULL(SUM(FinalPrice), 0) FROM MessAttendance ma 
                 WHERE ma.StudentID = s.StudentID AND MONTH(ma.AttendanceDate) = @m AND YEAR(ma.AttendanceDate) = @y) as Amount,
                CASE WHEN EXISTS(SELECT 1 FROM WeeklyMessBills wmb WHERE wmb.StudentID = s.StudentID AND wmb.IsPaid = 0) THEN 0 ELSE 1 END as IsPaid,
                (SELECT COUNT(*) FROM MessAttendance ma 
                 WHERE ma.StudentID = s.StudentID AND MONTH(ma.AttendanceDate) = @m AND YEAR(ma.AttendanceDate) = @y) as AttendanceDays,
                (SELECT COUNT(*) FROM MessAttendance ma 
                 WHERE ma.StudentID = s.StudentID AND CAST(ma.AttendanceDate AS DATE) = CAST(GETDATE() AS DATE) AND ma.MealType = 'Breakfast') as TodayBreakfast,
                (SELECT COUNT(*) FROM MessAttendance ma 
                 WHERE ma.StudentID = s.StudentID AND CAST(ma.AttendanceDate AS DATE) = CAST(GETDATE() AS DATE) AND ma.MealType = 'Lunch') as TodayLunch,
                (SELECT COUNT(*) FROM MessAttendance ma 
                 WHERE ma.StudentID = s.StudentID AND CAST(ma.AttendanceDate AS DATE) = CAST(GETDATE() AS DATE) AND ma.MealType = 'Dinner') as TodayDinner
            FROM Students s
            ORDER BY Amount DESC, s.FullName ASC`);
        
        console.log(`Mess Report fetched: ${result.recordset.length} rows`);
        res.json(result.recordset);
    } catch (err) { 
        console.error('Mess Report Error:', err);
        res.status(500).json({ error: 'Internal Server Error' }); 
    }
});

// Admin Mess Activity Stats
app.get('/api/admin/mess/activity/stats', authenticateJWT, requireRole(['admin']), async (req, res) => {
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT 
                ISNULL(SUM(CASE WHEN CAST(AttendanceDate AS DATE) = CAST(GETDATE() AS DATE) THEN FinalPrice ELSE 0 END), 0) as TodayExpense,
                ISNULL(SUM(CASE WHEN CAST(AttendanceDate AS DATE) = CAST(DATEADD(day, -1, GETDATE()) AS DATE) THEN FinalPrice ELSE 0 END), 0) as YesterdayExpense,
                ISNULL(SUM(CASE WHEN AttendanceDate >= DATEADD(day, 1-DATEPART(weekday, GETDATE()), CAST(GETDATE() AS DATE)) THEN FinalPrice ELSE 0 END), 0) as ThisWeekExpense,
                ISNULL(SUM(CASE WHEN MONTH(AttendanceDate) = MONTH(GETDATE()) AND YEAR(AttendanceDate) = YEAR(GETDATE()) THEN FinalPrice ELSE 0 END), 0) as ThisMonthExpense
            FROM MessAttendance
        `);
        res.json(result.recordset[0]);
    } catch (err) {
        console.error('Admin Mess Stats Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Admin Weekly Mess Bills List
app.get('/api/admin/mess/bills/weekly', authenticateJWT, requireRole(['admin']), async (req, res) => {
    try {
        const db = await getPool();
        const result = await db.request().query(`
            SELECT TOP 50 w.BillID, s.FullName, s.RegNumber, w.WeekStartDate, w.WeekEndDate, w.TotalAmount, w.IsPaid
            FROM WeeklyMessBills w
            JOIN Students s ON w.StudentID = s.StudentID
            ORDER BY w.WeekStartDate DESC, w.BillID DESC
        `);
        res.json(result.recordset);
    } catch (err) {
        console.error('Admin Weekly Bills Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Export Mess Report (CSV)
app.get('/api/admin/mess/export', authenticateJWT, requireRole(['admin']), async (req, res) => {
    try {
        const db = await getPool();
        const month = new Date().getMonth() + 1;
        const year = new Date().getFullYear();
        const result = await db.request()
            .input('m', sql.Int, month)
            .input('y', sql.Int, year)
            .query(`
            SELECT 
                s.FullName, s.RegNumber,
                @m as [Month], @y as [Year],
                ISNULL(mb.Amount, 0) as Amount,
                ISNULL(mb.IsPaid, 0) as IsPaid,
                (SELECT COUNT(*) FROM MessAttendance ma 
                 WHERE ma.StudentID = s.StudentID AND MONTH(ma.AttendanceDate) = @m AND YEAR(ma.AttendanceDate) = @y) as AttendanceDays
            FROM Students s
            LEFT JOIN MessBillRecords mb ON s.StudentID = mb.StudentID AND mb.Month = @m AND mb.Year = @y
            ORDER BY mb.Amount DESC, s.FullName ASC`);
        
        let csv = 'FullName,RegNumber,Month,Year,AttendanceDays,Amount,Status\n';
        result.recordset.forEach(r => {
            csv += `"${r.FullName}","${r.RegNumber}",${r.Month},${r.Year},${r.AttendanceDays},${r.Amount},"${r.IsPaid ? 'Paid' : 'Unpaid'}"\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=mess_report_${month}_${year}.csv`);
        res.send(csv);
    } catch (err) {
        console.error('Export Mess Report Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ─────────────────────────────────────────────
// ADMIN MESS ATTENDANCE & persistent NOTIFICATIONS
// ─────────────────────────────────────────────

// Database auto-initialization check
async function initializeDatabase() {
    try {
        const db = await getPool();
        await db.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Notifications' AND xtype='U')
            BEGIN
                CREATE TABLE Notifications (
                    NotificationID INT IDENTITY(1,1) PRIMARY KEY,
                    StudentID INT NOT NULL,
                    Message VARCHAR(500) NOT NULL,
                    Icon VARCHAR(10) DEFAULT '🔔',
                    IsRead BIT NOT NULL DEFAULT 0,
                    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
                    CONSTRAINT fk_notifications_student FOREIGN KEY (StudentID) REFERENCES Students(StudentID) ON DELETE CASCADE
                )
                PRINT 'Notifications table created successfully!'
            END
        `);
        console.log("Database check complete: Notifications table verified.");

        await db.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='WeeklyMessBills' AND xtype='U')
            BEGIN
                CREATE TABLE WeeklyMessBills (
                    BillID INT IDENTITY(1,1) PRIMARY KEY,
                    StudentID INT NOT NULL,
                    WeekStartDate DATE NOT NULL,
                    WeekEndDate DATE NOT NULL,
                    TotalAmount DECIMAL(10,2) NOT NULL CHECK (TotalAmount >= 0),
                    IsPaid BIT DEFAULT 0,
                    CONSTRAINT fk_weeklymess_student FOREIGN KEY (StudentID) REFERENCES Students(StudentID) ON DELETE CASCADE
                )
                PRINT 'WeeklyMessBills table created successfully!'
            END
        `);
        console.log("Database check complete: WeeklyMessBills table verified.");

        await db.request().query(`
            IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='VerificationOTPs' AND xtype='U')
            BEGIN
                CREATE TABLE VerificationOTPs (
                    OtpID INT IDENTITY(1,1) PRIMARY KEY,
                    Email VARCHAR(120) NOT NULL,
                    OtpCode VARCHAR(6) NOT NULL,
                    Purpose VARCHAR(20) NOT NULL,
                    ExpiresAt DATETIME NOT NULL,
                    IsUsed BIT DEFAULT 0,
                    CreatedAt DATETIME DEFAULT GETDATE()
                )
                PRINT 'VerificationOTPs table created successfully!'
            END
        `);
        console.log("Database check complete: VerificationOTPs table verified.");
    } catch (err) {
        console.error("Database initialization failed:", err.message);
    }
}

// Admin Mark Attendance for student
app.post('/api/admin/mess/attendance', authenticateJWT, requireRole(['admin']), async (req, res) => {
    const { studentId, mealType } = req.body;
    try {
        const db = await getPool();

        // 1. Get today's day of week
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayName = days[new Date().getDay()];

        // 2. Fetch the active menu item and its price for today's day and mealType
        const menuResult = await db.request()
            .input('day', sql.VarChar, todayName)
            .input('type', sql.VarChar, mealType)
            .query(`
                SELECT TOP 1 mm.MenuID, fi.Price 
                FROM MessMenu mm
                JOIN MessCategories mc ON mm.MessCatID = mc.MessCatID
                JOIN FoodItems fi ON mm.FoodID = fi.FoodID
                WHERE mm.DayOfWeek = @day AND mc.CategoryName = @type AND ISNULL(mm.IsActive, 1) = 1
            `);

        if (menuResult.recordset.length === 0) {
            return res.status(404).json({ error: `No active menu item configured for ${mealType} on ${todayName}.` });
        }

        const { MenuID, Price } = menuResult.recordset[0];

        // 3. Enforce 1 time limit per student per meal per day
        const check = await db.request()
            .input('sid', sql.Int, studentId)
            .input('type', sql.VarChar, mealType)
            .query(`
                SELECT 1 FROM MessAttendance 
                WHERE StudentID = @sid AND MealType = @type 
                AND CAST(AttendanceDate AS DATE) = CAST(GETDATE() AS DATE)
            `);

        if (check.recordset.length > 0) {
            return res.status(400).json({ error: `Attendance for today's ${mealType} has already been marked.` });
        }

        // 4. Calculate Final Price
        const mealUnit = mealType === 'Breakfast' ? 0.75 : (mealType === 'Lunch' ? 0.80 : 0.82);
        const finalPrice = Price * mealUnit;

        // 5. Insert Attendance Record
        await db.request()
            .input('sid', sql.Int, studentId)
            .input('mid', sql.Int, MenuID)
            .input('type', sql.VarChar, mealType)
            .input('price', sql.Decimal(10, 2), Price)
            .input('unit', sql.Decimal(5, 2), mealUnit)
            .input('finalPrice', sql.Decimal(10, 2), finalPrice)
            .query(`
                INSERT INTO MessAttendance (StudentID, MenuID, MealType, PriceAtTime, MealUnit, FinalPrice)
                VALUES (@sid, @mid, @type, @price, @unit, @finalPrice)
            `);

        // 6. Create Student Notification in database
        const notifMsg = `Your attendance for today's ${mealType} has been marked by Admin.`;
        await db.request()
            .input('sid', sql.Int, studentId)
            .input('msg', sql.VarChar, notifMsg)
            .input('icon', sql.VarChar, '🍽️')
            .query(`
                INSERT INTO Notifications (StudentID, Message, Icon, IsRead, CreatedAt)
                VALUES (@sid, @msg, @icon, 0, GETDATE())
            `);

        res.json({ success: true, finalPrice, message: `Attendance marked and notification sent.` });
    } catch (err) { 
        console.error('Admin Attendance Marking Error:', err);
        res.status(500).json({ error: 'Internal Server Error' }); 
    }
});

// Fetch notifications for a student
app.get('/api/notifications/student/:studentId', authenticateJWT, async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.id !== parseInt(req.params.studentId)) {
            return res.status(403).json({ error: 'Forbidden: Access denied' });
        }

        const db = await getPool();
        const result = await db.request()
            .input('sid', sql.Int, req.params.studentId)
            .query(`
                SELECT TOP 50 NotificationID, StudentID, Message, Icon, IsRead, CreatedAt 
                FROM Notifications 
                WHERE StudentID = @sid 
                ORDER BY CreatedAt DESC
            `);
        res.json(result.recordset);
    } catch (err) { 
        console.error('Fetch Notifications Error:', err);
        res.status(500).json({ error: 'Internal Server Error' }); 
    }
});

// Mark a notification as read
app.put('/api/notifications/:notificationId/read', authenticateJWT, async (req, res) => {
    try {
        const db = await getPool();
        
        // Authorization: Ensure students can only read their own notifications
        if (req.user.role !== 'admin') {
            const ownerCheck = await db.request()
                .input('nid', sql.Int, req.params.notificationId)
                .query('SELECT StudentID FROM Notifications WHERE NotificationID = @nid');
            if (ownerCheck.recordset.length > 0 && ownerCheck.recordset[0].StudentID !== req.user.id) {
                return res.status(403).json({ error: 'Forbidden: Access denied' });
            }
        }

        await db.request()
            .input('nid', sql.Int, req.params.notificationId)
            .query(`
                UPDATE Notifications 
                SET IsRead = 1 
                WHERE NotificationID = @nid
            `);
        res.json({ success: true });
    } catch (err) { 
        console.error('Mark Notification Read Error:', err);
        res.status(500).json({ error: 'Internal Server Error' }); 
    }
});

// ─────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────
const PORT = 3000;
app.listen(PORT, async () => {
    await initializeDatabase();
    console.log(`\n🏨 Hostel Management System running at http://localhost:${PORT}\n`);
});

