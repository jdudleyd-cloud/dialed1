export default function CourseTab({ location }) {
  return (
    <div className="p-6 space-y-6">
      <div className="broadcast-card p-6 text-center">
        <h2 className="text-2xl font-black text-broadcast-yellow font-saira mb-4">
          PALMER PARK
        </h2>
        <div className="text-sm text-broadcast-cyan space-y-2">
          <p>18 Holes</p>
          <p>Par 54</p>
          <p className="text-xs mt-4 text-gray-400">
            Phase 2: OpenStreetMap course detection and elevation data coming soon
          </p>
        </div>
      </div>

      {/* Course Map Placeholder */}
      <div className="broadcast-card p-6 aspect-square bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-broadcast-yellow font-saira font-black mb-2">MAP VIEW</div>
          <div className="text-xs text-broadcast-cyan">Mapbox integration in Phase 2</div>
          {location && (
            <div className="text-xs text-gray-500 mt-4">
              {location.lat.toFixed(4)}° N<br />
              {location.lon.toFixed(4)}° W
            </div>
          )}
        </div>
      </div>

      {/* Hole Info Placeholder */}
      <div className="broadcast-card p-4">
        <h3 className="font-black text-broadcast-yellow font-saira mb-4">HOLES</h3>
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: 18 }).map((_, i) => (
            <button
              key={i + 1}
              className="bg-broadcast-black border-2 border-broadcast-yellow text-broadcast-yellow font-black font-saira py-2 rounded hover:bg-broadcast-yellow hover:text-broadcast-black transition-colors"
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
