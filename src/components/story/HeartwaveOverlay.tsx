const HEARTWAVE_STYLE = `
@keyframes heartwave-pulse {
  0%, 100% { opacity: 0.12; transform: scaleY(1); }
  50%       { opacity: 0.22; transform: scaleY(1.08); }
}
@keyframes heartwave-drift {
  0%   { transform: translateX(0) translateY(0); }
  50%  { transform: translateX(12px) translateY(-8px); }
  100% { transform: translateX(0) translateY(0); }
}
`
if (typeof document !== 'undefined' && !document.getElementById('heartwave-keyframes')) {
  const el = document.createElement('style')
  el.id = 'heartwave-keyframes'
  el.textContent = HEARTWAVE_STYLE
  document.head.appendChild(el)
}

const BANDS = [
  { top: '0%',   height: '25%', color: '#f9a8d4', delay: '0s',    duration: '6s'  },
  { top: '20%',  height: '30%', color: '#fbcfe8', delay: '1.2s',  duration: '7s'  },
  { top: '45%',  height: '28%', color: '#f472b6', delay: '0.6s',  duration: '5.5s'},
  { top: '65%',  height: '25%', color: '#ec4899', delay: '1.8s',  duration: '8s'  },
  { top: '80%',  height: '30%', color: '#fbcfe8', delay: '0.3s',  duration: '6.5s'},
]

export default function HeartwaveOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {BANDS.map((band, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: band.top,
            height: band.height,
            background: band.color,
            opacity: 0.15,
            filter: 'blur(40px)',
            animation: `heartwave-pulse ${band.duration} ${band.delay} ease-in-out infinite,
                        heartwave-drift ${band.duration} ${band.delay} ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  )
}
