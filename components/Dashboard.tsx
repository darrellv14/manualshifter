import React from "react";
import { CarState, Gear } from "../types.ts";
import { PHYSICS } from "../constants.ts";

interface DashboardProps {
  state: CarState;
}

// Komponen Reusable untuk Gauge (Speedometer/Tachometer)
const Gauge = ({
  value,
  max,
  label,
  unit,
  dangerStart,
  accentColor = "#ffffff",
}: {
  value: number;
  max: number;
  label: string;
  unit?: string;
  dangerStart?: number;
  accentColor?: string;
}) => {
  // Geometri Gauge (Lingkaran)
  const radius = 90;
  const center = 100;

  // LOGIKA ROTASI YANG DIPERBAIKI
  // Standard Math: 0 derajat = Jam 3 (Kanan)
  // Kita mau Start di Jam 8 (135 derajat) dan End di Jam 4 (405 derajat)
  const startAngle = 135;
  const endAngle = 405;
  const totalAngle = endAngle - startAngle;

  // Hitung rotasi jarum
  // Clamp sedikit di atas max (1.08) agar jarum bisa "mentok" sedikit melewati angka max
  const percentage = Math.min(Math.max(value / max, 0), 1.08);
  const needleRotation = startAngle + percentage * totalAngle;

  // Helper untuk membuat Ticks (Garis-garis angka)
  const renderTicks = () => {
    const ticks = [];
    const step = max / 10; // 10 pembagian utama

    for (let i = 0; i <= max; i += step / 2) {
      const isMajor = i % step === 0;
      const p = i / max;
      const angle = startAngle + p * totalAngle;
      const angleRad = (angle * Math.PI) / 180;

      // Koordinat garis
      const innerR = isMajor ? radius - 15 : radius - 8;
      const outerR = radius;

      const x1 = center + innerR * Math.cos(angleRad);
      const y1 = center + innerR * Math.sin(angleRad);
      const x2 = center + outerR * Math.cos(angleRad);
      const y2 = center + outerR * Math.sin(angleRad);

      // Angka Text
      let textElement = null;
      if (isMajor) {
        const textR = radius - 28;
        const tx = center + textR * Math.cos(angleRad);
        const ty = center + textR * Math.sin(angleRad);

        let textColor = "#cbd5e1";
        if (dangerStart && i >= dangerStart) textColor = "#ef4444";

        textElement = (
          <text
            x={tx}
            y={ty}
            fill={textColor}
            fontSize="14"
            fontWeight="bold"
            fontFamily="monospace"
            textAnchor="middle"
            alignmentBaseline="middle"
          >
            {unit === "x1000" ? i / 1000 : i}
          </text>
        );
      }

      ticks.push(
        <g key={i}>
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={dangerStart && i >= dangerStart ? "#ef4444" : "#64748b"}
            strokeWidth={isMajor ? 3 : 1}
          />
          {textElement}
        </g>,
      );
    }
    return ticks;
  };

  return (
    <div className="relative w-64 h-64 sm:w-72 sm:h-72">
      <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl">
        {/* Background Circle Gradient */}
        <defs>
          <radialGradient
            id="gaugeBack"
            cx="50%"
            cy="50%"
            r="50%"
            fx="50%"
            fy="50%"
          >
            <stop offset="70%" stopColor="#0f172a" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#020617" stopOpacity="0.8" />
          </radialGradient>
          {/* Glow untuk jarum */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="url(#gaugeBack)"
          stroke="#334155"
          strokeWidth="2"
        />

        {/* Ticks & Numbers */}
        {renderTicks()}

        {/* Labels */}
        <text
          x={center}
          y={center + 45}
          fill="#94a3b8"
          fontSize="12"
          textAnchor="middle"
          fontWeight="bold"
          letterSpacing="1px"
        >
          {label}
        </text>
        {unit && (
          <text
            x={center}
            y={center + 60}
            fill="#64748b"
            fontSize="9"
            textAnchor="middle"
          >
            {unit}
          </text>
        )}

        {/* Digital Readout Box */}
        <rect
          x={center - 25}
          y={center + 75}
          width="50"
          height="20"
          rx="3"
          fill="#000"
          stroke="#333"
        />
        <text
          x={center}
          y={center + 89}
          fill={accentColor}
          fontSize="14"
          fontWeight="bold"
          textAnchor="middle"
          fontFamily="monospace"
        >
          {Math.floor(value)}
        </text>

        {/* NEEDLE (Jarum) - DIPERBAIKI: Mengarah ke KANAN (0 deg) secara default */}
        <g
          transform={`rotate(${needleRotation}, ${center}, ${center})`}
          className="transition-transform duration-100 ease-out"
        >
          {/* Badan Jarum (Pointing Right) */}
          <path
            d={`M ${center} ${center - 3} L ${center + radius - 10} ${center} L ${center} ${center + 3} Z`}
            fill="#ef4444"
            filter="url(#glow)"
          />

          {/* Ekor Jarum (Counterweight - Left) */}
          <path
            d={`M ${center} ${center - 4} L ${center - 15} ${center} L ${center} ${center + 4} Z`}
            fill="#ef4444"
          />

          {/* Tutup Poros (Center Pin) */}
          <circle
            cx={center}
            cy={center}
            r="6"
            fill="#1e293b"
            stroke="#64748b"
            strokeWidth="2"
          />
          <circle cx={center} cy={center} r="2" fill="#000" />
        </g>
      </svg>
    </div>
  );
};

// Indikator Gear di Tengah
const GearIndicator = ({
  gear,
  isStalled,
  isEngineOn,
}: {
  gear: Gear;
  isStalled: boolean;
  isEngineOn: boolean;
}) => {
  const getLabel = (g: Gear) => {
    if (g === Gear.Neutral) return "N";
    if (g === Gear.Reverse) return "R";
    return g.toString();
  };

  const label = getLabel(gear);
  let color = "text-white";
  if (label === "N") color = "text-green-400";
  if (label === "R") color = "text-red-400";

  return (
    <div className="flex flex-col items-center justify-end pb-2">
      {/* Warning Lights Container */}
      <div className="flex gap-2 mb-2">
        {/* Check Engine / Stall Light */}
        <div
          className={`w-5 h-5 rounded-full border border-red-900 flex items-center justify-center transition-all ${isStalled ? "bg-red-600 shadow-[0_0_10px_rgba(220,38,38,1)] animate-pulse" : "bg-red-950/40"}`}
          title="Engine Stall"
        >
          <span className="text-[7px] font-bold text-black opacity-80">
            OIL
          </span>
        </div>
        {/* Battery / Engine Off Light */}
        <div
          className={`w-5 h-5 rounded-full border border-yellow-900 flex items-center justify-center transition-all ${!isEngineOn ? "bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,1)]" : "bg-yellow-950/40"}`}
          title="Ignition Off"
        >
          <span className="text-[7px] font-bold text-black opacity-80">
            BAT
          </span>
        </div>
      </div>

      {/* Gear Number */}
      <div className="w-16 h-16 bg-gradient-to-br from-slate-800 to-black border-4 border-slate-600 rounded-xl flex items-center justify-center shadow-lg relative overflow-hidden">
        {/* LCD Effect Background */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle, #fff 1px, transparent 1px)",
            backgroundSize: "3px 3px",
          }}
        ></div>

        <span
          className={`text-4xl font-black font-mono z-10 ${color} drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]`}
        >
          {label}
        </span>
      </div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ state }) => {
  return (
    // FIX LAYOUT:
    // 1. 'justify-center': Memusatkan semua elemen
    // 2. 'gap-x-[20rem]': Memberikan jarak BESAR di tengah untuk setir.
    //    Nilai 20rem - 30rem biasanya cukup untuk menghindari setir tapi tidak menabrak pinggir.
    //    Sesuaikan 'gap-x-...' ini jika setir Anda lebih besar/kecil.
    <div className="absolute bottom-0 left-0 right-0 pointer-events-none select-none z-20 flex justify-center items-end pb-4 gap-x-48 md:gap-x-80 lg:gap-x-96">
      {/* KIRI: TACHOMETER (RPM) */}
      <div className="origin-bottom-right transform scale-90 sm:scale-100">
        <Gauge
          value={state.rpm}
          max={8000}
          label="RPM"
          unit="x1000"
          dangerStart={6500}
          accentColor="#fbbf24"
        />
      </div>

      {/* TENGAH: GEAR INDICATOR */}
      {/* Posisikan absolute di tengah layar tapi sedikit ke atas dari bawah */}
      <div className="absolute bottom-28 transform scale-90 opacity-90">
        <GearIndicator
          gear={state.gear}
          isStalled={state.isStalled}
          isEngineOn={state.isEngineOn}
        />
      </div>

      {/* KANAN: SPEEDOMETER */}
      <div className="origin-bottom-left transform scale-90 sm:scale-100">
        <Gauge
          value={state.speed}
          max={240}
          label="SPEED"
          unit="km/h"
          accentColor="#38bdf8"
        />
      </div>
    </div>
  );
};

export default Dashboard;
