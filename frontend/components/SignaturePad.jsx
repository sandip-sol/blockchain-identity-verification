'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';

// Minimal signature pad (no external deps)
// Exposes base64 PNG (without data: header) via onChange
export default function SignaturePad({ width = 520, height = 180, onChange }) {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const ctx = useMemo(() => {
        const c = canvasRef.current;
        return c ? c.getContext('2d') : null;
    }, [canvasRef.current]);

    useEffect(() => {
        const c = canvasRef.current;
        if (!c) return;
        const context = c.getContext('2d');
        context.lineWidth = 2.5;
        context.lineCap = 'round';
        context.strokeStyle = '#ffffff';
        // fill background transparent
        context.clearRect(0, 0, c.width, c.height);
    }, []);

    const getPos = (e) => {
        const c = canvasRef.current;
        const rect = c.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top,
        };
    };

    const start = (e) => {
        e.preventDefault();
        const c = canvasRef.current;
        if (!c) return;
        const context = c.getContext('2d');
        const { x, y } = getPos(e);
        context.beginPath();
        context.moveTo(x, y);
        setIsDrawing(true);
    };

    const move = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const c = canvasRef.current;
        if (!c) return;
        const context = c.getContext('2d');
        const { x, y } = getPos(e);
        context.lineTo(x, y);
        context.stroke();
    };

    const end = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        setIsDrawing(false);
        const c = canvasRef.current;
        if (!c) return;
        const dataUrl = c.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        onChange?.(base64);
    };

    const clear = () => {
        const c = canvasRef.current;
        if (!c) return;
        const context = c.getContext('2d');
        context.clearRect(0, 0, c.width, c.height);
        onChange?.(null);
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-400">Draw your signature below</p>
                <button
                    type="button"
                    onClick={clear}
                    className="flex items-center gap-2 text-sm text-gray-300 hover:text-white"
                >
                    <RotateCcw className="w-4 h-4" />
                    Clear
                </button>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <canvas
                    ref={canvasRef}
                    width={width}
                    height={height}
                    className="w-full rounded-lg touch-none"
                    onMouseDown={start}
                    onMouseMove={move}
                    onMouseUp={end}
                    onMouseLeave={end}
                    onTouchStart={start}
                    onTouchMove={move}
                    onTouchEnd={end}
                />
            </div>
        </div>
    );
}
