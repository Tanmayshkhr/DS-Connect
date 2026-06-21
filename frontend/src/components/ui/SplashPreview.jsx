import { useState, useEffect, useRef } from "react";

// Updated to the official DS Group Green
const DS_GREEN = "#009A44"; 

export default function SplashPreview() {
  const [stage, setStage] = useState("reset");
  const timers = useRef([]);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function run() {
    clearTimers();
    setStage("reset");
    const t = (fn, ms) => timers.current.push(setTimeout(fn, ms));
    
    // Animation Timeline
    t(() => setStage("wordmark"), 150);
    t(() => setStage("combine"),  600);
    t(() => setStage("flood"),   1500);
    t(() => setStage("white"),   2500);
    t(() => setStage("connect"), 2900);
  }

  useEffect(() => { run(); return clearTimers; }, []);

  const combined    = ["combine","flood","white","connect"].includes(stage);
  const flooding    = ["flood","white","connect"].includes(stage);
  const isWhite     = ["white","connect"].includes(stage);
  const showConnect = stage === "connect";
  const showWordmark = ["wordmark","combine","flood"].includes(stage);

  return (
    <div style={{
      display:"flex", flexDirection:"column", alignItems:"center",
      gap:20, padding:32, background:"#f0f0f0",
      minHeight:"100vh", fontFamily:"sans-serif"
    }}>
      <p style={{ fontSize:13, color:"#888", margin:0 }}>DS CONNECT — Splash Sequence Preview</p>

      {/* Mobile Phone Mockup Container */}
      <div style={{
        position:"relative", width:300, height:540,
        background:"white", borderRadius:36,
        border:"1px solid #ccc", overflow:"hidden",
        boxShadow:"0 12px 40px rgba(0,0,0,0.15)"
      }}>

        {/* Phase 1 & 2: Logo and Combine Stage */}
        <div style={{
          position:"absolute", inset:0,
          display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center",
          gap:16, zIndex:2,
          opacity: flooding ? 0 : 1,
          transition:"opacity 0.4s ease"
        }}>
          
          <div style={{
            fontFamily:"'Arial Black', Arial, sans-serif",
            fontWeight:900, fontSize:22,
            letterSpacing:"0.04em", color:"#1a1a1a",
            opacity: showWordmark ? 1 : 0,
            transition:"opacity 0.5s ease"
          }}>DS GROUP</div>

          <div style={{ display:"flex", alignItems:"center", height:140 }}>
            
            {/* Left half of the logo (Pure CSS instead of Image) */}
            <div style={{
              transform: combined ? "translateX(0)" : "translateX(-120px)",
              opacity: combined ? 1 : 0,
              transition:"transform 0.75s cubic-bezier(0.34,1.1,0.64,1), opacity 0.4s ease",
              width: "60px", 
              height: "120px",
              backgroundColor: DS_GREEN,
              borderRadius: "60px 0 0 60px" // Creates a left semi-circle
            }} />

            {/* Right half of the logo (Pure CSS instead of Image) */}
            <div style={{
              transform: combined ? "translateX(0)" : "translateX(120px)",
              opacity: combined ? 1 : 0,
              transition:"transform 0.75s cubic-bezier(0.34,1.1,0.64,1), opacity 0.4s ease",
              width: "60px", 
              height: "120px",
              backgroundColor: DS_GREEN,
              borderRadius: "0 60px 60px 0" // Creates a right semi-circle
            }} />
            
          </div>
        </div>

        {/* Phase 3: Green Flood Screen */}
        <div style={{
          position:"absolute", left:"50%", top:"50%",
          width:24, height:24, marginLeft:-12, marginTop:-12,
          borderRadius:"50%", background:DS_GREEN,
          transform: flooding ? "scale(45)" : "scale(0)",
          opacity: flooding ? 1 : 0,
          transition:"transform 1.1s cubic-bezier(0.45,0,0.55,1), opacity 0.25s ease",
          zIndex:3
        }} />

        {/* Phase 4: White Overlay to prepare for final text */}
        <div style={{
          position:"absolute", inset:0, background:"white",
          opacity: isWhite ? 1 : 0,
          transition:"opacity 0.55s ease",
          zIndex:4, pointerEvents:"none"
        }} />

        {/* Phase 5: DS CONNECT & Dotted Circle */}
        <div style={{
          position:"absolute", inset:0,
          display:"flex", alignItems:"center", justifyContent:"center",
          opacity: showConnect ? 1 : 0,
          transition:"opacity 0.7s ease", zIndex:5
        }}>
          <div style={{ position:"relative", width:210, height:210, display:"flex", alignItems:"center", justifyContent:"center" }}>
            
            {/* Spinning Dotted Circle SVG */}
            <svg viewBox="0 0 210 210" style={{ position:"absolute", inset:0, width:"100%", height:"100%", animation: "spin 15s linear infinite" }}>
              <circle cx="105" cy="105" r="90" fill="none" stroke={DS_GREEN} strokeWidth="2.5" strokeDasharray="6 12" />
            </svg>

            {/* Final Text */}
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
              <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.2em", color:"#bbb" }}>DS GROUP</span>
              <span style={{ fontSize:24, fontWeight:800, letterSpacing:"0.15em", color:DS_GREEN }}>CONNECT</span>
            </div>
            
          </div>
        </div>

      </div>

      <button onClick={run} style={{
        padding:"10px 28px", borderRadius:8,
        background:DS_GREEN, color:"white",
        border:"none", cursor:"pointer",
        fontSize:14, fontWeight:700, letterSpacing:"0.05em"
      }}>↺ Replay Sequence</button>

      {/* Inline style for the rotating circle */}
      <style>{`
        @keyframes spin { 
          100% { transform: rotate(360deg); } 
        }
      `}</style>
      
    </div>
  );
}