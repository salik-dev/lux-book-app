import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface AdminTableSkeletonProps {
  /** Number of placeholder rows. */
  rows?: number;
  /** Number of placeholder columns (including the leading avatar column). */
  columns?: number;
  /** Show a title bar placeholder in the card header. */
  withTitle?: boolean;
  /** Show a circular avatar placeholder as the first cell of each row. */
  withAvatar?: boolean;
}

/**
 * Shared loading skeleton for admin data-table modules. Uses the smooth
 * `admin-shimmer` sweep so Bookings, Fleet, Customers, Users all feel the same
 * while their data is fetched.
 */
export const AdminTableSkeleton: React.FC<AdminTableSkeletonProps> = ({
  rows = 8,
  columns = 5,
  withTitle = true,
  withAvatar = true,
}) => {
  const bodyCols = Math.max(1, columns - (withAvatar ? 1 : 0));

  return (
    <Card className="card-premium flex min-h-0 flex-1 flex-col bg-white">
      {withTitle && (
        <CardHeader className="shrink-0 px-5 py-4">
          <div className="admin-shimmer h-5 w-44 rounded-md" />
        </CardHeader>
      )}
      <CardContent className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-0">
        <div className="flex-1 overflow-hidden rounded-md border border-gray-200">
          {/* Header row */}
          <div className="flex items-center gap-4 border-b border-gray-200 bg-gray-50/70 px-4 py-3.5">
            {Array.from({ length: columns }).map((_, i) => (
              <div
                key={i}
                className="admin-shimmer h-3 rounded"
                style={{ width: i === 0 ? '20%' : '13%' }}
              />
            ))}
          </div>
          {/* Body rows */}
          <div className="divide-y divide-gray-100">
            {Array.from({ length: rows }).map((_, r) => (
              <div key={r} className="flex items-center gap-4 px-4 py-[18px]">
                {withAvatar && <div className="admin-shimmer h-9 w-9 shrink-0 rounded-full" />}
                <div className="flex flex-1 items-center gap-4">
                  {Array.from({ length: bodyCols }).map((_, c) => (
                    <div
                      key={c}
                      className="admin-shimmer h-3 rounded"
                      style={{ width: c === 0 ? '32%' : '16%' }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
