/**
 * ============================================================
 * SUPER ADMIN AUTHENTICATION & SECURITY CONTROLLER
 * Supabase Auth Integration + Role Enforcement (super_admin)
 * ============================================================
 */
window.SuperAdminAuth = {
  sessionKey: 'super_admin_session',
  failedAttemptsKey: 'super_admin_failed_attempts',

  /**
   * Get Supabase credentials from LocalStorage or Default Config
   */
  getSupabaseConfig() {
    const custom = JSON.parse(localStorage.getItem('super_admin_supabase_config') || '{}');
    return {
      url: custom.url || 'https://pos-subscription-system.supabase.co',
      anonKey: custom.anonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbmdlbCIsImV4cCI6MTk4MzM1NTIwMH0.sampleKey'
    };
  },

  /**
   * Check Rate Limiting for Login Attempts
   */
  checkRateLimit() {
    const attempts = JSON.parse(localStorage.getItem(this.failedAttemptsKey) || '{"count":0, "lockoutUntil":0}');
    const now = Date.now();

    if (attempts.lockoutUntil && now < attempts.lockoutUntil) {
      const remainingSeconds = Math.ceil((attempts.lockoutUntil - now) / 1000);
      throw new Error(`Too many failed login attempts. Please wait ${remainingSeconds} seconds.`);
    }

    if (attempts.lockoutUntil && now >= attempts.lockoutUntil) {
      localStorage.setItem(this.failedAttemptsKey, JSON.stringify({ count: 0, lockoutUntil: 0 }));
    }
  },

  /**
   * Record Failed Login Attempt
   */
  recordFailedAttempt() {
    const attempts = JSON.parse(localStorage.getItem(this.failedAttemptsKey) || '{"count":0, "lockoutUntil":0}');
    attempts.count += 1;

    if (attempts.count >= 5) {
      attempts.lockoutUntil = Date.now() + (5 * 60 * 1000); // 5 minute lockout
    }

    localStorage.setItem(this.failedAttemptsKey, JSON.stringify(attempts));
  },

  /**
   * Reset Failed Attempt Counter on Successful Login
   */
  resetFailedAttempts() {
    localStorage.removeItem(this.failedAttemptsKey);
  },

  /**
   * Super Admin Login Engine
   */
  async login(email, password) {
    this.checkRateLimit();

    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || '').trim();

    if (!cleanEmail || !cleanPassword) {
      throw new Error('Email and password are required.');
    }

    // Default Super Admin credentials for initial setup & demonstration
    if (cleanEmail === 'admin@posbilling.com' && cleanPassword === 'SuperAdmin2026!') {
      this.resetFailedAttempts();
      const mockSession = {
        token: 'jwt_token_super_admin_' + Date.now(),
        user: {
          id: 'usr_super_admin_01',
          email: cleanEmail,
          role: 'super_admin',
          name: 'Chief Admin',
          lastLogin: new Date().toISOString()
        },
        expiresAt: Date.now() + (8 * 60 * 60 * 1000) // 8 Hours Session
      };
      localStorage.setItem(this.sessionKey, JSON.stringify(mockSession));
      
      // Log authentication audit
      window.SuperAdminDB.recordAuditLog({
        action: 'ADMIN_LOGIN_SUCCESS',
        targetBusiness: 'SYSTEM',
        oldValue: 'N/A',
        newValue: `Admin logged in: ${cleanEmail}`
      });

      return mockSession;
    }

    // Try Supabase Auth API if custom credentials provided
    try {
      const config = this.getSupabaseConfig();
      if (window.supabase && config.url) {
        const supabaseClient = window.supabase.createClient(config.url, config.anonKey);
        const { data, error } = await supabaseClient.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword
        });

        if (error) throw error;

        // Verify role claim
        const userRole = data.user?.app_metadata?.role || data.user?.user_metadata?.role || 'super_admin';
        if (userRole !== 'super_admin') {
          throw new Error('Access Denied (HTTP 403): User does not have super_admin permissions.');
        }

        this.resetFailedAttempts();
        const session = {
          token: data.session.access_token,
          user: {
            id: data.user.id,
            email: data.user.email,
            role: userRole,
            name: data.user.user_metadata?.full_name || 'Super Admin'
          },
          expiresAt: Date.now() + (8 * 60 * 60 * 1000)
        };
        localStorage.setItem(this.sessionKey, JSON.stringify(session));
        return session;
      }
    } catch (err) {
      console.warn('Supabase Auth Remote Check failed:', err.message);
    }

    this.recordFailedAttempt();
    
    // Audit failed attempt
    if (window.SuperAdminDB) {
      window.SuperAdminDB.recordAuditLog({
        action: 'ADMIN_LOGIN_FAILED',
        targetBusiness: 'SYSTEM',
        oldValue: 'N/A',
        newValue: `Failed attempt for email: ${cleanEmail}`
      });
    }

    throw new Error('Invalid email or password credentials.');
  },

  /**
   * Verify Current Session & Role Authorization
   */
  isAuthenticated() {
    const raw = localStorage.getItem(this.sessionKey);
    if (!raw) return false;

    try {
      const session = JSON.parse(raw);
      if (Date.now() > session.expiresAt) {
        this.logout();
        return false;
      }
      return session.user && session.user.role === 'super_admin';
    } catch (e) {
      return false;
    }
  },

  /**
   * Get Active Session Info
   */
  getSession() {
    if (!this.isAuthenticated()) return null;
    return JSON.parse(localStorage.getItem(this.sessionKey));
  },

  /**
   * Super Admin Logout
   */
  logout() {
    const session = this.getSession();
    if (session && window.SuperAdminDB) {
      window.SuperAdminDB.recordAuditLog({
        action: 'ADMIN_LOGOUT',
        targetBusiness: 'SYSTEM',
        oldValue: 'ACTIVE',
        newValue: 'LOGGED_OUT'
      });
    }
    localStorage.removeItem(this.sessionKey);
    window.location.hash = '#/login';
  }
};
