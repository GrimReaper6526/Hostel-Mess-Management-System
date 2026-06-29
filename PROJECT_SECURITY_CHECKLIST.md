# 🛡️ Full-Stack Project Security & Quality Checklist

> **Ye file copy karke apne project ke root folder mein rakh lo.**
> Har project start karne se pehle aur deploy karne se pehle is checklist ko zaroor check karo.
> `[ ]` ko `[x]` se replace karo jab kaam ho jaye.

---

## 📋 HOW TO USE

1. Apne project root mein ye file rakho: `PROJECT_SECURITY_CHECKLIST.md`
2. Project banate waqt har section ko follow karo
3. Deploy se **pehle** sab `[x]` hone chahiye
4. Agar koi item samajh nahi aaya, neeche explanation section mein dekho

---

## 🔐 SECTION 1: Authentication & Authorization

### 1.1 Passwords & Sessions
- [ ] Passwords **kabhi bhi plain text** mein store nahi hote — bcrypt/argon2 use karo
- [ ] Password minimum length enforce ki gayi hai (min 8 characters)
- [ ] Login attempts limit hain (brute force protection) — max 5 attempts, phir lockout
- [ ] Session tokens cryptographically random hain (na user ID, na timestamp)
- [ ] Session expire hoti hai (idle timeout + absolute timeout)
- [ ] Logout karne pe server-side session destroy hoti hai
- [ ] "Remember me" feature secure cookie use karta hai

### 1.2 JWT (Agar JWT use kar rahe ho)
- [ ] JWT secret key strong hai (min 256-bit random string)
- [ ] JWT secret `.env` mein hai, code mein hardcode nahi
- [ ] JWT expiry set hai (access token: 15min–1hr, refresh token: 7–30 days)
- [ ] Algorithm explicitly `HS256` ya `RS256` set hai — `"none"` algorithm allow nahi
- [ ] Refresh token rotation implement ki gayi hai
- [ ] Refresh tokens database mein store hote hain (revocation ke liye)
- [ ] Logout invalidates token server-side (using Redis blacklist or DB session check, client-side delete is not enough)

### 1.3 Authorization (Kaun kya access kar sakta hai)
- [ ] Har API route pe authorization check hai (sirf frontend pe nahi)
- [ ] User A, User B ka data access nahi kar sakta (IDOR check)
- [ ] Admin routes properly protected hain
- [ ] Role-based access control (RBAC) server-side enforce hoti hai
- [ ] Deleted/banned users ka access turant revoke hota hai

---

## 💉 SECTION 2: Injection Attacks

### 2.1 SQL Injection
- [ ] Koi bhi raw SQL query mein user input directly nahi daal raha
- [ ] Parameterized queries / prepared statements use ho rahi hain
- [ ] ORM (Prisma/Sequelize/TypeORM) use kar rahe ho — raw queries avoid karo
- [ ] **Example of WRONG code:**
  ```javascript
  // ❌ GALAT - SQL Injection ka direct rasta
  db.query(`SELECT * FROM users WHERE email = '${userInput}'`)
  
  // ✅ SAHI - Parameterized query
  db.query('SELECT * FROM users WHERE email = $1', [userInput])
  ```

### 2.2 NoSQL Injection (MongoDB)
- [ ] MongoDB queries mein user input directly operators nahi banta
- [ ] **Example of WRONG code:**
  ```javascript
  // ❌ GALAT
  User.find({ email: req.body.email }) // agar email = { $gt: "" } ho to sab users milenge
  
  // ✅ SAHI
  const email = String(req.body.email) // type enforce karo
  User.find({ email: email })
  ```

### 2.3 XSS (Cross-Site Scripting)
- [ ] User ka koi bhi input HTML mein directly render nahi hota
- [ ] `innerHTML` ki jagah `textContent` use ho raha hai
- [ ] React/Vue use kar rahe ho to JSX auto-escaping pe rely karo
- [ ] `dangerouslySetInnerHTML` sirf zaroorat pe aur sanitize karke use ho
- [ ] DOMPurify ya equivalent library use ho rahi hai agar HTML render karna zaroor hai
- [ ] Content Security Policy (CSP) header set hai

### 2.4 Command Injection
- [ ] `exec()`, `spawn()`, `eval()` mein user input nahi ja raha
- [ ] File paths user se nahi aa rahe bina validation ke

---

## 🌐 SECTION 3: API Security

### 3.1 Input Validation
- [ ] Har API endpoint pe input validate hota hai (server-side)
- [ ] Zod / Joi / Yup se schema validation implement hai
- [ ] Request body ka size limit hai (DoS attack se bachao)
- [ ] File upload: type, size, aur extension check hoti hai
- [ ] **Example:**
  ```javascript
  // ✅ SAHI - Zod se validation
  const schema = z.object({
    email: z.string().email(),
    age: z.number().int().min(0).max(120),
    name: z.string().max(100)
  })
  const data = schema.parse(req.body) // throws if invalid
  ```

