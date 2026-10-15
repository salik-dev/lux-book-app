import React from 'react';
import { formatPlate } from '@/lib/vehicle-lookup-api';

interface RegistrationPlateProps {
  /** Normalised plate, e.g. "EN10257". */
  value: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Norwegian-style number plate: blue "N" band + black characters on white. */
export const RegistrationPlate: React.FC<RegistrationPlateProps> = ({ value, size = 'sm', className = '' }) => {
  const sm = size === 'sm';
  return (
    <span
      className={`inline-flex items-stretch overflow-hidden rounded-[4px] border border-gray-800 bg-white font-mono font-bold leading-none text-gray-900 shadow-[0_1px_0_rgba(0,0,0,0.08)] ${sm ? 'text-[10px]' : 'text-sm'} ${className}`}
      aria-label={`Registration number ${formatPlate(value)}`}
    >
      <span
        aria-hidden
        className={`flex items-center bg-[#003399] font-sans font-bold text-white ${sm ? 'px-[3px] text-[7px]' : 'px-1 text-[9px]'}`}
      >
        N
      </span>
      <span className={`tracking-wider ${sm ? 'px-1.5 py-[3px]' : 'px-2.5 py-1.5'}`}>{formatPlate(value)}</span>
    </span>
  );
};
