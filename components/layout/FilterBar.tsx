type TimeFilter = 'all' | 'tonight' | 'weekend'

type FilterBarProps = {
  activeTimeFilter: TimeFilter
  activeCategory: string
  visiblePlacesCount: number
  visibleEventsCount: number
  onTimeFilterChange: (value: TimeFilter) => void
  onCategoryChange: (value: string) => void
  onReset: () => void
}

const categories = ['all', 'nightlife', 'sports', 'culture', 'food']
const timeFilters: TimeFilter[] = ['all', 'tonight', 'weekend']

function getTimeFilterLabel(filter: TimeFilter) {
  if (filter === 'all') return 'All'
  if (filter === 'tonight') return 'Tonight'
  return 'This weekend'
}

function getCategoryLabel(category: string) {
  if (category === 'all') return 'All'
  return category
}

export default function FilterBar({
  activeTimeFilter,
  activeCategory,
  visiblePlacesCount,
  visibleEventsCount,
  onTimeFilterChange,
  onCategoryChange,
  onReset,
}: FilterBarProps) {
  const hasActiveFilters =
    activeTimeFilter !== 'all' || activeCategory !== 'all'

  return (
    <div className="absolute left-4 right-4 top-24 z-10 md:left-4 md:right-auto md:max-w-[720px]">
      <div className="rounded-2xl bg-white/95 p-3 shadow-xl backdrop-blur">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Time
            </span>

            {timeFilters.map(filter => {
              const isActive = activeTimeFilter === filter

              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => onTimeFilterChange(filter)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    isActive
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {getTimeFilterLabel(filter)}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Category
            </span>

            {categories.map(category => {
              const isActive = activeCategory === category

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => onCategoryChange(category)}
                  className={`rounded-full px-4 py-2 text-sm font-medium capitalize transition ${
                    isActive
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {getCategoryLabel(category)}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
              <span className="font-semibold text-gray-900">
                {visiblePlacesCount} {visiblePlacesCount === 1 ? 'place' : 'places'}
              </span>

              <span className="text-gray-300">•</span>

              <span className="text-gray-700">
                {visibleEventsCount} {visibleEventsCount === 1 ? 'event' : 'events'}
              </span>

              {hasActiveFilters && (
                <>
                  <span className="text-gray-300">•</span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    {getTimeFilterLabel(activeTimeFilter)}
                  </span>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium capitalize text-gray-700">
                    {getCategoryLabel(activeCategory)}
                  </span>
                </>
              )}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={onReset}
                className="rounded-full border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}