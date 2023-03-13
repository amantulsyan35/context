import { useEffect, useRef, useLayoutEffect, useState } from 'react';

type Draw = {
  ctx: CanvasRenderingContext2D;
  currentPoint: Point;
  prevPoint: Point | null;
};

type Point = { x: number; y: number };

export const useDraw = (
  onDraw: ({ ctx, currentPoint, prevPoint }: Draw) => void
) => {
  const [mouseDown, setMouseDown] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevPoint = useRef<null | Point>(null);

  //   let dpi = window.devicePixelRatio;

  //   if (canvasRef.current) {
  //     let style_height = +getComputedStyle(canvasRef.current)
  //       .getPropertyValue('height')
  //       .slice(0, -2);
  //     let style_width = +getComputedStyle(canvasRef.current)
  //       .getPropertyValue('width')
  //       .slice(0, -2);

  //     canvasRef.current.setAttribute('height', (style_height * dpi).toString());
  //     canvasRef.current.setAttribute('width', (style_width * dpi).toString());
  //   }

  const onMouseDown = () => setMouseDown(true);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!mouseDown) return;
      const currentPoint = computePointInCanvas(e);

      const ctx = canvasRef.current?.getContext('2d');

      if (!ctx || !currentPoint) return;

      onDraw({ ctx, currentPoint, prevPoint: prevPoint.current });
      prevPoint.current = currentPoint;
    };

    const computePointInCanvas = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      return { x, y };
    };

    const mouseUpHandler = () => {
      setMouseDown(false);
      prevPoint.current = null;
    };

    // Add event listeners
    canvasRef.current?.addEventListener('mousemove', handler);
    window.addEventListener('mouseup', mouseUpHandler);

    // Remove event listeners
    return () => {
      canvasRef.current?.removeEventListener('mousemove', handler);
      window.removeEventListener('mouseup', mouseUpHandler);
    };
  }, [onDraw]);

  return { canvasRef, onMouseDown, clear };
};
