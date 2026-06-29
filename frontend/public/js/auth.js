// UniHostel — Authentication Logic

let selectedRegRole = 'student';

function showAuth(tab = 'login') {
  const landing = document.getElementById('landing-screen');
  const auth = document.getElementById('auth-screen');

  if (landing && landing.style.display !== 'none') {
    anime({
      targets: '#landing-screen',
      opacity: [1, 0],
      translateY: [0, -20],
      duration: 400,
      easing: 'easeInQuad',
      complete: () => {
        document.body.classList.remove('landing-mode');
        document.body.classList.add('auth-mode');
        landing.style.display = 'none';
        if (auth) {
          auth.style.display = 'grid';
          switchAuthTab(tab);
          
          if (window.app3D) {
            window.app3D._resize();
          }
          startAuthCarousel();

          anime.timeline({
            easing: 'easeOutQuart'
          })
          .add({
            targets: '.auth-brand-pane',
            opacity: [0, 1],
            duration: 600
          })
          .add({
            targets: '.auth-form-pane',
            opacity: [0, 1],
            translateX: [30, 0],
            duration: 600
          }, '-=400');
        }
      }
    });
  } else {
    document.body.classList.remove('landing-mode');
    document.body.classList.add('auth-mode');
    if (landing) landing.style.display = 'none';
    if (auth) {
      auth.style.display = 'grid';
      switchAuthTab(tab);
      if (window.app3D) {
        window.app3D._resize();
      }
      startAuthCarousel();
    }
  }
}

function goBackToLanding() {
  const auth = document.getElementById('auth-screen');
  
  if (auth && auth.style.display !== 'none') {
    stopAuthCarousel();
    anime({
      targets: '#auth-screen',
      opacity: [1, 0],
      duration: 450,
      easing: 'easeInQuad',
      complete: () => {
        document.body.classList.remove('auth-mode');
        document.body.classList.add('landing-mode');
        window.location.reload();
      }
    });
  } else {
    window.location.reload();
  }
}

function switchAuthTab(t) {
  const indicator = document.getElementById('tab-indicator');
  if (indicator) {
    indicator.style.transform = t === 'login' ? 'translateX(0)' : 'translateX(100%)';
  }

  document.querySelectorAll('.m-tab').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-tab') === t);
  });

  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  if (t === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    
    anime({
      targets: '#login-form > *',
      opacity: [0, 1],
      translateY: [10, 0],
      delay: anime.stagger(25),
      duration: 350,
      easing: 'easeOutQuad'
    });
  } else {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');

    anime({
      targets: '#register-form > *',
      opacity: [0, 1],
      translateY: [10, 0],
      delay: anime.stagger(25),
      duration: 350,
      easing: 'easeOutQuad'
    });
  }
  
  if (t === 'register') {
      if (!window.regDataLoaded) {
          loadRegData();
      } else {
          checkWardenStatus().then(() => {
              switchRegRole(selectedRegRole);
          });
      }
  }
}

async function checkWardenStatus() {
    try {
        const res = await fetch(`${API}/auth/admin/warden-check`);
        const data = await res.json();
        window.wardenExists = data.exists;
    } catch(e) {
        console.error('Failed to check warden status', e);
        window.wardenExists = false;
    }
}

async function loadRegData() {
    try {
        await checkWardenStatus();
        const [rolesRes, hallsRes, deptsRes] = await Promise.all([
            fetch(`${API}/auth/admin/roles`),
            fetch(`${API}/halls`),
            fetch(`${API}/departments`)
        ]);
        const roles = await rolesRes.json();
        const halls = await hallsRes.json();
        const depts = await deptsRes.json();
        
        window.departments = depts;
        
        const roleSel = document.getElementById('reg-role');
        if (roleSel) {
            const wardenRole = roles.find(r => r.RoleName === 'Warden');
            if (wardenRole) {
                roleSel.innerHTML = `<option value="${wardenRole.RoleID}" selected>${wardenRole.RoleName}</option>`;
            } else {
                roleSel.innerHTML = '<option value="">Select Role...</option>';
            }
        }
        
        const hallSel = document.getElementById('reg-hall');
        if (hallSel) {
            hallSel.innerHTML = '<option value="">None (Optional)</option>' + halls.map(h => `<option value="${h.HallID}">${h.HallName}</option>`).join('');
        }
        
        const deptSel = document.getElementById('reg-dept');
        if (deptSel) {
            deptSel.innerHTML = '<option value="" disabled selected hidden></option>' + depts.map(d => `<option value="${d.DeptName}">${d.DeptName}</option>`).join('');
        }
        
        switchRegRole(selectedRegRole);
        window.regDataLoaded = true;
    } catch(e) {
        console.error('Failed to load reg data', e);
    }
}

