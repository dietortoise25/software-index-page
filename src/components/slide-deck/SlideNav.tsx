import { useSlideDeck } from './SlideDeckContext'

export function SlideNav() {
  const { currentIndex, totalSlides, goTo, colors } = useSlideDeck()

  return (
    <div
      className="fixed bottom-5 left-1/2 -translate-x-1/2 flex gap-[7px]"
      style={{ zIndex: 100 }}
    >
      {Array.from({ length: totalSlides }, (_, i) => (
        <button
          key={i}
          onClick={() => goTo(i)}
          className="rounded-full transition-all duration-300 cursor-pointer border-none"
          style={{
            width: i === currentIndex ? 22 : 7,
            height: 7,
            background: i === currentIndex ? colors.accent : 'rgba(255,255,255,0.2)',
            borderRadius: i === currentIndex ? 4 : '50%',
          }}
          aria-label={`跳转到第 ${i + 1} 页`}
        />
      ))}
    </div>
  )
}
