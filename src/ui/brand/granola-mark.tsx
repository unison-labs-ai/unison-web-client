interface GranolaMarkProps {
	size?: number;
}

// Monochrome nod to Granola's hand-drawn squiggle mark; inherits ink via
// currentColor per the brand-icon conventions (no colored chips).
export function GranolaMark({ size = 18 }: GranolaMarkProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
			aria-label="Granola"
			fill="none"
		>
			<rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="1.6" />
			<path
				d="M6 13.5c1.2-3.4 2.6-5 3.9-4.4 1.4.6.4 4.6 1.8 5.2 1.2.5 2-1.6 3.2-3.4 1-1.5 2.1-2 3.1-1.3"
				stroke="currentColor"
				strokeWidth="1.6"
				strokeLinecap="round"
			/>
		</svg>
	);
}