function switchRole(r) {
  selectedRole = r;
  document.querySelectorAll('#login-form .m-role').forEach((b, i) => b.classList.toggle('active', r === 'student' ? i === 0 : i === 1));
  document.querySelectorAll('#login-form .login-student-only').forEach(el => el.classList.toggle('hidden', r !== 'student'));

  anime({
    targets: '#login-form .f-group, #login-form .btn-auth-modern',
    opacity: [0.3, 1],
    translateY: [6, 0],
    delay: anime.stagger(25),
    duration: 300,
    easing: 'easeOutQuad'
  });
}

function switchRegRole(r) {
  selectedRegRole = r;
  document.querySelectorAll('#register-form .m-role').forEach((b, i) => b.classList.toggle('active', r === 'student' ? i === 0 : i === 1));
  
  const isWardenBlocked = (r === 'admin' && window.wardenExists);
  
  const warning = document.getElementById('warden-exists-warning');
  if (warning) warning.classList.toggle('hidden', !isWardenBlocked);
  
  const nameRow = document.getElementById('reg-row-name');
  const emailGroup = document.getElementById('reg-group-email');
  const passPhoneRow = document.getElementById('reg-row-passphone');
  const submitBtn = document.getElementById('reg-submit-btn');
  const adminInputs = document.querySelector('.admin-fields-inputs');
  
  if (nameRow) nameRow.classList.toggle('hidden', isWardenBlocked);
  if (emailGroup) emailGroup.classList.toggle('hidden', isWardenBlocked);
  if (passPhoneRow) passPhoneRow.classList.toggle('hidden', isWardenBlocked);
  if (submitBtn) submitBtn.classList.toggle('hidden', isWardenBlocked);
  if (adminInputs) {
      adminInputs.classList.toggle('hidden', r !== 'admin' || isWardenBlocked);
  }
  
  document.querySelectorAll('.student-only').forEach(el => el.classList.toggle('hidden', r !== 'student'));
  document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', r !== 'admin'));
  
  const emailInput = document.getElementById('reg-email');
  if (emailInput) {
    emailInput.placeholder = r === 'student' ? 'username@students.edu.pk' : 'username@admin.edu.pk';
  }

  anime({
    targets: '#register-form .f-group, #register-form .btn-auth-modern, #register-form .f-row',
    opacity: [0.3, 1],
    translateY: [6, 0],
    delay: anime.stagger(25),
    duration: 300,
    easing: 'easeOutQuad'
  });
}

