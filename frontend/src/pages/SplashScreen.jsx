import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function shouldShowSplash() {
  return !sessionStorage.getItem('ds_splash_seen');
}

const LOGO_HEIGHT = 160;

export default function SplashScreen() {
  const navigate = useNavigate();

  const [combined, setCombined] = useState(false);
  const [logoOpacity, setLogoOpacity] = useState(1);
  const [floodVisible, setFloodVisible] = useState(false);
  const [floodScale, setFloodScale] = useState(0);
  const [whiteOpacity, setWhiteOpacity] = useState(0);
  const [connectVisible, setConnectVisible] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setCombined(true), 400);
    const t2 = setTimeout(() => {
      setFloodVisible(true);
      setTimeout(() => setFloodScale(120), 30);
    }, 1200);
    const t3 = setTimeout(() => setLogoOpacity(0), 1600);
    const t4 = setTimeout(() => setWhiteOpacity(1), 2300);
    const t5 = setTimeout(() => setConnectVisible(true), 2700);
    const t6 = setTimeout(() => {
      sessionStorage.setItem('ds_splash_seen', 'true');
      navigate('/login');
    }, 3600);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
    };
  }, [navigate]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#ffffff',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>

      {/* Logo stage */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
        opacity: logoOpacity,
        transition: 'opacity 0.4s ease',
      }}>
        <p style={{
          fontSize: '13px',
          fontWeight: 700,
          letterSpacing: '0.25em',
          color: '#1a1a1a',
          textTransform: 'uppercase',
          marginBottom: '24px',
        }}>
          DS GROUP
        </p>

        {/* Logo halves — both point to same image, split with clip-path */}
        <div style={{
          position: 'relative',
          height: `${LOGO_HEIGHT}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* Left half */}
          <img
            src="/ds-logo.png"
            alt=""
            style={{
              height: `${LOGO_HEIGHT}px`,
              width: 'auto',
              clipPath: 'inset(0 50% 0 0)',
              marginRight: `-${LOGO_HEIGHT / 2}px`,
              transform: combined ? 'translateX(0)' : 'translateX(-30px)',
              transition: 'transform 0.6s cubic-bezier(0.34, 1.2, 0.64, 1)',
              display: 'block',
            }}
          />
          {/* Right half */}
          <img
            src="/ds-logo.png"
            alt=""
            style={{
              height: `${LOGO_HEIGHT}px`,
              width: 'auto',
              clipPath: 'inset(0 0 0 50%)',
              marginLeft: `-${LOGO_HEIGHT / 2}px`,
              transform: combined ? 'translateX(0)' : 'translateX(30px)',
              transition: 'transform 0.6s cubic-bezier(0.34, 1.2, 0.64, 1)',
              display: 'block',
            }}
          />
        </div>
      </div>

      {/* Green flood circle */}
      {floodVisible && (
        <div style={{
          position: 'absolute',
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          background: '#1A9F52',
          transform: `scale(${floodScale})`,
          transition: 'transform 1.1s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 3,
          pointerEvents: 'none',
        }} />
      )}

      {/* White overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: '#ffffff',
        opacity: whiteOpacity,
        transition: 'opacity 0.6s ease',
        zIndex: 4,
        pointerEvents: 'none',
      }} />

      {/* Connect screen */}
      {connectVisible && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 5,
        }}>
          <div style={{
            position: 'relative',
            width: '300px',
            height: '300px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg
              viewBox="0 0 300 300"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '300px',
                height: '300px',
              }}
            >
              <circle
                cx="150"
                cy="150"
                r="135"
                fill="none"
                stroke="#1A9F52"
                strokeWidth="1.5"
                strokeDasharray="5 8"
              />
            </svg>

            <p style={{
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '0.3em',
              color: '#9ca3af',
              textTransform: 'uppercase',
              marginBottom: '6px',
              position: 'relative',
            }}>
              DS GROUP
            </p>

            <p style={{
              fontSize: '28px',
              fontWeight: 800,
              letterSpacing: '0.18em',
              color: '#1A9F52',
              textTransform: 'uppercase',
              position: 'relative',
            }}>
              CONNECT
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