### 3.2 Rate Limiting
- [ ] Login endpoint pe strict rate limit hai (5/min per IP)
- [ ] Register endpoint pe rate limit hai
- [ ] Public APIs pe rate limit hai (express-rate-limit ya similar)
- [ ] OTP/verification endpoints pe rate limit hai
- [ ] **Example:**
  ```javascript
  import rateLimit from 'express-rate-limit'
  
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    message: 'Too many login attempts'
  })
  app.post('/api/login', loginLimiter, loginHandler)
  ```

### 3.3 CORS (Cross-Origin Resource Sharing)
- [ ] CORS `origin: '*'` production mein nahi hai
- [ ] Sirf allowed domains whitelist mein hain
- [ ] Credentials ke saath `*` origin allow nahi
- [ ] **Example:**
  ```javascript
  // ❌ GALAT
  app.use(cors({ origin: '*' }))
  
  // ✅ SAHI
  app.use(cors({
    origin: ['https://yourapp.com', 'https://www.yourapp.com'],
    credentials: true
  }))
  ```

### 3.4 HTTP Security Headers
- [ ] `helmet.js` use ho rahi hai (Express ke liye)
- [ ] X-Frame-Options set hai (clickjacking se bachao)
- [ ] X-Content-Type-Options: nosniff set hai
- [ ] Strict-Transport-Security (HSTS) set hai
- [ ] Referrer-Policy set hai

---

## 🗄️ SECTION 4: Database Security

- [ ] Database **kabhi bhi** publicly accessible nahi (firewall rules)
- [ ] Database user ko sirf zaroorat ke permissions hain (least privilege)
- [ ] Database connection string `.env` mein hai
- [ ] Database backups schedule hain
- [ ] Sensitive data (SSN, cards) encrypted store hoti hai
- [ ] Connection pooling properly configure hai
- [ ] Database credentials production aur development mein alag hain
- [ ] User passwords column ka naam confusing nahi (e.g., `password_hash` rakho)

---

## 🔑 SECTION 5: Environment Variables & Secrets

- [ ] `.env` file `.gitignore` mein hai — **GitHub pe kabhi push mat karo**
- [ ] `.env.example` file banayi hai (actual values ke bina)
- [ ] Koi bhi secret hardcode nahi hai code mein
- [ ] API keys, DB passwords, JWT secrets sab `.env` mein hain
- [ ] Production secrets alag hain development se
- [ ] Secret rotation ka plan hai (keys change karne ka)
- [ ] Docker-compose.yml ya CI/CD configs mein hardcoded secrets nahi hain
- [ ] **Git history wipe check:** Agar koi secret accidentally push ho gaya tha, toh commit delete karne ke sath-sath `git-filter-repo` ya `BFG Repo-Cleaner` se history wipe ki hai
- [ ] **Immediately check karo:** `git log` mein koi secret to nahi gaya?

```bash
# Apne repo mein secrets check karo
git grep -i "password\|secret\|api_key\|token" -- "*.js" "*.ts" "*.env"
```

---

## 📁 SECTION 6: File Upload Security

- [ ] File type validation hai (sirf extension nahi, MIME type bhi check karo)
- [ ] File size limit set hai
- [ ] Uploaded files publicly accessible folder mein nahi hain directly
- [ ] File names sanitize hote hain (path traversal se bachao)
- [ ] Executable files upload nahi ho sakte
- [ ] Upload directory mein script execution (like PHP, JS, .sh) strictly block hai web-server level (Nginx/Apache/IIS) pe
- [ ] Virus scanning integrate hai (production ke liye)
- [ ] **Example:**
  ```javascript
  // ❌ GALAT - sirf extension check
  if (file.name.endsWith('.jpg')) { ... }
  
  // ✅ SAHI - MIME type check + sanitize name
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.mimetype)) {
    throw new Error('Invalid file type')
  }
  const safeName = `${Date.now()}-${crypto.randomUUID()}.jpg` // original name discard
  ```

---

## 🍪 SECTION 7: Cookies & Frontend Security

- [ ] Sensitive data cookies mein `HttpOnly` flag hai (JS se access nahi hogi)
- [ ] Cookies mein `Secure` flag hai (sirf HTTPS pe jayengi)
- [ ] `SameSite=Strict` ya `SameSite=Lax` set hai (CSRF se bachao)
- [ ] LocalStorage mein JWT ya passwords **nahi** hain (XSS ka khatra)
- [ ] Sensitive user data browser console mein log nahi ho raha

---

## 🔄 SECTION 8: CSRF (Cross-Site Request Forgery)