async function handleLogin() {
  const email = document.getElementById('login-email').value;
  const pass = document.getElementById('login-password').value;
  const regNumber = document.getElementById('login-reg-number').value;

  if (selectedRole === 'student' && !regNumber) {
    return toast('Please fill in all fields, including Registration No.', 'error');
  }
  if (!email || !pass) {
    return toast('Please fill in all fields', 'error');
  }

  const showWelcomeAnimation = (userName) => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const welcomeMsg = document.getElementById('welcome-message-3d');
    const nameEl = document.getElementById('welcome-user-name');
    const authTabs = document.querySelector('.auth-tabs-pill');

    if (loginForm) loginForm.classList.add('hidden');
    if (registerForm) registerForm.classList.add('hidden');
    if (authTabs) authTabs.classList.add('hidden');

    if (welcomeMsg && nameEl) {
      nameEl.innerText = userName;
      welcomeMsg.classList.remove('hidden');

      anime({
        targets: '#welcome-message-3d',
        opacity: [0, 1],
        scale: [0.8, 1],
        rotateX: [-30, 0],
        translateY: [20, 0],
        duration: 1200,
        easing: 'easeOutElastic(1, .8)',
        complete: () => {
          setTimeout(() => {
            anime({
              targets: '.auth-card',
              opacity: [1, 0],
              scale: [1, 0.9],
              translateY: [0, -30],
              duration: 600,
              easing: 'easeInQuad',
              complete: () => {
                initApp();
              }
            });
          }, 1500);
        }
      });
    } else {
      initApp();
    }
  };

  try {
    const payload = { email, password: pass };
    if (selectedRole === 'student') {
      payload.regNumber = regNumber;
    }

    const res = await fetch(`${API}/auth/${selectedRole}/login`, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 403 && data.unverified) {
        window.unverifiedEmail = data.email;
        const emailLabel = document.getElementById('verification-email-label');
        if (emailLabel) emailLabel.innerText = data.email;
        
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.add('hidden');
        document.querySelector('.auth-tabs-pill').classList.add('hidden');
        document.getElementById('otp-verification-form').classList.remove('hidden');

        if (data.autofillOtp) {
          const otpField = document.getElementById('otp-code');
          if (otpField) otpField.value = data.autofillOtp;
        }

        return toast(data.error, 'info');
      }
      return toast(data.error || 'Login failed', 'error');
    }
    if (data.token) {
      localStorage.setItem('jwt_token', data.token);
    }
    currentUser = data.user; currentRole = data.role;
    toast(`Welcome, ${currentUser.FullName}!`, 'success');
    showWelcomeAnimation(currentUser.FullName);
  } catch (e) {
    // DEMO MODE FALLBACK
    if (selectedRole === 'admin' && email === 'admin@hostel.edu.pk' && pass === 'admin123') {
      currentUser = { AdminID: 1, FullName: 'Demo Admin', Email: email, RoleID: 1 };
      currentRole = 'admin';
      toast('Demo Mode: Admin Login (Backend Offline)', 'info');
      showWelcomeAnimation(currentUser.FullName);
    } else if (selectedRole === 'student' && email && pass) {
      currentUser = { StudentID: 1, FullName: 'Demo Student', Email: email, CGPA: 3.5, Department: 'CS', Semester: 4 };
      currentRole = 'student';
      toast('Demo Mode: Student Login (Backend Offline)', 'info');
      showWelcomeAnimation(currentUser.FullName);
    } else {
      toast('Network error connecting to API or Invalid demo credentials', 'error');
    }
  }
}

