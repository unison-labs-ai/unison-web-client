interface LinearMarkProps {
	size?: number;
}

// Monochrome nod to Linear's angular mark; inherits ink via currentColor per
// the brand-icon conventions (no colored chips).
export function LinearMark({ size = 18 }: LinearMarkProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			xmlns="http://www.w3.org/2000/svg"
			aria-label="Linear"
			fill="none"
		>
			<rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="1.6" />
			<path
				d="M6.5 13.5 10.5 17.5M6.5 10 14 17.5M6.5 6.5 17.5 17.5M10 6.5 17.5 14M13.5 6.5 17.5 10.5"
				stroke="currentColor"
				strokeWidth="1.6"
				strokeLinecap="round"
			/>
		</svg>
	);
}
