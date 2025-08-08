
import { useEffect, useState } from 'react';
import './App.css';
import { onUserChanged, loginWithUsernamePassword, registerWithUsernamePassword } from './firebase';
import emailjs from 'emailjs-com';
import { EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY, ADMIN_EMAIL } from './emailConfig';
import SalaryCalculator from './SalaryCalculator';
import AdminPanel from './AdminPanel';
import { ADMIN_USERNAME } from './adminConfig';
import './modern.css';

function App() {
  // Theme state for dark/light mode
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const [user, setUser] = useState<null | { uid: string; username?: string }>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showCodePrompt, setShowCodePrompt] = useState(false);
  const [pendingCreds, setPendingCreds] = useState<{ username: string; password: string; code: string } | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [showCreatorProfile, setShowCreatorProfile] = useState(false);

  useEffect(() => {
    const unsubscribe = onUserChanged((u) => {
      if (u) {
        // Extract username from email if present
        const email = (u as { email?: string }).email;
        let username = undefined;
        if (email && email.endsWith('@example.com')) {
          username = email.replace('@example.com', '');
          setUser({ uid: u.uid, username });
          localStorage.setItem('username', username);
        } else {
          setUser({ uid: u.uid });
          localStorage.removeItem('username');
        }
      } else {
        setUser(null);
        localStorage.removeItem('username');
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await loginWithUsernamePassword(username, password);
    } catch (e) {
      if (e instanceof Error) setError(e.message || 'Login failed');
      else setError('Login failed');
    }
    setLoading(false);
  };


  // Generate a 6-digit code
  function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  const handleRegister = async () => {
    setLoading(true);
    setError('');
    const code = generateCode();
    try {
      // Send code to admin email
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        {
          to_email: ADMIN_EMAIL,
          username,
          code,
        },
        EMAILJS_PUBLIC_KEY
      );
      setPendingCreds({ username, password, code });
      setShowCodePrompt(true);
    } catch (error) {
      console.error('Registration email error:', error);
      setError('Failed to send approval code. Please try again.');
    }
    setLoading(false);
  };

  const handleCodeSubmit = async () => {
    if (!pendingCreds) return;
    setLoading(true);
    setError('');
    if (inputCode !== pendingCreds.code) {
      setError('Incorrect code. Please check your email and try again.');
      setLoading(false);
      return;
    }
    try {
      await registerWithUsernamePassword(pendingCreds.username, pendingCreds.password);
      setShowCodePrompt(false);
      setPendingCreds(null);
      setInputCode('');
    } catch (e) {
      console.error('Registration error:', e);
      if (e instanceof Error) setError(e.message || 'Registration failed.');
      else setError('Registration failed.');
    }
    setLoading(false);
  };

  return (
    <div className="mg-login-bg">
      {user ? (
        // When user is logged in, show just the component without the login layout
        user?.username === ADMIN_USERNAME ? <AdminPanel /> : <SalaryCalculator />
      ) : (
        // When user is not logged in, show the full login layout
        <div className="mg-main-container">
          <div className="mg-login-card">
            <div className="mg-login-logo">
              <img src="/mg-logo.png" alt="MG Logo" className="mg-logo-image" />
            </div>
            <div className="mg-login-content">
              <h2 className="mg-login-title">WELCOME</h2>
              <div className="mg-login-subtitle">Salary tracker</div>
              
              <div className="mg-login-theme-toggle">
                <button 
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="mg-login-theme-btn"
                  title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                >
                  {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
                </button>
              </div>
              
              {loading ? (
                <div className="mg-login-loading">Loading...</div>
              ) : (
                showCodePrompt ? (
                  <form className="mg-login-form" onSubmit={e => { e.preventDefault(); handleCodeSubmit(); }}>
                    <input
                      type="text"
                      placeholder="Enter code"
                      value={inputCode}
                      onChange={e => setInputCode(e.target.value)}
                      className="mg-login-input"
                      autoFocus
                    />
                    <button type="submit" className="mg-login-btn mg-login-btn-filled">Submit Code</button>
                    {error && <div className="mg-login-error">{error}</div>}
                  </form>
                ) : (
                  <form className="mg-login-form" onSubmit={e => { e.preventDefault(); handleLogin(); }}>
                    <input
                      type="text"
                      placeholder="USER ID"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className="mg-login-input"
                      autoFocus
                    />
                    <input
                      type="password"
                      placeholder="PASSWORD"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      className="mg-login-input"
                    />
                    <div className="mg-login-btnrow">
                      <button
                        type="button"
                        onClick={handleLogin}
                        className="mg-login-btn mg-login-btn-outline"
                      >LOGIN</button>
                      <button
                        type="button"
                        onClick={handleRegister}
                        className="mg-login-btn mg-login-btn-outline"
                      >REGISTER</button>
                    </div>
                    {error && <div className="mg-login-error">{error}</div>}
                  </form>
                )
              )}
            </div>
          </div>

          <div className="mg-creator-section">
            <button 
              className="mg-creator-trigger"
              onClick={() => setShowCreatorProfile(!showCreatorProfile)}
            >
              <span className="mg-creator-icon">👨‍💻</span>
              <span className="mg-creator-text">About the Creator</span>
              <span className={`mg-creator-arrow ${showCreatorProfile ? 'open' : ''}`}>▼</span>
            </button>
            
            {showCreatorProfile && (
              <div className="mg-profile-dropdown">
                <div className="mg-profile-image">
                  <img src="/Screenshot 2025-08-07 225339.png" alt="Micheal George" className="mg-profile-img" />
                </div>
                <div className="mg-profile-content">
                  <div className="mg-profile-handle">@mykl.grge</div>
                  <div className="mg-profile-intro">
                    Hello! I'm Micheal George, an aspiring Data Analyst with a passion for numbers and insights. In my free time, I enjoy coding, designing websites, and creating apps as a hobby. This app is a product of that passion, designed to help you track your daily earnings and manage your finances more effectively. I hope you find it a useful tool on your own financial journey!
                  </div>
                  <div className="mg-profile-signature">Micheal george</div>
                  <div className="mg-profile-website">
                    <a href="https://myklgrge.github.io/data_analyst/" target="_blank" rel="noopener noreferrer">
                      myklgrge.github.io/data_analyst
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <style>{`
        /* Reset any inherited styles */
        html, body {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          width: 100%; /* avoid 100vw white sliver */
          min-height: 100%;
          overflow-x: hidden;
          -webkit-text-size-adjust: 100%;
          background: ${theme === 'dark' ? '#0a0a0a' : '#f8fafc'};
        }
        
        .mg-login-bg {
          min-height: 100svh; /* modern viewport unit */
          min-height: 100vh;
          width: 100%;
          max-width: 100%;
          background: ${theme === 'dark' 
            ? 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 25%, #2a2a2a 50%, #3a3a3a 75%, #4a4a4a 100%)'
            : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 25%, #cbd5e1 50%, #94a3b8 75%, #64748b 100%)'
          };
          background-size: 300% 300%;
          animation: subtleGradient 35s ease infinite;
          display: flex;
          justify-content: center;
          align-items: center;
          font-family: Inter, system-ui, Arial, sans-serif;
          overflow-x: hidden;
          padding: 0 12px; /* small side padding to avoid overflow rounding */
          margin: 0;
          box-sizing: border-box;
          position: fixed;
          inset: 0; /* replace top/left with inset to avoid 100vw rounding */
          padding-bottom: env(safe-area-inset-bottom);
        }
        
        .mg-login-bg::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: ${theme === 'dark' 
            ? `radial-gradient(circle at 15% 15%, rgba(70, 70, 70, 0.4) 0%, transparent 50%),
               radial-gradient(circle at 85% 85%, rgba(50, 50, 50, 0.3) 0%, transparent 50%),
               radial-gradient(circle at 50% 50%, rgba(30, 30, 30, 0.2) 0%, transparent 70%),
               linear-gradient(45deg, rgba(10, 10, 10, 0.3) 0%, transparent 100%)`
            : `radial-gradient(circle at 15% 15%, rgba(255, 255, 255, 0.4) 0%, transparent 50%),
               radial-gradient(circle at 85% 85%, rgba(241, 245, 249, 0.3) 0%, transparent 50%),
               radial-gradient(circle at 50% 50%, rgba(226, 232, 240, 0.2) 0%, transparent 70%),
               linear-gradient(45deg, rgba(248, 250, 252, 0.3) 0%, transparent 100%)`
          };
          animation: gentleShimmer 45s ease-in-out infinite;
          pointer-events: none;
        }
        
        @keyframes subtleGradient {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        
        @keyframes gentleShimmer {
          0%, 100% {
            opacity: 0.7;
            transform: translateY(0px) scale(1);
          }
          33% {
            opacity: 0.85;
            transform: translateY(-8px) scale(1.02);
          }
          66% {
            opacity: 0.9;
            transform: translateY(-3px) scale(1.01);
          }
        }
        
        .mg-main-container {
          display: flex;
          gap: 60px;
          max-width: 1200px;
          width: 100%;
          align-items: center;
          justify-content: center;
          position: relative;
          z-index: 2;
          padding: 40px 12px;
        }
        
  .mg-login-card {
          background: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.07)' 
            : 'rgba(255, 255, 255, 0.9)'
          };
          backdrop-filter: blur(30px);
          border-radius: 28px;
          box-shadow: ${theme === 'dark' 
            ? '0 12px 40px 0 rgba(0, 0, 0, 0.35), inset 0 2px 0 rgba(255, 255, 255, 0.12), inset 0 -1px 0 rgba(0, 0, 0, 0.1)' 
            : '0 12px 40px 0 rgba(0, 0, 0, 0.1), inset 0 2px 0 rgba(255, 255, 255, 0.8), inset 0 -1px 0 rgba(0, 0, 0, 0.05)'
          };
          flex: 0 0 450px;
          max-width: 450px;
          margin: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          padding: 80px 50px 50px 50px;
          box-sizing: border-box;
          border: 1px solid ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.12)' 
            : 'rgba(30, 41, 59, 0.1)'
          };
          transition: all 0.3s ease;
          overflow: hidden; /* prevent inner overflow on mobile */
        }
        
        .mg-login-card:hover {
          transform: translateY(-2px);
          box-shadow: ${theme === 'dark' 
            ? '0 16px 48px 0 rgba(0, 0, 0, 0.4), inset 0 2px 0 rgba(255, 255, 255, 0.15), inset 0 -1px 0 rgba(0, 0, 0, 0.1)' 
            : '0 16px 48px 0 rgba(0, 0, 0, 0.15), inset 0 2px 0 rgba(255, 255, 255, 0.9), inset 0 -1px 0 rgba(0, 0, 0, 0.05)'
          };
        }
        .mg-login-logo {
          position: absolute;
          top: -30px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 2;
        }
        .mg-logo-placeholder {
          width: 120px;
          height: 120px;
          background: rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(15px);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          font-weight: 800;
          color: #ffffff;
          border: 2px solid rgba(255, 255, 255, 0.2);
          box-shadow: 
            0 12px 40px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
        }
        
        .mg-logo-image {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          object-fit: cover;
          object-position: center;
          transform: none;
          border: 2px solid rgba(255, 255, 255, 0.2);
          box-shadow: 
            0 8px 24px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(15px);
          overflow: hidden;
        }
        
        .mg-login-content {
          margin-top: 20px;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .mg-login-title {
          font-size: 2.2rem;
          font-weight: 800;
          letter-spacing: 3px;
          margin-bottom: 0.3em;
          color: ${theme === 'dark' ? '#ffffff' : '#1e293b'};
          text-align: center;
          text-shadow: ${theme === 'dark' 
            ? '0 2px 8px rgba(0, 0, 0, 0.5)' 
            : '0 2px 8px rgba(0, 0, 0, 0.1)'
          };
        }
        .mg-login-subtitle {
          font-size: 1.1rem;
          color: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.8)' 
            : 'rgba(30, 41, 59, 0.8)'
          };
          font-style: italic;
          margin-bottom: 1.5em;
          text-align: center;
          text-shadow: ${theme === 'dark' 
            ? '0 1px 4px rgba(0, 0, 0, 0.3)' 
            : '0 1px 4px rgba(0, 0, 0, 0.1)'
          };
          font-weight: 300;
        }
        
        .mg-login-theme-toggle {
          display: flex;
          justify-content: center;
          margin-bottom: 2em;
        }
        
        .mg-login-theme-btn {
          background: ${theme === 'dark' 
            ? 'rgba(59, 130, 246, 0.15)' 
            : 'rgba(59, 130, 246, 0.1)'
          };
          backdrop-filter: blur(10px);
          border: 1px solid ${theme === 'dark' 
            ? 'rgba(59, 130, 246, 0.3)' 
            : 'rgba(59, 130, 246, 0.2)'
          };
          border-radius: 10px;
          padding: 6px 12px;
          color: ${theme === 'dark' ? '#ffffff' : '#1e293b'};
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          letter-spacing: 0.3px;
        }
        
        .mg-login-theme-btn:hover {
          background: ${theme === 'dark' 
            ? 'rgba(59, 130, 246, 0.25)' 
            : 'rgba(59, 130, 246, 0.15)'
          };
          border-color: ${theme === 'dark' 
            ? 'rgba(59, 130, 246, 0.5)' 
            : 'rgba(59, 130, 246, 0.3)'
          };
          transform: translateY(-2px);
          box-shadow: ${theme === 'dark' 
            ? '0 8px 25px rgba(0, 0, 0, 0.3)' 
            : '0 8px 25px rgba(0, 0, 0, 0.1)'
          };
        }
        .mg-login-form {
          width: 100%;
          max-width: 320px;
          display: flex;
          flex-direction: column;
          gap: 22px;
          align-items: stretch;
        }
        .mg-login-input {
          border-radius: 16px;
          border: 1px solid ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.2)' 
            : 'rgba(30, 41, 59, 0.2)'
          };
          padding: 18px 24px;
          font-size: 1rem;
          background: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.1)' 
            : 'rgba(255, 255, 255, 0.9)'
          };
          backdrop-filter: blur(10px);
          color: ${theme === 'dark' ? '#ffffff' : '#1e293b'};
          text-align: center;
          font-weight: 500;
          outline: none;
          letter-spacing: 1px;
          transition: all 0.3s ease;
        }
        .mg-login-input:focus {
          border-color: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.4)' 
            : 'rgba(96, 165, 250, 0.5)'
          };
          background: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.15)' 
            : 'rgba(255, 255, 255, 0.95)'
          };
          box-shadow: ${theme === 'dark' 
            ? '0 0 20px rgba(255, 255, 255, 0.1)' 
            : '0 0 20px rgba(96, 165, 250, 0.2)'
          };
        }
        .mg-login-input::placeholder {
          color: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.6)' 
            : 'rgba(30, 41, 59, 0.6)'
          };
          font-weight: 400;
        }
        .mg-login-btnrow {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin-top: 16px;
        }
        .mg-login-btn {
          border-radius: 16px;
          border: 1px solid ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.3)' 
            : 'rgba(30, 41, 59, 0.3)'
          };
          background: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.1)' 
            : 'rgba(255, 255, 255, 0.9)'
          };
          backdrop-filter: blur(10px);
          color: ${theme === 'dark' ? '#ffffff' : '#1e293b'};
          font-size: 0.9rem;
          font-weight: 600;
          padding: 14px 24px;
          cursor: pointer;
          letter-spacing: 1px;
          transition: all 0.3s ease;
          min-width: 110px;
        }
        .mg-login-btn-filled {
          background: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.2)' 
            : 'rgba(96, 165, 250, 0.1)'
          };
          color: ${theme === 'dark' ? '#ffffff' : '#1e40af'};
          border: 1px solid ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.4)' 
            : 'rgba(96, 165, 250, 0.3)'
          };
        }
        .mg-login-btn-outline:hover {
          background: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.2)' 
            : 'rgba(255, 255, 255, 0.95)'
          };
          border-color: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.5)' 
            : 'rgba(30, 41, 59, 0.5)'
          };
          transform: translateY(-2px);
          box-shadow: ${theme === 'dark' 
            ? '0 8px 25px rgba(0, 0, 0, 0.3)' 
            : '0 8px 25px rgba(0, 0, 0, 0.1)'
          };
        }
        .mg-login-btn-filled:hover {
          background: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.25)' 
            : 'rgba(96, 165, 250, 0.2)'
          };
          border-color: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.6)' 
            : 'rgba(96, 165, 250, 0.5)'
          };
          transform: translateY(-2px);
          box-shadow: ${theme === 'dark' 
            ? '0 8px 25px rgba(0, 0, 0, 0.3)' 
            : '0 8px 25px rgba(0, 0, 0, 0.1)'
          };
        }
        .mg-login-error {
          color: #ff6b6b;
          font-weight: 600;
          text-align: center;
          margin-top: 8px;
          background: rgba(255, 107, 107, 0.1);
          padding: 12px 16px;
          border-radius: 12px;
          border: 1px solid rgba(255, 107, 107, 0.2);
          backdrop-filter: blur(10px);
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }
        .mg-login-loading {
          text-align: center;
          color: rgba(255, 255, 255, 0.9);
          font-size: 18px;
          font-weight: 500;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }
        .mg-login-userbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 12px;
          padding: 20px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          backdrop-filter: blur(15px);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }
        .mg-login-userinfo {
          color: rgba(255, 255, 255, 0.9);
          font-weight: 500;
          font-size: 16px;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }
        .mg-login-username {
          color: #ffffff;
          font-weight: 700;
        }
        .mg-login-logout {
          background: rgba(96, 165, 250, 0.2);
          color: #ffffff;
          border-radius: 12px;
          border: 1px solid rgba(96, 165, 250, 0.3);
          padding: 10px 18px;
          font-weight: 600;
          margin-right: 8px;
          cursor: pointer;
          font-size: 14px;
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }
        .mg-login-logout:hover {
          background: rgba(96, 165, 250, 0.3);
          border-color: rgba(96, 165, 250, 0.5);
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
        }
        .mg-login-delete {
          background: rgba(248, 113, 113, 0.2);
          color: #ffffff;
          border-radius: 12px;
          border: 1px solid rgba(248, 113, 113, 0.3);
          padding: 10px 18px;
          font-weight: 600;
          cursor: pointer;
          font-size: 14px;
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }
        .mg-login-delete:hover {
          background: rgba(248, 113, 113, 0.3);
          border-color: rgba(248, 113, 113, 0.5);
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
        }
        
        .mg-creator-section {
          flex: 0 0 480px;
          max-width: 480px;
          position: relative;
          align-self: flex-start;
          margin-top: 40px;
        }
        
        .mg-creator-trigger {
          width: 100%;
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(25px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 22px;
          padding: 22px 28px;
          color: rgba(255, 255, 255, 0.9);
          font-size: 1.05rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
          font-family: 'Segoe UI', 'Inter', 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
        }
        
        .mg-creator-trigger:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.25);
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
        }
        
        .mg-creator-icon {
          font-size: 1.3rem;
          display: flex;
          align-items: center;
        }
        
        .mg-creator-text {
          flex: 1;
          text-align: left;
          letter-spacing: 0.4px;
          font-weight: 600;
        }
        
        .mg-creator-arrow {
          font-size: 0.8rem;
          transition: transform 0.3s ease;
          color: rgba(255, 255, 255, 0.7);
        }
        
        .mg-creator-arrow.open {
          transform: rotate(180deg);
        }
        
        .mg-profile-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          margin-top: 16px;
          background: ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.06)'
            : 'rgba(255, 255, 255, 0.95)'};
          backdrop-filter: blur(30px);
          border: 1px solid ${theme === 'dark' 
            ? 'rgba(255, 255, 255, 0.12)'
            : 'rgba(30, 41, 59, 0.12)'};
          border-radius: 26px;
          box-shadow: 
            0 16px 48px 0 rgba(0, 0, 0, 0.4),
            inset 0 2px 0 rgba(255, 255, 255, 0.1);
          padding: 32px;
          z-index: 10;
          animation: slideDown 0.3s ease;
          color: ${theme === 'dark' ? '#ffffff' : '#1e293b'};
          font-family: 'Segoe UI', 'Inter', 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
          display: flex;
          align-items: center;
          gap: 28px;
          overflow: hidden; /* contain inner overflow */
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .mg-profile-card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(30px);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #ffffff;
          border-radius: 28px;
          box-shadow: 
            0 12px 40px 0 rgba(0, 0, 0, 0.35),
            inset 0 2px 0 rgba(255, 255, 255, 0.08),
            inset 0 -1px 0 rgba(0, 0, 0, 0.1);
          flex: 1;
          max-width: 650px;
          margin: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 45px;
          box-sizing: border-box;
          gap: 30px;
          position: relative;
          overflow: hidden;
          font-family: 'Segoe UI', 'Inter', 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
          font-weight: 500;
          transition: all 0.3s ease;
        }
        
        .mg-profile-card:hover {
          transform: translateY(-2px);
          box-shadow: 
            0 16px 48px 0 rgba(0, 0, 0, 0.4),
            inset 0 2px 0 rgba(255, 255, 255, 0.12),
            inset 0 -1px 0 rgba(0, 0, 0, 0.1);
        }
        
        .mg-profile-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, 
            rgba(255, 255, 255, 0.2) 0%, 
            rgba(255, 255, 255, 0.1) 50%, 
            rgba(255, 255, 255, 0.05) 100%);
          pointer-events: none;
          z-index: 1;
        }
        
        .mg-profile-image {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(15px);
          border: 2px solid rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          z-index: 2;
          box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          flex-shrink: 0;
        }
        
        .mg-profile-placeholder {
          width: 80px;
          height: 80px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(8px);
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        }
        
        .mg-profile-img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }
        
        .mg-profile-content {
          text-align: left;
          flex: 1;
          position: relative;
          z-index: 2;
        }
        
        .mg-profile-handle {
          font-size: 1.1rem;
          color: ${theme === 'dark' ? '#ffffff' : '#0f172a'};
          margin-bottom: 12px;
          font-weight: 700;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
          letter-spacing: 0.5px;
          text-transform: uppercase;
          font-family: 'Segoe UI', 'Inter', 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
        }
        
        .mg-profile-intro {
          font-size: 0.95rem;
          line-height: 1.6;
          color: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(30, 41, 59, 0.9)'};
          margin-bottom: 16px;
          text-align: left;
          background: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.98)'};
          padding: 16px;
          border-radius: 14px;
          backdrop-filter: blur(10px);
          border: 1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(30, 41, 59, 0.12)'};
          font-weight: 400;
          font-family: 'Segoe UI', 'Inter', 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
          text-shadow: ${theme === 'dark' ? '0 1px 2px rgba(0, 0, 0, 0.3)' : 'none'};
          overflow-wrap: anywhere;
        }
        
        .mg-profile-signature {
          font-family: 'Segoe UI', 'Inter', 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
          font-size: 1rem;
          color: ${theme === 'dark' ? '#ffffff' : '#0f172a'};
          margin-bottom: 12px;
          font-weight: 600;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
          font-style: italic;
          letter-spacing: 0.5px;
        }
        
        .mg-profile-website {
          margin-top: 8px;
        }
        
        .mg-profile-website a {
          color: ${theme === 'dark' ? '#ffffff' : '#1e293b'};
          text-decoration: none;
          font-size: 0.85rem;
          background: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.98)'};
          backdrop-filter: blur(10px);
          border: 1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(30, 41, 59, 0.12)'};
          padding: 12px 20px;
          border-radius: 12px;
          transition: all 0.3s ease;
          display: inline-block;
          font-weight: 600;
          text-shadow: ${theme === 'dark' ? '0 1px 3px rgba(0, 0, 0, 0.3)' : 'none'};
          letter-spacing: 0.2px;
          font-family: 'Segoe UI', 'Inter', 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
          text-transform: uppercase;
          overflow-wrap: anywhere;
        }
        
        .mg-profile-website a:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.25);
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
          color: #ffffff;
        }
        
        @media (max-width: 900px) {
          .mg-main-container {
            flex-direction: column;
            max-width: 500px;
            gap: 30px;
            padding: 12px;
          }
          
          .mg-login-bg {
            padding: 10px 8px;
          }
          
          .mg-login-card {
            flex: none;
            max-width: 100%;
            padding: 48px 20px 28px 20px;
          }
          
          .mg-creator-section {
            max-width: 100%;
            margin-top: 0;
            align-self: stretch;
          }
          
          .mg-profile-dropdown {
            position: relative;
            top: 0;
            margin-top: 20px;
            width: 100%;
            box-sizing: border-box;
            padding: 18px;
            gap: 16px;
          }
          
          .mg-login-form {
            max-width: 100%;
          }
          
          .mg-profile-intro {
            text-align: center;
          }
          
          .mg-profile-signature {
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
}

export default App
