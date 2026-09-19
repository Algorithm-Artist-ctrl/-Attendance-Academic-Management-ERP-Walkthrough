import React from 'react';
import { clsx } from 'clsx';

export const CardSkeleton: React.FC<{ className?: string; count?: number }> = ({ 
  className = '', 
  count = 1 
}) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={clsx(
            'p-5 rounded-2xl bg-white border border-slate-200/80 animate-pulse space-y-3 shadow-xs',
            className
          )}
        >
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 bg-slate-200 rounded-lg" />
            <div className="h-6 w-16 bg-slate-200 rounded-full" />
          </div>
          <div className="h-3 w-48 bg-slate-100 rounded" />
          <div className="h-8 w-full bg-slate-100 rounded-xl" />
        </div>
      ))}
    </>
  );
};

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 4,
}) => {
  return (
    <div className="w-full rounded-2xl bg-white border border-slate-200/80 overflow-hidden animate-pulse shadow-xs">
      {/* Header */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex gap-4">
        {Array.from({ length: columns }).map((_, colIdx) => (
          <div key={colIdx} className="h-4 bg-slate-200 rounded-lg flex-1" />
        ))}
      </div>
      {/* Rows */}
      <div className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div key={rowIdx} className="p-4 flex gap-4 items-center">
            {Array.from({ length: columns }).map((_, colIdx) => (
              <div 
                key={colIdx} 
                className={clsx(
                  "h-3 bg-slate-100 rounded",
                  colIdx === 0 ? "w-1/4" : "flex-1"
                )} 
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export const MarksSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i} 
          className="bg-white border border-slate-200/80 rounded-2xl p-5 animate-pulse space-y-4 shadow-xs"
        >
          {/* Subject Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-16 h-6 rounded-xl bg-slate-200" />
              <div className="space-y-1.5">
                <div className="h-5 w-48 bg-slate-200 rounded-md" />
                <div className="h-3 w-32 bg-slate-100 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="space-y-1 text-right">
                <div className="h-2.5 w-12 bg-slate-200 rounded ml-auto" />
                <div className="h-4 w-10 bg-slate-200 rounded ml-auto" />
              </div>
              <div className="space-y-1 text-right pl-4 border-l border-slate-200">
                <div className="h-2.5 w-16 bg-slate-200 rounded ml-auto" />
                <div className="h-4 w-14 bg-slate-200 rounded ml-auto" />
              </div>
            </div>
          </div>

          {/* 3-Column Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            {Array.from({ length: 3 }).map((_, col) => (
              <div key={col} className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-slate-200" />
                  <div className="h-3 w-28 bg-slate-200 rounded" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-slate-200/50">
                    <div className="h-3 w-20 bg-slate-200 rounded" />
                    <div className="h-3 w-10 bg-slate-200 rounded" />
                  </div>
                  <div className="flex justify-between py-1">
                    <div className="h-3 w-24 bg-slate-200 rounded" />
                    <div className="h-3 w-10 bg-slate-200 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export const TimetableSkeleton: React.FC<{ slots?: number }> = ({ slots = 6 }) => {
  return (
    <div className="space-y-3">
      <div className="h-10 w-full bg-white border border-slate-200/80 rounded-2xl animate-pulse shadow-xs" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: slots }).map((_, i) => (
          <div 
            key={i} 
            className="p-4 rounded-2xl bg-white border border-slate-200/80 animate-pulse space-y-2.5 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <div className="h-5 w-16 bg-slate-200 rounded-lg" />
              <div className="h-4 w-20 bg-slate-100 rounded" />
            </div>
            <div className="h-4 w-36 bg-slate-200 rounded" />
            <div className="h-3 w-24 bg-slate-100 rounded" />
            <div className="flex justify-between pt-2 border-t border-slate-100">
              <div className="h-3 w-16 bg-slate-100 rounded" />
              <div className="h-3 w-14 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const NotificationSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="divide-y divide-slate-100 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-3.5 flex gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-200 shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <div className="h-3.5 w-40 bg-slate-200 rounded" />
            <div className="h-3 w-full bg-slate-100 rounded" />
            <div className="h-2.5 w-20 bg-slate-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};