async function handleRegister() {
  if (selectedRegRole === 'student') {
    const ids = ['reg-number', 'reg-name', 'reg-email', 'reg-password', 'reg-phone', 'reg-cgpa', 'reg-semester', 'reg-dept'];
    const v = ids.map(id => document.getElementById(id).value);
    if (v.some(x => !x)) return toast('Please fill all fields', 'error');

    const payload = {
      regNumber: v[0],
      fullName: v[1],
      email: v[2].trim().toLowerCase(),
      password: v[3],
      phone: v[4],
      cgpa: parseFloat(v[5]),
      semester: parseInt(v[6]),
      department: v[7]
    };

    // --- DOMAIN ENFORCEMENT ---
    if (!payload.email.endsWith('@students.edu.pk')) {
        return toast('Invalid Domain! Student emails must end with @students.edu.pk', 'error');
    }
    // --------------------------

    // --- REGISTRATION NUMBER VALIDATION ---
    const regRegex = /^(\d{4})[-_]([A-Za-z]{2,4})[-_](\d{3,})$/;
    const regMatch = payload.regNumber.match(regRegex);
    if (!regMatch) {
        return toast('Registration number must follow the format YYYY-DEPT-NUM (e.g., 2024-CS-012, 2023-SE_030)', 'error');
    }
    const enteredDeptCode = regMatch[2].toUpperCase();

    // Verify enteredDeptCode exists as an active department in the loaded departments
    const activeDepts = window.departments || [];
    const matchedDeptByCode = activeDepts.find(d => d.DeptCode.trim().toUpperCase() === enteredDeptCode);
    if (!matchedDeptByCode) {
        return toast(`Invalid department abbreviation '${enteredDeptCode}' in registration number!`, 'error');
    }

    // Lookup selected department from Name
    const selectedDept = activeDepts.find(d => d.DeptName === payload.department);
    if (!selectedDept) {
        return toast('Selected department not found or is inactive', 'error');
    }

    // Verify entered code matches the selected department's code
    if (selectedDept.DeptCode.trim().toUpperCase() !== enteredDeptCode) {
        return toast(`Department mismatch! Registration number '${payload.regNumber}' does not match selected department '${payload.department}'.`, 'error');
    }
    // --------------------------------------

    // --- FRONTEND ACADEMIC PERIOD CHECK ---
    const currentMonth = new Date().getMonth() + 1;
    const isEvenPeriod = (currentMonth >= 1 && currentMonth <= 6);
    const isStudentSemesterEven = (payload.semester % 2 === 0);
    
    if (isEvenPeriod && !isStudentSemesterEven) {
        return toast(`Duration mismatch! Current session (Jan-Jun) only allows EVEN semesters (2, 4, 6, 8).`, 'error');
    }
    if (!isEvenPeriod && isStudentSemesterEven) {
        return toast(`Duration mismatch! Current session (Jul-Dec) only allows ODD semesters (1, 3, 5, 7).`, 'error');
    }
    // -------------------------------------

    try {
      const res = await fetch(`${API}/auth/student/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) return toast(data.error || 'Registration failed', 'error');

      window.unverifiedEmail = payload.email;
      const emailLabel = document.getElementById('verification-email-label');
      if (emailLabel) emailLabel.innerText = payload.email;
      
      document.getElementById('login-form').classList.add('hidden');
      document.getElementById('register-form').classList.add('hidden');
      document.querySelector('.auth-tabs-pill').classList.add('hidden');
      document.getElementById('otp-verification-form').classList.remove('hidden');

      if (data.autofillOtp) {
        const otpField = document.getElementById('otp-code');
        if (otpField) otpField.value = data.autofillOtp;
      }

      toast(data.message || 'Registration complete. Verify code sent to your email.', 'success');
    } catch (e) {
      toast('Network error connecting to API', 'error');
    }
  } else {
    // Admin registration
    const ids = ['reg-name', 'reg-email', 'reg-password', 'reg-phone', 'reg-role'];
    const v = ids.map(id => document.getElementById(id).value);
    if (v.some(x => !x)) return toast('Please fill all required fields', 'error');

    if (window.wardenExists && parseInt(v[4]) === 2) {
      return toast('Warden registration is closed. An active Warden already exists.', 'error');
    }

    const payload = {
      fullName: v[0],
      email: v[1].trim().toLowerCase(),
      password: v[2],
      phone: v[3],
      roleId: parseInt(v[4]),
      hallId: null
    };

    // --- DOMAIN ENFORCEMENT ---
    if (!payload.email.endsWith('@admin.edu.pk')) {
        return toast('Invalid Domain! Admin emails must end with @admin.edu.pk', 'error');
    }
    // --------------------------

    try {
      const res = await fetch(`${API}/auth/admin/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) return toast(data.error || 'Registration failed', 'error');

      window.unverifiedEmail = payload.email;
      const emailLabel = document.getElementById('verification-email-label');
      if (emailLabel) emailLabel.innerText = payload.email;
      
      document.getElementById('login-form').classList.add('hidden');
      document.getElementById('register-form').classList.add('hidden');
      document.querySelector('.auth-tabs-pill').classList.add('hidden');
      document.getElementById('otp-verification-form').classList.remove('hidden');

      if (data.autofillOtp) {
        const otpField = document.getElementById('otp-code');
        if (otpField) otpField.value = data.autofillOtp;
      }

      toast(data.message || 'Registration complete. Verify code sent to your email.', 'success');
    } catch (e) {
      toast('Network error connecting to API', 'error');
    }
  }
}

function logout() {
  currentUser = null; currentRole = null;
  localStorage.removeItem('jwt_token');
  window.location.reload();
}

/* ── PASSWORD TOGGLE VISIBILITY ── */
function togglePasswordVisibility(id) {
  const input = document.getElementById(id);
  if (!input) return;
  const btn = input.nextElementSibling;
  if (!btn) return;
  
  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      </svg>
    `;
  } else {
    input.type = 'password';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    `;
  }
}

