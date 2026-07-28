export default function MyTasksLoading() {
  const skeletonClass = "bg-surface-border/50 rounded-md animate-pulse";
  
  return (
    <div className="p-8 pb-24 max-w-[1500px] mx-auto space-y-8 animate-pulse">
      
      {/* Filters Only */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-end gap-6 pt-2">
        <div className="flex items-center gap-3">
          <div className={`w-24 h-9 rounded-xl ${skeletonClass}`} />
          <div className={`w-24 h-9 rounded-xl ${skeletonClass}`} />
          <div className={`w-24 h-9 rounded-xl ${skeletonClass}`} />
          <div className={`w-48 h-9 rounded-xl ${skeletonClass}`} />
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-surface-elevated border border-surface-border rounded-2xl p-5 flex items-center gap-4">
             <div className={`w-12 h-12 rounded-2xl flex-shrink-0 ${skeletonClass}`} />
             <div className="space-y-2 flex-1">
               <div className={`h-3 w-16 ${skeletonClass}`} />
               <div className={`h-6 w-10 ${skeletonClass}`} />
             </div>
          </div>
        ))}
      </div>

      {/* Task Table Skeleton */}
      <div className="bg-surface-elevated border border-surface-border rounded-3xl overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[1000px]">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="px-6 py-4 w-[28%]"><div className={`h-3 w-12 ${skeletonClass}`} /></th>
                <th className="px-4 py-4 w-[15%]"><div className={`h-3 w-12 ${skeletonClass}`} /></th>
                <th className="px-4 py-4 w-[15%]"><div className={`h-3 w-12 ${skeletonClass}`} /></th>
                <th className="px-4 py-4 w-[15%]"><div className={`h-3 w-12 ${skeletonClass}`} /></th>
                <th className="px-4 py-4 w-[12%]"><div className={`h-3 w-12 ${skeletonClass}`} /></th>
                <th className="px-4 py-4"><div className={`h-3 w-12 ${skeletonClass}`} /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {[...Array(6)].map((_, i) => (
                <tr key={i}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                       <div className={`w-8 h-8 rounded-xl flex-shrink-0 ${skeletonClass}`} />
                       <div className="space-y-1.5 flex-1">
                         <div className={`h-3.5 w-48 ${skeletonClass}`} />
                         <div className={`h-2.5 w-32 ${skeletonClass}`} />
                       </div>
                    </div>
                  </td>
                  <td className="px-4 py-4"><div className={`h-6 w-24 rounded-md ${skeletonClass}`} /></td>
                  <td className="px-4 py-4"><div className={`h-6 w-24 rounded-full ${skeletonClass}`} /></td>
                  <td className="px-4 py-4"><div className={`h-4 w-20 ${skeletonClass}`} /></td>
                  <td className="px-4 py-4"><div className={`h-6 w-16 rounded-full ${skeletonClass}`} /></td>
                  <td className="px-4 py-4">
                    <div className="space-y-1.5">
                      <div className={`h-3.5 w-20 ${skeletonClass}`} />
                      <div className={`h-2.5 w-16 ${skeletonClass}`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
}
