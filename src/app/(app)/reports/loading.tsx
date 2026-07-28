export default function ReportsLoading() {
  const skeletonClass = "bg-surface-border/50 rounded-md animate-pulse";

  return (
    <div className="p-8 max-w-[1500px] mx-auto animate-pulse pb-24">
      {/* Controls */}
      <div className="flex mb-8">
        <div className="flex bg-surface-elevated/50 p-1.5 rounded-full border border-surface-border gap-2">
           <div className={`w-28 h-8 rounded-full ${skeletonClass}`} />
           <div className={`w-28 h-8 rounded-full ${skeletonClass}`} />
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-3xl p-6 bg-surface-elevated border border-surface-border shadow-sm flex items-center gap-5"
          >
            <div className={`w-14 h-14 rounded-2xl flex-shrink-0 ${skeletonClass}`} />
            <div className="space-y-2">
              <div className={`h-3 w-20 ${skeletonClass}`} />
              <div className={`h-8 w-12 ${skeletonClass}`} />
              <div className={`h-2.5 w-24 ${skeletonClass}`} />
            </div>
          </div>
        ))}
      </div>

      {/* Productivity chart */}
      <div className="rounded-3xl p-6 mb-6 bg-surface-elevated border border-surface-border shadow-sm h-[400px] flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <div className={`h-5 w-48 ${skeletonClass}`} />
          <div className={`h-8 w-32 rounded-xl ${skeletonClass}`} />
        </div>
        <div className="flex items-center gap-6 mb-8 px-4">
           {[...Array(4)].map((_, i) => (
             <div key={i} className="flex items-center gap-2">
               <div className={`w-2 h-2 rounded-full ${skeletonClass}`} />
               <div className={`h-3 w-24 ${skeletonClass}`} />
             </div>
           ))}
        </div>
        <div className={`flex-1 w-full rounded-xl ${skeletonClass}`} />
      </div>

      {/* Overdue tickets */}
      <div className="rounded-3xl border border-surface-border shadow-sm overflow-hidden flex flex-col bg-surface-elevated h-[300px]">
        <div className="px-6 py-5 border-b border-surface-border flex items-center gap-3">
          <div className={`h-5 w-32 ${skeletonClass}`} />
          <div className={`h-4 w-6 rounded-md ${skeletonClass}`} />
        </div>
        <div className="px-6 py-4">
           <div className="grid grid-cols-12 gap-4 mb-4">
             <div className={`col-span-5 h-3 ${skeletonClass}`} />
             <div className={`col-span-3 h-3 ${skeletonClass}`} />
             <div className={`col-span-2 h-3 ${skeletonClass}`} />
             <div className={`col-span-2 h-3 ${skeletonClass}`} />
           </div>
           <div className="space-y-6 mt-6">
              {[...Array(3)].map((_, i) => (
                 <div key={i} className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-5 flex items-center gap-3">
                       <div className={`w-10 h-10 rounded-xl flex-shrink-0 ${skeletonClass}`} />
                       <div className={`h-4 w-48 ${skeletonClass}`} />
                    </div>
                    <div className="col-span-3 flex items-center gap-2">
                       <div className={`w-6 h-6 rounded-full flex-shrink-0 ${skeletonClass}`} />
                       <div className={`h-3 w-24 ${skeletonClass}`} />
                    </div>
                    <div className={`col-span-2 h-3 w-12 ${skeletonClass}`} />
                    <div className={`col-span-2 h-6 w-16 rounded-md ${skeletonClass}`} />
                 </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
}
