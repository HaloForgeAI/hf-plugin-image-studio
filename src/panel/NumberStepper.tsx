import { Minus, Plus } from "lucide-react";

interface NumberStepperProps {
  value: number;
  min: number;
  max: number;
  decrementLabel: string;
  incrementLabel: string;
  onChange: (value: number) => void;
}

export function NumberStepper({ value, min, max, decrementLabel, incrementLabel, onChange }: NumberStepperProps) {
  const clamped = clamp(value, min, max);

  return (
    <div className="hfis-number-stepper">
      <button type="button" onClick={() => onChange(clamp(clamped - 1, min, max))} disabled={clamped <= min} aria-label={decrementLabel}>
        <Minus size={13} />
      </button>
      <input
        type="number"
        min={min}
        max={max}
        value={clamped}
        onChange={(event) => onChange(clamp(Number(event.target.value), min, max))}
      />
      <button type="button" onClick={() => onChange(clamp(clamped + 1, min, max))} disabled={clamped >= max} aria-label={incrementLabel}>
        <Plus size={13} />
      </button>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
