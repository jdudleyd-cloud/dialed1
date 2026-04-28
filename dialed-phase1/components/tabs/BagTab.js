import { DISC_DATA } from '../../utils/discData'

export default function BagTab() {
  const drivers = DISC_DATA.filter((d) => d.type === 'Driver')
  const midranges = DISC_DATA.filter((d) => d.type === 'Midrange')
  const putters = DISC_DATA.filter((d) => d.type === 'Putter')

  const DiscCard = ({ disc }) => (
    <div className="broadcast-card p-3 space-y-2">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-black text-broadcast-yellow font-saira">{disc.name}</div>
          <div className="text-xs text-broadcast-cyan">{disc.type} / {disc.stability}</div>
        </div>
        <div
          className="w-12 h-12 rounded-full border-2 border-broadcast-yellow"
          style={{ backgroundColor: disc.color }}
        />
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div>
          <div className="text-broadcast-cyan">Speed</div>
          <div className="font-bold text-broadcast-yellow">{disc.speed}</div>
        </div>
        <div>
          <div className="text-broadcast-cyan">Glide</div>
          <div className="font-bold text-broadcast-yellow">{disc.glide}</div>
        </div>
        <div>
          <div className="text-broadcast-cyan">Turn</div>
          <div className="font-bold text-broadcast-yellow">{disc.turn}</div>
        </div>
        <div>
          <div className="text-broadcast-cyan">Fade</div>
          <div className="font-bold text-broadcast-yellow">{disc.fade}</div>
        </div>
      </div>
      <div className="text-xs text-gray-400 pt-2 border-t border-gray-700">
        {disc.weight}g • {disc.plastic}
      </div>
    </div>
  )

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      {/* Bag Summary */}
      <div className="broadcast-card p-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="broadcast-stat">{drivers.length}</div>
            <div className="text-xs text-broadcast-cyan">Drivers</div>
          </div>
          <div>
            <div className="broadcast-stat">{midranges.length}</div>
            <div className="text-xs text-broadcast-cyan">Midranges</div>
          </div>
          <div>
            <div className="broadcast-stat">{putters.length}</div>
            <div className="text-xs text-broadcast-cyan">Putters</div>
          </div>
        </div>
      </div>

      {/* Drivers */}
      <div>
        <h3 className="font-black text-broadcast-yellow font-saira mb-3 text-sm">DRIVERS</h3>
        <div className="grid grid-cols-1 gap-3">
          {drivers.map((disc) => (
            <DiscCard key={disc.id} disc={disc} />
          ))}
        </div>
      </div>

      {/* Midranges */}
      <div>
        <h3 className="font-black text-broadcast-yellow font-saira mb-3 text-sm">MIDRANGES</h3>
        <div className="grid grid-cols-1 gap-3">
          {midranges.map((disc) => (
            <DiscCard key={disc.id} disc={disc} />
          ))}
        </div>
      </div>

      {/* Putters */}
      <div>
        <h3 className="font-black text-broadcast-yellow font-saira mb-3 text-sm">PUTTERS</h3>
        <div className="grid grid-cols-1 gap-3">
          {putters.map((disc) => (
            <DiscCard key={disc.id} disc={disc} />
          ))}
        </div>
      </div>
    </div>
  )
}
