import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

export const formatTimer = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const JudgeTimer = forwardRef(({ onReset }, ref) => {
  const [timerOn, setTimerOn] = useState(false);
  const [timerSec, setTimerSec] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerOn) {
      timerRef.current = setInterval(() => setTimerSec(s => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerOn]);

  useImperativeHandle(ref, () => ({
    getSec: () => timerSec,
    reset: () => { setTimerOn(false); setTimerSec(0); }
  }));

  return (
    <div style={{display:'flex',alignItems:'center',gap:6,marginLeft:8,padding:'3px 10px',borderRadius:6,background:timerOn?'rgba(121,192,255,.08)':'var(--bg3)',border:'1px solid var(--border)'}}>
      <span className="mono" style={{fontSize:13,fontWeight:700,color:timerOn?'var(--blue)':'var(--text3)',minWidth:42}}>{formatTimer(timerSec)}</span>
      <button aria-label={timerOn ? '타이머 일시정지' : '타이머 시작'} onClick={()=>setTimerOn(p=>!p)} style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:timerOn?'var(--red)':'var(--green)',fontWeight:700}}>
        {timerOn?'⏸':'▶'}
      </button>
      <button aria-label="타이머 초기화" onClick={()=>{setTimerOn(false);setTimerSec(0); if(onReset) onReset();}} style={{background:'none',border:'none',cursor:'pointer',fontSize:11,color:'var(--text3)'}}>↺</button>
    </div>
  );
});

JudgeTimer.displayName = 'JudgeTimer';

export default JudgeTimer;
