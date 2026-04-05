import React from 'react';

export const Logo = ({ className = "w-10 h-10" }: { className?: string }) => {
  return null; // Arrow icon removed as requested
};

export const LogoFull = ({ className = "" }: { className?: string }) => {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img 
        src="https://lh3.googleusercontent.com/d/1CA2157vgEoRRyRJVFuAhPN9GntFBcl9C" 
        alt="MBU Studio" 
        className="h-10 w-auto object-contain"
        referrerPolicy="no-referrer"
      />
      <span className="text-2xl font-black text-gray-900 tracking-tighter">MBU Studio</span>
    </div>
  );
};
