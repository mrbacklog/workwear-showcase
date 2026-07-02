interface NoImagePlaceholderProps {
  className?: string
}

export function NoImagePlaceholder({ className }: NoImagePlaceholderProps) {
  return (
    <div className={`flex items-center justify-center bg-gray-100 ${className ?? ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/brand/vk-logo-mark.png"
        alt=""
        aria-hidden="true"
        className="w-1/3 opacity-20 grayscale"
        draggable={false}
      />
    </div>
  )
}