- [ ] State-changing endpoints (POST/PUT/DELETE) CSRF protection rakhte hain
- [ ] CSRF token implement hai ya SameSite cookies use ho rahi hain
- [ ] `GET` requests se koi data delete/change nahi hota

---

## 🚨 SECTION 9: Error Handling & Logging

### 9.1 Error Messages
- [ ] Production mein stack traces user ko nahi dikhti
- [ ] Database error details user ko expose nahi hote
- [ ] Generic error messages use hote hain frontend pe
- [ ] **Example:**
  ```javascript
  // ❌ GALAT - sensitive info leak
  res.status(500).json({ error: err.message, stack: err.stack })
  
  // ✅ SAHI
  console.error(err) // server pe log karo
  res.status(500).json({ error: 'Something went wrong' }) // user ko generic
  ```

### 9.2 Logging
- [ ] Important actions log hote hain (login, logout, data changes)
- [ ] Logs mein passwords ya tokens nahi hain
- [ ] Logs mein PII (Personally Identifiable Information like email, phones) ko mask/redact kiya gaya hai
- [ ] Log files server pe secure location pe hain
- [ ] Error monitoring tool use ho raha hai (Sentry, etc.)

---

## 🌍 SECTION 10: HTTPS & Network Security

- [ ] Production app HTTPS use karta hai (HTTP nahi)
- [ ] HTTP requests automatically HTTPS pe redirect hoti hain
- [ ] SSL certificate valid hai aur expire nahi hua
- [ ] API calls frontend se HTTPS pe hoti hain

---

## 📦 SECTION 11: Dependencies & Supply Chain

- [ ] `npm audit` run kiya aur critical vulnerabilities fix ki hain
- [ ] Dependencies regularly update hoti hain
- [ ] Koi unknown/untrusted package install nahi ki
- [ ] `package-lock.json` committed hai (exact versions lock hain)

```bash
# Run these commands
npm audit
npm audit fix
npx npm-check-updates  # outdated packages dekhne ke liye
```

---

## 🚀 SECTION 12: Deployment & Production Checklist

- [ ] `NODE_ENV=production` set hai
- [ ] Debug mode off hai
- [ ] Development-only routes/endpoints remove ya disable hain
- [ ] Test accounts aur dummy data production database mein nahi hain
- [ ] `.env` file server pe properly set hai
- [ ] Database migrations run ho gayi hain
- [ ] Health check endpoint hai (`/api/health`)
- [ ] Graceful shutdown implement hai
- [ ] Process manager use ho raha hai (PM2, Docker, etc.)
- [ ] Monitoring aur alerts set hain

---

## ⚡ SECTION 13: Performance & DoS Prevention

- [ ] Database queries mein pagination hai (sab records ek saath nahi)
- [ ] Expensive operations cached hain (Redis/memory cache)
- [ ] File downloads streaming se serve hote hain
- [ ] Request timeout set hai
- [ ] Max payload size limit hai

---

## 🔍 SECTION 14: Quick Security Scan (Deploy Se Pehle)

Ye commands run karo aur output check karo:

```bash
# 1. Secrets check karo git history mein
git log --all --full-history -- "*.env"

# 2. Hardcoded credentials dhundo
grep -r "password\s*=\s*['\"]" src/ --include="*.js" --include="*.ts"
grep -r "secret\s*=\s*['\"]" src/ --include="*.js" --include="*.ts"

# 3. npm vulnerabilities
npm audit --audit-level=high

# 4. .gitignore mein .env hai?
cat .gitignore | grep ".env"

# 5. Koi console.log sensitive data to nahi?
grep -r "console.log" src/ | grep -i "password\|token\|secret"
```

---

## 🆘 COMMON VIBE-CODED PROJECT ISSUES

Ye issues aksar AI-generated projects mein hote hain — **zaroor check karo:**

| Issue | Kahan check karo |
|-------|-----------------|
| JWT secret = `"secret"` ya `"mysecret"` | `.env` ya auth config file |
| CORS `origin: '*'` | server/index.js ya app.js |
| No rate limiting on login | auth routes |
| Passwords in plain text | user model / register route |
| SQL/NoSQL injection | any DB query with user input |
| Error stack traces in response | error handler middleware |
| Missing authorization checks | every API route |
| `.env` in git history | `git log --all -- .env` |
| No input validation | all POST/PUT endpoints |
| HTTP in production | deployment config |

---

## 📚 RESOURCES

- [OWASP Top 10](https://owasp.org/www-project-top-ten/) — Sabse common vulnerabilities
- [Node.js Security Checklist](https://nodejs.org/en/docs/guides/security/)
- [Helmet.js Docs](https://helmetjs.github.io/)
- [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit)

---

*Last Updated: 2025 | Ye checklist full-stack internship projects ke liye banaya gaya hai*
