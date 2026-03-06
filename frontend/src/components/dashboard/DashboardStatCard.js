import React from 'react';

const DashboardStatCard = ({ title, value, helper, icon: Icon }) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        {Icon && (
          <div className="rounded-lg bg-slate-100 p-2 text-slate-700">
            <Icon size={16} />
          </div>
        )}
      </div>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
      {helper ? <p className="mt-1 text-xs text-slate-500">{helper}</p> : null}
    </div>
  );
};

export default DashboardStatCard;
