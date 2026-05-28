import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import type { ShaderMaterial } from 'three'
import { magazineFrag, swissFrag, vertexShader } from './shaders'
import type { DeckStyle, ThemeColors } from '../types'

function ShaderPlane({ style, colors }: { style: DeckStyle; colors: ThemeColors }) {
  const ref = useRef<ShaderMaterial>(null)

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uInk: {
        value: colors.ink
          ? [
              Number.parseInt(colors.ink.slice(1, 3), 16) / 255,
              Number.parseInt(colors.ink.slice(3, 5), 16) / 255,
              Number.parseInt(colors.ink.slice(5, 7), 16) / 255,
            ]
          : [0.04, 0.04, 0.04],
      },
      uPaper: {
        value: colors.paper
          ? [
              Number.parseInt(colors.paper.slice(1, 3), 16) / 255,
              Number.parseInt(colors.paper.slice(3, 5), 16) / 255,
              Number.parseInt(colors.paper.slice(5, 7), 16) / 255,
            ]
          : [0.95, 0.94, 0.92],
      },
      uAccent: {
        value: colors.accent
          ? [
              Number.parseInt(colors.accent.slice(1, 3), 16) / 255,
              Number.parseInt(colors.accent.slice(3, 5), 16) / 255,
              Number.parseInt(colors.accent.slice(5, 7), 16) / 255,
            ]
          : [0, 0.09, 0.96],
      },
    }),
    [colors],
  )

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.uniforms.uTime.value += delta
    }
  })

  const fragShader = style === 'swiss' ? swissFrag : magazineFrag

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={ref}
        vertexShader={vertexShader}
        fragmentShader={fragShader}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  )
}

export function WebGLBackground({
  style,
  colors,
}: {
  style: DeckStyle
  colors: ThemeColors
  currentIndex: number
}) {
  return (
    <div className="fixed inset-0" style={{ zIndex: 1 }}>
      <Canvas
        gl={{ antialias: true, alpha: false }}
        style={{ width: '100%', height: '100%' }}
      >
        <ShaderPlane style={style} colors={colors} />
      </Canvas>
    </div>
  )
}
