import type { OrderType } from "@/types/shopee"

interface Props {
  value: OrderType
  onChange: (v: OrderType) => void
}

export default function OrderToggle({ value, onChange }: Props) {
  return (
    <div className="flex bg-muted rounded-lg p-0.5 text-sm">
      <button
        onClick={() => onChange('orders')}
        className={`px-3 py-1 rounded-md transition ${
          value === 'orders' ? 'bg-background shadow text-foreground font-medium' : 'text-muted-foreground'
        }`}
      >
        已下订单
      </button>
      <button
        onClick={() => onChange('paid_orders')}
        className={`px-3 py-1 rounded-md transition ${
          value === 'paid_orders' ? 'bg-background shadow text-foreground font-medium' : 'text-muted-foreground'
        }`}
      >
        已付款订单
      </button>
    </div>
  )
}
