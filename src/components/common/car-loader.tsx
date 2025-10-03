export function CarLoader() {
  return (
    <div className="flex mx-20 flex-wrap gap-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white w-[340px] mx-auto h-[500px] items-center overflow-hidden shadow-md hover:shadow-xl transition-all duration-300">
          <div className="relative">
            <div className="w-full h-60 bg-gray-200 animate-pulse" />
          </div>

          <div className="p-6">
            <div className="space-y-4">
              <div className="h-6 bg-gray-200 rounded w-3/4 animate-pulse"></div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse"></div>
              </div>
            </div>

            <hr className="border-t border-gray-200 my-4" />

            <div className="space-y-3 mb-6">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="flex items-center space-x-3">
                  <div className="h-4 w-4 bg-gray-200 rounded-full animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                </div>
              ))}
            </div>

            <div className="h-10 bg-gray-200 rounded-md w-full animate-pulse"></div>
          </div>
        </div>
      ))}
    </div>
  )
}