/* ── PASSWORD STRENGTH VALIDATOR ── */
function validatePasswordStrength(val) {
  const box = document.getElementById('password-strength-box');
  if (!box) return;
  if (!val) {
    box.classList.add('hidden');
    return;
  }
  box.classList.remove('hidden');

  const hasLen = val.length >= 8;
  const hasLet = /[a-zA-Z]/.test(val);
  const hasNum = /[0-9]/.test(val);

  const chkLen = document.getElementById('chk-len');
  const chkLet = document.getElementById('chk-let');
  const chkNum = document.getElementById('chk-num');

  if (chkLen) chkLen.className = hasLen ? 'valid' : 'invalid';
  if (chkLet) chkLet.className = hasLet ? 'valid' : 'invalid';
  if (chkNum) chkNum.className = hasNum ? 'valid' : 'invalid';

  let strength = 0;
  if (hasLen) strength += 33.3;
  if (hasLet) strength += 33.3;
  if (hasNum) strength += 33.4;

  const fill = document.getElementById('strength-bar-fill');
  if (fill) {
    fill.style.width = strength + '%';
    if (strength < 40) fill.style.backgroundColor = '#ef4444';
    else if (strength < 80) fill.style.backgroundColor = '#eab308';
    else fill.style.backgroundColor = '#10b981';
  }
}

/* ── BRANDING SLIDESHOW CAROUSEL ── */
let carouselIndex = 0;
let carouselInterval = null;

function startAuthCarousel() {
  stopAuthCarousel();
  setCarouselSlide(0);
  carouselInterval = setInterval(() => {
    setCarouselSlide((carouselIndex + 1) % 3);
  }, 4000);
}

function stopAuthCarousel() {
  if (carouselInterval) {
    clearInterval(carouselInterval);
    carouselInterval = null;
  }
}

function setCarouselSlide(idx) {
  carouselIndex = idx;
  const slides = document.querySelectorAll('.carousel-slide');
  const dots = document.querySelectorAll('.carousel-dots .dot');

  slides.forEach((slide, i) => {
    slide.classList.toggle('active', i === idx);
  });
  dots.forEach((dot, i) => {
    dot.classList.toggle('active', i === idx);
  });
}

/* ── SECURE XSS HTML ESCAPER ── */
function sanitizeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/* ── FORGOT PASSWORD FLOWS ── */
function showForgotPasswordForm() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.add('hidden');
  document.querySelector('.auth-tabs-pill').classList.add('hidden');
  document.getElementById('otp-verification-form').classList.add('hidden');
  
  document.getElementById('forgot-password-form').classList.remove('hidden');
  document.getElementById('recovery-step-email').classList.remove('hidden');
  document.getElementById('recovery-step-verify').classList.add('hidden');
  document.getElementById('forgot-email').value = '';
}

function cancelForgotPassword() {
  document.getElementById('forgot-password-form').classList.add('hidden');
  
  document.getElementById('login-form').classList.remove('hidden');
  document.querySelector('.auth-tabs-pill').classList.remove('hidden');
}

async function handleForgotRequest() {
  const email = document.getElementById('forgot-email').value.trim();
  if (!email) return toast('Please enter your registered email address', 'error');

  try {
    const res = await fetch(`${API}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) return toast(data.error || 'Failed to dispatch reset code', 'error');

    toast(data.message || 'Recovery code sent to your email.', 'success');
    window.recoveryEmail = email;
    
    // Toggle recovery steps
    document.getElementById('recovery-step-email').classList.add('hidden');
    document.getElementById('recovery-step-verify').classList.remove('hidden');
    document.getElementById('forgot-otp').value = '';
    document.getElementById('forgot-new-password').value = '';
  } catch (err) {
    toast('Network error requesting password reset', 'error');
  }
}

async function handlePasswordReset() {
  const email = window.recoveryEmail;
  const otpCode = document.getElementById('forgot-otp').value.trim();
  const newPassword = document.getElementById('forgot-new-password').value;

  if (!otpCode || !newPassword) {
    return toast('Please fill in all fields', 'error');
  }

  try {
    const res = await fetch(`${API}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otpCode, newPassword })
    });
    const data = await res.json();
    if (!res.ok) return toast(data.error || 'Failed to reset password', 'error');

    toast(data.message || 'Password reset successfully! Please log in.', 'success');
    cancelForgotPassword();
  } catch (err) {
    toast('Network error resetting password', 'error');
  }
}

