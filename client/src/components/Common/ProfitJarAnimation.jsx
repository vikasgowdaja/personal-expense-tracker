import React, { useEffect } from 'react';

const PROFIT_JAR_ANIMATION_CSS = `
@keyframes poiCoinTravel {
  0% {
    opacity: 0;
    left: 24%;
    top: 18%;
    transform: translate(0, 0) scale(0.2) rotateY(0deg);
  }
  14% {
    opacity: 1;
    left: 24%;
    top: 18%;
    transform: translate(0, 0) scale(1.05) rotateY(150deg);
  }
  58% {
    opacity: 1;
    left: 42%;
    top: 34%;
    transform: translate(0, 0) scale(1) rotateY(480deg);
  }
  82% {
    opacity: 1;
    left: 50%;
    top: 49%;
    transform: translate(0, 0) scale(0.95) rotateY(700deg);
  }
  100% {
    opacity: 0.25;
    left: 50%;
    top: 56%;
    transform: translate(0, 0) scale(0.62) rotateY(820deg);
  }
}

@keyframes poiCoinBurstTravel {
  0% {
    opacity: 0;
    transform: translate(0, 0) scale(0.25) rotateY(0deg);
  }
  14% {
    opacity: 1;
    transform: translate(0, 0) scale(1.03) rotateY(120deg);
  }
  70% {
    opacity: 1;
    transform: translate(calc(var(--tx) * 0.76), calc(var(--ty) * 0.7)) scale(0.95) rotateY(560deg);
  }
  100% {
    opacity: 0.3;
    transform: translate(var(--tx), var(--ty)) scale(0.6) rotateY(760deg);
  }
}

@keyframes poiCoinShimmer {
  0% { opacity: 0.22; transform: translateX(-12px); }
  52% { opacity: 0.78; transform: translateX(3px); }
  100% { opacity: 0.12; transform: translateX(15px); }
}

@keyframes poiJarPulse {
  0% { transform: translate(-50%, -50%) scale(1); opacity: 0.76; }
  45% { transform: translate(-50%, -50%) scale(1.04); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 0.82; }
}

@keyframes poiFillRise {
  0% { transform: scaleY(0.05); opacity: 0.35; }
  65% { transform: scaleY(1); opacity: 0.92; }
  100% { transform: scaleY(0.82); opacity: 0.84; }
}

@keyframes poiAmountFloat {
  0% { opacity: 0; transform: translateY(10px); }
  24% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-14px); }
}

@keyframes poiSparkle {
  0% { opacity: 0; transform: scale(0.55); }
  45% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(0.7); }
}
`;

const COIN_SOUND_SRC = '/sounds/freesound_community-coin-clatter-6-87110.mp3';

function playCoinDropSample(playbackRate = 1, volume = 0.24) {
  try {
    const audio = new Audio(COIN_SOUND_SRC);
    audio.preload = 'auto';
    audio.volume = volume;
    audio.playbackRate = playbackRate;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  } catch {
    // Ignore audio errors; do not use alternate fallback sounds.
  }
}

