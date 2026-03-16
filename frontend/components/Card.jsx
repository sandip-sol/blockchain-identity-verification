export default function Card({ children, className = '', hover = false, gradient = false }) {
    return (
        <div
            className={`
                glass-card p-6
                ${hover ? 'card-hover' : ''}
                ${gradient ? 'border-gradient' : ''}
                ${className}
            `}
        >
            {children}
        </div>
    );
}

export function CardHeader({ title, subtitle, action }) {
    return (
        <div className="flex items-start justify-between mb-6">
            <div>
                <h3 className="font-['Space_Grotesk'] text-2xl font-semibold tracking-tight text-white mb-1">{title}</h3>
                {subtitle && <p className="text-white/60 text-sm">{subtitle}</p>}
            </div>
            {action && <div>{action}</div>}
        </div>
    );
}

export function CardContent({ children, className = '' }) {
    return (
        <div className={`space-y-4 ${className}`}>
            {children}
        </div>
    );
}

export function CardFooter({ children, className = '' }) {
    return (
        <div className={`mt-6 pt-6 border-t border-white/10 ${className}`}>
            {children}
        </div>
    );
}