/* ── OTP REGISTRATION VERIFICATION ── */
async function handleOtpVerification() {
  const email = window.unverifiedEmail;
  const otpCode = document.getElementById('otp-code').value.trim();

  if (!email || !otpCode) {
    return toast('Please enter the 6-digit verification code', 'error');
  }

  try {
    const res = await fetch(`${API}/auth/verify-registration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otpCode })
    });
    const data = await res.json();
    if (!res.ok) return toast(data.error || 'Verification failed', 'error');

    toast(data.message || 'Verification successful! You can now log in.', 'success');
    
    // Redirect to login screen
    document.getElementById('otp-verification-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
    document.querySelector('.auth-tabs-pill').classList.remove('hidden');
    
    // Autofill email
    document.getElementById('login-email').value = email;
  } catch (err) {
    toast('Network error verifying registration OTP', 'error');
  }
}

async function handleResendOtp() {
  const email = window.unverifiedEmail;
  if (!email) return toast('User email is missing', 'error');

  const btn = document.getElementById('btn-resend-otp');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`${API}/auth/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) {
      if (btn) btn.disabled = false;
      return toast(data.error || 'Failed to resend code', 'error');
    }

    toast(data.message || 'Verification code resent successfully.', 'success');
    
    // Implement standard resend throttle cooldown (30 seconds)
    let countdown = 30;
    const interval = setInterval(() => {
      countdown--;
      if (countdown <= 0) {
        clearInterval(interval);
        if (btn) {
          btn.disabled = false;
          btn.innerText = 'Resend Code';
        }
      } else {
        if (btn) btn.innerText = `Resend Code (${countdown}s)`;
      }
    }, 1000);

  } catch (err) {
    if (btn) btn.disabled = false;
    toast('Network error requesting new OTP code', 'error');
  }
}

/* ── GOOGLE / MICROSOFT SSO AUTHENTICATION MOCKS ── */
async function handleSSOLogin(provider) {
  const defaultEmail = provider === 'google' ? 'student@students.edu.pk' : 'warden@admin.edu.pk';
  const emailInput = prompt(`Simulate ${provider === 'google' ? 'Google' : 'Microsoft'} Sign In.\nEnter institutional email address:`, defaultEmail);
  if (!emailInput) return;
  
  const email = emailInput.trim().toLowerCase();
  if (provider === 'google' && !email.endsWith('@students.edu.pk') && !email.endsWith('@admin.edu.pk')) {
    return toast('Access Denied: Google SSO requires @students.edu.pk or @admin.edu.pk address.', 'error');
  }
  if (provider === 'microsoft' && !email.endsWith('@students.edu.pk') && !email.endsWith('@admin.edu.pk')) {
    return toast('Access Denied: Microsoft SSO requires @students.edu.pk or @admin.edu.pk address.', 'error');
  }

  try {
    const res = await fetch(`${API}/auth/sso-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, fullName: email.split('@')[0].toUpperCase(), provider })
    });
    const data = await res.json();
    if (!res.ok) return toast(data.error || 'SSO Sign In failed', 'error');

    if (data.token) {
      localStorage.setItem('jwt_token', data.token);
    }
    currentUser = data.user; currentRole = data.role;
    toast(`Signed in successfully with ${provider === 'google' ? 'Google' : 'Microsoft'}!`, 'success');
    
    // Hide forms and show welcome
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.querySelector('.auth-tabs-pill').classList.add('hidden');
    
    const welcomeMsg = document.getElementById('welcome-message-3d');
    const nameEl = document.getElementById('welcome-user-name');
    if (welcomeMsg && nameEl) {
      nameEl.innerText = currentUser.FullName;
      welcomeMsg.classList.remove('hidden');
      setTimeout(() => {
        initApp();
      }, 1500);
    } else {
      initApp();
    }
  } catch (err) {
    toast('Network error connecting to SSO provider API', 'error');
  }
}