function ProfitJarAnimation({ amount = 0, durationMs = 2600, onDone, enableSound = true }) {
  useEffect(() => {
    if (!onDone) return undefined;
    const timer = setTimeout(() => {
      onDone();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onDone]);

  useEffect(() => {
    if (!enableSound) return undefined;
    const impactSchedule = [920, 1080, 1240, 1400, 1560];
    const timers = [];

    impactSchedule.forEach((ms, index) => {
      timers.push(setTimeout(() => {
        const baseRate = 0.92 + (index * 0.025);
        // Layer two nearby hits per impact for a fuller coin-burst sound.
        playCoinDropSample(baseRate, 0.24);
        const layerTimer = setTimeout(() => {
          playCoinDropSample(baseRate + 0.08, 0.14);
        }, 42);
        timers.push(layerTimer);
      }, ms));
    });

    return () => timers.forEach((t) => clearTimeout(t));
  }, [enableSound]);

  const burstCoins = [
    { left: '22%', top: '18%', tx: '248px', ty: '208px', delay: '0ms', size: 40 },
    { left: '28%', top: '15%', tx: '196px', ty: '220px', delay: '130ms', size: 34 },
    { left: '17%', top: '22%', tx: '280px', ty: '178px', delay: '240ms', size: 30 },
    { left: '31%', top: '20%', tx: '175px', ty: '210px', delay: '360ms', size: 28 },
    { left: '24%', top: '12%', tx: '222px', ty: '248px', delay: '500ms', size: 26 }
  ];

  return (
    <>
      <style>{PROFIT_JAR_ANIMATION_CSS}</style>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 1400
        }}
        aria-hidden="true"
      >
        <div
          style={{
            position: 'relative',
            width: 'min(82vw, 940px)',
            height: 'min(64vh, 680px)',
            minWidth: '420px',
            minHeight: '340px'
          }}
        >
          {burstCoins.map((coin, idx) => (
            <div
              key={`coin-${idx}`}
              style={{
                position: 'absolute',
                left: coin.left,
                top: coin.top,
                width: `${coin.size}px`,
                height: `${coin.size}px`,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 34% 30%, #f7e7a1 0%, #d4af37 52%, #9c7a17 100%)',
                boxShadow: '0 0 18px rgba(212, 175, 55, 0.62)',
                '--tx': coin.tx,
                '--ty': coin.ty,
                animation: `poiCoinBurstTravel 1700ms cubic-bezier(0.4, 0, 0.2, 1) ${coin.delay} forwards`
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  left: `${Math.max(6, Math.round(coin.size * 0.26))}px`,
                  top: `${Math.max(5, Math.round(coin.size * 0.22))}px`,
                  width: `${Math.max(9, Math.round(coin.size * 0.34))}px`,
                  height: `${Math.max(13, Math.round(coin.size * 0.52))}px`,
                  borderRadius: '999px',
                  background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(247,231,161,0.9) 50%, rgba(255,255,255,0) 100%)',
                  animation: `poiCoinShimmer 560ms ease-in-out calc(${coin.delay} + 360ms) forwards`
                }}
              />
            </div>
          ))}

          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '56%',
              transform: 'translate(-50%, -50%)',
              width: '320px',
              height: '320px',
              animation: 'poiJarPulse 760ms cubic-bezier(0.4, 0, 0.2, 1) 1280ms forwards'
            }}
          >
            <svg viewBox="0 0 300 320" width="100%" height="100%">
              <defs>
                <linearGradient id="poiJarGlassGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(230,236,255,0.34)" />
                  <stop offset="100%" stopColor="rgba(150,165,198,0.2)" />
                </linearGradient>
                <clipPath id="poiJarFillClip">
                  <path d="M102 76 L116 258 Q150 279 184 258 L198 76 Z" />
                </clipPath>
              </defs>

              <ellipse cx="150" cy="68" rx="62" ry="16" fill="rgba(185, 198, 226, 0.4)" />

              <path
                d="M80 68 L102 262 Q150 302 198 262 L220 68"
                fill="url(#poiJarGlassGradient)"
                stroke="rgba(130, 146, 186, 0.86)"
                strokeWidth="4"
              />

              <g clipPath="url(#poiJarFillClip)">
                <rect
                  x="95"
                  y="124"
                  width="110"
                  height="140"
                  style={{
                    transformOrigin: '150px 264px',
                    transform: 'scaleY(0.05)',
                    fill: 'url(#poiGoldFill)',
                    animation: 'poiFillRise 920ms cubic-bezier(0.4, 0, 0.2, 1) 1500ms forwards'
                  }}
                />
              </g>

              <ellipse cx="150" cy="262" rx="40" ry="12" fill="rgba(167, 181, 210, 0.26)" />

              <defs>
                <linearGradient id="poiGoldFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(247, 231, 161, 0.95)" />
                  <stop offset="100%" stopColor="rgba(212, 175, 55, 0.82)" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div
            style={{
              position: 'absolute',
              left: '58%',
              top: '31%',
              fontSize: '1.3rem',
              color: '#d4af37',
              textShadow: '0 0 9px rgba(212, 175, 55, 0.5)',
              animation: 'poiSparkle 760ms ease-out 1680ms forwards',
              opacity: 0
            }}
          >
            ✦
          </div>

          <div
            style={{
              position: 'absolute',
              left: '55%',
              top: '27%',
              fontSize: '1.05rem',
              fontWeight: 700,
              color: '#8a6b00',
              background: 'rgba(255,255,255,0.92)',
              borderRadius: '999px',
              padding: '5px 11px',
              boxShadow: '0 2px 9px rgba(0, 0, 0, 0.14)',
              animation: 'poiAmountFloat 1000ms cubic-bezier(0.4, 0, 0.2, 1) 1740ms forwards',
              opacity: 0
            }}
          >
            +₹{Number(amount || 0).toLocaleString('en-IN')}
          </div>
        </div>
      </div>
    </>
  );
}

export default ProfitJarAnimation;
